import type {
  AppHeader,
  CapturedPacket,
  DnsHeader,
  FieldByteRange,
  PacketColorCategory,
  PacketLayers,
  TlsHeader,
} from '../engine/types';

/** Why a file could not be opened. The UI maps these to translated messages. */
export type PcapErrorCode = 'too_small' | 'not_pcap' | 'pcapng' | 'link_type' | 'empty';

export interface PcapResult {
  ok: true;
  packets: CapturedPacket[];
  linkType: number;
  /** Records present in the file (may exceed packets.length when truncated). */
  totalRecords: number;
  /** True when parsing stopped at the packet limit or at a damaged record. */
  truncated: boolean;
}
export interface PcapFailure {
  ok: false;
  error: PcapErrorCode;
  linkType?: number;
}

export const MAX_PCAP_PACKETS = 5000;
const SUPPORTED_LINK_TYPES = new Set([1, 101, 12, 228, 113]);

const hex = (b: Uint8Array, start: number, len: number): string =>
  Array.from(b.subarray(start, start + len), (x) => x.toString(16).padStart(2, '0')).join(':');
const ip4 = (b: Uint8Array, o: number): string => `${b[o]}.${b[o + 1]}.${b[o + 2]}.${b[o + 3]}`;
const ip6 = (b: Uint8Array, o: number): string => {
  const groups: string[] = [];
  for (let i = 0; i < 16; i += 2) groups.push(((b[o + i] << 8) | b[o + i + 1]).toString(16));
  return groups.join(':').replace(/(^|:)(0(:|$)){2,}/, '::');
};
const u16 = (b: Uint8Array, o: number): number => (b[o] << 8) | b[o + 1];
const u32 = (b: Uint8Array, o: number): number => ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;

const DNS_TYPES: Record<number, string> = { 1: 'A', 2: 'NS', 5: 'CNAME', 6: 'SOA', 12: 'PTR', 15: 'MX', 16: 'TXT', 28: 'AAAA', 33: 'SRV', 255: 'ANY' };

function readDnsName(b: Uint8Array, start: number): { name: string; next: number } | null {
  const labels: string[] = [];
  let o = start;
  let next = -1;
  for (let hops = 0; hops < 40; hops++) {
    if (o >= b.length) return null;
    const len = b[o];
    if (len === 0) return { name: labels.join('.') || '.', next: next === -1 ? o + 1 : next };
    if ((len & 0xc0) === 0xc0) {
      if (o + 1 >= b.length) return null;
      if (next === -1) next = o + 2;
      o = ((len & 0x3f) << 8) | b[o + 1];
      continue;
    }
    if (o + 1 + len > b.length) return null;
    labels.push(String.fromCharCode(...b.subarray(o + 1, o + 1 + len)));
    o += 1 + len;
  }
  return null;
}

function parseDns(p: Uint8Array): DnsHeader | null {
  if (p.length < 12) return null;
  const flags = u16(p, 2);
  const qd = u16(p, 4);
  const an = u16(p, 6);
  if (qd > 20 || an > 60) return null;
  let o = 12;
  const questions: DnsHeader['questions'] = [];
  for (let i = 0; i < qd; i++) {
    const n = readDnsName(p, o);
    if (!n || n.next + 4 > p.length) return null;
    questions.push({ name: n.name, type: DNS_TYPES[u16(p, n.next)] ?? `TYPE${u16(p, n.next)}` });
    o = n.next + 4;
  }
  const answers: DnsHeader['answers'] = [];
  for (let i = 0; i < an; i++) {
    const n = readDnsName(p, o);
    if (!n || n.next + 10 > p.length) break;
    const type = u16(p, n.next);
    const ttl = u32(p, n.next + 4);
    const rdlen = u16(p, n.next + 8);
    const rd = n.next + 10;
    if (rd + rdlen > p.length) break;
    let value = '';
    if (type === 1 && rdlen === 4) value = ip4(p, rd);
    else if (type === 28 && rdlen === 16) value = ip6(p, rd);
    else if (type === 5 || type === 2 || type === 12) value = readDnsName(p, rd)?.name ?? '';
    else value = `${rdlen} bytes`;
    answers.push({ name: n.name, type: DNS_TYPES[type] ?? `TYPE${type}`, value, ttl });
    o = rd + rdlen;
  }
  const names: string[] = [];
  if (flags & 0x8000) names.push('QR');
  if (flags & 0x0400) names.push('AA');
  if (flags & 0x0200) names.push('TC');
  if (flags & 0x0100) names.push('RD');
  if (flags & 0x0080) names.push('RA');
  const rcode = flags & 0xf;
  if (rcode) names.push(rcode === 3 ? 'NXDOMAIN' : `RCODE=${rcode}`);
  return { transactionId: u16(p, 0), isResponse: !!(flags & 0x8000), opcode: 'QUERY', flags: names, questions, answers };
}

