import { describe, expect, it } from 'vitest';
import { createDefaultInterface, SimulationEngine } from '../../engine/simulator';
import type { SimDevice, SimLink } from '../../engine/types';

describe('Cisco Packet Tracer Pro Logic & CLI', () => {
  it('manages Cisco IOS state machine transitions and prompt updates', () => {
    const router: SimDevice = {
      id: 'r1',
      name: 'Router1',
      role: 'router',
      x: 100,
      y: 100,
      poweredOn: true,
      interfaces: [createDefaultInterface('Gig0/0', 'Gig0/0', '0.0.0.0', '0.0.0.0', undefined, '01')],
      routingTable: [],
      arpCache: [],
      macTable: [],
      natTable: [],
      firewallRules: [],
      services: {},
      openPorts: [],
      cpuLoad: 2,
    };

    const engine = new SimulationEngine({ devices: [router], links: [] });

    // Initial user EXEC mode
    expect(engine.getCiscoPrompt('r1')).toBe('Router1>');

    // enable -> Privileged EXEC mode
    engine.execCommand('r1', 'enable');
    expect(engine.getCiscoPrompt('r1')).toBe('Router1#');

    // conf t -> Global Configuration mode
    engine.execCommand('r1', 'configure terminal');
    expect(engine.getCiscoPrompt('r1')).toBe('Router1(config)#');

    // hostname -> changes device name and prompt
    engine.execCommand('r1', 'hostname CoreRouter');
    expect(engine.getCiscoPrompt('r1')).toBe('CoreRouter(config)#');
    expect(engine.devices.get('r1')?.name).toBe('CoreRouter');

    // int Gig0/0 -> Interface Configuration mode
    engine.execCommand('r1', 'interface Gig0/0');
    expect(engine.getCiscoPrompt('r1')).toBe('CoreRouter(config-if)#');

    const dev = engine.devices.get('r1')!;

    // ip address
    engine.execCommand('r1', 'ip address 10.0.0.1 255.255.255.0');
    expect(dev.interfaces[0].ip).toBe('10.0.0.1');
    expect(dev.interfaces[0].mask).toBe('255.255.255.0');

    // no shutdown
    const upMsg = engine.execCommand('r1', 'no shutdown');
    expect(upMsg).toContain('%LINK-5-CHANGED: Interface Gig0/0, changed state to up');

    // exit back to config
    engine.execCommand('r1', 'exit');
    expect(engine.getCiscoPrompt('r1')).toBe('CoreRouter(config)#');

    // ip route 192.168.1.0 255.255.255.0 10.0.0.2
    engine.execCommand('r1', 'ip route 192.168.1.0 255.255.255.0 10.0.0.2');
    const staticRt = dev.routingTable.find((r) => r.network === '192.168.1.0');
    expect(staticRt).toBeDefined();
    expect(staticRt?.nextHop).toBe('10.0.0.2');

    // exit to priv exec
    engine.execCommand('r1', 'exit');
    expect(engine.getCiscoPrompt('r1')).toBe('CoreRouter#');

    // show ip int brief
    const intBrief = engine.execCommand('r1', 'show ip interface brief');
    expect(intBrief).toContain('Gig0/0');
    expect(intBrief).toContain('10.0.0.1');

    // show ip route
    const showRoute = engine.execCommand('r1', 'show ip route');
    expect(showRoute).toContain('192.168.1.0');
    expect(showRoute).toContain('10.0.0.2');
    expect(showRoute).toContain('STATIC');
  });

  it('performs full DHCP DORA broadcast lease exchange', () => {
    const dhcpServer: SimDevice = {
      id: 'dhcp1',
      name: 'DHCP-Server',
      role: 'dhcp_server',
      x: 100,
      y: 100,
      poweredOn: true,
      interfaces: [createDefaultInterface('eth0', 'eth0', '192.168.1.1', '255.255.255.0', undefined, '10')],
      routingTable: [],
      arpCache: [],
      macTable: [],
      natTable: [],
      firewallRules: [],
      services: {
        dhcp: {
          enabled: true,
          poolStart: '192.168.1.50',
          poolEnd: '192.168.1.100',
          mask: '255.255.255.0',
          gateway: '192.168.1.1',
          dns: '8.8.8.8',
        },
      },
      openPorts: [67],
      cpuLoad: 3,
    };

    const pc: SimDevice = {
      id: 'pc1',
      name: 'PC0',
      role: 'host',
      x: 300,
      y: 100,
      poweredOn: true,
      interfaces: [createDefaultInterface('FastEthernet0', 'FastEthernet0', '0.0.0.0', '0.0.0.0', undefined, '20')],
      routingTable: [],
      arpCache: [],
      macTable: [],
      natTable: [],
      firewallRules: [],
      services: {},
      openPorts: [],
      cpuLoad: 1,
    };

    const link: SimLink = {
      id: 'l1',
      sourceId: 'dhcp1',
      targetId: 'pc1',
      sourceIface: 'eth0',
      targetIface: 'FastEthernet0',
      medium: 'ethernet',
      bandwidthMbps: 100,
      delayMs: 1,
      jitterMs: 0,
      lossPercent: 0,
      mtu: 1500,
      duplex: 'full',
      up: true,
    };

    const engine = new SimulationEngine({ devices: [dhcpServer, pc], links: [link] });

    const leaseRes = engine.requestDhcp('pc1');
    const devInEngine = engine.devices.get('pc1');
    expect(leaseRes.success).toBe(true);
    expect(leaseRes.ip).toBe('192.168.1.50');
    expect(devInEngine?.interfaces[0].ip).toBe('192.168.1.50');
    expect(devInEngine?.interfaces[0].gateway).toBe('192.168.1.1');

    // Verify all 4 DORA packets were emitted in order
    const protocols = engine.packets.map((p) => p.protocol);
    expect(protocols).toEqual(['DHCP', 'DHCP', 'DHCP', 'DHCP']);
    expect(engine.packets[0].info).toContain('DHCP Discover');
    expect(engine.packets[1].info).toContain('DHCP Offer');
    expect(engine.packets[2].info).toContain('DHCP Request');
    expect(engine.packets[3].info).toContain('DHCP ACK');
  });

  it('creates and fires Simple PDU ping exchanges with tracking in simplePdus', () => {
    const pc1: SimDevice = {
      id: 'pc1',
      name: 'PC1',
      role: 'host',
      x: 100,
      y: 100,
      poweredOn: true,
      interfaces: [createDefaultInterface('eth0', 'eth0', '192.168.1.10', '255.255.255.0', undefined, '01')],
      routingTable: [],
      arpCache: [],
      macTable: [],
      natTable: [],
      firewallRules: [],
      services: {},
      openPorts: [],
      cpuLoad: 1,
    };

    const pc2: SimDevice = {
      id: 'pc2',
      name: 'PC2',
      role: 'host',
      x: 300,
      y: 100,
      poweredOn: true,
      interfaces: [createDefaultInterface('eth0', 'eth0', '192.168.1.20', '255.255.255.0', undefined, '02')],
      routingTable: [],
      arpCache: [],
      macTable: [],
      natTable: [],
      firewallRules: [],
      services: {},
      openPorts: [],
      cpuLoad: 1,
    };

    const link: SimLink = {
      id: 'l1',
      sourceId: 'pc1',
      targetId: 'pc2',
      sourceIface: 'eth0',
      targetIface: 'eth0',
      medium: 'ethernet',
      bandwidthMbps: 100,
      delayMs: 1,
      jitterMs: 0,
      lossPercent: 0,
      mtu: 1500,
      duplex: 'full',
      up: true,
    };

    const engine = new SimulationEngine({ devices: [pc1, pc2], links: [link] });
    const pduRes = engine.sendSimplePdu('pc1', 'pc2');

    expect(pduRes.success).toBe(true);
    expect(engine.simplePdus.length).toBe(1);
    expect(engine.simplePdus[0].status).toBe('successful');
    expect(engine.simplePdus[0].srcId).toBe('pc1');
    expect(engine.simplePdus[0].dstId).toBe('pc2');
  });
});
