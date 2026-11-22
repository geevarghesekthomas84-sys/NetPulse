/**
 * Cisco-IOS-style command line for routers, switches and firewalls.
 *
 * Mirrors how Packet Tracer works: user EXEC (>) → privileged EXEC (#) → global configuration
 * → interface / VLAN / routing sub-modes, with prefix abbreviations (`conf t`, `int g0/0`,
 * `sh ip int br`), `?` help, `no` forms, and configuration that really changes the simulation.
 */
import { intToIp, ipToInt, isValidIpv4, maskToPrefix, sameSubnet } from '../lib/ipUtils';
import type { FirewallRule, NetworkInterface, RouteEntry, SimDevice, SimLink } from './types';

export type IosMode = 'user' | 'priv' | 'config' | 'config-if' | 'config-vlan' | 'config-router';

export interface IosSession {
  mode: IosMode;
  iface?: string; // interface id while in config-if
  vlan?: number; // vlan id while in config-vlan
  saved?: boolean; // `write memory` has been run
}

/** What the CLI needs from the simulation engine. */
export interface IosHost {
  links(): SimLink[];
  devices(): SimDevice[];
  /** Mark that the running configuration changed so the UI can persist it. */
  markDirty(): void;
  /** DHCP leases this device has handed out. */
  dhcpLeases(): { ip: string; mac: string; expiresAtMs: number }[];
  /** Falls back to the generic host commands (ping, traceroute, curl, ...). */
  runGeneric(cmd: string): string;
}

const GEAR: SimDevice['role'][] = ['router', 'switch', 'firewall', 'nat_gateway', 'vpn_gateway'];
export const isIosDevice = (d: Pick<SimDevice, 'role'>): boolean => GEAR.includes(d.role);

const PROMPT_SUFFIX: Record<IosMode, string> = {
  user: '>',
  priv: '#',
  config: '(config)#',
  'config-if': '(config-if)#',
  'config-vlan': '(config-vlan)#',
  'config-router': '(config-router)#',
};

const hostnameOf = (d: SimDevice) => d.name.replace(/\s+/g, '-');

export function iosPrompt(dev: SimDevice, s: IosSession): string {
  return `${hostnameOf(dev)}${PROMPT_SUFFIX[s.mode]}`;
}

interface Ctx {
  host: IosHost;
  dev: SimDevice;
  s: IosSession;
  /** Values of `<param>` tokens, in order. */
  a: string[];
  /** True when the command was typed with `no` in front. */
  negate: boolean;
}

interface Cmd {
  /** e.g. "show ip interface brief", "ip address <ip> <mask>", "description <text...>" */
  p: string;
  modes: IosMode[];
  help: string;
  run: (c: Ctx) => string;
}

const EXEC: IosMode[] = ['user', 'priv'];
const PRIV: IosMode[] = ['priv'];
const CFG: IosMode[] = ['config'];
const IF: IosMode[] = ['config-if'];
const BAD = "% Invalid input detected at '^' marker.";
const INCOMPLETE = '% Incomplete command.';

/* ───────────── helpers ───────────── */

const cidr = (mask: string) => maskToPrefix(mask);
const validMask = (m: string) => {
  if (!isValidIpv4(m)) return false;
  const n = ipToInt(m) >>> 0;
  const inv = ~n >>> 0;
  return (inv & (inv + 1)) === 0; // contiguous ones
};

function findIface(dev: SimDevice, token: string): NetworkInterface | undefined {
  const t = token.toLowerCase();
  const exact = dev.interfaces.find((i) => i.name.toLowerCase() === t || i.id.toLowerCase() === t);
  if (exact) return exact;
  // Cisco-style names (g0/0, fa0/1, gi1/0/2): use the last number as the port index.
  const m = t.match(/^[a-z-]+[\d/.]*?(\d+)$/);
  if (m) return dev.interfaces[Number(m[1])];
  return undefined;
}

const ifaceLabel = (dev: SimDevice, id: string) => dev.interfaces.find((i) => i.id === id)?.name ?? id;

function linkOf(host: IosHost, dev: SimDevice, iface: NetworkInterface): SimLink | undefined {
  return host.links().find((l) => (l.sourceId === dev.id && l.sourceIface === iface.id) || (l.targetId === dev.id && l.targetIface === iface.id));
}

function lineState(host: IosHost, dev: SimDevice, iface: NetworkInterface): { status: string; protocol: string } {
  if (!iface.up) return { status: 'administratively down', protocol: 'down' };
  const l = linkOf(host, dev, iface);
  if (!l || !l.up) return { status: 'down', protocol: 'down' };
  return { status: 'up', protocol: 'up' };
}

function routeCode(p: RouteEntry['protocol']): string {
  return { connected: 'C', static: 'S', rip: 'R', ospf: 'O', bgp: 'B' }[p];
}

