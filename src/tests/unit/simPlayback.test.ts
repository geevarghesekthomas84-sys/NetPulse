import { describe, expect, it } from 'vitest';
import type { CapturedPacket, SimDevice, SimLink } from '../../engine/types';
import {
  computeAnimatedPacketPosition,
  describePacketStateChange,
  resolvePacketCurveGeometry,
  resolveSimShortcutAction,
} from '../../lib/simPlayback';

function makeBasePacket(overrides: Partial<CapturedPacket> = {}): CapturedPacket {
  return {
    id: 'pkt-1',
    no: 1,
    timestampMs: 10,
    arrivalMs: 14.5,
    fromDeviceId: 'pc1',
    toDeviceId: 'srv1',
    srcMac: '00:11:22:33:44:01',
    dstMac: '00:11:22:33:44:02',
    srcIp: '192.168.1.10',
    dstIp: '203.0.113.10',
    protocol: 'TCP',
    colorCategory: 'tcp',
    info: 'Test frame',
    sizeBytes: 64,
    osiLayer: 4,
    layers: {
      ethernet: { srcMac: '00:11:22:33:44:01', dstMac: '00:11:22:33:44:02', etherType: '0x0800' },
    },
    rawBytes: [],
    fieldRanges: [],
    ...overrides,
  };
}

const defaultFlags = { urg: false, ack: false, psh: false, rst: false, syn: false, fin: false };

