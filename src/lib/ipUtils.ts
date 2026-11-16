// Pure IPv4, IPv6, CIDR, Subnet, and MAC address utilities

export function ipToInt(ip: string): number {
  const parts = ip.trim().split('.').map(Number);
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p) || p < 0 || p > 255)) {
    return 0;
  }
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

export function intToIp(num: number): string {
  const u = num >>> 0;
  return [(u >>> 24) & 0xff, (u >>> 16) & 0xff, (u >>> 8) & 0xff, u & 0xff].join('.');
}

export function ipToBytes(ip: string): number[] {
  if (ip.includes(':')) {
    return ipv6ToBytes(ip);
  }
  const parts = ip.trim().split('.').map((p) => Math.max(0, Math.min(255, Number(p) || 0)));
  while (parts.length < 4) parts.push(0);
  return parts.slice(0, 4);
}

export function ipv6ToBytes(ip: string): number[] {
  const [head, tail] = ip.split('::');
  const headParts = head ? head.split(':').filter(Boolean) : [];
  const tailParts = tail ? tail.split(':').filter(Boolean) : [];
  const missing = Math.max(0, 8 - headParts.length - tailParts.length);
  const full = [...headParts, ...Array(missing).fill('0'), ...tailParts].slice(0, 8);
  const bytes: number[] = [];
  for (const part of full) {
    const val = parseInt(part || '0', 16) || 0;
    bytes.push((val >> 8) & 0xff, val & 0xff);
  }
  while (bytes.length < 16) bytes.push(0);
  return bytes.slice(0, 16);
}

export function macToBytes(mac: string): number[] {
  const parts = mac.split(/[:-]/).map((h) => parseInt(h, 16) || 0);
  while (parts.length < 6) parts.push(0);
  return parts.slice(0, 6);
}

export function isValidIpv4(ip: string): boolean {
  const parts = ip.trim().split('.');
  if (parts.length !== 4) return false;
  return parts.every((p) => /^\d+$/.test(p) && Number(p) >= 0 && Number(p) <= 255);
}

export function maskToPrefix(mask: string): number {
  if (!isValidIpv4(mask)) return 24;
  const n = ipToInt(mask);
  let bits = 0;
  for (let i = 31; i >= 0; i--) {
    if ((n >>> i) & 1) bits++;
    else break;
  }
  return bits;
}

export function prefixToMask(prefix: number): string {
  const p = Math.max(0, Math.min(32, prefix));
  const mask = p === 0 ? 0 : (~0 << (32 - p)) >>> 0;
  return intToIp(mask);
}

export function sameSubnet(ipA: string, ipB: string, mask: string): boolean {
  const m = ipToInt(mask);
  return (ipToInt(ipA) & m) === (ipToInt(ipB) & m);
}

export function networkAddress(ip: string, prefix: number): string {
  const mask = ipToInt(prefixToMask(prefix));
  return intToIp((ipToInt(ip) & mask) >>> 0);
}

export function matchesCidr(ip: string, cidrNetwork: string, cidrMask: string): boolean {
  const ipInt = ipToInt(ip);
  const netInt = ipToInt(cidrNetwork);
  const maskInt = ipToInt(cidrMask);
  return (ipInt & maskInt) === (netInt & maskInt);
}

export interface SubnetInfo {
  ip: string;
  prefix: number;
  mask: string;
  wildcard: string;
  network: string;
  broadcast: string;
  firstHost: string;
  lastHost: string;
  totalHosts: number;
  usableHosts: number;
  binaryIp: string;
  binaryMask: string;
  ipClass: string;
  isPrivate: boolean;
}

export function calculateSubnet(ip: string, prefix: number): SubnetInfo {
  const p = Math.max(0, Math.min(32, Math.floor(prefix)));
  const ipInt = ipToInt(ip);
  const maskInt = p === 0 ? 0 : (~0 << (32 - p)) >>> 0;
  const wildcardInt = (~maskInt) >>> 0;
  const netInt = (ipInt & maskInt) >>> 0;
  const bcastInt = (netInt | wildcardInt) >>> 0;
  const totalHosts = Math.pow(2, 32 - p);
  const usableHosts = p >= 31 ? (p === 32 ? 1 : 2) : Math.max(0, totalHosts - 2);
  const firstHostInt = p >= 31 ? netInt : (netInt + 1) >>> 0;
  const lastHostInt = p >= 31 ? bcastInt : (bcastInt - 1) >>> 0;

  const firstOctet = (ipInt >>> 24) & 0xff;
  const secondOctet = (ipInt >>> 16) & 0xff;
  let ipClass = 'A';
  if (firstOctet >= 128 && firstOctet <= 191) ipClass = 'B';
  else if (firstOctet >= 192 && firstOctet <= 223) ipClass = 'C';
  else if (firstOctet >= 224 && firstOctet <= 239) ipClass = 'D (Multicast)';
  else if (firstOctet >= 240) ipClass = 'E (Experimental)';

  const isPrivate =
    firstOctet === 10 ||
    (firstOctet === 172 && secondOctet >= 16 && secondOctet <= 31) ||
    (firstOctet === 192 && secondOctet === 168) ||
    firstOctet === 127;

  const toBin = (n: number) =>
    [24, 16, 8, 0].map((s) => ((n >>> s) & 0xff).toString(2).padStart(8, '0')).join('.');

  return {
    ip: intToIp(ipInt),
    prefix: p,
    mask: intToIp(maskInt),
    wildcard: intToIp(wildcardInt),
    network: intToIp(netInt),
    broadcast: intToIp(bcastInt),
    firstHost: intToIp(firstHostInt),
    lastHost: intToIp(lastHostInt),
    totalHosts,
    usableHosts,
    binaryIp: toBin(ipInt),
    binaryMask: toBin(maskInt),
    ipClass,
    isPrivate,
  };
}
