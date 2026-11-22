import { createDefaultInterface } from '../engine/simulator';
import type { DeviceRole, SimDevice, SimLink } from '../engine/types';

export interface StarterTemplate {
  id: string;
  nameKey: string;
  descKey: string;
  fallbackName: string;
  fallbackDesc: string;
  category: 'home' | 'routing' | 'security' | 'switching' | 'cloud';
  devices: SimDevice[];
  links: SimLink[];
  probe?: { deviceId: string; command: string };
}

function tplDev(
  id: string,
  name: string,
  role: DeviceRole,
  x: number,
  y: number,
  ip: string,
  opts: Partial<SimDevice> = {}
): SimDevice {
  const suffix = ((Math.abs(id.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0)) % 200) + 12)
    .toString(16)
    .padStart(2, '0');
  return {
    id,
    name,
    role,
    x,
    y,
    poweredOn: true,
    interfaces: [createDefaultInterface('eth0', 'eth0', ip, '255.255.255.0', opts.interfaces?.[0]?.gateway, suffix)],
    routingTable: [],
    arpCache: [],
    macTable: [],
    natTable: [],
    firewallRules: [],
    services: {},
    openPorts: [80, 443],
    cpuLoad: 6,
    ...opts,
  };
}

function tplLnk(id: string, sourceId: string, targetId: string, opts: Partial<SimLink> = {}): SimLink {
  return {
    id,
    sourceId,
    sourceIface: 'eth0',
    targetId,
    targetIface: 'eth0',
    medium: 'ethernet',
    bandwidthMbps: 100,
    delayMs: 6,
    jitterMs: 0,
    lossPercent: 0,
    mtu: 1500,
    duplex: 'full',
    up: true,
    ...opts,
  };
}

