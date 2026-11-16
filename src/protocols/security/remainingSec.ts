import { runPacketTemplates } from '../helpers';
import type { ProtocolEntry, ProtocolLinkDef, ProtocolNodeDef } from '../types';

const proxyNodes: ProtocolNodeDef[] = [
  { id: 'client', label: 'Client', ip: '192.168.1.10', role: 'host', x: 140, y: 250 },
  { id: 'proxy', label: 'Proxy Server', ip: '192.0.2.80', role: 'proxy', x: 500, y: 250, openPorts: [3128, 1080, 443] },
  { id: 'origin', label: 'Origin Server', ip: '203.0.113.10', role: 'web_server', x: 860, y: 250, openPorts: [80, 443] },
];

const proxyLinks: ProtocolLinkDef[] = [
  { id: 'l1', sourceId: 'client', targetId: 'proxy', delayMs: 6 },
  { id: 'l2', sourceId: 'proxy', targetId: 'origin', delayMs: 14 },
];

export const httpProxyProtocol: ProtocolEntry = {
  id: 'http_proxy',
  name: 'HTTP Proxy',
  fullName: 'HTTP Forward Proxy & CONNECT Tunnel',
  category: 'SECURITY',
  status: 'full',
  layer: 'Layer 7 (Application)',
  osiLayer: 7,
  defaultPort: '3128 / 8080',
  transport: 'TCP',
  dataFormat: 'HTTP CONNECT / Absolute-URI Requests',
  methods: ['CONNECT', 'GET http://...', 'Via', 'X-Forwarded-For'],
  rfcs: [{ number: 'RFC 9110', title: 'HTTP Semantics (CONNECT Method)', url: 'https://www.rfc-editor.org/rfc/rfc9110' }],
  keywords: ['proxy', 'connect', 'tunnel', 'forward proxy', '3128', '8080', 'corporate', 'cache'],
  description:
    'An HTTP forward proxy relays client traffic to external servers. For HTTPS, the client sends an HTTP CONNECT host:443 request so the proxy opens a raw opaque TCP tunnel for end-to-end TLS.',
  eli5: 'Instead of calling a store directly, you ask your office receptionist (proxy) to dial the number and connect the line without listening in on your private TLS conversation.',
  securityNotes: [
    {
      attack: 'Open Proxy Abuse & SSRF',
      description: 'Misconfigured proxies let external attackers bounce traffic through internal corporate networks.',
      defense: 'Require Proxy-Authorization and restrict CONNECT destination ports to 443.',
    },
  ],
  nodes: proxyNodes,
  links: proxyLinks,
  steps: [
    { title: 'TCP to Proxy', subtitle: 'Connect to proxy :3128', caption: 'Client opens TCP session to forward proxy 192.0.2.80:3128.', osiLayer: 4 },
    { title: 'HTTP CONNECT Tunnel', subtitle: 'CONNECT example.com:443 -> 200 Connection Established', caption: 'Proxy opens TCP to 203.0.113.10:443 and replies 200 Connection Established.', osiLayer: 7 },
    { title: 'End-to-End TLS Inside Tunnel', subtitle: 'Proxy forwards encrypted TLS bytes blindly', caption: 'Client performs TLS 1.3 handshake directly with origin through the blind TCP tunnel.', osiLayer: 6 },
  ],
  whatIfOptions: [{ id: 'wrongPassword', label: '407 Proxy Auth Required', description: 'Proxy rejects unauthenticated CONNECT request' }],
  quiz: [
    { question: 'Which HTTP method asks a forward proxy to open a TCP tunnel for HTTPS?', options: ['GET', 'POST', 'CONNECT', 'OPTIONS'], correctIndex: 2, explanation: 'CONNECT host:port establishes a transparent TCP tunnel through an HTTP proxy.' },
    { question: 'What status code does a proxy return when a CONNECT tunnel succeeds?', options: ['200 Connection Established', '302 Found', '407 Proxy Auth Required', '502 Bad Gateway'], correctIndex: 0, explanation: '200 signals the tunnel is ready for raw TLS bytes.' },
    { question: 'Can a standard CONNECT proxy read your HTTPS payload without installing a root CA on your device?', options: ['Yes, always', 'No, TLS encrypts end-to-end between client and origin', 'Only on port 80', 'Only with UDP'], correctIndex: 1, explanation: 'Without TLS-interception CA trust, the proxy only forwards opaque encrypted bytes.' },
  ],
  scenario: (opts = {}) =>
    runPacketTemplates(
      proxyNodes,
      proxyLinks,
      httpProxyProtocol.steps,
      [
        { stepIndex: 0, fromId: 'client', toId: 'proxy', protocol: 'TCP', colorCategory: 'tcp', info: '54100 -> 3128 [SYN] Seq=0', osiLayer: 4, srcPort: 54100, dstPort: 3128, tcpFlags: { syn: true }, sizeBytes: 66 },
        { stepIndex: 1, fromId: 'client', toId: 'proxy', protocol: 'HTTP', colorCategory: 'http_req', info: 'CONNECT example.com:443 HTTP/1.1', osiLayer: 7, srcPort: 54100, dstPort: 3128, tcpFlags: { psh: true, ack: true }, sizeBytes: 148 },
        ...(opts.wrongPassword
          ? [{ stepIndex: 1, fromId: 'proxy', toId: 'client', protocol: 'HTTP', colorCategory: 'error' as const, info: 'HTTP/1.1 407 Proxy Authentication Required', osiLayer: 7, srcPort: 3128, dstPort: 54100, tcpFlags: { psh: true, ack: true }, sizeBytes: 184 }]
          : [
              { stepIndex: 1, fromId: 'proxy', toId: 'origin', protocol: 'TCP', colorCategory: 'tcp' as const, info: '39100 -> 443 [SYN] Proxy opens upstream socket', osiLayer: 4, srcPort: 39100, dstPort: 443, tcpFlags: { syn: true }, sizeBytes: 66 },
              { stepIndex: 1, fromId: 'proxy', toId: 'client', protocol: 'HTTP', colorCategory: 'http_res' as const, info: 'HTTP/1.1 200 Connection Established', osiLayer: 7, srcPort: 3128, dstPort: 54100, tcpFlags: { psh: true, ack: true }, sizeBytes: 98 },
              { stepIndex: 2, fromId: 'client', toId: 'origin', protocol: 'TLS', colorCategory: 'tls' as const, info: 'End-to-end TLS 1.3 ClientHello -> Origin (via tunnel)', osiLayer: 6, srcPort: 54100, dstPort: 443, tcpFlags: { psh: true, ack: true }, sizeBytes: 517, tls: { recordType: 'Handshake' as const, version: 'TLS 1.3' as const, handshakeType: 'ClientHello (Tunneled)' } },
            ]),
      ],
      opts
    ),
};