describe('describePacketStateChange', () => {
  it('describes dropped packets with drop reason and danger tone', () => {
    const pkt = makeBasePacket({ dropped: true, dropReason: 'Firewall blocked port 80' });
    const snap = describePacketStateChange(pkt, 'Router', 'Web Server');
    expect(snap.phase).toBe('Packet Dropped');
    expect(snap.transition).toBe('DROP at Web Server');
    expect(snap.detail).toContain('Firewall blocked port 80');
    expect(snap.tone).toBe('danger');
  });

  it('describes ARP Request and ARP Reply state transitions', () => {
    const req = makeBasePacket({
      protocol: 'ARP',
      layers: {
        ethernet: { srcMac: 'aa:bb:cc:dd:ee:01', dstMac: 'ff:ff:ff:ff:ff:ff', etherType: '0x0806' },
        arp: {
          opcode: 1,
          senderMac: 'aa:bb:cc:dd:ee:01',
          senderIp: '192.168.1.10',
          targetMac: '00:00:00:00:00:00',
          targetIp: '192.168.1.1',
        },
      },
    });
    const reqSnap = describePacketStateChange(req, 'Laptop', 'Broadcast');
    expect(reqSnap.phase).toBe('L2 ARP Discovery');
    expect(reqSnap.transition).toBe('ARP Request (192.168.1.1)');
    expect(reqSnap.tone).toBe('warning');

    const rep = makeBasePacket({
      protocol: 'ARP',
      layers: {
        ethernet: { srcMac: 'aa:bb:cc:dd:ee:fe', dstMac: 'aa:bb:cc:dd:ee:01', etherType: '0x0806' },
        arp: {
          opcode: 2,
          senderMac: 'aa:bb:cc:dd:ee:fe',
          senderIp: '192.168.1.1',
          targetMac: 'aa:bb:cc:dd:ee:01',
          targetIp: '192.168.1.10',
        },
      },
    });
    const repSnap = describePacketStateChange(rep, 'Router', 'Laptop');
    expect(repSnap.phase).toBe('L2 ARP Cache Update');
    expect(repSnap.transition).toBe('ARP Reply (192.168.1.1 → aa:bb:cc:dd:ee:fe)');
    expect(repSnap.tone).toBe('success');
  });

  it('describes TCP FSM states: SYN, SYN+ACK, ACK, PSH+ACK, FIN, and RST', () => {
    const baseTcp = {
      srcPort: 51234,
      dstPort: 80,
      seq: 100,
      ack: 0,
      dataOffset: 5,
      window: 65535,
      checksum: 0,
      urgentPointer: 0,
    };

    const syn = describePacketStateChange(
      makeBasePacket({
        layers: {
          ethernet: { srcMac: 'a', dstMac: 'b', etherType: '0x0800' },
          tcp: { ...baseTcp, flags: { ...defaultFlags, syn: true } },
        },
      }),
      'Client',
      'Server'
    );
    expect(syn.transition).toBe('CLOSED → SYN_SENT');
    expect(syn.tone).toBe('info');

    const synAck = describePacketStateChange(
      makeBasePacket({
        layers: {
          ethernet: { srcMac: 'b', dstMac: 'a', etherType: '0x0800' },
          tcp: { ...baseTcp, ack: 101, flags: { ...defaultFlags, syn: true, ack: true } },
        },
      }),
      'Server',
      'Client'
    );
    expect(synAck.transition).toBe('LISTEN → SYN_RCVD');

    const ack = describePacketStateChange(
      makeBasePacket({
        layers: {
          ethernet: { srcMac: 'a', dstMac: 'b', etherType: '0x0800' },
          tcp: { ...baseTcp, seq: 101, ack: 201, flags: { ...defaultFlags, ack: true } },
        },
      }),
      'Client',
      'Server'
    );
    expect(ack.transition).toBe('SYN_SENT / SYN_RCVD → ESTABLISHED');
    expect(ack.tone).toBe('success');

    const pshAck = describePacketStateChange(
      makeBasePacket({
        sizeBytes: 256,
        layers: {
          ethernet: { srcMac: 'a', dstMac: 'b', etherType: '0x0800' },
          tcp: { ...baseTcp, seq: 101, ack: 201, flags: { ...defaultFlags, psh: true, ack: true } },
        },
      }),
      'Client',
      'Server'
    );
    expect(pshAck.phase).toBe('TCP Data Delivery');
    expect(pshAck.transition).toBe('ESTABLISHED · DATA (256B)');

    const fin = describePacketStateChange(
      makeBasePacket({
        layers: {
          ethernet: { srcMac: 'a', dstMac: 'b', etherType: '0x0800' },
          tcp: { ...baseTcp, flags: { ...defaultFlags, fin: true, ack: true } },
        },
      }),
      'Client',
      'Server'
    );
    expect(fin.transition).toBe('ESTABLISHED → FIN_WAIT / CLOSE_WAIT');
    expect(fin.tone).toBe('warning');

    const rst = describePacketStateChange(
      makeBasePacket({
        layers: {
          ethernet: { srcMac: 'b', dstMac: 'a', etherType: '0x0800' },
          tcp: { ...baseTcp, flags: { ...defaultFlags, rst: true, ack: true } },
        },
      }),
      'Server',
      'Client'
    );
    expect(rst.transition).toBe('ANY → CLOSED (RST)');
    expect(rst.tone).toBe('danger');
  });

  it('describes TLS handshake and HTTP application exchanges over TCP', () => {
    const tlsPkt = makeBasePacket({
      protocol: 'TLSv1.3',
      info: 'Client Hello',
      layers: {
        ethernet: { srcMac: 'a', dstMac: 'b', etherType: '0x0800' },
        tcp: {
          srcPort: 50000,
          dstPort: 443,
          seq: 10,
          ack: 20,
          dataOffset: 5,
          window: 65535,
          checksum: 0,
          urgentPointer: 0,
          flags: { ...defaultFlags, psh: true, ack: true },
        },
        tls: { recordType: 'Handshake', version: 'TLS 1.3', handshakeType: 'ClientHello' },
      },
    });
    const tlsSnap = describePacketStateChange(tlsPkt, 'Browser', 'Gateway');
    expect(tlsSnap.phase).toBe('TLS Security Handshake');
    expect(tlsSnap.transition).toBe('TLS 1.3 · ClientHello');

    const httpPkt = makeBasePacket({
      protocol: 'HTTP',
      layers: {
        ethernet: { srcMac: 'a', dstMac: 'b', etherType: '0x0800' },
        tcp: {
          srcPort: 50000,
          dstPort: 80,
          seq: 10,
          ack: 20,
          dataOffset: 5,
          window: 65535,
          checksum: 0,
          urgentPointer: 0,
          flags: { ...defaultFlags, psh: true, ack: true },
        },
        app: { protocolName: 'HTTP/1.1', summary: 'GET /index.html', fields: [] },
      },
    });
    const httpSnap = describePacketStateChange(httpPkt, 'Browser', 'Web Server');
    expect(httpSnap.phase).toBe('HTTP/1.1 Exchange');
    expect(httpSnap.transition).toBe('ESTABLISHED · HTTP/1.1');
    expect(httpSnap.detail).toContain('GET /index.html');
  });

  it('describes DNS queries/responses, ICMP Echo/Control, and UDP datagrams', () => {
    const dnsQ = describePacketStateChange(
      makeBasePacket({
        protocol: 'DNS',
        layers: {
          ethernet: { srcMac: 'a', dstMac: 'b', etherType: '0x0800' },
          dns: {
            transactionId: 0x1a2b,
            isResponse: false,
            opcode: 'QUERY',
            flags: ['RD'],
            questions: [{ name: 'example.com', type: 'A' }],
            answers: [],
          },
        },
      }),
      'Client',
      'DNS Resolver'
    );
    expect(dnsQ.phase).toBe('DNS Query');
    expect(dnsQ.transition).toBe('Lookup A example.com');

    const dnsA = describePacketStateChange(
      makeBasePacket({
        protocol: 'DNS',
        layers: {
          ethernet: { srcMac: 'b', dstMac: 'a', etherType: '0x0800' },
          dns: {
            transactionId: 0x1a2b,
            isResponse: true,
            opcode: 'QUERY',
            flags: ['RD', 'RA'],
            questions: [{ name: 'example.com', type: 'A' }],
            answers: [{ name: 'example.com', type: 'A', value: '93.184.216.34', ttl: 300 }],
          },
        },
      }),
      'DNS Resolver',
      'Client'
    );
    expect(dnsA.phase).toBe('DNS Cache & Resolution');
    expect(dnsA.transition).toBe('Resolved example.com → 93.184.216.34');
    expect(dnsA.tone).toBe('success');

    const icmpReq = describePacketStateChange(
      makeBasePacket({
        protocol: 'ICMP',
        layers: {
          ethernet: { srcMac: 'a', dstMac: 'b', etherType: '0x0800' },
          ipv4: {
            version: 4,
            ihl: 5,
            tos: 0,
            totalLength: 60,
            identification: 1,
            flags: { df: true, mf: false },
            fragmentOffset: 0,
            ttl: 64,
            protocol: 1,
            checksum: 0,
            srcIp: '192.168.1.10',
            dstIp: '8.8.8.8',
          },
          icmp: { type: 8, code: 0, checksum: 0, identifier: 1, sequence: 3, message: 'Echo request' },
        },
      }),
      'PC',
      'DNS'
    );
    expect(icmpReq.transition).toBe('Echo Request (seq=3)');

    const icmpRep = describePacketStateChange(
      makeBasePacket({
        protocol: 'ICMP',
        timestampMs: 10,
        arrivalMs: 15.2,
        layers: {
          ethernet: { srcMac: 'b', dstMac: 'a', etherType: '0x0800' },
          icmp: { type: 0, code: 0, checksum: 0, identifier: 1, sequence: 3, message: 'Echo reply' },
        },
      }),
      'DNS',
      'PC'
    );
    expect(icmpRep.transition).toBe('Echo Reply (seq=3)');
    expect(icmpRep.detail).toContain('5.2ms');

    const udpSnap = describePacketStateChange(
      makeBasePacket({
        protocol: 'QUIC',
        info: 'Initial packet',
        layers: {
          ethernet: { srcMac: 'a', dstMac: 'b', etherType: '0x0800' },
          udp: { srcPort: 54000, dstPort: 443, length: 1200, checksum: 0 },
        },
      }),
      'PC',
      'CDN'
    );
    expect(udpSnap.phase).toBe('UDP Datagram Delivery');
    expect(udpSnap.transition).toBe('54000 → 443 (QUIC)');
  });
});

