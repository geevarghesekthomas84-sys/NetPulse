export type DeviceRole =
  | 'host'
  | 'router'
  | 'switch'
  | 'hub'
  | 'access_point'
  | 'firewall'
  | 'proxy'
  | 'reverse_proxy'
  | 'dns_server'
  | 'dhcp_server'
  | 'web_server'
  | 'mail_server'
  | 'file_server'
  | 'server_rack'
  | 'server_tower'
  | 'vpn_gateway'
  | 'nat_gateway'
  | 'ip_camera'
  | 'tv_box'
  | 'phone'
  | 'plc'
  | 'cloud';

export type DnsRole = 'recursive' | 'root' | 'tld' | 'authoritative';

export type LinkMedium = 'ethernet' | 'fiber' | 'serial' | 'wireless';

export type PacketColorCategory =
  | 'dns'
  | 'tcp'
  | 'tls'
  | 'http_req'
  | 'http_res'
  | 'udp'
  | 'icmp'
  | 'error'
  | 'l2'
  | 'sec'
  | 'routing';

export type TcpState =
  | 'CLOSED'
  | 'LISTEN'
  | 'SYN_SENT'
  | 'SYN_RCVD'
  | 'ESTABLISHED'
  | 'FIN_WAIT_1'
  | 'FIN_WAIT_2'
  | 'CLOSE_WAIT'
  | 'LAST_ACK'
  | 'TIME_WAIT';

export type CongestionAlgorithm = 'reno' | 'tahoe' | 'cubic';

export interface NetworkInterface {
  id: string;
  name: string;
  mac: string;
  ip: string;
  mask: string;
  ipv6?: string;
  gateway?: string;
  vlan?: number;
  trunkVlans?: number[];
  isTrunk?: boolean;
  up: boolean;
}

export interface RouteEntry {
  network: string;
  mask: string;
  nextHop: string;
  iface: string;
  metric: number;
  protocol: 'connected' | 'static' | 'rip' | 'ospf' | 'bgp';
  asPath?: number[];
}

export interface ArpEntry {
  ip: string;
  mac: string;
  expiresAtMs: number;
  static?: boolean;
}

export interface MacTableEntry {
  mac: string;
  portIfaceId: string;
  vlan: number;
  learnedAtMs: number;
}

export interface NatTranslation {
  id: string;
  proto: 'TCP' | 'UDP' | 'ICMP';
  insideLocalIp: string;
  insideLocalPort: number;
  insideGlobalIp: string;
  insideGlobalPort: number;
  outsideIp: string;
  outsidePort: number;
  createdAtMs: number;
}

export interface FirewallRule {
  id: string;
  action: 'allow' | 'deny';
  direction: 'inbound' | 'outbound' | 'both';
  protocol: 'ANY' | 'TCP' | 'UDP' | 'ICMP';
  srcIp: string; // IP or 'any'
  dstIp: string; // IP or 'any'
  dstPort: number | 'any';
  hits?: number;
}

export interface DnsRecord {
  name: string;
  type: 'A' | 'AAAA' | 'CNAME' | 'MX' | 'NS' | 'TXT' | 'DS' | 'RRSIG';
  value: string;
  ttl: number;
  expiresAtMs?: number;
}

export interface DhcpLease {
  mac: string;
  ip: string;
  mask: string;
  gateway: string;
  dns: string;
  expiresAtMs: number;
}

export interface DeviceServiceConfig {
  http?: { enabled: boolean; port: number; tls?: boolean; body?: string };
  dns?: { enabled: boolean; role: DnsRole; records: DnsRecord[]; upstream?: string };
  dhcp?: { enabled: boolean; poolStart: string; poolEnd: string; mask: string; gateway: string; dns: string };
  smtp?: { enabled: boolean; port: number; domain: string };
  ssh?: { enabled: boolean; port: number; user: string; password?: string };
  ftp?: { enabled: boolean; port: number };
  radius?: { enabled: boolean; secret: string };
  modbus?: { enabled: boolean; unitId: number; registers: Record<number, number> };
}

