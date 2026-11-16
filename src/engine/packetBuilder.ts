import { computeIcmpChecksum, computeIpv4Checksum, computeTransportChecksum, formatChecksum } from '../lib/checksum';
import { stringToBytes, uint16ToBytes, uint32ToBytes } from '../lib/hexDump';
import { ipToBytes, macToBytes } from '../lib/ipUtils';
import type {
  AppHeader,
  ArpHeader,
  CapturedPacket,
  DnsHeader,
  EthernetHeader,
  FieldByteRange,
  IcmpHeader,
  Ipv4Header,
  Ipv6Header,
  PacketColorCategory,
  PacketCurvedPath,
  PacketLayers,
  TcpHeader,
  TlsHeader,
  UdpHeader,
} from './types';

export interface BuildPacketOptions {
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
  protocol: string;
  colorCategory: PacketColorCategory;
  info: string;
  osiLayer: number;
  stepIndex?: number;
  dropped?: boolean;
  dropReason?: string;
  retransmitted?: boolean;
  note?: string;
  ethernet: EthernetHeader;
  arp?: ArpHeader;
  ipv4?: Omit<Ipv4Header, 'checksum' | 'totalLength'> & { totalLength?: number };
  ipv6?: Omit<Ipv6Header, 'payloadLength'> & { payloadLength?: number };
  icmp?: Omit<IcmpHeader, 'checksum'>;
  tcp?: Omit<TcpHeader, 'checksum'>;
  udp?: Omit<UdpHeader, 'checksum' | 'length'>;
  tls?: TlsHeader;
  dns?: DnsHeader;
  app?: AppHeader;
  payloadSizeOverride?: number;
  payloadText?: string;
}

/**
 * Encodes a complete layered network packet into real wire bytes, computes real RFC 1071
 * IPv4/TCP/UDP/ICMP checksums, and records exact byte offsets for Wireshark-style field highlighting.
 */