describe('resolveSimShortcutAction', () => {
  it('maps Space, ArrowRight, R, M, +, -, and ? in both live and step modes', () => {
    expect(resolveSimShortcutAction({ key: ' ', code: 'Space', playbackMode: 'live' })).toBe('toggle_play');
    expect(resolveSimShortcutAction({ key: 'ArrowRight', playbackMode: 'live' })).toBe('step_forward');
    expect(resolveSimShortcutAction({ key: 'ArrowRight', playbackMode: 'step' })).toBe('step_forward');
    expect(resolveSimShortcutAction({ key: 'r', playbackMode: 'live' })).toBe('reset');
    expect(resolveSimShortcutAction({ key: 'R', playbackMode: 'step' })).toBe('reset');
    expect(resolveSimShortcutAction({ key: 'm', playbackMode: 'live' })).toBe('toggle_mode');
    expect(resolveSimShortcutAction({ key: '+', playbackMode: 'step' })).toBe('speed_up');
    expect(resolveSimShortcutAction({ key: '=', playbackMode: 'live' })).toBe('speed_up');
    expect(resolveSimShortcutAction({ key: '-', playbackMode: 'step' })).toBe('speed_down');
    expect(resolveSimShortcutAction({ key: '?', playbackMode: 'live' })).toBe('toggle_shortcuts_help');
  });

  it('gates ArrowLeft, Home, and End to step mode', () => {
    expect(resolveSimShortcutAction({ key: 'ArrowLeft', playbackMode: 'live' })).toBeNull();
    expect(resolveSimShortcutAction({ key: 'Home', playbackMode: 'live' })).toBeNull();
    expect(resolveSimShortcutAction({ key: 'End', playbackMode: 'live' })).toBeNull();

    expect(resolveSimShortcutAction({ key: 'ArrowLeft', playbackMode: 'step' })).toBe('step_back');
    expect(resolveSimShortcutAction({ key: 'Home', playbackMode: 'step' })).toBe('rewind');
    expect(resolveSimShortcutAction({ key: 'End', playbackMode: 'step' })).toBe('jump_end');
  });

  it('ignores shortcuts inside inputs, editable elements, modifier combinations, and open modals', () => {
    expect(resolveSimShortcutAction({ key: ' ', code: 'Space', playbackMode: 'step', targetTagName: 'INPUT' })).toBeNull();
    expect(resolveSimShortcutAction({ key: 'ArrowRight', playbackMode: 'step', targetTagName: 'TEXTAREA' })).toBeNull();
    expect(resolveSimShortcutAction({ key: 'r', playbackMode: 'step', targetTagName: 'SELECT' })).toBeNull();
    expect(resolveSimShortcutAction({ key: 'm', playbackMode: 'step', isContentEditable: true })).toBeNull();
    expect(resolveSimShortcutAction({ key: 'r', playbackMode: 'step', ctrlKey: true })).toBeNull();
    expect(resolveSimShortcutAction({ key: 'r', playbackMode: 'step', metaKey: true })).toBeNull();
    expect(resolveSimShortcutAction({ key: 'ArrowRight', playbackMode: 'step', altKey: true })).toBeNull();
    expect(resolveSimShortcutAction({ key: ' ', code: 'Space', playbackMode: 'step', modalOpen: true })).toBeNull();
  });
});

