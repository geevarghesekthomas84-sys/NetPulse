import { runPacketTemplates } from '../helpers';
import type { ProtocolEntry, ProtocolLinkDef, ProtocolNodeDef } from '../types';

const appNodes: ProtocolNodeDef[] = [
  { id: 'client', label: 'Client', ip: '192.168.1.10', role: 'host', x: 160, y: 250 },
  { id: 'router', label: 'Gateway', ip: '192.168.1.1', role: 'router', x: 500, y: 250 },
  { id: 'server', label: 'Server', ip: '198.51.100.25', role: 'mail_server', x: 840, y: 250 },
];
const appLinks: ProtocolLinkDef[] = [
  { id: 'l1', sourceId: 'client', targetId: 'router', delayMs: 6 },
  { id: 'l2', sourceId: 'router', targetId: 'server', delayMs: 12 },
];

export const pop3Protocol: ProtocolEntry = {
  id: 'pop3',
  name: 'POP3',
  fullName: 'Post Office Protocol Version 3',
  category: 'APPLICATION',
  status: 'partial',
  layer: 'Layer 7 (Application)',
  osiLayer: 7,
  defaultPort: '110 (Plain), 995 (POP3S/TLS)',
  transport: 'TCP',
  dataFormat: 'ASCII Request/Response (+OK / -ERR)',
  methods: ['USER', 'PASS', 'STAT', 'LIST', 'RETR', 'DELE', 'QUIT'],
  rfcs: [{ number: 'RFC 1939', title: 'Post Office Protocol - Version 3', url: 'https://www.rfc-editor.org/rfc/rfc1939' }],
  keywords: ['email', '110', '995', 'retr', 'download', 'inbox'],
  description:
    'POP3 retrieves stored emails from a mail server to a local client in a simple download-and-delete (or keep) workflow over TCP 110 or TLS 995.',
  eli5: 'POP3 empties your P.O. box into your backpack and takes the letters home so you can read them offline.',
  securityNotes: [
    { attack: 'Cleartext Password Sniffing on Port 110', description: 'USER/PASS commands travel in plaintext without TLS.', defense: 'Always mandate POP3S (implicit TLS on port 995) or STLS.' },
  ],
  nodes: appNodes,
  links: appLinks,
  steps: [
    { title: 'TLS & Authentication', subtitle: 'USER / PASS -> +OK Logged in', caption: 'Client authenticates with mail server over POP3S (995).', osiLayer: 7 },
    { title: 'STAT & RETR', subtitle: 'Fetch message count and download email', caption: 'STAT shows mailbox count; RETR 1 downloads full RFC 5322 email.', osiLayer: 7 },
    { title: 'DELE & QUIT', subtitle: 'Mark deleted & commit UPDATE state', caption: 'QUIT commits DELE flags and closes mailbox cleanly.', osiLayer: 7 },
  ],
  whatIfOptions: [{ id: 'wrongPassword', label: '-ERR Auth Failed', description: 'Mail server rejects login credentials' }],
  quiz: [
    { question: 'Which ports do POP3 and POP3S (TLS) use?', options: ['110 and 995', '143 and 993', '25 and 587', '21 and 22'], correctIndex: 0, explanation: 'POP3 uses 110 (plaintext) and 995 (POP3S over TLS).' },
    { question: 'How does POP3 differ from IMAP for multi-device users?', options: ['POP3 syncs folders in real time', 'POP3 downloads messages locally and does not sync folder state across devices', 'POP3 uses UDP', 'POP3 sends outbound mail'], correctIndex: 1, explanation: 'POP3 is designed for single-device download; IMAP keeps folders synced on the server.' },
    { question: 'When does POP3 actually purge messages marked with DELE?', options: ['Immediately on DELE', 'When the client sends QUIT (UPDATE state)', 'On TCP SYN', 'Never'], correctIndex: 1, explanation: 'Deletions are committed only when transitioning to UPDATE via QUIT.' },
  ],
  scenario: (opts = {}) =>
    runPacketTemplates(appNodes, appLinks, pop3Protocol.steps, [
      { stepIndex: 0, fromId: 'server', toId: 'client', protocol: 'POP3', colorCategory: 'tls', info: '+OK POP3S Ready (TLS 1.3)', osiLayer: 7, srcPort: 995, dstPort: 54100, tcpFlags: { psh: true, ack: true }, sizeBytes: 84 },
      { stepIndex: 0, fromId: 'client', toId: 'server', protocol: 'POP3', colorCategory: 'http_req', info: 'USER alice / PASS ****', osiLayer: 7, srcPort: 54100, dstPort: 995, tcpFlags: { psh: true, ack: true }, sizeBytes: 92 },
      ...(opts.wrongPassword
        ? [{ stepIndex: 0, fromId: 'server', toId: 'client', protocol: 'POP3', colorCategory: 'error' as const, info: '-ERR [AUTH] Authentication failed', osiLayer: 7, srcPort: 995, dstPort: 54100, tcpFlags: { psh: true, ack: true }, sizeBytes: 88 }]
        : [
            { stepIndex: 1, fromId: 'client', toId: 'server', protocol: 'POP3', colorCategory: 'http_req' as const, info: 'STAT -> RETR 1', osiLayer: 7, srcPort: 54100, dstPort: 995, tcpFlags: { psh: true, ack: true }, sizeBytes: 76 },
            { stepIndex: 1, fromId: 'server', toId: 'client', protocol: 'POP3', colorCategory: 'http_res' as const, info: '+OK 2450 octets (Message #1 delivered)', osiLayer: 7, srcPort: 995, dstPort: 54100, tcpFlags: { psh: true, ack: true }, sizeBytes: 2450 },
            { stepIndex: 2, fromId: 'client', toId: 'server', protocol: 'POP3', colorCategory: 'http_req' as const, info: 'DELE 1 -> QUIT (+OK)', osiLayer: 7, srcPort: 54100, dstPort: 995, tcpFlags: { psh: true, ack: true }, sizeBytes: 74 },
          ]),
    ], opts),
};

