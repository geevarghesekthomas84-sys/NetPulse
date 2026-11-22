import { describe, expect, it } from 'vitest';
import { createDefaultInterface, SimulationEngine } from '../../engine/simulator';
import type { NetworkInterface, SimDevice, SimLink } from '../../engine/types';

const router = (id: string, ifaces: NetworkInterface[]): SimDevice => ({
  id,
  name: id.toUpperCase(),
  role: 'router',
  x: 0,
  y: 0,
  poweredOn: true,
  interfaces: ifaces,
  routingTable: [],
  arpCache: [],
  macTable: [],
  natTable: [],
  firewallRules: [],
  services: {},
  openPorts: [],
  cpuLoad: 1,
  routingProtocol: 'none',
});

const link = (id: string, a: string, ai: string, b: string, bi: string): SimLink => ({
  id,
  sourceId: a,
  sourceIface: ai,
  targetId: b,
  targetIface: bi,
  medium: 'ethernet',
  bandwidthMbps: 100,
  delayMs: 1,
  jitterMs: 0,
  lossPercent: 0,
  mtu: 1500,
  duplex: 'full',
  up: true,
});

/** R1 (10.0.1.0/24 LAN) — R2 — R3 (10.0.3.0/24 LAN), with /24 transit links 10.0.12.0 and 10.0.23.0. */
const chain = () => {
  const r1 = router('r1', [createDefaultInterface('e0', 'e0', '10.0.1.1', '255.255.255.0', undefined, '01'), createDefaultInterface('e1', 'e1', '10.0.12.1', '255.255.255.0', undefined, '02')]);
  const r2 = router('r2', [createDefaultInterface('e0', 'e0', '10.0.12.2', '255.255.255.0', undefined, '03'), createDefaultInterface('e1', 'e1', '10.0.23.2', '255.255.255.0', undefined, '04')]);
  const r3 = router('r3', [createDefaultInterface('e0', 'e0', '10.0.23.3', '255.255.255.0', undefined, '05'), createDefaultInterface('e1', 'e1', '10.0.3.1', '255.255.255.0', undefined, '06')]);
  const links = [link('l1', 'r1', 'e1', 'r2', 'e0'), link('l2', 'r2', 'e1', 'r3', 'e0')];
  return new SimulationEngine({ seed: 1, devices: [r1, r2, r3], links });
};

const cli = (e: SimulationEngine, id: string, ...cmds: string[]) => cmds.forEach((c) => e.execCommand(id, c));
const enable = (e: SimulationEngine, id: string, ...cmds: string[]) => cli(e, id, 'enable', 'configure terminal', ...cmds, 'end');
const routes = (e: SimulationEngine, id: string) => e.execCommand(id, 'show ip route');

describe('routing protocols follow network statements', () => {
  it('OSPF with network statements on every router teaches R1 the far LAN', () => {
    const e = chain();
    expect(routes(e, 'r1')).not.toContain('10.0.3.0/24');
    for (const id of ['r1', 'r2', 'r3']) enable(e, id, 'router ospf 1', 'network 10.0.0.0 0.255.255.255 area 0');
    const out = routes(e, 'r1');
    expect(out).toContain('O    10.0.3.0/24');
    expect(out).toContain('O    10.0.23.0/24');
    expect(routes(e, 'r3')).toContain('O    10.0.1.0/24');
  });

  it('a network statement that does not cover an interface keeps that network out of the protocol', () => {
    const e = chain();
    for (const id of ['r1', 'r2']) enable(e, id, 'router ospf 1', 'network 10.0.0.0 0.255.255.255 area 0');
    // R3 only enables its transit link, not its LAN
    enable(e, 'r3', 'router ospf 1', 'network 10.0.23.0 0.0.0.255 area 0');
    const out = routes(e, 'r1');
    expect(out).toContain('10.0.23.0/24'); // transit is advertised
    expect(out).not.toContain('10.0.3.0/24'); // the LAN is not
  });

  it('no network statements means nothing is advertised (strict mode starts empty)', () => {
    const e = chain();
    for (const id of ['r1', 'r2', 'r3']) enable(e, id, 'router ospf 1');
    expect(routes(e, 'r1')).not.toContain('O    ');
    expect(e.execCommand('r1', 'show ip protocols')).toContain('none yet');
  });

  it('removing a network statement withdraws its routes', () => {
    const e = chain();
    for (const id of ['r1', 'r2', 'r3']) enable(e, id, 'router ospf 1', 'network 10.0.0.0 0.255.255.255 area 0');
    expect(routes(e, 'r1')).toContain('10.0.3.0/24');
    enable(e, 'r3', 'router ospf 1', 'no network 10.0.0.0 0.255.255.255 area 0');
    expect(routes(e, 'r1')).not.toContain('10.0.3.0/24');
  });

  it('RIP uses classful network statements and shows them in show ip protocols', () => {
    const e = chain();
    for (const id of ['r1', 'r2', 'r3']) enable(e, id, 'router rip', 'network 10.0.0.0');
    expect(routes(e, 'r1')).toContain('R    10.0.3.0/24');
    expect(e.execCommand('r2', 'show ip protocols')).toContain('10.0.0.0/8');
  });

  it('routers running different protocols do not exchange routes', () => {
    const e = chain();
    enable(e, 'r1', 'router ospf 1', 'network 10.0.0.0 0.255.255.255 area 0');
    enable(e, 'r2', 'router rip', 'network 10.0.0.0');
    enable(e, 'r3', 'router rip', 'network 10.0.0.0');
    const out = routes(e, 'r1');
    expect(out).not.toContain('10.0.3.0/24');
    expect(routes(e, 'r3')).not.toContain('10.0.1.0/24');
  });

  it('the running config lists the network statements', () => {
    const e = chain();
    enable(e, 'r1', 'router ospf 1', 'network 10.0.0.0 0.255.255.255 area 0');
    const cfg = e.execCommand('r1', 'show running-config');
    expect(cfg).toContain('router ospf');
    expect(cfg).toContain(' network 10.0.0.0/8');
  });

  it('config survives being stored and reloaded (what the app does after each CLI change)', () => {
    const e = chain();
    for (const id of ['r1', 'r2', 'r3']) enable(e, id, 'router ospf 1', 'network 10.0.0.0 0.255.255.255 area 0');
    const saved = e.consumeConfigChanges()!;
    const reloaded = new SimulationEngine({ seed: 1, devices: saved.devices, links: saved.links });
    expect(reloaded.execCommand('r1', 'show ip route')).toContain('10.0.3.0/24');
  });
});