export const socks5Protocol: ProtocolEntry = {
  id: 'socks5',
  name: 'SOCKS5',
  fullName: 'SOCKS Protocol Version 5',
  category: 'SECURITY',
  status: 'full',
  layer: 'Layer 5 (Session)',
  osiLayer: 5,
  defaultPort: '1080',
  transport: 'TCP / UDP Associate',
  dataFormat: 'Binary Greeting + Auth + Relay Header',
  methods: ['Method Negotiation', 'Username/Password Auth', 'CONNECT', 'BIND', 'UDP ASSOCIATE'],
  rfcs: [{ number: 'RFC 1928', title: 'SOCKS Protocol Version 5', url: 'https://www.rfc-editor.org/rfc/rfc1928' }],
  keywords: ['1080', 'proxy', 'tor', 'ssh -D', 'udp associate', 'session'],
  description:
    'SOCKS5 is a protocol-agnostic session proxy (port 1080) capable of relaying any TCP or UDP traffic (used by SSH dynamic port forwarding and Tor) without understanding HTTP.',
  eli5: 'SOCKS5 is a universal courier pipe: you tell it the final IP and port, and it passes any kind of TCP or UDP packets through without caring what app created them.',
  securityNotes: [
    {
      attack: 'Unencrypted SOCKS5 Credentials',
      description: 'RFC 1929 username/password subnegotiation sends credentials in plaintext unless wrapped inside SSH/TLS.',
      defense: 'Tunnel SOCKS5 inside SSH (`ssh -D 1080`) or TLS.',
    },
  ],
  nodes: proxyNodes,
  links: proxyLinks,
  steps: [
    { title: 'Method Greeting', subtitle: 'Ver=5, Methods=[0x00, 0x02]', caption: 'Client offers No-Auth or Username/Password; SOCKS5 server selects method.', osiLayer: 5 },
    { title: 'CONNECT Request', subtitle: 'CMD=0x01 Dst=example.com:443', caption: 'Client asks SOCKS5 proxy to connect to domain/IP on port 443; proxy replies Succeeded (0x00).', osiLayer: 5 },
    { title: 'Transparent Relay', subtitle: 'Arbitrary TCP/UDP payload relayed', caption: 'All subsequent bytes pass transparently between client and target origin.', osiLayer: 5 },
  ],
  whatIfOptions: [{ id: 'wrongPassword', label: 'Auth Failure (0xFF)', description: 'SOCKS5 rejects credentials during subnegotiation' }],
  quiz: [
    { question: 'Which default port does SOCKS5 use?', options: ['1080', '3128', '8080', '443'], correctIndex: 0, explanation: 'IANA assigned port 1080 to SOCKS.' },
    { question: 'Which feature does SOCKS5 add over SOCKS4?', options: ['Only HTTP support', 'UDP Associate, IPv6, and authentication', 'DNS caching', 'BGP peering'], correctIndex: 1, explanation: 'SOCKS5 added UDP relay, IPv6 addressing, domain name resolution, and authentication.' },
    { question: 'Which SSH flag spins up a local SOCKS5 proxy tunnel?', options: ['ssh -L', 'ssh -D', 'ssh -X', 'ssh -V'], correctIndex: 1, explanation: '`ssh -D 1080` starts dynamic SOCKS5 forwarding over the encrypted SSH tunnel.' },
  ],
  scenario: (opts = {}) =>
    runPacketTemplates(
      proxyNodes,
      proxyLinks,
      socks5Protocol.steps,
      [
        { stepIndex: 0, fromId: 'client', toId: 'proxy', protocol: 'SOCKS5', colorCategory: 'sec', info: 'Client Greeting: Ver=5, NMethods=2 (NoAuth, User/Pass)', osiLayer: 5, srcPort: 54300, dstPort: 1080, tcpFlags: { psh: true, ack: true }, sizeBytes: 64 },
        { stepIndex: 0, fromId: 'proxy', toId: 'client', protocol: 'SOCKS5', colorCategory: 'sec', info: opts.wrongPassword ? 'Auth Failure (Status=0x01)' : 'Method Selection: 0x00 (Accepted)', osiLayer: 5, srcPort: 1080, dstPort: 54300, tcpFlags: { psh: true, ack: true }, sizeBytes: 60 },
        ...(opts.wrongPassword
          ? []
          : [
              { stepIndex: 1, fromId: 'client', toId: 'proxy', protocol: 'SOCKS5', colorCategory: 'sec' as const, info: 'CONNECT example.com:443 (ATYP=Domain)', osiLayer: 5, srcPort: 54300, dstPort: 1080, tcpFlags: { psh: true, ack: true }, sizeBytes: 86 },
              { stepIndex: 1, fromId: 'proxy', toId: 'origin', protocol: 'TCP', colorCategory: 'tcp' as const, info: 'Proxy -> Origin [SYN] Port 443', osiLayer: 4, srcPort: 41200, dstPort: 443, tcpFlags: { syn: true }, sizeBytes: 66 },
              { stepIndex: 1, fromId: 'proxy', toId: 'client', protocol: 'SOCKS5', colorCategory: 'sec' as const, info: 'Reply: Succeeded (0x00)', osiLayer: 5, srcPort: 1080, dstPort: 54300, tcpFlags: { psh: true, ack: true }, sizeBytes: 70 },
              { stepIndex: 2, fromId: 'client', toId: 'origin', protocol: 'TLS', colorCategory: 'tls' as const, info: 'Relayed Application Stream', osiLayer: 6, srcPort: 54300, dstPort: 443, tcpFlags: { psh: true, ack: true }, sizeBytes: 420 },
            ]),
      ],
      opts
    ),
};

