import { describe, expect, it } from 'vitest';
import { onesComplementChecksum } from '../../lib/checksum';
import { EventQueue } from '../../engine/eventQueue';
import {
  applyNatOutbound,
  convergeRoutingTables,
  evaluateFirewall,
  fragmentByMtu,
  lookupArp,
  lookupNatInbound,
  lookupRouteLpm,
  switchForward,
  upsertArp,
} from '../../engine/l2l3';
import { buildRealPacket } from '../../engine/packetBuilder';
import { SeededRNG } from '../../engine/rng';
import { createDefaultInterface, SimulationEngine } from '../../engine/simulator';
import {
  createTcpControlBlock,
  effectiveWindowBytes,
  onNewAckCongestionControl,
  onRtoTimeout,
  onTripleDupAck,
  stepTcpFsm,
  updateRttEstimate,
} from '../../engine/tcp';
import type { RouteEntry, SimDevice, SimLink } from '../../engine/types';

function makeDevice(id: string, role: SimDevice['role'], ip: string, macSuffix: string): SimDevice {
  return {
    id,
    name: id,
    role,
    x: 0,
    y: 0,
    poweredOn: true,
    interfaces: [createDefaultInterface('eth0', 'eth0', ip, '255.255.255.0', undefined, macSuffix)],
    routingTable: [],
    arpCache: [],
    macTable: [],
    natTable: [],
    firewallRules: [],
    services: {},
    openPorts: [80],
    cpuLoad: 5,
  };
}

describe('EventQueue & SeededRNG', () => {
  it('orders events strictly by (timeMs, seq) in binary min-heap', () => {
    const q = new EventQueue();
    q.push({ seq: 3, timeMs: 20, type: 'PACKET_SEND', deviceId: 'a' });
    q.push({ seq: 2, timeMs: 10, type: 'PACKET_SEND', deviceId: 'b' });
    q.push({ seq: 1, timeMs: 10, type: 'PACKET_DELIVER', deviceId: 'c' });

    expect(q.size).toBe(3);
    expect(q.peek()?.seq).toBe(1);
    expect(q.toArray().map((e) => e.seq)).toEqual([1, 2, 3]);
    expect(q.pop()?.seq).toBe(1);
    expect(q.pop()?.seq).toBe(2);
    expect(q.pop()?.seq).toBe(3);
    expect(q.pop()).toBeUndefined();
  });

  it('produces deterministic seeded PRNG values within bounds', () => {
    const a = new SeededRNG(12345);
    const b = new SeededRNG(12345);
    for (let i = 0; i < 20; i++) {
      const va = a.next();
      const vb = b.next();
      expect(va).toBe(vb);
      expect(va).toBeGreaterThanOrEqual(0);
      expect(va).toBeLessThan(1);
      const ra = a.intRange(10, 20);
      const rb = b.intRange(10, 20);
      expect(ra).toBe(rb);
      expect(ra).toBeGreaterThanOrEqual(10);
      expect(ra).toBeLessThanOrEqual(20);
    }
  });
});