function parseTls(p: Uint8Array): TlsHeader | null {
  if (p.length < 5 || p[0] < 20 || p[0] > 23 || p[1] !== 3 || p[2] > 4) return null;
  const recordType = ({ 20: 'ChangeCipherSpec', 21: 'Alert', 22: 'Handshake', 23: 'Application Data' } as const)[
    p[0] as 20 | 21 | 22 | 23
  ];
  const out: TlsHeader = { recordType, version: 'TLS 1.2' };
  if (p[0] === 22 && p.length > 9) {
    const names: Record<number, string> = { 1: 'ClientHello', 2: 'ServerHello', 4: 'NewSessionTicket', 11: 'Certificate', 12: 'ServerKeyExchange', 14: 'ServerHelloDone', 16: 'ClientKeyExchange', 20: 'Finished' };
    out.handshakeType = names[p[5]] ?? `Handshake ${p[5]}`;
    if (p[5] === 1) out.sni = findSni(p);
  }
  return out;
}

/** Best-effort SNI lookup in a ClientHello; never throws. */
function findSni(p: Uint8Array): string | undefined {
  try {
    let o = 5 + 4 + 2 + 32; // record + handshake header + version + random
    o += 1 + p[o]; // session id
    o += 2 + u16(p, o); // cipher suites
    o += 1 + p[o]; // compression
    const end = Math.min(p.length, o + 2 + u16(p, o));
    o += 2;
    while (o + 4 <= end) {
      const type = u16(p, o);
      const len = u16(p, o + 2);
      if (type === 0 && len >= 5) {
        const nameLen = u16(p, o + 7);
        return String.fromCharCode(...p.subarray(o + 9, o + 9 + nameLen));
      }
      o += 4 + len;
    }
  } catch {
    /* ignore malformed hello */
  }
  return undefined;
}

const HTTP_START = /^(GET|POST|PUT|DELETE|HEAD|OPTIONS|PATCH|HTTP\/1\.[01]) /;
function parseHttp(p: Uint8Array): AppHeader | null {
  if (p.length < 8) return null;
  const head = String.fromCharCode(...p.subarray(0, Math.min(p.length, 400)));
  if (!HTTP_START.test(head)) return null;
  const first = head.split(/\r?\n/)[0];
  return {
    protocolName: 'HTTP',
    summary: first,
    rawText: head,
    fields: head
      .split(/\r?\n/)
      .slice(1, 8)
      .filter((l) => l.includes(':'))
      .map((l) => {
        const i = l.indexOf(':');
        return { key: l.slice(0, i), value: l.slice(i + 1).trim() };
      }),
  };
}

interface Decoded {
  layers: PacketLayers;
  protocol: string;
  info: string;
  color: PacketColorCategory;
  osi: number;
  srcIp: string;
  dstIp: string;
  srcPort?: number;
  dstPort?: number;
}

