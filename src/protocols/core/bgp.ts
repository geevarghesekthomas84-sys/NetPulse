import { runPacketTemplates } from '../helpers';
import type { ProtocolEntry, ProtocolLinkDef, ProtocolNodeDef, ProtocolStepDef } from '../types';

const nodes: ProtocolNodeDef[] = [
  { id: 'as1', label: 'ISP Router AS64500', ip: '198.51.100.1', role: 'router', x: 150, y: 240, asn: 64500 },
  { id: 'as2', label: 'Transit AS64510', ip: '198.51.100.2', role: 'router', x: 500, y: 140, asn: 64510 },
  { id: 'as3', label: 'Hosting AS64511', ip: '203.0.113.1', role: 'router', x: 850, y: 240, asn: 64511 },
];

const links: ProtocolLinkDef[] = [
  { id: 'l1', sourceId: 'as1', targetId: 'as2', delayMs: 12 },
  { id: 'l2', sourceId: 'as2', targetId: 'as3', delayMs: 12 },
  { id: 'l3', sourceId: 'as1', targetId: 'as3', delayMs: 25 },
];

const steps: ProtocolStepDef[] = [
  { title: 'TCP Port 179 Session', subtitle: 'BGP peers establish TCP connection', caption: 'Autonomous Systems open a reliable TCP session on port 179 before exchanging BGP messages.', osiLayer: 7 },
  { title: 'OPEN & KEEPALIVE', subtitle: 'Peers negotiate ASN & capabilities', caption: 'AS64500 and AS64510 exchange OPEN messages with hold timers and confirm with KEEPALIVE.', osiLayer: 7 },
  { title: 'UPDATE (Prefix Announcement)', subtitle: 'AS64511 advertises 203.0.113.0/24', caption: 'Hosting AS64511 sends BGP UPDATE carrying NLRI 203.0.113.0/24 and AS_PATH [64511].', osiLayer: 7 },
  { title: 'Path Selection & Propagation', subtitle: 'AS64510 prepends ASN & forwards', caption: 'Transit AS64510 prepends 64510 -> AS_PATH [64510, 64511] and compares against direct link.', osiLayer: 7 },
];

