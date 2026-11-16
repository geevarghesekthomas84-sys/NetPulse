import React, { useState } from 'react';
import { Cable, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { DeviceRole, LinkMedium } from '../../engine/types';
import { IsometricDeviceIcon } from '../common/IsometricIcons';

export type PaletteCategory = 'all' | 'end' | 'network' | 'servers' | 'security';

export const PALETTE_ITEMS: Array<{
  role: DeviceRole;
  label: string;
  defaultIp: string;
  category: Exclude<PaletteCategory, 'all'>;
}> = [
  { role: 'host', label: 'Client / PC', defaultIp: '192.168.1.50', category: 'end' },
  { role: 'phone', label: 'Smartphone', defaultIp: '192.168.1.75', category: 'end' },
  { role: 'ip_camera', label: 'IP Camera', defaultIp: '192.168.1.64', category: 'end' },
  { role: 'tv_box', label: 'Smart TV / Box', defaultIp: '192.168.1.30', category: 'end' },
  { role: 'plc', label: 'Industrial PLC', defaultIp: '10.10.10.50', category: 'end' },
  { role: 'router', label: 'Router', defaultIp: '192.168.1.1', category: 'network' },
  { role: 'switch', label: 'Switch (L2)', defaultIp: '0.0.0.0', category: 'network' },
  { role: 'hub', label: 'Hub (L1)', defaultIp: '0.0.0.0', category: 'network' },
  { role: 'access_point', label: 'Wi-Fi AP', defaultIp: '192.168.1.2', category: 'network' },
  { role: 'nat_gateway', label: 'NAT Gateway', defaultIp: '192.168.1.1', category: 'network' },
  { role: 'cloud', label: 'Internet Cloud', defaultIp: '203.0.113.254', category: 'network' },
  { role: 'web_server', label: 'Web Server', defaultIp: '203.0.113.10', category: 'servers' },
  { role: 'dns_server', label: 'DNS Server', defaultIp: '8.8.8.8', category: 'servers' },
  { role: 'dhcp_server', label: 'DHCP Server', defaultIp: '192.168.1.3', category: 'servers' },
  { role: 'mail_server', label: 'Mail Server', defaultIp: '198.51.100.25', category: 'servers' },
  { role: 'file_server', label: 'File Server', defaultIp: '192.168.1.20', category: 'servers' },
  { role: 'firewall', label: 'Firewall', defaultIp: '192.168.1.254', category: 'security' },
  { role: 'proxy', label: 'Forward Proxy', defaultIp: '192.0.2.80', category: 'security' },
  { role: 'reverse_proxy', label: 'Reverse Proxy', defaultIp: '203.0.113.5', category: 'security' },
  { role: 'vpn_gateway', label: 'VPN Gateway', defaultIp: '198.51.100.1', category: 'security' },
];

const MEDIUM_OPTIONS: Array<{ id: LinkMedium; label: string; spec: string; color: string }> = [
  { id: 'ethernet', label: 'Copper Eth', spec: '100 Mbps', color: '#10b981' },
  { id: 'fiber', label: 'Fiber Optic', spec: '1000 Mbps', color: '#0891b2' },
  { id: 'serial', label: 'Serial WAN', spec: '10 Mbps', color: '#d97706' },
  { id: 'wireless', label: 'Wireless RF', spec: '300 Mbps', color: '#6366f1' },
];

interface DevicePaletteProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  connectMode: boolean;
  linkMedium: LinkMedium;
  onToggleConnectMode: () => void;
  onChangeMedium: (m: LinkMedium) => void;
  onAddDevice: (role: DeviceRole) => void;
}

