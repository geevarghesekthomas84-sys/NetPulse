import { describe, expect, it } from 'vitest';
import {
  computeIcmpChecksum,
  computeIpv4Checksum,
  computeTransportChecksum,
  formatChecksum,
  onesComplementChecksum,
} from '../../lib/checksum';
import {
  compressTopology,
  decodeExploreHash,
  decompressTopology,
  encodeExploreHash,
} from '../../lib/deepLink';
import { matchesDisplayFilter, validateDisplayFilter } from '../../lib/displayFilter';
import {
  bytesToHexString,
  formatHexDump,
  stringToBytes,
  uint16ToBytes,
  uint32ToBytes,
} from '../../lib/hexDump';
import {
  calculateSubnet,
  intToIp,
  ipToBytes,
  ipToInt,
  ipv6ToBytes,
  isValidIpv4,
  macToBytes,
  maskToPrefix,
  matchesCidr,
  networkAddress,
  prefixToMask,
  sameSubnet,
} from '../../lib/ipUtils';
import { buildCsvExport, buildPcapFile } from '../../lib/pcapWriter';
import { buildRealPacket } from '../../engine/packetBuilder';

describe('Checksums (RFC 1071 / RFC 793 / RFC 8200)', () => {
  it('computes and verifies IPv4 header checksums to zero', () => {
    const ipHdr = [
      0x45, 0x00, 0x00, 0x3c,
      0x1c, 0x46, 0x40, 0x00,
      0x40, 0x06, 0x00, 0x00,
      0xac, 0x10, 0x0a, 0x63,
      0xac, 0x10, 0x0a, 0x0c,
    ];
    const csum = computeIpv4Checksum(ipHdr);
    expect(csum).toBe(0xb1e6);
    expect(formatChecksum(csum)).toBe('0xb1e6');
    ipHdr[10] = (csum >> 8) & 0xff;
    ipHdr[11] = csum & 0xff;
    expect(onesComplementChecksum(ipHdr)).toBe(0);
  });

  it('computes distinct IPv4 and IPv6 TCP/UDP pseudo-header checksums and ICMP checksums', () => {
    const tcpSeg = [
      0xc4, 0x80, 0x00, 0x50,
      0x00, 0x00, 0x00, 0x01,
      0x00, 0x00, 0x00, 0x01,
      0x50, 0x10, 0xff, 0xff,
      0x00, 0x00, 0x00, 0x00,
    ];
    const v4Csum = computeTransportChecksum('192.168.1.10', '203.0.113.10', 6, tcpSeg);
    expect(v4Csum).toBeGreaterThan(0);

    // IPv6 pseudo-header must reflect full 128-bit address differences in lower hextets
    const v6CsumA = computeTransportChecksum('2001:db8::1', '2001:db8::2', 6, tcpSeg);
    const v6CsumB = computeTransportChecksum('2001:db8::1', '2001:db8::99', 6, tcpSeg);
    expect(v6CsumA).not.toBe(v6CsumB);

    const icmpBytes = [0x08, 0x00, 0x00, 0x00, 0x04, 0x01, 0x00, 0x01, 0x61, 0x62];
    const icmpCsum = computeIcmpChecksum(icmpBytes);
    icmpBytes[2] = (icmpCsum >> 8) & 0xff;
    icmpBytes[3] = icmpCsum & 0xff;
    expect(onesComplementChecksum(icmpBytes)).toBe(0);
  });
});

describe('IPv4, IPv6, CIDR & Subnetting Utilities', () => {
  it('converts IPv4/IPv6/MAC addresses and validates IPv4 format', () => {
    expect(intToIp(ipToInt('192.168.1.10'))).toBe('192.168.1.10');
    expect(ipToInt('999.1.1.1')).toBe(0);
    expect(isValidIpv4('10.0.0.1')).toBe(true);
    expect(isValidIpv4('10.0.0.256')).toBe(false);
    expect(isValidIpv4('not-an-ip')).toBe(false);

    expect(ipToBytes('10.20.30.40')).toEqual([10, 20, 30, 40]);
    const v6 = ipv6ToBytes('2001:db8::1');
    expect(v6).toHaveLength(16);
    expect(v6.slice(0, 4)).toEqual([0x20, 0x01, 0x0d, 0xb8]);
    expect(v6.slice(14, 16)).toEqual([0x00, 0x01]);
    expect(macToBytes('02:42:ac:11:00:ff')).toEqual([0x02, 0x42, 0xac, 0x11, 0x00, 0xff]);
  });

  it('computes CIDR prefixes, subnet membership, and RFC 1918 class/ranges', () => {
    expect(maskToPrefix('255.255.255.192')).toBe(26);
    expect(prefixToMask(26)).toBe('255.255.255.192');
    expect(prefixToMask(0)).toBe('0.0.0.0');
    expect(sameSubnet('192.168.10.5', '192.168.10.200', '255.255.255.0')).toBe(true);
    expect(sameSubnet('192.168.10.5', '192.168.11.5', '255.255.255.0')).toBe(false);
    expect(networkAddress('172.16.45.99', 16)).toBe('172.16.0.0');
    expect(matchesCidr('10.5.9.1', '10.0.0.0', '255.0.0.0')).toBe(true);

    const info24 = calculateSubnet('172.16.5.42', 24);
    expect(info24.network).toBe('172.16.5.0');
    expect(info24.broadcast).toBe('172.16.5.255');
    expect(info24.firstHost).toBe('172.16.5.1');
    expect(info24.lastHost).toBe('172.16.5.254');
    expect(info24.usableHosts).toBe(254);
    expect(info24.ipClass).toBe('B');
    expect(info24.isPrivate).toBe(true);

    const p2p = calculateSubnet('198.51.100.1', 31);
    expect(p2p.usableHosts).toBe(2);
    expect(p2p.isPrivate).toBe(false);
  });
});

