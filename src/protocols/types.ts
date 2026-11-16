import type { CapturedPacket, DeviceRole, PacketColorCategory, SimDevice, SimLink } from '../engine/types';

export type ProtocolCategory = 'CORE' | 'APPLICATION' | 'SECURITY';
export type ProtocolSimStatus = 'full' | 'partial' | 'basic';

export interface ProtocolNodeDef {
  id: string;
  label: string;
  ip: string;
  role: DeviceRole;
  mac?: string;
  x: number; // normalized 0..1000 canvas space
  y: number; // normalized 0..500 canvas space
  openPorts?: number[];
  asn?: number;
}

export interface ProtocolLinkDef {
  id: string;
  sourceId: string;
  targetId: string;
  bandwidthMbps?: number;
  delayMs?: number;
  mtu?: number;
  label?: string;
}

export interface ProtocolStepDef {
  title: string;
  subtitle: string;
  caption: string;
  osiLayer: number; // 1..7
}

export interface SecurityNote {
  attack: string;
  description: string;
  defense: string;
}

export interface WhatIfToggle {
  id:
    | 'packetLoss'
    | 'dnsCacheHit'
    | 'serverDown'
    | 'wrongPassword'
    | 'expiredCert'
    | 'portClosed'
    | 'smallMtu'
    | 'ttlExpired';
  label: string;
  description: string;
}

export interface ProtocolQuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface ScenarioOptions {
  seed?: number;
  packetLoss?: boolean;
  dnsCacheHit?: boolean;
  serverDown?: boolean;
  wrongPassword?: boolean;
  expiredCert?: boolean;
  portClosed?: boolean;
  smallMtu?: boolean;
  ttlExpired?: boolean;
}

export interface ScenarioResult {
  packets: CapturedPacket[];
  steps: ProtocolStepDef[];
  nodes: ProtocolNodeDef[];
  links: ProtocolLinkDef[];
  cwndSeries?: Array<{ timeMs: number; cwnd: number; ssthresh: number; event?: string }>;
  summaryNote?: string;
}

export interface PacketTemplate {
  stepIndex: number;
  fromId: string;
  toId: string;
  protocol: string;
  colorCategory: PacketColorCategory;
  info: string;
  osiLayer: number;
  delayAfterMs?: number;
  sizeBytes?: number;
  srcPort?: number;
  dstPort?: number;
  seq?: number;
  ack?: number;
  tcpFlags?: { urg?: boolean; ack?: boolean; psh?: boolean; rst?: boolean; syn?: boolean; fin?: boolean };
  isUdp?: boolean;
  isIcmp?: { type: number; code: number; message: string };
  isArp?: { opcode: 1 | 2; targetIp: string };
  isIpv6?: boolean;
  vlanId?: number;
  etherType?: string;
  ttl?: number;
  tls?: { recordType: 'Handshake' | 'Application Data' | 'ChangeCipherSpec' | 'Alert'; version: 'TLS 1.2' | 'TLS 1.3'; handshakeType?: string; cipherSuite?: string; sni?: string; alpn?: string };
  dns?: { transactionId: number; isResponse: boolean; questions: Array<{ name: string; type: string }>; answers: Array<{ name: string; type: string; value: string; ttl: number }> };
  app?: { protocolName: string; summary: string; rawText?: string; fields: Array<{ key: string; value: string; description?: string }> };
  note?: string;
  forceDrop?: boolean;
  dropReason?: string;
  retransmitted?: boolean;
}

export interface ProtocolEntry {
  id: string;
  name: string;
  fullName: string;
  category: ProtocolCategory;
  status: ProtocolSimStatus;
  layer: string;
  osiLayer: number;
  defaultPort: string;
  transport: string;
  dataFormat: string;
  methods: string[];
  rfcs: Array<{ number: string; title: string; url: string }>;
  keywords: string[];
  description: string;
  eli5: string;
  securityNotes: SecurityNote[];
  nodes: ProtocolNodeDef[];
  links: ProtocolLinkDef[];
  steps: ProtocolStepDef[];
  whatIfOptions: WhatIfToggle[];
  quiz: ProtocolQuizQuestion[];
  scenario: (opts?: ScenarioOptions) => ScenarioResult;
  buildTopologyDevices?: (nodes: ProtocolNodeDef[]) => { devices: SimDevice[]; links: SimLink[] };
}