const revProxyNodes: ProtocolNodeDef[] = [
  { id: 'client', label: 'Browser Client', ip: '192.168.1.10', role: 'host', x: 140, y: 250 },
  { id: 'lb', label: 'Reverse Proxy / LB', ip: '203.0.113.10', role: 'reverse_proxy', x: 500, y: 250, openPorts: [443] },
  { id: 'app1', label: 'Backend Pool #1', ip: '10.0.0.21', role: 'server_tower', x: 850, y: 150, openPorts: [8080] },
  { id: 'app2', label: 'Backend Pool #2', ip: '10.0.0.22', role: 'server_tower', x: 850, y: 350, openPorts: [8080] },
];

const revProxyLinks: ProtocolLinkDef[] = [
  { id: 'l1', sourceId: 'client', targetId: 'lb', delayMs: 12 },
  { id: 'l2', sourceId: 'lb', targetId: 'app1', delayMs: 3 },
  { id: 'l3', sourceId: 'lb', targetId: 'app2', delayMs: 3 },
];

export const reverseProxyProtocol: ProtocolEntry = {
  id: 'reverse_proxy',
  name: 'Reverse Proxy',
  fullName: 'Reverse Proxy & Load Balancer (TLS Termination)',
  category: 'SECURITY',
  status: 'full',
  layer: 'Layer 7 (Application)',
  osiLayer: 7,
  defaultPort: '80 / 443',
  transport: 'TCP',
  dataFormat: 'HTTP/2 Front-End -> Internal HTTP/1.1 + X-Forwarded-*',
  methods: ['TLS Termination', 'Round-Robin LB', 'Health Check', 'X-Forwarded-For', 'WAF'],
  rfcs: [{ number: 'RFC 7239', title: 'Forwarded HTTP Extension', url: 'https://www.rfc-editor.org/rfc/rfc7239' }],
  keywords: ['nginx', 'envoy', 'cloudflare', 'load balancer', 'waf', 'tls termination', 'x-forwarded-for'],
  description:
    'A reverse proxy sits in front of origin backend servers to terminate TLS, enforce WAF rules, cache static content, and load-balance requests across healthy upstream workers.',
  eli5: 'A restaurant host greets guests at the front door, checks reservations (WAF), and seats each party at whichever open kitchen table (backend server) isn’t busy.',
  securityNotes: [
    {
      attack: 'X-Forwarded-For Spoofing',
      description: 'If the proxy trusts client-supplied X-Forwarded-For headers blindly, attackers can bypass IP allowlists.',
      defense: 'Strip/overwrite X-Forwarded-For at the edge reverse proxy before forwarding upstream.',
    },
  ],
  nodes: revProxyNodes,
  links: revProxyLinks,
  steps: [
    { title: 'Health Checks', subtitle: 'LB probes /healthz on Backends #1 & #2', caption: 'Reverse proxy runs periodic health probes to track healthy pool members.', osiLayer: 7 },
    { title: 'Client TLS Termination', subtitle: 'HTTPS terminates at edge Reverse Proxy', caption: 'Client completes TLS 1.3 handshake with the edge Reverse Proxy.', osiLayer: 6 },
    { title: 'Upstream Routing & LB', subtitle: 'Proxy forwards to Backend #1 (or #2 on failover)', caption: 'Reverse proxy injects X-Forwarded-For and balances across healthy backends.', osiLayer: 7 },
  ],
  whatIfOptions: [{ id: 'serverDown', label: 'Backend #2 Down (Failover)', description: 'Health check fails on #2; LB routes all traffic to #1' }],
  quiz: [
    { question: 'What is the key difference between a forward proxy and a reverse proxy?', options: ['Forward acts on behalf of clients; reverse acts in front of origin servers', 'Reverse only works with UDP', 'Forward encrypts DNS', 'They are identical'], correctIndex: 0, explanation: 'Forward proxies shield/govern clients; reverse proxies shield/scale backend servers.' },
    { question: 'Which HTTP header preserves the original client IP behind a reverse proxy?', options: ['Host', 'X-Forwarded-For / Forwarded', 'ETag', 'Server'], correctIndex: 1, explanation: 'X-Forwarded-For (or RFC 7239 Forwarded) records the originating client IP.' },
    { question: 'What is TLS termination at a load balancer?', options: ['Breaking security', 'Decrypting TLS at the edge proxy so backends receive plain or re-encrypted internal HTTP', 'Closing port 443', 'Disabling certificates'], correctIndex: 1, explanation: 'TLS termination offloads CPU-heavy crypto from app servers and allows L7 inspection/routing.' },
  ],
  scenario: (opts = {}) =>
    runPacketTemplates(
      revProxyNodes,
      revProxyLinks,
      reverseProxyProtocol.steps,
      [
        { stepIndex: 0, fromId: 'lb', toId: 'app1', protocol: 'HTTP', colorCategory: 'http_req', info: 'GET /healthz -> 200 OK', osiLayer: 7, srcPort: 40001, dstPort: 8080, tcpFlags: { psh: true, ack: true }, sizeBytes: 110 },
        { stepIndex: 0, fromId: 'lb', toId: 'app2', protocol: 'HTTP', colorCategory: opts.serverDown ? 'error' : 'http_req', info: opts.serverDown ? 'GET /healthz -> TIMEOUT (Marked UNHEALTHY)' : 'GET /healthz -> 200 OK', osiLayer: 7, srcPort: 40002, dstPort: 8080, tcpFlags: { psh: true, ack: true }, sizeBytes: 110, forceDrop: opts.serverDown },
        { stepIndex: 1, fromId: 'client', toId: 'lb', protocol: 'TLS', colorCategory: 'tls', info: 'HTTPS GET /api/orders (TLS 1.3)', osiLayer: 6, srcPort: 54400, dstPort: 443, tcpFlags: { psh: true, ack: true }, sizeBytes: 340, tls: { recordType: 'Application Data', version: 'TLS 1.3', handshakeType: 'HTTPS Request' } },
        { stepIndex: 2, fromId: 'lb', toId: 'app1', protocol: 'HTTP', colorCategory: 'http_req', info: 'GET /api/orders (X-Forwarded-For: 192.168.1.10)', osiLayer: 7, srcPort: 40003, dstPort: 8080, tcpFlags: { psh: true, ack: true }, sizeBytes: 390 },
        { stepIndex: 2, fromId: 'app1', toId: 'lb', protocol: 'HTTP', colorCategory: 'http_res', info: '200 OK JSON', osiLayer: 7, srcPort: 8080, dstPort: 40003, tcpFlags: { psh: true, ack: true }, sizeBytes: 720 },
        { stepIndex: 2, fromId: 'lb', toId: 'client', protocol: 'HTTPS', colorCategory: 'tls', info: 'Encrypted 200 OK JSON', osiLayer: 7, srcPort: 443, dstPort: 54400, tcpFlags: { psh: true, ack: true }, sizeBytes: 760, tls: { recordType: 'Application Data', version: 'TLS 1.3', handshakeType: 'HTTPS Response' } },
      ],
      opts
    ),
};