describe('computeAnimatedPacketPosition', () => {
  it('interpolates linearly between devices and clamps t to [0, 1]', () => {
    const a = { x: 100, y: 200 };
    const b = { x: 500, y: 200 };
    expect(computeAnimatedPacketPosition(a, b, -0.5)).toEqual({ x: 100, y: 200 });
    expect(computeAnimatedPacketPosition(a, b, 0.5)).toEqual({ x: 300, y: 200 });
    expect(computeAnimatedPacketPosition(a, b, 1.5)).toEqual({ x: 500, y: 200 });
  });

  it('follows quadratic Bezier curve control points for parallel links', () => {
    const a = { x: 100, y: 200 };
    const b = { x: 500, y: 200 };
    const mid = computeAnimatedPacketPosition(a, b, 0.5, { x: 300, y: 120 });
    expect(mid.x).toBe(300);
    expect(mid.y).toBe(160);
  });

  it('produces a visible self-loop orbit when source and destination coincide', () => {
    const p = { x: 250, y: 250 };
    const t0 = computeAnimatedPacketPosition(p, p, 0);
    const tHalf = computeAnimatedPacketPosition(p, p, 0.5);
    expect(Math.hypot(tHalf.x - t0.x, tHalf.y - t0.y)).toBeGreaterThan(20);
  });
});

