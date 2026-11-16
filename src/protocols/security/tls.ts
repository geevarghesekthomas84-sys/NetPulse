import { runPacketTemplates } from '../helpers';
import type { PacketTemplate, ProtocolEntry, ProtocolLinkDef, ProtocolNodeDef, ProtocolStepDef } from '../types';

const nodes: ProtocolNodeDef[] = [
  { id: 'client', label: 'Client', ip: '192.168.1.10', role: 'host', x: 160, y: 250, mac: '02:42:ac:11:00:10' },
  { id: 'proxy', label: 'Edge Proxy', ip: '192.0.2.80', role: 'proxy', x: 500, y: 250, mac: '02:42:ac:11:00:80' },
  { id: 'server', label: 'Web Server', ip: '203.0.113.10', role: 'web_server', x: 840, y: 250, mac: '02:42:ac:11:00:90', openPorts: [443] },
];

const links: ProtocolLinkDef[] = [
  { id: 'l1', sourceId: 'client', targetId: 'proxy', delayMs: 8 },
  { id: 'l2', sourceId: 'proxy', targetId: 'server', delayMs: 12 },
];

const steps: ProtocolStepDef[] = [
  { title: 'TCP Handshake', subtitle: 'SYN / SYN-ACK / ACK on port 443', caption: 'Client opens a TCP connection to port 443 before starting TLS.', osiLayer: 4 },
  { title: 'ClientHello (TLS 1.3)', subtitle: 'Supported ciphers, SNI, X25519 key share', caption: 'Client sends ClientHello with TLS 1.3 cipher suites, SNI=example.com, and ephemeral ECDHE key share.', osiLayer: 6 },
  { title: 'ServerHello + Certificate', subtitle: '1-RTT ServerHello, EncryptedExtensions, Cert, Finished', caption: 'Server derives handshake keys immediately, sends its X25519 share, encrypted certificate chain, and Finished.', osiLayer: 6 },
  { title: 'Client Finished & App Data', subtitle: 'Encrypted AEAD Application Data (0x17)', caption: 'Client verifies certificate signature, sends Finished, and streams encrypted HTTP Application Data.', osiLayer: 6 },
];