function runningConfig(dev: SimDevice): string {
  const out: string[] = ['Building configuration...', '', 'Current configuration:', '!', `hostname ${hostnameOf(dev)}`, '!'];
  const vlans = new Set<number>();
  for (const i of dev.interfaces) if ((i.vlan ?? 1) !== 1) vlans.add(i.vlan!);
  for (const v of Object.keys(dev.vlanNames ?? {})) vlans.add(Number(v));
  for (const v of [...vlans].sort((a, b) => a - b)) {
    out.push(`vlan ${v}`);
    if (dev.vlanNames?.[v]) out.push(` name ${dev.vlanNames[v]}`);
    out.push('!');
  }
  for (const i of dev.interfaces) {
    out.push(`interface ${i.name}`);
    if (i.description) out.push(` description ${i.description}`);
    if (i.helper) out.push(` ip helper-address ${i.helper}`);
    if (dev.role === 'switch') {
      if (i.isTrunk) {
        out.push(' switchport mode trunk');
        if (i.trunkVlans) out.push(` switchport trunk allowed vlan ${i.trunkVlans.join(',')}`);
      } else {
        out.push(' switchport mode access');
        if ((i.vlan ?? 1) !== 1) out.push(` switchport access vlan ${i.vlan}`);
      }
    } else if (i.ip) {
      out.push(` ip address ${i.ip} ${i.mask}`);
    } else {
      out.push(' no ip address');
    }
    if (dev.natEnabled && dev.role !== 'switch') out.push(i.nat === 'outside' ? ' ip nat outside' : i.nat === 'inside' ? ' ip nat inside' : '');
    if (!i.up) out.push(' shutdown');
    out.push('!');
  }
  if (dev.routingProtocol && dev.routingProtocol !== 'none') {
    out.push(`router ${dev.routingProtocol}${dev.routingProtocol === 'bgp' && dev.asn ? ` ${dev.asn}` : ''}`);
    for (const n of dev.routingNetworks ?? []) out.push(` network ${n}`);
    out.push('!');
  }
  for (const r of dev.routingTable.filter((x) => x.protocol === 'static')) {
    out.push(`ip route ${r.network} ${r.mask} ${r.nextHop && r.nextHop !== '0.0.0.0' ? r.nextHop : ifaceLabel(dev, r.iface)}`);
  }
  if (dev.firewallRules.length) {
    for (const r of dev.firewallRules) {
      out.push(`access-list ${r.action === 'allow' ? 'permit' : 'deny'} ${r.protocol.toLowerCase()} ${r.srcIp} ${r.dstIp}${r.dstPort !== 'any' ? ` eq ${r.dstPort}` : ''}`);
    }
    out.push('!');
  }
  if (dev.natEnabled) out.push('ip nat inside source list 1 interface overload', '!');
  const gw = dev.interfaces.find((i) => i.gateway)?.gateway;
  if (gw && dev.role === 'switch') out.push(`ip default-gateway ${gw}`);
  out.push('end');
  return out.filter((l) => l !== '').join('\n').replace(/\n!\n!/g, '\n!');
}

/* ───────────── command table ───────────── */