export const bgpProtocol: ProtocolEntry = {
  id: 'bgp',
  name: 'BGP',
  fullName: 'Border Gateway Protocol (BGP-4)',
  category: 'CORE',
  status: 'full',
  layer: 'Layer 7 (Application) / Control Plane over TCP',
  osiLayer: 7,
  defaultPort: '179',
  transport: 'TCP',
  dataFormat: 'Binary BGP Messages (OPEN, UPDATE, KEEPALIVE, NOTIFICATION)',
  methods: ['OPEN', 'UPDATE', 'KEEPALIVE', 'NOTIFICATION', 'ROUTE-REFRESH'],
  rfcs: [
    { number: 'RFC 4271', title: 'A Border Gateway Protocol 4 (BGP-4)', url: 'https://www.rfc-editor.org/rfc/rfc4271' },
  ],
  keywords: ['asn', 'autonomous system', 'routing', 'prefix', 'as_path', '179', 'peering', 'internet backbone'],
  description:
    'BGP is the exterior routing protocol that glues together the global internet’s Autonomous Systems (ISPs, clouds, CDNs) by exchanging reachable IP prefixes and AS_PATH loop-free attributes.',
  eli5: 'BGP is how postal hubs across different countries tell each other: "To reach ZIP code 203.0.113.0/24, pass the letter through Hub 64510 and Hub 64511."',
  securityNotes: [
    {
      attack: 'BGP Prefix Hijacking',
      description: 'A rogue AS announces a more-specific IP prefix it does not own, blackholing or intercepting global traffic.',
      defense: 'Sign Route Origin Authorizations (ROAs) with RPKI and enforce IRR/MANRS route filtering.',
    },
  ],
  nodes,
  links,
  steps,
  whatIfOptions: [
    { id: 'packetLoss', label: 'Link Flap & Re-converge', description: 'Primary link fails and BGP withdraws route via UPDATE' },
  ],
  quiz: [
    {
      question: 'Which TCP port does BGP use for peering sessions?',
      options: ['53', '179', '520', '443'],
      correctIndex: 1,
      explanation: 'BGP runs over TCP port 179 for reliable incremental route updates.',
    },
    {
      question: 'How does BGP prevent routing loops between Autonomous Systems?',
      options: ['By checking TTL=0', 'By rejecting routes whose AS_PATH already contains its own ASN', 'By disabling UDP', 'By flooding ARP'],
      correctIndex: 1,
      explanation: 'If a router sees its own ASN in the AS_PATH attribute, it discards the UPDATE.',
    },
    {
      question: 'Which BGP message advertises or withdraws IP prefixes?',
      options: ['OPEN', 'UPDATE', 'KEEPALIVE', 'SYN'],
      correctIndex: 1,
      explanation: 'UPDATE messages carry withdrawn routes, path attributes, and NLRI prefixes.',
    },
    {
      question: 'What technology cryptographically validates that an ASN is authorized to originate a prefix?',
      options: ['RPKI (Resource Public Key Infrastructure)', 'NAT', 'WPA3', 'SNMP'],
      correctIndex: 0,
      explanation: 'RPKI ROAs bind IP prefixes to authorized origin ASNs.',
    },
    {
      question: 'In BGP best-path selection (assuming equal Local Pref), which attribute is normally preferred?',
      options: ['Longest AS_PATH', 'Shortest AS_PATH', 'Highest MAC address', 'Smallest MTU'],
      correctIndex: 1,
      explanation: 'BGP prefers shorter AS_PATHs when Local Preference is tied.',
    },
  ],
  scenario: (opts = {}) => {
    const templates = [
      {
        stepIndex: 0, fromId: 'as1', toId: 'as2', protocol: 'TCP', colorCategory: 'tcp' as const,
        info: 'BGP Transport 51200 -> 179 [SYN] Seq=0', osiLayer: 4, srcPort: 51200, dstPort: 179, tcpFlags: { syn: true }, sizeBytes: 66,
      },
      {
        stepIndex: 0, fromId: 'as2', toId: 'as1', protocol: 'TCP', colorCategory: 'tcp' as const,
        info: 'BGP Transport 179 -> 51200 [SYN, ACK]', osiLayer: 4, srcPort: 179, dstPort: 51200, tcpFlags: { syn: true, ack: true }, sizeBytes: 66,
      },
      {
        stepIndex: 1, fromId: 'as1', toId: 'as2', protocol: 'BGP', colorCategory: 'routing' as const,
        info: 'OPEN (My AS=64500, Hold=180, ID=198.51.100.1)', osiLayer: 7, srcPort: 51200, dstPort: 179, tcpFlags: { psh: true, ack: true }, sizeBytes: 98,
        app: { protocolName: 'BGP', summary: 'OPEN AS64500', fields: [{ key: 'My AS', value: '64500' }, { key: 'Hold Time', value: '180s' }] },
      },
      {
        stepIndex: 1, fromId: 'as2', toId: 'as1', protocol: 'BGP', colorCategory: 'routing' as const,
        info: 'OPEN + KEEPALIVE (My AS=64510)', osiLayer: 7, srcPort: 179, dstPort: 51200, tcpFlags: { psh: true, ack: true }, sizeBytes: 117,
        app: { protocolName: 'BGP', summary: 'OPEN AS64510 + KEEPALIVE', fields: [{ key: 'My AS', value: '64510' }] },
      },
      {
        stepIndex: 2, fromId: 'as3', toId: 'as2', protocol: 'BGP', colorCategory: 'routing' as const,
        info: 'UPDATE NLRI: 203.0.113.0/24 AS_PATH=[64511]', osiLayer: 7, srcPort: 179, dstPort: 51201, tcpFlags: { psh: true, ack: true }, sizeBytes: 110,
        app: { protocolName: 'BGP', summary: 'UPDATE 203.0.113.0/24', fields: [{ key: 'NLRI', value: '203.0.113.0/24' }, { key: 'AS_PATH', value: '64511' }, { key: 'ORIGIN', value: 'IGP' }] },
      },
      {
        stepIndex: 3, fromId: 'as2', toId: 'as1', protocol: 'BGP', colorCategory: 'routing' as const,
        info: 'UPDATE NLRI: 203.0.113.0/24 AS_PATH=[64510, 64511]', osiLayer: 7, srcPort: 179, dstPort: 51200, tcpFlags: { psh: true, ack: true }, sizeBytes: 114,
        app: { protocolName: 'BGP', summary: 'UPDATE 203.0.113.0/24', fields: [{ key: 'AS_PATH', value: '64510 64511' }] },
      },
      ...(opts.packetLoss
        ? [
            {
              stepIndex: 3, fromId: 'as2', toId: 'as1', protocol: 'BGP', colorCategory: 'error' as const,
              info: 'UPDATE Withdrawn: 203.0.113.0/24 (Link flap -> failover direct AS64511)', osiLayer: 7, srcPort: 179, dstPort: 51200, tcpFlags: { psh: true, ack: true }, sizeBytes: 96,
            },
          ]
        : []),
    ];
    return runPacketTemplates(nodes, links, steps, templates, opts);
  },
};
