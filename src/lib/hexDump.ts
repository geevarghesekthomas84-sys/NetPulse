export interface HexLine {
  offset: number;
  offsetHex: string;
  bytes: number[];
  ascii: string;
}

export function formatHexDump(rawBytes: number[]): HexLine[] {
  const lines: HexLine[] = [];
  for (let i = 0; i < rawBytes.length; i += 16) {
    const slice = rawBytes.slice(i, i + 16);
    const ascii = slice
      .map((b) => (b >= 32 && b <= 126 ? String.fromCharCode(b) : '.'))
      .join('');
    lines.push({
      offset: i,
      offsetHex: i.toString(16).padStart(4, '0'),
      bytes: slice,
      ascii,
    });
  }
  return lines;
}

export function bytesToHexString(bytes: number[]): string {
  return bytes.map((b) => (b & 0xff).toString(16).padStart(2, '0')).join(' ');
}

export function stringToBytes(str: string): number[] {
  const encoder = new TextEncoder();
  return Array.from(encoder.encode(str));
}

export function uint16ToBytes(n: number): [number, number] {
  return [(n >>> 8) & 0xff, n & 0xff];
}

export function uint32ToBytes(n: number): [number, number, number, number] {
  return [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff];
}
