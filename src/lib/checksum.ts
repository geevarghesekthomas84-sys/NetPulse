import { ipToBytes } from './ipUtils';

/**
 * Computes RFC 1071 Internet Checksum (16-bit one's complement of the one's complement sum)
 */
export function onesComplementChecksum(bytes: number[]): number {
  let sum = 0;
  for (let i = 0; i < bytes.length; i += 2) {
    const high = bytes[i] & 0xff;
    const low = i + 1 < bytes.length ? bytes[i + 1] & 0xff : 0;
    sum += (high << 8) | low;
    while (sum > 0xffff) {
      sum = (sum & 0xffff) + (sum >>> 16);
    }
  }
  return (~sum) & 0xffff;
}

/**
 * Computes IPv4 header checksum over 20+ byte IPv4 header (bytes 10..11 zeroed during calculation).
 */
export function computeIpv4Checksum(ipHeaderBytes: number[]): number {
  const copy = [...ipHeaderBytes];
  if (copy.length >= 12) {
    copy[10] = 0;
    copy[11] = 0;
  }
  return onesComplementChecksum(copy);
}

/**
 * Computes TCP or UDP checksum with IPv4 pseudo-header (RFC 793 / RFC 768).
 */
export function computeTransportChecksum(
  srcIp: string,
  dstIp: string,
  protocol: 6 | 17,
  segmentBytes: number[]
): number {
  const isIpv6 = srcIp.includes(':') || dstIp.includes(':');
  const len = segmentBytes.length;
  const pseudoHeader = isIpv6
    ? [
        ...ipToBytes(srcIp).slice(0, 16),
        ...ipToBytes(dstIp).slice(0, 16),
        (len >>> 24) & 0xff,
        (len >>> 16) & 0xff,
        (len >>> 8) & 0xff,
        len & 0xff,
        0,
        0,
        0,
        protocol,
      ]
    : [
        ...ipToBytes(srcIp).slice(0, 4),
        ...ipToBytes(dstIp).slice(0, 4),
        0,
        protocol,
        (len >> 8) & 0xff,
        len & 0xff,
      ];
  const copy = [...segmentBytes];
  if (protocol === 6 && copy.length >= 18) {
    copy[16] = 0;
    copy[17] = 0;
  } else if (protocol === 17 && copy.length >= 8) {
    copy[6] = 0;
    copy[7] = 0;
  }
  return onesComplementChecksum([...pseudoHeader, ...copy]);
}

/**
 * Computes ICMP checksum over ICMP header + payload (bytes 2..3 zeroed during calculation).
 */
export function computeIcmpChecksum(icmpBytes: number[]): number {
  const copy = [...icmpBytes];
  if (copy.length >= 4) {
    copy[2] = 0;
    copy[3] = 0;
  }
  return onesComplementChecksum(copy);
}

/**
 * Formats 16-bit checksum as 0xXXXX
 */
export function formatChecksum(csum: number): string {
  return `0x${(csum & 0xffff).toString(16).padStart(4, '0')}`;
}