function decodeNetwork(b: Uint8Array, offset: number, etherType: number, layers: PacketLayers): Decoded | null {
  const srcMac = layers.ethernet.srcMac;
  if (etherType === 0x0806 && b.length >= offset + 28) {
    const op = u16(b, offset + 6) === 2 ? 2 : 1;
    const senderIp = ip4(b, offset + 14);
    const targetIp = ip4(b, offset + 24);
    layers.arp = { opcode: op, senderMac: hex(b, offset + 8, 6), senderIp, targetMac: hex(b, offset + 18, 6), targetIp };
    return {
      layers,
      protocol: 'ARP',
      color: 'l2',
      osi: 2,
      srcIp: senderIp,
      dstIp: targetIp,
      info: op === 1 ? `Who has ${targetIp}? Tell ${senderIp}` : `${senderIp} is at ${srcMac}`,
    };
  }

  let proto = 0;
  let srcIp = '';
  let dstIp = '';
  let l4 = 0;
  let l4end = b.length;
  if (etherType === 0x0800 && b.length >= offset + 20 && b[offset] >> 4 === 4) {
    const ihl = (b[offset] & 0xf) * 4;
    if (ihl < 20 || b.length < offset + ihl) return null;
    proto = b[offset + 9];
    srcIp = ip4(b, offset + 12);
    dstIp = ip4(b, offset + 16);
    const total = u16(b, offset + 2);
    layers.ipv4 = {
      version: 4,
      ihl: ihl / 4,
      tos: b[offset + 1],
      totalLength: total,
      identification: u16(b, offset + 4),
      flags: { df: !!(b[offset + 6] & 0x40), mf: !!(b[offset + 6] & 0x20) },
      fragmentOffset: ((b[offset + 6] & 0x1f) << 8) | b[offset + 7],
      ttl: b[offset + 8],
      protocol: proto,
      checksum: u16(b, offset + 10),
      srcIp,
      dstIp,
    };
    l4 = offset + ihl;
    if (total >= ihl && offset + total <= b.length) l4end = offset + total;
  } else if (etherType === 0x86dd && b.length >= offset + 40 && b[offset] >> 4 === 6) {
    proto = b[offset + 6];
    srcIp = ip6(b, offset + 8);
    dstIp = ip6(b, offset + 24);
    layers.ipv6 = {
      version: 6,
      trafficClass: ((b[offset] & 0xf) << 4) | (b[offset + 1] >> 4),
      flowLabel: ((b[offset + 1] & 0xf) << 16) | u16(b, offset + 2),
      payloadLength: u16(b, offset + 4),
      nextHeader: proto,
      hopLimit: b[offset + 7],
      srcIp,
      dstIp,
    };
    l4 = offset + 40;
  } else {
    return null;
  }

  const payloadOf = (start: number) => b.subarray(Math.min(start, l4end), l4end);

  if (proto === 6 && l4end >= l4 + 20) {
    const dataOffset = (b[l4 + 12] >> 4) * 4;
    const f = b[l4 + 13];
    const flags = { urg: !!(f & 0x20), ack: !!(f & 0x10), psh: !!(f & 0x08), rst: !!(f & 0x04), syn: !!(f & 0x02), fin: !!(f & 0x01) };
    const srcPort = u16(b, l4);
    const dstPort = u16(b, l4 + 2);
    layers.tcp = { srcPort, dstPort, seq: u32(b, l4 + 4), ack: u32(b, l4 + 8), dataOffset: dataOffset / 4, flags, window: u16(b, l4 + 14), checksum: u16(b, l4 + 16), urgentPointer: u16(b, l4 + 18) };
    const payload = payloadOf(l4 + dataOffset);
    const flagText = (Object.entries(flags) as Array<[string, boolean]>).filter(([, v]) => v).map(([k]) => k.toUpperCase());
    let protocol = 'TCP';
    let color: PacketColorCategory = 'tcp';
    let osi = 4;
    let extra = '';
    const tls = payload.length ? parseTls(payload) : null;
    const http = !tls && payload.length ? parseHttp(payload) : null;
    if (tls) {
      layers.tls = tls;
      protocol = 'TLS';
      color = 'tls';
      osi = 6;
      extra = ` ${tls.handshakeType ?? tls.recordType}${tls.sni ? ` (SNI ${tls.sni})` : ''}`;
    } else if (http) {
      layers.app = http;
      protocol = 'HTTP';
      color = http.summary.startsWith('HTTP/') ? 'http_res' : 'http_req';
      osi = 7;
      extra = ` ${http.summary}`;
    }
    return {
      layers,
      protocol,
      color,
      osi,
      srcIp,
      dstIp,
      srcPort,
      dstPort,
      info: `${srcPort} → ${dstPort} [${flagText.join(', ') || 'no flags'}] Seq=${layers.tcp.seq} Ack=${layers.tcp.ack} Win=${layers.tcp.window} Len=${payload.length}${extra}`,
    };
  }

  if (proto === 17 && l4end >= l4 + 8) {
    const srcPort = u16(b, l4);
    const dstPort = u16(b, l4 + 2);
    layers.udp = { srcPort, dstPort, length: u16(b, l4 + 4), checksum: u16(b, l4 + 6) };
    const payload = payloadOf(l4 + 8);
    const dns = srcPort === 53 || dstPort === 53 || srcPort === 5353 || dstPort === 5353 ? parseDns(payload) : null;
    if (dns) {
      layers.dns = dns;
      const q = dns.questions[0];
      const answers = dns.answers.map((a) => a.value).filter(Boolean).join(', ');
      return {
        layers,
        protocol: 'DNS',
        color: 'dns',
        osi: 7,
        srcIp,
        dstIp,
        srcPort,
        dstPort,
        info: `${dns.isResponse ? 'Response' : 'Query'} ${q ? `${q.type} ${q.name}` : ''}${answers ? ` → ${answers}` : ''}${dns.flags.includes('NXDOMAIN') ? ' NXDOMAIN' : ''}`.trim(),
      };
    }
    const dhcp = (srcPort === 67 || srcPort === 68) && (dstPort === 67 || dstPort === 68);
    return {
      layers,
      protocol: dhcp ? 'DHCP' : dstPort === 443 || srcPort === 443 ? 'QUIC/UDP' : dstPort === 123 || srcPort === 123 ? 'NTP' : 'UDP',
      color: 'udp',
      osi: dhcp ? 7 : 4,
      srcIp,
      dstIp,
      srcPort,
      dstPort,
      info: `${srcPort} → ${dstPort} Len=${payload.length}`,
    };
  }

  if ((proto === 1 || proto === 58) && l4end >= l4 + 4) {
    const type = b[l4];
    const code = b[l4 + 1];
    const v4 = proto === 1;
    const names4: Record<number, string> = { 0: 'Echo reply', 3: 'Destination unreachable', 8: 'Echo request', 11: 'Time exceeded' };
    const names6: Record<number, string> = { 1: 'Destination unreachable', 2: 'Packet too big', 3: 'Time exceeded', 128: 'Echo request', 129: 'Echo reply', 133: 'Router solicitation', 134: 'Router advertisement', 135: 'Neighbor solicitation', 136: 'Neighbor advertisement' };
    const message = (v4 ? names4 : names6)[type] ?? `Type ${type}`;
    layers.icmp = { type, code, checksum: u16(b, l4 + 2), identifier: l4end >= l4 + 6 ? u16(b, l4 + 4) : 0, sequence: l4end >= l4 + 8 ? u16(b, l4 + 6) : 0, message };
    const isError = (v4 && (type === 3 || type === 11)) || (!v4 && (type === 1 || type === 2 || type === 3));
    return { layers, protocol: v4 ? 'ICMP' : 'ICMPv6', color: isError ? 'error' : 'icmp', osi: 3, srcIp, dstIp, info: `${message} (type=${type}, code=${code})` };
  }

  const other: Record<number, string> = { 2: 'IGMP', 47: 'GRE', 50: 'ESP', 89: 'OSPF', 132: 'SCTP' };
  return {
    layers,
    protocol: other[proto] ?? `IP proto ${proto}`,
    color: proto === 89 ? 'routing' : 'sec',
    osi: 3,
    srcIp,
    dstIp,
    info: `${srcIp} → ${dstIp}`,
  };
}

