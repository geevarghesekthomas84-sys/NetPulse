import type { CapturedPacket, PacketColorCategory } from '../engine/types';

/**
 * Parses standard libpcap (.pcap) binary data (LINKTYPE_ETHERNET = 1)
 * into structured CapturedPacket objects that can be visualized and replayed.
 */
export function parsePcapFile(buffer: ArrayBuffer): CapturedPacket[] {
  if (buffer.byteLength < 24) {
    throw new Error('File too small to be a valid PCAP file.');
  }

  const view = new DataView(buffer);
  const magic = view.getUint32(0, true);

  let isLittleEndian = true;
  let isNano = false;

  if (magic === 0xa1b2c3d4) {
    isLittleEndian = true;
  } else if (magic === 0xd4c3b2a1) {
    isLittleEndian = false;
  } else if (magic === 0xa1b23c4d) {
    isLittleEndian = true;
    isNano = true;
  } else if (magic === 0x4d3cb2a1) {
    isLittleEndian = false;
    isNano = true;
  } else {
    throw new Error('Unsupported PCAP magic number (0x' + magic.toString(16) + '). Only standard .pcap files are supported.');
  }

  const linkType = view.getUint32(20, isLittleEndian);
  if (linkType !== 1 && linkType !== 0) {
    // 1 = LINKTYPE_ETHERNET, 0 = LINKTYPE_NULL
    console.warn('Non-Ethernet linktype detected in PCAP:', linkType);
  }

  const packets: CapturedPacket[] = [];
  let offset = 24;
  let packetNo = 1;
  let firstTimestampMs: number | null = null;

  while (offset + 16 <= buffer.byteLength) {
    const tsSec = view.getUint32(offset, isLittleEndian);
    const tsUsec = view.getUint32(offset + 4, isLittleEndian);
    const capLen = view.getUint32(offset + 8, isLittleEndian);
    const origLen = view.getUint32(offset + 12, isLittleEndian);

    offset += 16;
    if (offset + capLen > buffer.byteLength) break;

    const rawBytes = Array.from(new Uint8Array(buffer, offset, capLen));
    const timestampMs = tsSec * 1000 + (isNano ? tsUsec / 1000000 : tsUsec / 1000);
    if (firstTimestampMs === null) firstTimestampMs = timestampMs;
    const relTimestampMs = Math.max(0, timestampMs - firstTimestampMs);

    // Decode Ethernet II frame
    let srcMac = '00:00:00:00:00:00';
    let dstMac = '00:00:00:00:00:00';
    let etherType = 0;
    let ipOffset = 14;

    if (rawBytes.length >= 14) {
      dstMac = rawBytes.slice(0, 6).map((b) => b.toString(16).padStart(2, '0')).join(':');
      srcMac = rawBytes.slice(6, 12).map((b) => b.toString(16).padStart(2, '0')).join(':');
      etherType = (rawBytes[12] << 8) | rawBytes[13];
    }

    let srcIp = srcMac;
    let dstIp = dstMac;
    let protocol = 'Ethernet';
    let colorCategory: PacketColorCategory = 'l2';
    let srcPort = 0;
    let dstPort = 0;
    let summary = `Frame ${packetNo}: ${capLen} bytes`;

    const layers: CapturedPacket['layers'] = {
      ethernet: {
        srcMac,
        dstMac,
        etherType: `0x${etherType.toString(16).padStart(4, '0')}`,
      },
    };

    // IPv4 decode
    if (etherType === 0x0800 && rawBytes.length >= ipOffset + 20) {
      const ihl = (rawBytes[ipOffset] & 0x0f) * 4;
      const totalLen = (rawBytes[ipOffset + 2] << 8) | rawBytes[ipOffset + 3];
      const ttl = rawBytes[ipOffset + 8];
      const ipProto = rawBytes[ipOffset + 9];

      srcIp = `${rawBytes[ipOffset + 12]}.${rawBytes[ipOffset + 13]}.${rawBytes[ipOffset + 14]}.${rawBytes[ipOffset + 15]}`;
      dstIp = `${rawBytes[ipOffset + 16]}.${rawBytes[ipOffset + 17]}.${rawBytes[ipOffset + 18]}.${rawBytes[ipOffset + 19]}`;

      layers.ipv4 = {
        version: 4,
        ihl,
        tos: rawBytes[ipOffset + 1],
        totalLength: totalLen,
        identification: (rawBytes[ipOffset + 4] << 8) | rawBytes[ipOffset + 5],
        flags: {
          df: Boolean(rawBytes[ipOffset + 6] & 0x40),
          mf: Boolean(rawBytes[ipOffset + 6] & 0x20),
        },
        fragmentOffset: ((rawBytes[ipOffset + 6] & 0x1f) << 8) | rawBytes[ipOffset + 7],
        ttl,
        protocol: ipProto,
        checksum: (rawBytes[ipOffset + 10] << 8) | rawBytes[ipOffset + 11],
        srcIp,
        dstIp,
      };

      const l4Offset = ipOffset + ihl;

      // TCP
      if (ipProto === 6 && rawBytes.length >= l4Offset + 20) {
        srcPort = (rawBytes[l4Offset] << 8) | rawBytes[l4Offset + 1];
        dstPort = (rawBytes[l4Offset + 2] << 8) | rawBytes[l4Offset + 3];
        const seqNo = (rawBytes[l4Offset + 4] << 24) | (rawBytes[l4Offset + 5] << 16) | (rawBytes[l4Offset + 6] << 8) | rawBytes[l4Offset + 7];
        const ackNo = (rawBytes[l4Offset + 8] << 24) | (rawBytes[l4Offset + 9] << 16) | (rawBytes[l4Offset + 10] << 8) | rawBytes[l4Offset + 11];
        const flagsByte = rawBytes[l4Offset + 13];

        const flagNames: string[] = [];
        if (flagsByte & 0x02) flagNames.push('SYN');
        if (flagsByte & 0x10) flagNames.push('ACK');
        if (flagsByte & 0x01) flagNames.push('FIN');
        if (flagsByte & 0x04) flagNames.push('RST');
        if (flagsByte & 0x08) flagNames.push('PSH');
        if (flagsByte & 0x20) flagNames.push('URG');

        protocol = 'TCP';
        colorCategory = 'tcp';
        if (srcPort === 80 || dstPort === 80) {
          protocol = 'HTTP';
          colorCategory = dstPort === 80 ? 'http_req' : 'http_res';
        } else if (srcPort === 443 || dstPort === 443) {
          protocol = 'TLS';
          colorCategory = 'tls';
        }

        summary = `${protocol} ${srcPort} → ${dstPort} [${flagNames.join(', ') || 'NONE'}] Seq=${seqNo}`;
        layers.tcp = {
          srcPort,
          dstPort,
          seq: seqNo,
          ack: ackNo,
          dataOffset: (rawBytes[l4Offset + 12] >> 4) * 4,
          flags: {
            urg: Boolean(flagsByte & 0x20),
            ack: Boolean(flagsByte & 0x10),
            psh: Boolean(flagsByte & 0x08),
            rst: Boolean(flagsByte & 0x04),
            syn: Boolean(flagsByte & 0x02),
            fin: Boolean(flagsByte & 0x01),
          },
          window: (rawBytes[l4Offset + 14] << 8) | rawBytes[l4Offset + 15],
          checksum: (rawBytes[l4Offset + 16] << 8) | rawBytes[l4Offset + 17],
          urgentPointer: 0,
        };
      }
      // UDP
      else if (ipProto === 17 && rawBytes.length >= l4Offset + 8) {
        srcPort = (rawBytes[l4Offset] << 8) | rawBytes[l4Offset + 1];
        dstPort = (rawBytes[l4Offset + 2] << 8) | rawBytes[l4Offset + 3];
        const udpLen = (rawBytes[l4Offset + 4] << 8) | rawBytes[l4Offset + 5];

        protocol = 'UDP';
        colorCategory = 'udp';
        if (srcPort === 53 || dstPort === 53) {
          protocol = 'DNS';
          colorCategory = 'dns';
        }

        summary = `${protocol} ${srcPort} → ${dstPort} Len=${udpLen}`;
        layers.udp = {
          srcPort,
          dstPort,
          length: udpLen,
          checksum: (rawBytes[l4Offset + 6] << 8) | rawBytes[l4Offset + 7],
        };
      }
      // ICMP
      else if (ipProto === 1 && rawBytes.length >= l4Offset + 4) {
        protocol = 'ICMP';
        colorCategory = 'icmp';
        const type = rawBytes[l4Offset];
        const code = rawBytes[l4Offset + 1];
        summary = `ICMP Type ${type} Code ${code}`;
        layers.icmp = {
          type,
          code,
          checksum: (rawBytes[l4Offset + 2] << 8) | rawBytes[l4Offset + 3],
          identifier: 0,
          sequence: 0,
          message: summary,
        };
      }
    } else if (etherType === 0x0806) {
      protocol = 'ARP';
      colorCategory = 'l2';
      summary = `ARP Request/Reply`;
    }

    const osiLayer =
      protocol === 'HTTP' || protocol === 'TLS' || protocol === 'DNS'
        ? 7
        : protocol === 'TCP' || protocol === 'UDP'
        ? 4
        : protocol === 'ARP'
        ? 2
        : 3;

    packets.push({
      id: `pcap-${packetNo}`,
      no: packetNo,
      timestampMs: relTimestampMs,
      arrivalMs: relTimestampMs,
      fromDeviceId: srcIp,
      toDeviceId: dstIp,
      srcMac,
      dstMac,
      srcIp,
      dstIp,
      protocol,
      colorCategory,
      info: summary,
      osiLayer,
      sizeBytes: origLen || rawBytes.length,
      fieldRanges: [],
      rawBytes,
      layers,
    });

    offset += capLen;
    packetNo++;
  }

  return packets;
}
