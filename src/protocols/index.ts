import { dnsProtocol } from './core/dns';
import { tcpProtocol } from './core/tcp';
import { dhcpProtocol } from './core/dhcp';
import { ethernetProtocol } from './core/ethernet';
import { icmpProtocol } from './core/icmp';
import { bgpProtocol } from './core/bgp';
import { udpProtocol, ipProtocol, ipv6Protocol, igmpProtocol, ntpProtocol } from './core/remainingCore';

import { httpProtocol } from './application/http';
import { httpsProtocol } from './application/https';
import { smtpProtocol } from './application/smtp';
import { sshProtocol } from './application/ssh';
import {
  websocketProtocol,
  webrtcProtocol,
  sipProtocol,
  rtspProtocol,
  rtmpProtocol,
  quicProtocol,
  dohProtocol,
  dnssecProtocol,
} from './application/remainingApp1';
import {
  pop3Protocol,
  imapProtocol,
  ftpProtocol,
  smbProtocol,
  modbusProtocol,
  pppoeProtocol,
  captivePortalProtocol,
} from './application/remainingApp2';

import { tlsProtocol } from './security/tls';
import { wpa2Protocol } from './security/wpa2';
import {
  httpProxyProtocol,
  socks5Protocol,
  reverseProxyProtocol,
  wireguardProtocol,
  ipsecProtocol,
  wpa3Protocol,
  radiusProtocol,
} from './security/remainingSec';

import type { ProtocolEntry } from './types';

export const PROTOCOLS: ProtocolEntry[] = [
  // CORE (11)
  tcpProtocol,
  udpProtocol,
  ipProtocol,
  bgpProtocol,
  ipv6Protocol,
  icmpProtocol,
  igmpProtocol,
  ntpProtocol,
  ethernetProtocol,
  dhcpProtocol,
  dnsProtocol,
  // APPLICATION (19)
  httpProtocol,
  httpsProtocol,
  websocketProtocol,
  webrtcProtocol,
  sipProtocol,
  rtspProtocol,
  rtmpProtocol,
  quicProtocol,
  dohProtocol,
  dnssecProtocol,
  smtpProtocol,
  pop3Protocol,
  imapProtocol,
  ftpProtocol,
  smbProtocol,
  sshProtocol,
  modbusProtocol,
  pppoeProtocol,
  captivePortalProtocol,
  // SECURITY (9)
  tlsProtocol,
  httpProxyProtocol,
  socks5Protocol,
  reverseProxyProtocol,
  wireguardProtocol,
  ipsecProtocol,
  wpa2Protocol,
  wpa3Protocol,
  radiusProtocol,
];

export const PROTOCOL_MAP = new Map<string, ProtocolEntry>(PROTOCOLS.map((p) => [p.id, p]));

export function getProtocolById(id: string): ProtocolEntry {
  return PROTOCOL_MAP.get(id) ?? httpProtocol;
}

export interface ComparePair {
  id: string;
  label: string;
  leftId: string;
  rightId: string;
  highlights: Array<{ aspect: string; left: string; right: string }>;
}

