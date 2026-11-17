import { createDefaultInterface, SimulationEngine } from '../engine/simulator';
import type { DeviceRole, SimDevice, SimLink } from '../engine/types';

export interface PresetLab {
  id: string;
  number: number;
  title: string;
  category: string;
  description: string;
  goals: string[];
  hints: string[];
  solutionSummary: string;
  devices: SimDevice[];
  links: SimLink[];
  onLoadRun?: (engine: SimulationEngine) => string;
  onSolve?: (engine: SimulationEngine) => string;
}

function dev(
  id: string,
  name: string,
  role: DeviceRole,
  x: number,
  y: number,
  ip: string,
  opts: Partial<SimDevice> = {}
): SimDevice {
  const suffix = (Math.abs(id.split('').reduce((a, c) => a + c.charCodeAt(0), 0)) % 200 + 10)
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
    cpuLoad: 8,
    ...opts,
  };
}

function lnk(
  id: string,
  sourceId: string,
  targetId: string,
  opts: Partial<SimLink> = {}
): SimLink {
  return {
    id,
    sourceId,
    sourceIface: 'eth0',
    targetId,
    targetIface: 'eth0',
    medium: 'ethernet',
    bandwidthMbps: 100,
    delayMs: 8,
    jitterMs: 0,
    lossPercent: 0,
    mtu: 1500,
    duplex: 'full',
    up: true,
    ...opts,
  };
}

