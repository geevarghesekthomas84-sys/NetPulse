import { runPacketTemplates } from '../helpers';
import type { ProtocolEntry, ProtocolLinkDef, ProtocolNodeDef, ProtocolStepDef } from '../types';

const nodes: ProtocolNodeDef[] = [
  { id: 'client', label: 'Mail Client', ip: '192.168.1.10', role: 'host', x: 140, y: 250 },
  { id: 'dns', label: 'DNS MX Lookup', ip: '8.8.8.8', role: 'dns_server', x: 480, y: 100 },
  { id: 'mta', label: 'Mail Server (MTA)', ip: '198.51.100.25', role: 'mail_server', x: 840, y: 250, openPorts: [25, 587] },
];

const links: ProtocolLinkDef[] = [
  { id: 'l1', sourceId: 'client', targetId: 'dns', delayMs: 8 },
  { id: 'l2', sourceId: 'client', targetId: 'mta', delayMs: 14 },
];

const steps: ProtocolStepDef[] = [
  { title: 'MX Record Lookup', subtitle: 'Find mail server for recipient domain', caption: 'Sender queries DNS for the MX record of recipient.org -> mail.recipient.org (198.51.100.25).', osiLayer: 7 },
  { title: 'TCP + Greeting + EHLO', subtitle: '220 Ready -> EHLO -> 250 Capabilities', caption: 'MTA sends 220 banner; sender issues EHLO and learns STARTTLS & AUTH extensions.', osiLayer: 7 },
  { title: 'STARTTLS Upgrade', subtitle: 'Encrypt SMTP session with TLS', caption: 'STARTTLS upgrades the plaintext TCP socket to encrypted TLS before transferring email content.', osiLayer: 6 },
  { title: 'MAIL FROM / RCPT TO / DATA', subtitle: 'Envelope & message body delivery', caption: 'Sender transmits envelope addresses, email headers/MIME body, ending with <CRLF>.<CRLF> -> 250 OK.', osiLayer: 7 },
];

