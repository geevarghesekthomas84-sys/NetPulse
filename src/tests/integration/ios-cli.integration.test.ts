import { describe, expect, it } from 'vitest';
import { PRESET_LABS } from '../../simulator/labs';
import { SimulationEngine } from '../../engine/simulator';

/** Lab 1: pc → Home Router (lan0 192.168.1.1 / wan0 198.51.100.2) → ISP → Web server. */
const lab = () => {
  const l = PRESET_LABS[0];
  return new SimulationEngine({ seed: 42, devices: structuredClone(l.devices), links: structuredClone(l.links) });
};

const run = (e: SimulationEngine, id: string, ...cmds: string[]) => cmds.map((c) => e.execCommand(id, c));

describe('IOS-style CLI on routers and switches', () => {
  it('walks user → privileged → config → interface modes with matching prompts', () => {
    const e = lab();
    const id = 'homerouter';
    expect(e.getCliPrompt(id)).toMatch(/>$/);
    run(e, id, 'enable');
    expect(e.getCliPrompt(id)).toMatch(/#$/);
    run(e, id, 'conf t');
    expect(e.getCliPrompt(id)).toMatch(/\(config\)#$/);
    run(e, id, 'int ' + e.getDevice(id)!.interfaces[0].name);
    expect(e.getCliPrompt(id)).toMatch(/\(config-if\)#$/);
    run(e, id, 'exit');
    expect(e.getCliPrompt(id)).toMatch(/\(config\)#$/);
    run(e, id, 'end');
    expect(e.getCliPrompt(id)).toMatch(/#$/);
    run(e, id, 'disable');
    expect(e.getCliPrompt(id)).toMatch(/>$/);
  });

  it('refuses configuration commands outside configuration mode', () => {
    const e = lab();
    expect(e.execCommand('homerouter', 'hostname X')).toContain('Invalid input');
    e.execCommand('homerouter', 'enable');
    expect(e.execCommand('homerouter', 'hostname X')).toContain('Invalid input');
  });

  it('changes an interface address and reports it in show ip interface brief', () => {
    const e = lab();
    const id = 'homerouter';
    const iface = e.getDevice(id)!.interfaces[0];
    run(e, id, 'enable', 'conf t', `interface ${iface.name}`, 'ip address 192.168.1.250 255.255.255.0');
    expect(e.consumeConfigChanges()).not.toBeNull();
    const out = e.execCommand(id, 'do show ip interface brief');
    expect(out).toContain('192.168.1.250');
    expect(out).toContain(iface.name);
  });

  it('rejects bad addresses and overlapping subnets', () => {
    const e = lab();
    const id = 'homerouter';
    const [a, b] = e.getDevice(id)!.interfaces;
    run(e, id, 'enable', 'conf t', `interface ${b.name}`);
    expect(e.execCommand(id, 'ip address 999.1.1.1 255.255.255.0')).toContain('Invalid');
    expect(e.execCommand(id, 'ip address 10.0.0.1 255.0.255.0')).toContain('Bad mask');
    expect(e.execCommand(id, `ip address ${a.ip} ${a.mask}`)).toContain('overlaps');
  });

  it('shutdown takes the interface down and drops traffic; no shutdown restores it', () => {
    const e = lab();
    const id = 'homerouter';
    const wan = e.getDevice(id)!.interfaces[1];
    expect(e.execCommand('pc', 'ping 203.0.113.10 -c 1')).toContain('1 received');
    run(e, id, 'enable', 'conf t', `interface ${wan.name}`, 'shutdown');
    expect(e.getDevice(id)!.interfaces[1].up).toBe(false);
    expect(e.execCommand(id, 'do show ip interface brief')).toContain('administratively down');
    expect(e.execCommand('pc', 'ping 203.0.113.10 -c 1')).not.toContain('1 received');
    run(e, id, 'no shutdown');
    expect(e.execCommand('pc', 'ping 203.0.113.10 -c 1')).toContain('1 received');
  });

  it('adds and removes a static route', () => {
    const e = lab();
    const id = 'isp';
    const isp = e.getDevice(id)!;
    const out = isp.interfaces[0];
    const hop = out.ip.replace(/\d+$/, '99');
    run(e, id, 'enable', 'conf t');
    expect(e.execCommand(id, `ip route 10.77.0.0 255.255.0.0 ${hop}`)).toBe('');
    expect(e.execCommand(id, 'do show ip route')).toContain('S    10.77.0.0/16');
    expect(e.execCommand(id, `no ip route 10.77.0.0 255.255.0.0 ${hop}`)).toBe('');
    expect(e.execCommand(id, 'do show ip route')).not.toContain('10.77.0.0');
    expect(e.execCommand(id, 'ip route 10.77.0.0 255.255.0.0 9.9.9.9')).toContain('not on a connected subnet');
  });

  it('supports abbreviations, ? help and tab completion', () => {
    const e = lab();
    const id = 'homerouter';
    expect(e.execCommand(id, 'sh ip int br')).toContain('IP-Address');
    expect(e.execCommand(id, 'show ?')).toContain('running-config');
    expect(e.completeCli(id, 'sh')).toBe('show ');
    e.execCommand(id, 'enable');
    expect(e.completeCli(id, 'conf')).toBe('configure ');
  });

  it('prints an IOS-style ping', () => {
    const e = lab();
    const out = e.execCommand('homerouter', 'ping 198.51.100.1');
    expect(out).toContain('Success rate is 100 percent (5/5)');
    expect(out).toContain('!!!!!');
  });

  it('show running-config reflects what was configured', () => {
    const e = lab();
    const id = 'homerouter';
    run(e, id, 'enable', 'conf t', 'hostname Edge', 'access-list deny tcp any any eq 80');
    const cfg = e.execCommand(id, 'do show running-config');
    expect(cfg).toContain('hostname Edge');
    expect(cfg).toContain('access-list deny tcp any any eq 80');
    expect(e.getCliPrompt(id)).toBe('Edge(config)#');
  });

  it('configures VLANs and access ports on a switch', () => {
    const l = PRESET_LABS.find((x) => x.devices.some((d) => d.role === 'switch'))!;
    const e = new SimulationEngine({ seed: 1, devices: structuredClone(l.devices), links: structuredClone(l.links) });
    const sw = l.devices.find((d) => d.role === 'switch')!;
    const port = sw.interfaces[0].name;
    run(e, sw.id, 'enable', 'conf t', 'vlan 30', 'name Guests', 'exit', `interface ${port}`, 'switchport mode access', 'switchport access vlan 30');
    expect(e.getDevice(sw.id)!.interfaces[0].vlan).toBe(30);
    const out = e.execCommand(sw.id, 'do show vlan brief');
    expect(out).toContain('Guests');
    expect(out).toContain(port);
  });
});

describe('host configuration commands', () => {
  it('ifconfig and default route change the host', () => {
    const e = lab();
    e.execCommand('pc', 'ifconfig eth0 192.168.1.77 netmask 255.255.255.0');
    expect(e.getDevice('pc')!.interfaces[0].ip).toBe('192.168.1.77');
    e.execCommand('pc', 'ip route add default via 192.168.1.1');
    expect(e.getDevice('pc')!.interfaces[0].gateway).toBe('192.168.1.1');
    expect(e.consumeConfigChanges()).not.toBeNull();
    expect(e.consumeConfigChanges()).toBeNull();
  });
});
