import { describe, expect, it } from 'vitest';
import { createDefaultInterface, SimulationEngine } from '../../engine/simulator';
import type { SimDevice, SimLink } from '../../engine/types';
import { PRESET_LABS } from '../../simulator/labs';

function host(id: string, name: string, ip: string, gw: string, mac: string): SimDevice {
  return {
    id,
    name,
    role: 'host',
    x: 0,
    y: 0,
    poweredOn: true,
    interfaces: [createDefaultInterface('eth0', 'eth0', ip, '255.255.255.0', gw, mac)],
    routingTable: [],
    arpCache: [],
    macTable: [],
    natTable: [],
    firewallRules: [],
    services: {},
    openPorts: [22, 80, 443],
    cpuLoad: 5,
  };
}

describe('Simulator Labs & End-to-End Engine Integration', () => {
  it('executes all 20 preset labs (onLoadRun & onSolve) with expected network behavior', () => {
    expect(PRESET_LABS.length).toBe(20);

    for (const lab of PRESET_LABS) {
      const engine = new SimulationEngine({ seed: 42, devices: lab.devices, links: lab.links });
      expect(engine.devices.size).toBe(lab.devices.length);

      if (lab.onLoadRun) {
        const loadOut = lab.onLoadRun(engine);
        expect(typeof loadOut).toBe('string');
        expect(loadOut.length).toBeGreaterThan(0);
      }

      if (lab.onSolve) {
        const solveEngine = new SimulationEngine({ seed: 42, devices: lab.devices, links: lab.links });
        const solveOut = lab.onSolve(solveEngine);
        expect(typeof solveOut).toBe('string');
        expect(solveEngine.packets.length).toBeGreaterThan(0);

        // Lab-specific functional invariants
        if (lab.id === 'lab-7-firewall-dmz') {
          expect(solveOut).toContain('Welcome to DMZ Web Server');
          expect(solveOut).toContain('FILTERED');
        } else if (lab.id === 'lab-19-routing-loop') {
          expect(solveOut).toContain('TTL exceeded');
          expect(solveEngine.validateTopology().some((w) => w.severity === 'error')).toBe(true);
        } else if (lab.id === 'lab-20-mtu-fragmentation') {
          expect(solveOut).toContain('Fragmentation needed');
        } else if (lab.id === 'lab-18-industrial-modbus') {
          expect(solveOut).toContain('OPEN');
          expect(solveOut).toContain('FILTERED');
        }
      }
    }
  });

  it('learns real source host MAC on ingress switch port during multi-hop forwarding', () => {
    const h1 = host('h1', 'PC1', '10.0.0.10', '10.0.0.1', '11');
    const h2 = host('h2', 'PC2', '10.0.0.20', '10.0.0.1', '22');
    const sw: SimDevice = {
      id: 'sw1',
      name: 'AccessSwitch',
      role: 'switch',
      x: 0,
      y: 0,
      poweredOn: true,
      interfaces: [
        createDefaultInterface('p1', 'fa0/1', '', '', undefined, 'a1'),
        createDefaultInterface('p2', 'fa0/2', '', '', undefined, 'a2'),
      ],
      routingTable: [],
      arpCache: [],
      macTable: [],
      natTable: [],
      firewallRules: [],
      services: {},
      openPorts: [],
      cpuLoad: 2,
    };
    const links: SimLink[] = [
      { id: 'l1', sourceId: 'h1', sourceIface: 'eth0', targetId: 'sw1', targetIface: 'p1', medium: 'ethernet', bandwidthMbps: 100, delayMs: 2, jitterMs: 0, lossPercent: 0, mtu: 1500, duplex: 'full', up: true },
      { id: 'l2', sourceId: 'sw1', sourceIface: 'p2', targetId: 'h2', targetIface: 'eth0', medium: 'ethernet', bandwidthMbps: 100, delayMs: 2, jitterMs: 0, lossPercent: 0, mtu: 1500, duplex: 'full', up: true },
    ];

    const engine = new SimulationEngine({ seed: 7, devices: [h1, sw, h2], links });
    const pingOut = engine.execCommand('h1', 'ping 10.0.0.20 -c 1');
    expect(pingOut).toContain('1 received, 0% packet loss');

    const macTableOut = engine.execCommand('sw1', 'show mac address-table');
    expect(macTableOut).toContain(h1.interfaces[0].mac);
    expect(macTableOut).toContain('p1');
    expect(macTableOut).toContain(h2.interfaces[0].mac);
    expect(macTableOut).toContain('p2');
  });

  it('performs NAT/PAT across 172.16.x.x RFC 1918 subnets and inbound reverse lookup', () => {
    const lanHost = host('lan', 'CorpPC', '172.16.40.10', '172.16.40.1', 'c1');
    const natGw: SimDevice = {
      id: 'nat',
      name: 'NAT-GW',
      role: 'nat_gateway',
      x: 0,
      y: 0,
      poweredOn: true,
      natEnabled: true,
      interfaces: [
        createDefaultInterface('eth0', 'lan0', '172.16.40.1', '255.255.255.0', undefined, 'n1'),
        createDefaultInterface('eth1', 'wan0', '198.51.100.5', '255.255.255.0', undefined, 'n2'),
      ],
      routingTable: [],
      arpCache: [],
      macTable: [],
      natTable: [],
      firewallRules: [],
      services: {},
      openPorts: [],
      cpuLoad: 5,
    };
    const web = host('web', 'Web', '203.0.113.80', '203.0.113.1', 'w1');
    const links: SimLink[] = [
      { id: 'l1', sourceId: 'lan', sourceIface: 'eth0', targetId: 'nat', targetIface: 'eth0', medium: 'ethernet', bandwidthMbps: 100, delayMs: 5, jitterMs: 0, lossPercent: 0, mtu: 1500, duplex: 'full', up: true },
      { id: 'l2', sourceId: 'nat', sourceIface: 'eth1', targetId: 'web', targetIface: 'eth0', medium: 'fiber', bandwidthMbps: 1000, delayMs: 10, jitterMs: 0, lossPercent: 0, mtu: 1500, duplex: 'full', up: true },
    ];

    const engine = new SimulationEngine({ seed: 1, devices: [lanHost, natGw, web], links });
    const out = engine.execCommand('lan', 'curl http://203.0.113.80 -v');
    expect(out).toContain('200 OK');

    const natDev = engine.devices.get('nat')!;
    expect(natDev.natTable.length).toBeGreaterThan(0);
    expect(natDev.natTable[0].insideLocalIp).toBe('172.16.40.10');
    expect(natDev.natTable[0].insideGlobalIp).toBe('198.51.100.5');

    // Verify inbound packet destined to WAN IP & translated port resolves back to LAN insideLocalIp
    const translatedPort = natDev.natTable[0].insideGlobalPort;
    const inbound = engine.transmitMultiHopPacket({
      srcDeviceId: 'web',
      dstDeviceId: 'lan',
      srcIp: '203.0.113.80',
      dstIp: '198.51.100.5',
      protocol: 'TCP',
      colorCategory: 'tcp',
      info: 'Return TCP ACK',
      osiLayer: 4,
      tcp: {
        srcPort: 80,
        dstPort: translatedPort,
        seq: 1,
        ack: 1,
        dataOffset: 5,
        flags: { urg: false, ack: true, psh: false, rst: false, syn: false, fin: false },
        window: 65535,
        urgentPointer: 0,
      },
    });
    expect(inbound.delivered).toBe(true);
    const lastHopPkt = inbound.packets[inbound.packets.length - 1];
    expect(lastHopPkt.dstIp).toBe('172.16.40.10');
  });

  it('exercises full CLI commands, routing loop ping, traffic generators, and deterministic reset()', () => {
    const lab19 = PRESET_LABS.find((l) => l.id === 'lab-19-routing-loop')!;
    const eng19 = new SimulationEngine({ seed: 99, devices: lab19.devices, links: lab19.links });
    const loopPing = eng19.execCommand('h', 'ping 10.99.99.1 -t 4 -c 1');
    expect(loopPing).toContain('Time to live exceeded');
    expect(eng19.packets.some((p) => p.protocol === 'ICMP' && p.info.includes('TTL'))).toBe(true);

    const lab1 = PRESET_LABS[0];
    const eng = new SimulationEngine({ seed: 42, devices: lab1.devices, links: lab1.links });
    expect(eng.execCommand('pc', 'help')).toContain('Available commands');
    expect(eng.execCommand('pc', 'ipconfig')).toContain('192.168.1.10');
    expect(eng.execCommand('isp', 'show ip route')).toContain('Destination');
    expect(eng.execCommand('pc', 'show running-config')).toContain('hostname Home PC');
    const traceOut = eng.execCommand('pc', 'traceroute 203.0.113.10');
    expect(traceOut).toContain('Wi-Fi Router');
    expect(traceOut).toContain('ISP AS64500');
    expect(traceOut).toContain('Web Server');
    expect(eng.execCommand('pc', 'arp -a')).toContain('192.168.1.1');
    expect(eng.execCommand('pc', 'arp -d')).toContain('cleared');
    expect(eng.execCommand('web', 'netstat -an')).toContain('LISTEN');
    expect(eng.execCommand('pc', 'nmap 203.0.113.10')).toContain('80/tcp   open');
    expect(eng.execCommand('pc', 'ssh 203.0.113.10')).toContain('refused');
    expect(eng.execCommand('pc', 'tcpdump')).toContain('Nmap SYN scan');
    expect(eng.execCommand('pc', 'ping 203.0.113.10 -c 1')).toContain('1 received');
    expect(eng.execCommand('pc', 'tcpdump')).toContain('ICMP');
    expect(eng.execCommand('pc', 'unknowncmd')).toContain('command not found');

    expect(eng.runTrafficGenerator('cbr', 'pc', 'web')).toContain('CBR sent 8 packets');
    expect(eng.runTrafficGenerator('ping_flood', 'pc', 'web')).toContain('PING_FLOOD sent 15 packets');
    expect(eng.runTrafficGenerator('http_load', 'pc', 'web')).toContain('HTTP_LOAD sent 8 packets');
    const m = eng.getMetrics();
    expect(m.totalPacketsSent).toBeGreaterThan(20);

    // Deterministic reset
    const countBefore = eng.packets.length;
    eng.reset(42);
    expect(eng.packets.length).toBe(0);
    expect(eng.clockMs).toBe(0);
    eng.runTrafficGenerator('cbr', 'pc', 'web');
    expect(eng.packets.length).toBeLessThan(countBefore);
  });
});