export const PRESET_LABS: PresetLab[] = [
  {
    id: 'lab-1-home',
    number: 1,
    title: 'Home Network (NAT/DHCP -> ISP -> Web)',
    category: 'Foundations',
    description: 'Home PC connects through a Wi-Fi NAT/DHCP router and ISP to reach a public web server.',
    goals: ['Open PC terminal and run `ping 203.0.113.10`', 'Run `curl http://example.com -v`', 'Inspect NAT translation table on Home Router'],
    hints: ['Check that Home PC gateway points to 192.168.1.1', 'Home Router performs PAT outbound to 198.51.100.2'],
    solutionSummary: 'Home Router translates 192.168.1.10 -> 198.51.100.2 via PAT and forwards to 203.0.113.10.',
    devices: [
      dev('pc', 'Home PC', 'host', 120, 220, '192.168.1.10', { dnsServer: '8.8.8.8', interfaces: [createDefaultInterface('eth0', 'eth0', '192.168.1.10', '255.255.255.0', '192.168.1.1', '10')] }),
      dev('homerouter', 'Wi-Fi Router', 'nat_gateway', 350, 220, '192.168.1.1', { natEnabled: true, interfaces: [createDefaultInterface('eth0', 'lan0', '192.168.1.1', '255.255.255.0', undefined, '01'), createDefaultInterface('eth1', 'wan0', '198.51.100.2', '255.255.255.0', '198.51.100.1', '02')] }),
      dev('isp', 'ISP AS64500', 'router', 590, 220, '198.51.100.1', { routingProtocol: 'ospf' }),
      dev('web', 'Web Server', 'web_server', 830, 220, '203.0.113.10', { services: { http: { enabled: true, port: 80, body: '<h1>Home Lab Success!</h1>' } } }),
    ],
    links: [
      lnk('l1', 'pc', 'homerouter', { delayMs: 2 }),
      lnk('l2', 'homerouter', 'isp', { sourceIface: 'eth1', delayMs: 10 }),
      lnk('l3', 'isp', 'web', { delayMs: 14 }),
    ],
    onLoadRun: (engine) => engine.execCommand('pc', 'curl http://203.0.113.10'),
    onSolve: (engine) => engine.execCommand('pc', 'ping 203.0.113.10 -c 2'),
  },
  {
    id: 'lab-2-two-lans',
    number: 2,
    title: 'Two LANs Joined by a Router',
    category: 'Routing',
    description: 'Connect Subnet A (192.168.1.0/24) and Subnet B (192.168.2.0/24) across a static router.',
    goals: ['Ping Host B (192.168.2.20) from Host A (192.168.1.10)', 'Run `show ip route` on Router'],
    hints: ['Both hosts need their subnet router interface as default gateway'],
    solutionSummary: 'Router forwards between 192.168.1.0/24 and 192.168.2.0/24 via connected routes.',
    devices: [
      dev('ha', 'Host A', 'host', 140, 220, '192.168.1.10', { interfaces: [createDefaultInterface('eth0', 'eth0', '192.168.1.10', '255.255.255.0', '192.168.1.1', '1a')] }),
      dev('r1', 'Core Router', 'router', 480, 220, '192.168.1.1', { interfaces: [createDefaultInterface('eth0', 'gi0/0', '192.168.1.1', '255.255.255.0', undefined, 'aa'), createDefaultInterface('eth1', 'gi0/1', '192.168.2.1', '255.255.255.0', undefined, 'ab')] }),
      dev('hb', 'Host B', 'host', 820, 220, '192.168.2.20', { interfaces: [createDefaultInterface('eth0', 'eth0', '192.168.2.20', '255.255.255.0', '192.168.2.1', '2b')] }),
    ],
    links: [
      lnk('l1', 'ha', 'r1', { sourceIface: 'eth0', targetIface: 'eth0' }),
      lnk('l2', 'r1', 'hb', { sourceIface: 'eth1', targetIface: 'eth0' }),
    ],
    onSolve: (engine) => engine.execCommand('ha', 'ping 192.168.2.20 -c 2'),
  },
  {
    id: 'lab-3-vlans',
    number: 3,
    title: 'VLANs & Inter-VLAN Routing',
    category: 'Switching',
    description: 'Separate Engineering (VLAN 10) and Finance (VLAN 20) on one switch with Router-on-a-Stick.',
    goals: ['Inspect Switch MAC table (`show mac address-table`)', 'Route from VLAN 10 to VLAN 20 via Router'],
    hints: ['Trunk port between Switch and Router carries tagged 802.1Q frames for VLAN 10 & 20'],
    solutionSummary: '802.1Q trunking isolates broadcast domains while allowing L3 inter-VLAN routing.',
    devices: [
      dev('eng', 'Eng PC (VLAN 10)', 'host', 140, 120, '10.10.10.10', { interfaces: [createDefaultInterface('eth0', 'eth0', '10.10.10.10', '255.255.255.0', '10.10.10.1', 'e1')] }),
      dev('fin', 'Finance PC (VLAN 20)', 'host', 140, 320, '10.10.20.10', { interfaces: [createDefaultInterface('eth0', 'eth0', '10.10.20.10', '255.255.255.0', '10.10.20.1', 'f2')] }),
      dev('sw', 'VLAN Switch', 'switch', 480, 220, '10.10.1.2', { interfaces: [createDefaultInterface('p1', 'gi0/1', '', '', undefined, 'c1'), createDefaultInterface('p2', 'gi0/2', '', '', undefined, 'c2'), createDefaultInterface('p3', 'gi0/3', '', '', undefined, 'c3')] }),
      dev('rtr', 'Router-on-Stick', 'router', 800, 220, '10.10.10.1', { interfaces: [createDefaultInterface('eth0', 'gi0/0.10', '10.10.10.1', '255.255.255.0', undefined, 'r1'), createDefaultInterface('eth1', 'gi0/0.20', '10.10.20.1', '255.255.255.0', undefined, 'r2')] }),
    ],
    links: [
      lnk('l1', 'eng', 'sw', { targetIface: 'p1' }),
      lnk('l2', 'fin', 'sw', { targetIface: 'p2' }),
      lnk('l3', 'sw', 'rtr', { sourceIface: 'p3' }),
    ],
    onSolve: (engine) => engine.execCommand('eng', 'ping 10.10.20.10 -c 2'),
  },
  {
    id: 'lab-4-dns-hierarchy',
    number: 4,
    title: 'DNS Hierarchy (Root -> TLD -> Auth)',
    category: 'Core Services',
    description: 'Trace recursive vs iterative resolution with TTL caching across Root, .com TLD, and Authoritative servers.',
    goals: ['Run `dig example.com` twice on Client to observe cache miss then cache hit'],
    hints: ['First query walks Root -> TLD -> Auth; second query returns directly from 8.8.8.8 cache'],
    solutionSummary: 'Resolver 8.8.8.8 caches A 203.0.113.10 for TTL=300s.',
    devices: [
      dev('c', 'Client', 'host', 120, 220, '192.168.1.10', { dnsServer: '8.8.8.8' }),
      dev('res', 'Resolver 8.8.8.8', 'dns_server', 390, 220, '8.8.8.8', { services: { dns: { enabled: true, role: 'recursive', records: [] } } }),
      dev('root', 'Root (.)', 'dns_server', 720, 100, '198.41.0.4', { services: { dns: { enabled: true, role: 'root', records: [] } } }),
      dev('auth', 'Auth NS', 'dns_server', 720, 340, '198.51.100.53', { services: { dns: { enabled: true, role: 'authoritative', records: [{ name: 'example.com', type: 'A', value: '203.0.113.10', ttl: 300 }] } } }),
    ],
    links: [lnk('l1', 'c', 'res'), lnk('l2', 'res', 'root'), lnk('l3', 'res', 'auth')],
    onSolve: (engine) => engine.execCommand('c', 'dig example.com'),
  },
  {
    id: 'lab-5-dhcp-relay',
    number: 5,
    title: 'DHCP DORA with Relay Across Router',
    category: 'Core Services',
    description: 'Client on Subnet A obtains an IP from a centralized DHCP server on Subnet B via IP Helper relay.',
    goals: ['Observe DHCP Discover/Offer/Request/Ack relayed across Router'],
    hints: ['Routers drop broadcasts by default unless DHCP Relay (ip helper-address) converts them to unicast'],
    solutionSummary: 'Relay agent forwards UDP/67 broadcasts as unicast to 10.0.0.50.',
    devices: [
      dev('c', 'New Laptop', 'host', 150, 220, '0.0.0.0'),
      dev('r', 'Relay Router', 'router', 480, 220, '192.168.1.1'),
      dev('dhcp', 'Central DHCP', 'dhcp_server', 820, 220, '10.0.0.50', { openPorts: [67] }),
    ],
    links: [lnk('l1', 'c', 'r'), lnk('l2', 'r', 'dhcp')],
    onSolve: (engine) => {
      engine.enqueueDirectPacket({ fromId: 'c', toId: 'r', protocol: 'DHCP', colorCategory: 'udp', info: 'DHCPDISCOVER (Broadcast)', osiLayer: 7, udp: { srcPort: 68, dstPort: 67 } });
      engine.enqueueDirectPacket({ fromId: 'r', toId: 'dhcp', startTimeMs: 10, protocol: 'DHCP', colorCategory: 'udp', info: 'Relayed DHCPDISCOVER (giaddr=192.168.1.1)', osiLayer: 7, udp: { srcPort: 67, dstPort: 67 } });
      engine.enqueueDirectPacket({ fromId: 'dhcp', toId: 'c', startTimeMs: 24, protocol: 'DHCP', colorCategory: 'udp', info: 'DHCPACK 192.168.1.50/24', osiLayer: 7, udp: { srcPort: 67, dstPort: 68 } });
      engine.runAll();
      return 'DHCP DORA relayed across router -> assigned 192.168.1.50';
    },
  },
  {
    id: 'lab-6-nat-pat',
    number: 6,
    title: 'NAT / PAT Port Translation',
    category: 'Routing',
    description: 'Multiple private LAN hosts share one public WAN IP (198.51.100.1) using distinct source ports.',
    goals: ['Generate traffic from Host 1 and Host 2', 'Inspect PAT translations on NAT Gateway'],
    hints: ['PAT rewrites both Source IP and Source Port to multiplex many hosts onto one public IP'],
    solutionSummary: 'NAT Gateway maps 192.168.1.10 and 192.168.1.11 to unique ports on 198.51.100.1.',
    devices: [
      dev('h1', 'PC 1', 'host', 140, 130, '192.168.1.10', { interfaces: [createDefaultInterface('eth0', 'eth0', '192.168.1.10', '255.255.255.0', '192.168.1.1', '11')] }),
      dev('h2', 'PC 2', 'host', 140, 310, '192.168.1.11', { interfaces: [createDefaultInterface('eth0', 'eth0', '192.168.1.11', '255.255.255.0', '192.168.1.1', '12')] }),
      dev('nat', 'NAT Gateway', 'nat_gateway', 490, 220, '198.51.100.1', { natEnabled: true, interfaces: [createDefaultInterface('eth0', 'lan0', '192.168.1.1', '255.255.255.0', undefined, 'n1'), createDefaultInterface('eth1', 'wan0', '198.51.100.1', '255.255.255.0', undefined, 'n2')] }),
      dev('srv', 'Public Web', 'web_server', 840, 220, '203.0.113.10'),
    ],
    links: [lnk('l1', 'h1', 'nat'), lnk('l2', 'h2', 'nat'), lnk('l3', 'nat', 'srv', { sourceIface: 'eth1' })],
    onSolve: (engine) => `${engine.execCommand('h1', 'curl http://203.0.113.10')}\n${engine.execCommand('h2', 'curl http://203.0.113.10')}`,
  },
  {
    id: 'lab-7-firewall-dmz',
    number: 7,
    title: 'Firewall + DMZ Web Server',
    category: 'Security',
    description: 'External Internet may access DMZ Web (:80/:443) but is blocked from reaching internal LAN DB (:5432).',
    goals: ['Run `nmap 10.0.1.50` vs `nmap 172.16.0.10` from Internet Client', 'Inspect Firewall ACL rules'],
    hints: ['Firewall permits TCP/80 & 443 to DMZ while denying inbound to Internal LAN'],
    solutionSummary: 'DMZ isolates public services so compromising the web tier does not expose the internal LAN.',
    devices: [
      dev('ext', 'Internet Host', 'host', 140, 220, '198.51.100.99'),
      dev('fw', 'Perimeter Firewall', 'firewall', 480, 220, '198.51.100.1', {
        statefulFirewall: true,
        firewallRules: [
          { id: 'r1', action: 'allow', direction: 'inbound', protocol: 'TCP', srcIp: 'any', dstIp: '172.16.0.10', dstPort: 80 },
          { id: 'r2', action: 'allow', direction: 'inbound', protocol: 'TCP', srcIp: 'any', dstIp: '172.16.0.10', dstPort: 443 },
          { id: 'r3', action: 'deny', direction: 'inbound', protocol: 'ANY', srcIp: 'any', dstIp: '10.0.1.50', dstPort: 'any' },
        ],
      }),
      dev('dmz', 'DMZ Web Server', 'web_server', 820, 120, '172.16.0.10', { openPorts: [80, 443] }),
      dev('db', 'Internal DB', 'server_tower', 820, 320, '10.0.1.50', { openPorts: [5432] }),
    ],
    links: [lnk('l1', 'ext', 'fw'), lnk('l2', 'fw', 'dmz'), lnk('l3', 'fw', 'db')],
    onSolve: (engine) => `${engine.execCommand('ext', 'curl http://172.16.0.10')}\n${engine.execCommand('ext', 'telnet 10.0.1.50 5432')}`,
  },
  {
    id: 'lab-8-http-vs-https',
    number: 8,
    title: 'HTTP vs HTTPS Sniffing on Shared Hub',
    category: 'Security',
    description: 'Compare plaintext HTTP credentials vs TLS 1.3 encrypted HTTPS packets on a shared Layer 1 Hub.',
    goals: ['Send HTTP GET and HTTPS GET from Client', 'Inspect packet hex dump to see plaintext vs ciphertext'],
    hints: ['Plain HTTP reveals full URI and headers in ASCII hex dump; HTTPS hides them in TLS Application Data'],
    solutionSummary: 'TLS encryption prevents passive LAN sniffers on shared media from reading sensitive HTTP data.',
    devices: [
      dev('c', 'Browser', 'host', 140, 220, '192.168.1.10'),
      dev('hub', 'Shared Hub', 'hub', 480, 220, '192.168.1.2'),
      dev('s', 'Web Server', 'web_server', 820, 220, '192.168.1.80', { openPorts: [80, 443] }),
    ],
    links: [lnk('l1', 'c', 'hub'), lnk('l2', 'hub', 's')],
    onSolve: (engine) => `${engine.execCommand('c', 'curl http://192.168.1.80 -v')}\n${engine.execCommand('c', 'curl https://192.168.1.80 -v')}`,
  },
  {
    id: 'lab-9-tcp-congestion',
    number: 9,
    title: 'TCP Congestion Control (Sawtooth cwnd)',
    category: 'Transport',
    description: 'Run an iPerf transfer across a lossy 10% link and watch Slow Start + Reno/CUBIC cwnd sawtooth.',
    goals: ['Run iPerf Traffic Generator', 'Inspect live cwnd/ssthresh chart in Metrics panel'],
    hints: ['Packet loss halves ssthresh and cuts cwnd, creating the classic TCP sawtooth'],
    solutionSummary: 'TCP adapts send rate dynamically to link capacity and packet drops.',
    devices: [
      dev('c', 'Sender', 'host', 160, 220, '192.168.1.10'),
      dev('r', 'Bottleneck Router', 'router', 500, 220, '192.168.1.1'),
      dev('s', 'Receiver', 'server_rack', 840, 220, '203.0.113.10', { openPorts: [5201] }),
    ],
    links: [lnk('l1', 'c', 'r', { bandwidthMbps: 100 }), lnk('l2', 'r', 's', { bandwidthMbps: 10, delayMs: 25, lossPercent: 12 })],
    onSolve: (engine) => engine.runTrafficGenerator('iperf', 'c', 's'),
  },
  {
    id: 'lab-10-syn-flood',
    number: 10,
    title: 'SYN Flood & SYN Cookies Defense',
    category: 'Security',
    description: 'Observe half-open SYN_RCVD exhaustion during a SYN burst and how SYN Cookies neutralize it.',
    goals: ['Trigger SYN burst against Web Server', 'Toggle SYN Cookies on Server'],
    hints: ['Without SYN cookies, half-open queue fills; with SYN cookies, ISN encodes state statelessly'],
    solutionSummary: 'SYN Cookies let legitimate 3-way handshakes complete even under heavy SYN flood.',
    devices: [
      dev('atk', 'Flooder', 'host', 160, 140, '198.51.100.66'),
      dev('legit', 'Legit User', 'host', 160, 310, '192.168.1.10'),
      dev('srv', 'Protected Server', 'web_server', 820, 220, '203.0.113.10', { synCookiesEnabled: true }),
    ],
    links: [lnk('l1', 'atk', 'srv'), lnk('l2', 'legit', 'srv')],
    onSolve: (engine) => `${engine.runTrafficGenerator('burst', 'atk', 'srv')}\n${engine.execCommand('legit', 'curl http://203.0.113.10')}`,
  },
  {
    id: 'lab-11-arp-spoof',
    number: 11,
    title: 'ARP Spoofing / MITM & DAI Detection',
    category: 'Security',
    description: 'Attacker injects forged ARP replies to intercept traffic between Victim PC and Gateway.',
    goals: ['Inspect `arp -a` on Victim PC', 'See rogue MAC conflict detected'],
    hints: ['Gratuitous ARP replies overwrite Victim’s ARP table unless Dynamic ARP Inspection is enabled'],
    solutionSummary: 'DAI validates ARP bindings against trusted DHCP leases.',
    devices: [
      dev('victim', 'Victim PC', 'host', 140, 220, '192.168.1.10'),
      dev('sw', 'LAN Switch', 'switch', 480, 220, '192.168.1.2'),
      dev('gw', 'Gateway', 'router', 820, 140, '192.168.1.1'),
      dev('atk', 'Attacker', 'host', 820, 320, '192.168.1.99'),
    ],
    links: [lnk('l1', 'victim', 'sw'), lnk('l2', 'sw', 'gw'), lnk('l3', 'sw', 'atk')],
    onSolve: (engine) => {
      engine.enqueueDirectPacket({ fromId: 'atk', toId: 'victim', protocol: 'ARP', colorCategory: 'error', info: 'Spoofed ARP: 192.168.1.1 is at 02:42:ac:11:00:99 (Attacker MAC!)', osiLayer: 2, arp: { opcode: 2, senderMac: '02:42:ac:11:00:99', senderIp: '192.168.1.1', targetMac: '02:42:ac:11:00:10', targetIp: '192.168.1.10' } });
      engine.runAll();
      return 'Injected spoofed ARP reply (MITM warning triggered).';
    },
  },
  {
    id: 'lab-12-dns-poison',
    number: 12,
    title: 'DNS Cache Poisoning & DNSSEC Fix',
    category: 'Security',
    description: 'Compare unsigned DNS cache poisoning against cryptographic RRSIG validation in DNSSEC.',
    goals: ['Run `dig bank.example.com` and verify AD=1 DNSSEC protection'],
    hints: ['Bogus spoofed answers fail RRSIG verification and return SERVFAIL'],
    solutionSummary: 'DNSSEC guarantees forged A records cannot poison validating resolvers.',
    devices: [
      dev('c', 'Client', 'host', 140, 220, '192.168.1.10', { dnsServer: '8.8.8.8' }),
      dev('res', 'Validating DNS', 'dns_server', 480, 220, '8.8.8.8', { services: { dns: { enabled: true, role: 'recursive', records: [] } } }),
      dev('auth', 'Signed Bank NS', 'dns_server', 820, 220, '198.51.100.53', { services: { dns: { enabled: true, role: 'authoritative', records: [{ name: 'bank.example.com', type: 'A', value: '203.0.113.77', ttl: 300 }] } } }),
    ],
    links: [lnk('l1', 'c', 'res'), lnk('l2', 'res', 'auth')],
    onSolve: (engine) => engine.execCommand('c', 'dig bank.example.com'),
  },
  {
    id: 'lab-13-bgp-as',
    number: 13,
    title: 'BGP 3-AS Peering & Failover',
    category: 'Routing',
    description: 'Three Autonomous Systems exchange prefixes; break primary link and watch BGP re-converge.',
    goals: ['Run `show ip route` on AS64500', 'Cut link AS64500 <-> AS64510 to test failover'],
    hints: ['BGP selects shortest loop-free AS_PATH'],
    solutionSummary: 'AS64500 fails over automatically to alternate AS path when primary peering drops.',
    devices: [
      dev('as1', 'ISP AS64500', 'router', 150, 220, '198.51.100.1', { asn: 64500, routingProtocol: 'bgp' }),
      dev('as2', 'Transit AS64510', 'router', 500, 120, '198.51.100.2', { asn: 64510, routingProtocol: 'bgp' }),
      dev('as3', 'Cloud AS64511', 'router', 850, 220, '203.0.113.1', { asn: 64511, routingProtocol: 'bgp' }),
    ],
    links: [lnk('l1', 'as1', 'as2'), lnk('l2', 'as2', 'as3'), lnk('l3', 'as1', 'as3', { delayMs: 25 })],
    onSolve: (engine) => engine.execCommand('as1', 'ping 203.0.113.1 -c 2'),
  },
  {
    id: 'lab-14-vpn-tunnel',
    number: 14,
    title: 'Site-to-Site WireGuard VPN Tunnel',
    category: 'Security',
    description: 'Connect Office A (10.1.0.0/24) to Office B (10.2.0.0/24) over an encrypted UDP/51820 tunnel.',
    goals: ['Ping Office B Server from Office A Host', 'Observe encrypted ChaCha20 UDP/51820 outer packets'],
    hints: ['Traffic across WAN link is encapsulated inside encrypted UDP/51820'],
    solutionSummary: 'Site-to-site VPN bridges private RFC 1918 subnets securely across public internet.',
    devices: [
      dev('a', 'Office A PC', 'host', 120, 220, '10.1.0.10'),
      dev('gwa', 'VPN GW A', 'vpn_gateway', 360, 220, '198.51.100.1'),
      dev('gwb', 'VPN GW B', 'vpn_gateway', 620, 220, '203.0.113.1'),
      dev('b', 'Office B NAS', 'file_server', 860, 220, '10.2.0.20'),
    ],
    links: [lnk('l1', 'a', 'gwa'), lnk('l2', 'gwa', 'gwb'), lnk('l3', 'gwb', 'b')],
    onSolve: (engine) => engine.execCommand('a', 'ping 10.2.0.20 -c 2'),
  },
  {
    id: 'lab-15-load-balancer',
    number: 15,
    title: 'Reverse Proxy & 3-Backend Load Balancer',
    category: 'Architecture',
    description: 'Distribute HTTPS requests across 3 backend workers and survive a node power-off.',
    goals: ['Power off Backend #2 and send HTTP requests from Client'],
    hints: ['Reverse proxy terminates TLS and routes around downed backends'],
    solutionSummary: 'Load balancer maintains availability despite individual backend failures.',
    devices: [
      dev('c', 'User', 'host', 130, 220, '192.168.1.10'),
      dev('lb', 'Reverse Proxy', 'reverse_proxy', 460, 220, '203.0.113.10'),
      dev('b1', 'Backend #1', 'server_tower', 820, 100, '10.0.0.11'),
      dev('b2', 'Backend #2', 'server_tower', 820, 220, '10.0.0.12'),
      dev('b3', 'Backend #3', 'server_tower', 820, 340, '10.0.0.13'),
    ],
    links: [lnk('l1', 'c', 'lb'), lnk('l2', 'lb', 'b1'), lnk('l3', 'lb', 'b2'), lnk('l4', 'lb', 'b3')],
    onSolve: (engine) => engine.execCommand('c', 'curl https://203.0.113.10 -v'),
  },
  {
    id: 'lab-16-wifi-radius',
    number: 16,
    title: 'Wi-Fi WPA2 / Captive Portal / RADIUS',
    category: 'Wireless',
    description: 'Phone associates to Access Point, authenticates via RADIUS 802.1X, and reaches the web.',
    goals: ['Inspect AP wireless clients & RADIUS exchange'],
    hints: ['AP forwards EAPOL frames as RADIUS UDP/1812 requests'],
    solutionSummary: 'Enterprise 802.1X authenticates each user individually via RADIUS.',
    devices: [
      dev('ph', 'Phone', 'phone', 140, 220, '192.168.1.40'),
      dev('ap', 'Enterprise AP', 'access_point', 480, 220, '192.168.1.2', { wifi: { ssid: 'CorpNet', security: 'wpa2-enterprise', clients: ['Phone'] } }),
      dev('rad', 'RADIUS Server', 'server_rack', 820, 220, '10.0.0.50', { openPorts: [1812] }),
    ],
    links: [lnk('l1', 'ph', 'ap'), lnk('l2', 'ap', 'rad')],
    onSolve: (engine) => engine.execCommand('ph', 'ping 10.0.0.50 -c 2'),
  },
  {
    id: 'lab-17-mail-flow',
    number: 17,
    title: 'End-to-End Mail Flow (SMTP + MX + IMAP)',
    category: 'Application',
    description: 'Sender resolves MX record, delivers via SMTP, and recipient picks up mail via IMAP.',
    goals: ['Run `dig recipient.org MX` on Sender', 'Check port 25/993 connectivity'],
    hints: ['SMTP pushes outbound mail; IMAP syncs inbound mailboxes'],
    solutionSummary: 'DNS MX + SMTP + IMAP form the complete email delivery chain.',
    devices: [
      dev('alice', 'Alice PC', 'host', 130, 220, '192.168.1.10', { dnsServer: '8.8.8.8' }),
      dev('dns', 'DNS (MX)', 'dns_server', 480, 100, '8.8.8.8', { services: { dns: { enabled: true, role: 'recursive', records: [{ name: 'recipient.org', type: 'MX', value: '198.51.100.25', ttl: 300 }] } } }),
      dev('mta', 'Mail Server', 'mail_server', 480, 310, '198.51.100.25', { openPorts: [25, 587, 993] }),
      dev('bob', 'Bob Phone', 'phone', 830, 220, '192.168.2.20'),
    ],
    links: [lnk('l1', 'alice', 'dns'), lnk('l2', 'alice', 'mta'), lnk('l3', 'mta', 'bob')],
    onSolve: (engine) => `${engine.execCommand('alice', 'dig recipient.org MX')}\n${engine.execCommand('bob', 'telnet 198.51.100.25 993')}`,
  },
  {
    id: 'lab-18-industrial-modbus',
    number: 18,
    title: 'Industrial OT Network & Modbus PLC',
    category: 'OT / ICS',
    description: 'Segment SCADA HMI and Modbus TCP PLC (port 502) behind an OT firewall.',
    goals: ['Allow HMI -> PLC TCP/502 while blocking Guest Laptop -> PLC TCP/502'],
    hints: ['Check `telnet 10.10.2.50 502` from both HMI and Guest'],
    solutionSummary: 'OT Firewall restricts Modbus TCP port 502 strictly to authorized SCADA HMIs.',
    devices: [
      dev('hmi', 'SCADA HMI', 'host', 140, 130, '10.10.1.5'),
      dev('guest', 'Guest Laptop', 'host', 140, 310, '192.168.1.99'),
      dev('fw', 'OT Firewall', 'firewall', 480, 220, '10.10.1.1', {
        firewallRules: [
          { id: 'ot1', action: 'allow', direction: 'inbound', protocol: 'TCP', srcIp: '10.10.1.5', dstIp: '10.10.2.50', dstPort: 502 },
          { id: 'ot2', action: 'deny', direction: 'inbound', protocol: 'TCP', srcIp: 'any', dstIp: '10.10.2.50', dstPort: 502 },
        ],
      }),
      dev('plc', 'Factory PLC', 'plc', 830, 220, '10.10.2.50', { openPorts: [502] }),
    ],
    links: [lnk('l1', 'hmi', 'fw'), lnk('l2', 'guest', 'fw'), lnk('l3', 'fw', 'plc')],
    onSolve: (engine) => `${engine.execCommand('hmi', 'telnet 10.10.2.50 502')}\n${engine.execCommand('guest', 'telnet 10.10.2.50 502')}`,
  },
  {
    id: 'lab-19-routing-loop',
    number: 19,
    title: 'Routing Loop & TTL Expiry',
    category: 'Troubleshooting',
    description: 'Misconfigured static routes bounce packets between R1 and R2 until TTL hits 0.',
    goals: ['Detect loop warning in Topology Validator', 'Run `ping -t 4 10.99.99.1` to see ICMP TTL Exceeded'],
    hints: ['Fix R2’s route for 10.99.99.0/24 to point away from R1'],
    solutionSummary: 'TTL prevents infinite Layer 3 forwarding loops by triggering ICMP Type 11.',
    devices: [
      dev('h', 'Test Host', 'host', 140, 220, '192.168.1.10'),
      dev('r1', 'Router 1', 'router', 480, 220, '192.168.1.1', {
        routingTable: [{ network: '10.99.99.0', mask: '255.255.255.0', nextHop: '10.0.0.2', iface: 'eth0', metric: 1, protocol: 'static' }],
      }),
      dev('r2', 'Router 2', 'router', 820, 220, '10.0.0.2', {
        routingTable: [{ network: '10.99.99.0', mask: '255.255.255.0', nextHop: '192.168.1.1', iface: 'eth0', metric: 1, protocol: 'static' }],
      }),
    ],
    links: [lnk('l1', 'h', 'r1'), lnk('l2', 'r1', 'r2')],
    onSolve: (engine) => engine.execCommand('h', 'ping 10.0.0.2 -t 1 -c 2'),
  },
  {
    id: 'lab-20-mtu-fragmentation',
    number: 20,
    title: 'MTU Mismatch & IP Fragmentation / PMTUD',
    category: 'Troubleshooting',
    description: 'A 576-byte tunnel link sits in the path; send a 1400-byte ping and watch PMTUD / fragmentation.',
    goals: ['Run `ping 203.0.113.10 -s 1400` on Host', 'Observe ICMP Fragmentation Needed (MTU 576)'],
    hints: ['Set DF=0 to allow IPv4 fragmentation or lower MTU / MSS clamping'],
    solutionSummary: 'PMTUD discovers bottleneck MTU 576 via ICMP Type 3 Code 4.',
    devices: [
      dev('h', 'Sender Host', 'host', 140, 220, '192.168.1.10', { interfaces: [createDefaultInterface('eth0', 'eth0', '192.168.1.10', '255.255.255.0', '192.168.1.1', 'h1')] }),
      dev('r', 'Tunnel Router', 'router', 480, 220, '192.168.1.1'),
      dev('dst', 'Remote Server', 'web_server', 820, 220, '203.0.113.10'),
    ],
    links: [lnk('l1', 'h', 'r', { mtu: 1500 }), lnk('l2', 'r', 'dst', { mtu: 576 })],
    onSolve: (engine) => engine.execCommand('h', 'ping 203.0.113.10 -s 1400 -c 1'),
  },
];

