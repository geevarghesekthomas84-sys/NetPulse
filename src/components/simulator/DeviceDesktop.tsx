import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Monitor, Network, Terminal as TerminalIcon, X } from 'lucide-react';
import type { SimDevice } from '../../engine/types';
import { isValidIpv4 } from '../../lib/ipUtils';
import { TerminalEmulator } from './TerminalEmulator';

interface DeviceDesktopProps {
  device: SimDevice;
  onClose: () => void;
  onApplyStatic: (cfg: { ip: string; mask: string; gateway: string; dns: string }) => void;
  onRequestDhcp: () => { ok: boolean; message: string };
  onRelease: () => string;
  onExecute: (deviceId: string, command: string) => string;
  getPrompt?: (deviceId: string) => string;
  onComplete?: (deviceId: string, line: string) => string | null;
}

const field =
  'h-9 w-full rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)] px-2.5 font-mono text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/30 disabled:opacity-50';

/** Packet-Tracer-style PC "Desktop": IP configuration (DHCP or static) and a command prompt. */
export const DeviceDesktop: React.FC<DeviceDesktopProps> = ({ device, onClose, onApplyStatic, onRequestDhcp, onRelease, onExecute, getPrompt, onComplete }) => {
  const { t } = useTranslation();
  const iface = device.interfaces[0];
  const [tab, setTab] = useState<'ip' | 'cmd'>('ip');
  const [mode, setMode] = useState<'dhcp' | 'static'>(device.dhcpEnabled ? 'dhcp' : 'static');
  const [ip, setIp] = useState(iface?.ip ?? '');
  const [mask, setMask] = useState(iface?.mask ?? '255.255.255.0');
  const [gateway, setGateway] = useState(iface?.gateway ?? '');
  const [dns, setDns] = useState(device.dnsServer ?? '');
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);

  // Keep the form in step with the device after DHCP or CLI changes it.
  useEffect(() => {
    setIp(iface?.ip ?? '');
    setMask(iface?.mask ?? '255.255.255.0');
    setGateway(iface?.gateway ?? '');
    setDns(device.dnsServer ?? '');
  }, [iface?.ip, iface?.mask, iface?.gateway, device.dnsServer]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const staticValid = isValidIpv4(ip) && isValidIpv4(mask) && (gateway === '' || isValidIpv4(gateway)) && (dns === '' || isValidIpv4(dns));

  const tabBtn = (id: 'ip' | 'cmd', label: string, Icon: typeof Network) => (
    <button
      type="button"
      onClick={() => setTab(id)}
      aria-pressed={tab === id}
      className={`-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-semibold ${
        tab === id ? 'border-[var(--accent-primary)] text-[var(--accent-primary)]' : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
      }`}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        role="dialog"
        aria-label={t('desktop.title', { name: device.name })}
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-[var(--border-strong)] bg-[var(--bg-surface)] shadow-2xl"
      >
        <div className="flex items-center justify-between gap-3 border-b border-[var(--border-hairline)] px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <Monitor className="h-5 w-5 shrink-0 text-[var(--accent-primary)]" />
            <h2 className="truncate font-display text-base font-bold text-[var(--text-primary)]">{device.name}</h2>
            <span className="shrink-0 rounded-full bg-[var(--bg-inset)] px-2 py-0.5 text-xs text-[var(--text-muted)]">{t('desktop.label')}</span>
          </div>
          <button type="button" onClick={onClose} aria-label={t('common.close')} className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--bg-inset)] hover:text-[var(--text-primary)]">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex border-b border-[var(--border-hairline)] px-2">
          {tabBtn('ip', t('desktop.ipConfig'), Network)}
          {tabBtn('cmd', t('desktop.commandPrompt'), TerminalIcon)}
        </div>

        {tab === 'ip' ? (
          <div className="min-h-0 space-y-4 overflow-y-auto p-4">
            <div role="radiogroup" aria-label={t('desktop.mode')} className="grid grid-cols-2 gap-2">
              {(['dhcp', 'static'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={mode === m}
                  onClick={() => setMode(m)}
                  className={`rounded-xl border px-3 py-2.5 text-start text-sm ${
                    mode === m ? 'border-[var(--accent-primary)] bg-[var(--accent-primary-soft)]' : 'border-[var(--border-hairline)] hover:border-[var(--accent-primary)]/50'
                  }`}
                >
                  <span className={`block font-semibold ${mode === m ? 'text-[var(--accent-primary)]' : 'text-[var(--text-primary)]'}`}>{t(`desktop.${m}`)}</span>
                  <span className="block text-xs text-[var(--text-muted)]">{t(`desktop.${m}Hint`)}</span>
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {(
                [
                  [t('desktop.ip'), ip, setIp, isValidIpv4(ip) || ip === ''],
                  [t('desktop.mask'), mask, setMask, isValidIpv4(mask)],
                  [t('desktop.gateway'), gateway, setGateway, gateway === '' || isValidIpv4(gateway)],
                  [t('desktop.dns'), dns, setDns, dns === '' || isValidIpv4(dns)],
                ] as [string, string, (v: string) => void, boolean][]
              ).map(([label, value, set, valid]) => (
                <label key={label} className="block space-y-1">
                  <span className="block text-xs font-medium text-[var(--text-secondary)]">{label}</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={value}
                    disabled={mode === 'dhcp'}
                    aria-invalid={!valid}
                    onChange={(e) => set(e.target.value)}
                    className={`${field} ${valid ? '' : 'border-[var(--tone-danger)]'}`}
                  />
                </label>
              ))}
            </div>

            {mode === 'static' ? (
              <button
                type="button"
                disabled={!staticValid}
                onClick={() => {
                  onApplyStatic({ ip, mask, gateway, dns });
                  setStatus({ ok: true, text: t('desktop.applied') });
                }}
                className="h-9 rounded-lg bg-[var(--accent-cta)] px-4 text-sm font-semibold text-[var(--on-accent)] hover:bg-[var(--accent-cta-hover)] disabled:opacity-40"
              >
                {t('desktop.apply')}
              </button>
            ) : (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const r = onRequestDhcp();
                    setStatus({ ok: r.ok, text: r.message });
                  }}
                  className="h-9 rounded-lg bg-[var(--accent-cta)] px-4 text-sm font-semibold text-[var(--on-accent)] hover:bg-[var(--accent-cta-hover)]"
                >
                  {t('desktop.request')}
                </button>
                <button
                  type="button"
                  onClick={() => setStatus({ ok: true, text: onRelease() })}
                  className="h-9 rounded-lg border border-[var(--border-strong)] px-4 text-sm font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                >
                  {t('desktop.release')}
                </button>
              </div>
            )}

            {status && (
              <p
                role="status"
                className={`rounded-lg border px-3 py-2 text-sm ${
                  status.ok ? 'border-[var(--tone-success)]/40 bg-[var(--tone-success)]/10 text-[var(--tone-success)]' : 'border-[var(--tone-warning)]/50 bg-[var(--tone-warning)]/10 text-[var(--tone-warning)]'
                }`}
              >
                {status.text}
              </p>
            )}
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-hidden">
            <TerminalEmulator
              devices={[device]}
              activeDeviceId={device.id}
              onSelectDevice={() => undefined}
              onExecute={onExecute}
              getPrompt={getPrompt}
              onComplete={onComplete}
            />
          </div>
        )}
      </div>
    </div>
  );
};
