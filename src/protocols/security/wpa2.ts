import { runPacketTemplates } from '../helpers';
import type { ProtocolEntry, ProtocolLinkDef, ProtocolNodeDef, ProtocolStepDef } from '../types';

const nodes: ProtocolNodeDef[] = [
  { id: 'sta', label: 'Phone / STA', ip: '192.168.1.40', role: 'phone', x: 160, y: 250, mac: '02:42:ac:11:00:40' },
  { id: 'ap', label: 'Wi-Fi AP', ip: '192.168.1.2', role: 'access_point', x: 520, y: 250, mac: '02:42:ac:11:00:02' },
  { id: 'router', label: 'Gateway Router', ip: '192.168.1.1', role: 'router', x: 840, y: 250, mac: '02:42:ac:11:00:01' },
];

const links: ProtocolLinkDef[] = [
  { id: 'l1', sourceId: 'sta', targetId: 'ap', delayMs: 4 },
  { id: 'l2', sourceId: 'ap', targetId: 'router', delayMs: 2 },
];

const steps: ProtocolStepDef[] = [
  { title: '802.11 Auth & Association', subtitle: 'Probe, Open Auth & Association Request', caption: 'Station discovers SSID via Beacon/Probe and associates with the Access Point.', osiLayer: 2 },
  { title: '4-Way Handshake Msg 1 (ANonce)', subtitle: 'AP sends random ANonce to STA', caption: 'Both share PMK (from PSK); AP sends ANonce so STA can derive the session PTK.', osiLayer: 2 },
  { title: '4-Way Handshake Msg 2 (SNonce + MIC)', subtitle: 'STA replies with SNonce & MIC', caption: 'STA computes PTK, returns SNonce plus a Message Integrity Code proving it knows the password.', osiLayer: 2 },
  { title: 'Msg 3 & 4 + Encrypted Traffic', subtitle: 'Install GTK/PTK & encrypt 802.11 frames', caption: 'AP delivers Group Temporal Key (GTK), STA confirms Msg 4, and AES-CCMP data flows.', osiLayer: 2 },
];

