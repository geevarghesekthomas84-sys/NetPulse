import { runPacketTemplates } from '../helpers';
import type { PacketTemplate, ProtocolEntry, ProtocolLinkDef, ProtocolNodeDef, ProtocolStepDef } from '../types';

const nodes: ProtocolNodeDef[] = [
  { id: 'client', label: 'Client', ip: '192.168.1.10', role: 'host', x: 130, y: 250 },
  { id: 'resolver', label: 'DNS 8.8.8.8', ip: '8.8.8.8', role: 'dns_server', x: 430, y: 110 },
  { id: 'web', label: 'HTTPS Server', ip: '203.0.113.10', role: 'web_server', x: 820, y: 250, openPorts: [443] },
];

const links: ProtocolLinkDef[] = [
  { id: 'l1', sourceId: 'client', targetId: 'resolver', delayMs: 8 },
  { id: 'l2', sourceId: 'client', targetId: 'web', delayMs: 14 },
];

const steps: ProtocolStepDef[] = [
  { title: 'DNS Lookup', subtitle: 'Resolve example.com -> 203.0.113.10', caption: 'Client resolves the target domain to an IP address via DNS.', osiLayer: 7 },
  { title: 'TCP Handshake', subtitle: 'Connect to port 443', caption: '3-way TCP handshake establishes the reliable byte stream to port 443.', osiLayer: 4 },
  { title: 'TLS 1.3 Handshake', subtitle: 'ECDHE + Certificate + ALPN h2', caption: 'Peers negotiate TLS 1.3 encryption keys and select HTTP/2 via ALPN.', osiLayer: 6 },
  { title: 'Encrypted HTTP/2 Exchange', subtitle: 'Encrypted GET / -> 200 OK', caption: 'HTTP headers, cookies, and HTML payload are encrypted end-to-end inside TLS records.', osiLayer: 7 },
];