export interface SimDevice {
  id: string;
  name: string;
  role: DeviceRole;
  x: number;
  y: number;
  poweredOn: boolean;
  interfaces: NetworkInterface[];
  dnsServer?: string;
  dhcpEnabled?: boolean;
  routingTable: RouteEntry[];
  arpCache: ArpEntry[];
  macTable: MacTableEntry[];
  natTable: NatTranslation[];
  natEnabled?: boolean;
  firewallRules: FirewallRule[];
  statefulFirewall?: boolean;
  synCookiesEnabled?: boolean;
  routingProtocol?: 'none' | 'rip' | 'ospf' | 'bgp';
  asn?: number;
  wifi?: {
    ssid: string;
    security: 'open' | 'wpa2' | 'wpa3' | 'wpa2-enterprise';
    password?: string;
    clients: string[];
  };
  services: DeviceServiceConfig;
  openPorts: number[];
  cpuLoad: number;
}

export interface SimLink {
  id: string;
  sourceId: string;
  sourceIface: string;
  targetId: string;
  targetIface: string;
  medium: LinkMedium;
  bandwidthMbps: number;
  delayMs: number;
  jitterMs: number;
  lossPercent: number;
  mtu: number;
  duplex: 'full' | 'half';
  up: boolean;
}

export interface FieldByteRange {
  label: string;
  value: string;
  description: string;
  startByte: number;
  endByte: number; // inclusive
  layer: 'frame' | 'ethernet' | 'ipv4' | 'ipv6' | 'arp' | 'icmp' | 'tcp' | 'udp' | 'tls' | 'app';
}

export interface TcpFlags {
  urg: boolean;
  ack: boolean;
  psh: boolean;
  rst: boolean;
  syn: boolean;
  fin: boolean;
}

export interface EthernetHeader {
  srcMac: string;
  dstMac: string;
  etherType: string; // e.g. '0x0800', '0x0806', '0x86dd', '0x8100'
  vlanId?: number;
}

export interface ArpHeader {
  opcode: 1 | 2; // 1=Request, 2=Reply
  senderMac: string;
  senderIp: string;
  targetMac: string;
  targetIp: string;
}

export interface Ipv4Header {
  version: 4;
  ihl: number;
  tos: number;
  totalLength: number;
  identification: number;
  flags: { df: boolean; mf: boolean };
  fragmentOffset: number;
  ttl: number;
  protocol: number; // 1=ICMP, 6=TCP, 17=UDP
  checksum: number;
  srcIp: string;
  dstIp: string;
}

export interface Ipv6Header {
  version: 6;
  trafficClass: number;
  flowLabel: number;
  payloadLength: number;
  nextHeader: number;
  hopLimit: number;
  srcIp: string;
  dstIp: string;
}

export interface IcmpHeader {
  type: number; // 8=EchoReq, 0=EchoReply, 11=TimeExceeded, 3=DestUnreach
  code: number;
  checksum: number;
  identifier: number;
  sequence: number;
  message: string;
}

export interface TcpHeader {
  srcPort: number;
  dstPort: number;
  seq: number;
  ack: number;
  dataOffset: number;
  flags: TcpFlags;
  window: number;
  checksum: number;
  urgentPointer: number;
  mss?: number;
  sackPermitted?: boolean;
}

export interface UdpHeader {
  srcPort: number;
  dstPort: number;
  length: number;
  checksum: number;
}

export interface TlsHeader {
  recordType: 'Handshake' | 'Application Data' | 'ChangeCipherSpec' | 'Alert';
  version: 'TLS 1.2' | 'TLS 1.3';
  handshakeType?: string;
  cipherSuite?: string;
  sni?: string;
  alpn?: string;
}