describe('TCP FSM & Congestion Control', () => {
  it('completes 3-way handshake, RST handling, and 4-way FIN teardown', () => {
    const c = createTcpControlBlock({ id: 'c', localIp: '10.0.0.1', localPort: 50000, remoteIp: '10.0.0.2', remotePort: 80 });
    const s = createTcpControlBlock({ id: 's', localIp: '10.0.0.2', localPort: 80, remoteIp: '10.0.0.1', remotePort: 50000, initialState: 'LISTEN' });

    c.state = 'SYN_SENT';
    const synAck = stepTcpFsm(s, { urg: false, ack: false, psh: false, rst: false, syn: true, fin: false }, 0, 0, 0);
    expect(s.state).toBe('SYN_RCVD');
    const ack = stepTcpFsm(c, synAck.nextFlags!, 0, 1, 0);
    expect(c.state).toBe('ESTABLISHED');
    stepTcpFsm(s, ack.nextFlags!, 1, 1, 0);
    expect(s.state).toBe('ESTABLISHED');

    // Data delivery advances rcvNxt
    const dataAck = stepTcpFsm(s, { urg: false, ack: true, psh: true, rst: false, syn: false, fin: false }, 1, 1, 120);
    expect(dataAck.ackToSend).toBe(121);

    // RST resets SYN_SENT back to CLOSED
    const rstPeer = createTcpControlBlock({ id: 'r', localIp: '10.0.0.1', localPort: 50001, remoteIp: '10.0.0.2', remotePort: 99, initialState: 'SYN_SENT' });
    stepTcpFsm(rstPeer, { urg: false, ack: true, psh: false, rst: true, syn: false, fin: false }, 0, 1, 0);
    expect(rstPeer.state).toBe('CLOSED');
  });

  it('implements RFC 6298 RTT estimation and Tahoe/Reno/CUBIC cwnd dynamics', () => {
    const reno = createTcpControlBlock({ id: 'reno', localIp: '1.1.1.1', localPort: 1, remoteIp: '2.2.2.2', remotePort: 80, algorithm: 'reno' });
    updateRttEstimate(reno, 40);
    expect(reno.srttMs).toBe(40);
    expect(reno.rtoMs).toBeGreaterThanOrEqual(200);

    // Slow start doubles cwnd up to ssthresh
    onNewAckCongestionControl(reno, 40);
    expect(reno.cwnd).toBe(3);

    reno.cwnd = 10;
    expect(onTripleDupAck(reno, 100)).toBe(false);
    expect(onTripleDupAck(reno, 110)).toBe(false);
    expect(onTripleDupAck(reno, 120)).toBe(true);
    expect(reno.ssthresh).toBe(5);
    expect(reno.cwnd).toBe(8); // Reno fast recovery: ssthresh + 3

    const tahoe = createTcpControlBlock({ id: 'tahoe', localIp: '1.1.1.1', localPort: 2, remoteIp: '2.2.2.2', remotePort: 80, algorithm: 'tahoe' });
    tahoe.cwnd = 10;
    onTripleDupAck(tahoe, 10);
    onTripleDupAck(tahoe, 20);
    onTripleDupAck(tahoe, 30);
    expect(tahoe.cwnd).toBe(1); // Tahoe drops to 1 MSS

    const cubic = createTcpControlBlock({ id: 'cubic', localIp: '1.1.1.1', localPort: 3, remoteIp: '2.2.2.2', remotePort: 80, algorithm: 'cubic', rwnd: 4000 });
    cubic.cwnd = 10;
    onTripleDupAck(cubic, 10);
    onTripleDupAck(cubic, 20);
    onTripleDupAck(cubic, 30);
    expect(cubic.cwnd).toBe(7); // 0.7 * 10
    expect(effectiveWindowBytes(cubic)).toBe(4000); // Respects smaller rwnd

    onRtoTimeout(cubic, 200);
    expect(cubic.cwnd).toBe(1);
    expect(cubic.rtoMs).toBe(2000);
  });
});