export function buildRealPacket(opts: BuildPacketOptions): CapturedPacket {
  const bytes: number[] = [];
  const ranges: FieldByteRange[] = [];
  const layers: PacketLayers = { ethernet: opts.ethernet };

  // 1. Ethernet II Header (14 bytes, or 18 with 802.1Q VLAN tag)
  const ethStart = bytes.length;
  const dstMacBytes = macToBytes(opts.ethernet.dstMac);
  const srcMacBytes = macToBytes(opts.ethernet.srcMac);
  bytes.push(...dstMacBytes);
  ranges.push({
    label: 'Destination MAC',
    value: opts.ethernet.dstMac,
    description: '6-byte IEEE 802.3 destination hardware address',
    startByte: ethStart,
    endByte: ethStart + 5,
    layer: 'ethernet',
  });
  bytes.push(...srcMacBytes);
  ranges.push({
    label: 'Source MAC',
    value: opts.ethernet.srcMac,
    description: '6-byte IEEE 802.3 source hardware address',
    startByte: ethStart + 6,
    endByte: ethStart + 11,
    layer: 'ethernet',
  });

  if (opts.ethernet.vlanId !== undefined) {
    const tpid = [0x81, 0x00];
    const tci = uint16ToBytes(opts.ethernet.vlanId & 0x0fff);
    bytes.push(...tpid, ...tci);
    ranges.push({
      label: '802.1Q VLAN Tag',
      value: `VLAN ${opts.ethernet.vlanId}`,
      description: 'IEEE 802.1Q virtual LAN tag (TPID 0x8100 + VID)',
      startByte: ethStart + 12,
      endByte: ethStart + 15,
      layer: 'ethernet',
    });
  }

  const etherTypeNum = parseInt(opts.ethernet.etherType, 16) || 0x0800;
  const etStart = bytes.length;
  bytes.push(...uint16ToBytes(etherTypeNum));
  ranges.push({
    label: 'EtherType',
    value: opts.ethernet.etherType,
    description: 'Identifies encapsulated Layer 3 protocol (0x0800 IPv4, 0x0806 ARP, 0x86DD IPv6)',
    startByte: etStart,
    endByte: etStart + 1,
    layer: 'ethernet',
  });

  // Compute payload bytes first for App / DNS / TLS
  let appBytes: number[] = [];
  if (opts.payloadText) {
    appBytes = stringToBytes(opts.payloadText);
  } else if (opts.app?.rawText) {
    appBytes = stringToBytes(opts.app.rawText);
  } else if (opts.dns) {
    const qName = opts.dns.questions[0]?.name || 'example.com';
    const qLabels = qName.split('.').flatMap((lbl) => [lbl.length, ...stringToBytes(lbl)]);
    appBytes = [
      ...uint16ToBytes(opts.dns.transactionId),
      opts.dns.isResponse ? 0x81 : 0x01,
      opts.dns.isResponse ? 0x80 : 0x00,
      ...uint16ToBytes(opts.dns.questions.length),
      ...uint16ToBytes(opts.dns.answers.length),
      0x00, 0x00, 0x00, 0x00,
      ...qLabels, 0x00, 0x00, 0x01, 0x00, 0x01,
    ];
    if (opts.dns.isResponse && opts.dns.answers.length > 0) {
      const ansIp = ipToBytes(opts.dns.answers[0].value);
      appBytes.push(0xc0, 0x0c, 0x00, 0x01, 0x00, 0x01, ...uint32ToBytes(opts.dns.answers[0].ttl), 0x00, 0x04, ...ansIp);
    }
  } else if (opts.tls) {
    const recCode = opts.tls.recordType === 'Handshake' ? 0x16 : opts.tls.recordType === 'ChangeCipherSpec' ? 0x14 : opts.tls.recordType === 'Alert' ? 0x15 : 0x17;
    const summaryBytes = stringToBytes(opts.tls.handshakeType || opts.tls.recordType);
    const bodyLen = Math.max(summaryBytes.length, 32);
    appBytes = [recCode, 0x03, 0x03, ...uint16ToBytes(bodyLen), ...summaryBytes];
    while (appBytes.length < 5 + bodyLen) appBytes.push(0xa5);
  } else if (opts.app) {
    appBytes = stringToBytes(`${opts.app.protocolName} ${opts.app.summary}`);
  }

  // Build Transport / ICMP bytes
  let transportBytes: number[] = [];
  const transportRangesPending: Array<Omit<FieldByteRange, 'startByte' | 'endByte'> & { relStart: number; relEnd: number }> = [];

  if (opts.icmp) {
    const icmpRaw = [
      opts.icmp.type & 0xff,
      opts.icmp.code & 0xff,
      0x00,
      0x00,
      ...uint16ToBytes(opts.icmp.identifier),
      ...uint16ToBytes(opts.icmp.sequence),
      ...stringToBytes(opts.icmp.message || 'abcdefghijklmnopqrstuvwabcdefghi').slice(0, 32),
    ];
    const csum = computeIcmpChecksum(icmpRaw);
    const [cHi, cLo] = uint16ToBytes(csum);
    icmpRaw[2] = cHi;
    icmpRaw[3] = cLo;
    transportBytes = icmpRaw;
    layers.icmp = { ...opts.icmp, checksum: csum };

    transportRangesPending.push(
      { label: 'ICMP Type', value: String(opts.icmp.type), description: '8=Echo Request, 0=Echo Reply, 11=Time Exceeded, 3=Dest Unreachable', relStart: 0, relEnd: 0, layer: 'icmp' },
      { label: 'ICMP Code', value: String(opts.icmp.code), description: 'Subtype code for ICMP message', relStart: 1, relEnd: 1, layer: 'icmp' },
      { label: 'ICMP Checksum', value: formatChecksum(csum), description: 'RFC 1071 ones-complement checksum over ICMP message', relStart: 2, relEnd: 3, layer: 'icmp' },
      { label: 'Identifier', value: `0x${opts.icmp.identifier.toString(16).padStart(4, '0')}`, description: 'Echo session identifier', relStart: 4, relEnd: 5, layer: 'icmp' },
      { label: 'Sequence Number', value: String(opts.icmp.sequence), description: 'Echo sequence counter', relStart: 6, relEnd: 7, layer: 'icmp' }
    );
  } else if (opts.tcp) {
    const flagsByte =
      (opts.tcp.flags.urg ? 0x20 : 0) |
      (opts.tcp.flags.ack ? 0x10 : 0) |
      (opts.tcp.flags.psh ? 0x08 : 0) |
      (opts.tcp.flags.rst ? 0x04 : 0) |
      (opts.tcp.flags.syn ? 0x02 : 0) |
      (opts.tcp.flags.fin ? 0x01 : 0);
    const optionsBytes: number[] = [];
    if (opts.tcp.mss) {
      optionsBytes.push(0x02, 0x04, ...uint16ToBytes(opts.tcp.mss));
    }
    if (opts.tcp.sackPermitted) {
      optionsBytes.push(0x04, 0x02, 0x01, 0x01);
    }
    while (optionsBytes.length % 4 !== 0) optionsBytes.push(0x00);

    const dataOffsetWords = 5 + optionsBytes.length / 4;
    const tcpHeader = [
      ...uint16ToBytes(opts.tcp.srcPort),
      ...uint16ToBytes(opts.tcp.dstPort),
      ...uint32ToBytes(opts.tcp.seq),
      ...uint32ToBytes(opts.tcp.ack),
      (dataOffsetWords << 4) & 0xf0,
      flagsByte,
      ...uint16ToBytes(opts.tcp.window),
      0x00,
      0x00,
      ...uint16ToBytes(opts.tcp.urgentPointer),
      ...optionsBytes,
    ];
    const segPlusPayload = [...tcpHeader, ...appBytes];
    const srcIp = opts.ipv4?.srcIp || opts.ipv6?.srcIp || '0.0.0.0';
    const dstIp = opts.ipv4?.dstIp || opts.ipv6?.dstIp || '0.0.0.0';
    const csum = computeTransportChecksum(srcIp, dstIp, 6, segPlusPayload);
    const [cHi, cLo] = uint16ToBytes(csum);
    tcpHeader[16] = cHi;
    tcpHeader[17] = cLo;
    transportBytes = [...tcpHeader, ...appBytes];
    layers.tcp = { ...opts.tcp, dataOffset: dataOffsetWords, checksum: csum };

    const activeFlags = Object.entries(opts.tcp.flags)
      .filter(([, v]) => v)
      .map(([k]) => k.toUpperCase())
      .join(', ') || 'NONE';

    transportRangesPending.push(
      { label: 'Source Port', value: String(opts.tcp.srcPort), description: '16-bit sender port', relStart: 0, relEnd: 1, layer: 'tcp' },
      { label: 'Destination Port', value: String(opts.tcp.dstPort), description: '16-bit receiver port', relStart: 2, relEnd: 3, layer: 'tcp' },
      { label: 'Sequence Number', value: String(opts.tcp.seq), description: '32-bit byte-stream sequence number', relStart: 4, relEnd: 7, layer: 'tcp' },
      { label: 'Acknowledgment Number', value: String(opts.tcp.ack), description: 'Next expected byte sequence from peer', relStart: 8, relEnd: 11, layer: 'tcp' },
      { label: 'Header Length', value: `${dataOffsetWords * 4} bytes`, description: 'Data offset in 32-bit words', relStart: 12, relEnd: 12, layer: 'tcp' },
      { label: 'TCP Flags', value: `0x${flagsByte.toString(16).padStart(2, '0')} [${activeFlags}]`, description: 'Control bits: URG ACK PSH RST SYN FIN', relStart: 13, relEnd: 13, layer: 'tcp' },
      { label: 'Window Size', value: String(opts.tcp.window), description: 'Receive buffer window in bytes', relStart: 14, relEnd: 15, layer: 'tcp' },
      { label: 'TCP Checksum', value: formatChecksum(csum), description: 'RFC 793 pseudo-header + TCP segment checksum', relStart: 16, relEnd: 17, layer: 'tcp' },
      { label: 'Urgent Pointer', value: String(opts.tcp.urgentPointer), description: 'Offset to urgent data if URG flag set', relStart: 18, relEnd: 19, layer: 'tcp' }
    );
  } else if (opts.udp) {
    const udpLen = 8 + appBytes.length;
    const udpHeader = [
      ...uint16ToBytes(opts.udp.srcPort),
      ...uint16ToBytes(opts.udp.dstPort),
      ...uint16ToBytes(udpLen),
      0x00,
      0x00,
    ];
    const segPlusPayload = [...udpHeader, ...appBytes];
    const srcIp = opts.ipv4?.srcIp || opts.ipv6?.srcIp || '0.0.0.0';
    const dstIp = opts.ipv4?.dstIp || opts.ipv6?.dstIp || '0.0.0.0';
    const csum = computeTransportChecksum(srcIp, dstIp, 17, segPlusPayload);
    const [cHi, cLo] = uint16ToBytes(csum);
    udpHeader[6] = cHi;
    udpHeader[7] = cLo;
    transportBytes = [...udpHeader, ...appBytes];
    layers.udp = { ...opts.udp, length: udpLen, checksum: csum };

    transportRangesPending.push(
      { label: 'Source Port', value: String(opts.udp.srcPort), description: '16-bit sender UDP port', relStart: 0, relEnd: 1, layer: 'udp' },
      { label: 'Destination Port', value: String(opts.udp.dstPort), description: '16-bit destination UDP port', relStart: 2, relEnd: 3, layer: 'udp' },
      { label: 'UDP Length', value: `${udpLen} bytes`, description: 'Length of UDP header + payload', relStart: 4, relEnd: 5, layer: 'udp' },
      { label: 'UDP Checksum', value: formatChecksum(csum), description: 'RFC 768 pseudo-header + UDP datagram checksum', relStart: 6, relEnd: 7, layer: 'udp' }
    );
  } else {
    transportBytes = appBytes;
  }

  // Layer 3: ARP, IPv4, or IPv6
  if (opts.arp) {
    const arpStart = bytes.length;
    const arpBytes = [
      0x00, 0x01, // HTYPE Ethernet
      0x08, 0x00, // PTYPE IPv4
      0x06, 0x04, // HLEN=6, PLEN=4
      ...uint16ToBytes(opts.arp.opcode),
      ...macToBytes(opts.arp.senderMac),
      ...ipToBytes(opts.arp.senderIp),
      ...macToBytes(opts.arp.targetMac),
      ...ipToBytes(opts.arp.targetIp),
    ];
    bytes.push(...arpBytes);
    layers.arp = opts.arp;
    ranges.push(
      { label: 'Opcode', value: opts.arp.opcode === 1 ? '1 (Request)' : '2 (Reply)', description: 'ARP operation: 1=Who-has Request, 2=Is-at Reply', startByte: arpStart + 6, endByte: arpStart + 7, layer: 'arp' },
      { label: 'Sender MAC', value: opts.arp.senderMac, description: 'Hardware address of sender', startByte: arpStart + 8, endByte: arpStart + 13, layer: 'arp' },
      { label: 'Sender IP', value: opts.arp.senderIp, description: 'Protocol IPv4 address of sender', startByte: arpStart + 14, endByte: arpStart + 17, layer: 'arp' },
      { label: 'Target MAC', value: opts.arp.targetMac, description: 'Target hardware address (00:00:00:00:00:00 in requests)', startByte: arpStart + 18, endByte: arpStart + 23, layer: 'arp' },
      { label: 'Target IP', value: opts.arp.targetIp, description: 'Queried target IPv4 address', startByte: arpStart + 24, endByte: arpStart + 27, layer: 'arp' }
    );
  } else if (opts.ipv4) {
    const ipStart = bytes.length;
    const totalLength = opts.ipv4.totalLength ?? 20 + transportBytes.length;
    const flagsField = ((opts.ipv4.flags.df ? 0x4000 : 0) | (opts.ipv4.flags.mf ? 0x2000 : 0) | (opts.ipv4.fragmentOffset & 0x1fff)) & 0xffff;
    const ipHeader = [
      0x45, // Version 4, IHL 5
      opts.ipv4.tos & 0xff,
      ...uint16ToBytes(totalLength),
      ...uint16ToBytes(opts.ipv4.identification),
      ...uint16ToBytes(flagsField),
      opts.ipv4.ttl & 0xff,
      opts.ipv4.protocol & 0xff,
      0x00,
      0x00,
      ...ipToBytes(opts.ipv4.srcIp).slice(0, 4),
      ...ipToBytes(opts.ipv4.dstIp).slice(0, 4),
    ];
    const ipCsum = computeIpv4Checksum(ipHeader);
    const [icHi, icLo] = uint16ToBytes(ipCsum);
    ipHeader[10] = icHi;
    ipHeader[11] = icLo;

    bytes.push(...ipHeader);
    layers.ipv4 = { ...opts.ipv4, totalLength, checksum: ipCsum };

    ranges.push(
      { label: 'Version & IHL', value: 'IPv4 (20 bytes)', description: 'Version=4, Internet Header Length=5 (20 bytes)', startByte: ipStart, endByte: ipStart, layer: 'ipv4' },
      { label: 'DSCP / ECN', value: `0x${opts.ipv4.tos.toString(16).padStart(2, '0')}`, description: 'Differentiated Services & Congestion Notification', startByte: ipStart + 1, endByte: ipStart + 1, layer: 'ipv4' },
      { label: 'Total Length', value: `${totalLength} bytes`, description: 'IPv4 header + payload length', startByte: ipStart + 2, endByte: ipStart + 3, layer: 'ipv4' },
      { label: 'Identification', value: `0x${opts.ipv4.identification.toString(16).padStart(4, '0')}`, description: 'Fragment reassembly identifier', startByte: ipStart + 4, endByte: ipStart + 5, layer: 'ipv4' },
      { label: 'Flags & Frag Offset', value: `DF=${opts.ipv4.flags.df ? 1 : 0}, MF=${opts.ipv4.flags.mf ? 1 : 0}, Offset=${opts.ipv4.fragmentOffset}`, description: 'Don’t Fragment / More Fragments flags + 8-byte offset', startByte: ipStart + 6, endByte: ipStart + 7, layer: 'ipv4' },
      { label: 'Time to Live (TTL)', value: String(opts.ipv4.ttl), description: 'Hop limit decremented at each L3 router', startByte: ipStart + 8, endByte: ipStart + 8, layer: 'ipv4' },
      { label: 'Protocol', value: `${opts.ipv4.protocol} (${opts.ipv4.protocol === 6 ? 'TCP' : opts.ipv4.protocol === 17 ? 'UDP' : opts.ipv4.protocol === 1 ? 'ICMP' : 'Other'})`, description: 'Encapsulated L4 protocol number', startByte: ipStart + 9, endByte: ipStart + 9, layer: 'ipv4' },
      { label: 'Header Checksum', value: formatChecksum(ipCsum), description: 'RFC 1071 IPv4 header checksum', startByte: ipStart + 10, endByte: ipStart + 11, layer: 'ipv4' },
      { label: 'Source IP', value: opts.ipv4.srcIp, description: '32-bit IPv4 sender address', startByte: ipStart + 12, endByte: ipStart + 15, layer: 'ipv4' },
      { label: 'Destination IP', value: opts.ipv4.dstIp, description: '32-bit IPv4 recipient address', startByte: ipStart + 16, endByte: ipStart + 19, layer: 'ipv4' }
    );
  } else if (opts.ipv6) {
    const ip6Start = bytes.length;
    const payloadLength = opts.ipv6.payloadLength ?? transportBytes.length;
    const vtcfl = (6 << 28) | ((opts.ipv6.trafficClass & 0xff) << 20) | (opts.ipv6.flowLabel & 0xfffff);
    const ip6Header = [
      ...uint32ToBytes(vtcfl),
      ...uint16ToBytes(payloadLength),
      opts.ipv6.nextHeader & 0xff,
      opts.ipv6.hopLimit & 0xff,
      ...ipToBytes(opts.ipv6.srcIp),
      ...ipToBytes(opts.ipv6.dstIp),
    ];
    bytes.push(...ip6Header);
    layers.ipv6 = { ...opts.ipv6, payloadLength };
    ranges.push(
      { label: 'Version / Flow', value: `IPv6 Flow=0x${opts.ipv6.flowLabel.toString(16)}`, description: 'Version=6, Traffic Class, 20-bit Flow Label', startByte: ip6Start, endByte: ip6Start + 3, layer: 'ipv6' },
      { label: 'Payload Length', value: `${payloadLength} bytes`, description: 'Length of IPv6 payload', startByte: ip6Start + 4, endByte: ip6Start + 5, layer: 'ipv6' },
      { label: 'Next Header', value: String(opts.ipv6.nextHeader), description: 'Encapsulated header type (6=TCP, 17=UDP, 58=ICMPv6)', startByte: ip6Start + 6, endByte: ip6Start + 6, layer: 'ipv6' },
      { label: 'Hop Limit', value: String(opts.ipv6.hopLimit), description: 'Decremented at each router', startByte: ip6Start + 7, endByte: ip6Start + 7, layer: 'ipv6' },
      { label: 'Source IPv6', value: opts.ipv6.srcIp, description: '128-bit IPv6 source address', startByte: ip6Start + 8, endByte: ip6Start + 23, layer: 'ipv6' },
      { label: 'Destination IPv6', value: opts.ipv6.dstIp, description: '128-bit IPv6 destination address', startByte: ip6Start + 24, endByte: ip6Start + 39, layer: 'ipv6' }
    );
  }

  const tBase = bytes.length;
  bytes.push(...transportBytes);
  for (const tr of transportRangesPending) {
    ranges.push({
      label: tr.label,
      value: tr.value,
      description: tr.description,
      startByte: tBase + tr.relStart,
      endByte: tBase + tr.relEnd,
      layer: tr.layer,
    });
  }

  if (opts.tls) layers.tls = opts.tls;
  if (opts.dns) layers.dns = opts.dns;
  if (opts.app) layers.app = opts.app;

  // Record app/tls/dns range if present
  if (appBytes.length > 0) {
    const appStart = bytes.length - appBytes.length;
    const appLayer: FieldByteRange['layer'] = opts.tls ? 'tls' : 'app';
    ranges.push({
      label: opts.tls ? 'TLS Record' : opts.dns ? 'DNS Message' : opts.app?.protocolName || 'Payload',
      value: opts.info,
      description: `${appBytes.length} bytes of upper-layer payload`,
      startByte: appStart,
      endByte: bytes.length - 1,
      layer: appLayer,
    });
  }

  // Pad to Ethernet minimum frame size (60 bytes excluding FCS) if smaller
  while (bytes.length < 60) {
    bytes.push(0x00);
  }

  const sizeBytes = opts.payloadSizeOverride ?? Math.max(bytes.length, 60);
  const srcIp = opts.ipv4?.srcIp || opts.ipv6?.srcIp || opts.arp?.senderIp || opts.ethernet.srcMac;
  const dstIp = opts.ipv4?.dstIp || opts.ipv6?.dstIp || opts.arp?.targetIp || opts.ethernet.dstMac;

  return {
    id: opts.id,
    no: opts.no,
    timestampMs: opts.timestampMs,
    arrivalMs: opts.arrivalMs,
    fromDeviceId: opts.fromDeviceId,
    toDeviceId: opts.toDeviceId,
    linkId: opts.linkId,
    flowPathNodeIds: opts.flowPathNodeIds,
    flowLinkIds: opts.flowLinkIds,
    curvedPath: opts.curvedPath,
    srcMac: opts.ethernet.srcMac,
    dstMac: opts.ethernet.dstMac,
    srcIp,
    dstIp,
    protocol: opts.protocol,
    colorCategory: opts.colorCategory,
    info: opts.info,
    sizeBytes,
    dropped: opts.dropped,
    dropReason: opts.dropReason,
    retransmitted: opts.retransmitted,
    stepIndex: opts.stepIndex,
    osiLayer: opts.osiLayer,
    layers,
    rawBytes: bytes,
    fieldRanges: ranges,
    note: opts.note,
  };
}