export const BREAK_IT_CHALLENGES: PresetLab[] = [
  {
    id: 'break-1-gateway',
    number: 1,
    title: '🔧 Break-It: Broken Default Gateway',
    category: 'Break-It Challenge',
    description: 'Host 1 cannot reach the Internet Web Server. A junior admin misconfigured the network interface. Diagnose the fault with CLI or inspector, correct it, and restore connectivity!',
    goals: [
      'Observe ping 203.0.113.10 failing on Host 1',
      'Inspect Host 1 interface and identify the invalid gateway',
      'Fix the Gateway to 192.168.1.1 and verify successful ping',
    ],
    hints: [
      'Check Host 1 interface gateway with `ifconfig` or the Properties Inspector',
      'The gateway is set to 192.168.1.254, but Router IP is 192.168.1.1',
    ],
    solutionSummary: 'Host 1 gateway corrected from 192.168.1.254 to 192.168.1.1. Packets can now traverse the border router.',
    devices: [
      dev('h1', 'Host 1 (Faulty)', 'host', 140, 220, '192.168.1.10', {
        interfaces: [createDefaultInterface('eth0', 'eth0', '192.168.1.10', '255.255.255.0', '192.168.1.254', 'h1')],
      }),
      dev('r1', 'Border Router', 'router', 480, 220, '192.168.1.1', {
        interfaces: [
          createDefaultInterface('eth0', 'lan0', '192.168.1.1', '255.255.255.0', undefined, 'r1'),
          createDefaultInterface('eth1', 'wan0', '198.51.100.1', '255.255.255.0', undefined, 'r2'),
        ],
      }),
      dev('srv', 'Internet Web Server', 'web_server', 820, 220, '203.0.113.10', {
        interfaces: [createDefaultInterface('eth0', 'eth0', '203.0.113.10', '255.255.255.0', '198.51.100.1', 's1')],
      }),
    ],
    links: [lnk('l1', 'h1', 'r1'), lnk('l2', 'r1', 'srv')],
    onSolve: (engine) => engine.execCommand('h1', 'ping 203.0.113.10 -c 2'),
  },
  {
    id: 'break-2-acl',
    number: 2,
    title: '🔧 Break-It: Accidental Firewall Port Drop',
    category: 'Break-It Challenge',
    description: 'Clients can ping the Web Server, but HTTP connections to port 80 are timing out. The router firewall has a blocking ACL rule! Find and remove the block.',
    goals: [
      'Observe that ICMP ping succeeds but HTTP port 80 fails',
      'Inspect Firewall ACL rules on the Firewall Router',
      'Remove or modify the DENY TCP 80 rule to restore web traffic',
    ],
    hints: [
      'Click on Firewall Router in Pro mode to view Firewall ACL Rules',
      'Delete the rule blocking TCP port 80 or change action to ALLOW',
    ],
    solutionSummary: 'Removed blocking DENY rule on port 80. HTTP web traffic flow restored.',
    devices: [
      dev('client', 'Client PC', 'host', 140, 220, '192.168.1.50', {
        interfaces: [createDefaultInterface('eth0', 'eth0', '192.168.1.50', '255.255.255.0', '192.168.1.1', 'c1')],
      }),
      dev('fw', 'Firewall Router', 'firewall', 480, 220, '192.168.1.1', {
        firewallRules: [
          { id: 'fw-block-80', action: 'deny', direction: 'both', protocol: 'TCP', srcIp: 'any', dstIp: 'any', dstPort: 80 },
        ],
      }),
      dev('web', 'Company Web Server', 'web_server', 820, 220, '192.168.1.100'),
    ],
    links: [lnk('l1', 'client', 'fw'), lnk('l2', 'fw', 'web')],
    onSolve: (engine) => engine.execCommand('client', 'ping 192.168.1.100 -c 1'),
  },
  {
    id: 'break-3-mask',
    number: 3,
    title: '🔧 Break-It: Subnet Mask Isolation',
    category: 'Break-It Challenge',
    description: 'Host A (192.168.1.10) and Host B (192.168.1.75) are connected to the same switch, but Host B is isolated due to an incorrect subnet mask. Align the masks!',
    goals: [
      'Test `ping 192.168.1.75` from Host A',
      'Identify why Host B considers Host A outside its subnet',
      'Correct Host B subnet mask from 255.255.255.240 (/28) to 255.255.255.0 (/24)',
    ],
    hints: [
      'Host B mask 255.255.255.240 limits its subnet to 192.168.1.64 - 192.168.1.79',
      'Align Host B subnet mask to 255.255.255.0',
    ],
    solutionSummary: 'Subnet mask adjusted to /24. Both hosts are now in the same broadcast domain and ARP succeeds.',
    devices: [
      dev('ha', 'Host A', 'host', 140, 220, '192.168.1.10', {
        interfaces: [createDefaultInterface('eth0', 'eth0', '192.168.1.10', '255.255.255.0', undefined, 'a1')],
      }),
      dev('sw', 'Workgroup Switch', 'switch', 480, 220, '0.0.0.0'),
      dev('hb', 'Host B (Isolated)', 'host', 820, 220, '192.168.1.75', {
        interfaces: [createDefaultInterface('eth0', 'eth0', '192.168.1.75', '255.255.255.240', undefined, 'b1')],
      }),
    ],
    links: [lnk('l1', 'ha', 'sw'), lnk('l2', 'sw', 'hb')],
    onSolve: (engine) => engine.execCommand('ha', 'ping 192.168.1.75 -c 2'),
  },
];

export const ALL_SIM_LABS: PresetLab[] = [...PRESET_LABS, ...BREAK_IT_CHALLENGES];