export const httpsProtocol: ProtocolEntry = {
  id: 'https',
  name: 'HTTPS',
  fullName: 'HTTP over TLS (Secure Hypertext Transfer Protocol)',
  category: 'APPLICATION',
  status: 'full',
  layer: 'Layer 7 (Application) over TLS (Layer 6)',
  osiLayer: 7,
  defaultPort: '443',
  transport: 'TCP + TLS 1.2/1.3 (or QUIC for HTTP/3)',
  dataFormat: 'TLS AEAD Encrypted HTTP/1.1 or Binary HTTP/2 Frames',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'HEAD', 'HSTS'],
  rfcs: [
    { number: 'RFC 9110', title: 'HTTP Semantics (HTTPS URI Scheme)', url: 'https://www.rfc-editor.org/rfc/rfc9110' },
    { number: 'RFC 8446', title: 'TLS 1.3', url: 'https://www.rfc-editor.org/rfc/rfc8446' },
  ],
  keywords: ['tls', 'ssl', '443', 'padlock', 'encrypted', 'hsts', 'alpn', 'http/2'],
  description:
    'HTTPS wraps HTTP inside TLS encryption, protecting URLs, headers, cookies, and payloads against eavesdropping and tampering while authenticating the server via X.509 certificates.',
  eli5: 'HTTPS is HTTP inside a locked armored briefcase: the postal worker still sees which building address you’re sending to (IP/SNI), but nobody can read or alter the letter inside.',
  securityNotes: [
    {
      attack: 'SSL Stripping',
      description: 'An on-path attacker intercepts an initial plain HTTP request and prevents the redirect to HTTPS.',
      defense: 'Enable HSTS (Strict-Transport-Security) with preload so browsers refuse plain HTTP.',
    },
  ],
  nodes,
  links,
  steps,
  whatIfOptions: [
    { id: 'expiredCert', label: 'Expired TLS Certificate', description: 'Browser aborts connection before sending HTTP cookies' },
    { id: 'dnsCacheHit', label: 'DNS Cached', description: 'Skip DNS query and connect directly to port 443' },
  ],
  quiz: [
    {
      question: 'Which default port does HTTPS use?',
      options: ['80', '443', '8080', '22'],
      correctIndex: 1,
      explanation: 'HTTPS runs on TCP (or UDP/QUIC) port 443 by default.',
    },
    {
      question: 'In HTTPS, which part of an HTTP request is hidden from network sniffers?',
      options: ['Destination IP address', 'Path, query string, headers, cookies, and body', 'TCP port 443', 'MAC address'],
      correctIndex: 1,
      explanation: 'Everything inside the HTTP layer (URI path, headers, cookies, body) is encrypted by TLS.',
    },
    {
      question: 'What header prevents SSL-stripping attacks after a user’s first visit?',
      options: ['X-Frame-Options', 'Strict-Transport-Security (HSTS)', 'Cache-Control', 'ETag'],
      correctIndex: 1,
      explanation: 'HSTS forces browsers to upgrade all future requests to HTTPS automatically.',
    },
    {
      question: 'Which TLS extension negotiates HTTP/2 vs HTTP/1.1 during the handshake?',
      options: ['ALPN', 'SNI', 'ARP', 'NAT'],
      correctIndex: 0,
      explanation: 'Application-Layer Protocol Negotiation (ALPN) picks "h2" or "http/1.1" in 0 extra round-trips.',
    },
    {
      question: 'Why does HTTPS require a Certificate Authority (CA)?',
      options: ['To compress HTML', 'To sign certificates so browsers trust the server’s public key', 'To assign IP addresses', 'To compute TCP checksums'],
      correctIndex: 1,
      explanation: 'CAs vouch that a public key genuinely belongs to the domain name.',
    },
  ],
  scenario: (opts = {}) => {
    const templates: PacketTemplate[] = [
      ...(opts.dnsCacheHit
        ? []
        : [
            { stepIndex: 0, fromId: 'client', toId: 'resolver', protocol: 'DNS', colorCategory: 'dns' as const, info: 'Standard query A secure.example.com', osiLayer: 7, isUdp: true, srcPort: 54010, dstPort: 53, sizeBytes: 76, dns: { transactionId: 0x3311, isResponse: false, questions: [{ name: 'secure.example.com', type: 'A' }], answers: [] } },
            { stepIndex: 0, fromId: 'resolver', toId: 'client', protocol: 'DNS', colorCategory: 'dns' as const, info: 'Standard query response A 203.0.113.10', osiLayer: 7, isUdp: true, srcPort: 53, dstPort: 54010, sizeBytes: 92, dns: { transactionId: 0x3311, isResponse: true, questions: [{ name: 'secure.example.com', type: 'A' }], answers: [{ name: 'secure.example.com', type: 'A', value: '203.0.113.10', ttl: 300 }] } },
          ]),
      { stepIndex: 1, fromId: 'client', toId: 'web', protocol: 'TCP', colorCategory: 'tcp' as const, info: '54120 -> 443 [SYN] Seq=0', osiLayer: 4, srcPort: 54120, dstPort: 443, tcpFlags: { syn: true }, sizeBytes: 66 },
      { stepIndex: 1, fromId: 'web', toId: 'client', protocol: 'TCP', colorCategory: 'tcp' as const, info: '443 -> 54120 [SYN, ACK] Seq=0 Ack=1', osiLayer: 4, srcPort: 443, dstPort: 54120, tcpFlags: { syn: true, ack: true }, sizeBytes: 66 },
      { stepIndex: 1, fromId: 'client', toId: 'web', protocol: 'TCP', colorCategory: 'tcp' as const, info: '54120 -> 443 [ACK] Seq=1 Ack=1', osiLayer: 4, srcPort: 54120, dstPort: 443, tcpFlags: { ack: true }, sizeBytes: 60 },
      { stepIndex: 2, fromId: 'client', toId: 'web', protocol: 'TLS', colorCategory: 'tls' as const, info: 'ClientHello (TLS 1.3, ALPN=h2, SNI=secure.example.com)', osiLayer: 6, srcPort: 54120, dstPort: 443, tcpFlags: { psh: true, ack: true }, sizeBytes: 517, tls: { recordType: 'Handshake', version: 'TLS 1.3', handshakeType: 'ClientHello', sni: 'secure.example.com', alpn: 'h2' } },
      { stepIndex: 2, fromId: 'web', toId: 'client', protocol: 'TLS', colorCategory: 'tls' as const, info: opts.expiredCert ? 'ServerHello + Expired Certificate!' : 'ServerHello + Encrypted Certificate + Finished', osiLayer: 6, srcPort: 443, dstPort: 54120, tcpFlags: { psh: true, ack: true }, sizeBytes: 1390, tls: { recordType: 'Handshake', version: 'TLS 1.3', handshakeType: 'ServerHello + Certificate' } },
      ...(opts.expiredCert
        ? [
            { stepIndex: 2, fromId: 'client', toId: 'web', protocol: 'TLS', colorCategory: 'error' as const, info: 'TLS Fatal Alert: Certificate Expired', osiLayer: 6, srcPort: 54120, dstPort: 443, tcpFlags: { psh: true, ack: true, fin: true }, sizeBytes: 67, tls: { recordType: 'Alert' as const, version: 'TLS 1.3' as const, handshakeType: 'certificate_expired' } },
          ]
        : [
            { stepIndex: 3, fromId: 'client', toId: 'web', protocol: 'HTTPS', colorCategory: 'tls' as const, info: 'Application Data [Encrypted HTTP/2 HEADERS GET /]', osiLayer: 7, srcPort: 54120, dstPort: 443, tcpFlags: { psh: true, ack: true }, sizeBytes: 210, tls: { recordType: 'Application Data' as const, version: 'TLS 1.3' as const, handshakeType: 'Encrypted HTTP/2 Request' } },
            { stepIndex: 3, fromId: 'web', toId: 'client', protocol: 'HTTPS', colorCategory: 'tls' as const, info: 'Application Data [Encrypted HTTP/2 DATA 200 OK]', osiLayer: 7, srcPort: 443, dstPort: 54120, tcpFlags: { psh: true, ack: true }, sizeBytes: 4200, tls: { recordType: 'Application Data' as const, version: 'TLS 1.3' as const, handshakeType: 'Encrypted HTTP/2 Response' } },
          ]),
    ];
    return runPacketTemplates(nodes, links, steps, templates, opts);
  },
};