const COMMANDS: Cmd[] = [
  /* mode navigation */
  {
    p: 'enable',
    modes: ['user'],
    help: 'Turn on privileged commands',
    run: ({ s }) => {
      s.mode = 'priv';
      return '';
    },
  },
  {
    p: 'disable',
    modes: PRIV,
    help: 'Turn off privileged commands',
    run: ({ s }) => {
      s.mode = 'user';
      return '';
    },
  },
  {
    p: 'configure terminal',
    modes: PRIV,
    help: 'Enter configuration mode',
    run: ({ s }) => {
      s.mode = 'config';
      return 'Enter configuration commands, one per line.  End with CNTL/Z.';
    },
  },
  {
    p: 'exit',
    modes: ['user', 'priv', 'config', 'config-if', 'config-vlan', 'config-router'],
    help: 'Exit from the current mode',
    run: ({ s }) => {
      if (s.mode === 'config-if' || s.mode === 'config-vlan' || s.mode === 'config-router') s.mode = 'config';
      else if (s.mode === 'config') s.mode = 'priv';
      else if (s.mode === 'priv') s.mode = 'user';
      return '';
    },
  },
  {
    p: 'end',
    modes: ['config', 'config-if', 'config-vlan', 'config-router'],
    help: 'Return to privileged EXEC',
    run: ({ s }) => {
      s.mode = 'priv';
      return '';
    },
  },

  /* show commands (usable from EXEC modes) */
  {
    p: 'show ip interface brief',
    modes: EXEC,
    help: 'Interface status and IP summary',
    run: ({ host, dev }) => {
      const rows = dev.interfaces.map((i) => {
        const st = lineState(host, dev, i);
        return `${i.name.padEnd(22)} ${(i.ip || 'unassigned').padEnd(15)} YES ${i.ip ? 'manual' : 'unset '} ${st.status.padEnd(22)} ${st.protocol}`;
      });
      return ['Interface              IP-Address      OK? Method Status                Protocol', ...rows].join('\n');
    },
  },
  {
    p: 'show interfaces',
    modes: EXEC,
    help: 'Interface details',
    run: ({ host, dev }) =>
      dev.interfaces
        .map((i) => {
          const st = lineState(host, dev, i);
          const l = linkOf(host, dev, i);
          return [
            `${i.name} is ${st.status}, line protocol is ${st.protocol}`,
            `  Hardware address is ${i.mac}`,
            i.description ? `  Description: ${i.description}` : '',
            i.ip ? `  Internet address is ${i.ip}/${cidr(i.mask)}` : '  No Internet address',
            `  MTU ${l?.mtu ?? 1500} bytes, BW ${(l?.bandwidthMbps ?? 100) * 1000} Kbit/sec, DLY ${Math.round((l?.delayMs ?? 1) * 1000)} usec`,
            `  ${l?.duplex === 'half' ? 'Half' : 'Full'}-duplex, VLAN ${i.vlan ?? 1}${i.isTrunk ? ' (trunk)' : ''}`,
          ]
            .filter(Boolean)
            .join('\n');
        })
        .join('\n'),
  },
  {
    p: 'show ip route',
    modes: EXEC,
    help: 'IP routing table',
    run: ({ dev }) => {
      const sorted = [...dev.routingTable].sort((a, b) => ipToInt(a.network) - ipToInt(b.network));
      const def = sorted.find((r) => r.network === '0.0.0.0');
      const lines = [
        'Codes: C - connected, S - static, R - RIP, O - OSPF, B - BGP',
        '',
        def ? `Gateway of last resort is ${def.nextHop} to network 0.0.0.0` : 'Gateway of last resort is not set',
        '',
      ];
      for (const r of sorted) {
        const p = cidr(r.mask);
        lines.push(
          r.protocol === 'connected'
            ? `C    ${r.network}/${p} is directly connected, ${ifaceLabel(dev, r.iface)}`
            : `${routeCode(r.protocol)}    ${r.network}/${p} [${r.protocol === 'static' ? 1 : r.protocol === 'ospf' ? 110 : r.protocol === 'rip' ? 120 : 20}/${r.metric}] via ${r.nextHop}, ${ifaceLabel(dev, r.iface)}`
        );
      }
      if (sorted.length === 0) lines.push('(no routes — configure an interface IP address, or add one with "ip route")');
      return lines.join('\n');
    },
  },
  {
    p: 'show vlan brief',
    modes: EXEC,
    help: 'VLAN membership summary',
    run: ({ dev }) => {
      const ids = new Set<number>([1]);
      for (const i of dev.interfaces) ids.add(i.vlan ?? 1);
      for (const v of Object.keys(dev.vlanNames ?? {})) ids.add(Number(v));
      const lines = ['VLAN Name                             Status    Ports', '---- -------------------------------- --------- -------------------------------'];
      for (const id of [...ids].sort((a, b) => a - b)) {
        const ports = dev.interfaces.filter((i) => !i.isTrunk && (i.vlan ?? 1) === id).map((i) => i.name);
        const name = dev.vlanNames?.[id] ?? (id === 1 ? 'default' : `VLAN${String(id).padStart(4, '0')}`);
        lines.push(`${String(id).padEnd(4)} ${name.padEnd(32)} active    ${ports.join(', ')}`);
      }
      return lines.join('\n');
    },
  },
  {
    p: 'show running-config',
    modes: EXEC,
    help: 'Current configuration',
    run: ({ dev }) => runningConfig(dev),
  },
  {
    p: 'show startup-config',
    modes: EXEC,
    help: 'Saved configuration',
    run: ({ dev, s }) => (s.saved ? runningConfig(dev) : 'startup-config is not present'),
  },
  {
    p: 'show cdp neighbors',
    modes: EXEC,
    help: 'Directly connected devices',
    run: ({ host, dev }) => {
      const rows: string[] = [];
      for (const l of host.links()) {
        const mine = l.sourceId === dev.id ? { iface: l.sourceIface, peer: l.targetId, peerIface: l.targetIface } : l.targetId === dev.id ? { iface: l.targetIface, peer: l.sourceId, peerIface: l.sourceIface } : null;
        if (!mine) continue;
        const peer = host.devices().find((d) => d.id === mine.peer);
        if (!peer) continue;
        rows.push(`${hostnameOf(peer).padEnd(16)} ${ifaceLabel(dev, mine.iface).padEnd(14)} 150      ${peer.role.padEnd(12)} ${ifaceLabel(peer, mine.peerIface)}`);
      }
      return ['Device ID        Local Intrfce  Holdtme  Capability   Port ID', ...(rows.length ? rows : ['(no neighbours — connect a cable)'])].join('\n');
    },
  },
  {
    p: 'show arp',
    modes: EXEC,
    help: 'ARP cache',
    run: ({ dev }) =>
      ['Protocol  Address          Age (min)  Hardware Addr    Type   Interface', ...(dev.arpCache.length ? dev.arpCache.map((a) => `Internet  ${a.ip.padEnd(16)} -          ${a.mac}  ARPA   ${dev.interfaces[0]?.name ?? ''}`) : ['(empty)'])].join('\n'),
  },
  {
    p: 'show ip nat translations',
    modes: EXEC,
    help: 'NAT translation table',
    run: ({ dev }) =>
      ['Pro Inside global         Inside local          Outside local         Outside global', ...(dev.natTable.length ? dev.natTable.map((n) => `${n.proto.toLowerCase().padEnd(3)} ${`${n.insideGlobalIp}:${n.insideGlobalPort}`.padEnd(21)} ${`${n.insideLocalIp}:${n.insideLocalPort}`.padEnd(21)} ${`${n.outsideIp}:${n.outsidePort}`.padEnd(21)} ${n.outsideIp}:${n.outsidePort}`) : ['(no translations yet)'])].join('\n'),
  },
  {
    p: 'show access-lists',
    modes: EXEC,
    help: 'Access control lists',
    run: ({ dev }) =>
      dev.firewallRules.length
        ? ['Extended IP access list 100', ...dev.firewallRules.map((r, i) => `    ${(i + 1) * 10} ${r.action === 'allow' ? 'permit' : 'deny'} ${r.protocol.toLowerCase()} ${r.srcIp} ${r.dstIp}${r.dstPort !== 'any' ? ` eq ${r.dstPort}` : ''}${r.hits ? ` (${r.hits} matches)` : ''}`)].join('\n')
        : 'No access lists configured.',
  },
  {
    p: 'show ip dhcp binding',
    modes: EXEC,
    help: 'DHCP leases handed out by this device',
    run: ({ host }) => {
      const rows = host.dhcpLeases();
      return ['IP address       Hardware address    Lease expiration', ...(rows.length ? rows.map((l) => `${l.ip.padEnd(16)} ${l.mac.padEnd(19)} ${Math.round(l.expiresAtMs / 1000)}s`) : ['(no bindings)'])].join('\n');
    },
  },
  {
    p: 'show ip protocols',
    modes: EXEC,
    help: 'Routing protocol status',
    run: ({ dev }) => {
      if (!dev.routingProtocol || dev.routingProtocol === 'none') return 'No routing protocol is running.';
      const nets = dev.routingNetworks;
      return [
        `Routing Protocol is "${dev.routingProtocol}${dev.routingProtocol === 'bgp' && dev.asn ? ' ' + dev.asn : ''}"`,
        'Routing for Networks:',
        ...(nets === undefined ? ['  (all connected networks)'] : nets.length ? nets.map((n) => `  ${n}`) : ['  (none yet: add "network" statements)']),
        `Routing table entries: ${dev.routingTable.length}`,
      ].join('\n');
    },
  },
  {
    p: 'show version',
    modes: EXEC,
    help: 'System information',
    run: ({ dev }) => `NetPulse simulated IOS (${dev.role})\n${hostnameOf(dev)} uptime is 0 minutes\n${dev.interfaces.length} interface(s), ${dev.routingTable.length} route(s)`,
  },
  {
    p: 'write memory',
    modes: PRIV,
    help: 'Save the running configuration',
    run: ({ s }) => {
      s.saved = true;
      return 'Building configuration...\n[OK]';
    },
  },
  {
    p: 'copy running-config startup-config',
    modes: PRIV,
    help: 'Save the running configuration',
    run: ({ s }) => {
      s.saved = true;
      return 'Destination filename [startup-config]?\nBuilding configuration...\n[OK]';
    },
  },

  /* global configuration */
  {
    p: 'hostname <name>',
    modes: CFG,
    help: 'Set the device name',
    run: ({ host, dev, a }) => {
      dev.name = a[0];
      host.markDirty();
      return '';
    },
  },
  {
    p: 'interface <name>',
    modes: [...CFG, 'config-if'],
    help: 'Select an interface to configure',
    run: ({ dev, s, a }) => {
      const i = findIface(dev, a[0]);
      if (!i) return `% Invalid interface type and number: ${a[0]}. Available: ${dev.interfaces.map((x) => x.name).join(', ')}`;
      s.mode = 'config-if';
      s.iface = i.id;
      return '';
    },
  },
  {
    p: 'ip route <network> <mask> <next-hop>',
    modes: CFG,
    help: 'Add a static route',
    run: ({ host, dev, a, negate }) => {
      const [net, mask, hop] = a;
      if (!isValidIpv4(net) || !validMask(mask)) return BAD;
      const via = isValidIpv4(hop) ? hop : '';
      const out = via ? dev.interfaces.find((i) => i.ip && sameSubnet(i.ip, via, i.mask)) : findIface(dev, hop);
      if (negate) {
        const before = dev.routingTable.length;
        dev.routingTable = dev.routingTable.filter((r) => !(r.protocol === 'static' && r.network === net && r.mask === mask));
        if (dev.routingTable.length === before) return '% No matching route to delete';
        host.markDirty();
        return '';
      }
      if (!out) return via ? `% Next hop ${via} is not on a connected subnet` : `% Invalid interface: ${hop}`;
      dev.routingTable = dev.routingTable.filter((r) => !(r.protocol === 'static' && r.network === net && r.mask === mask));
      dev.routingTable.push({ network: net, mask, nextHop: via || '0.0.0.0', iface: out.id, metric: 0, protocol: 'static' });
      host.markDirty();
      return '';
    },
  },
  {
    p: 'ip default-gateway <ip>',
    modes: CFG,
    help: 'Set the default gateway (switches)',
    run: ({ host, dev, a, negate }) => {
      if (!negate && !isValidIpv4(a[0])) return BAD;
      for (const i of dev.interfaces) i.gateway = negate ? undefined : a[0];
      host.markDirty();
      return '';
    },
  },
  {
    p: 'ip routing',
    modes: CFG,
    help: 'Enable IP routing',
    run: () => '',
  },
  {
    p: 'ip nat inside source <rest...>',
    modes: CFG,
    help: 'Enable NAT overload for inside hosts',
    run: ({ host, dev, negate }) => {
      dev.natEnabled = !negate;
      host.markDirty();
      return '';
    },
  },
  {
    p: 'router <protocol> <as...>',
    modes: CFG,
    help: 'Enable a routing protocol (rip, ospf, bgp)',
    run: ({ host, dev, s, a, negate }) => {
      const proto = a[0].toLowerCase();
      if (!['rip', 'ospf', 'bgp'].includes(proto)) return BAD;
      if (negate) {
        dev.routingProtocol = 'none';
        dev.routingNetworks = undefined;
      } else {
        dev.routingProtocol = proto as 'rip' | 'ospf' | 'bgp';
        // From here on only networks named by `network` statements take part, as on a real router.
        dev.routingNetworks = dev.routingNetworks ?? [];
        if (proto === 'bgp' && a[1] && /^\d+$/.test(a[1])) dev.asn = Number(a[1]);
        s.mode = 'config-router';
      }
      host.markDirty();
      return '';
    },
  },
  {
    p: 'vlan <id>',
    modes: CFG,
    help: 'Create or edit a VLAN',
    run: ({ host, dev, s, a, negate }) => {
      const id = Number(a[0]);
      if (!Number.isInteger(id) || id < 1 || id > 4094) return '% Invalid VLAN ID (1-4094)';
      if (negate) {
        if (dev.vlanNames) delete dev.vlanNames[id];
        host.markDirty();
        return '';
      }
      dev.vlanNames = { ...(dev.vlanNames ?? {}), [id]: dev.vlanNames?.[id] ?? `VLAN${String(id).padStart(4, '0')}` };
      s.mode = 'config-vlan';
      s.vlan = id;
      host.markDirty();
      return '';
    },
  },
  {
    p: 'access-list <action> <protocol> <src> <dst> <eq...>',
    modes: CFG,
    help: 'Add a filter rule (permit/deny tcp|udp|icmp|ip src dst [eq port])',
    run: ({ host, dev, a, negate }) => {
      if (negate) {
        dev.firewallRules = [];
        host.markDirty();
        return '';
      }
      const [action, proto, src, dst] = a;
      if (!['permit', 'deny'].includes(action.toLowerCase())) return BAD;
      const protocol = proto.toLowerCase() === 'ip' ? 'ANY' : (proto.toUpperCase() as FirewallRule['protocol']);
      if (!['ANY', 'TCP', 'UDP', 'ICMP'].includes(protocol)) return BAD;
      const eq = a.slice(4);
      const portTok = eq[0]?.toLowerCase() === 'eq' ? eq[1] : undefined;
      const named: Record<string, number> = { www: 80, http: 80, https: 443, ssh: 22, telnet: 23, ftp: 21, domain: 53, smtp: 25 };
      const port = portTok ? named[portTok.toLowerCase()] ?? Number(portTok) : 'any';
      if (port !== 'any' && !Number.isInteger(port)) return BAD;
      dev.firewallRules.push({
        id: `acl-${Date.now()}-${dev.firewallRules.length}`,
        action: action.toLowerCase() === 'permit' ? 'allow' : 'deny',
        direction: 'both',
        protocol,
        srcIp: src,
        dstIp: dst,
        dstPort: port as number | 'any',
      });
      host.markDirty();
      return '';
    },
  },
  {
    p: 'enable <kind> <secret...>',
    modes: CFG,
    help: 'Set the enable password (accepted, not enforced)',
    run: () => '',
  },
  {
    p: 'do <rest...>',
    modes: ['config', 'config-if', 'config-vlan', 'config-router'],
    help: 'Run an EXEC command from configuration mode',
    run: () => '', // handled specially in execIos
  },

  /* interface configuration */
  {
    p: 'ip address <ip> <mask>',
    modes: IF,
    help: 'Set the interface IP address',
    run: ({ host, dev, s, a, negate }) => {
      const i = dev.interfaces.find((x) => x.id === s.iface);
      if (!i) return BAD;
      if (negate) {
        i.ip = '';
        host.markDirty();
        return '';
      }
      const [ip, mask] = a;
      if (!isValidIpv4(ip)) return BAD;
      if (!validMask(mask)) return '% Bad mask ' + mask;
      const clash = dev.interfaces.find((x) => x.id !== i.id && x.ip && sameSubnet(x.ip, ip, mask) && sameSubnet(ip, x.ip, x.mask));
      if (clash) return `% ${ip} overlaps with ${clash.name}`;
      i.ip = ip;
      i.mask = mask;
      host.markDirty();
      return '';
    },
  },
  {
    p: 'ip address',
    modes: IF,
    help: 'Remove the interface IP address (use "no ip address")',
    run: ({ host, dev, s, negate }) => {
      const i = dev.interfaces.find((x) => x.id === s.iface);
      if (!i) return BAD;
      if (!negate) return INCOMPLETE;
      i.ip = '';
      host.markDirty();
      return '';
    },
  },
  {
    p: 'shutdown',
    modes: IF,
    help: 'Administratively disable the interface',
    run: ({ host, dev, s, negate }) => {
      const i = dev.interfaces.find((x) => x.id === s.iface);
      if (!i) return BAD;
      i.up = negate;
      host.markDirty();
      return `%LINK-5-CHANGED: Interface ${i.name}, changed state to ${negate ? 'up' : 'administratively down'}`;
    },
  },
  {
    p: 'description <text...>',
    modes: IF,
    help: 'Describe the interface',
    run: ({ host, dev, s, a, negate }) => {
      const i = dev.interfaces.find((x) => x.id === s.iface);
      if (!i) return BAD;
      i.description = negate ? undefined : a.join(' ');
      host.markDirty();
      return '';
    },
  },
  {
    p: 'switchport mode <mode>',
    modes: IF,
    help: 'Set the port mode (access | trunk)',
    run: ({ host, dev, s, a }) => {
      const i = dev.interfaces.find((x) => x.id === s.iface);
      if (!i) return BAD;
      const m = a[0].toLowerCase();
      if (m !== 'access' && m !== 'trunk') return BAD;
      i.isTrunk = m === 'trunk';
      host.markDirty();
      return '';
    },
  },
  {
    p: 'switchport access vlan <id>',
    modes: IF,
    help: 'Put the access port in a VLAN',
    run: ({ host, dev, s, a, negate }) => {
      const i = dev.interfaces.find((x) => x.id === s.iface);
      if (!i) return BAD;
      const id = negate ? 1 : Number(a[0]);
      if (!Number.isInteger(id) || id < 1 || id > 4094) return '% Invalid VLAN ID (1-4094)';
      i.vlan = id;
      i.isTrunk = false;
      host.markDirty();
      return '';
    },
  },
  {
    p: 'switchport trunk allowed vlan <list>',
    modes: IF,
    help: 'Limit the VLANs carried on the trunk (e.g. 10,20)',
    run: ({ host, dev, s, a, negate }) => {
      const i = dev.interfaces.find((x) => x.id === s.iface);
      if (!i) return BAD;
      i.isTrunk = true;
      if (negate || a[0].toLowerCase() === 'all') i.trunkVlans = undefined;
      else {
        const ids = a[0].split(',').map(Number);
        if (ids.some((n) => !Number.isInteger(n) || n < 1 || n > 4094)) return '% Invalid VLAN list';
        i.trunkVlans = ids;
      }
      host.markDirty();
      return '';
    },
  },
  {
    p: 'ip nat <side>',
    modes: IF,
    help: 'Mark the interface as NAT inside or outside',
    run: ({ host, dev, s, a, negate }) => {
      const i = dev.interfaces.find((x) => x.id === s.iface);
      if (!i) return BAD;
      const side = a[0].toLowerCase();
      if (side !== 'inside' && side !== 'outside') return BAD;
      i.nat = negate ? undefined : side;
      if (!negate) dev.natEnabled = true;
      host.markDirty();
      return '';
    },
  },
  {
    p: 'ip helper-address <ip>',
    modes: IF,
    help: 'Relay DHCP broadcasts to a server',
    run: ({ host, dev, s, a, negate }) => {
      const i = dev.interfaces.find((x) => x.id === s.iface);
      if (!i) return BAD;
      if (!negate && !isValidIpv4(a[0])) return BAD;
      i.helper = negate ? undefined : a[0];
      host.markDirty();
      return '';
    },
  },
  {
    p: 'duplex <mode>',
    modes: IF,
    help: 'Set duplex (accepted)',
    run: () => '',
  },
  {
    p: 'speed <value>',
    modes: IF,
    help: 'Set speed (accepted)',
    run: () => '',
  },

  /* VLAN configuration */
  {
    p: 'name <vlan-name>',
    modes: ['config-vlan'],
    help: 'Name the VLAN',
    run: ({ host, dev, s, a }) => {
      if (s.vlan === undefined) return BAD;
      dev.vlanNames = { ...(dev.vlanNames ?? {}), [s.vlan]: a[0] };
      host.markDirty();
      return '';
    },
  },

  /* routing protocol configuration */
  {
    p: 'network <net> <rest...>',
    modes: ['config-router'],
    help: 'Enable the protocol on a network (OSPF: network A.B.C.D wildcard area N)',
    run: ({ host, dev, a, negate }) => {
      const [net, ...rest] = a;
      if (!isValidIpv4(net)) return BAD;
      let prefix: number | null = null;
      const first = rest[0]?.toLowerCase() === 'mask' ? rest[1] : rest[0];
      if (first && isValidIpv4(first)) {
        const n = ipToInt(first) >>> 0;
        const inv = ~n >>> 0;
        const isMask = n !== 0 && validMask(first);
        const isWildcard = (n & (n + 1)) === 0 && first.split('.')[0] !== '255'; // contiguous low bits (0.0.0.255)
        if (isMask) prefix = maskToPrefix(first);
        else if (isWildcard) prefix = 32 - Math.round(Math.log2(n + 1));
        else if (inv === 0) prefix = 32;
        else return BAD;
      }
      if (prefix === null) {
        // RIP and BGP without a mask use the classful boundary.
        const o = Number(net.split('.')[0]);
        prefix = o < 128 ? 8 : o < 192 ? 16 : 24;
      }
      const netInt = (ipToInt(net) & ((0xffffffff << (32 - prefix)) >>> 0)) >>> 0;
      const entry = `${intToIp(netInt)}/${prefix}`;
      const list = dev.routingNetworks ?? [];
      dev.routingNetworks = negate ? list.filter((x) => x !== entry) : list.includes(entry) ? list : [...list, entry];
      host.markDirty();
      return '';
    },
  },
  {
    p: 'neighbor <ip> <rest...>',
    modes: ['config-router'],
    help: 'BGP neighbour (accepted; adjacency follows the cabling)',
    run: ({ a }) => (isValidIpv4(a[0]) ? '' : BAD),
  },
  {
    p: 'router-id <id>',
    modes: ['config-router'],
    help: 'Set the router ID (accepted)',
    run: () => '',
  },
];

