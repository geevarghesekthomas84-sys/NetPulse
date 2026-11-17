import React, { useState } from 'react';
import {
  Activity,
  Cable,
  Check,
  Cpu,
  Edit3,
  Globe,
  HardDrive,
  Laptop,
  Layers,
  Lock,
  Network,
  Plus,
  Power,
  Radio,
  Router,
  Server,
  Settings2,
  Shield,
  Sliders,
  Terminal,
  Trash2,
  Unlink,
  Wifi,
  Zap,
} from 'lucide-react';
import type { DeviceRole, FirewallRule, LinkMedium, SimDevice, SimLink } from '../../engine/types';

interface PropertiesPanelProps {
  device: SimDevice | null;
  link: SimLink | null;
  devices: SimDevice[];
  links: SimLink[];
  onUpdateDevice: (updated: SimDevice) => void;
  onUpdateLink: (updated: SimLink) => void;
  onDeleteLink: (linkId: string) => void;
  onAddDevicePort: (deviceId: string) => void;
  onOpenDeviceModal?: (device: SimDevice) => void;
}

const ROLE_METADATA: Record<
  DeviceRole,
  { label: string; icon: React.FC<{ className?: string }> }
> = {
  host: { label: 'Host Client', icon: Laptop },
  router: { label: 'Core Router', icon: Router },
  switch: { label: 'L2 Switch', icon: Network },
  hub: { label: 'Ethernet Hub', icon: Network },
  access_point: { label: 'Access Point', icon: Wifi },
  firewall: { label: 'Firewall', icon: Shield },
  proxy: { label: 'Forward Proxy', icon: Server },
  reverse_proxy: { label: 'Reverse Proxy', icon: Server },
  dns_server: { label: 'DNS Server', icon: Globe },
  dhcp_server: { label: 'DHCP Server', icon: Server },
  web_server: { label: 'Web Server', icon: Globe },
  mail_server: { label: 'Mail Server', icon: Server },
  file_server: { label: 'File Server', icon: HardDrive },
  server_rack: { label: 'Server Rack', icon: Server },
  server_tower: { label: 'Server Tower', icon: Server },
  vpn_gateway: { label: 'VPN Gateway', icon: Lock },
  nat_gateway: { label: 'NAT Gateway', icon: Router },
  ip_camera: { label: 'IP Camera', icon: Activity },
  tv_box: { label: 'Smart TV / Box', icon: Activity },
  phone: { label: 'Mobile Device', icon: Laptop },
  plc: { label: 'Industrial PLC', icon: Cpu },
  cloud: { label: 'Cloud Network', icon: Network },
};