function decodeFrame(b: Uint8Array, linkType: number): Decoded & { srcMac: string; dstMac: string } {
  let etherType = 0;
  let offset = 0;
  let srcMac = '00:00:00:00:00:00';
  let dstMac = '00:00:00:00:00:00';
  let vlanId: number | undefined;

  if (linkType === 1) {
    if (b.length >= 14) {
      dstMac = hex(b, 0, 6);
      srcMac = hex(b, 6, 6);
      etherType = u16(b, 12);
      offset = 14;
      while ((etherType === 0x8100 || etherType === 0x88a8) && b.length >= offset + 4) {
        vlanId = u16(b, offset) & 0xfff;
        etherType = u16(b, offset + 2);
        offset += 4;
      }
    }
  } else if (linkType === 113) {
    if (b.length >= 16) {
      etherType = u16(b, 14);
      offset = 16;
    }
  } else if (b.length > 0) {
    etherType = b[0] >> 4 === 6 ? 0x86dd : 0x0800;
  }

  // PPPoE: discovery frames are labelled; session frames are unwrapped to the IP packet inside.
  let pppoeDiscovery: string | null = null;
  if (etherType === 0x8863 && b.length >= offset + 6) {
    const codes: Record<number, string> = { 0x09: 'PADI', 0x07: 'PADO', 0x19: 'PADR', 0x65: 'PADS', 0xa7: 'PADT' };
    pppoeDiscovery = codes[b[offset + 1]] ?? `code 0x${b[offset + 1].toString(16)}`;
  } else if (etherType === 0x8864 && b.length >= offset + 8) {
    const ppp = u16(b, offset + 6);
    if (ppp === 0x0021 || ppp === 0x0057) {
      etherType = ppp === 0x0021 ? 0x0800 : 0x86dd;
      offset += 8;
    }
  }

  const layers: PacketLayers = { ethernet: { srcMac, dstMac, etherType: `0x${etherType.toString(16).padStart(4, '0')}`, vlanId } };
  if (pppoeDiscovery) {
    return { layers, protocol: 'PPPoE', color: 'l2', osi: 2, srcIp: '', dstIp: '', info: `PPPoE Discovery ${pppoeDiscovery}`, srcMac, dstMac };
  }
  const decoded = decodeNetwork(b, offset, etherType, layers);
  if (decoded) return { ...decoded, srcMac, dstMac };
  return {
    layers,
    protocol: 'Ethernet',
    color: 'l2',
    osi: 2,
    srcIp: '',
    dstIp: '',
    info: `EtherType 0x${etherType.toString(16).padStart(4, '0')}`,
    srcMac,
    dstMac,
  };
}