const vpnNodes: ProtocolNodeDef[] = [
  { id: 'lanA', label: 'Office A Host', ip: '10.1.0.10', role: 'host', x: 110, y: 250 },
  { id: 'gwA', label: 'VPN Gateway A', ip: '198.51.100.1', role: 'vpn_gateway', x: 380, y: 250, openPorts: [51820, 500, 4500] },
  { id: 'gwB', label: 'VPN Gateway B', ip: '203.0.113.1', role: 'vpn_gateway', x: 640, y: 250, openPorts: [51820, 500, 4500] },
  { id: 'lanB', label: 'Office B Server', ip: '10.2.0.20', role: 'file_server', x: 900, y: 250 },
];

const vpnLinks: ProtocolLinkDef[] = [
  { id: 'l1', sourceId: 'lanA', targetId: 'gwA', delayMs: 3 },
  { id: 'l2', sourceId: 'gwA', targetId: 'gwB', delayMs: 18 },
  { id: 'l3', sourceId: 'gwB', targetId: 'lanB', delayMs: 3 },
];

export const wireguardProtocol: ProtocolEntry = {
  id: 'wireguard',
  name: 'WireGuard',
  fullName: 'WireGuard Modern Cryptographic VPN',
  category: 'SECURITY',
  status: 'full',
  layer: 'Layer 3 (Network Tunnel over UDP)',
  osiLayer: 3,
  defaultPort: '51820',
  transport: 'UDP',
  dataFormat: 'Noise_IKpsk2 Handshake + ChaCha20-Poly1305 Encrypted IP Packets',
  methods: ['Handshake Initiation', 'Handshake Response', 'Encrypted Transport Data', 'Cryptokey Routing'],
  rfcs: [{ number: 'Noise IK', title: 'WireGuard Whitepaper / Noise Protocol', url: 'https://www.rfc-editor.org/rfc/rfc8439' }],
  keywords: ['vpn', '51820', 'chacha20', 'curve25519', 'tunnel', 'cryptokey routing', 'noise'],
  description:
    'WireGuard is a lean, kernel-space Layer 3 VPN tunnel running over UDP/51820 using Curve25519, ChaCha20-Poly1305, and BLAKE2s with a single 1-RTT Noise handshake and silent stealth drop on unauthenticated packets.',
  eli5: 'WireGuard puts your entire private office envelope inside an unbreakable outer armored pouch addressed between two VPN gateways—outsiders only see scrambled UDP envelopes.',
  securityNotes: [
    {
      attack: 'Static IP Correlation / Metadata',
      description: 'WireGuard assigns static internal tunnel IPs mapped to peer public keys.',
      defense: 'Use ephemeral peer keys or MASQUE/relay proxies when anonymity from endpoints is required.',
    },
  ],
  nodes: vpnNodes,
  links: vpnLinks,
  steps: [
    { title: '1-RTT Noise_IK Handshake', subtitle: 'Initiation + Response over UDP/51820', caption: 'Gateway A authenticates with Curve25519 static/ephemeral keys in a single round-trip.', osiLayer: 3 },
    { title: 'Outer IP + ChaCha20 Encapsulation', subtitle: '10.1.0.10 -> 10.2.0.20 encrypted inside 198.51.100.1 -> 203.0.113.1', caption: 'Inner LAN packet is encrypted with ChaCha20-Poly1305 and sent as an outer UDP/51820 datagram.', osiLayer: 3 },
    { title: 'Decapsulation at Office B', subtitle: 'Cryptokey routing verifies AllowedIPs -> LAN B', caption: 'Gateway B decrypts, verifies AllowedIPs includes 10.1.0.10, and forwards to Office B Server.', osiLayer: 3 },
  ],
  whatIfOptions: [{ id: 'wrongPassword', label: 'Unknown Peer Key (Silent Drop)', description: 'WireGuard drops invalid handshakes silently without replying' }],
  quiz: [
    { question: 'Which transport protocol and default port does WireGuard use?', options: ['TCP 443', 'UDP 51820', 'UDP 500', 'TCP 1194'], correctIndex: 1, explanation: 'WireGuard runs over UDP (default port 51820) avoiding TCP-over-TCP meltdown.' },
    { question: 'Which AEAD cipher does WireGuard use for all encrypted tunnel data?', options: ['DES-CBC', 'ChaCha20-Poly1305', 'RC4', 'Blowfish'], correctIndex: 1, explanation: 'WireGuard uses a fixed modern suite: Curve25519, ChaCha20-Poly1305, BLAKE2s, SipHash24.' },
    { question: 'How does WireGuard respond to an unauthenticated packet from an unknown peer?', options: ['Sends ICMP Unreachable', 'Drops it silently (stealth)', 'Sends TCP RST', 'Logs in plaintext'], correctIndex: 1, explanation: 'Silent drop makes WireGuard invisible to unauthenticated port scanners.' },
  ],
  scenario: (opts = {}) =>
    runPacketTemplates(
      vpnNodes,
      vpnLinks,
      wireguardProtocol.steps,
      [
        { stepIndex: 0, fromId: 'gwA', toId: 'gwB', protocol: 'WireGuard', colorCategory: 'sec', info: 'Handshake Initiation (UDP 51820, Ephemeral Curve25519)', osiLayer: 3, isUdp: true, srcPort: 51820, dstPort: 51820, sizeBytes: 190, forceDrop: opts.wrongPassword, dropReason: opts.wrongPassword ? 'Silent Drop (Unknown Peer Key)' : undefined },
        ...(opts.wrongPassword
          ? []
          : [
              { stepIndex: 0, fromId: 'gwB', toId: 'gwA', protocol: 'WireGuard', colorCategory: 'sec' as const, info: 'Handshake Response (1-RTT Key Derivation Complete)', osiLayer: 3, isUdp: true, srcPort: 51820, dstPort: 51820, sizeBytes: 134 },
              { stepIndex: 1, fromId: 'lanA', toId: 'gwA', protocol: 'TCP', colorCategory: 'tcp' as const, info: 'Inner LAN Packet: 10.1.0.10 -> 10.2.0.20:445', osiLayer: 4, srcPort: 51000, dstPort: 445, tcpFlags: { psh: true, ack: true }, sizeBytes: 240 },
              { stepIndex: 1, fromId: 'gwA', toId: 'gwB', protocol: 'WireGuard', colorCategory: 'tls' as const, info: 'Encrypted Tunnel Data [ChaCha20-Poly1305, Counter=0]', osiLayer: 3, isUdp: true, srcPort: 51820, dstPort: 51820, sizeBytes: 288 },
              { stepIndex: 2, fromId: 'gwB', toId: 'lanB', protocol: 'TCP', colorCategory: 'tcp' as const, info: 'Decapsulated LAN Packet -> 10.2.0.20:445', osiLayer: 4, srcPort: 51000, dstPort: 445, tcpFlags: { psh: true, ack: true }, sizeBytes: 240 },
            ]),
      ],
      opts
    ),
};