export const smtpProtocol: ProtocolEntry = {
  id: 'smtp',
  name: 'SMTP',
  fullName: 'Simple Mail Transfer Protocol',
  category: 'APPLICATION',
  status: 'full',
  layer: 'Layer 7 (Application)',
  osiLayer: 7,
  defaultPort: '25 (Relay), 587 (Submission), 465 (SMTPS)',
  transport: 'TCP',
  dataFormat: 'ASCII Commands + RFC 5322 MIME Message',
  methods: ['EHLO', 'STARTTLS', 'AUTH', 'MAIL FROM', 'RCPT TO', 'DATA', 'QUIT'],
  rfcs: [{ number: 'RFC 5321', title: 'Simple Mail Transfer Protocol', url: 'https://www.rfc-editor.org/rfc/rfc5321' }],
  keywords: ['email', 'mail', 'mx', 'mta', '25', '587', 'starttls', 'spf', 'dkim', 'dmarc'],
  description:
    'SMTP pushes outbound email from mail clients to submission servers (port 587) and between domain Mail Transfer Agents (port 25) after resolving DNS MX records.',
  eli5: 'SMTP is the postal truck that drops letters at the recipient’s post office (found by checking the MX address book). You announce who it’s from, who it’s for, and hand over the letter.',
  securityNotes: [
    {
      attack: 'Email Spoofing & Open Relay Abuse',
      description: 'Plain SMTP trusts the MAIL FROM header unless authenticated, letting spammers forge sender domains.',
      defense: 'Publish SPF, DKIM, and DMARC DNS policies and require authenticated submission on port 587 with TLS.',
    },
  ],
  nodes,
  links,
  steps,
  whatIfOptions: [
    { id: 'wrongPassword', label: 'AUTH Failed (535)', description: 'Submission server rejects invalid SMTP credentials' },
  ],
  quiz: [
    {
      question: 'Which DNS record tells an SMTP server where to deliver mail for a domain?',
      options: ['A', 'MX', 'PTR', 'CNAME'],
      correctIndex: 1,
      explanation: 'Mail Exchanger (MX) records specify the hostnames handling email for a domain.',
    },
    {
      question: 'Which TCP port is the modern standard for authenticated client email submission?',
      options: ['25', '110', '587', '143'],
      correctIndex: 2,
      explanation: 'Port 587 is dedicated to authenticated MSA mail submission; port 25 is server-to-server relay.',
    },
    {
      question: 'What does the STARTTLS command do in SMTP?',
      options: ['Starts a new email draft', 'Upgrades the plaintext TCP connection to TLS encryption', 'Deletes spam', 'Checks DNS'],
      correctIndex: 1,
      explanation: 'STARTTLS negotiates TLS encryption over the existing socket before AUTH or DATA.',
    },
    {
      question: 'Which sequence terminates an SMTP DATA message body?',
      options: ['EOF', 'A single period on its own line (<CRLF>.<CRLF>)', 'FIN packet', 'QUIT command inside body'],
      correctIndex: 1,
      explanation: 'RFC 5321 ends the DATA stream with a line containing only ".".',
    },
    {
      question: 'Which trio of DNS/email standards combats domain spoofing?',
      options: ['ARP, RARP, ICMP', 'SPF, DKIM, DMARC', 'NAT, PAT, CIDR', 'SYN, ACK, FIN'],
      correctIndex: 1,
      explanation: 'SPF authorizes sender IPs, DKIM cryptographically signs headers/body, and DMARC sets enforcement policy.',
    },
  ],
  scenario: (opts = {}) => {
    const templates = [
      { stepIndex: 0, fromId: 'client', toId: 'dns', protocol: 'DNS', colorCategory: 'dns' as const, info: 'Standard query MX recipient.org', osiLayer: 7, isUdp: true, srcPort: 54020, dstPort: 53, sizeBytes: 72, dns: { transactionId: 0x2201, isResponse: false, questions: [{ name: 'recipient.org', type: 'MX' }], answers: [] } },
      { stepIndex: 0, fromId: 'dns', toId: 'client', protocol: 'DNS', colorCategory: 'dns' as const, info: 'MX 10 mail.recipient.org (198.51.100.25)', osiLayer: 7, isUdp: true, srcPort: 53, dstPort: 54020, sizeBytes: 98, dns: { transactionId: 0x2201, isResponse: true, questions: [{ name: 'recipient.org', type: 'MX' }], answers: [{ name: 'recipient.org', type: 'MX', value: '198.51.100.25', ttl: 3600 }] } },
      { stepIndex: 1, fromId: 'mta', toId: 'client', protocol: 'SMTP', colorCategory: 'http_res' as const, info: 'S: 220 mail.recipient.org ESMTP Ready', osiLayer: 7, srcPort: 587, dstPort: 53900, tcpFlags: { psh: true, ack: true }, sizeBytes: 94 },
      { stepIndex: 1, fromId: 'client', toId: 'mta', protocol: 'SMTP', colorCategory: 'http_req' as const, info: 'C: EHLO client.example.com', osiLayer: 7, srcPort: 53900, dstPort: 587, tcpFlags: { psh: true, ack: true }, sizeBytes: 82 },
      { stepIndex: 2, fromId: 'client', toId: 'mta', protocol: 'SMTP', colorCategory: 'tls' as const, info: 'C: STARTTLS -> TLS 1.3 Tunnel Established', osiLayer: 6, srcPort: 53900, dstPort: 587, tcpFlags: { psh: true, ack: true }, sizeBytes: 180, tls: { recordType: 'Handshake' as const, version: 'TLS 1.3' as const, handshakeType: 'STARTTLS Upgrade' } },
      ...(opts.wrongPassword
        ? [
            { stepIndex: 3, fromId: 'mta', toId: 'client', protocol: 'SMTP', colorCategory: 'error' as const, info: 'S: 535 5.7.8 Authentication credentials invalid', osiLayer: 7, srcPort: 587, dstPort: 53900, tcpFlags: { psh: true, ack: true }, sizeBytes: 108 },
          ]
        : [
            { stepIndex: 3, fromId: 'client', toId: 'mta', protocol: 'SMTP', colorCategory: 'http_req' as const, info: 'C: MAIL FROM:<alice@example.com> / RCPT TO:<bob@recipient.org>', osiLayer: 7, srcPort: 53900, dstPort: 587, tcpFlags: { psh: true, ack: true }, sizeBytes: 145 },
            { stepIndex: 3, fromId: 'client', toId: 'mta', protocol: 'SMTP', colorCategory: 'http_req' as const, info: 'C: DATA [Subject: Hello] <CRLF>.<CRLF>', osiLayer: 7, srcPort: 53900, dstPort: 587, tcpFlags: { psh: true, ack: true }, sizeBytes: 860 },
            { stepIndex: 3, fromId: 'mta', toId: 'client', protocol: 'SMTP', colorCategory: 'http_res' as const, info: 'S: 250 2.0.0 Ok: queued as 9F81A2B', osiLayer: 7, srcPort: 587, dstPort: 53900, tcpFlags: { psh: true, ack: true }, sizeBytes: 92 },
          ]),
    ];
    return runPacketTemplates(nodes, links, steps, templates, opts);
  },
};