export interface DnsHeader {
  transactionId: number;
  isResponse: boolean;
  opcode: string;
  flags: string[];
  questions: Array<{ name: string; type: string }>;
  answers: Array<{ name: string; type: string; value: string; ttl: number }>;
}

export interface AppHeader {
  protocolName: string;
  summary: string;
  rawText?: string;
  fields: Array<{ key: string; value: string; description?: string }>;
}

export interface PacketLayers {
  ethernet: EthernetHeader;
  arp?: ArpHeader;
  ipv4?: Ipv4Header;
  ipv6?: Ipv6Header;
  icmp?: IcmpHeader;
  tcp?: TcpHeader;
  udp?: UdpHeader;
  tls?: TlsHeader;
  dns?: DnsHeader;
  app?: AppHeader;
}

export interface PacketCurvePoint {
  x: number;
  y: number;
}

export interface PacketCurvedPath {
  isNonDirect: boolean;
  viaNodeIds: string[];
  start: PacketCurvePoint;
  control: PacketCurvePoint;
  end: PacketCurvePoint;
  svgPathD: string;
  arcOffset: number;
}

export interface CapturedPacket {
  id: string;
  no: number;
  timestampMs: number;
  arrivalMs: number;
  fromDeviceId: string;
  toDeviceId: string;
  linkId?: string;
  flowPathNodeIds?: string[];
  flowLinkIds?: string[];
  curvedPath?: PacketCurvedPath;
  srcMac: string;
  dstMac: string;
  srcIp: string;
  dstIp: string;
  protocol: string;
  colorCategory: PacketColorCategory;
  info: string;
  sizeBytes: number;
  dropped?: boolean;
  dropReason?: string;
  retransmitted?: boolean;
  stepIndex?: number;
  osiLayer: number; // 1..7
  layers: PacketLayers;
  rawBytes: number[];
  fieldRanges: FieldByteRange[];
  note?: string;
}

export interface TcpControlBlock {
  id: string;
  localIp: string;
  localPort: number;
  remoteIp: string;
  remotePort: number;
  state: TcpState;
  iss: number;
  sndUna: number;
  sndNxt: number;
  rcvNxt: number;
  cwnd: number; // in MSS units
  ssthresh: number; // in MSS units
  rwnd: number; // bytes
  mss: number;
  srttMs: number;
  rttvarMs: number;
  rtoMs: number;
  dupAcks: number;
  algorithm: CongestionAlgorithm;
  nagleEnabled: boolean;
  delayedAckEnabled: boolean;
  retransmissions: number;
  cwndHistory: Array<{ timeMs: number; cwnd: number; ssthresh: number; event?: string }>;
}

export interface SimEvent {
  seq: number;
  timeMs: number;
  type:
    | 'PACKET_SEND'
    | 'PACKET_DELIVER'
    | 'TCP_RTO_EXPIRE'
    | 'ARP_TIMEOUT'
    | 'DNS_CACHE_EXPIRE'
    | 'APP_TICK'
    | 'ROUTE_UPDATE';
  deviceId: string;
  targetId?: string;
  linkId?: string;
  packet?: CapturedPacket;
  meta?: Record<string, unknown>;
}

export interface SimMetrics {
  totalPacketsSent: number;
  totalPacketsDelivered: number;
  totalPacketsDropped: number;
  totalRetransmissions: number;
  totalBytesTransferred: number;
  minLatencyMs: number;
  maxLatencyMs: number;
  avgLatencyMs: number;
  jitterMs: number;
  throughputKbps: number;
  goodputKbps: number;
  linkUtilization: Record<string, number>;
  cwndSeries: Array<{ timeMs: number; cwnd: number; ssthresh: number }>;
}

export interface SimLogEntry {
  id: string;
  timeMs: number;
  deviceId: string;
  level: 'info' | 'warn' | 'error';
  message: string;
}

export interface TopologyWarning {
  id: string;
  severity: 'error' | 'warning';
  deviceId?: string;
  message: string;
}
