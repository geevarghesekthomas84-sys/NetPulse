import { runPacketTemplates } from '../helpers';
import type { ProtocolEntry, ProtocolLinkDef, ProtocolNodeDef, ProtocolStepDef } from '../types';

const nodes: ProtocolNodeDef[] = [
  { id: 'client', label: 'Client', ip: '192.168.1.10', role: 'host', x: 110, y: 240, mac: '02:42:ac:11:00:10' },
  { id: 'resolver', label: 'Recursive 8.8.8.8', ip: '8.8.8.8', role: 'dns_server', x: 380, y: 240, mac: '02:42:ac:11:00:88' },
  { id: 'root', label: 'Root (.)', ip: '198.41.0.4', role: 'dns_server', x: 760, y: 80, mac: '02:42:ac:11:00:41' },
  { id: 'tld', label: '.com TLD', ip: '192.5.6.30', role: 'dns_server', x: 840, y: 240, mac: '02:42:ac:11:00:30' },
  { id: 'auth', label: 'Authoritative NS', ip: '198.51.100.53', role: 'dns_server', x: 760, y: 400, mac: '02:42:ac:11:00:53' },
];

const links: ProtocolLinkDef[] = [
  { id: 'l1', sourceId: 'client', targetId: 'resolver', delayMs: 8 },
  { id: 'l2', sourceId: 'resolver', targetId: 'root', delayMs: 14 },
  { id: 'l3', sourceId: 'resolver', targetId: 'tld', delayMs: 14 },
  { id: 'l4', sourceId: 'resolver', targetId: 'auth', delayMs: 14 },
];

const steps: ProtocolStepDef[] = [
  { title: 'Stub Query', subtitle: 'Client sends recursive query to 8.8.8.8', caption: 'OS stub resolver checks local cache, misses, and sends a UDP/53 recursive query (RD=1).', osiLayer: 7 },
  { title: 'Root Referral', subtitle: 'Root server refers to .com TLD', caption: 'Root nameserver (a.root-servers.net) responds with NS delegation for the .com top-level domain.', osiLayer: 7 },
  { title: 'TLD Referral', subtitle: '.com TLD refers to example.com NS', caption: '.com TLD nameserver returns the authoritative nameserver IP 198.51.100.53.', osiLayer: 7 },
  { title: 'Authoritative Answer', subtitle: 'Authoritative NS returns A record + TTL', caption: 'Authoritative server returns A 203.0.113.10 with AA=1 and TTL=300 seconds.', osiLayer: 7 },
  { title: 'Cache & Reply', subtitle: 'Resolver caches & replies to Client', caption: 'Recursive resolver caches the answer for 300s and delivers it to the client.', osiLayer: 7 },
];