describe('Hex Dump, Display Filter, Deep Links & PCAP/CSV Export', () => {
  it('formats hex dumps and integer byte helpers accurately', () => {
    expect(uint16ToBytes(0x1234)).toEqual([0x12, 0x34]);
    expect(uint32ToBytes(0x89abcdef)).toEqual([0x89, 0xab, 0xcd, 0xef]);
    const raw = stringToBytes('GET / HTTP/1.1\r\n');
    expect(bytesToHexString([0x0a, 0xff])).toBe('0a ff');
    const lines = formatHexDump([...raw, 0x00, 0x01]);
    expect(lines[0].offsetHex).toBe('0000');
    expect(lines[0].ascii).toContain('GET / HTTP/1.1');
    expect(lines.length).toBe(2);
  });

  it('validates and evaluates complex Wireshark display filters', () => {
    const synPkt = buildRealPacket({
      id: 'p1',
      no: 1,
      timestampMs: 0,
      arrivalMs: 10,
      fromDeviceId: 'c',
      toDeviceId: 's',
      protocol: 'HTTP',
      colorCategory: 'http_req',
      info: 'GET /index.html HTTP/1.1',
      osiLayer: 7,
      ethernet: { srcMac: '02:00:00:00:00:01', dstMac: '02:00:00:00:00:02', etherType: '0x0800' },
      ipv4: {
        version: 4, ihl: 5, tos: 0, identification: 1, flags: { df: true, mf: false },
        fragmentOffset: 0, ttl: 64, protocol: 6, srcIp: '192.168.1.10', dstIp: '203.0.113.10',
      },
      tcp: {
        srcPort: 54000, dstPort: 80, seq: 1, ack: 1, dataOffset: 5,
        flags: { urg: false, ack: true, psh: true, rst: false, syn: true, fin: false },
        window: 65535, urgentPointer: 0,
      },
    });

    expect(matchesDisplayFilter(synPkt, '')).toBe(true);
    expect(matchesDisplayFilter(synPkt, 'http.request && ip.src == 192.168.1.10')).toBe(true);
    expect(matchesDisplayFilter(synPkt, 'tcp.port == 80 || udp.port == 53')).toBe(true);
    expect(matchesDisplayFilter(synPkt, 'eth.addr == 02:00:00:00:00:02')).toBe(true);
    expect(matchesDisplayFilter(synPkt, 'tcp.flags.syn == 1 && tcp.flags.rst != 1')).toBe(true);
    expect(matchesDisplayFilter(synPkt, '!dns && !udp')).toBe(true);
    expect(matchesDisplayFilter(synPkt, 'http.response')).toBe(false);

    expect(validateDisplayFilter('ip.src == "192.168.1.10" && tcp.port == 80').valid).toBe(true);
    expect(validateDisplayFilter('"unclosed').valid).toBe(false);
    expect(validateDisplayFilter('&& tcp').valid).toBe(false);
    expect(validateDisplayFilter('tcp ||').valid).toBe(false);
    expect(validateDisplayFilter('!').valid).toBe(false);
    expect(validateDisplayFilter('ip.src = 1.1.1.1').valid).toBe(false);
    expect(validateDisplayFilter('unknown.field == 1').valid).toBe(false);
  });

  it('roundtrips deep links and LZ-compressed topologies', () => {
    const hash = encodeExploreHash({
      mode: 'explore',
      protocol: 'tls',
      step: 2,
      speed: 2,
      view: 'sequence',
      theme: 'dark',
    });
    expect(decodeExploreHash(hash)).toEqual({
      mode: 'explore',
      protocol: 'tls',
      step: 2,
      speed: 2,
      view: 'sequence',
      theme: 'dark',
    });
    expect(decodeExploreHash('#explore/dns')).toEqual({ mode: 'explore', protocol: 'dns' });
    expect(decodeExploreHash('#simulator')).toEqual({ mode: 'simulator' });

    const sampleTopo = { devices: [{ id: 'a', x: 100 }], links: [{ id: 'l1' }] };
    const compressed = compressTopology(sampleTopo);
    expect(decompressTopology<typeof sampleTopo>(compressed)).toEqual(sampleTopo);
    expect(decompressTopology('corrupt-!@#')).toBeNull();
  });

  it('exports valid multi-packet PCAP binary records and escaped CSV', () => {
    const pkt = buildRealPacket({
      id: 'p1',
      no: 1,
      timestampMs: 1250,
      arrivalMs: 1260,
      fromDeviceId: 'a',
      toDeviceId: 'b',
      protocol: 'UDP',
      colorCategory: 'udp',
      info: 'DNS "query", test',
      osiLayer: 7,
      ethernet: { srcMac: '02:00:00:00:00:01', dstMac: '02:00:00:00:00:02', etherType: '0x0800' },
      ipv4: {
        version: 4, ihl: 5, tos: 0, identification: 1, flags: { df: false, mf: false },
        fragmentOffset: 0, ttl: 64, protocol: 17, srcIp: '10.0.0.1', dstIp: '10.0.0.2',
      },
      udp: { srcPort: 5000, dstPort: 53 },
    });

    const pcap = buildPcapFile([pkt, pkt]);
    expect(pcap.length).toBe(24 + 2 * (16 + pkt.rawBytes.length));
    const dv = new DataView(pcap.buffer);
    expect(dv.getUint32(0, true)).toBe(0xa1b2c3d4);
    expect(dv.getUint32(24 + 8, true)).toBe(pkt.rawBytes.length);

    const csv = buildCsvExport([pkt]);
    expect(csv).toContain('No.,Time (s),Source,Destination,Protocol,Length,Info');
    expect(csv).toContain('"DNS ""query"", test"');
  });
});
