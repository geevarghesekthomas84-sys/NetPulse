import { runPacketTemplates } from '../helpers';
import type { ProtocolEntry, ProtocolLinkDef, ProtocolNodeDef } from '../types';

const basicNodes: ProtocolNodeDef[] = [
  { id: 'client', label: 'Client', ip: '192.168.1.10', role: 'host', x: 160, y: 250 },
  { id: 'router', label: 'Router', ip: '192.168.1.1', role: 'router', x: 500, y: 250 },
  { id: 'server', label: 'App Server', ip: '203.0.113.10', role: 'web_server', x: 840, y: 250 },
];

const basicLinks: ProtocolLinkDef[] = [
  { id: 'l1', sourceId: 'client', targetId: 'router', delayMs: 6 },
  { id: 'l2', sourceId: 'router', targetId: 'server', delayMs: 12 },
];

export const udpProtocol: ProtocolEntry = {
  id: 'udp',
  name: 'UDP',
  fullName: 'User Datagram Protocol',
  category: 'CORE',
  status: 'full',
  layer: 'Layer 4 (Transport)',
  osiLayer: 4,
  defaultPort: 'N/A (Uses Ports 0–65535)',
  transport: 'Runs directly over IPv4 (Proto 17) / IPv6',
  dataFormat: '8-byte Fixed Header + Datagram Payload',
  methods: ['Datagram Send', 'Multicast', 'Broadcast', 'Fire-and-Forget'],
  rfcs: [{ number: 'RFC 768', title: 'User Datagram Protocol', url: 'https://www.rfc-editor.org/rfc/rfc768' }],
  keywords: ['datagram', 'connectionless', 'low latency', 'gaming', 'voip', 'dns', 'quic', 'streaming'],
  description:
    'UDP is a lightweight, connectionless transport protocol with an 8-byte header and zero handshake or retransmission overhead, ideal for real-time audio/video, DNS, and QUIC.',
  eli5: 'UDP is like tossing postcards into a mailbox as fast as you can: no phone call first, no waiting for receipts—fast and lightweight, even if one card blows away in the wind.',
  securityNotes: [
    {
      attack: 'UDP Amplification DDoS',
      description: 'Because UDP has no handshake, attackers spoof the victim’s source IP to trigger huge replies from DNS/NTP/Memcached.',
      defense: 'Enforce BCP 38 source-address validation and disable open unauthenticated UDP reflectors.',
    },
  ],
  nodes: basicNodes,
  links: basicLinks,
  steps: [
    { title: 'Zero-Handshake Send', subtitle: 'Immediate datagram emission (8B header)', caption: 'Application hands data to UDP; no SYN handshake occurs—datagram #1 leaves immediately.', osiLayer: 4 },
    { title: 'Independent Datagrams', subtitle: 'Datagrams #2 & #3 travel without ACK blocking', caption: 'Each datagram is self-contained; packet loss does not stall later packets (no head-of-line blocking).', osiLayer: 4 },
    { title: 'App-Level Handling', subtitle: 'Receiver processes arriving datagrams', caption: 'Receiver reads datagrams from socket buffer; optional app-level sequence checks handle loss.', osiLayer: 4 },
  ],
  whatIfOptions: [{ id: 'packetLoss', label: 'Datagram Dropped', description: 'Show that UDP does not automatically retransmit lost packets' }],
  quiz: [
    { question: 'How large is a standard UDP header?', options: ['8 bytes', '20 bytes', '40 bytes', '60 bytes'], correctIndex: 0, explanation: 'UDP headers contain just 4 two-byte fields: Src Port, Dst Port, Length, and Checksum (8 bytes).' },
    { question: 'Why do online games and VoIP prefer UDP over TCP?', options: ['UDP guarantees zero packet loss', 'UDP avoids handshake and retransmission head-of-line delays', 'UDP encrypts audio automatically', 'UDP ignores IP addresses'], correctIndex: 1, explanation: 'Real-time voice/gaming prefers dropping a stale frame over stalling new frames for TCP retransmissions.' },
    { question: 'What IP protocol number identifies UDP?', options: ['1', '6', '17', '58'], correctIndex: 2, explanation: 'IPv4 Protocol field 17 indicates UDP.' },
  ],
  scenario: (opts = {}) =>
    runPacketTemplates(
      basicNodes,
      basicLinks,
      udpProtocol.steps,
      [
        { stepIndex: 0, fromId: 'client', toId: 'router', protocol: 'UDP', colorCategory: 'udp', info: '55100 -> 9000 Len=128 (Datagram #1)', osiLayer: 4, isUdp: true, srcPort: 55100, dstPort: 9000, sizeBytes: 170 },
        { stepIndex: 0, fromId: 'router', toId: 'server', protocol: 'UDP', colorCategory: 'udp', info: '55100 -> 9000 Len=128 (Datagram #1)', osiLayer: 4, isUdp: true, srcPort: 55100, dstPort: 9000, sizeBytes: 170 },
        { stepIndex: 1, fromId: 'client', toId: 'server', protocol: 'UDP', colorCategory: 'udp', info: '55100 -> 9000 Len=128 (Datagram #2)', osiLayer: 4, isUdp: true, srcPort: 55100, dstPort: 9000, sizeBytes: 170, forceDrop: opts.packetLoss, dropReason: opts.packetLoss ? 'UDP Dropped (No Retransmit)' : undefined },
        { stepIndex: 2, fromId: 'client', toId: 'server', protocol: 'UDP', colorCategory: 'udp', info: '55100 -> 9000 Len=128 (Datagram #3 continues immediately)', osiLayer: 4, isUdp: true, srcPort: 55100, dstPort: 9000, sizeBytes: 170 },
      ],
      opts
    ),
};