export const dnsProtocol: ProtocolEntry = {
  id: 'dns',
  name: 'DNS',
  fullName: 'Domain Name System',
  category: 'CORE',
  status: 'full',
  layer: 'Layer 7 (Application) / TCP-IP Application',
  osiLayer: 7,
  defaultPort: '53',
  transport: 'UDP (queries), TCP (zone transfers / >512B)',
  dataFormat: 'Binary DNS Wire Format (Header + QNAME labels + RRs)',
  methods: ['A', 'AAAA', 'CNAME', 'MX', 'NS', 'TXT', 'PTR', 'SRV'],
  rfcs: [
    { number: 'RFC 1034', title: 'Domain Names - Concepts and Facilities', url: 'https://www.rfc-editor.org/rfc/rfc1034' },
    { number: 'RFC 1035', title: 'Domain Names - Implementation and Specification', url: 'https://www.rfc-editor.org/rfc/rfc1035' },
  ],
  keywords: ['domain', 'resolver', 'root', 'tld', 'authoritative', 'ttl', 'cache', '53', 'a record'],
  description:
    'DNS translates human-readable domain names into IP addresses using a globally distributed, hierarchical tree of root, TLD, and authoritative nameservers backed by TTL-based caching.',
  eli5: 'DNS is the internet’s phonebook: you ask for "example.com" and it walks from the country directory (root) to the city book (.com) to find the exact street number (203.0.113.10).',
  securityNotes: [
    {
      attack: 'DNS Cache Poisoning',
      description: 'An attacker races spoofed UDP replies with guessed transaction IDs to inject rogue IP records into a resolver cache.',
      defense: 'Use DNSSEC cryptographic signatures, source port randomization, and DoH/DoT.',
    },
    {
      attack: 'DNS Amplification DDoS',
      description: 'Spoofing a victim’s source IP in small ANY/TXT queries triggers huge responses directed at the victim.',
      defense: 'Deploy BCP 38 egress filtering and Response Rate Limiting (RRL) on resolvers.',
    },
  ],
  nodes,
  links,
  steps,
  whatIfOptions: [
    { id: 'dnsCacheHit', label: 'Resolver Cache Hit', description: '8.8.8.8 already has a warm cached entry' },
    { id: 'packetLoss', label: 'UDP Query Dropped', description: 'First query is lost and client retries after timeout' },
    { id: 'serverDown', label: 'Authoritative NS Down', description: 'SERVFAIL / timeout when authoritative server is down' },
  ],
  quiz: [
    {
      question: 'Which port and transport protocol does standard DNS use for short queries?',
      options: ['TCP 80', 'UDP 53', 'UDP 67', 'TCP 443'],
      correctIndex: 1,
      explanation: 'DNS uses UDP port 53 for low-latency single-packet queries, falling back to TCP 53 for large responses.',
    },
    {
      question: 'What does the TTL value in a DNS record control?',
      options: ['Router hop limit', 'How long resolvers may cache the record', 'Maximum packet size', 'TLS certificate lifetime'],
      correctIndex: 1,
      explanation: 'Time To Live in DNS tells caches how many seconds to store the record before re-querying.',
    },
    {
      question: 'Which DNS server sits at the very top of the hierarchy?',
      options: ['TLD server', 'Root server (.)', 'Stub resolver', 'DHCP server'],
      correctIndex: 1,
      explanation: 'Root nameservers answer referrals for top-level domains like .com, .org, and .net.',
    },
    {
      question: 'Which DNS record type maps a domain name to an IPv6 address?',
      options: ['A', 'AAAA', 'CNAME', 'MX'],
      correctIndex: 1,
      explanation: 'AAAA ("quad-A") records store 128-bit IPv6 addresses.',
    },
    {
      question: 'What is the difference between a recursive query and an iterative query?',
      options: ['Recursive asks the server to return the final answer; iterative may return referrals', 'Iterative is encrypted', 'Recursive uses TCP only', 'There is no difference'],
      correctIndex: 0,
      explanation: 'Stub clients send recursive queries (RD=1) to 8.8.8.8, which then sends iterative queries to root/TLD/auth.',
    },
  ],
  scenario: (opts = {}) => {
    const tx = 0x7c21;
    const templates = [
      {
        stepIndex: 0,
        fromId: 'client',
        toId: 'resolver',
        protocol: 'DNS',
        colorCategory: 'dns' as const,
        info: `Standard query 0x${tx.toString(16)} A api.example.com (RD=1)`,
        osiLayer: 7,
        isUdp: true,
        srcPort: 53812,
        dstPort: 53,
        sizeBytes: 75,
        dns: { transactionId: tx, isResponse: false, questions: [{ name: 'api.example.com', type: 'A' }], answers: [] },
      },
      ...(opts.dnsCacheHit
        ? []
        : [
            {
              stepIndex: 1,
              fromId: 'resolver',
              toId: 'root',
              protocol: 'DNS',
              colorCategory: 'dns' as const,
              info: 'Iterative query A api.example.com (RD=0)',
              osiLayer: 7,
              isUdp: true,
              srcPort: 54001,
              dstPort: 53,
              sizeBytes: 75,
              dns: { transactionId: tx + 1, isResponse: false, questions: [{ name: 'api.example.com', type: 'A' }], answers: [] },
            },
            {
              stepIndex: 1,
              fromId: 'root',
              toId: 'resolver',
              protocol: 'DNS',
              colorCategory: 'dns' as const,
              info: 'Referral: .com TLD NS -> 192.5.6.30',
              osiLayer: 7,
              isUdp: true,
              srcPort: 53,
              dstPort: 54001,
              sizeBytes: 118,
              dns: { transactionId: tx + 1, isResponse: true, questions: [{ name: 'api.example.com', type: 'A' }], answers: [{ name: 'com', type: 'NS', value: '192.5.6.30', ttl: 172800 }] },
            },
            {
              stepIndex: 2,
              fromId: 'resolver',
              toId: 'tld',
              protocol: 'DNS',
              colorCategory: 'dns' as const,
              info: 'Iterative query A api.example.com',
              osiLayer: 7,
              isUdp: true,
              srcPort: 54002,
              dstPort: 53,
              sizeBytes: 75,
              dns: { transactionId: tx + 2, isResponse: false, questions: [{ name: 'api.example.com', type: 'A' }], answers: [] },
            },
            {
              stepIndex: 2,
              fromId: 'tld',
              toId: 'resolver',
              protocol: 'DNS',
              colorCategory: 'dns' as const,
              info: 'Referral: example.com NS -> 198.51.100.53',
              osiLayer: 7,
              isUdp: true,
              srcPort: 53,
              dstPort: 54002,
              sizeBytes: 124,
              dns: { transactionId: tx + 2, isResponse: true, questions: [{ name: 'api.example.com', type: 'A' }], answers: [{ name: 'example.com', type: 'NS', value: '198.51.100.53', ttl: 86400 }] },
            },
            {
              stepIndex: 3,
              fromId: 'resolver',
              toId: 'auth',
              protocol: 'DNS',
              colorCategory: 'dns' as const,
              info: 'Iterative query A api.example.com',
              osiLayer: 7,
              isUdp: true,
              srcPort: 54003,
              dstPort: 53,
              sizeBytes: 75,
              dns: { transactionId: tx + 3, isResponse: false, questions: [{ name: 'api.example.com', type: 'A' }], answers: [] },
            },
            {
              stepIndex: 3,
              fromId: 'auth',
              toId: 'resolver',
              protocol: 'DNS',
              colorCategory: 'dns' as const,
              info: 'Authoritative answer (AA=1): A 203.0.113.10 (TTL 300s)',
              osiLayer: 7,
              isUdp: true,
              srcPort: 53,
              dstPort: 54003,
              sizeBytes: 91,
              dns: { transactionId: tx + 3, isResponse: true, questions: [{ name: 'api.example.com', type: 'A' }], answers: [{ name: 'api.example.com', type: 'A', value: '203.0.113.10', ttl: 300 }] },
            },
          ]),
      {
        stepIndex: 4,
        fromId: 'resolver',
        toId: 'client',
        protocol: 'DNS',
        colorCategory: 'dns' as const,
        info: opts.dnsCacheHit
          ? 'Standard query response A 203.0.113.10 (CACHED, TTL 280s)'
          : `Standard query response 0x${tx.toString(16)} A 203.0.113.10 (TTL 300s)`,
        osiLayer: 7,
        isUdp: true,
        srcPort: 53,
        dstPort: 53812,
        sizeBytes: 91,
        dns: { transactionId: tx, isResponse: true, questions: [{ name: 'api.example.com', type: 'A' }], answers: [{ name: 'api.example.com', type: 'A', value: '203.0.113.10', ttl: 300 }] },
      },
    ];
    return runPacketTemplates(nodes, links, steps, templates, opts);
  },
};