/* ───────────── matching ───────────── */

interface Match {
  cmd: Cmd;
  args: string[];
  exact: number;
}

function matchCommand(tokens: string[], cmd: Cmd): Match | 'incomplete' | null {
  const words = cmd.p.split(' ');
  const args: string[] = [];
  let exact = 0;
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    const tok = tokens[i];
    if (w.startsWith('<')) {
      if (w.endsWith('...>')) {
        if (i === words.length - 1) {
          args.push(...tokens.slice(i));
          return { cmd, args: args.length ? args : [], exact };
        }
      }
      if (tok === undefined) return 'incomplete';
      args.push(tok);
      continue;
    }
    if (tok === undefined) return 'incomplete';
    if (!w.startsWith(tok.toLowerCase())) return null;
    if (w === tok.toLowerCase()) exact++;
  }
  if (tokens.length > words.length) return null;
  return { cmd, args, exact };
}

function visibleCommands(mode: IosMode): Cmd[] {
  return COMMANDS.filter((c) => c.modes.includes(mode));
}

/** `?` help: the possible next words for the text typed so far. */
function contextHelp(mode: IosMode, typed: string[]): string {
  const next = new Map<string, string>();
  for (const c of visibleCommands(mode)) {
    const words = c.p.split(' ');
    let ok = true;
    for (let i = 0; i < typed.length; i++) {
      const w = words[i];
      if (!w) {
        ok = false;
        break;
      }
      if (w.startsWith('<')) continue;
      if (!w.startsWith(typed[i].toLowerCase())) {
        ok = false;
        break;
      }
    }
    const w = words[typed.length];
    if (ok && w && !next.has(w)) next.set(w, words.length - 1 === typed.length ? c.help : '');
  }
  if (next.size === 0) return '% Unrecognized command';
  return [...next.entries()].map(([w, h]) => `  ${w.padEnd(22)} ${h}`.trimEnd()).join('\n');
}

