import { runPacketTemplates } from '../helpers';
import type { ProtocolEntry, ProtocolLinkDef, ProtocolNodeDef, ProtocolStepDef } from '../types';

const nodes: ProtocolNodeDef[] = [
  { id: 'client', label: 'Client (0.0.0.0)', ip: '0.0.0.0', role: 'host', x: 140, y: 250, mac: '02:42:ac:11:00:aa' },
  { id: 'switch', label: 'LAN Switch', ip: '192.168.1.2', role: 'switch', x: 480, y: 250, mac: '02:42:ac:11:00:02' },
  { id: 'dhcp', label: 'DHCP Server', ip: '192.168.1.1', role: 'dhcp_server', x: 820, y: 250, mac: '02:42:ac:11:00:01', openPorts: [67] },
];

const links: ProtocolLinkDef[] = [
  { id: 'l1', sourceId: 'client', targetId: 'switch', delayMs: 4 },
  { id: 'l2', sourceId: 'switch', targetId: 'dhcp', delayMs: 4 },
];

const steps: ProtocolStepDef[] = [
  { title: 'DISCOVER', subtitle: 'Client broadcasts DHCPDISCOVER', caption: 'Client with IP 0.0.0.0 sends UDP broadcast (68 -> 67) asking for any DHCP server on the LAN.', osiLayer: 7 },
  { title: 'OFFER', subtitle: 'Server offers 192.168.1.50', caption: 'DHCP server reserves 192.168.1.50 from its pool and sends DHCPOFFER with subnet mask, gateway, and DNS.', osiLayer: 7 },
  { title: 'REQUEST', subtitle: 'Client accepts offered IP', caption: 'Client broadcasts DHCPREQUEST confirming it accepts 192.168.1.50 from server 192.168.1.1.', osiLayer: 7 },
  { title: 'ACK', subtitle: 'Server commits lease (86400s)', caption: 'Server sends DHCPACK finalizing the 24-hour lease; client runs gratuitous ARP and configures eth0.', osiLayer: 7 },
];

