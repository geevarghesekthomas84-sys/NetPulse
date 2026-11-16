import { runPacketTemplates } from '../helpers';
import type { ProtocolEntry, ProtocolLinkDef, ProtocolNodeDef, ProtocolStepDef } from '../types';

const nodes: ProtocolNodeDef[] = [
  { id: 'hostA', label: 'Laptop A', ip: '192.168.1.10', role: 'host', x: 150, y: 180, mac: '02:42:ac:11:00:10' },
  { id: 'switch', label: 'Switch (8 ports)', ip: '192.168.1.2', role: 'switch', x: 500, y: 240, mac: '02:42:ac:11:00:02' },
  { id: 'hostB', label: 'File Server', ip: '192.168.1.20', role: 'file_server', x: 850, y: 180, mac: '02:42:ac:11:00:20' },
  { id: 'hostC', label: 'Printer / Host C', ip: '192.168.1.30', role: 'tv_box', x: 500, y: 410, mac: '02:42:ac:11:00:30' },
];

const links: ProtocolLinkDef[] = [
  { id: 'l1', sourceId: 'hostA', targetId: 'switch', delayMs: 2 },
  { id: 'l2', sourceId: 'switch', targetId: 'hostB', delayMs: 2 },
  { id: 'l3', sourceId: 'switch', targetId: 'hostC', delayMs: 2 },
];

const steps: ProtocolStepDef[] = [
  { title: 'ARP Broadcast', subtitle: 'Who has 192.168.1.20? -> ff:ff:ff:ff:ff:ff', caption: 'Laptop A needs File Server’s MAC address and emits an Ethernet broadcast ARP Request.', osiLayer: 2 },
  { title: 'Switch Flood & Learn', subtitle: 'Switch learns MAC-A on Port 1 & floods', caption: 'Switch records 02:42:ac:11:00:10 on Port 1 and floods the broadcast frame to Ports 2 and 3.', osiLayer: 2 },
  { title: 'ARP Unicast Reply', subtitle: 'File Server replies with its MAC address', caption: 'File Server sends an ARP Reply directly to Laptop A’s MAC; Switch learns MAC-B on Port 2.', osiLayer: 2 },
  { title: 'Unicast Ethernet Frame', subtitle: 'Switched directly Port 1 -> Port 2', caption: 'Subsequent Ethernet frames (802.1Q / IPv4) are forwarded only to Port 2, never flooded to Host C.', osiLayer: 2 },
];