export const ipsecProtocol: ProtocolEntry = {
  id: 'ipsec',
  name: 'IPsec',
  fullName: 'Internet Protocol Security (IKEv2 + ESP)',
  category: 'SECURITY',
  status: 'full',
  layer: 'Layer 3 (Network)',
  osiLayer: 3,
  defaultPort: '500 (IKE), 4500 (NAT-T)',
  transport: 'UDP (IKEv2) + IP Proto 50 (ESP)',
  dataFormat: 'IKEv2 SA Payloads + ESP Tunnel Header (SPI, Seq, IV, AEAD)',
  methods: ['IKE_SA_INIT', 'IKE_AUTH', 'ESP Tunnel Mode', 'AH Transport'],
  rfcs: [
    { number: 'RFC 7296', title: 'Internet Key Exchange Protocol Version 2 (IKEv2)', url: 'https://www.rfc-editor.org/rfc/rfc7296' },
    { number: 'RFC 4303', title: 'IP Encapsulating Security Payload (ESP)', url: 'https://www.rfc-editor.org/rfc/rfc4303' },
  ],
  keywords: ['ikev2', 'esp', 'spi', '500', '4500', 'site-to-site', 'vpn', 'tunnel mode'],
  description:
    'IPsec secures IP traffic at Layer 3 using IKEv2 (UDP 500/4500) to negotiate Security Associations (SAs) and ESP (IP protocol 50) to encrypt and authenticate entire IP packets in Tunnel Mode.',
  eli5: 'IPsec is the classic corporate armored truck system: two gateways first sign contracts (IKEv2), then wrap entire internal packets inside an ESP armored outer envelope.',
  securityNotes: [
    {
      attack: 'IKEv1 Aggressive Mode PSK Cracking',
      description: 'Weak pre-shared keys in legacy IKEv1 aggressive mode expose hashes to offline brute force.',
      defense: 'Use IKEv2 with X.509 certificates or high-entropy keys and AES-GCM.',
    },
  ],
  nodes: vpnNodes,
  links: vpnLinks,
  steps: [
    { title: 'IKE_SA_INIT (UDP/500)', subtitle: 'Negotiate Diffie-Hellman & crypto suite', caption: 'VPN gateways negotiate IKE Security Association parameters over UDP port 500.', osiLayer: 3 },
    { title: 'IKE_AUTH (UDP/4500 NAT-T)', subtitle: 'Authenticate peers & create Child ESP SA', caption: 'Gateways verify certificates/PSK and install inbound/outbound ESP SPI keys.', osiLayer: 3 },
    { title: 'ESP Tunnel Encapsulation', subtitle: 'IP Proto 50 encrypts inner IP packet', caption: 'Inner packet (10.1.0.10 -> 10.2.0.20) is encrypted and wrapped with a new outer IP header.', osiLayer: 3 },
  ],
  whatIfOptions: [{ id: 'wrongPassword', label: 'IKE_AUTH PSK Mismatch', description: 'Peer returns AUTHENTICATION_FAILED notify' }],
  quiz: [
    { question: 'Which UDP ports are used by IKEv2 and NAT Traversal?', options: ['53 and 80', '500 and 4500', '22 and 23', '51820'], correctIndex: 1, explanation: 'IKE uses UDP 500 and switches to UDP 4500 when NAT-Traversal is detected.' },
    { question: 'Which IPsec sub-protocol provides both confidentiality (encryption) and integrity?', options: ['AH (Authentication Header)', 'ESP (Encapsulating Security Payload)', 'ICMP', 'ARP'], correctIndex: 1, explanation: 'AH only authenticates headers; ESP provides encryption + authentication.' },
    { question: 'In ESP Tunnel Mode, what gets encrypted?', options: ['Only TCP ports', 'The entire original inner IP packet (header + payload)', 'Only DNS queries', 'Nothing'], correctIndex: 1, explanation: 'Tunnel Mode wraps and encrypts the full original IP packet inside a new outer IP header.' },
  ],
  scenario: (opts = {}) =>
    runPacketTemplates(
      vpnNodes,
      vpnLinks,
      ipsecProtocol.steps,
      [
        { stepIndex: 0, fromId: 'gwA', toId: 'gwB', protocol: 'IKEv2', colorCategory: 'sec', info: 'IKE_SA_INIT Request (DH Group 14, AES-GCM-256)', osiLayer: 3, isUdp: true, srcPort: 500, dstPort: 500, sizeBytes: 340 },
        { stepIndex: 0, fromId: 'gwB', toId: 'gwA', protocol: 'IKEv2', colorCategory: 'sec', info: 'IKE_SA_INIT Response', osiLayer: 3, isUdp: true, srcPort: 500, dstPort: 500, sizeBytes: 320 },
        { stepIndex: 1, fromId: 'gwA', toId: 'gwB', protocol: 'IKEv2', colorCategory: 'sec', info: 'IKE_AUTH (Cert/PSK + Child SA 10.1.0.0/24 <-> 10.2.0.0/24)', osiLayer: 3, isUdp: true, srcPort: 4500, dstPort: 4500, sizeBytes: 420 },
        ...(opts.wrongPassword
          ? [{ stepIndex: 1, fromId: 'gwB', toId: 'gwA', protocol: 'IKEv2', colorCategory: 'error' as const, info: 'IKE_AUTH Notify: AUTHENTICATION_FAILED', osiLayer: 3, isUdp: true, srcPort: 4500, dstPort: 4500, sizeBytes: 110 }]
          : [
              { stepIndex: 1, fromId: 'gwB', toId: 'gwA', protocol: 'IKEv2', colorCategory: 'sec' as const, info: 'IKE_AUTH Response (Child SA Established, SPI=0x9a41)', osiLayer: 3, isUdp: true, srcPort: 4500, dstPort: 4500, sizeBytes: 380 },
              { stepIndex: 2, fromId: 'gwA', toId: 'gwB', protocol: 'ESP', colorCategory: 'tls' as const, info: 'ESP (SPI=0x9a41, Seq=1) [Encrypted 10.1.0.10 -> 10.2.0.20]', osiLayer: 3, isUdp: true, srcPort: 4500, dstPort: 4500, sizeBytes: 296 },
              { stepIndex: 2, fromId: 'gwB', toId: 'lanB', protocol: 'TCP', colorCategory: 'tcp' as const, info: 'Decrypted Inner Packet -> 10.2.0.20', osiLayer: 4, srcPort: 51200, dstPort: 445, tcpFlags: { psh: true, ack: true }, sizeBytes: 220 },
            ]),
      ],
      opts
    ),
};