export const PropertiesPanel: React.FC<PropertiesPanelProps> = ({
  device,
  link,
  devices,
  links,
  onUpdateDevice,
  onUpdateLink,
  onDeleteLink,
  onAddDevicePort,
  onOpenDeviceModal,
}) => {
  const [newRulePort, setNewRulePort] = useState('80');
  const [newRuleAction, setNewRuleAction] = useState<'allow' | 'deny'>('deny');

  const devMap = new Map(devices.map((d) => [d.id, d]));

  // Link / Cable Inspector
  if (link) {
    const srcName = devMap.get(link.sourceId)?.name ?? link.sourceId;
    const dstName = devMap.get(link.targetId)?.name ?? link.targetId;

    return (
      <aside
        aria-label="Cable Properties Inspector"
        className="w-full lg:w-[350px] xl:w-[380px] shrink-0 border-t lg:border-t-0 lg:border-s border-[var(--border-hairline)] bg-[var(--bg-surface)] p-4 space-y-4 text-[13px] overflow-y-auto"
      >
        {/* Cable Header Card */}
        <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-elevated)]/50 p-3.5 space-y-3 shadow-xs">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--accent-primary)]/25 bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]">
                <Cable className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h3 className="font-display font-bold text-sm text-[var(--text-primary)] truncate">
                  Cable Properties
                </h3>
                <span className="text-xs text-[var(--text-muted)]">
                  Physical link configuration
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onUpdateLink({ ...link, up: !link.up })}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all shadow-xs ${
                link.up
                  ? 'border border-emerald-500/30 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                  : 'border border-rose-500/30 bg-rose-500/15 text-rose-700 dark:text-rose-300'
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  link.up ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
                }`}
              />
              <span>{link.up ? 'Link Up' : 'Link Down'}</span>
            </button>
          </div>

          {/* Connection Endpoints */}
          <div className="rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-2.5 space-y-1.5">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              Patch Connection
            </div>
            <div className="flex items-center justify-between font-mono text-xs text-[var(--text-primary)]">
              <span className="font-medium bg-[var(--bg-inset)] px-2 py-0.5 rounded">
                {srcName}:{link.sourceIface}
              </span>
              <span className="text-[var(--text-muted)]">↔</span>
              <span className="font-medium bg-[var(--bg-inset)] px-2 py-0.5 rounded">
                {dstName}:{link.targetIface}
              </span>
            </div>
          </div>
        </div>

        {/* Medium Selection */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-[var(--text-secondary)]">
            Transmission Medium
          </label>
          <div className="grid grid-cols-2 gap-1.5">
            {(['ethernet', 'fiber', 'serial', 'wireless'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => onUpdateLink({ ...link, medium: m as LinkMedium })}
                className={`flex items-center justify-center gap-1.5 rounded-lg border py-1.5 text-xs font-medium capitalize transition-all ${
                  link.medium === m
                    ? 'border-[var(--accent-primary)] bg-[var(--accent-primary-soft)] text-[var(--accent-primary)] font-semibold shadow-xs'
                    : 'border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]'
                }`}
              >
                {m === 'wireless' ? <Radio className="w-3.5 h-3.5" /> : <Cable className="w-3.5 h-3.5" />}
                <span>{m}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Cable Performance Metrics */}
        <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-3.5 space-y-3 shadow-xs">
          <div className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-1.5">
            <Sliders className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
            <span>Link Performance Characteristics</span>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <label className="space-y-1">
              <span className="text-[11px] font-medium text-[var(--text-secondary)]">Bandwidth</span>
              <div className="relative">
                <input
                  type="number"
                  min={1}
                  max={10000}
                  value={link.bandwidthMbps}
                  onChange={(e) => onUpdateLink({ ...link, bandwidthMbps: Math.max(1, Number(e.target.value)) })}
                  className="w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-inset)]/50 px-2.5 py-1.5 pe-12 font-mono text-xs text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:bg-[var(--bg-surface)] focus:ring-2 focus:ring-[var(--accent-primary)]/15 outline-none transition-all"
                />
                <span className="absolute end-2 top-1/2 -translate-y-1/2 text-[11px] text-[var(--text-muted)] pointer-events-none">
                  Mbps
                </span>
              </div>
            </label>

            <label className="space-y-1">
              <span className="text-[11px] font-medium text-[var(--text-secondary)]">Delay</span>
              <div className="relative">
                <input
                  type="number"
                  min={0}
                  max={2000}
                  value={link.delayMs}
                  onChange={(e) => onUpdateLink({ ...link, delayMs: Math.max(0, Number(e.target.value)) })}
                  className="w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-inset)]/50 px-2.5 py-1.5 pe-9 font-mono text-xs text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:bg-[var(--bg-surface)] focus:ring-2 focus:ring-[var(--accent-primary)]/15 outline-none transition-all"
                />
                <span className="absolute end-2 top-1/2 -translate-y-1/2 text-[11px] text-[var(--text-muted)] pointer-events-none">
                  ms
                </span>
              </div>
            </label>

            <label className="space-y-1">
              <span className="text-[11px] font-medium text-[var(--text-secondary)]">Jitter</span>
              <div className="relative">
                <input
                  type="number"
                  min={0}
                  max={500}
                  value={link.jitterMs}
                  onChange={(e) => onUpdateLink({ ...link, jitterMs: Math.max(0, Number(e.target.value)) })}
                  className="w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-inset)]/50 px-2.5 py-1.5 pe-9 font-mono text-xs text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:bg-[var(--bg-surface)] focus:ring-2 focus:ring-[var(--accent-primary)]/15 outline-none transition-all"
                />
                <span className="absolute end-2 top-1/2 -translate-y-1/2 text-[11px] text-[var(--text-muted)] pointer-events-none">
                  ms
                </span>
              </div>
            </label>

            <label className="space-y-1">
              <span className="text-[11px] font-medium text-[var(--text-secondary)]">Packet Loss</span>
              <div className="relative">
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={link.lossPercent}
                  onChange={(e) => onUpdateLink({ ...link, lossPercent: Math.min(100, Math.max(0, Number(e.target.value))) })}
                  className="w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-inset)]/50 px-2.5 py-1.5 pe-7 font-mono text-xs text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:bg-[var(--bg-surface)] focus:ring-2 focus:ring-[var(--accent-primary)]/15 outline-none transition-all"
                />
                <span className="absolute end-2 top-1/2 -translate-y-1/2 text-[11px] text-[var(--text-muted)] pointer-events-none">
                  %
                </span>
              </div>
            </label>

            <div className="col-span-2">
              <label className="space-y-1">
                <span className="text-[11px] font-medium text-[var(--text-secondary)]">MTU (Max Transmission Unit)</span>
                <div className="relative">
                  <input
                    type="number"
                    min={68}
                    max={9000}
                    value={link.mtu}
                    onChange={(e) => onUpdateLink({ ...link, mtu: Math.max(68, Number(e.target.value)) })}
                    className="w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-inset)]/50 px-2.5 py-1.5 pe-14 font-mono text-xs text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:bg-[var(--bg-surface)] focus:ring-2 focus:ring-[var(--accent-primary)]/15 outline-none transition-all"
                  />
                  <span className="absolute end-2 top-1/2 -translate-y-1/2 text-[11px] text-[var(--text-muted)] pointer-events-none">
                    Bytes
                  </span>
                </div>
              </label>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onDeleteLink(link.id)}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 py-2.5 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 transition-all shadow-xs"
        >
          <Unlink className="w-4 h-4" />
          <span>Disconnect Cable</span>
        </button>
      </aside>
    );
  }

  // Empty State (no device or cable selected)
  if (!device) {
    return (
      <aside
        aria-label="Properties Inspector"
        className="w-full lg:w-[350px] xl:w-[380px] shrink-0 border-t lg:border-t-0 lg:border-s border-[var(--border-hairline)] bg-[var(--bg-surface)] p-6 flex flex-col items-center justify-center text-center space-y-3"
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-elevated)]/60 text-[var(--text-muted)] shadow-xs">
          <Settings2 className="w-6 h-6" />
        </div>
        <div>
          <h4 className="font-display text-sm font-bold text-[var(--text-primary)]">
            No Item Selected
          </h4>
          <p className="mt-1 text-xs leading-relaxed text-[var(--text-secondary)] max-w-[260px]">
            Click on any device or connection cable on the canvas to inspect its ports, IP configuration, routing protocols, and firewall rules.
          </p>
        </div>
      </aside>
    );
  }

  // Device Inspector
  const updateIface = (idx: number, patch: Partial<SimDevice['interfaces'][0]>) => {
    const nextIfaces = device.interfaces.map((iface, i) => (i === idx ? { ...iface, ...patch } : iface));
    onUpdateDevice({ ...device, interfaces: nextIfaces });
  };

  const addFirewallRule = () => {
    const rule: FirewallRule = {
      id: `fw-${Date.now()}`,
      action: newRuleAction,
      direction: 'both',
      protocol: 'TCP',
      srcIp: 'any',
      dstIp: 'any',
      dstPort: newRulePort === 'any' ? 'any' : Number(newRulePort) || 80,
    };
    onUpdateDevice({ ...device, firewallRules: [...device.firewallRules, rule] });
  };

  const deviceLinks = links.filter((l) => l.sourceId === device.id || l.targetId === device.id);
  const roleMeta = ROLE_METADATA[device.role] ?? { label: device.role.replace('_', ' '), icon: Server };
  const RoleIcon = roleMeta.icon;

  return (
    <aside
      aria-label="Device Properties Inspector"
      className="w-full lg:w-[350px] xl:w-[380px] shrink-0 border-t lg:border-t-0 lg:border-s border-[var(--border-hairline)] bg-[var(--bg-surface)] p-4 space-y-4 text-[13px] overflow-y-auto"
    >
      {/* Redesigned Device Header Card */}
      <div className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-elevated)] p-4 space-y-3.5 shadow-xs">
        <div className="flex items-center justify-between gap-3">
          {/* Device Icon + Name + Meta */}
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border transition-all ${
                device.poweredOn
                  ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shadow-sm'
                  : 'border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-400'
              }`}
            >
              <RoleIcon className="w-5 h-5" />
            </div>

            <div className="min-w-0 flex-1">
              <input
                type="text"
                aria-label="Device Hostname"
                value={device.name}
                onChange={(e) => onUpdateDevice({ ...device, name: e.target.value })}
                placeholder="Device Name"
                className="w-full font-display font-extrabold text-base text-[var(--text-primary)] bg-transparent border-b border-transparent hover:border-[var(--border-strong)] focus:border-[var(--accent-primary)] outline-none py-0.5 transition-colors"
              />
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-[var(--accent-primary-soft)] text-[var(--accent-primary)]">
                  {roleMeta.label}
                </span>
                <span className="inline-flex items-center gap-1.5 text-xs text-[var(--text-secondary)] font-mono">
                  <span
                    className={`h-2 w-2 rounded-full ${
                      deviceLinks.length > 0 ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
                    }`}
                  />
                  {deviceLinks.length} {deviceLinks.length === 1 ? 'link' : 'links'}
                </span>
              </div>
            </div>
          </div>

          {/* Tactile Hardware Power Toggle Button */}
          <button
            type="button"
            onClick={() => onUpdateDevice({ ...device, poweredOn: !device.poweredOn })}
            title="Toggle Device Power"
            className={`group relative flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all duration-200 shrink-0 shadow-xs active:scale-95 ${
              device.poweredOn
                ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/25 hover:border-emerald-500/60'
                : 'border-slate-300 dark:border-slate-700 bg-[var(--bg-surface)] text-[var(--text-muted)] hover:border-slate-400 hover:text-[var(--text-primary)]'
            }`}
          >
            <Power
              className={`w-3.5 h-3.5 transition-transform group-hover:rotate-12 ${
                device.poweredOn ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'
              }`}
            />
            <span className="tracking-wider">{device.poweredOn ? 'ON' : 'OFF'}</span>
            <span
              className={`h-2 w-2 rounded-full ${
                device.poweredOn
                  ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.7)]'
                  : 'bg-slate-400'
              }`}
            />
          </button>
        </div>

        {onOpenDeviceModal && (
          <button
            type="button"
            onClick={() => onOpenDeviceModal(device)}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent-cta)] py-2.5 text-xs font-bold text-white hover:bg-[var(--accent-cta-hover)] shadow-sm transition-all active:scale-[0.99]"
          >
            <Terminal className="w-4 h-4" />
            <span>Open Device Console & Config</span>
          </button>
        )}
      </div>

      {/* Physical Front-Panel RJ-45 Port Bay */}
      <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-3.5 space-y-3 shadow-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
            <span className="font-display text-xs font-bold text-[var(--text-primary)]">
              Physical Port Bay
            </span>
            <span className="rounded-full bg-[var(--bg-inset)] px-2 py-0.2 text-[10px] font-mono text-[var(--text-muted)]">
              {device.interfaces.length}
            </span>
          </div>
          <button
            type="button"
            onClick={() => onAddDevicePort(device.id)}
            className="inline-flex items-center gap-1 rounded-lg border border-[var(--accent-primary)]/20 bg-[var(--accent-primary-soft)] px-2 py-1 font-mono text-xs font-semibold text-[var(--accent-primary)] hover:bg-[var(--accent-primary)] hover:text-white transition-all shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Port</span>
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {device.interfaces.map((iface) => {
            const attached = deviceLinks.find(
              (l) =>
                (l.sourceId === device.id && l.sourceIface === iface.name) ||
                (l.targetId === device.id && l.targetIface === iface.name)
            );
            const isUp = attached?.up;
            const isAttached = Boolean(attached);

            return (
              <div
                key={iface.id}
                className="flex items-center justify-between gap-1.5 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-inset)]/40 px-2.5 py-1.5 font-mono text-xs"
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <span
                    className={`h-2.5 w-1.5 rounded-xs shrink-0 ${
                      !isAttached
                        ? 'bg-[var(--border-strong)]'
                        : isUp
                        ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.6)]'
                        : 'bg-rose-500'
                    }`}
                  />
                  <span className="font-semibold text-[var(--text-primary)] truncate">
                    {iface.name}
                  </span>
                </div>
                <span className="text-[10px] text-[var(--text-muted)] shrink-0">
                  {isAttached ? (isUp ? 'UP' : 'DOWN') : 'EMPTY'}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Network Interfaces Configuration Cards */}
      <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-3.5 space-y-3 shadow-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Network className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
            <span className="font-display text-xs font-bold text-[var(--text-primary)]">
              Interfaces Configuration
            </span>
          </div>
        </div>

        <div className="space-y-3">
          {device.interfaces.map((iface, idx) => (
            <div
              key={iface.id}
              className="rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-inset)]/30 p-2.5 space-y-2.5"
            >
              <div className="flex items-center justify-between font-mono text-xs">
                <span className="font-bold text-[var(--accent-primary)] flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent-primary)]" />
                  {iface.name}
                </span>
                <span className="text-[11px] text-[var(--text-muted)] bg-[var(--bg-surface)] px-1.5 py-0.5 rounded border border-[var(--border-hairline)]">
                  MAC: {iface.mac}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <label className="space-y-1">
                  <span className="text-[11px] font-medium text-[var(--text-secondary)]">IP Address</span>
                  <input
                    type="text"
                    value={iface.ip}
                    onChange={(e) => updateIface(idx, { ip: e.target.value })}
                    className="w-full rounded-md border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-2 py-1 font-mono text-xs text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)]/20 outline-none transition-all"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-[11px] font-medium text-[var(--text-secondary)]">Subnet Mask</span>
                  <input
                    type="text"
                    value={iface.mask}
                    onChange={(e) => updateIface(idx, { mask: e.target.value })}
                    className="w-full rounded-md border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-2 py-1 font-mono text-xs text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)]/20 outline-none transition-all"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-[11px] font-medium text-[var(--text-secondary)]">Gateway</span>
                  <input
                    type="text"
                    value={iface.gateway ?? ''}
                    onChange={(e) => updateIface(idx, { gateway: e.target.value })}
                    placeholder="192.168.1.1"
                    className="w-full rounded-md border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-2 py-1 font-mono text-xs text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)]/20 outline-none transition-all"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-[11px] font-medium text-[var(--text-secondary)]">VLAN ID</span>
                  <input
                    type="number"
                    min={1}
                    max={4094}
                    value={iface.vlan ?? 1}
                    onChange={(e) => updateIface(idx, { vlan: Number(e.target.value) || 1 })}
                    className="w-full rounded-md border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-2 py-1 font-mono text-xs text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)]/20 outline-none transition-all"
                  />
                </label>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Network Services: DNS & Routing */}
      <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-3.5 space-y-3 shadow-xs">
        <div className="flex items-center gap-2">
          <Globe className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
          <span className="font-display text-xs font-bold text-[var(--text-primary)]">
            Network Services & Routing
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <label className="space-y-1">
            <span className="text-[11px] font-medium text-[var(--text-secondary)]">DNS Server</span>
            <input
              type="text"
              value={device.dnsServer ?? ''}
              onChange={(e) => onUpdateDevice({ ...device, dnsServer: e.target.value })}
              placeholder="8.8.8.8"
              className="w-full rounded-md border border-[var(--border-hairline)] bg-[var(--bg-inset)]/50 px-2 py-1.5 font-mono text-xs text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:bg-[var(--bg-surface)] focus:ring-1 focus:ring-[var(--accent-primary)]/20 outline-none transition-all"
            />
          </label>
          <label className="space-y-1">
            <span className="text-[11px] font-medium text-[var(--text-secondary)]">Routing Protocol</span>
            <select
              value={device.routingProtocol ?? 'none'}
              onChange={(e) =>
                onUpdateDevice({
                  ...device,
                  routingProtocol: e.target.value as SimDevice['routingProtocol'],
                })
              }
              className="w-full rounded-md border border-[var(--border-hairline)] bg-[var(--bg-inset)]/50 px-2 py-1.5 font-mono text-xs text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:bg-[var(--bg-surface)] focus:ring-1 focus:ring-[var(--accent-primary)]/20 outline-none transition-all"
            >
              <option value="none">Static / Connected</option>
              <option value="rip">RIP</option>
              <option value="ospf">OSPF</option>
              <option value="bgp">BGP</option>
            </select>
          </label>
        </div>

        {/* Gateway & Security Feature Toggles */}
        <div className="pt-2 border-t border-[var(--border-hairline)] space-y-2">
          <div className="text-[11px] font-semibold text-[var(--text-secondary)]">
            Gateway Security Features
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {/* NAT / PAT Toggle */}
            <button
              type="button"
              onClick={() => onUpdateDevice({ ...device, natEnabled: !device.natEnabled })}
              className={`flex items-center justify-between p-2 rounded-lg border text-left transition-all ${
                device.natEnabled
                  ? 'border-[var(--accent-primary)]/40 bg-[var(--accent-primary-soft)] text-[var(--text-primary)]'
                  : 'border-[var(--border-hairline)] bg-[var(--bg-inset)]/40 text-[var(--text-secondary)] hover:bg-[var(--bg-inset)]'
              }`}
            >
              <div className="min-w-0">
                <div className="text-xs font-semibold">NAT / PAT</div>
                <div className="text-[10px] text-[var(--text-muted)]">Port Mapping</div>
              </div>
              <div
                className={`h-4 w-7 rounded-full p-0.5 transition-colors ${
                  device.natEnabled ? 'bg-[var(--accent-primary)]' : 'bg-slate-300 dark:bg-slate-700'
                }`}
              >
                <div
                  className={`h-3 w-3 rounded-full bg-white transition-transform ${
                    device.natEnabled ? 'translate-x-3' : 'translate-x-0'
                  }`}
                />
              </div>
            </button>

            {/* Stateful FW Toggle */}
            <button
              type="button"
              onClick={() => onUpdateDevice({ ...device, statefulFirewall: !device.statefulFirewall })}
              className={`flex items-center justify-between p-2 rounded-lg border text-left transition-all ${
                device.statefulFirewall
                  ? 'border-[var(--tone-success)]/40 bg-[var(--tone-success)]/10 text-[var(--text-primary)]'
                  : 'border-[var(--border-hairline)] bg-[var(--bg-inset)]/40 text-[var(--text-secondary)] hover:bg-[var(--bg-inset)]'
              }`}
            >
              <div className="min-w-0">
                <div className="text-xs font-semibold">Stateful FW</div>
                <div className="text-[10px] text-[var(--text-muted)]">SPI Tracking</div>
              </div>
              <div
                className={`h-4 w-7 rounded-full p-0.5 transition-colors ${
                  device.statefulFirewall ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'
                }`}
              >
                <div
                  className={`h-3 w-3 rounded-full bg-white transition-transform ${
                    device.statefulFirewall ? 'translate-x-3' : 'translate-x-0'
                  }`}
                />
              </div>
            </button>

            {/* SYN Cookies Toggle */}
            <button
              type="button"
              onClick={() => onUpdateDevice({ ...device, synCookiesEnabled: !device.synCookiesEnabled })}
              className={`flex items-center justify-between p-2 rounded-lg border text-left transition-all ${
                device.synCookiesEnabled
                  ? 'border-amber-500/40 bg-amber-500/10 text-[var(--text-primary)]'
                  : 'border-[var(--border-hairline)] bg-[var(--bg-inset)]/40 text-[var(--text-secondary)] hover:bg-[var(--bg-inset)]'
              }`}
            >
              <div className="min-w-0">
                <div className="text-xs font-semibold">SYN Cookies</div>
                <div className="text-[10px] text-[var(--text-muted)]">Flood Protect</div>
              </div>
              <div
                className={`h-4 w-7 rounded-full p-0.5 transition-colors ${
                  device.synCookiesEnabled ? 'bg-amber-500' : 'bg-slate-300 dark:bg-slate-700'
                }`}
              >
                <div
                  className={`h-3 w-3 rounded-full bg-white transition-transform ${
                    device.synCookiesEnabled ? 'translate-x-3' : 'translate-x-0'
                  }`}
                />
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Firewall ACL Rules */}
      <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-3.5 space-y-3 shadow-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-3.5 h-3.5 text-[var(--tone-danger)]" />
            <span className="font-display text-xs font-bold text-[var(--text-primary)]">
              Firewall ACL Rules
            </span>
            <span className="rounded-full bg-[var(--bg-inset)] px-2 py-0.2 text-[10px] font-mono text-[var(--text-muted)]">
              {device.firewallRules.length}
            </span>
          </div>
        </div>

        {/* Add Rule Row */}
        <div className="flex items-center gap-1.5">
          <select
            value={newRuleAction}
            onChange={(e) => setNewRuleAction(e.target.value as 'allow' | 'deny')}
            className={`rounded-lg border px-2 py-1.5 font-mono text-xs font-semibold outline-none transition-colors ${
              newRuleAction === 'deny'
                ? 'border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400'
                : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
            }`}
          >
            <option value="deny">DENY</option>
            <option value="allow">ALLOW</option>
          </select>
          <input
            type="text"
            value={newRulePort}
            onChange={(e) => setNewRulePort(e.target.value)}
            placeholder="Port (80, 443, any)"
            className="flex-1 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-inset)]/50 px-2.5 py-1.5 font-mono text-xs text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:bg-[var(--bg-surface)] focus:ring-1 focus:ring-[var(--accent-primary)]/20 outline-none transition-all"
          />
          <button
            type="button"
            onClick={addFirewallRule}
            className="flex items-center gap-1 rounded-lg bg-[var(--accent-cta)] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[var(--accent-cta-hover)] transition-all shadow-xs shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Rule</span>
          </button>
        </div>

        {/* Existing Rules */}
        {device.firewallRules.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[var(--border-hairline)] p-2.5 text-center text-xs text-[var(--text-muted)]">
            No active firewall ACL rules. Default policy: Permit all traffic.
          </div>
        ) : (
          <div className="space-y-1.5">
            {device.firewallRules.map((rule) => (
              <div
                key={rule.id}
                className="flex items-center justify-between rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-inset)]/30 px-3 py-1.5 font-mono text-xs"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      rule.action === 'deny'
                        ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                        : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                    }`}
                  >
                    {rule.action.toUpperCase()}
                  </span>
                  <span className="text-[var(--text-primary)]">
                    {rule.protocol} port <span className="font-bold">{rule.dstPort}</span>
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    onUpdateDevice({
                      ...device,
                      firewallRules: device.firewallRules.filter((r) => r.id !== rule.id),
                    })
                  }
                  aria-label="Remove firewall rule"
                  className="rounded p-1 text-[var(--text-muted)] hover:bg-rose-500/10 hover:text-rose-600 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
};