/** Tab completion on the last word. */
export function completeIos(mode: IosMode, line: string): string | null {
  if (!line.trim() || line.endsWith(' ')) return null;
  const tokens = line.trim().split(/\s+/);
  const negate = tokens[0].toLowerCase() === 'no';
  const body = negate ? tokens.slice(1) : tokens;
  if (body.length === 0) return null;
  const idx = body.length - 1;
  const set = new Set<string>();
  for (const c of visibleCommands(mode)) {
    const words = c.p.split(' ');
    let ok = true;
    for (let i = 0; i < idx; i++) {
      const w = words[i];
      if (!w || (!w.startsWith('<') && !w.startsWith(body[i].toLowerCase()))) {
        ok = false;
        break;
      }
    }
    const w = words[idx];
    if (ok && w && !w.startsWith('<') && w.startsWith(body[idx].toLowerCase())) set.add(w);
  }
  if (set.size !== 1) return null;
  const only = [...set][0];
  return [...(negate ? ['no'] : []), ...body.slice(0, idx), only].join(' ') + ' ';
}

/* ───────────── entry point ───────────── */

/** Reformats the generic ping into IOS style (`!!!!!`). */
function iosPing(host: IosHost, line: string): string {
  const tokens = line.split(/\s+/);
  const target = tokens[1];
  if (!target) return INCOMPLETE;
  const raw = host.runGeneric(`ping ${target} -c 5`);
  const rows = raw.split('\n').filter((l) => /icmp_seq=/.test(l));
  if (rows.length === 0) return raw; // name resolution error etc.
  const marks = rows.map((l) => (/bytes from/.test(l) ? '!' : /Unreachable|unreachable/.test(l) ? 'U' : '.')).join('');
  const times = rows.map((l) => Number(l.match(/time=([\d.]+)/)?.[1])).filter((n) => Number.isFinite(n));
  const ok = marks.split('!').length - 1;
  const pct = Math.round((ok / rows.length) * 100);
  const rtt = times.length ? ` round-trip min/avg/max = ${Math.min(...times).toFixed(0)}/${(times.reduce((a, b) => a + b, 0) / times.length).toFixed(0)}/${Math.max(...times).toFixed(0)} ms` : '';
  return [`Type escape sequence to abort.`, `Sending ${rows.length}, 100-byte ICMP Echos to ${target}, timeout is 2 seconds:`, marks, `Success rate is ${pct} percent (${ok}/${rows.length})${rtt ? ',' + rtt : ''}`].join('\n');
}