/** Parses a classic libpcap file (not pcapng) into the app's packet model. */
export function parsePcap(buffer: ArrayBuffer): PcapResult | PcapFailure {
  if (buffer.byteLength < 24) return { ok: false, error: 'too_small' };
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  const magicLE = view.getUint32(0, true);

  if (magicLE === 0x0a0d0d0a) return { ok: false, error: 'pcapng' };
  let little: boolean;
  let nano = false;
  if (magicLE === 0xa1b2c3d4) little = true;
  else if (magicLE === 0xa1b23c4d) {
    little = true;
    nano = true;
  } else if (magicLE === 0xd4c3b2a1) little = false;
  else if (magicLE === 0x4d3cb2a1) {
    little = false;
    nano = true;
  } else return { ok: false, error: 'not_pcap' };

  const linkType = view.getUint32(20, little) & 0x0fffffff;
  if (!SUPPORTED_LINK_TYPES.has(linkType)) return { ok: false, error: 'link_type', linkType };

  const packets: CapturedPacket[] = [];
  let offset = 24;
  let total = 0;
  let truncated = false;
  let t0 = -1;

  while (offset + 16 <= buffer.byteLength) {
    const sec = view.getUint32(offset, little);
    const frac = view.getUint32(offset + 4, little);
    const capLen = view.getUint32(offset + 8, little);
    const origLen = view.getUint32(offset + 12, little);
    offset += 16;
    if (capLen > 262144 || offset + capLen > buffer.byteLength) {
      truncated = true;
      break;
    }
    total++;
    if (packets.length >= MAX_PCAP_PACKETS) {
      truncated = true;
      offset += capLen;
      continue;
    }
    const frame = bytes.slice(offset, offset + capLen);
    offset += capLen;

    const ms = sec * 1000 + (nano ? frac / 1e6 : frac / 1000);
    if (t0 < 0) t0 = ms;
    const d = decodeFrame(frame, linkType);
    const from = d.srcIp || d.srcMac;
    const to = d.dstIp || d.dstMac;
    const no = packets.length + 1;
    const fieldRanges: FieldByteRange[] = [];

    packets.push({
      id: `pcap-${no}`,
      no,
      timestampMs: ms - t0,
      arrivalMs: ms - t0,
      fromDeviceId: from,
      toDeviceId: to,
      srcMac: d.srcMac,
      dstMac: d.dstMac,
      srcIp: d.srcIp,
      dstIp: d.dstIp,
      protocol: d.protocol,
      colorCategory: d.color,
      info: d.info,
      sizeBytes: Math.max(origLen, capLen),
      osiLayer: d.osi,
      layers: d.layers,
      rawBytes: Array.from(frame),
      fieldRanges,
    });
  }

  if (packets.length === 0) return { ok: false, error: 'empty' };
  return { ok: true, packets, linkType, totalRecords: total, truncated };
}

/** The busiest endpoints, used as the columns of the sequence diagram. */
export function busiestHosts(packets: CapturedPacket[], limit = 8): string[] {
  const counts = new Map<string, number>();
  for (const p of packets) {
    for (const id of [p.fromDeviceId, p.toDeviceId]) {
      if (id && !/^(ff:ff:ff:ff:ff:ff|01:00:5e|33:33)/i.test(id)) counts.set(id, (counts.get(id) ?? 0) + 1);
    }
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([id]) => id);
}