export const DevicePalette: React.FC<DevicePaletteProps> = ({
  collapsed,
  onToggleCollapse,
  connectMode,
  linkMedium,
  onToggleConnectMode,
  onChangeMedium,
  onAddDevice,
}) => {
  const { t } = useTranslation();
  const [cat, setCat] = useState<PaletteCategory>('all');
  const visibleItems = cat === 'all' ? PALETTE_ITEMS : PALETTE_ITEMS.filter((i) => i.category === cat);

  if (collapsed) {
    return (
      <aside
        aria-label="Collapsed Hardware Palette"
        className="hidden lg:flex w-12 shrink-0 flex-col items-center border-e border-[var(--border-hairline)] bg-[var(--bg-surface)] py-2 gap-2"
      >
        <button
          type="button"
          onClick={onToggleCollapse}
          title="Expand Hardware & Cabling Rail"
          aria-label="Expand Hardware & Cabling Rail"
          className="flex h-8 w-8 items-center justify-center rounded-md border border-[var(--border-hairline)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--accent-primary)]/60"
        >
          <ChevronRight className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={onToggleConnectMode}
          title={t('simulator.connectCable')}
          aria-label="Toggle Connect Cable"
          aria-pressed={connectMode}
          className={`flex h-8 w-8 items-center justify-center rounded-md border transition-colors ${
            connectMode
              ? 'border-[var(--accent-cta)] bg-[var(--accent-cta)] text-white'
              : 'border-[var(--border-hairline)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          <Cable className="w-4 h-4" />
        </button>

        <span className="h-px w-6 bg-[var(--border-hairline)]" />

        <div className="flex flex-col gap-1.5 overflow-y-auto px-1">
          {PALETTE_ITEMS.slice(0, 8).map((item) => (
            <button
              key={item.role}
              type="button"
              draggable
              onDragStart={(e) => e.dataTransfer.setData('application/gg-device-role', item.role)}
              onClick={() => onAddDevice(item.role)}
              title={`Add ${item.label}`}
              className="flex h-9 w-9 items-center justify-center rounded-md border border-[var(--border-hairline)] bg-[var(--bg-inset)]/60 hover:border-[var(--accent-primary)]/60"
            >
              <IsometricDeviceIcon role={item.role} size={24} />
            </button>
          ))}
        </div>
      </aside>
    );
  }

  return (
    <aside
      aria-label="Network Hardware & Cabling Rail"
      className="flex lg:w-[276px] shrink-0 flex-col border-b lg:border-b-0 lg:border-e border-[var(--border-hairline)] bg-[var(--bg-surface)] overflow-hidden"
    >
      {/* Header + Collapse */}
      <div className="flex items-center justify-between border-b border-[var(--border-hairline)] px-4 py-2.5">
        <span className="font-display text-sm font-bold tracking-tight text-[var(--text-primary)]">
          {t('simulator.palette')}
        </span>
        <button
          type="button"
          onClick={onToggleCollapse}
          title="Collapse Rail"
          aria-label="Collapse Hardware Rail"
          className="hidden lg:flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--border-hairline)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      </div>

      {/* Physical Cable Selector */}
      <div className="border-b border-[var(--border-hairline)] p-3 space-y-2.5">
        <button
          type="button"
          onClick={onToggleConnectMode}
          aria-pressed={connectMode}
          className={`flex w-full items-center justify-center gap-2 rounded-lg border px-3 py-2 text-[13px] font-semibold transition-colors whitespace-nowrap shrink-0 ${
            connectMode
              ? 'border-[var(--accent-cta)] bg-[var(--accent-cta)] text-white shadow-xs'
              : 'border-[var(--border-hairline)] bg-[var(--bg-inset)] text-[var(--text-primary)] hover:border-[var(--accent-primary)]'
          }`}
        >
          <Cable className="w-4 h-4" />
          <span>{connectMode ? t('simulator.cancelConnect') : t('simulator.connectCable')}</span>
        </button>

        <div className="grid grid-cols-2 gap-1.5">
          {MEDIUM_OPTIONS.map((med) => {
            const active = linkMedium === med.id;
            return (
              <button
                key={med.id}
                type="button"
                onClick={() => onChangeMedium(med.id)}
                aria-pressed={active}
                className={`flex flex-col items-start rounded-lg border px-2.5 py-2 text-start transition-colors ${
                  active
                    ? 'border-[var(--accent-primary)] bg-[var(--accent-primary-soft)] text-[var(--text-primary)]'
                    : 'border-[var(--border-hairline)] bg-[var(--bg-inset)]/70 text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                <span className="flex items-center gap-1.5 text-[12.5px] font-semibold">
                  <span className="h-2 w-3 rounded-xs shrink-0" style={{ backgroundColor: med.color }} />
                  <span>{med.label}</span>
                </span>
                <span className="mt-0.5 font-mono text-[11.5px] font-medium text-[var(--text-muted)] tabular-nums">
                  {med.spec}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Category Filter Tabs */}
      <div className="flex items-center gap-1 border-b border-[var(--border-hairline)] bg-[var(--bg-inset)] px-2.5 py-1.5">
        {(
          [
            { id: 'all', label: t('drawer.all') },
            { id: 'end', label: 'End' },
            { id: 'network', label: 'Net' },
            { id: 'servers', label: 'Srv' },
            { id: 'security', label: 'Sec' },
          ] as Array<{ id: PaletteCategory; label: string }>
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setCat(tab.id)}
            className={`flex-1 rounded-md py-1.5 text-xs font-semibold transition-colors ${
              cat === tab.id
                ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-xs'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Device Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-1 gap-1.5 overflow-y-auto p-2.5 flex-1 min-h-[140px]">
        {visibleItems.map((item) => (
          <button
            key={item.role}
            type="button"
            draggable
            onDragStart={(e) => e.dataTransfer.setData('application/gg-device-role', item.role)}
            onClick={() => onAddDevice(item.role)}
            className="flex min-h-[48px] items-center gap-3 rounded-xl border border-transparent hover:border-[var(--border-hairline)] bg-[var(--bg-inset)]/55 hover:bg-[var(--accent-primary-soft)] px-3 py-2 text-start transition-colors"
          >
            <IsometricDeviceIcon role={item.role} size={30} />
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-semibold text-[var(--text-primary)] truncate">{item.label}</div>
              <div className="text-xs font-mono font-medium text-[var(--text-muted)] tabular-nums">
                {item.defaultIp}
              </div>
            </div>
            <Plus className="w-4 h-4 text-[var(--text-secondary)] shrink-0" />
          </button>
        ))}
      </div>
    </aside>
  );
};