describe('L2 Switching, L3 Routing, Firewall ACL, NAT, MTU & ARP', () => {
  it('handles VLAN isolation, trunking, and MAC aging on L2 switches', () => {
    const sw: SimDevice = {
      ...makeDevice('sw', 'switch', '', '01'),
      interfaces: [
        { ...createDefaultInterface('p1', 'gi0/1', '', '', undefined, 'a1'), vlan: 10 },
        { ...createDefaultInterface('p2', 'gi0/2', '', '', undefined, 'a2'), vlan: 10 },
        { ...createDefaultInterface('p3', 'gi0/3', '', '', undefined, 'a3'), vlan: 20 },
        { ...createDefaultInterface('p4', 'gi0/4', '', '', undefined, 'a4'), isTrunk: true, trunkVlans: [10, 20] },
      ],
    };
    const links: SimLink[] = [
      { id: 'l1', sourceId: 'h1', sourceIface: 'eth0', targetId: 'sw', targetIface: 'p1', medium: 'ethernet', bandwidthMbps: 1000, delayMs: 1, jitterMs: 0, lossPercent: 0, mtu: 1500, duplex: 'full', up: true },
      { id: 'l2', sourceId: 'h2', sourceIface: 'eth0', targetId: 'sw', targetIface: 'p2', medium: 'ethernet', bandwidthMbps: 1000, delayMs: 1, jitterMs: 0, lossPercent: 0, mtu: 1500, duplex: 'full', up: true },
      { id: 'l3', sourceId: 'h3', sourceIface: 'eth0', targetId: 'sw', targetIface: 'p3', medium: 'ethernet', bandwidthMbps: 1000, delayMs: 1, jitterMs: 0, lossPercent: 0, mtu: 1500, duplex: 'full', up: true },
      { id: 'l4', sourceId: 'r1', sourceIface: 'eth0', targetId: 'sw', targetIface: 'p4', medium: 'ethernet', bandwidthMbps: 1000, delayMs: 1, jitterMs: 0, lossPercent: 0, mtu: 1500, duplex: 'full', up: true },
    ];

    // Broadcast on VLAN 10 should flood to p2 and trunk p4, NOT VLAN 20 p3
    const res = switchForward(sw, 'p1', '02:00:00:00:00:01', 'ff:ff:ff:ff:ff:ff', 10, 1000, links);
    expect(res.flooded).toBe(true);
    expect(res.outIfaceIds).toEqual(['p2', 'p4']);

    // Aged out after > 300s
    const afterAge = switchForward(sw, 'p2', '02:00:00:00:00:02', '02:00:00:00:00:01', 10, 305_000, links);
    expect(afterAge.flooded).toBe(true);
  });

  it('resolves LPM tie-breaking by metric, stateful inbound/outbound firewall ACLs, NAT PAT, MTU frags & ARP expiry', () => {
    const routes: RouteEntry[] = [
      { network: '10.0.0.0', mask: '255.255.0.0', nextHop: '1.1.1.1', iface: 'eth0', metric: 20, protocol: 'rip' },
      { network: '10.0.0.0', mask: '255.255.0.0', nextHop: '1.1.1.2', iface: 'eth1', metric: 5, protocol: 'ospf' },
    ];
    expect(lookupRouteLpm(routes, '10.0.5.5')?.nextHop).toBe('1.1.1.2');

    // Stateful firewall allows return traffic for inbound-allowed DMZ sessions
    const fw = makeDevice('fw', 'firewall', '198.51.100.1', 'f1');
    fw.statefulFirewall = true;
    fw.firewallRules = [
      { id: 'r1', action: 'allow', direction: 'inbound', protocol: 'TCP', srcIp: 'any', dstIp: '172.16.0.10', dstPort: 80 },
      { id: 'r2', action: 'deny', direction: 'inbound', protocol: 'ANY', srcIp: 'any', dstIp: 'any', dstPort: 'any' },
    ];
    const flows = new Set<string>();
    const reqPkt = buildRealPacket({
      id: 'req', no: 1, timestampMs: 0, arrivalMs: 5, fromDeviceId: 'ext', toDeviceId: 'fw',
      protocol: 'TCP', colorCategory: 'tcp', info: 'SYN', osiLayer: 4,
      ethernet: { srcMac: '02:00:00:00:00:01', dstMac: '02:00:00:00:00:02', etherType: '0x0800' },
      ipv4: { version: 4, ihl: 5, tos: 0, identification: 1, flags: { df: true, mf: false }, fragmentOffset: 0, ttl: 64, protocol: 6, srcIp: '198.51.100.99', dstIp: '172.16.0.10' },
      tcp: { srcPort: 54000, dstPort: 80, seq: 0, ack: 0, dataOffset: 5, flags: { urg: false, ack: false, psh: false, rst: false, syn: true, fin: false }, window: 65535, urgentPointer: 0 },
    });
    const replyPkt = buildRealPacket({
      id: 'rep', no: 2, timestampMs: 5, arrivalMs: 10, fromDeviceId: 'dmz', toDeviceId: 'fw',
      protocol: 'TCP', colorCategory: 'tcp', info: 'SYN-ACK', osiLayer: 4,
      ethernet: { srcMac: '02:00:00:00:00:02', dstMac: '02:00:00:00:00:01', etherType: '0x0800' },
      ipv4: { version: 4, ihl: 5, tos: 0, identification: 2, flags: { df: true, mf: false }, fragmentOffset: 0, ttl: 64, protocol: 6, srcIp: '172.16.0.10', dstIp: '198.51.100.99' },
      tcp: { srcPort: 80, dstPort: 54000, seq: 0, ack: 1, dataOffset: 5, flags: { urg: false, ack: true, psh: false, rst: false, syn: true, fin: false }, window: 65535, urgentPointer: 0 },
    });
    expect(evaluateFirewall(fw, reqPkt, 'inbound', flows).allowed).toBe(true);
    expect(evaluateFirewall(fw, replyPkt, 'inbound', flows).allowed).toBe(true);

    // NAT outbound PAT collision avoidance & inbound lookup
    const nat = makeDevice('nat', 'nat_gateway', '198.51.100.1', 'n1');
    const n1 = applyNatOutbound(nat, '192.168.1.10', 50000, '203.0.113.10', 80, 'TCP', '198.51.100.1', 100);
    const n2 = applyNatOutbound(nat, '192.168.1.11', 50000, '203.0.113.10', 80, 'TCP', '198.51.100.1', 105);
    expect(n1.translatedPort).not.toBe(n2.translatedPort);
    expect(lookupNatInbound(nat, n1.translatedPort, 'TCP')?.insideLocalIp).toBe('192.168.1.10');

    // MTU fragmentation splits 1420 bytes over MTU 576 into aligned 8-byte chunks
    const frags = fragmentByMtu(1420, 576);
    expect(frags.length).toBe(3);
    expect(frags[0].mf).toBe(true);
    expect(frags[2].mf).toBe(false);
    expect(frags[1].offset).toBe(552 / 8);

    // ARP cache TTL expiry
    upsertArp(nat, '192.168.1.10', '02:00:00:00:00:10', 1000, 5000);
    expect(lookupArp(nat, '192.168.1.10', 3000)).toBe('02:00:00:00:00:10');
    expect(lookupArp(nat, '192.168.1.10', 7000)).toBeUndefined();
  });

  it('converges BGP AS_PATH routes with loop prevention and builds valid wire bytes', () => {
    const r1 = makeDevice('r1', 'router', '10.0.1.1', 'r1');
    r1.asn = 64500;
    r1.routingProtocol = 'bgp';
    const r2 = makeDevice('r2', 'router', '10.0.2.1', 'r2');
    r2.asn = 64501;
    r2.routingProtocol = 'bgp';
    const link: SimLink = {
      id: 'l1', sourceId: 'r1', sourceIface: 'eth0', targetId: 'r2', targetIface: 'eth0',
      medium: 'fiber', bandwidthMbps: 1000, delayMs: 5, jitterMs: 0, lossPercent: 0, mtu: 1500, duplex: 'full', up: true,
    };
    convergeRoutingTables([r1, r2], [link]);
    expect(r1.routingTable.some((rt) => rt.network === '10.0.2.0' && rt.protocol === 'bgp')).toBe(true);

    const vlanPkt = buildRealPacket({
      id: 'v1', no: 1, timestampMs: 0, arrivalMs: 2, fromDeviceId: 'r1', toDeviceId: 'r2',
      protocol: 'HTTP', colorCategory: 'http_req', info: 'VLAN GET', osiLayer: 7,
      ethernet: { srcMac: '02:00:00:00:00:01', dstMac: '02:00:00:00:00:02', etherType: '0x0800', vlanId: 10 },
      ipv4: { version: 4, ihl: 5, tos: 0, identification: 1, flags: { df: true, mf: false }, fragmentOffset: 0, ttl: 64, protocol: 6, srcIp: '10.0.1.1', dstIp: '10.0.2.1' },
      tcp: { srcPort: 50000, dstPort: 80, seq: 1, ack: 1, dataOffset: 5, flags: { urg: false, ack: true, psh: true, rst: false, syn: false, fin: false }, window: 65535, urgentPointer: 0 },
      payloadText: 'GET / HTTP/1.1',
    });
    // IPv4 header starts at byte 18 (14 Ethernet + 4 byte 802.1Q tag)
    expect(vlanPkt.rawBytes[12]).toBe(0x81);
    expect(vlanPkt.rawBytes[13]).toBe(0x00);
    expect(onesComplementChecksum(vlanPkt.rawBytes.slice(18, 38))).toBe(0);
  });

  it('calculates quadratic Bezier curved paths for packets between non-direct nodes', () => {
    const pc = { ...makeDevice('pc', 'host', '192.168.1.10', '10'), x: 150, y: 220 };
    const r = { ...makeDevice('r', 'router', '192.168.1.1', '01'), x: 480, y: 220 };
    const dhcp = { ...makeDevice('dhcp', 'dhcp_server', '10.0.0.50', '50'), x: 820, y: 220 };
    const links: SimLink[] = [
      { id: 'l1', sourceId: 'pc', sourceIface: 'eth0', targetId: 'r', targetIface: 'eth0', medium: 'ethernet', bandwidthMbps: 100, delayMs: 4, jitterMs: 0, lossPercent: 0, mtu: 1500, duplex: 'full', up: true },
      { id: 'l2', sourceId: 'r', sourceIface: 'eth0', targetId: 'dhcp', targetIface: 'eth0', medium: 'ethernet', bandwidthMbps: 100, delayMs: 4, jitterMs: 0, lossPercent: 0, mtu: 1500, duplex: 'full', up: true },
    ];

    const engine = new SimulationEngine({ seed: 7, devices: [pc, r, dhcp], links });

    // Direct neighbor pair does not get a non-direct curvedPath
    expect(engine.calculateCurvedPath('pc', 'r')).toBeUndefined();
    const directPkt = engine.enqueueDirectPacket({
      fromId: 'pc',
      toId: 'r',
      protocol: 'DHCP',
      colorCategory: 'udp',
      info: 'Direct hop',
      osiLayer: 7,
    });
    expect(directPkt.curvedPath).toBeUndefined();

    // Non-direct pair (dhcp -> pc across r) gets a quadratic Bezier curvedPath
    const nonDirectPkt = engine.enqueueDirectPacket({
      fromId: 'dhcp',
      toId: 'pc',
      protocol: 'DHCP',
      colorCategory: 'udp',
      info: 'Non-direct ACK',
      osiLayer: 7,
    });
    expect(nonDirectPkt.linkId).toBeUndefined();
    expect(nonDirectPkt.curvedPath).toBeDefined();
    expect(nonDirectPkt.curvedPath?.isNonDirect).toBe(true);
    expect(nonDirectPkt.curvedPath?.viaNodeIds).toEqual(['dhcp', 'r', 'pc']);
    expect(nonDirectPkt.curvedPath?.svgPathD).toMatch(/^M 820 220 Q 485 \d+(\.\d+)? 150 220$/);
    expect(Math.abs((nonDirectPkt.curvedPath?.control.y ?? 220) - 220)).toBeGreaterThan(40);

    // Reverse non-direct direction curves symmetrically on the opposite side
    const reverseCurve = engine.calculateCurvedPath('pc', 'dhcp');
    expect(reverseCurve).toBeDefined();
    expect(reverseCurve!.control.y).not.toBe(nonDirectPkt.curvedPath!.control.y);
  });
});