export const ipProtocol: ProtocolEntry = {
  id: 'ip',
  name: 'IP (IPv4)',
  fullName: 'Internet Protocol Version 4',
  category: 'CORE',
  status: 'full',
  layer: 'Layer 3 (Network)',
  osiLayer: 3,
  defaultPort: 'N/A (Layer 3)',
  transport: 'Encapsulated in Ethernet / PPP / Fiber frames',
  dataFormat: '20-byte IPv4 Header + L4 Payload (Max 65,535B)',
  methods: ['Longest-Prefix Match', 'TTL Decrement', 'Header Checksum', 'Fragmentation'],
  rfcs: [{ number: 'RFC 791', title: 'Internet Protocol', url: 'https://www.rfc-editor.org/rfc/rfc791' }],
  keywords: ['ipv4', 'routing', 'ttl', 'cidr', 'subnet', 'fragmentation', 'mtu', 'lpm', 'checksum'],
  description:
    'IPv4 is the foundational network-layer protocol that routes packets across interconnected networks using 32-bit addresses, longest-prefix matching, TTL hop limits, and optional MTU fragmentation.',
  eli5: 'IPv4 puts a ZIP code and street address on every envelope and gives it 64 hops to reach its destination; each post office decrements the hop counter and picks the best next road.',
  securityNotes: [
    {
      attack: 'IP Source Spoofing',
      description: 'Senders can forge the 32-bit Source IP header field unless edge networks filter egress traffic.',
      defense: 'Deploy uRPF (Unicast Reverse Path Forwarding) and BCP 38 ingress filtering.',
    },
  ],
  nodes: basicNodes,
  links: basicLinks,
  steps: [
    { title: 'IPv4 Encapsulation', subtitle: '20B Header + RFC 1071 Checksum', caption: 'Host sets Src/Dst IP, TTL=64, DF flag, and computes the 16-bit IPv4 header checksum.', osiLayer: 3 },
    { title: 'Router LPM & TTL-1', subtitle: 'Longest-prefix lookup & checksum update', caption: 'Router decrements TTL (64 -> 63), updates header checksum, and forwards to next hop.', osiLayer: 3 },
    { title: 'MTU Check / Delivery', subtitle: 'Packet arrives or fragments if > MTU', caption: 'Packet arrives at destination; if larger than link MTU, it fragments or returns ICMP Frag Needed.', osiLayer: 3 },
  ],
  whatIfOptions: [
    { id: 'smallMtu', label: 'MTU 576 Fragmentation', description: 'Split 1400B packet into IPv4 fragments (MF=1, Offset)' },
    { id: 'ttlExpired', label: 'TTL=1 Expiry', description: 'Router drops packet and sends ICMP Time Exceeded' },
  ],
  quiz: [
    { question: 'How many bits are in an IPv4 address?', options: ['16 bits', '32 bits', '64 bits', '128 bits'], correctIndex: 1, explanation: 'IPv4 addresses are 32-bit integers usually written as four dotted octets.' },
    { question: 'What happens at every Layer 3 router as an IPv4 packet is forwarded?', options: ['Source IP changes to router IP', 'TTL is decremented by 1 and header checksum is recomputed', 'TCP port changes', 'MAC table is wiped'], correctIndex: 1, explanation: 'Routers decrement TTL to prevent infinite loops and update the IPv4 header checksum.' },
    { question: 'Which matching rule do routers use when multiple routes match a destination IP?', options: ['First match', 'Longest-Prefix Match (most specific mask)', 'Shortest subnet mask', 'Random'], correctIndex: 1, explanation: 'LPM picks the route with the highest prefix length (e.g. /24 beats /16).' },
  ],
  scenario: (opts = {}) =>
    runPacketTemplates(
      basicNodes,
      basicLinks,
      ipProtocol.steps,
      [
        { stepIndex: 0, fromId: 'client', toId: 'router', protocol: 'IPv4', colorCategory: 'routing', info: 'IPv4 Src=192.168.1.10 Dst=203.0.113.10 TTL=64 Len=1400', osiLayer: 3, ttl: 64, sizeBytes: 1400 },
        { stepIndex: 1, fromId: 'router', toId: 'server', protocol: 'IPv4', colorCategory: 'routing', info: opts.smallMtu ? 'IPv4 Frag #1 (MF=1, Offset=0, Len=568)' : 'IPv4 Forwarded TTL=63 Len=1400', osiLayer: 3, ttl: 63, sizeBytes: opts.smallMtu ? 568 : 1400 },
        ...(opts.smallMtu
          ? [{ stepIndex: 2, fromId: 'router', toId: 'server', protocol: 'IPv4', colorCategory: 'routing' as const, info: 'IPv4 Frag #2 (MF=1, Offset=544, Len=568)', osiLayer: 3, ttl: 63, sizeBytes: 568 }]
          : []),
      ],
      opts
    ),
};

