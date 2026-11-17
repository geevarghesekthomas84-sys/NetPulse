import { describe, expect, it } from 'vitest';
import { parsePcapFile } from '../../lib/pcapReader';

describe('PCAP Parser', () => {
  it('throws for files smaller than 24 bytes', () => {
    const smallBuffer = new ArrayBuffer(10);
    expect(() => parsePcapFile(smallBuffer)).toThrow('File too small to be a valid PCAP file.');
  });

  it('throws for invalid magic number', () => {
    const buffer = new ArrayBuffer(32);
    const view = new DataView(buffer);
    view.setUint32(0, 0x12345678, true);
    expect(() => parsePcapFile(buffer)).toThrow(/Unsupported PCAP magic number/);
  });

  it('parses valid synthetic pcap header with zero packets', () => {
    const buffer = new ArrayBuffer(24);
    const view = new DataView(buffer);
    view.setUint32(0, 0xa1b2c3d4, true); // standard magic
    view.setUint16(4, 2, true); // major 2
    view.setUint16(6, 4, true); // minor 4
    view.setUint32(8, 0, true); // thiszone
    view.setUint32(12, 0, true); // sigfigs
    view.setUint32(16, 65535, true); // snaplen
    view.setUint32(20, 1, true); // linktype = Ethernet

    const packets = parsePcapFile(buffer);
    expect(packets).toEqual([]);
  });
});