export const imapProtocol: ProtocolEntry = {
  id: 'imap',
  name: 'IMAP',
  fullName: 'Internet Message Access Protocol (IMAP4rev1)',
  category: 'APPLICATION',
  status: 'full',
  layer: 'Layer 7 (Application)',
  osiLayer: 7,
  defaultPort: '143 (Plain), 993 (IMAPS/TLS)',
  transport: 'TCP',
  dataFormat: 'Tagged Bidirectional Commands + MIME Body Parts',
  methods: ['LOGIN', 'SELECT INBOX', 'FETCH', 'UID SEARCH', 'IDLE', 'LOGOUT'],
  rfcs: [{ number: 'RFC 9051', title: 'IMAP4rev2', url: 'https://www.rfc-editor.org/rfc/rfc9051' }],
  keywords: ['email', '143', '993', 'sync', 'folders', 'idle', 'inbox'],
  description:
    'IMAP synchronizes mail folders, read/starred flags, and partial MIME attachments across multiple devices while keeping authoritative state on the mail server.',
  eli5: 'IMAP is a shared cloud library: your phone, laptop, and tablet all look at the same folders and see immediately when you read or star a message.',
  securityNotes: [
    { attack: 'Plaintext IMAP Credential Theft', description: 'Port 143 without STARTTLS leaks credentials.', defense: 'Enforce IMAPS (TLS port 993) and OAuth2/XOAUTH2 tokens.' },
  ],
  nodes: appNodes,
  links: appLinks,
  steps: [
    { title: 'IMAPS TLS + LOGIN', subtitle: 'Connect port 993 & authenticate', caption: 'Client establishes TLS on port 993 and logs in with tagged command a001.', osiLayer: 7 },
    { title: 'SELECT & FETCH Headers', subtitle: 'Fetch mailbox UIDs & subject lines only', caption: 'Client inspects folder unread flags and fetches only headers before downloading attachments.', osiLayer: 7 },
    { title: 'IDLE Push Notification', subtitle: 'Server pushes * EXISTS on new mail', caption: 'IMAP IDLE keeps the socket open for instant real-time new email alerts.', osiLayer: 7 },
  ],
  whatIfOptions: [{ id: 'wrongPassword', label: 'a001 NO LOGIN failed', description: 'Server rejects IMAP login credentials' }],
  quiz: [
    { question: 'Which ports are standard for IMAP and IMAPS (TLS)?', options: ['143 and 993', '110 and 995', '25 and 465', '21 and 22'], correctIndex: 0, explanation: 'IMAP uses 143 (STARTTLS) and 993 (IMAPS implicit TLS).' },
    { question: 'Which IMAP command enables real-time push notifications without polling?', options: ['RETR', 'IDLE', 'PING', 'POLL'], correctIndex: 1, explanation: 'RFC 2177 IDLE lets the server push `* N EXISTS` immediately when mail arrives.' },
    { question: 'Can IMAP download just an email’s headers without downloading a 20MB attachment?', options: ['No', 'Yes, via partial BODYSTRUCTURE/FETCH', 'Only with POP3', 'Only via FTP'], correctIndex: 1, explanation: 'IMAP allows fetching headers or individual MIME parts on demand.' },
  ],
  scenario: (opts = {}) =>
    runPacketTemplates(appNodes, appLinks, imapProtocol.steps, [
      { stepIndex: 0, fromId: 'client', toId: 'server', protocol: 'IMAP', colorCategory: 'tls', info: 'a001 LOGIN alice **** (over IMAPS 993)', osiLayer: 7, srcPort: 54120, dstPort: 993, tcpFlags: { psh: true, ack: true }, sizeBytes: 110, tls: { recordType: 'Application Data', version: 'TLS 1.3', handshakeType: 'IMAPS Command' } },
      { stepIndex: 0, fromId: 'server', toId: 'client', protocol: 'IMAP', colorCategory: opts.wrongPassword ? 'error' : 'tls', info: opts.wrongPassword ? 'a001 NO [AUTHENTICATIONFAILED]' : 'a001 OK Logged in', osiLayer: 7, srcPort: 993, dstPort: 54120, tcpFlags: { psh: true, ack: true }, sizeBytes: 94 },
      ...(opts.wrongPassword ? [] : [
        { stepIndex: 1, fromId: 'client', toId: 'server', protocol: 'IMAP', colorCategory: 'http_req' as const, info: 'a002 SELECT INBOX -> a003 FETCH 1:5 (FLAGS ENVELOPE)', osiLayer: 7, srcPort: 54120, dstPort: 993, tcpFlags: { psh: true, ack: true }, sizeBytes: 120 },
        { stepIndex: 1, fromId: 'server', toId: 'client', protocol: 'IMAP', colorCategory: 'http_res' as const, info: '* 5 EXISTS, FETCH envelopes returned', osiLayer: 7, srcPort: 993, dstPort: 54120, tcpFlags: { psh: true, ack: true }, sizeBytes: 840 },
        { stepIndex: 2, fromId: 'client', toId: 'server', protocol: 'IMAP', colorCategory: 'http_req' as const, info: 'a004 IDLE (Waiting for push mail)', osiLayer: 7, srcPort: 54120, dstPort: 993, tcpFlags: { psh: true, ack: true }, sizeBytes: 72 },
      ]),
    ], opts),
};