describe('resolvePacketCurveGeometry', () => {
  const devMap = new Map<string, SimDevice>([
    [
      'a',
      {
        id: 'a',
        name: 'A',
        role: 'host',
        x: 100,
        y: 220,
        poweredOn: true,
        interfaces: [],
        routingTable: [],
        arpCache: [],
        macTable: [],
        natTable: [],
        firewallRules: [],
        services: {},
        openPorts: [],
        cpuLoad: 0,
      },
    ],
    [
      'b',
      {
        id: 'b',
        name: 'B',
        role: 'host',
        x: 700,
        y: 220,
        poweredOn: true,
        interfaces: [],
        routingTable: [],
        arpCache: [],
        macTable: [],
        natTable: [],
        firewallRules: [],
        services: {},
        openPorts: [],
        cpuLoad: 0,
      },
    ],
  ]);

  it('uses straight line for single direct link and Bezier for non-direct packets', () => {
    const link: SimLink = {
      id: 'l1',
      sourceId: 'a',
      sourceIface: 'eth0',
      targetId: 'b',
      targetIface: 'eth0',
      medium: 'ethernet',
      bandwidthMbps: 100,
      delayMs: 5,
      jitterMs: 0,
      lossPercent: 0,
      mtu: 1500,
      duplex: 'full',
      up: true,
    };
    const direct = resolvePacketCurveGeometry({ x: 100, y: 220 }, { x: 700, y: 220 }, link, 0, devMap);
    expect(direct.isNonDirect).toBe(false);
    expect(direct.control).toBeNull();
    expect(direct.svgPathD).toBe('M 100 220 L 700 220');

    const nonDirect = resolvePacketCurveGeometry({ x: 100, y: 220 }, { x: 700, y: 220 }, undefined, 0, devMap, {
      isNonDirect: true,
      viaNodeIds: ['a', 'r', 'b'],
      start: { x: 100, y: 220 },
      control: { x: 400, y: 340 },
      end: { x: 700, y: 220 },
      svgPathD: 'M 100 220 Q 400 340 700 220',
      arcOffset: 120,
    });
    expect(nonDirect.isNonDirect).toBe(true);
    expect(nonDirect.control).toEqual({ x: 400, y: 340 });
    expect(nonDirect.svgPathD).toBe('M 100 220 Q 400 340 700 220');

    // Adapts smoothly when user drags node B to a new position
    const moved = resolvePacketCurveGeometry({ x: 100, y: 220 }, { x: 700, y: 300 }, undefined, 0, devMap, {
      isNonDirect: true,
      viaNodeIds: ['a', 'r', 'b'],
      start: { x: 100, y: 220 },
      control: { x: 400, y: 340 },
      end: { x: 700, y: 220 },
      svgPathD: 'M 100 220 Q 400 340 700 220',
      arcOffset: 120,
    });
    expect(moved.isNonDirect).toBe(true);
    expect(moved.svgPathD).toContain('M 100 220 Q');
    expect(moved.svgPathD).toContain('700 300');
  });
});
