import type { PacketColorCategory } from '../../engine/types';

export interface PacketColorMeta {
  hex: string;
  bgClass: string;
  textClass: string;
  borderClass: string;
  label: string;
}

export const PACKET_COLORS: Record<PacketColorCategory, PacketColorMeta> = {
  dns: {
    hex: '#9333ea',
    bgClass: 'bg-purple-500/10',
    textClass: 'text-purple-700 dark:text-purple-300',
    borderClass: 'border-purple-500/40',
    label: 'DNS',
  },
  tcp: {
    hex: '#0891b2',
    bgClass: 'bg-cyan-500/10',
    textClass: 'text-cyan-700 dark:text-cyan-300',
    borderClass: 'border-cyan-500/40',
    label: 'TCP',
  },
  tls: {
    hex: '#059669',
    bgClass: 'bg-emerald-500/10',
    textClass: 'text-emerald-700 dark:text-emerald-300',
    borderClass: 'border-emerald-500/40',
    label: 'TLS',
  },
  http_req: {
    hex: '#ea580c',
    bgClass: 'bg-orange-500/10',
    textClass: 'text-orange-700 dark:text-orange-300',
    borderClass: 'border-orange-500/40',
    label: 'HTTP Req',
  },
  http_res: {
    hex: '#2563eb',
    bgClass: 'bg-blue-500/10',
    textClass: 'text-blue-700 dark:text-blue-300',
    borderClass: 'border-blue-500/40',
    label: 'HTTP Res',
  },
  udp: {
    hex: '#b45309',
    bgClass: 'bg-amber-500/10',
    textClass: 'text-amber-700 dark:text-amber-300',
    borderClass: 'border-amber-500/40',
    label: 'UDP',
  },
  icmp: {
    hex: '#db2777',
    bgClass: 'bg-pink-500/10',
    textClass: 'text-pink-700 dark:text-pink-300',
    borderClass: 'border-pink-500/40',
    label: 'ICMP',
  },
  error: {
    hex: '#dc2626',
    bgClass: 'bg-red-500/12',
    textClass: 'text-red-700 dark:text-red-300',
    borderClass: 'border-red-500/50',
    label: 'Error / Drop',
  },
  l2: {
    hex: '#0f766e',
    bgClass: 'bg-teal-500/10',
    textClass: 'text-teal-700 dark:text-teal-300',
    borderClass: 'border-teal-500/40',
    label: 'L2 / ARP',
  },
  sec: {
    hex: '#047857',
    bgClass: 'bg-emerald-500/10',
    textClass: 'text-emerald-700 dark:text-emerald-300',
    borderClass: 'border-emerald-500/40',
    label: 'Security',
  },
  routing: {
    hex: '#4f46e5',
    bgClass: 'bg-indigo-500/10',
    textClass: 'text-indigo-700 dark:text-indigo-300',
    borderClass: 'border-indigo-500/40',
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