const fileNodes: ProtocolNodeDef[] = [
  { id: 'client', label: 'Client', ip: '192.168.1.10', role: 'host', x: 160, y: 250 },
  { id: 'fw', label: 'Firewall (NAT)', ip: '192.168.1.1', role: 'firewall', x: 500, y: 250 },
  { id: 'filesrv', label: 'File Server', ip: '203.0.113.20', role: 'file_server', x: 840, y: 250, openPorts: [21, 445] },
];

export const ftpProtocol: ProtocolEntry = {
  id: 'ftp',
  name: 'FTP',
  fullName: 'File Transfer Protocol (Active & Passive)',
  category: 'APPLICATION',
  status: 'full',
  layer: 'Layer 7 (Application)',
  osiLayer: 7,
  defaultPort: '21 (Control), 20 (Active Data)',
  transport: 'TCP (Dual Channels)',
  dataFormat: 'ASCII Control Channel + Raw Binary Data Channel',
  methods: ['USER/PASS', 'PASV', 'PORT', 'LIST', 'RETR', 'STOR'],
  rfcs: [{ number: 'RFC 959', title: 'File Transfer Protocol', url: 'https://www.rfc-editor.org/rfc/rfc959' }],
  keywords: ['21', '20', 'pasv', 'active', 'passive', 'file transfer', 'sftp', 'ftps'],
  description:
    'FTP uses two separate TCP connections: a Control channel on port 21 for commands, and a Data channel for file transfers. Passive mode (PASV) lets clients behind NAT initiate the data connection.',
  eli5: 'FTP uses two walkie-talkies: one channel (#21) just for saying "Send file report.pdf", and a second cargo pipe where the file bytes actually travel.',
  securityNotes: [
    { attack: 'Plaintext Credentials & Data Sniffing', description: 'Standard FTP sends usernames, passwords, and file contents unencrypted.', defense: 'Replace plain FTP with SFTP (over SSH port 22) or FTPS (TLS).' },
  ],
  nodes: fileNodes,
  links: appLinks.map((l, i) => ({ ...l, sourceId: i === 0 ? 'client' : 'fw', targetId: i === 0 ? 'fw' : 'filesrv' })),
  steps: [
    { title: 'Control Channel (Port 21)', subtitle: 'USER / PASS login on TCP 21', caption: 'Client opens TCP control channel to port 21 and authenticates.', osiLayer: 7 },
    { title: 'PASV Negotiation', subtitle: 'Server opens ephemeral data port (e.g. 50120)', caption: 'In Passive mode, server tells NAT-behind client which data port to connect to.', osiLayer: 7 },
    { title: 'Data Channel Transfer (RETR)', subtitle: 'Second TCP socket transfers file bytes', caption: 'Client connects to port 50120; RETR downloads file and closes data socket.', osiLayer: 7 },
  ],
  whatIfOptions: [{ id: 'wrongPassword', label: '530 Login Incorrect', description: 'Server rejects FTP credentials on control channel' }],
  quiz: [
    { question: 'Why does FTP use Passive (PASV) mode behind home/office NAT firewalls?', options: ['Because Active mode requires the server to open a connection back to the client through NAT', 'Because PASV uses UDP', 'To encrypt files', 'To double bandwidth'], correctIndex: 0, explanation: 'In PASV mode, the client initiates both control and data TCP connections outbound.' },
    { question: 'Which ports are used by standard FTP control and active data?', options: ['22 and 23', '21 (Control) and 20 (Active Data)', '80 and 443', '445 and 139'], correctIndex: 1, explanation: 'Port 21 is control; port 20 is the server source port for active data transfers.' },
    { question: 'Which secure alternative runs over SSH port 22 instead of FTP?', options: ['TFTP', 'SFTP', 'Telnet', 'HTTP'], correctIndex: 1, explanation: 'SFTP runs over a single encrypted SSH connection on port 22.' },
  ],
  scenario: (opts = {}) =>
    runPacketTemplates(fileNodes, appLinks.map((l, i) => ({ ...l, sourceId: i === 0 ? 'client' : 'fw', targetId: i === 0 ? 'fw' : 'filesrv' })), ftpProtocol.steps, [
      { stepIndex: 0, fromId: 'client', toId: 'filesrv', protocol: 'FTP', colorCategory: 'http_req', info: 'Control 21: USER deploy / PASS ****', osiLayer: 7, srcPort: 54200, dstPort: 21, tcpFlags: { psh: true, ack: true }, sizeBytes: 88 },
      { stepIndex: 0, fromId: 'filesrv', toId: 'client', protocol: 'FTP', colorCategory: opts.wrongPassword ? 'error' : 'http_res', info: opts.wrongPassword ? '530 Login incorrect.' : '230 User logged in, proceed.', osiLayer: 7, srcPort: 21, dstPort: 54200, tcpFlags: { psh: true, ack: true }, sizeBytes: 82 },
      ...(opts.wrongPassword ? [] : [
        { stepIndex: 1, fromId: 'client', toId: 'filesrv', protocol: 'FTP', colorCategory: 'http_req' as const, info: 'PASV (Request Passive Data Port)', osiLayer: 7, srcPort: 54200, dstPort: 21, tcpFlags: { psh: true, ack: true }, sizeBytes: 68 },
        { stepIndex: 1, fromId: 'filesrv', toId: 'client', protocol: 'FTP', colorCategory: 'http_res' as const, info: '227 Entering Passive Mode (203,0,113,20,195,200) [Port 50120]', osiLayer: 7, srcPort: 21, dstPort: 54200, tcpFlags: { psh: true, ack: true }, sizeBytes: 112 },
        { stepIndex: 2, fromId: 'client', toId: 'filesrv', protocol: 'FTP', colorCategory: 'http_req' as const, info: 'Control 21: RETR build.tar.gz', osiLayer: 7, srcPort: 54200, dstPort: 21, tcpFlags: { psh: true, ack: true }, sizeBytes: 80 },
        { stepIndex: 2, fromId: 'filesrv', toId: 'client', protocol: 'FTP-DATA', colorCategory: 'tcp' as const, info: 'Data Port 50120 -> 54201 [File Payload 1460B]', osiLayer: 7, srcPort: 50120, dstPort: 54201, tcpFlags: { psh: true, ack: true }, sizeBytes: 1460 },
      ]),
    ], opts),
};