const wifiNodes: ProtocolNodeDef[] = [
  { id: 'sta', label: 'Laptop STA', ip: '192.168.1.40', role: 'host', x: 140, y: 250 },
  { id: 'ap', label: 'WPA3 / 802.1X AP', ip: '192.168.1.2', role: 'access_point', x: 500, y: 250 },
  { id: 'radius', label: 'RADIUS Server', ip: '10.0.0.50', role: 'server_rack', x: 860, y: 250, openPorts: [1812] },
];

const wifiLinks: ProtocolLinkDef[] = [
  { id: 'l1', sourceId: 'sta', targetId: 'ap', delayMs: 4 },
  { id: 'l2', sourceId: 'ap', targetId: 'radius', delayMs: 6 },
];

export const wpa3Protocol: ProtocolEntry = {
  id: 'wpa3',
  name: 'WPA3',
  fullName: 'Wi-Fi Protected Access 3 (SAE Dragonfly)',
  category: 'SECURITY',
  status: 'full',
  layer: 'Layer 2 (Wireless Data Link)',
  osiLayer: 2,
  defaultPort: 'N/A (802.11 Auth + EAPOL)',
  transport: 'IEEE 802.11 Frames',
  dataFormat: 'SAE Commit/Confirm + Protected Management Frames (PMF)',
  methods: ['SAE Commit', 'SAE Confirm', '4-Way Handshake', 'PMF (802.11w)'],
  rfcs: [{ number: 'RFC 7664', title: 'Dragonfly Key Exchange', url: 'https://www.rfc-editor.org/rfc/rfc7664' }],
  keywords: ['sae', 'dragonfly', 'wpa3', 'pmf', 'forward secrecy', 'offline attack', 'wifi'],
  description:
    'WPA3 replaces WPA2’s vulnerable PSK derivation with SAE (Dragonfly) password-authenticated key exchange, providing forward secrecy and neutralizing offline dictionary cracking, plus mandatory Protected Management Frames (PMF).',
  eli5: 'In WPA3, even if a hacker records your entire Wi-Fi login, they cannot test password guesses at home—they only get one live try per connection with the router.',
  securityNotes: [
    {
      attack: 'Dragonblood Side-Channel / Downgrade',
      description: 'Mixed WPA2/WPA3 transition mode can allow downgrades back to WPA2 unless transition disable is signaled.',
      defense: 'Enable WPA3-only mode where supported and keep AP firmware patched.',
    },
  ],
  nodes: wifiNodes.slice(0, 2),
  links: wifiLinks.slice(0, 1),
  steps: [
    { title: 'SAE Commit (Dragonfly)', subtitle: 'Scalar + Elliptic Curve Element exchange', caption: 'STA and AP exchange Dragonfly Commit messages derived from password + elliptic curve.', osiLayer: 2 },
    { title: 'SAE Confirm', subtitle: 'Zero-knowledge proof of shared PMK', caption: 'Both verify Confirm tokens, proving both know the passphrase with Forward Secrecy.', osiLayer: 2 },
    { title: '4-Way Handshake + PMF', subtitle: 'Install AES-CCMP/GCMP keys + 802.11w PMF', caption: 'Protected Management Frames block spoofed deauthentication floods.', osiLayer: 2 },
  ],
  whatIfOptions: [{ id: 'wrongPassword', label: 'Wrong Passphrase (Confirm Fail)', description: 'SAE Confirm token mismatch rejects client' }],
  quiz: [
    { question: 'What key exchange replaces PSK in WPA3-Personal?', options: ['RSA', 'SAE (Dragonfly)', 'WEP IV', 'Telnet'], correctIndex: 1, explanation: 'Simultaneous Authentication of Equals (SAE / Dragonfly) resists offline brute force.' },
    { question: 'What does mandatory PMF (802.11w) in WPA3 prevent?', options: ['DNS spoofing', 'Unauthenticated deauthentication/disassociation attacks', 'BGP hijacking', 'NAT exhaustion'], correctIndex: 1, explanation: 'Protected Management Frames sign management frames so attackers cannot kick clients off Wi-Fi.' },
    { question: 'Does WPA3-SAE provide Forward Secrecy?', options: ['No', 'Yes, every SAE session produces a fresh ephemeral PMK', 'Only on port 80', 'Only with WEP'], correctIndex: 1, explanation: 'Even if the Wi-Fi password leaks later, previously captured sessions cannot be decrypted.' },
  ],
  scenario: (opts = {}) =>
    runPacketTemplates(
      wifiNodes.slice(0, 2),
      wifiLinks.slice(0, 1),
      wpa3Protocol.steps,
      [
        { stepIndex: 0, fromId: 'sta', toId: 'ap', protocol: '802.11 SAE', colorCategory: 'sec', info: 'Authentication: SAE Commit (Scalar, Element)', osiLayer: 2, sizeBytes: 128 },
        { stepIndex: 0, fromId: 'ap', toId: 'sta', protocol: '802.11 SAE', colorCategory: 'sec', info: 'Authentication: SAE Commit (Scalar, Element)', osiLayer: 2, sizeBytes: 128 },
        { stepIndex: 1, fromId: 'sta', toId: 'ap', protocol: '802.11 SAE', colorCategory: 'sec', info: 'Authentication: SAE Confirm (Send-Confirm=1)', osiLayer: 2, sizeBytes: 102 },
        { stepIndex: 1, fromId: 'ap', toId: 'sta', protocol: '802.11 SAE', colorCategory: opts.wrongPassword ? 'error' : 'sec', info: opts.wrongPassword ? 'Authentication Reject: SAE Confirm Invalid' : 'Authentication: SAE Confirm (PMK Verified!)', osiLayer: 2, sizeBytes: 102 },
        ...(opts.wrongPassword ? [] : [{ stepIndex: 2, fromId: 'ap', toId: 'sta', protocol: 'EAPOL', colorCategory: 'tls' as const, info: '4-Way Handshake + PMF Enabled (AES-GCMP-256)', osiLayer: 2, sizeBytes: 160 }]),
      ],
      opts
    ),
};

