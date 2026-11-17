import type { PacketColorCategory } from '../../engine/types';

export interface PacketColorMeta {
  hex: string;
  darkHex: string;
  bgClass: string;
  textClass: string;
  borderClass: string;
  label: string;
}

/**
 * Calmer, theme-harmonious palette designed to blend seamlessly with
 * Crisp Daylight (Light) and Deep Ocean Slate (Dark).
 * Uses balanced saturation to avoid eye fatigue during long simulation sessions.
 */
export const PACKET_COLORS: Record<PacketColorCategory, PacketColorMeta> = {
  dns: {
    hex: '#7c3aed',
    darkHex: '#a78bfa',
    bgClass: 'bg-violet-500/10 dark:bg-violet-500/15',
    textClass: 'text-violet-700 dark:text-violet-300',
    borderClass: 'border-violet-500/30 dark:border-violet-400/35',
    label: 'DNS',
  },
  tcp: {
    hex: '#0284c7',
    darkHex: '#38bdf8',
    bgClass: 'bg-sky-500/10 dark:bg-sky-500/15',
    textClass: 'text-sky-700 dark:text-sky-300',
    borderClass: 'border-sky-500/30 dark:border-sky-400/35',
    label: 'TCP',
  },
  tls: {
    hex: '#0f766e',
    darkHex: '#2dd4bf',
    bgClass: 'bg-teal-500/10 dark:bg-teal-500/15',
    textClass: 'text-teal-700 dark:text-teal-300',
    borderClass: 'border-teal-500/30 dark:border-teal-400/35',
    label: 'TLS',
  },
  http_req: {
    hex: '#d97706',
    darkHex: '#fbbf24',
    bgClass: 'bg-amber-500/10 dark:bg-amber-500/15',
    textClass: 'text-amber-800 dark:text-amber-300',
    borderClass: 'border-amber-500/30 dark:border-amber-400/35',
    label: 'HTTP Req',
  },
  http_res: {
    hex: '#2563eb',
    darkHex: '#60a5fa',
    bgClass: 'bg-blue-500/10 dark:bg-blue-500/15',
    textClass: 'text-blue-700 dark:text-blue-300',
    borderClass: 'border-blue-500/30 dark:border-blue-400/35',
    label: 'HTTP Res',
  },
  udp: {
    hex: '#c2410c',
    darkHex: '#fb923c',
    bgClass: 'bg-orange-500/10 dark:bg-orange-500/15',
    textClass: 'text-orange-800 dark:text-orange-300',
    borderClass: 'border-orange-500/30 dark:border-orange-400/35',
    label: 'UDP',
  },
  icmp: {
    hex: '#e11d48',
    darkHex: '#fb7185',
    bgClass: 'bg-rose-500/10 dark:bg-rose-500/15',
    textClass: 'text-rose-700 dark:text-rose-300',
    borderClass: 'border-rose-500/30 dark:border-rose-400/35',
    label: 'ICMP',
  },
  error: {
    hex: '#b91c1c',
    darkHex: '#f87171',
    bgClass: 'bg-red-500/10 dark:bg-red-500/20',
    textClass: 'text-red-700 dark:text-red-300',
    borderClass: 'border-red-500/40 dark:border-red-400/45',
    label: 'Error / Drop',
  },
  l2: {
    hex: '#059669',
    darkHex: '#34d399',
    bgClass: 'bg-emerald-500/10 dark:bg-emerald-500/15',
    textClass: 'text-emerald-700 dark:text-emerald-300',
    borderClass: 'border-emerald-500/30 dark:border-emerald-400/35',
    label: 'L2 / ARP',
  },
  sec: {
    hex: '#0d9488',
    darkHex: '#2dd4bf',
    bgClass: 'bg-teal-500/10 dark:bg-teal-500/15',
    textClass: 'text-teal-700 dark:text-teal-300',
    borderClass: 'border-teal-500/30 dark:border-teal-400/35',
    label: 'Security',
  },
  routing: {
    hex: '#4f46e5',
    darkHex: '#818cf8',
    bgClass: 'bg-indigo-500/10 dark:bg-indigo-500/15',
    textClass: 'text-indigo-700 dark:text-indigo-300',
    borderClass: 'border-indigo-500/30 dark:border-indigo-400/35',
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
  { key: 'error', label: 'Error / Drop', hex: PACKET_COLORS.error.hex },
];
