import type { PacketColorCategory } from '../../engine/types';

export interface PacketColorMeta {
  /** CSS color for shapes and lines (a theme variable, so it follows light/dark). */
  hex: string;
  bgClass: string;
  textClass: string;
  borderClass: string;
  label: string;
}

/**
 * Packet colors come from the --pkt-* tokens in index.css, which are tuned per
 * theme and checked for contrast in src/tests/unit/theme-contrast.test.ts.
 */
export const PACKET_COLORS: Record<PacketColorCategory, PacketColorMeta> = {
  dns: {
    hex: 'var(--pkt-dns)',
    bgClass: 'bg-[color-mix(in_srgb,var(--pkt-dns)_13%,transparent)]',
    textClass: 'text-[var(--pkt-dns-text)]',
    borderClass: 'border-[color-mix(in_srgb,var(--pkt-dns)_45%,transparent)]',
    label: 'DNS',
  },
  tcp: {
    hex: 'var(--pkt-tcp)',
    bgClass: 'bg-[color-mix(in_srgb,var(--pkt-tcp)_13%,transparent)]',
    textClass: 'text-[var(--pkt-tcp-text)]',
    borderClass: 'border-[color-mix(in_srgb,var(--pkt-tcp)_45%,transparent)]',
    label: 'TCP',
  },
  tls: {
    hex: 'var(--pkt-tls)',
    bgClass: 'bg-[color-mix(in_srgb,var(--pkt-tls)_13%,transparent)]',
    textClass: 'text-[var(--pkt-tls-text)]',
    borderClass: 'border-[color-mix(in_srgb,var(--pkt-tls)_45%,transparent)]',
    label: 'TLS',
  },
  http_req: {
    hex: 'var(--pkt-http-req)',
    bgClass: 'bg-[color-mix(in_srgb,var(--pkt-http-req)_13%,transparent)]',
    textClass: 'text-[var(--pkt-http-req-text)]',
    borderClass: 'border-[color-mix(in_srgb,var(--pkt-http-req)_45%,transparent)]',
    label: 'HTTP Req',
  },
  http_res: {
    hex: 'var(--pkt-http-res)',
    bgClass: 'bg-[color-mix(in_srgb,var(--pkt-http-res)_13%,transparent)]',
    textClass: 'text-[var(--pkt-http-res-text)]',
    borderClass: 'border-[color-mix(in_srgb,var(--pkt-http-res)_45%,transparent)]',
    label: 'HTTP Res',
  },
  udp: {
    hex: 'var(--pkt-udp)',
    bgClass: 'bg-[color-mix(in_srgb,var(--pkt-udp)_13%,transparent)]',
    textClass: 'text-[var(--pkt-udp-text)]',
    borderClass: 'border-[color-mix(in_srgb,var(--pkt-udp)_45%,transparent)]',
    label: 'UDP',
  },
  icmp: {
    hex: 'var(--pkt-icmp)',
    bgClass: 'bg-[color-mix(in_srgb,var(--pkt-icmp)_13%,transparent)]',
    textClass: 'text-[var(--pkt-icmp-text)]',
    borderClass: 'border-[color-mix(in_srgb,var(--pkt-icmp)_45%,transparent)]',
    label: 'ICMP',
  },
  error: {
    hex: 'var(--pkt-error)',
    bgClass: 'bg-[color-mix(in_srgb,var(--pkt-error)_13%,transparent)]',
    textClass: 'text-[var(--pkt-error-text)]',
    borderClass: 'border-[color-mix(in_srgb,var(--pkt-error)_45%,transparent)]',
    label: 'Error / Drop',
  },
  l2: {
    hex: 'var(--pkt-l2)',
    bgClass: 'bg-[color-mix(in_srgb,var(--pkt-l2)_13%,transparent)]',
    textClass: 'text-[var(--pkt-l2-text)]',
    borderClass: 'border-[color-mix(in_srgb,var(--pkt-l2)_45%,transparent)]',
    label: 'L2 / ARP',
  },
  sec: {
    hex: 'var(--pkt-sec)',
    bgClass: 'bg-[color-mix(in_srgb,var(--pkt-sec)_13%,transparent)]',
    textClass: 'text-[var(--pkt-sec-text)]',
    borderClass: 'border-[color-mix(in_srgb,var(--pkt-sec)_45%,transparent)]',
    label: 'Security',
  },
  routing: {
    hex: 'var(--pkt-routing)',
    bgClass: 'bg-[color-mix(in_srgb,var(--pkt-routing)_13%,transparent)]',
    textClass: 'text-[var(--pkt-routing-text)]',
    borderClass: 'border-[color-mix(in_srgb,var(--pkt-routing)_45%,transparent)]',
    label: 'Routing',
  },
};

export const LEGEND_ITEMS: Array<{ key: PacketColorCategory; label: string; hex: string }> = [
  { key: 'dns', label: 'DNS', hex: PACKET_COLORS.dns.hex },
  { key: 'tcp', label: 'TCP', hex: PACKET_COLORS.tcp.hex },
  { key: 'tls', label: 'TLS', hex: PACKET_COLORS.tls.hex },
  { key: 'http_req', label: 'HTTP Req', hex: PACKET_COLORS.http_req.hex },
  { key: 'http_res', label: 'HTTP Res', hex: PACKET_COLORS.http_res.hex },
  { key: 'udp', label: 'UDP', hex: PACKET_COLORS.udp.hex },
  { key: 'icmp', label: 'ICMP', hex: PACKET_COLORS.icmp.hex },
  { key: 'error', label: 'Error/Drop', hex: PACKET_COLORS.error.hex },
];
