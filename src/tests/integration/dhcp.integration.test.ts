import { describe, expect, it } from 'vitest';
import { PRESET_LABS } from '../../simulator/labs';
import { SimulationEngine } from '../../engine/simulator';

const lab = (id: string) => {
  const l = PRESET_LABS.find((x) => x.id === id)!;
  return new SimulationEngine({ seed: 42, devices: structuredClone(l.devices), links: structuredClone(l.links) });
};

describe('DHCP', () => {
  it('a client on the home LAN leases the first free address and then can reach the internet', () => {
    const e = lab('lab-1-home');
    e.getDevice('pc')!.interfaces[0].ip = '';
    const r = e.requestDhcp('pc');
    expect(r.ok).toBe(true);
    expect(r.ip).toBe('192.168.1.100');
    const pc = e.getDevice('pc')!;
    expect(pc.interfaces[0].gateway).toBe('192.168.1.1');
    expect(pc.dnsServer).toBe('8.8.8.8');
    expect(e.execCommand('pc', 'ping 203.0.113.10 -c 1')).toContain('1 received');
  });

  it('emits Discover, Offer, Request and Ack as DHCP packets', () => {
    const e = lab('lab-1-home');
    e.requestDhcp('pc');
    const infos = e.packets.filter((p) => p.protocol === 'DHCP').map((p) => p.info.split(' ')[0]);
    expect(infos).toEqual(['DHCPDISCOVER', 'DHCPOFFER', 'DHCPREQUEST', 'DHCPACK']);
  });

  it('keeps a lease stable for the same client and gives a different address to the next one', () => {
    const e = lab('lab-1-home');
    const first = e.requestDhcp('pc').ip;
    expect(e.requestDhcp('pc').ip).toBe(first);
    const web = e.getDevice('web')!;
    web.services.dhcp = undefined;
    // another client on the same LAN gets the next address
    const other = structuredClone(e.getDevice('pc')!);
    other.id = 'pc2';
    other.name = 'PC 2';
    other.interfaces[0].mac = '02:42:ac:11:00:99';
    other.interfaces[0].ip = '';
    e.loadTopology([...Array.from(e.devices.values()), other], Array.from(e.links.values()).concat({ ...Array.from(e.links.values())[0], id: 'lx', sourceId: 'pc2' }));
    expect(e.requestDhcp('pc2').ip).toBe('192.168.1.101');
  });

  it('works across a router with ip helper-address (relay)', () => {
    const e = lab('lab-5-dhcp-relay');
    const r = e.requestDhcp('c');
    expect(r.ok).toBe(true);
    expect(r.ip).toBe('192.168.1.50');
    expect(r.message).toContain('relay');
  });

  it('falls back to a 169.254 link-local address when no server answers', () => {
    const e = lab('lab-1-home');
    e.getDevice('homerouter')!.services.dhcp = undefined;
    const r = e.requestDhcp('pc');
    expect(r.ok).toBe(false);
    expect(r.ip).toMatch(/^169\.254\./);
    expect(e.getDevice('pc')!.interfaces[0].mask).toBe('255.255.0.0');
  });

  it('release clears the address; ipconfig /renew and dhclient run DHCP from the host CLI', () => {
    const e = lab('lab-1-home');
    expect(e.execCommand('pc', 'ipconfig /release')).toContain('released');
    expect(e.getDevice('pc')!.interfaces[0].ip).toBe('');
    expect(e.execCommand('pc', 'ipconfig /renew')).toContain('lease acquired');
    expect(e.getDevice('pc')!.interfaces[0].ip).toBe('192.168.1.100');
    expect(e.execCommand('pc', 'dhclient')).toContain('lease acquired');
  });

  it('router shows its bindings and accepts ip helper-address', () => {
    const e = lab('lab-1-home');
    e.requestDhcp('pc');
    expect(e.execCommand('homerouter', 'show ip dhcp binding')).toContain('192.168.1.100');
    const lanName = e.getDevice('homerouter')!.interfaces[0].name;
    ['enable', 'configure terminal', `interface ${lanName}`, 'ip helper-address 10.9.9.9'].forEach((c) => e.execCommand('homerouter', c));
    expect(e.getDevice('homerouter')!.interfaces[0].helper).toBe('10.9.9.9');
    expect(e.execCommand('homerouter', 'do show running-config')).toContain('ip helper-address 10.9.9.9');
  });
});
