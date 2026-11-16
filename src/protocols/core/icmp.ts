import { runPacketTemplates } from '../helpers';
import type { ProtocolEntry, ProtocolLinkDef, ProtocolNodeDef, ProtocolStepDef } from '../types';

const nodes: ProtocolNodeDef[] = [
  { id: 'client', label: 'Client', ip: '192.168.1.10', role: 'host', x: 110, y: 250, mac: '02:42:ac:11:00:10' },
  { id: 'r1', label: 'Home Router', ip: '192.168.1.1', role: 'router', x: 360, y: 250, mac: '02:42:ac:11:00:01' },
  { id: 'r2', label: 'ISP AS64500', ip: '100.64.0.1', role: 'router', x: 630, y: 250, mac: '02:42:ac:11:00:02' },
  { id: 'dst', label: 'Web Server', ip: '203.0.113.10', role: 'web_server', x: 890, y: 250, mac: '02:42:ac:11:00:80' },
];

const links: ProtocolLinkDef[] = [
  { id: 'l1', sourceId: 'client', targetId: 'r1', delayMs: 3 },
  { id: 'l2', sourceId: 'r1', targetId: 'r2', delayMs: 8 },
  { id: 'l3', sourceId: 'r2', targetId: 'dst', delayMs: 12 },
];

const steps: ProtocolStepDef[] = [
  { title: 'Echo Request (Ping)', subtitle: 'Type 8 Echo Request reaches target', caption: 'Client sends ICMP Type 8 Echo Request (TTL=64) across two routers to 203.0.113.10.', osiLayer: 3 },
  { title: 'Echo Reply', subtitle: 'Type 0 Echo Reply measures RTT', caption: 'Web Server replies with ICMP Type 0 Echo Reply; Client calculates round-trip latency.', osiLayer: 3 },
  { title: 'Traceroute Hop 1 (TTL=1)', subtitle: 'Router 1 decrements TTL to 0 -> Time Exceeded', caption: 'Traceroute sends TTL=1; Home Router drops it and returns ICMP Type 11 Time Exceeded.', osiLayer: 3 },
  { title: 'Traceroute Hop 2 (TTL=2)', subtitle: 'ISP Router returns Time Exceeded', caption: 'Client increments TTL=2; ISP Router reveals its hop IP via ICMP Type 11.', osiLayer: 3 },
  { title: 'Destination Reached', subtitle: 'TTL=3 reaches 203.0.113.10', caption: 'Final probe arrives at destination which returns Echo Reply / Port Unreachable.', osiLayer: 3 },
];