/**
 * Runs one line. Returns the output text, or `null` when the line is not an IOS command and the
 * caller should fall back to the generic host commands (only in EXEC modes).
 */
export function execIos(host: IosHost, dev: SimDevice, s: IosSession, rawLine: string): string | null {
  const line = rawLine.trim();
  if (!line) return '';

  // "?" help, either alone or after a partial command.
  if (line.endsWith('?')) {
    const typed = line.slice(0, -1).trim().split(/\s+/).filter(Boolean);
    const negate = typed[0]?.toLowerCase() === 'no';
    return contextHelp(s.mode, negate ? typed.slice(1) : typed);
  }

  let tokens = line.split(/\s+/);
  const negate = tokens[0].toLowerCase() === 'no';
  if (negate) {
    tokens = tokens.slice(1);
    if (s.mode === 'user' || s.mode === 'priv') return BAD;
    if (tokens.length === 0) return INCOMPLETE;
  }

  // `do show ...` inside configuration modes.
  if (!negate && tokens[0].toLowerCase() === 'do' && s.mode !== 'user' && s.mode !== 'priv') {
    const saved = s.mode;
    s.mode = 'priv';
    const out = execIos(host, dev, s, tokens.slice(1).join(' '));
    s.mode = saved;
    return out ?? host.runGeneric(tokens.slice(1).join(' '));
  }

  let best: Match | null = null;
  let incomplete = false;
  for (const c of visibleCommands(s.mode)) {
    const m = matchCommand(tokens, c);
    if (m === 'incomplete') incomplete = true;
    else if (m && (!best || m.exact > best.exact)) best = m;
  }

  if (!best) {
    // Exec modes: let the generic commands (ping, traceroute, curl, ...) have a go.
    if (s.mode === 'user' || s.mode === 'priv') {
      const first = tokens[0].toLowerCase();
      if (first === 'ping' || first === 'p') return iosPing(host, line.replace(/^p\b/i, 'ping'));
      const generic = host.runGeneric(line);
      return /command not found/.test(generic) ? BAD : generic;
    }
    return incomplete ? INCOMPLETE : BAD;
  }

  const out = best.cmd.run({ host, dev, s, a: best.args, negate });
  return out;
}