export const ethernetProtocol: ProtocolEntry = {
  id: 'ethernet',
  name: 'Ethernet / ARP',
  fullName: 'IEEE 802.3 Ethernet & Address Resolution Protocol',
  category: 'CORE',
  status: 'full',
  layer: 'Layer 2 (Data Link) / Network Access',
  osiLayer: 2,
  defaultPort: 'N/A (EtherType 0x0800 / 0x0806 / 0x8100)',
  transport: 'Physical Media (Cat6 / Fiber)',
  dataFormat: '14-byte Frame Header + 46–1500B Payload + 4B FCS',
  methods: ['ARP Request', 'ARP Reply', 'Unicast Frame', '802.1Q VLAN Tag'],
  rfcs: [
    { number: 'RFC 826', title: 'Ethernet Address Resolution Protocol (ARP)', url: 'https://www.rfc-editor.org/rfc/rfc826' },
    { number: 'IEEE 802.3', title: 'Ethernet Standard', url: 'https://www.rfc-editor.org/rfc/rfc894' },
  ],
  keywords: ['mac', 'arp', 'switch', 'frame', 'vlan', '802.1q', 'broadcast', 'unicast', 'fcs'],
  description:
    'Ethernet frames carry packets across local links using 48-bit MAC addresses. Switches dynamically learn MAC-to-port mappings, while ARP maps IPv4 addresses to MAC addresses.',
  eli5: 'IP addresses are like names on an envelope, while MAC addresses are the exact apartment mailbox numbers in the building. ARP shouts "Who lives in 192.168.1.20?" so the mail carrier knows which mailbox to use.',
  securityNotes: [
    {
      attack: 'ARP Spoofing / Cache Poisoning',
      description: 'An attacker sends unsolicited ARP replies claiming to own the gateway’s IP, intercepting all LAN traffic (MITM).',
      defense: 'Enable Dynamic ARP Inspection (DAI) with DHCP Snooping on managed switches.',
    },
    {
      attack: 'MAC Flooding',
      description: 'Overflowing a switch’s CAM table forces it to fail open as a hub and flood all frames.',
      defense: 'Enforce Port Security limiting learned MACs per switchport.',
    },
  ],
  nodes,
  links,
  steps,
  whatIfOptions: [
    { id: 'packetLoss', label: 'Duplicate IP / ARP Conflict', description: 'Another host replies claiming the same IP' },
  ],
  quiz: [
    {
      question: 'Which MAC address is used for an Ethernet broadcast frame (like ARP Request)?',
      options: ['00:00:00:00:00:00', 'ff:ff:ff:ff:ff:ff', '01:00:5e:00:00:01', 'fe:80:00:00:00:00'],
      correctIndex: 1,
      explanation: 'All-ones (ff:ff:ff:ff:ff:ff) instructs switches to flood the frame out every port in the broadcast domain.',
    },
    {
      question: 'How does an Ethernet switch learn which port a device is connected to?',
      options: ['By reading the destination IP', 'By inspecting the source MAC address of incoming frames', 'By running DNS queries', 'By reading TCP sequence numbers'],
      correctIndex: 1,
      explanation: 'Switches inspect the Source MAC field of every arriving frame and bind it to the ingress port.',
    },
    {
      question: 'What is the EtherType value for ARP?',
      options: ['0x0800', '0x0806', '0x86DD', '0x8100'],
      correctIndex: 1,
      explanation: '0x0806 identifies ARP, 0x0800 identifies IPv4, 0x86DD identifies IPv6, and 0x8100 identifies 802.1Q VLAN.',
    },
    {
      question: 'What is the standard maximum payload (MTU) of an untagged Ethernet II frame?',
      options: ['576 bytes', '1500 bytes', '4096 bytes', '65535 bytes'],
      correctIndex: 1,
      explanation: 'Standard Ethernet II supports a 1500-byte payload MTU.',
    },
    {
      question: 'Which switch security feature prevents ARP spoofing?',
      options: ['Dynamic ARP Inspection (DAI)', 'Spanning Tree', 'RIP v2', 'ICMP Redirect'],
      correctIndex: 0,
      explanation: 'DAI validates ARP packets against trusted DHCP snooping bindings.',
    },
  ],
  scenario: (opts = {}) => {
    const templates = [
      {
        stepIndex: 0, fromId: 'hostA', toId: 'switch', protocol: 'ARP', colorCategory: 'l2' as const,
        info: 'Who has 192.168.1.20? Tell 192.168.1.10 (Broadcast)', osiLayer: 2, sizeBytes: 60,
        isArp: { opcode: 1 as const, targetIp: '192.168.1.20' },
      },
      {
        stepIndex: 1, fromId: 'switch', toId: 'hostB', protocol: 'ARP', colorCategory: 'l2' as const,
        info: 'Flood Port 2: Who has 192.168.1.20?', osiLayer: 2, sizeBytes: 60,
        isArp: { opcode: 1 as const, targetIp: '192.168.1.20' },
      },
      {
        stepIndex: 1, fromId: 'switch', toId: 'hostC', protocol: 'ARP', colorCategory: 'l2' as const,
        info: 'Flood Port 3: Who has 192.168.1.20? (Ignored by Host C)', osiLayer: 2, sizeBytes: 60,
        isArp: { opcode: 1 as const, targetIp: '192.168.1.20' },
      },
      {
        stepIndex: 2, fromId: 'hostB', toId: 'switch', protocol: 'ARP', colorCategory: 'l2' as const,
        info: '192.168.1.20 is at 02:42:ac:11:00:20', osiLayer: 2, sizeBytes: 60,
        isArp: { opcode: 2 as const, targetIp: '192.168.1.10' },
      },
      {
        stepIndex: 2, fromId: 'switch', toId: 'hostA', protocol: 'ARP', colorCategory: 'l2' as const,
        info: 'Unicast Port 1: 192.168.1.20 is at 02:42:ac:11:00:20', osiLayer: 2, sizeBytes: 60,
        isArp: { opcode: 2 as const, targetIp: '192.168.1.10' },
      },
      ...(opts.packetLoss
        ? [
            {
              stepIndex: 2, fromId: 'hostC', toId: 'hostA', protocol: 'ARP', colorCategory: 'error' as const,
              info: 'Gratuitous ARP Conflict! 192.168.1.20 is ALSO at 02:42:ac:11:00:30', osiLayer: 2, sizeBytes: 60,
              isArp: { opcode: 2 as const, targetIp: '192.168.1.10' },
            },
          ]
        : []),
      {
        stepIndex: 3, fromId: 'hostA', toId: 'switch', protocol: 'Ethernet', colorCategory: 'tcp' as const,
        info: '802.1Q VLAN 10 Unicast Frame -> 02:42:ac:11:00:20', osiLayer: 2, vlanId: 10, sizeBytes: 128,
        tcpFlags: { psh: true, ack: true },
      },
      {
        stepIndex: 3, fromId: 'switch', toId: 'hostB', protocol: 'Ethernet', colorCategory: 'tcp' as const,
        info: 'Switched directly Port 1 -> Port 2 (Host C sees nothing)', osiLayer: 2, vlanId: 10, sizeBytes: 128,
        tcpFlags: { psh: true, ack: true },
      },
    ];
    return runPacketTemplates(nodes, links, steps, templates, opts);
  },
};