const ipv6Nodes: ProtocolNodeDef[] = [
  { id: 'client', label: 'IPv6 Host', ip: '2001:db8:1::10', role: 'host', x: 160, y: 250 },
  { id: 'router', label: 'IPv6 Router', ip: '2001:db8:1::1', role: 'router', x: 500, y: 250 },
  { id: 'server', label: 'IPv6 Server', ip: '2001:db8:2::80', role: 'web_server', x: 840, y: 250 },
];

export const ipv6Protocol: ProtocolEntry = {
  id: 'ipv6',
  name: 'IPv6',
  fullName: 'Internet Protocol Version 6',
  category: 'CORE',
  status: 'full',
  layer: 'Layer 3 (Network)',
  osiLayer: 3,
  defaultPort: 'N/A (EtherType 0x86DD)',
  transport: 'Layer 2 Framing',
  dataFormat: 'Fixed 40-byte Header + Extension Headers + Payload',
  methods: ['SLAAC (RS/RA)', 'Neighbor Solicitation (NDP)', 'Neighbor Advertisement', 'Global Unicast'],
  rfcs: [{ number: 'RFC 8200', title: 'Internet Protocol, Version 6 (IPv6)', url: 'https://www.rfc-editor.org/rfc/rfc8200' }],
  keywords: ['128-bit', 'slaac', 'ndp', 'icmpv6', 'ra', 'rs', 'fe80', 'link-local', 'no nat'],
  description:
    'IPv6 expands address space to 128 bits, eliminates NAT necessity, streamlines routing with a fixed 40-byte header (no header checksum), and replaces ARP with ICMPv6 Neighbor Discovery (NDP) and SLAAC.',
  eli5: 'IPv6 gives every grain of sand on Earth billions of unique street addresses, and lets devices automatically configure their own address without needing a middleman.',
  securityNotes: [
    {
      attack: 'Rogue Router Advertisement (RA Spoofing)',
      description: 'An attacker sends fake ICMPv6 Router Advertisements to hijack default gateway routing on a LAN.',
      defense: 'Enable RA Guard on Layer 2 switches to drop RAs on untrusted access ports.',
    },
  ],
  nodes: ipv6Nodes,
  links: basicLinks,
  steps: [
    { title: 'Router Solicitation / Advertisement', subtitle: 'SLAAC prefix discovery (ICMPv6 133/134)', caption: 'Host queries ff02::2 and Router announces prefix 2001:db8:1::/64 for stateless auto-config.', osiLayer: 3 },
    { title: 'Neighbor Discovery (NDP)', subtitle: 'Replaces IPv4 ARP using multicast', caption: 'Host sends ICMPv6 Neighbor Solicitation (135) to resolve next-hop link-layer MAC.', osiLayer: 3 },
    { title: 'IPv6 Packet Forwarding', subtitle: 'Fixed 40B header, Hop Limit=64->63', caption: 'IPv6 traffic flows using 128-bit addresses with Next Header chaining.', osiLayer: 3 },
  ],
  whatIfOptions: [{ id: 'packetLoss', label: 'Packet Too Big (PMTUDv6)', description: 'IPv6 routers never fragment; return ICMPv6 Type 2' }],
  quiz: [
    { question: 'How many bits is an IPv6 address?', options: ['32 bits', '64 bits', '128 bits', '256 bits'], correctIndex: 2, explanation: 'IPv6 uses 128-bit addresses written as eight 16-bit hexadecimal groups.' },
    { question: 'Which mechanism replaces ARP in IPv6?', options: ['DHCPv4', 'ICMPv6 Neighbor Discovery Protocol (NDP)', 'BGP', 'IGMP'], correctIndex: 1, explanation: 'IPv6 uses ICMPv6 Neighbor Solicitation and Advertisement instead of ARP broadcasts.' },
    { question: 'Do IPv6 routers fragment packets in transit?', options: ['Yes, always', 'No, only the source host fragments after ICMPv6 Packet Too Big', 'Only on port 80', 'Yes, every 576B'], correctIndex: 1, explanation: 'IPv6 eliminates router fragmentation for faster forwarding.' },
  ],
  scenario: (opts = {}) =>
    runPacketTemplates(
      ipv6Nodes,
      basicLinks,
      ipv6Protocol.steps,
      [
        { stepIndex: 0, fromId: 'client', toId: 'router', protocol: 'ICMPv6', colorCategory: 'icmp', info: 'Router Solicitation (ff02::2)', osiLayer: 3, isIpv6: true, isIcmp: { type: 133, code: 0, message: 'RS' }, sizeBytes: 70 },
        { stepIndex: 0, fromId: 'router', toId: 'client', protocol: 'ICMPv6', colorCategory: 'icmp', info: 'Router Advertisement (Prefix 2001:db8:1::/64, SLAAC)', osiLayer: 3, isIpv6: true, isIcmp: { type: 134, code: 0, message: 'RA' }, sizeBytes: 110 },
        { stepIndex: 1, fromId: 'client', toId: 'router', protocol: 'ICMPv6', colorCategory: 'l2', info: 'Neighbor Solicitation for 2001:db8:1::1', osiLayer: 3, isIpv6: true, isIcmp: { type: 135, code: 0, message: 'NS' }, sizeBytes: 86 },
        { stepIndex: 1, fromId: 'router', toId: 'client', protocol: 'ICMPv6', colorCategory: 'l2', info: 'Neighbor Advertisement (MAC 02:42:ac:11:00:0b)', osiLayer: 3, isIpv6: true, isIcmp: { type: 136, code: 0, message: 'NA' }, sizeBytes: 86 },
        { stepIndex: 2, fromId: 'client', toId: 'server', protocol: 'IPv6', colorCategory: 'tcp', info: 'IPv6 TCP SYN 2001:db8:1::10 -> 2001:db8:2::80', osiLayer: 4, isIpv6: true, tcpFlags: { syn: true }, sizeBytes: 86 },
      ],
      opts
    ),
};