export const dhcpProtocol: ProtocolEntry = {
  id: 'dhcp',
  name: 'DHCP',
  fullName: 'Dynamic Host Configuration Protocol',
  category: 'CORE',
  status: 'full',
  layer: 'Layer 7 (Application) / UDP Transport',
  osiLayer: 7,
  defaultPort: '67 (Server), 68 (Client)',
  transport: 'UDP',
  dataFormat: 'BOOTP-derived Binary Options (TLV)',
  methods: ['DISCOVER', 'OFFER', 'REQUEST', 'ACK', 'NAK', 'RELEASE', 'INFORM'],
  rfcs: [
    { number: 'RFC 2131', title: 'Dynamic Host Configuration Protocol', url: 'https://www.rfc-editor.org/rfc/rfc2131' },
    { number: 'RFC 2132', title: 'DHCP Options and BOOTP Vendor Extensions', url: 'https://www.rfc-editor.org/rfc/rfc2132' },
  ],
  keywords: ['dora', 'lease', 'ip assignment', 'broadcast', '67', '68', 'gateway', 'subnet'],
  description:
    'DHCP automatically assigns IPv4 addresses, subnet masks, default gateways, and DNS servers to devices joining a network through the 4-step DORA handshake.',
  eli5: 'When a new kid joins class without a seat, they shout "Does anyone have a spare desk?" (Discover), the teacher points to Desk 50 (Offer), the kid says "I’ll take Desk 50!" (Request), and the teacher writes their name down (Ack).',
  securityNotes: [
    {
      attack: 'Rogue DHCP Server',
      description: 'An attacker answers DISCOVER faster than the real router, handing out their own IP as default gateway/DNS for MITM.',
      defense: 'Enable DHCP Snooping on switches to block DHCPOFFER packets on untrusted access ports.',
    },
    {
      attack: 'DHCP Starvation',
      description: 'Flooding DISCOVER requests with spoofed MAC addresses exhausts the entire IP pool.',
      defense: 'Configure port security MAC limits and DHCP snooping rate limits.',
    },
  ],
  nodes,
  links,
  steps,
  whatIfOptions: [
    { id: 'packetLoss', label: 'OFFER Lost (Retry)', description: 'Drop first DHCPOFFER and observe client retry' },
    { id: 'serverDown', label: 'DHCP Server Down (APIPA)', description: 'No DHCP server responds; client falls back to 169.254.x.x' },
  ],
  quiz: [
    {
      question: 'What does the acronym DORA stand for in DHCP?',
      options: ['Data, Order, Route, Ack', 'Discover, Offer, Request, Acknowledge', 'Domain, Origin, Relay, Address', 'Dynamic, Open, Reserve, Assign'],
      correctIndex: 1,
      explanation: 'DORA represents the four standard DHCP messages: DISCOVER, OFFER, REQUEST, ACK.',
    },
    {
      question: 'Which UDP ports do DHCP servers and clients use?',
      options: ['53 and 54', '67 and 68', '80 and 443', '161 and 162'],
      correctIndex: 1,
      explanation: 'Servers listen on UDP port 67 and clients listen on UDP port 68.',
    },
    {
      question: 'Why does the client send DHCPREQUEST as a broadcast even after receiving an offer?',
      options: ['To inform all other DHCP servers whose offers were declined', 'Because UDP does not support unicast', 'To trigger DNS caching', 'To increment TTL'],
      correctIndex: 0,
      explanation: 'Broadcasting REQUEST lets competing DHCP servers withdraw their unchosen offers.',
    },
    {
      question: 'Which switch feature defends against rogue DHCP servers?',
      options: ['Port Forwarding', 'DHCP Snooping', 'Jumbo Frames', 'Nagle Algorithm'],
      correctIndex: 1,
      explanation: 'DHCP Snooping drops server-side DHCP messages arriving on untrusted user ports.',
    },
    {
      question: 'What happens if no DHCP server responds on a Windows/macOS host?',
      options: ['The network card shuts down', 'The host assigns an APIPA link-local IP (169.254.x.x)', 'It steals 192.168.1.1', 'It sends a TCP RST'],
      correctIndex: 1,
      explanation: 'RFC 3927 APIPA assigns a 169.254.0.0/16 address when DHCP times out.',
    },
  ],
  scenario: (opts = {}) => {
    const templates = [
      {
        stepIndex: 0, fromId: 'client', toId: 'switch', protocol: 'DHCP', colorCategory: 'udp' as const,
        info: 'DHCP Discover - Transaction ID 0x9f12a001 (Broadcast)', osiLayer: 7, isUdp: true, srcPort: 68, dstPort: 67, sizeBytes: 342,
        app: { protocolName: 'DHCP', summary: 'DHCPDISCOVER', fields: [{ key: 'Message Type', value: '1 (Discover)' }, { key: 'Client MAC', value: '02:42:ac:11:00:aa' }] },
      },
      {
        stepIndex: 0, fromId: 'switch', toId: 'dhcp', protocol: 'DHCP', colorCategory: 'udp' as const,
        info: 'DHCP Discover (Flooded to Server Port)', osiLayer: 7, isUdp: true, srcPort: 68, dstPort: 67, sizeBytes: 342,
        app: { protocolName: 'DHCP', summary: 'DHCPDISCOVER', fields: [{ key: 'Message Type', value: '1 (Discover)' }] },
      },
      {
        stepIndex: 1, fromId: 'dhcp', toId: 'switch', protocol: 'DHCP', colorCategory: 'udp' as const,
        info: 'DHCP Offer - Offered IP 192.168.1.50 (Lease 86400s)', osiLayer: 7, isUdp: true, srcPort: 67, dstPort: 68, sizeBytes: 350,
        app: { protocolName: 'DHCP', summary: 'DHCPOFFER 192.168.1.50', fields: [{ key: 'Your IP', value: '192.168.1.50' }, { key: 'Subnet Mask', value: '255.255.255.0' }, { key: 'Router', value: '192.168.1.1' }, { key: 'DNS', value: '8.8.8.8' }] },
      },
      {
        stepIndex: 1, fromId: 'switch', toId: 'client', protocol: 'DHCP', colorCategory: 'udp' as const,
        info: 'DHCP Offer - Offered IP 192.168.1.50', osiLayer: 7, isUdp: true, srcPort: 67, dstPort: 68, sizeBytes: 350,
        app: { protocolName: 'DHCP', summary: 'DHCPOFFER 192.168.1.50', fields: [{ key: 'Your IP', value: '192.168.1.50' }] },
      },
      {
        stepIndex: 2, fromId: 'client', toId: 'dhcp', protocol: 'DHCP', colorCategory: 'udp' as const,
        info: 'DHCP Request - Requesting 192.168.1.50 from 192.168.1.1', osiLayer: 7, isUdp: true, srcPort: 68, dstPort: 67, sizeBytes: 348,
        app: { protocolName: 'DHCP', summary: 'DHCPREQUEST 192.168.1.50', fields: [{ key: 'Requested IP', value: '192.168.1.50' }, { key: 'Server ID', value: '192.168.1.1' }] },
      },
      {
        stepIndex: 3, fromId: 'dhcp', toId: 'client', protocol: 'DHCP', colorCategory: 'udp' as const,
        info: 'DHCP ACK - Lease confirmed 192.168.1.50/24', osiLayer: 7, isUdp: true, srcPort: 67, dstPort: 68, sizeBytes: 356,
        app: { protocolName: 'DHCP', summary: 'DHCPACK 192.168.1.50', fields: [{ key: 'Assigned IP', value: '192.168.1.50' }, { key: 'Lease Time', value: '86400 seconds' }] },
      },
    ];
    return runPacketTemplates(nodes, links, steps, templates, opts);
  },
};