export const smbProtocol: ProtocolEntry = {
  id: 'smb',
  name: 'SMB',
  fullName: 'Server Message Block (SMBv3 File Sharing)',
  category: 'APPLICATION',
  status: 'full',
  layer: 'Layer 7 (Application)',
  osiLayer: 7,
  defaultPort: '445',
  transport: 'TCP',
  dataFormat: 'Binary SMB2/3 Header + AES-GCM Encrypted Payloads',
  methods: ['Negotiate', 'Session Setup (Kerberos/NTLM)', 'Tree Connect', 'Create/Open', 'Read/Write'],
  rfcs: [{ number: 'MS-SMB2', title: 'SMB2/3 Protocol Specification', url: 'https://www.rfc-editor.org/rfc/rfc1001' }],
  keywords: ['445', 'windows share', 'nas', 'cifs', 'smbv3', 'ntlm', 'kerberos', 'relay'],
  description:
    'SMB (port 445) powers Windows and NAS network file shares, printers, and named pipes. SMBv3 adds AES-128-GCM encryption, multichannel throughput, and signing to block relay attacks.',
  eli5: 'SMB makes a folder on a remote server look like a normal hard drive letter (Z:) on your own computer.',
  securityNotes: [
    { attack: 'SMB Relay & WannaCry (SMBv1 EternalBlue)', description: 'Legacy SMBv1 had critical RCE flaws and unsigned SMBv2 allows NTLM credential relay.', defense: 'Disable SMBv1 completely, block port 445 at internet perimeters, and require SMB Signing + Encryption.' },
  ],
  nodes: fileNodes,
  links: appLinks.map((l, i) => ({ ...l, sourceId: i === 0 ? 'client' : 'fw', targetId: i === 0 ? 'fw' : 'filesrv' })),
  steps: [
    { title: 'Negotiate Dialect (SMBv3.1.1)', subtitle: 'Agree encryption & signing capabilities', caption: 'Client and File Server negotiate SMB 3.1.1 with preauth integrity and AES-GCM.', osiLayer: 7 },
    { title: 'Session Setup & Tree Connect', subtitle: 'Authenticate + mount \\\\filesrv\\shared', caption: 'Client authenticates via Kerberos/NTLMv2 and connects to the shared folder tree.', osiLayer: 7 },
    { title: 'Create, Read & Close', subtitle: 'Encrypted file read over port 445', caption: 'Client opens report.xlsx and reads encrypted SMB3 data chunks.', osiLayer: 7 },
  ],
  whatIfOptions: [{ id: 'wrongPassword', label: 'STATUS_LOGON_FAILURE', description: 'Server rejects invalid SMB session credentials' }],
  quiz: [
    { question: 'Which TCP port does modern SMB (direct-hosted) use?', options: ['21', '139', '445', '502'], correctIndex: 2, explanation: 'Modern SMB runs directly over TCP port 445.' },
    { question: 'Which SMB security setting prevents NTLM SMB Relay attacks?', options: ['Disabling DNS', 'Requiring SMB Signing', 'Enabling SMBv1', 'Opening port 445 to the internet'], correctIndex: 1, explanation: 'SMB Signing cryptographically signs every SMB packet so relayed tokens fail.' },
    { question: 'Why should SMBv1 always be disabled?', options: ['It only works on Linux', 'It lacks modern encryption and suffered catastrophic RCE flaws like EternalBlue', 'It uses UDP', 'It limits filenames to 3 letters'], correctIndex: 1, explanation: 'SMBv1 is deprecated and insecure; SMBv3 provides modern security and performance.' },
  ],
  scenario: (opts = {}) =>
    runPacketTemplates(fileNodes, appLinks.map((l, i) => ({ ...l, sourceId: i === 0 ? 'client' : 'fw', targetId: i === 0 ? 'fw' : 'filesrv' })), smbProtocol.steps, [
      { stepIndex: 0, fromId: 'client', toId: 'filesrv', protocol: 'SMB3', colorCategory: 'http_req', info: 'Negotiate Protocol Request (Dialects: 3.0, 3.1.1)', osiLayer: 7, srcPort: 54310, dstPort: 445, tcpFlags: { psh: true, ack: true }, sizeBytes: 214 },
      { stepIndex: 0, fromId: 'filesrv', toId: 'client', protocol: 'SMB3', colorCategory: 'http_res', info: 'Negotiate Response (Dialect=3.1.1, Cipher=AES-128-GCM)', osiLayer: 7, srcPort: 445, dstPort: 54310, tcpFlags: { psh: true, ack: true }, sizeBytes: 248 },
      { stepIndex: 1, fromId: 'client', toId: 'filesrv', protocol: 'SMB3', colorCategory: 'sec', info: 'Session Setup Request (Kerberos Ticket)', osiLayer: 7, srcPort: 54310, dstPort: 445, tcpFlags: { psh: true, ack: true }, sizeBytes: 640 },
      { stepIndex: 1, fromId: 'filesrv', toId: 'client', protocol: 'SMB3', colorCategory: opts.wrongPassword ? 'error' : 'sec', info: opts.wrongPassword ? 'STATUS_LOGON_FAILURE' : 'Session Setup OK + Tree Connect \\\\filesrv\\shared', osiLayer: 7, srcPort: 445, dstPort: 54310, tcpFlags: { psh: true, ack: true }, sizeBytes: 180 },
      ...(opts.wrongPassword ? [] : [
        { stepIndex: 2, fromId: 'client', toId: 'filesrv', protocol: 'SMB3', colorCategory: 'tls' as const, info: 'Encrypted Create & Read Request (report.xlsx)', osiLayer: 7, srcPort: 54310, dstPort: 445, tcpFlags: { psh: true, ack: true }, sizeBytes: 196 },
        { stepIndex: 2, fromId: 'filesrv', toId: 'client', protocol: 'SMB3', colorCategory: 'tls' as const, info: 'Encrypted Read Response (4096 Bytes)', osiLayer: 7, srcPort: 445, dstPort: 54310, tcpFlags: { psh: true, ack: true }, sizeBytes: 1460 },
      ]),
    ], opts),
};