export const igmpProtocol: ProtocolEntry = {
  id: 'igmp',
  name: 'IGMP',
  fullName: 'Internet Group Management Protocol (v3)',
  category: 'CORE',
  status: 'partial',
  layer: 'Layer 3 (Network Control)',
  osiLayer: 3,
  defaultPort: 'N/A (IP Protocol 2)',
  transport: 'IPv4 (TTL=1)',
  dataFormat: '8–16 Byte IGMP Membership Report/Query',
  methods: ['Membership Query', 'Join Group (Report)', 'Leave Group'],
  rfcs: [{ number: 'RFC 3376', title: 'Internet Group Management Protocol, Version 3', url: 'https://www.rfc-editor.org/rfc/rfc3376' }],
  keywords: ['multicast', '224.0.0.0', 'iptv', 'snooping', 'group', 'join', 'leave'],
  description:
    'IGMP lets IPv4 hosts join and leave IP multicast groups (224.0.0.0/4) so routers and IGMP-snooping switches only forward live video/IPTV streams to interested receivers.',
  eli5: 'Instead of mailing 1,000 copies of a TV broadcast to everyone on the street, IGMP lets houses put up a flag saying "Deliver Channel 5 here!"',
  securityNotes: [
    {
      attack: 'IGMP Flooding / Rogue Group Join',
      description: 'An attacker joins many multicast streams to saturate switch/access links.',
      defense: 'Enable IGMP Snooping and limit max multicast groups per switch port.',
    },
  ],
  nodes: basicNodes,
  links: basicLinks,
  steps: [
    { title: 'Router Query', subtitle: 'Router polls 224.0.0.1 for active listeners', caption: 'Multicast router sends periodic IGMP General Query to all-hosts 224.0.0.1.', osiLayer: 3 },
    { title: 'Host Join Report', subtitle: 'Host joins multicast group 239.1.1.5', caption: 'TV Box / Client sends IGMPv3 Membership Report joining 239.1.1.5.', osiLayer: 3 },
    { title: 'Multicast Stream & Leave', subtitle: 'Stream flows until host sends Leave', caption: 'Server streams multicast UDP to 239.1.1.5; host later sends Leave to prune traffic.', osiLayer: 3 },
  ],
  whatIfOptions: [{ id: 'packetLoss', label: 'Leave Lost', description: 'Router waits for group-specific query timeout before pruning' }],
  quiz: [
    { question: 'What is the IPv4 multicast address range?', options: ['10.0.0.0/8', '172.16.0.0/12', '224.0.0.0/4', '192.168.0.0/16'], correctIndex: 2, explanation: '224.0.0.0 through 239.255.255.255 (Class D) is reserved for IPv4 multicast.' },
    { question: 'What does IGMP Snooping on a switch prevent?', options: ['DNS caching', 'Multicast flooding out ports with no interested listeners', 'TCP slow start', 'ARP replies'], correctIndex: 1, explanation: 'IGMP snooping listens to Join/Leave messages so multicast only goes to subscribed ports.' },
    { question: 'Which IP protocol number does IGMP use?', options: ['1', '2', '6', '17'], correctIndex: 1, explanation: 'IGMP uses IPv4 protocol number 2.' },
  ],
  scenario: (opts = {}) =>
    runPacketTemplates(
      basicNodes,
      basicLinks,
      igmpProtocol.steps,
      [
        { stepIndex: 0, fromId: 'router', toId: 'client', protocol: 'IGMP', colorCategory: 'routing', info: 'IGMPv3 Membership Query, General (224.0.0.1)', osiLayer: 3, isIcmp: { type: 0x11, code: 0, message: 'IGMP Query' }, sizeBytes: 60 },
        { stepIndex: 1, fromId: 'client', toId: 'router', protocol: 'IGMP', colorCategory: 'routing', info: 'Membership Report: JOIN group 239.1.1.5', osiLayer: 3, isIcmp: { type: 0x22, code: 0, message: 'JOIN 239.1.1.5' }, sizeBytes: 64 },
        { stepIndex: 2, fromId: 'server', toId: 'client', protocol: 'UDP', colorCategory: 'udp', info: 'Multicast Stream -> 239.1.1.5:5004 (Video)', osiLayer: 4, isUdp: true, srcPort: 5004, dstPort: 5004, sizeBytes: 1316 },
        { stepIndex: 2, fromId: 'client', toId: 'router', protocol: 'IGMP', colorCategory: 'routing', info: 'Leave Group 239.1.1.5 (Block Old Sources)', osiLayer: 3, isIcmp: { type: 0x22, code: 0, message: 'LEAVE 239.1.1.5' }, sizeBytes: 64 },
      ],
      opts
    ),
};