export const tlsProtocol: ProtocolEntry = {
  id: 'tls',
  name: 'TLS / SSL',
  fullName: 'Transport Layer Security (TLS 1.3)',
  category: 'SECURITY',
  status: 'full',
  layer: 'Layer 6 (Presentation) / Session Security',
  osiLayer: 6,
  defaultPort: '443 (HTTPS), 465/587 (SMTPS), 853 (DoT)',
  transport: 'TCP',
  dataFormat: 'TLS Record Layer (5B header + AEAD encrypted payload)',
  methods: ['ClientHello', 'ServerHello', 'Certificate', 'CertificateVerify', 'Finished', 'Application Data'],
  rfcs: [
    { number: 'RFC 8446', title: 'The Transport Layer Security (TLS) Protocol Version 1.3', url: 'https://www.rfc-editor.org/rfc/rfc8446' },
  ],
  keywords: ['ssl', 'tls 1.3', 'handshake', 'certificate', 'x25519', 'aes-gcm', 'sni', 'alpn', '443', 'encryption'],
  description:
    'TLS 1.3 provides confidentiality, integrity, and server authentication in a single 1-RTT handshake using ephemeral Diffie-Hellman (ECDHE) for forward secrecy and AEAD ciphers.',
  eli5: 'Before whispering secrets, you and the server publicly mix paint colors (key exchange) to create a shared secret key nobody watching can unmix, then verify their ID badge (certificate).',
  securityNotes: [
    {
      attack: 'TLS Downgrade / POODLE / BEAST',
      description: 'An active MITM forces peers back to obsolete SSL 3.0 or TLS 1.0 ciphers with padding oracle flaws.',
      defense: 'Disable SSL/TLS < 1.2 and rely on TLS 1.3 downgrade sentinel inside ServerHello.random.',
    },
    {
      attack: 'Forged / Untrusted Certificate MITM',
      description: 'A rogue proxy presents an expired or self-signed certificate.',
      defense: 'Strictly verify X.509 chain, expiry, SAN hostname, OCSP stapling, and Certificate Transparency.',
    },
  ],
  nodes,
  links,
  steps,
  whatIfOptions: [
    { id: 'expiredCert', label: 'Expired Certificate (Alert)', description: 'Client aborts handshake with TLS Fatal Alert (certificate_expired)' },
    { id: 'packetLoss', label: 'ClientHello Lost', description: 'Drop ClientHello and observe TCP retransmission' },
  ],
  quiz: [
    {
      question: 'How many round-trips (RTTs) does a standard TLS 1.3 handshake add after TCP connects?',
      options: ['0 RTT always', '1 RTT', '2 RTTs', '4 RTTs'],
      correctIndex: 1,
      explanation: 'TLS 1.3 cuts handshake latency from 2 RTTs (TLS 1.2) down to 1 RTT by sending key shares in ClientHello.',
    },
    {
      question: 'Why are certificates encrypted in TLS 1.3?',
      options: ['To prevent passive observers from seeing server identity/metadata', 'Because TCP requires encryption', 'To disable SNI', 'To reduce MTU'],
      correctIndex: 0,
      explanation: 'After ServerHello, TLS 1.3 encrypts the Certificate and CertificateVerify messages with the handshake key.',
    },
    {
      question: 'What property guarantees past recorded traffic cannot be decrypted even if the server’s long-term private key leaks later?',
      options: ['Forward Secrecy (ECDHE)', 'SNI', 'Keep-Alive', 'Static RSA key exchange'],
      correctIndex: 0,
      explanation: 'Ephemeral Diffie-Hellman keys are discarded after each session, providing Perfect Forward Secrecy.',
    },
    {
      question: 'Which TLS extension tells the server which hostname the client wants when multiple sites share one IP?',
      options: ['ALPN', 'SNI (Server Name Indication)', 'OCSP', 'HSTS'],
      correctIndex: 1,
      explanation: 'SNI sends the target hostname in ClientHello so the server picks the right certificate.',
    },
    {
      question: 'What happens if the server presents an expired X.509 certificate?',
      options: ['TLS silently downgrades to plaintext HTTP', 'Client sends a Fatal Alert (certificate_expired) and closes the connection', 'Router renews it', 'DNS refreshes TTL'],
      correctIndex: 1,
      explanation: 'Clients abort the TLS handshake with Alert level=Fatal, description=certificate_expired.',
    },
  ],
  scenario: (opts = {}) => {
    const templates: PacketTemplate[] = [
      { stepIndex: 0, fromId: 'client', toId: 'server', protocol: 'TCP', colorCategory: 'tcp' as const, info: '53100 -> 443 [SYN] Seq=0', osiLayer: 4, srcPort: 53100, dstPort: 443, seq: 0, ack: 0, tcpFlags: { syn: true }, sizeBytes: 66 },
      { stepIndex: 0, fromId: 'server', toId: 'client', protocol: 'TCP', colorCategory: 'tcp' as const, info: '443 -> 53100 [SYN, ACK] Seq=0 Ack=1', osiLayer: 4, srcPort: 443, dstPort: 53100, seq: 0, ack: 1, tcpFlags: { syn: true, ack: true }, sizeBytes: 66 },
      { stepIndex: 0, fromId: 'client', toId: 'server', protocol: 'TCP', colorCategory: 'tcp' as const, info: '53100 -> 443 [ACK] Seq=1 Ack=1', osiLayer: 4, srcPort: 53100, dstPort: 443, seq: 1, ack: 1, tcpFlags: { ack: true }, sizeBytes: 60 },
      {
        stepIndex: 1, fromId: 'client', toId: 'server', protocol: 'TLS', colorCategory: 'tls' as const,
        info: 'ClientHello (TLS 1.3, SNI=example.com, X25519 key_share)', osiLayer: 6, srcPort: 53100, dstPort: 443, seq: 1, ack: 1, tcpFlags: { psh: true, ack: true }, sizeBytes: 517,
        tls: { recordType: 'Handshake', version: 'TLS 1.3', handshakeType: 'ClientHello', cipherSuite: 'TLS_AES_256_GCM_SHA384', sni: 'example.com', alpn: 'h2, http/1.1' },
      },
      {
        stepIndex: 2, fromId: 'server', toId: 'client', protocol: 'TLS', colorCategory: 'tls' as const,
        info: opts.expiredCert
          ? 'ServerHello + Certificate (NOT AFTER: 2023-01-01 EXPIRED!)'
          : 'ServerHello, ChangeCipherSpec, EncryptedExtensions, Certificate, Finished',
        osiLayer: 6, srcPort: 443, dstPort: 53100, seq: 1, ack: 464, tcpFlags: { psh: true, ack: true }, sizeBytes: 1420,
        tls: { recordType: 'Handshake', version: 'TLS 1.3', handshakeType: 'ServerHello + Certificate + Finished', cipherSuite: 'TLS_AES_256_GCM_SHA384', alpn: 'h2' },
      },
      ...(opts.expiredCert
        ? [
            {
              stepIndex: 3, fromId: 'client', toId: 'server', protocol: 'TLS', colorCategory: 'error' as const,
              info: 'Alert (Level: Fatal, Description: Certificate Expired (45))', osiLayer: 6, srcPort: 53100, dstPort: 443, seq: 464, ack: 1368, tcpFlags: { psh: true, ack: true, fin: true }, sizeBytes: 67,
              tls: { recordType: 'Alert' as const, version: 'TLS 1.3' as const, handshakeType: 'Fatal: certificate_expired' },
            },
          ]
        : [
            {
              stepIndex: 3, fromId: 'client', toId: 'server', protocol: 'TLS', colorCategory: 'tls' as const,
              info: 'Client Finished + Application Data [Encrypted HTTP GET /]', osiLayer: 6, srcPort: 53100, dstPort: 443, seq: 464, ack: 1368, tcpFlags: { psh: true, ack: true }, sizeBytes: 248,
              tls: { recordType: 'Application Data' as const, version: 'TLS 1.3' as const, handshakeType: 'Finished + AEAD Data', cipherSuite: 'TLS_AES_256_GCM_SHA384' },
            },
            {
              stepIndex: 3, fromId: 'server', toId: 'client', protocol: 'TLS', colorCategory: 'tls' as const,
              info: 'Application Data [Encrypted 200 OK text/html]', osiLayer: 6, srcPort: 443, dstPort: 53100, seq: 1368, ack: 658, tcpFlags: { psh: true, ack: true }, sizeBytes: 1380,
              tls: { recordType: 'Application Data' as const, version: 'TLS 1.3' as const, handshakeType: 'Encrypted HTTP/2 Response' },
            },
          ]),
    ];
    return runPacketTemplates(nodes, links, steps, templates, opts);
  },
};
