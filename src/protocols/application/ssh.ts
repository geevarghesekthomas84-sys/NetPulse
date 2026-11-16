import { runPacketTemplates } from '../helpers';
import type { ProtocolEntry, ProtocolLinkDef, ProtocolNodeDef, ProtocolStepDef } from '../types';

const nodes: ProtocolNodeDef[] = [
  { id: 'client', label: 'Admin Laptop', ip: '192.168.1.10', role: 'host', x: 160, y: 250 },
  { id: 'firewall', label: 'Bastion Firewall', ip: '192.168.1.1', role: 'firewall', x: 500, y: 250 },
  { id: 'server', label: 'App Server', ip: '10.0.0.20', role: 'server_tower', x: 840, y: 250, openPorts: [22] },
];

const links: ProtocolLinkDef[] = [
  { id: 'l1', sourceId: 'client', targetId: 'firewall', delayMs: 5 },
  { id: 'l2', sourceId: 'firewall', targetId: 'server', delayMs: 8 },
];

const steps: ProtocolStepDef[] = [
  { title: 'TCP + Version Exchange', subtitle: 'SSH-2.0 banner exchange on port 22', caption: 'After TCP handshake, both peers send plaintext SSH-2.0 protocol identification banners.', osiLayer: 7 },
  { title: 'KEXINIT & Curve25519 ECDH', subtitle: 'Diffie-Hellman key exchange + host key verify', caption: 'Client and server negotiate encryption algorithms and derive shared session keys via Curve25519.', osiLayer: 6 },
  { title: 'User Authentication', subtitle: 'Ed25519 public-key signature (or password)', caption: 'Encrypted auth request signs a challenge with the user’s Ed25519 private key.', osiLayer: 7 },
  { title: 'Interactive Shell Channel', subtitle: 'Multiplexed encrypted PTY / SFTP', caption: 'Client opens session channel, allocates PTY, and runs shell commands over ChaCha20-Poly1305.', osiLayer: 7 },
];