const ntpNodes: ProtocolNodeDef[] = [
  { id: 'client', label: 'Client Host', ip: '192.168.1.10', role: 'host', x: 180, y: 250 },
  { id: 'ntp', label: 'Stratum-1 NTP', ip: '216.239.35.0', role: 'server_rack', x: 820, y: 250, openPorts: [123] },
];

export const ntpProtocol: ProtocolEntry = {
  id: 'ntp',
  name: 'NTP',
  fullName: 'Network Time Protocol (v4)',
  category: 'CORE',
  status: 'full',
  layer: 'Layer 7 (Application)',
  osiLayer: 7,
  defaultPort: '123',
  transport: 'UDP',
  dataFormat: '48-byte Fixed Binary Timestamps (T1, T2, T3, T4)',
  methods: ['Client Request (Mode 3)', 'Server Response (Mode 4)', 'Offset & RTT Calculation'],
  rfcs: [{ number: 'RFC 5905', title: 'Network Time Protocol Version 4', url: 'https://www.rfc-editor.org/rfc/rfc5905' }],
  keywords: ['time', 'clock', '123', 'stratum', 't1 t2 t3 t4', 'offset', 'synchronization'],
  description:
    'NTP synchronizes computer clocks across variable-latency networks down to milliseconds by exchanging four timestamps (T1, T2, T3, T4) to separate network delay from true clock offset.',
  eli5: 'You write down when you sent a text (T1), your friend writes when they got it (T2) and replied (T3), and you note when you got the reply (T4) so you can cancel out delivery delay and set your watch accurately.',
  securityNotes: [
    {
      attack: 'NTP Monlist Amplification',
      description: 'Legacy NTP servers responded to tiny mode-7 monlist queries with massive client lists, enabling 500x DDoS amplification.',
      defense: 'Disable `monlist`, restrict control queries, and use NTS (Network Time Security, RFC 8915).',
    },
  ],
  nodes: ntpNodes,
  links: [{ id: 'l1', sourceId: 'client', targetId: 'ntp', delayMs: 18 }],
  steps: [
    { title: 'Client Transmit (T1)', subtitle: 'Mode 3 Client request stamps T1', caption: 'Client records local originate timestamp T1 and sends 48-byte UDP/123 packet.', osiLayer: 7 },
    { title: 'Server Timestamps (T2, T3)', subtitle: 'Mode 4 Server stamps receive & transmit', caption: 'Stratum-1 server records arrival T2 and departure T3 in 64-bit NTP fixed-point format.', osiLayer: 7 },
    { title: 'Offset Calculation (T4)', subtitle: 'Offset = ((T2-T1)+(T3-T4))/2', caption: 'Client records T4, computes symmetric round-trip delay and slews system clock smoothly.', osiLayer: 7 },
  ],
  whatIfOptions: [{ id: 'packetLoss', label: 'Asymmetric Delay Spike', description: 'Delay increases RTT variance; NTP filters outlier sample' }],
  quiz: [
    { question: 'Which UDP port does NTP use?', options: ['53', '67', '123', '161'], correctIndex: 2, explanation: 'NTP operates over UDP port 123.' },
    { question: 'How many timestamps does NTP use to compute clock offset and network delay?', options: ['1', '2', '4 (T1, T2, T3, T4)', '8'], correctIndex: 2, explanation: 'T1 (client send), T2 (server recv), T3 (server send), T4 (client recv) cancel out symmetric RTT.' },
    { question: 'What does Stratum 1 mean in NTP?', options: ['A server directly attached to an atomic/GPS reference clock', 'A broken clock', 'A local browser clock', 'Hop count 16'], correctIndex: 0, explanation: 'Stratum 0 is an atomic/GPS clock; Stratum 1 servers sync directly to Stratum 0.' },
  ],
  scenario: (opts = {}) =>
    runPacketTemplates(
      ntpNodes,
      [{ id: 'l1', sourceId: 'client', targetId: 'ntp', delayMs: 18 }],
      ntpProtocol.steps,
      [
        {
          stepIndex: 0, fromId: 'client', toId: 'ntp', protocol: 'NTP', colorCategory: 'udp',
          info: 'NTPv4 Client (Mode 3) Transmit T1=1731680000.100', osiLayer: 7, isUdp: true, srcPort: 51123, dstPort: 123, sizeBytes: 90,
          app: { protocolName: 'NTP', summary: 'Mode 3 Client', fields: [{ key: 'Originate T1', value: '1731680000.100s' }, { key: 'Stratum', value: '0 (unspecified)' }] },
        },
        {
          stepIndex: 1, fromId: 'ntp', toId: 'client', protocol: 'NTP', colorCategory: 'udp',
          info: 'NTPv4 Server (Stratum 1, T2=.118, T3=.119) -> Offset -1.5ms', osiLayer: 7, isUdp: true, srcPort: 123, dstPort: 51123, sizeBytes: 90,
          app: { protocolName: 'NTP', summary: 'Mode 4 Server', fields: [{ key: 'Stratum', value: '1 (GPS/Atomic)' }, { key: 'T2 Receive', value: '.118s' }, { key: 'T3 Transmit', value: '.119s' }, { key: 'Computed Offset', value: '-1.5 ms' }] },
        },
      ],
      opts
    ),
};