export const radiusProtocol: ProtocolEntry = {
  id: 'radius',
  name: 'RADIUS',
  fullName: 'Remote Authentication Dial-In User Service (802.1X)',
  category: 'SECURITY',
  status: 'full',
  layer: 'Layer 7 (AAA) / 802.1X EAP',
  osiLayer: 7,
  defaultPort: '1812 (Auth), 1813 (Acct)',
  transport: 'UDP (EAP-TLS / PEAP over 802.1X)',
  dataFormat: 'Attribute-Value Pairs (AVPs) + Shared Secret Authenticator',
  methods: ['Access-Request', 'Access-Challenge', 'Access-Accept', 'Access-Reject', 'Accounting-Request'],
  rfcs: [{ number: 'RFC 2865', title: 'Remote Authentication Dial In User Service (RADIUS)', url: 'https://www.rfc-editor.org/rfc/rfc2865' }],
  keywords: ['802.1x', 'aaa', '1812', 'eap', 'enterprise wifi', 'nac', 'access-accept'],
  description:
    'RADIUS centralizes Authentication, Authorization, and Accounting (AAA) for enterprise 802.1X Wi-Fi/wired switches and VPNs, bridging client EAPOL messages to an identity directory.',
  eli5: 'When you plug into an office port or join corporate Wi-Fi, the switch acts like a security guard calling HQ (the RADIUS server) to check your employee badge before opening the gate.',
  securityNotes: [
    {
      attack: 'BlastRADIUS (MD5 Collision Forgery)',
      description: 'Legacy RADIUS over UDP relies on MD5 Response Authenticator without Message-Authenticator.',
      defense: 'Require Message-Authenticator (RFC 3579) on all packets or run RadSec (RADIUS over TLS, port 2083).',
    },
  ],
  nodes: wifiNodes,
  links: wifiLinks,
  steps: [
    { title: 'EAPOL Start & Identity', subtitle: 'Supplicant sends EAP-Identity to Authenticator AP', caption: '802.1X supplicant connects; AP keeps port unauthorized and requests EAP identity.', osiLayer: 2 },
    { title: 'RADIUS Access-Request & Challenge', subtitle: 'AP relays EAP inside UDP/1812 to RADIUS', caption: 'AP wraps EAP payload into RADIUS Access-Request; RADIUS replies Access-Challenge (EAP-TLS).', osiLayer: 7 },
    { title: 'Access-Accept & Port Open', subtitle: 'RADIUS approves VLAN + MSK key', caption: 'RADIUS returns Access-Accept with Master Session Key and assigned VLAN; AP authorizes port.', osiLayer: 7 },
  ],
  whatIfOptions: [{ id: 'wrongPassword', label: 'Access-Reject (Invalid User)', description: 'RADIUS denies access and AP blocks network port' }],
  quiz: [
    { question: 'Which UDP port does RADIUS use for authentication?', options: ['389', '1812', '443', '88'], correctIndex: 1, explanation: 'RADIUS uses UDP 1812 for authentication/authorization and 1813 for accounting.' },
    { question: 'In 802.1X, what are the three architectural roles?', options: ['Root, TLD, Stub', 'Supplicant, Authenticator (Switch/AP), Authentication Server (RADIUS)', 'SYN, ACK, FIN', 'Client, Proxy, DNS'], correctIndex: 1, explanation: 'The Supplicant (device) authenticates via the Authenticator (AP/switch) to the RADIUS server.' },
    { question: 'Which modern extension protects RADIUS traffic with TLS?', options: ['RadSec (TCP 2083)', 'Telnet', 'ARP', 'DHCPv6'], correctIndex: 0, explanation: 'RadSec (RFC 6614) wraps RADIUS inside TLS to eliminate MD5 vulnerabilities.' },
  ],
  scenario: (opts = {}) =>
    runPacketTemplates(
      wifiNodes,
      wifiLinks,
      radiusProtocol.steps,
      [
        { stepIndex: 0, fromId: 'sta', toId: 'ap', protocol: 'EAPOL', colorCategory: 'sec', info: 'EAP-Response/Identity (alice@corp.local)', osiLayer: 2, sizeBytes: 88 },
        { stepIndex: 1, fromId: 'ap', toId: 'radius', protocol: 'RADIUS', colorCategory: 'sec', info: 'Access-Request (User=alice@corp.local, EAP-Message)', osiLayer: 7, isUdp: true, srcPort: 34100, dstPort: 1812, sizeBytes: 210 },
        { stepIndex: 1, fromId: 'radius', toId: 'ap', protocol: 'RADIUS', colorCategory: 'sec', info: 'Access-Challenge (EAP-TLS Server Certificate)', osiLayer: 7, isUdp: true, srcPort: 1812, dstPort: 34100, sizeBytes: 820 },
        { stepIndex: 1, fromId: 'sta', toId: 'radius', protocol: 'RADIUS', colorCategory: 'tls', info: 'EAP-TLS Client Verify -> Access-Request', osiLayer: 7, isUdp: true, srcPort: 34100, dstPort: 1812, sizeBytes: 420 },
        { stepIndex: 2, fromId: 'radius', toId: 'ap', protocol: 'RADIUS', colorCategory: opts.wrongPassword ? 'error' : 'sec', info: opts.wrongPassword ? 'Access-Reject (Invalid Credentials / Revoked Cert)' : 'Access-Accept (VLAN=20, MS-MPPE-Keys)', osiLayer: 7, isUdp: true, srcPort: 1812, dstPort: 34100, sizeBytes: 180 },
      ],
      opts
    ),
};