export const wpa2Protocol: ProtocolEntry = {
  id: 'wpa2',
  name: 'Wi-Fi WPA2',
  fullName: 'IEEE 802.11i WPA2-PSK (4-Way Handshake)',
  category: 'SECURITY',
  status: 'full',
  layer: 'Layer 2 (Wireless Data Link)',
  osiLayer: 2,
  defaultPort: 'N/A (EtherType 0x888E EAPOL)',
  transport: 'IEEE 802.11 Wireless Frames',
  dataFormat: 'EAPOL-Key Frames + AES-CCMP Encrypted MPDUs',
  methods: ['Probe', 'Auth', 'Assoc', 'EAPOL Msg 1', 'EAPOL Msg 2', 'EAPOL Msg 3', 'EAPOL Msg 4'],
  rfcs: [{ number: 'IEEE 802.11i', title: 'Wireless LAN Medium Access Control Security', url: 'https://www.rfc-editor.org/rfc/rfc5246' }],
  keywords: ['wifi', 'wireless', 'eapol', '4-way handshake', 'psk', 'aes-ccmp', 'pmk', 'ptk', 'anonce'],
  description:
    'WPA2 secures Wi-Fi networks using a 4-way EAPOL-Key handshake between the client and Access Point to prove both know the PSK without ever transmitting it over the air, deriving fresh AES-CCMP encryption keys.',
  eli5: 'Even if two friends share a secret password, they don’t shout it in a crowded room. Each picks a random number, mixes it with the password, and checks if the other gets the same secret result.',
  securityNotes: [
    {
      attack: 'KRACK & Offline PMKID/Handshake Cracking',
      description: 'Capturing EAPOL Msg 1–2 allows offline GPU dictionary attacks against weak Wi-Fi passphrases; KRACK replays Msg 3 to reset nonces.',
      defense: 'Use long random passphrases (16+ chars) or upgrade to WPA3-SAE (Dragonfly) which resists offline dictionary attacks.',
    },
  ],
  nodes,
  links,
  steps,
  whatIfOptions: [
    { id: 'wrongPassword', label: 'Wrong Wi-Fi Password', description: 'MIC verification fails at AP on EAPOL Msg 2 -> Deauth' },
  ],
  quiz: [
    {
      question: 'Does the WPA2 4-way handshake ever send the Wi-Fi password across the air?',
      options: ['Yes, in Msg 1', 'No, it sends ANonce/SNonce and a cryptographic MIC', 'Yes, inside DNS', 'Only in Msg 4'],
      correctIndex: 1,
      explanation: 'The PSK never crosses the air; peers prove knowledge of PMK via a MIC over the nonces.',
    },
    {
      question: 'Which cipher suite is mandatory in WPA2?',
      options: ['RC4 (WEP)', 'AES-CCMP', 'DES', 'ROT13'],
      correctIndex: 1,
      explanation: 'WPA2 mandates AES-CCMP for strong confidentiality and integrity.',
    },
    {
      question: 'What EtherType carries WPA2 4-way handshake frames?',
      options: ['0x0800', '0x0806', '0x888E (EAPOL)', '0x86DD'],
      correctIndex: 2,
      explanation: 'EAP over LAN (EAPOL) uses EtherType 0x888E.',
    },
    {
      question: 'Why does WPA2 derive a fresh PTK per session using ANonce and SNonce?',
      options: ['So every device and session uses unique encryption keys', 'To speed up HTTP', 'To disable MAC addresses', 'To change SSID'],
      correctIndex: 0,
      explanation: 'Random nonces guarantee unique Pairwise Transient Keys even when everyone shares one PSK.',
    },
    {
      question: 'Which protocol improves upon WPA2-PSK to stop offline dictionary cracking?',
      options: ['WEP', 'WPA3-SAE', 'Telnet', 'ARP'],
      correctIndex: 1,
      explanation: 'WPA3 Simultaneous Authentication of Equals (SAE) replaces static PSK key derivation.',
    },
  ],
  scenario: (opts = {}) => {
    const templates = [
      { stepIndex: 0, fromId: 'sta', toId: 'ap', protocol: '802.11', colorCategory: 'l2' as const, info: 'Association Request (SSID="StudioWiFi", RSN=WPA2)', osiLayer: 2, sizeBytes: 112 },
      { stepIndex: 0, fromId: 'ap', toId: 'sta', protocol: '802.11', colorCategory: 'l2' as const, info: 'Association Response (Success, AID=1)', osiLayer: 2, sizeBytes: 98 },
      { stepIndex: 1, fromId: 'ap', toId: 'sta', protocol: 'EAPOL', colorCategory: 'sec' as const, info: 'Key (Message 1 of 4) [ANonce=0x8a3f...]', osiLayer: 2, sizeBytes: 135 },
      { stepIndex: 2, fromId: 'sta', toId: 'ap', protocol: 'EAPOL', colorCategory: 'sec' as const, info: 'Key (Message 2 of 4) [SNonce=0x41c9..., MIC]', osiLayer: 2, sizeBytes: 155 },
      ...(opts.wrongPassword
        ? [
            { stepIndex: 2, fromId: 'ap', toId: 'sta', protocol: '802.11', colorCategory: 'error' as const, info: 'Deauthentication (Invalid MIC - Wrong Wi-Fi Password)', osiLayer: 2, sizeBytes: 64 },
          ]
        : [
            { stepIndex: 3, fromId: 'ap', toId: 'sta', protocol: 'EAPOL', colorCategory: 'sec' as const, info: 'Key (Message 3 of 4) [Install PTK + Encrypted GTK]', osiLayer: 2, sizeBytes: 185 },
            { stepIndex: 3, fromId: 'sta', toId: 'ap', protocol: 'EAPOL', colorCategory: 'sec' as const, info: 'Key (Message 4 of 4) [Key ACK, Secure=1]', osiLayer: 2, sizeBytes: 135 },
            { stepIndex: 3, fromId: 'sta', toId: 'router', protocol: '802.11', colorCategory: 'tls' as const, info: 'AES-CCMP Encrypted Data Frame -> Internet', osiLayer: 2, sizeBytes: 512 },
          ]),
    ];
    return runPacketTemplates(nodes, links, steps, templates, opts);
  },
};