const plcNodes: ProtocolNodeDef[] = [
  { id: 'hmi', label: 'SCADA HMI', ip: '10.10.1.5', role: 'host', x: 140, y: 250 },
  { id: 'fw', label: 'OT Firewall', ip: '10.10.1.1', role: 'firewall', x: 500, y: 250 },
  { id: 'plc', label: 'Industrial PLC', ip: '10.10.2.50', role: 'plc', x: 860, y: 250, openPorts: [502] },
];

export const modbusProtocol: ProtocolEntry = {
  id: 'modbus',
  name: 'Modbus',
  fullName: 'Modbus TCP (Industrial Control / SCADA)',
  category: 'APPLICATION',
  status: 'full',
  layer: 'Layer 7 (Industrial OT)',
  osiLayer: 7,
  defaultPort: '502',
  transport: 'TCP',
  dataFormat: '7-byte MBAP Header + Function Code + Register Data',
  methods: ['FC 01 Read Coils', 'FC 03 Read Holding Registers', 'FC 06 Write Single Register', 'FC 16 Write Multiple'],
  rfcs: [{ number: 'Modbus TCP', title: 'Modbus Messaging on TCP/IP', url: 'https://www.rfc-editor.org/rfc/rfc1122' }],
  keywords: ['502', 'plc', 'scada', 'ics', 'ot', 'registers', 'coils', 'industrial'],
  description:
    'Modbus TCP (port 502) is the ubiquitous industrial automation protocol used by SCADA HMIs to poll sensors and write actuator registers on PLCs. By design, classic Modbus has zero authentication or encryption.',
  eli5: 'Modbus is a super simple factory language where a control screen asks a robot controller: "Read dial #40001" or "Set valve #40002 to 75%."',
  securityNotes: [
    { attack: 'Unauthenticated PLC Register Manipulation', description: 'Classic Modbus TCP has no auth—anyone who can reach port 502 can stop motors or alter setpoints.', defense: 'Segment OT networks behind strict industrial firewalls (Purdue Model) and use Modbus TCP Security (TLS).' },
  ],
  nodes: plcNodes,
  links: appLinks.map((l, i) => ({ ...l, sourceId: i === 0 ? 'hmi' : 'fw', targetId: i === 0 ? 'fw' : 'plc' })),
  steps: [
    { title: 'TCP Connect to Port 502', subtitle: 'SCADA HMI connects to PLC', caption: 'HMI opens TCP session through OT segmentation firewall to PLC port 502.', osiLayer: 4 },
    { title: 'FC 03 Read Holding Registers', subtitle: 'Read temperature & pressure registers', caption: 'HMI sends MBAP header + Function Code 03 to read 2 holding registers.', osiLayer: 7 },
    { title: 'FC 06 Write Setpoint', subtitle: 'Write valve setpoint register', caption: 'HMI updates Holding Register 0x0001 = 0x01F4 (500 RPM); PLC echoes confirmation.', osiLayer: 7 },
  ],
  whatIfOptions: [{ id: 'portClosed', label: 'OT Firewall Blocks Write', description: 'Firewall denies FC 06 write from untrusted IP' }],
  quiz: [
    { question: 'Which TCP port does Modbus TCP use?', options: ['80', '445', '502', '1883'], correctIndex: 2, explanation: 'Modbus TCP uses IANA well-known port 502.' },
    { question: 'Why must Modbus PLCs never be exposed directly to the public internet?', options: ['Modbus packets are too big', 'Classic Modbus TCP has zero built-in authentication or encryption', 'It requires IPv6', 'It breaks ARP'], correctIndex: 1, explanation: 'Anyone able to send packets to TCP/502 can issue read/write commands to the PLC.' },
    { question: 'What does Modbus Function Code 03 do?', options: ['Read Holding Registers', 'Restart PLC', 'Encrypt traffic', 'Assign IP'], correctIndex: 0, explanation: 'FC 03 reads contiguous 16-bit holding registers.' },
  ],
  scenario: (opts = {}) =>
    runPacketTemplates(plcNodes, appLinks.map((l, i) => ({ ...l, sourceId: i === 0 ? 'hmi' : 'fw', targetId: i === 0 ? 'fw' : 'plc' })), modbusProtocol.steps, [
      { stepIndex: 0, fromId: 'hmi', toId: 'plc', protocol: 'TCP', colorCategory: 'tcp', info: '54600 -> 502 [SYN] Connect PLC', osiLayer: 4, srcPort: 54600, dstPort: 502, tcpFlags: { syn: true }, sizeBytes: 66 },
      { stepIndex: 1, fromId: 'hmi', toId: 'plc', protocol: 'Modbus/TCP', colorCategory: 'http_req', info: 'Query: Trans=1, Unit=1, FC=03 Read Holding Regs (Addr=0, Qty=2)', osiLayer: 7, srcPort: 54600, dstPort: 502, tcpFlags: { psh: true, ack: true }, sizeBytes: 66 },
      { stepIndex: 1, fromId: 'plc', toId: 'hmi', protocol: 'Modbus/TCP', colorCategory: 'http_res', info: 'Response: FC=03 Reg[0]=72°C, Reg[1]=101kPa', osiLayer: 7, srcPort: 502, dstPort: 54600, tcpFlags: { psh: true, ack: true }, sizeBytes: 67 },
      { stepIndex: 2, fromId: 'hmi', toId: 'plc', protocol: 'Modbus/TCP', colorCategory: opts.portClosed ? 'error' : 'http_req', info: opts.portClosed ? 'FC=06 Write Blocked by OT Firewall ACL' : 'Query: FC=06 Write Single Register (Addr=1, Val=500)', osiLayer: 7, srcPort: 54600, dstPort: 502, tcpFlags: { psh: true, ack: true }, sizeBytes: 66, forceDrop: opts.portClosed },
      ...(opts.portClosed ? [] : [{ stepIndex: 2, fromId: 'plc', toId: 'hmi', protocol: 'Modbus/TCP', colorCategory: 'http_res' as const, info: 'Response: FC=06 Write Confirmed (Val=500)', osiLayer: 7, srcPort: 502, dstPort: 54600, tcpFlags: { psh: true, ack: true }, sizeBytes: 66 }]),
    ], opts),
};

