import type { CapturedPacket } from '../engine/types';

/**
 * Generates a valid libpcap (.pcap) binary Uint8Array (LINKTYPE_ETHERNET = 1)
 * that can be opened directly in Wireshark / tcpdump.
 */
export function buildPcapFile(packets: CapturedPacket[]): Uint8Array {
  const globalHeaderSize = 24;
  const recordHeaderSize = 16;

  let totalSize = globalHeaderSize;
  for (const pkt of packets) {
    totalSize += recordHeaderSize + pkt.rawBytes.length;
  }

  const buffer = new ArrayBuffer(totalSize);
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);

  // Global Header (Little Endian magic: 0xa1b2c3d4)
  view.setUint32(0, 0xa1b2c3d4, true); // magic_number
  view.setUint16(4, 2, true); // version_major
  view.setUint16(6, 4, true); // version_minor
  view.setInt32(8, 0, true); // thiszone
  view.setUint32(12, 0, true); // sigfigs
  view.setUint32(16, 65535, true); // snaplen
  view.setUint32(20, 1, true); // network = LINKTYPE_ETHERNET (1)

  let offset = globalHeaderSize;
  const baseEpochSec = 1731680000;

  for (const pkt of packets) {
    const timeSec = Math.floor(pkt.timestampMs / 1000);
    const timeUsec = Math.floor((pkt.timestampMs % 1000) * 1000);
    const capLen = pkt.rawBytes.length;
    const origLen = Math.max(capLen, pkt.sizeBytes);

    view.setUint32(offset, baseEpochSec + timeSec, true);
    view.setUint32(offset + 4, timeUsec, true);
    view.setUint32(offset + 8, capLen, true);
    view.setUint32(offset + 12, origLen, true);
    offset += recordHeaderSize;

    for (let i = 0; i < capLen; i++) {
      bytes[offset + i] = pkt.rawBytes[i] & 0xff;
    }
    offset += capLen;
  }

  return bytes;
}

export function buildCsvExport(packets: CapturedPacket[]): string {
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const header = ['No.', 'Time (s)', 'Source', 'Destination', 'Protocol', 'Length', 'Info'].join(',');
  const rows = packets.map((p, idx) =>
    [
      idx + 1,
      (p.timestampMs / 1000).toFixed(4),
      escape(p.srcIp || p.srcMac),
      escape(p.dstIp || p.dstMac),
      escape(p.protocol),
      p.sizeBytes,
      escape(p.info),
    ].join(',')
  );
  return [header, ...rows].join('\n');
}

export function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
