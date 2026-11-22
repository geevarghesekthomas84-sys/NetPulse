import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Cable, Monitor, Plus, Power, Shield, Trash2, Unlink } from 'lucide-react';
import { intToIp, ipToInt } from '../../lib/ipUtils';
import type { FirewallRule, LinkMedium, SimDevice, SimLink } from '../../engine/types';
import { tc } from '../../i18n/content';

interface PropertiesPanelProps {
  device: SimDevice | null;
  link: SimLink | null;
  devices: SimDevice[];
  links: SimLink[];
  onUpdateDevice: (updated: SimDevice) => void;
  onUpdateLink: (updated: SimLink) => void;
  onDeleteLink: (linkId: string) => void;
  onAddDevicePort: (deviceId: string) => void;
  /** Opens the PC-style Desktop (IP configuration + command prompt) for an end device. */
  onOpenDesktop?: (deviceId: string) => void;
}

export const PropertiesPanel: React.FC<PropertiesPanelProps> = ({
  device,
  link,
  devices,
  links,
  onUpdateDevice,
  onUpdateLink,
  onDeleteLink,
  onAddDevicePort,
  onOpenDesktop,
}) => {
  const { t } = useTranslation();
  const [newRulePort, setNewRulePort] = useState('80');
  const [newRuleAction, setNewRuleAction] = useState<'allow' | 'deny'>('deny');

  const devMap = new Map(devices.map((d) => [d.id, d]));

  if (link) {
    const srcName = devMap.get(link.sourceId)?.name ?? link.sourceId;
    const dstName = devMap.get(link.targetId)?.name ?? link.targetId;

    return (
      <aside
        aria-label={tc('Cable Properties Inspector')}
        className="hud-panel w-full lg:w-80 shrink-0 p-3.5 space-y-3 text-xs overflow-y-auto"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <Cable className="w-4 h-4 text-[var(--accent-primary)]" />
            <h3 className="font-display font-bold text-sm text-[var(--text-primary)]">{tc('Cable Properties')}</h3>
          </div>
          <button
            type="button"
            onClick={() => onUpdateLink({ ...link, up: !link.up })}
            className={`rounded-md px-2.5 py-1 font-mono text-xs font-semibold ${
              link.up ? 'bg-[var(--tone-success)]/15 text-[var(--tone-success)]' : 'bg-[var(--tone-danger)]/15 text-[var(--tone-danger)]'
            }`}
          >
            {link.up ? 'LINK UP' : 'LINK DOWN'}
          </button>
        </div>

        <div className="rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-inset)] px-2.5 py-2 font-mono text-xs">
          <div className="text-[11px] text-[var(--text-muted)]">{tc('PATCH CONNECTION')}</div>
          <div className="mt-0.5 font-semibold text-[var(--text-primary)]">
            {srcName}:{link.sourceIface} ↔ {dstName}:{link.targetIface}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <label className="space-y-1">
            <span className="text-xs text-[var(--text-muted)]">{tc('Medium')}</span>
            <select
              value={link.medium}
              onChange={(e) => onUpdateLink({ ...link, medium: e.target.value as LinkMedium })}
              className="w-full rounded border border-[var(--border-hairline)] bg-[var(--bg-inset)] px-2 py-1 font-mono"
            >
              <option value="ethernet">{tc('Ethernet')}</option>
              <option value="fiber">{tc('Fiber')}</option>
              <option value="serial">{tc('Serial')}</option>
              <option value="wireless">{tc('Wireless')}</option>
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-xs text-[var(--text-muted)]">{tc('Bandwidth (Mbps)')}</span>
            <input
              type="number"
              min={1}
              max={10000}
              value={link.bandwidthMbps}
              onChange={(e) => onUpdateLink({ ...link, bandwidthMbps: Math.max(1, Number(e.target.value)) })}
              className="w-full rounded border border-[var(--border-hairline)] bg-[var(--bg-inset)] px-2 py-1 font-mono"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-[var(--text-muted)]">{tc('Delay (ms)')}</span>
            <input
              type="number"
              min={0}
              max={2000}
              value={link.delayMs}
              onChange={(e) => onUpdateLink({ ...link, delayMs: Math.max(0, Number(e.target.value)) })}
              className="w-full rounded border border-[var(--border-hairline)] bg-[var(--bg-inset)] px-2 py-1 font-mono"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-[var(--text-muted)]">{tc('Jitter (ms)')}</span>
            <input
              type="number"
              min={0}
              max={500}
              value={link.jitterMs}
              onChange={(e) => onUpdateLink({ ...link, jitterMs: Math.max(0, Number(e.target.value)) })}
              className="w-full rounded border border-[var(--border-hairline)] bg-[var(--bg-inset)] px-2 py-1 font-mono"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-[var(--text-muted)]">{tc('Packet Loss (%)')}</span>
            <input
              type="number"
              min={0}
              max={100}
              value={link.lossPercent}
              onChange={(e) => onUpdateLink({ ...link, lossPercent: Math.min(100, Math.max(0, Number(e.target.value))) })}
              className="w-full rounded border border-[var(--border-hairline)] bg-[var(--bg-inset)] px-2 py-1 font-mono"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-[var(--text-muted)]">{tc('MTU (Bytes)')}</span>
            <input
              type="number"
              min={68}
              max={9000}
              value={link.mtu}
              onChange={(e) => onUpdateLink({ ...link, mtu: Math.max(68, Number(e.target.value)) })}
              className="w-full rounded border border-[var(--border-hairline)] bg-[var(--bg-inset)] px-2 py-1 font-mono"
            />
          </label>
        </div>

        <button
          type="button"
          onClick={() => onDeleteLink(link.id)}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-[var(--tone-danger)]/45 bg-[var(--tone-danger)]/10 py-1.5 text-xs font-semibold text-[var(--tone-danger)] hover:bg-[var(--tone-danger)]/20"
        >
          <Unlink className="w-3.5 h-3.5" />
          <span>{tc('Disconnect Cable')}</span>
        </button>
      </aside>
    );
  }

  if (!device) {
    return (
      <aside
        aria-label={tc('Properties Inspector')}
        className="hud-panel w-full lg:w-80 shrink-0 p-4 text-xs text-[var(--text-muted)]"
      >
        {tc('Select a device or cable on the canvas to configure front-panel ports, IP addresses, routing, firewall ACLs, or link loss/MTU.')}
      </aside>
    );
  }

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

  const toggles: { key: 'natEnabled' | 'statefulFirewall' | 'synCookiesEnabled'; label: string; hint: string }[] = [
    { key: 'natEnabled', label: tc('NAT / PAT'), hint: t('sim.hintNat') },
    { key: 'statefulFirewall', label: tc('Stateful FW'), hint: t('sim.hintStateful') },
    { key: 'synCookiesEnabled', label: tc('SYN Cookies'), hint: t('sim.hintSyn') },
  ];

  return (
    <aside
      aria-label={tc('Device Properties Inspector')}
      className="hud-panel w-full lg:w-80 shrink-0 overflow-y-auto text-sm"
    >
      {/* Header: name + power */}
      <div className="flex items-start gap-3 p-4">
        <div className="min-w-0 flex-1">
          <input
            type="text"
            aria-label={tc('Device Hostname')}
            value={device.name}
            onChange={(e) => onUpdateDevice({ ...device, name: e.target.value })}
            className="w-full rounded-lg border border-transparent bg-transparent px-2 py-1 -mx-2 font-display text-lg font-bold text-[var(--text-primary)] hover:border-[var(--border-hairline)] focus:border-[var(--accent-primary)] focus:bg-[var(--bg-inset)] focus:outline-none"
          />
          <div className="text-xs text-[var(--text-muted)]">
            <span className="capitalize">{device.role.replace('_', ' ').toLowerCase()}</span> · {t('sim.links', { count: deviceLinks.length })}
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={device.poweredOn}
          onClick={() => onUpdateDevice({ ...device, poweredOn: !device.poweredOn })}
          title={tc('Toggle Device Power')}
          className={`flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-xs font-semibold ${
            device.poweredOn
              ? 'bg-[var(--tone-success)]/15 text-[var(--tone-success)]'
              : 'bg-[var(--tone-danger)]/15 text-[var(--tone-danger)]'
          }`}
        >
          <Power className="w-4 h-4" />
          {device.poweredOn ? t('sim.on') : t('sim.off')}
        </button>
      </div>

      {onOpenDesktop && !['router', 'switch', 'firewall', 'nat_gateway', 'vpn_gateway', 'hub', 'access_point', 'cloud'].includes(device.role) && (
        <div className="px-4 pb-4">
          <button
            type="button"
            onClick={() => onOpenDesktop(device.id)}
            className="flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-[var(--accent-primary)] bg-[var(--accent-primary-soft)] text-sm font-semibold text-[var(--accent-primary)] hover:bg-[var(--accent-primary)] hover:text-[var(--on-accent)]"
          >
            <Monitor className="h-4 w-4" />
            {t('desktop.open')}
          </button>
        </div>
      )}

      {/* Ports */}
      <Section title={tc('Physical Port Bay')} action={
        <button
          type="button"
          onClick={() => onAddDevicePort(device.id)}
          className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs font-semibold text-[var(--accent-primary)] hover:bg-[var(--accent-primary-soft)]"
        >
          <Plus className="w-3.5 h-3.5" /> {t('sim.addPort')}
        </button>
      }>
        <div className="flex flex-wrap gap-2">
          {device.interfaces.map((iface) => {
            const attached = deviceLinks.find(
              (l) =>
                (l.sourceId === device.id && l.sourceIface === iface.name) ||
                (l.targetId === device.id && l.targetIface === iface.name)
            );
            const ledColor = !attached ? 'bg-[var(--border-strong)]' : attached.up ? 'bg-[var(--tone-success)]' : 'bg-[var(--tone-danger)]';
            return (
              <div
                key={iface.id}
                className="flex items-center gap-2 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-inset)] px-2.5 py-1.5 font-mono text-xs"
              >
                <span className={`h-2.5 w-2.5 rounded-full ${ledColor}`} />
                <span className="font-semibold text-[var(--text-primary)]">{iface.name}</span>
              </div>
            );
          })}
        </div>
      </Section>

      {/* Interfaces */}
      <Section title={`${t('sim.interfaces')} (${device.interfaces.length})`}>
        <div className="space-y-3">
          {device.interfaces.map((iface, idx) => (
            <div key={iface.id} className="space-y-3 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-inset)]/50 p-3">
              <div className="flex items-center justify-between gap-2 font-mono text-xs">
                <span className="font-bold text-[var(--accent-primary)]">{iface.name}</span>
                <span className="truncate text-[var(--text-muted)]">{iface.mac}</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label={tc('IP Address')}>
                  <input type="text" inputMode="decimal" value={iface.ip} onChange={(e) => updateIface(idx, { ip: e.target.value })} className={FIELD} />
                </Field>
                <Field label={tc('Subnet Mask')}>
                  <input type="text" inputMode="decimal" value={iface.mask} onChange={(e) => updateIface(idx, { mask: e.target.value })} className={FIELD} />
                </Field>
                <Field label={tc('Gateway')}>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={iface.gateway ?? ''}
                    onChange={(e) => updateIface(idx, { gateway: e.target.value })}
                    placeholder={t('sim.optional')}
                    className={FIELD}
                  />
                </Field>
                <Field label={tc('VLAN ID')}>
                  <input
                    type="number"
                    min={1}
                    max={4094}
                    value={iface.vlan ?? 1}
                    onChange={(e) => updateIface(idx, { vlan: Number(e.target.value) || 1 })}
                    className={FIELD}
                  />
                </Field>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* Host settings */}
      <Section title={t('sim.hostSettings')}>
        <div className="space-y-3">
          <Field label={tc('DNS Server')}>
            <input
              type="text"
              inputMode="decimal"
              value={device.dnsServer ?? ''}
              onChange={(e) => onUpdateDevice({ ...device, dnsServer: e.target.value })}
              placeholder={t('sim.optional')}
              className={FIELD}
            />
          </Field>
          <Field label={tc('Routing Protocol')}>
            <select
              value={device.routingProtocol ?? 'none'}
              onChange={(e) => onUpdateDevice({ ...device, routingProtocol: e.target.value as SimDevice['routingProtocol'] })}
              className={FIELD}
            >
              <option value="none">{tc('Static / Connected')}</option>
              <option value="rip">RIP</option>
              <option value="ospf">OSPF</option>
              <option value="bgp">BGP</option>
            </select>
          </Field>
        </div>
        <ul className="mt-3 divide-y divide-[var(--border-hairline)] rounded-xl border border-[var(--border-hairline)]">
          {toggles.map((tg) => (
            <li key={tg.key}>
              <label className="flex cursor-pointer items-start gap-3 px-3 py-2.5">
                <input
                  type="checkbox"
                  checked={Boolean(device[tg.key])}
                  onChange={(e) => onUpdateDevice({ ...device, [tg.key]: e.target.checked })}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--accent-primary)]"
                />
                <span className="min-w-0">
                  <span className="block font-medium text-[var(--text-primary)]">{tg.label}</span>
                  <span className="block text-xs text-[var(--text-muted)]">{tg.hint}</span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      </Section>

      {['dhcp_server', 'router', 'nat_gateway', 'firewall'].includes(device.role) && (
        <Section title={t('dhcp.server')}>
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--border-hairline)] px-3 py-2.5">
            <input
              type="checkbox"
              checked={Boolean(device.services.dhcp?.enabled)}
              onChange={(e) => {
                const first = device.interfaces.find((i) => i.ip && i.mask);
                const base = first ? ((ipToInt(first.ip) & ipToInt(first.mask)) >>> 0) : 0;
                const prev = device.services.dhcp;
                onUpdateDevice({
                  ...device,
                  services: {
                    ...device.services,
                    dhcp: {
                      enabled: e.target.checked,
                      poolStart: prev?.poolStart ?? (first ? intToIp(base + 100) : '192.168.1.100'),
                      poolEnd: prev?.poolEnd ?? (first ? intToIp(base + 150) : '192.168.1.150'),
                      mask: prev?.mask ?? first?.mask ?? '255.255.255.0',
                      gateway: prev?.gateway ?? first?.ip ?? '192.168.1.1',
                      dns: prev?.dns ?? device.dnsServer ?? '8.8.8.8',
                    },
                  },
                });
              }}
              className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--accent-primary)]"
            />
            <span className="min-w-0">
              <span className="block font-medium text-[var(--text-primary)]">{t('dhcp.enable')}</span>
              <span className="block text-xs text-[var(--text-muted)]">{t('dhcp.hint')}</span>
            </span>
          </label>
          {device.services.dhcp?.enabled && (
            <div className="mt-3 grid grid-cols-2 gap-3">
              {(
                [
                  ['poolStart', t('dhcp.poolStart')],
                  ['poolEnd', t('dhcp.poolEnd')],
                  ['mask', t('desktop.mask')],
                  ['gateway', t('desktop.gateway')],
                  ['dns', t('desktop.dns')],
                ] as const
              ).map(([key, label]) => (
                <Field key={key} label={label} className={key === 'dns' ? 'col-span-2' : ''}>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={device.services.dhcp![key]}
                    onChange={(e) => onUpdateDevice({ ...device, services: { ...device.services, dhcp: { ...device.services.dhcp!, [key]: e.target.value } } })}
                    className={FIELD}
                  />
                </Field>
              ))}
            </div>
          )}
        </Section>
      )}

      {/* Firewall */}
      <Section
        title={`${t('sim.firewall')} (${device.firewallRules.length})`}
        icon={<Shield className="w-4 h-4 text-[var(--tone-danger)]" />}
      >
        <div className="flex items-end gap-2">
          <Field label={t('sim.action')} className="w-28 shrink-0">
            <select value={newRuleAction} onChange={(e) => setNewRuleAction(e.target.value as 'allow' | 'deny')} className={FIELD}>
              <option value="deny">{tc('DENY')}</option>
              <option value="allow">{tc('ALLOW')}</option>
            </select>
          </Field>
          <Field label={t('sim.port')} className="min-w-0 flex-1">
            <input
              type="text"
              value={newRulePort}
              onChange={(e) => setNewRulePort(e.target.value)}
              placeholder={tc('Port (80, 443, any)')}
              className={FIELD}
            />
          </Field>
        </div>
        <button
          type="button"
          onClick={addFirewallRule}
          className="mt-3 flex h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-[var(--accent-cta)] text-sm font-semibold text-[var(--on-accent)] transition-colors hover:bg-[var(--accent-cta-hover)]"
        >
          <Plus className="w-4 h-4" /> {t('sim.addRule')}
        </button>

        {device.firewallRules.length === 0 ? (
          <p className="mt-3 text-xs text-[var(--text-muted)]">{t('sim.noRules')}</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {device.firewallRules.map((rule) => (
              <li
                key={rule.id}
                className="flex items-center justify-between rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-inset)]/50 px-3 py-2 font-mono text-xs"
              >
                <span className={`font-semibold ${rule.action === 'deny' ? 'text-[var(--tone-danger)]' : 'text-[var(--tone-success)]'}`}>
                  {rule.action.toUpperCase()} {rule.protocol} {rule.dstPort}
                </span>
                <button
                  type="button"
                  onClick={() => onUpdateDevice({ ...device, firewallRules: device.firewallRules.filter((r) => r.id !== rule.id) })}
                  aria-label={tc('Remove firewall rule')}
                  className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--text-muted)] hover:bg-[var(--tone-danger)]/10 hover:text-[var(--tone-danger)]"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </aside>
  );
};

/** One input style for every field, so the panel reads as a single system. */
const FIELD =
  'h-9 w-full rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)] px-2.5 font-mono text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] placeholder:opacity-70 focus:border-[var(--accent-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/30';

const Field: React.FC<{ label: string; className?: string; children: React.ReactNode }> = ({ label, className = '', children }) => (
  <label className={`block space-y-1 ${className}`}>
    <span className="block text-xs font-medium text-[var(--text-secondary)]">{label}</span>
    {children}
  </label>
);

const Section: React.FC<{ title: string; icon?: React.ReactNode; action?: React.ReactNode; children: React.ReactNode }> = ({
  title,
  icon,
  action,
  children,
}) => (
  <section className="border-t border-[var(--border-hairline)] px-4 py-4">
    <div className="mb-3 flex min-h-7 items-center justify-between gap-2">
      <h4 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-[var(--text-secondary)]">
        {icon}
        {title}
      </h4>
      {action}
    </div>
    {children}
  </section>
);