export const sshProtocol: ProtocolEntry = {
  id: 'ssh',
  name: 'SSH',
  fullName: 'Secure Shell Protocol (SSH-2)',
  category: 'APPLICATION',
  status: 'full',
  layer: 'Layer 7 (Application)',
  osiLayer: 7,
  defaultPort: '22',
  transport: 'TCP',
  dataFormat: 'Binary Packet Protocol (Encrypted + MAC/AEAD)',
  methods: ['KEXINIT', 'KEX_ECDH', 'NEWKEYS', 'USERAUTH_REQUEST', 'CHANNEL_OPEN', 'CHANNEL_DATA'],
  rfcs: [{ number: 'RFC 4253', title: 'SSH Transport Layer Protocol', url: 'https://www.rfc-editor.org/rfc/rfc4253' }],
  keywords: ['22', 'remote shell', 'sftp', 'scp', 'ed25519', 'key exchange', 'bastion', 'terminal'],
  description:
    'SSH establishes an encrypted, mutually authenticated channel over untrusted networks for remote shell access, SFTP file transfer, and port tunneling.',
  eli5: 'SSH is like opening an armored, soundproof tunnel to a distant server where you prove who you are with an unforgeable cryptographic key instead of shouting passwords across the street.',
  securityNotes: [
    {
      attack: 'Brute-Force Password Guessing',
      description: 'Automated bots scan port 22 trying thousands of common username/password pairs.',
      defense: 'Disable PasswordAuthentication, require Ed25519 public keys, and rate-limit with fail2ban/MFA.',
    },
  ],
  nodes,
  links,
  steps,
  whatIfOptions: [
    { id: 'wrongPassword', label: 'Auth Rejected (Permission Denied)', description: 'Server rejects wrong key/password with USERAUTH_FAILURE' },
  ],
  quiz: [
    {
      question: 'Which default TCP port does SSH listen on?',
      options: ['21', '22', '23', '3389'],
      correctIndex: 1,
      explanation: 'SSH uses TCP port 22 (replacing insecure Telnet on port 23).',
    },
    {
      question: 'Why does SSH warn on first connection about an unknown host key fingerprint?',
      options: ['To verify you are connecting to the genuine server and not a MITM proxy', 'Because DNS failed', 'To reset TCP seq', 'To allocate a new IP'],
      correctIndex: 0,
      explanation: 'Checking the server’s host key fingerprint (TOFU/known_hosts) prevents man-in-the-middle interception.',
    },
    {
      question: 'Which authentication method is strongly recommended over passwords for SSH?',
      options: ['Telnet cleartext', 'Public-key authentication (e.g., Ed25519)', 'Anonymous login', 'ARP reply'],
      correctIndex: 1,
      explanation: 'Ed25519/RSA keypairs resist password brute-forcing and never transmit secrets.',
    },
    {
      question: 'Which file-transfer protocol runs natively inside an SSH channel?',
      options: ['TFTP', 'SFTP', 'FTP active mode', 'HTTP/1.0'],
      correctIndex: 1,
      explanation: 'SFTP runs as a subsystem over an encrypted SSH channel on port 22.',
    },
    {
      question: 'What happens during the SSH KEX_ECDH phase?',
      options: ['Files are compressed', 'Peers derive shared symmetric session keys using Diffie-Hellman', 'BGP routes are advertised', 'DHCP leases expire'],
      correctIndex: 1,
      explanation: 'ECDH key exchange establishes ephemeral symmetric keys for the rest of the session.',
    },
  ],
  scenario: (opts = {}) => {
    const templates = [
      { stepIndex: 0, fromId: 'client', toId: 'server', protocol: 'TCP', colorCategory: 'tcp' as const, info: '54200 -> 22 [SYN] Seq=0', osiLayer: 4, srcPort: 54200, dstPort: 22, tcpFlags: { syn: true }, sizeBytes: 66 },
      { stepIndex: 0, fromId: 'server', toId: 'client', protocol: 'SSH', colorCategory: 'http_res' as const, info: 'Server: Protocol (SSH-2.0-OpenSSH_9.6)', osiLayer: 7, srcPort: 22, dstPort: 54200, tcpFlags: { psh: true, ack: true }, sizeBytes: 98 },
      { stepIndex: 0, fromId: 'client', toId: 'server', protocol: 'SSH', colorCategory: 'http_req' as const, info: 'Client: Protocol (SSH-2.0-gg_ssh)', osiLayer: 7, srcPort: 54200, dstPort: 22, tcpFlags: { psh: true, ack: true }, sizeBytes: 90 },
      { stepIndex: 1, fromId: 'client', toId: 'server', protocol: 'SSH', colorCategory: 'tls' as const, info: 'SSH_MSG_KEXINIT + Curve25519 ECDH Init', osiLayer: 6, srcPort: 54200, dstPort: 22, tcpFlags: { psh: true, ack: true }, sizeBytes: 720, tls: { recordType: 'Handshake' as const, version: 'TLS 1.3' as const, handshakeType: 'SSH Curve25519 KEX' } },
      { stepIndex: 1, fromId: 'server', toId: 'client', protocol: 'SSH', colorCategory: 'tls' as const, info: 'KEX_ECDH_REPLY (Host Key) + NEWKEYS', osiLayer: 6, srcPort: 22, dstPort: 54200, tcpFlags: { psh: true, ack: true }, sizeBytes: 840, tls: { recordType: 'Handshake' as const, version: 'TLS 1.3' as const, handshakeType: 'SSH NEWKEYS' } },
      ...(opts.wrongPassword
        ? [
            { stepIndex: 2, fromId: 'client', toId: 'server', protocol: 'SSH', colorCategory: 'tls' as const, info: 'Encrypted USERAUTH_REQUEST (password)', osiLayer: 7, srcPort: 54200, dstPort: 22, tcpFlags: { psh: true, ack: true }, sizeBytes: 140 },
            { stepIndex: 2, fromId: 'server', toId: 'client', protocol: 'SSH', colorCategory: 'error' as const, info: 'SSH_MSG_USERAUTH_FAILURE (Permission denied)', osiLayer: 7, srcPort: 22, dstPort: 54200, tcpFlags: { psh: true, ack: true }, sizeBytes: 112 },
          ]
        : [
            { stepIndex: 2, fromId: 'client', toId: 'server', protocol: 'SSH', colorCategory: 'tls' as const, info: 'Encrypted USERAUTH_REQUEST (publickey ssh-ed25519)', osiLayer: 7, srcPort: 54200, dstPort: 22, tcpFlags: { psh: true, ack: true }, sizeBytes: 210 },
            { stepIndex: 2, fromId: 'server', toId: 'client', protocol: 'SSH', colorCategory: 'tls' as const, info: 'SSH_MSG_USERAUTH_SUCCESS', osiLayer: 7, srcPort: 22, dstPort: 54200, tcpFlags: { psh: true, ack: true }, sizeBytes: 88 },
            { stepIndex: 3, fromId: 'client', toId: 'server', protocol: 'SSH', colorCategory: 'tls' as const, info: 'CHANNEL_OPEN (session) + Encrypted Shell Command', osiLayer: 7, srcPort: 54200, dstPort: 22, tcpFlags: { psh: true, ack: true }, sizeBytes: 164 },
          ]),
    ];
    return runPacketTemplates(nodes, links, steps, templates, opts);
  },
};