export const STARTER_TEMPLATES: StarterTemplate[] = [
  {
    id: 'tpl-soho-nat',
    nameKey: 'simulator.tplSohoName',
    descKey: 'simulator.tplSohoDesc',
    fallbackName: 'SOHO Wi-Fi & NAT',
    fallbackDesc: 'Laptop & phone behind a Wi-Fi NAT router reaching a public web server',
    category: 'home',
    devices: [
      tplDev('tpl-soho-laptop', 'Laptop', 'host', 130, 140, '192.168.1.10', {
        dnsServer: '8.8.8.8',
        interfaces: [createDefaultInterface('eth0', 'wlan0', '192.168.1.10', '255.255.255.0', '192.168.1.1', '10')],
      }),
      tplDev('tpl-soho-phone', 'Phone', 'phone', 130, 320, '192.168.1.11', {
        dnsServer: '8.8.8.8',
        interfaces: [createDefaultInterface('eth0', 'wlan0', '192.168.1.11', '255.255.255.0', '192.168.1.1', '11')],
      }),
      tplDev('tpl-soho-gw', 'Wi-Fi Router', 'nat_gateway', 380, 230, '192.168.1.1', {
        natEnabled: true,
        services: { dhcp: { enabled: true, poolStart: '192.168.1.100', poolEnd: '192.168.1.150', mask: '255.255.255.0', gateway: '192.168.1.1', dns: '8.8.8.8' } },
        interfaces: [
          createDefaultInterface('eth0', 'lan0', '192.168.1.1', '255.255.255.0', undefined, '21'),
          createDefaultInterface('eth1', 'wan0', '198.51.100.2', '255.255.255.0', '198.51.100.1', '22'),
          createDefaultInterface('eth2', 'wlan0', '192.168.1.2', '255.255.255.0', undefined, '23'),
        ],
      }),
      tplDev('tpl-soho-isp', 'ISP Edge', 'router', 620, 230, '198.51.100.1', {
        routingProtocol: 'ospf',
        interfaces: [
          createDefaultInterface('eth0', 'gi0/0', '198.51.100.1', '255.255.255.0', undefined, '31'),
          createDefaultInterface('eth1', 'gi0/1', '203.0.113.1', '255.255.255.0', undefined, '32'),
        ],
      }),
      tplDev('tpl-soho-web', 'Web Server', 'web_server', 850, 230, '203.0.113.10', {
        interfaces: [createDefaultInterface('eth0', 'eth0', '203.0.113.10', '255.255.255.0', '203.0.113.1', '41')],
        services: { http: { enabled: true, port: 80, body: '<h1>SOHO Template Ready</h1>' } },
      }),
    ],
    links: [
      tplLnk('tpl-soho-l1', 'tpl-soho-laptop', 'tpl-soho-gw', { medium: 'wireless', bandwidthMbps: 300, delayMs: 3, jitterMs: 1 }),
      tplLnk('tpl-soho-l2', 'tpl-soho-phone', 'tpl-soho-gw', { targetIface: 'eth2', medium: 'wireless', bandwidthMbps: 300, delayMs: 4, jitterMs: 1 }),
      tplLnk('tpl-soho-l3', 'tpl-soho-gw', 'tpl-soho-isp', { sourceIface: 'eth1', medium: 'fiber', bandwidthMbps: 1000, delayMs: 8 }),
      tplLnk('tpl-soho-l4', 'tpl-soho-isp', 'tpl-soho-web', { sourceIface: 'eth1', medium: 'fiber', bandwidthMbps: 1000, delayMs: 10 }),
    ],
    probe: { deviceId: 'tpl-soho-laptop', command: 'curl http://203.0.113.10' },
  },
  {
    id: 'tpl-dual-router',
    nameKey: 'simulator.tplDualName',
    descKey: 'simulator.tplDualDesc',
    fallbackName: 'Dual-Subnet Router',
    fallbackDesc: 'Two isolated LAN subnets bridged by an L3 core router with DNS',
    category: 'routing',
    devices: [
      tplDev('tpl-dual-ha', 'Workstation A', 'host', 140, 220, '192.168.10.10', {
        dnsServer: '192.168.20.53',
        interfaces: [createDefaultInterface('eth0', 'eth0', '192.168.10.10', '255.255.255.0', '192.168.10.1', '51')],
      }),
      tplDev('tpl-dual-r1', 'Core Router', 'router', 470, 220, '192.168.10.1', {
        routingProtocol: 'ospf',
        interfaces: [
          createDefaultInterface('eth0', 'gi0/0', '192.168.10.1', '255.255.255.0', undefined, '52'),
          createDefaultInterface('eth1', 'gi0/1', '192.168.20.1', '255.255.255.0', undefined, '53'),
          createDefaultInterface('eth2', 'gi0/2', '192.168.30.1', '255.255.255.0', undefined, '54'),
        ],
      }),
      tplDev('tpl-dual-hb', 'App Server B', 'web_server', 820, 140, '192.168.20.20', {
        interfaces: [createDefaultInterface('eth0', 'eth0', '192.168.20.20', '255.255.255.0', '192.168.20.1', '55')],
        services: { http: { enabled: true, port: 80, body: '<h1>Dual-Subnet App</h1>' } },
      }),
      tplDev('tpl-dual-dns', 'Internal DNS', 'dns_server', 820, 310, '192.168.30.53', {
        openPorts: [53],
        interfaces: [createDefaultInterface('eth0', 'eth0', '192.168.30.53', '255.255.255.0', '192.168.30.1', '56')],
        services: {
          dns: {
            enabled: true,
            role: 'authoritative',
            records: [{ name: 'app.corp.local', type: 'A', value: '192.168.20.20', ttl: 300 }],
          },
        },
      }),
    ],
    links: [
      tplLnk('tpl-dual-l1', 'tpl-dual-ha', 'tpl-dual-r1', { delayMs: 4 }),
      tplLnk('tpl-dual-l2', 'tpl-dual-r1', 'tpl-dual-hb', { sourceIface: 'eth1', delayMs: 5 }),
      tplLnk('tpl-dual-l3', 'tpl-dual-r1', 'tpl-dual-dns', { sourceIface: 'eth2', delayMs: 5 }),
    ],
    probe: { deviceId: 'tpl-dual-ha', command: 'ping 192.168.20.20 -c 2' },
  },
  {
    id: 'tpl-dmz-firewall',
    nameKey: 'simulator.tplDmzName',
    descKey: 'simulator.tplDmzDesc',
    fallbackName: 'Perimeter Firewall + DMZ',
    fallbackDesc: 'Stateful firewall isolating a public DMZ web host from an internal DB server',
    category: 'security',
    devices: [
      tplDev('tpl-dmz-client', 'Internet Client', 'host', 130, 220, '198.51.100.50', {
        interfaces: [createDefaultInterface('eth0', 'eth0', '198.51.100.50', '255.255.255.0', '198.51.100.1', '61')],
      }),
      tplDev('tpl-dmz-fw', 'Edge Firewall', 'firewall', 460, 220, '198.51.100.1', {
        statefulFirewall: true,
        interfaces: [
          createDefaultInterface('eth0', 'outside', '198.51.100.1', '255.255.255.0', undefined, '62'),
          createDefaultInterface('eth1', 'dmz', '203.0.113.1', '255.255.255.0', undefined, '63'),
          createDefaultInterface('eth2', 'inside', '10.0.10.1', '255.255.255.0', undefined, '64'),
        ],
        firewallRules: [
          {
            id: 'fw-allow-dmz-http',
            action: 'allow',
            direction: 'both',
            protocol: 'TCP',
            srcIp: 'any',
            dstIp: '203.0.113.20',
            dstPort: 80,
          },
          {
            id: 'fw-allow-dmz-icmp',
            action: 'allow',
            direction: 'both',
            protocol: 'ICMP',
            srcIp: 'any',
            dstIp: '203.0.113.20',
            dstPort: 'any',
          },
          {
            id: 'fw-deny-db',
            action: 'deny',
            direction: 'both',
            protocol: 'ANY',
            srcIp: '198.51.100.50',
            dstIp: '10.0.10.20',
            dstPort: 'any',
          },
        ],
      }),
      tplDev('tpl-dmz-web', 'DMZ Web', 'web_server', 820, 130, '203.0.113.20', {
        interfaces: [createDefaultInterface('eth0', 'eth0', '203.0.113.20', '255.255.255.0', '203.0.113.1', '65')],
        services: { http: { enabled: true, port: 80, body: '<h1>DMZ Edge Web</h1>' } },
      }),
      tplDev('tpl-dmz-db', 'LAN Database', 'file_server', 820, 320, '10.0.10.20', {
        openPorts: [5432, 22],
        interfaces: [createDefaultInterface('eth0', 'eth0', '10.0.10.20', '255.255.255.0', '10.0.10.1', '66')],
      }),
    ],
    links: [
      tplLnk('tpl-dmz-l1', 'tpl-dmz-client', 'tpl-dmz-fw', { delayMs: 8 }),
      tplLnk('tpl-dmz-l2', 'tpl-dmz-fw', 'tpl-dmz-web', { sourceIface: 'eth1', medium: 'fiber', bandwidthMbps: 1000, delayMs: 3 }),
      tplLnk('tpl-dmz-l3', 'tpl-dmz-fw', 'tpl-dmz-db', { sourceIface: 'eth2', delayMs: 3 }),
    ],
    probe: { deviceId: 'tpl-dmz-client', command: 'curl http://203.0.113.20' },
  },
  {
    id: 'tpl-vlan-switch',
    nameKey: 'simulator.tplVlanName',
    descKey: 'simulator.tplVlanDesc',
    fallbackName: 'VLAN Switch & Trunk',
    fallbackDesc: 'Segmented Engineering & Finance VLANs routed via Router-on-a-Stick',
    category: 'switching',
    devices: [
      tplDev('tpl-vlan-eng', 'Eng PC (V10)', 'host', 140, 130, '10.10.10.10', {
        interfaces: [createDefaultInterface('eth0', 'eth0', '10.10.10.10', '255.255.255.0', '10.10.10.1', '71')],
      }),
      tplDev('tpl-vlan-fin', 'Finance PC (V20)', 'host', 140, 320, '10.10.20.10', {
        interfaces: [createDefaultInterface('eth0', 'eth0', '10.10.20.10', '255.255.255.0', '10.10.20.1', '72')],
      }),
      tplDev('tpl-vlan-sw', 'L2 Switch', 'switch', 480, 225, '0.0.0.0', {
        interfaces: [
          createDefaultInterface('p1', 'fa0/1', '0.0.0.0', '255.255.255.0', undefined, '73'),
          createDefaultInterface('p2', 'fa0/2', '0.0.0.0', '255.255.255.0', undefined, '74'),
          createDefaultInterface('p3', 'gi0/1', '0.0.0.0', '255.255.255.0', undefined, '75'),
        ],
      }),
      tplDev('tpl-vlan-rtr', 'Trunk Router', 'router', 820, 225, '10.10.10.1', {
        interfaces: [
          createDefaultInterface('eth0', 'gi0/0.10', '10.10.10.1', '255.255.255.0', undefined, '76'),
          createDefaultInterface('eth1', 'gi0/0.20', '10.10.20.1', '255.255.255.0', undefined, '77'),
        ],
      }),
    ],
    links: [
      tplLnk('tpl-vlan-l1', 'tpl-vlan-eng', 'tpl-vlan-sw', { targetIface: 'p1', delayMs: 2 }),
      tplLnk('tpl-vlan-l2', 'tpl-vlan-fin', 'tpl-vlan-sw', { targetIface: 'p2', delayMs: 2 }),
      tplLnk('tpl-vlan-l3', 'tpl-vlan-sw', 'tpl-vlan-rtr', { sourceIface: 'p3', medium: 'fiber', bandwidthMbps: 1000, delayMs: 3 }),
    ],
    probe: { deviceId: 'tpl-vlan-eng', command: 'ping 10.10.20.10 -c 2' },
  },
  {
    id: 'tpl-dns-lb',
    nameKey: 'simulator.tplLbName',
    descKey: 'simulator.tplLbDesc',
    fallbackName: 'DNS + Load-Balanced Web',
    fallbackDesc: 'Client resolves DNS then connects through a reverse proxy to backend web nodes',
    category: 'cloud',
    devices: [
      tplDev('tpl-lb-client', 'Client Host', 'host', 110, 235, '192.168.5.10', {
        dnsServer: '8.8.8.8',
        interfaces: [createDefaultInterface('eth0', 'eth0', '192.168.5.10', '255.255.255.0', '192.168.5.1', '81')],
      }),
      tplDev('tpl-lb-rtr', 'Edge Router', 'router', 340, 235, '192.168.5.1', {
        routingProtocol: 'ospf',
        interfaces: [
          createDefaultInterface('eth0', 'gi0/0', '192.168.5.1', '255.255.255.0', undefined, '87'),
          createDefaultInterface('eth1', 'gi0/1', '8.8.8.1', '255.255.255.0', undefined, '88'),
          createDefaultInterface('eth2', 'gi0/2', '203.0.113.1', '255.255.255.0', undefined, '89'),
        ],
      }),
      tplDev('tpl-lb-dns', 'DNS Resolver', 'dns_server', 340, 85, '8.8.8.8', {
        openPorts: [53],
        interfaces: [createDefaultInterface('eth0', 'eth0', '8.8.8.8', '255.255.255.0', '8.8.8.1', '82')],
        services: {
          dns: {
            enabled: true,
            role: 'recursive',
            records: [{ name: 'api.example.com', type: 'A', value: '203.0.113.50', ttl: 300 }],
          },
        },
      }),
      tplDev('tpl-lb-proxy', 'Reverse Proxy LB', 'reverse_proxy', 590, 235, '203.0.113.50', {
        interfaces: [
          createDefaultInterface('eth0', 'ext0', '203.0.113.50', '255.255.255.0', '203.0.113.1', '83'),
          createDefaultInterface('eth1', 'int0', '10.20.0.1', '255.255.255.0', undefined, '84'),
        ],
        services: { http: { enabled: true, port: 80, body: '<h1>Load Balanced OK</h1>' } },
      }),
      tplDev('tpl-lb-web1', 'Web Node 1', 'web_server', 850, 145, '10.20.0.11', {
        interfaces: [createDefaultInterface('eth0', 'eth0', '10.20.0.11', '255.255.255.0', '10.20.0.1', '85')],
        services: { http: { enabled: true, port: 80, body: '<h1>Node 1</h1>' } },
      }),
      tplDev('tpl-lb-web2', 'Web Node 2', 'web_server', 850, 325, '10.20.0.12', {
        interfaces: [createDefaultInterface('eth0', 'eth0', '10.20.0.12', '255.255.255.0', '10.20.0.1', '86')],
        services: { http: { enabled: true, port: 80, body: '<h1>Node 2</h1>' } },
      }),
    ],
    links: [
      tplLnk('tpl-lb-l1', 'tpl-lb-client', 'tpl-lb-rtr', { delayMs: 4 }),
      tplLnk('tpl-lb-l2', 'tpl-lb-rtr', 'tpl-lb-dns', { sourceIface: 'eth1', delayMs: 5 }),
      tplLnk('tpl-lb-l3', 'tpl-lb-rtr', 'tpl-lb-proxy', { sourceIface: 'eth2', medium: 'fiber', bandwidthMbps: 1000, delayMs: 6 }),
      tplLnk('tpl-lb-l4', 'tpl-lb-proxy', 'tpl-lb-web1', { sourceIface: 'eth1', medium: 'fiber', bandwidthMbps: 1000, delayMs: 2 }),
      tplLnk('tpl-lb-l5', 'tpl-lb-proxy', 'tpl-lb-web2', { sourceIface: 'eth1', medium: 'fiber', bandwidthMbps: 1000, delayMs: 2 }),
    ],
    probe: { deviceId: 'tpl-lb-client', command: 'curl http://api.example.com' },
  },
];