export const COMPARE_PAIRS: ComparePair[] = [
  {
    id: 'http-vs-https',
    label: 'HTTP vs HTTPS',
    leftId: 'http',
    rightId: 'https',
    highlights: [
      { aspect: 'Default Port', left: '80', right: '443' },
      { aspect: 'Confidentiality', left: 'Plaintext (sniffable)', right: 'TLS 1.3 AEAD Encrypted' },
      { aspect: 'Handshake Overhead', left: '1 RTT (TCP only)', right: '2 RTT (TCP + TLS 1.3)' },
      { aspect: 'Authentication', left: 'None', right: 'X.509 Certificate Chain' },
    ],
  },
  {
    id: 'tcp-vs-udp',
    label: 'TCP vs UDP',
    leftId: 'tcp',
    rightId: 'udp',
    highlights: [
      { aspect: 'Connection', left: '3-Way Handshake (Stateful)', right: 'Connectionless (0-RTT)' },
      { aspect: 'Header Size', left: '20–60 bytes', right: '8 bytes' },
      { aspect: 'Reliability', left: 'Seq/Ack + Retransmission', right: 'Best-effort (App handles)' },
      { aspect: 'Congestion Control', left: 'Slow Start / Reno / CUBIC', right: 'None built-in' },
    ],
  },
  {
    id: 'http-vs-quic',
    label: 'HTTP/1.1 vs QUIC (HTTP/3)',
    leftId: 'http',
    rightId: 'quic',
    highlights: [
      { aspect: 'Transport', left: 'TCP (Port 80)', right: 'UDP (Port 443)' },
      { aspect: 'Head-of-Line Blocking', left: 'Yes (Single TCP byte stream)', right: 'Eliminated (Independent streams)' },
      { aspect: 'Security', left: 'Optional external TLS', right: 'Mandatory built-in TLS 1.3' },
      { aspect: 'Network Roaming', left: 'Breaks on IP change', right: 'Connection ID survives Wi-Fi->5G' },
    ],
  },
  {
    id: 'wpa2-vs-wpa3',
    label: 'WPA2 vs WPA3',
    leftId: 'wpa2',
    rightId: 'wpa3',
    highlights: [
      { aspect: 'Key Exchange', left: 'PSK 4-Way Handshake', right: 'SAE Dragonfly + 4-Way' },
      { aspect: 'Offline Cracking', left: 'Vulnerable to GPU dictionary', right: 'Protected (1 live guess per auth)' },
      { aspect: 'Forward Secrecy', left: 'No (shared PSK)', right: 'Yes (ephemeral PMK per session)' },
      { aspect: 'Management Frames', left: 'Optional PMF', right: 'Mandatory PMF (802.11w)' },
    ],
  },
  {
    id: 'ipsec-vs-wireguard',
    label: 'IPsec vs WireGuard',
    leftId: 'ipsec',
    rightId: 'wireguard',
    highlights: [
      { aspect: 'Control Plane', left: 'IKEv2 (UDP 500/4500)', right: 'Noise_IKpsk2 (UDP 51820)' },
      { aspect: 'Crypto Agility', left: 'Negotiated (many suites)', right: 'Opinionated modern fixed suite' },
      { aspect: 'Code Complexity', left: 'Large (~400k+ LOC)', right: 'Lean (~4k LOC)' },
      { aspect: 'Stealth', left: 'Responds to IKE probes', right: 'Silent drop on unknown keys' },
    ],
  },
];

export function fuzzySearchProtocols(query: string): Array<{ protocol: ProtocolEntry; score: number }> {
  const q = query.trim().toLowerCase();
  if (!q) return PROTOCOLS.map((protocol) => ({ protocol, score: 1 }));

  const results: Array<{ protocol: ProtocolEntry; score: number }> = [];
  for (const p of PROTOCOLS) {
    let score = 0;
    if (p.name.toLowerCase() === q || p.id.toLowerCase() === q) score += 200;
    else if (p.name.toLowerCase().includes(q)) score += 60;
    if (p.fullName.toLowerCase().includes(q)) score += 45;
    if (p.defaultPort.toLowerCase().includes(q)) score += 40;
    if (p.rfcs.some((r) => r.number.toLowerCase().includes(q) || r.title.toLowerCase().includes(q))) score += 40;
    if (p.keywords.some((k) => k.toLowerCase().includes(q))) score += 30;
    if (p.description.toLowerCase().includes(q)) score += 15;

    // Fuzzy subsequence fallback
    if (score === 0) {
      const hay = `${p.name} ${p.fullName} ${p.keywords.join(' ')}`.toLowerCase();
      let qi = 0;
      for (let hi = 0; hi < hay.length && qi < q.length; hi++) {
        if (hay[hi] === q[qi]) qi++;
      }
      if (qi === q.length) score = 10;
    }

    if (score > 0) results.push({ protocol: p, score });
  }

  return results.sort((a, b) => b.score - a.score);
}