export const icmpProtocol: ProtocolEntry = {
  id: 'icmp',
  name: 'ICMP',
  fullName: 'Internet Control Message Protocol (Ping & Traceroute)',
  category: 'CORE',
  status: 'full',
  layer: 'Layer 3 (Network) / TCP-IP Internet',
  osiLayer: 3,
  defaultPort: 'N/A (IP Protocol 1)',
  transport: 'Encapsulated directly in IPv4',
  dataFormat: '8-byte ICMP Header + Echo/Error Payload',
  methods: ['Echo Request (8)', 'Echo Reply (0)', 'Dest Unreachable (3)', 'Time Exceeded (11)', 'Redirect (5)'],
  rfcs: [
    { number: 'RFC 792', title: 'Internet Control Message Protocol', url: 'https://www.rfc-editor.org/rfc/rfc792' },
    { number: 'RFC 4443', title: 'ICMPv6', url: 'https://www.rfc-editor.org/rfc/rfc4443' },
  ],
  keywords: ['ping', 'traceroute', 'tracert', 'ttl', 'time exceeded', 'echo', 'unreachable', 'mtu', 'pmtud'],
  description:
    'ICMP delivers network-layer diagnostics and error reporting. Tools like ping (Echo Request/Reply) and traceroute (TTL expiration probes) rely on ICMP control messages.',
  eli5: 'ICMP is like shouting "Marco!" across a canyon and timing how fast "Polo!" bounces back—or having each relay runner tell you when your message ran out of steps.',
  securityNotes: [
    {
      attack: 'Smurf Amplification & Ping Flood',
      description: 'Sending ICMP Echo Requests to a subnet broadcast address with a spoofed source IP floods the victim.',
      defense: 'Disable directed broadcast forwarding on routers and rate-limit ICMP responses.',
    },
    {
      attack: 'ICMP Tunneling',
      description: 'Covert channels hide arbitrary C2 data inside the Echo payload when firewalls block TCP/UDP.',
      defense: 'Inspect ICMP payload sizes and disallow anomalous non-standard Echo payloads.',
    },
  ],
  nodes,
  links,
  steps,
  whatIfOptions: [
    { id: 'ttlExpired', label: 'TTL=1 Expiry', description: 'Force immediate TTL=0 Time Exceeded at first router' },
    { id: 'smallMtu', label: 'MTU Too Small (PMTUD)', description: 'Trigger ICMP Type 3 Code 4 Fragmentation Needed' },
    { id: 'packetLoss', label: 'ICMP Filtered / Lost', description: 'Simulate firewall dropping ICMP echo reply' },
  ],
  quiz: [
    {
      question: 'Which ICMP Type/Code is returned when a router decrements IP TTL to 0?',
      options: ['Type 0 Echo Reply', 'Type 3 Dest Unreachable', 'Type 11 Time Exceeded', 'Type 8 Echo Request'],
      correctIndex: 2,
      explanation: 'Routers emit ICMP Type 11 Code 0 (TTL exceeded in transit) whenever TTL reaches zero.',
    },
    {
      question: 'How does traceroute discover every router hop along a path?',
      options: ['By querying DNS', 'By sending probes with incrementing TTL (1, 2, 3...)', 'By broadcasting ARP', 'By opening TCP port 22'],
      correctIndex: 1,
      explanation: 'Each router along the path drops the probe when TTL hits 0 and reveals itself via Time Exceeded.',
    },
    {
      question: 'Why shouldn’t firewalls blindly block ALL ICMP?',
      options: ['It breaks Path MTU Discovery (Type 3 Code 4)', 'It breaks DHCP', 'It stops Ethernet switching', 'It disables TLS'],
      correctIndex: 0,
      explanation: 'Blocking ICMP Fragmentation Needed causes PMTUD blackholes on links with smaller MTUs.',
    },
    {
      question: 'What IP protocol number identifies ICMP inside an IPv4 header?',
      options: ['1', '6', '17', '47'],
      correctIndex: 0,
      explanation: 'Protocol 1 is ICMP, 6 is TCP, and 17 is UDP.',
    },
    {
      question: 'Which ICMP message pair does `ping` use?',
      options: ['Type 8 and Type 0', 'Type 11 and Type 3', 'Type 5 and Type 8', 'Type 13 and Type 14'],
      correctIndex: 0,
      explanation: 'Ping sends Type 8 Echo Request and expects Type 0 Echo Reply.',
    },
  ],
  scenario: (opts = {}) => {
    const templates = [
      {
        stepIndex: 0, fromId: 'client', toId: 'r1', protocol: 'ICMP', colorCategory: 'icmp' as const,
        info: 'Echo (ping) request id=0x0401, seq=1, ttl=64', osiLayer: 3, ttl: 64, sizeBytes: 74,
        isIcmp: { type: 8, code: 0, message: 'ping-seq-1' },
      },
      {
        stepIndex: 0, fromId: 'r1', toId: 'r2', protocol: 'ICMP', colorCategory: 'icmp' as const,
        info: 'Echo (ping) request seq=1, ttl=63', osiLayer: 3, ttl: 63, sizeBytes: 74,
        isIcmp: { type: 8, code: 0, message: 'ping-seq-1' },
      },
      {
        stepIndex: 0, fromId: 'r2', toId: 'dst', protocol: 'ICMP', colorCategory: 'icmp' as const,
        info: 'Echo (ping) request seq=1, ttl=62', osiLayer: 3, ttl: 62, sizeBytes: 74,
        isIcmp: { type: 8, code: 0, message: 'ping-seq-1' },
      },
      {
        stepIndex: 1, fromId: 'dst', toId: 'client', protocol: 'ICMP', colorCategory: 'icmp' as const,
        info: 'Echo (ping) reply id=0x0401, seq=1 (RTT ~46ms)', osiLayer: 3, ttl: 64, sizeBytes: 74,
        isIcmp: { type: 0, code: 0, message: 'ping-seq-1' },
      },
      {
        stepIndex: 2, fromId: 'client', toId: 'r1', protocol: 'ICMP', colorCategory: 'icmp' as const,
        info: 'Traceroute Probe #1 (TTL=1)', osiLayer: 3, ttl: 1, sizeBytes: 60,
        isIcmp: { type: 8, code: 0, message: 'trace-1' },
      },
      {
        stepIndex: 2, fromId: 'r1', toId: 'client', protocol: 'ICMP', colorCategory: 'error' as const,
        info: 'Time-to-live exceeded (Hop 1: 192.168.1.1)', osiLayer: 3, ttl: 64, sizeBytes: 70,
        isIcmp: { type: 11, code: 0, message: 'ttl-expired-r1' },
      },
      {
        stepIndex: 3, fromId: 'client', toId: 'r2', protocol: 'ICMP', colorCategory: 'icmp' as const,
        info: 'Traceroute Probe #2 (TTL=2)', osiLayer: 3, ttl: 2, sizeBytes: 60,
        isIcmp: { type: 8, code: 0, message: 'trace-2' },
      },
      {
        stepIndex: 3, fromId: 'r2', toId: 'client', protocol: 'ICMP', colorCategory: 'error' as const,
        info: 'Time-to-live exceeded (Hop 2: 100.64.0.1)', osiLayer: 3, ttl: 64, sizeBytes: 70,
        isIcmp: { type: 11, code: 0, message: 'ttl-expired-r2' },
      },
      {
        stepIndex: 4, fromId: 'client', toId: 'dst', protocol: 'ICMP', colorCategory: 'icmp' as const,
        info: 'Traceroute Probe #3 (TTL=3) reaches target', osiLayer: 3, ttl: 3, sizeBytes: 60,
        isIcmp: { type: 8, code: 0, message: 'trace-3' },
      },
      {
        stepIndex: 4, fromId: 'dst', toId: 'client', protocol: 'ICMP', colorCategory: 'icmp' as const,
        info: 'Echo reply (Hop 3: 203.0.113.10 reached!)', osiLayer: 3, ttl: 64, sizeBytes: 74,
        isIcmp: { type: 0, code: 0, message: 'trace-3' },
      },
    ];
    return runPacketTemplates(nodes, links, steps, templates, opts);
  },
};