const pppNodes: ProtocolNodeDef[] = [
  { id: 'router', label: 'Home Router', ip: '0.0.0.0', role: 'router', x: 160, y: 250 },
  { id: 'dslam', label: 'Access Concentrator', ip: '198.51.100.1', role: 'switch', x: 500, y: 250 },
  { id: 'bras', label: 'ISP BRAS / Access Server', ip: '198.51.100.10', role: 'server_rack', x: 840, y: 250 },
];

export const pppoeProtocol: ProtocolEntry = {
  id: 'pppoe',
  name: 'PPPoE',
  fullName: 'Point-to-Point Protocol over Ethernet',
  category: 'APPLICATION',
  status: 'full',
  layer: 'Layer 2 (Discovery & PPP Session)',
  osiLayer: 2,
  defaultPort: 'N/A (EtherType 0x8863 / 0x8864)',
  transport: 'Ethernet Frames (Max MTU 1492B)',
  dataFormat: 'PPPoE Discovery (PADI/PADO/PADR/PADS) + PPP LCP/CHAP/IPCP',
  methods: ['PADI', 'PADO', 'PADR', 'PADS', 'LCP', 'PAP/CHAP', 'IPCP'],
  rfcs: [{ number: 'RFC 2516', title: 'A Method for Transmitting PPP Over Ethernet (PPPoE)', url: 'https://www.rfc-editor.org/rfc/rfc2516' }],
  keywords: ['isp', 'dsl', 'fiber', 'padi', 'pado', '1492', 'mtu', 'chap', 'bras'],
  description:
    'PPPoE lets ISPs authenticate broadband subscribers (DSL/FTTH) and assign public IPv4 addresses over Ethernet using a 4-step Discovery phase (PADI/PADO/PADR/PADS) followed by PPP LCP, CHAP auth, and IPCP.',
  eli5: 'When your home router plugs into a fiber ISP line, PPPoE rings the ISP’s front desk (PADI/PADO), logs in with your ISP username/password (CHAP), and gets your public internet IP.',
  securityNotes: [
    { attack: 'PAP Cleartext Auth & MTU 1492 Blackhole', description: 'Legacy PAP sends passwords in plaintext; PPPoE adds an 8-byte header shrinking Ethernet MTU from 1500 to 1492.', defense: 'Use CHAP authentication and enable TCP MSS Clamping (1452) on home routers.' },
  ],
  nodes: pppNodes,
  links: appLinks.map((l, i) => ({ ...l, sourceId: i === 0 ? 'router' : 'dslam', targetId: i === 0 ? 'dslam' : 'bras' })),
  steps: [
    { title: 'PPPoE Discovery (PADI / PADO)', subtitle: 'Broadcast discovery -> BRAS offer', caption: 'Home Router broadcasts PADI (0x8863); ISP Access Server replies with PADO.', osiLayer: 2 },
    { title: 'Session Confirmed (PADR / PADS)', subtitle: 'Assign Session ID (e.g. 0x04a1)', caption: 'Router sends PADR; BRAS assigns Session ID in PADS.', osiLayer: 2 },
    { title: 'PPP LCP + CHAP + IPCP', subtitle: 'Authenticate & receive public IP (MTU 1492)', caption: 'Peers negotiate MTU 1492, verify CHAP hash, and IPCP assigns public IP 203.0.113.45.', osiLayer: 2 },
  ],
  whatIfOptions: [{ id: 'wrongPassword', label: 'CHAP Auth Failure', description: 'ISP rejects wrong broadband PPPoE credentials' }],
  quiz: [
    { question: 'Why is standard PPPoE MTU 1492 bytes instead of 1500 bytes?', options: ['Because fiber is slower', 'The PPP + PPPoE header consumes 8 bytes inside the 1500B Ethernet frame', 'IPv4 requires it', 'DNS uses 8 bytes'], correctIndex: 1, explanation: '6B PPPoE header + 2B PPP protocol ID = 8 bytes overhead (1500 - 8 = 1492).' },
    { question: 'What are the four PPPoE Discovery packets in order?', options: ['DISCOVER, OFFER, REQUEST, ACK', 'PADI, PADO, PADR, PADS', 'SYN, SYN-ACK, ACK, FIN', 'HELO, MAIL, RCPT, DATA'], correctIndex: 1, explanation: 'PADI -> PADO -> PADR -> PADS establishes the PPPoE Session ID.' },
    { question: 'Which PPP sub-protocol assigns the subscriber’s IPv4 address and DNS servers?', options: ['LCP', 'IPCP', 'ARP', 'BGP'], correctIndex: 1, explanation: 'IP Control Protocol (IPCP) negotiates IPv4 configuration after authentication.' },
  ],
  scenario: (opts = {}) =>
    runPacketTemplates(pppNodes, appLinks.map((l, i) => ({ ...l, sourceId: i === 0 ? 'router' : 'dslam', targetId: i === 0 ? 'dslam' : 'bras' })), pppoeProtocol.steps, [
      { stepIndex: 0, fromId: 'router', toId: 'bras', protocol: 'PPPoED', colorCategory: 'l2', info: 'PADI (Active Discovery Initiation - Broadcast)', osiLayer: 2, etherType: '0x8863', sizeBytes: 60 },
      { stepIndex: 0, fromId: 'bras', toId: 'router', protocol: 'PPPoED', colorCategory: 'l2', info: 'PADO (Active Discovery Offer: AC-Name="ISP-BRAS")', osiLayer: 2, etherType: '0x8863', sizeBytes: 78 },
      { stepIndex: 1, fromId: 'router', toId: 'bras', protocol: 'PPPoED', colorCategory: 'l2', info: 'PADR (Request) -> PADS (Session ID=0x04a1)', osiLayer: 2, etherType: '0x8863', sizeBytes: 74 },
      { stepIndex: 2, fromId: 'bras', toId: 'router', protocol: 'PPP CHAP', colorCategory: opts.wrongPassword ? 'error' : 'sec', info: opts.wrongPassword ? 'CHAP Failure (Bad ISP Credentials) -> PADT' : 'CHAP Success + IPCP Assigned IP 203.0.113.45 (MTU 1492)', osiLayer: 2, etherType: '0x8864', sizeBytes: 96 },
    ], opts),
};

const cpNodes: ProtocolNodeDef[] = [
  { id: 'phone', label: 'Guest Phone', ip: '192.168.10.25', role: 'phone', x: 140, y: 250 },
  { id: 'gw', label: 'Captive Gateway', ip: '192.168.10.1', role: 'access_point', x: 500, y: 250, openPorts: [80, 443] },
  { id: 'web', label: 'Internet Web', ip: '203.0.113.10', role: 'web_server', x: 860, y: 250 },
];

export const captivePortalProtocol: ProtocolEntry = {
  id: 'captive_portal',
  name: 'Captive Portal',
  fullName: 'Wi-Fi Captive Portal (RFC 8910 / HTTP 302 Redirect)',
  category: 'APPLICATION',
  status: 'full',
  layer: 'Layer 7 (HTTP/DHCP Intercept)',
  osiLayer: 7,
  defaultPort: '80 / 443',
  transport: 'UDP (DHCP/DNS) + TCP (HTTP 302)',
  dataFormat: 'DHCP Option 114 / HTTP 302 Redirect + Firewall MAC Allowlist',
  methods: ['DHCP Option 114', 'Captive Probe (generate_204)', '302 Redirect', 'Auth Submit', 'MAC Allowlist'],
  rfcs: [{ number: 'RFC 8910', title: 'Captive-Portal Identification in DHCP and RAs', url: 'https://www.rfc-editor.org/rfc/rfc8910' }],
  keywords: ['hotel wifi', 'airport', 'login page', '302', 'dhcp 114', 'splash page', 'walled garden'],
  description:
    'Captive portals intercept unauthenticated guest Wi-Fi devices (using DHCP Option 114 or OS connectivity probes like /generate_204) and redirect them via HTTP 302 to a login/terms page before opening the firewall.',
  eli5: 'When you join hotel Wi-Fi, the gateway holds your internet gate shut and points your browser to the check-in desk ("Accept Terms") before letting packets out.',
  securityNotes: [
    { attack: 'HTTPS Interception Warnings & MAC Spoofing', description: 'Redirecting HTTPS causes cert errors; simple MAC-based allowlists can be bypassed by cloning an authenticated guest’s MAC.', defense: 'Use DHCP Option 114 (RFC 8910) with HTTP probes and pair with per-user Passpoint/802.1X.' },
  ],
  nodes: cpNodes,
  links: appLinks.map((l, i) => ({ ...l, sourceId: i === 0 ? 'phone' : 'gw', targetId: i === 0 ? 'gw' : 'web' })),
  steps: [
    { title: 'DHCP + OS Probe', subtitle: 'Phone probes /generate_204 or reads DHCP Option 114', caption: 'OS detects captive network because probe receives HTTP 302 instead of 204 No Content.', osiLayer: 7 },
    { title: 'HTTP 302 Redirect to Login', subtitle: 'Gateway redirects to splash login page', caption: 'Guest sees hotel/airport terms & sign-in portal hosted inside the walled garden.', osiLayer: 7 },
    { title: 'Firewall Allow & Internet Open', subtitle: 'MAC/IP allowlisted -> 204 probe passes', caption: 'After sign-in, gateway permits guest MAC through NAT to the open internet.', osiLayer: 7 },
  ],
  whatIfOptions: [{ id: 'wrongPassword', label: 'Invalid Voucher Code', description: 'Portal denies voucher and keeps firewall closed' }],
  quiz: [
    { question: 'How do phones automatically pop up a hotel Wi-Fi login sheet?', options: ['They probe a known plain-HTTP URL (e.g. /generate_204) or read DHCP Option 114', 'They scan port 22', 'They send BGP UPDATE', 'They disable TLS'], correctIndex: 0, explanation: 'OS captive network assistants detect redirects on known probe URLs or RFC 8910 DHCP Option 114.' },
    { question: 'Why do captive portals redirect plain HTTP rather than HTTPS?', options: ['HTTPS is slower', 'Intercepting HTTPS triggers a TLS certificate mismatch error in browsers', 'HTTP uses UDP', 'HTTPS has no port'], correctIndex: 1, explanation: 'A gateway cannot forge a valid TLS certificate for google.com, so browsers block MITM redirects on HTTPS.' },
    { question: 'Which RFC standardizes announcing the captive portal URL directly in DHCP?', options: ['RFC 8910', 'RFC 791', 'RFC 1035', 'RFC 4271'], correctIndex: 0, explanation: 'RFC 8910 defines DHCP Option 114 for Captive-Portal API discovery.' },
  ],
  scenario: (opts = {}) =>
    runPacketTemplates(cpNodes, appLinks.map((l, i) => ({ ...l, sourceId: i === 0 ? 'phone' : 'gw', targetId: i === 0 ? 'gw' : 'web' })), captivePortalProtocol.steps, [
      { stepIndex: 0, fromId: 'phone', toId: 'gw', protocol: 'HTTP', colorCategory: 'http_req', info: 'GET /generate_204 HTTP/1.1 (OS Captive Check)', osiLayer: 7, srcPort: 54100, dstPort: 80, tcpFlags: { psh: true, ack: true }, sizeBytes: 140 },
      { stepIndex: 1, fromId: 'gw', toId: 'phone', protocol: 'HTTP', colorCategory: 'http_res', info: 'HTTP/1.1 302 Found -> Location: http://portal.wifi.local/login', osiLayer: 7, srcPort: 80, dstPort: 54100, tcpFlags: { psh: true, ack: true }, sizeBytes: 240 },
      { stepIndex: 1, fromId: 'phone', toId: 'gw', protocol: 'HTTP', colorCategory: 'http_req', info: 'POST /login (accept_terms=true&voucher=GUEST26)', osiLayer: 7, srcPort: 54101, dstPort: 80, tcpFlags: { psh: true, ack: true }, sizeBytes: 220 },
      ...(opts.wrongPassword
        ? [{ stepIndex: 2, fromId: 'gw', toId: 'phone', protocol: 'HTTP', colorCategory: 'error' as const, info: 'HTTP/1.1 401 Invalid Voucher (Firewall remains blocked)', osiLayer: 7, srcPort: 80, dstPort: 54101, tcpFlags: { psh: true, ack: true }, sizeBytes: 180 }]
        : [
            { stepIndex: 2, fromId: 'gw', toId: 'phone', protocol: 'HTTP', colorCategory: 'http_res' as const, info: '200 OK (MAC Allowlisted in Firewall)', osiLayer: 7, srcPort: 80, dstPort: 54101, tcpFlags: { psh: true, ack: true }, sizeBytes: 160 },
            { stepIndex: 2, fromId: 'phone', toId: 'web', protocol: 'HTTPS', colorCategory: 'tls' as const, info: 'Internet Traffic Permitted -> 203.0.113.10:443', osiLayer: 7, srcPort: 54102, dstPort: 443, tcpFlags: { psh: true, ack: true }, sizeBytes: 480 },
          ]),
    ], opts),
};
