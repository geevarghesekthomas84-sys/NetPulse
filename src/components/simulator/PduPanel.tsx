import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight, CheckCircle2, Mail, RotateCw, Send, XCircle } from 'lucide-react';
import type { PduKind, PduRecord } from '../../engine/simulator';
import type { CapturedPacket, SimDevice } from '../../engine/types';

interface PduPanelProps {
  devices: SimDevice[];
  pdus: PduRecord[];
  /** Every packet captured so far (not just the ones revealed by step mode). */
  packets: CapturedPacket[];
  onSend: (srcId: string, dstId: string, kind: PduKind) => void;
  onSelectEvent: (packet: CapturedPacket) => void;
  onInspect: (packetId: string) => void;
  selectedPacketId: string | null;
  /** Source chosen on the canvas while "Add PDU" mode is on. */
  pendingSourceId?: string | null;
  initialKind?: PduKind;
  onKindChange?: (kind: PduKind) => void;
}

const field =
  'h-8 min-w-0 rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)] px-2 text-xs text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:outline-none';

/** Packet-Tracer-style "PDU list" (scenario) and "Event list" (what happened to the selected PDU). */
export const PduPanel: React.FC<PduPanelProps> = ({
  devices,
  pdus,
  packets,
  onSend,
  onSelectEvent,
  onInspect,
  selectedPacketId,
  pendingSourceId,
  initialKind = 'ICMP',
  onKindChange,
}) => {
  const { t } = useTranslation();
  const [src, setSrc] = useState('');
  const [dst, setDst] = useState('');
  const [kind, setKind] = useState<PduKind>(initialKind);
  const [picked, setPicked] = useState<number | null>(null);

  const nameOf = useMemo(() => new Map(devices.map((d) => [d.id, d.name])), [devices]);
  const effSrc = devices.some((d) => d.id === src) ? src : pendingSourceId && devices.some((d) => d.id === pendingSourceId) ? pendingSourceId : devices[0]?.id ?? '';
  const effDst = devices.some((d) => d.id === dst) && dst !== effSrc ? dst : devices.find((d) => d.id !== effSrc)?.id ?? '';

  const active = pdus.find((p) => p.id === picked) ?? pdus[pdus.length - 1] ?? null;
  const events = useMemo(
    () => (active && active.firstPacketNo > 0 ? packets.filter((p) => p.no >= active.firstPacketNo && p.no <= active.lastPacketNo) : []),
    [active, packets]
  );

  const kinds: PduKind[] = ['ICMP', 'TCP', 'UDP'];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Create a PDU */}
      <div className="flex shrink-0 flex-wrap items-end gap-2 border-b border-[var(--border-hairline)] bg-[var(--bg-surface)] px-3 py-2">
        <label className="space-y-0.5">
          <span className="block text-[11px] font-semibold text-[var(--text-muted)]">{t('pdu.source')}</span>
          <select aria-label={t('pdu.source')} value={effSrc} onChange={(e) => setSrc(e.target.value)} className={`${field} w-36`}>
            {devices.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>
        <ArrowRight className="mb-2 h-4 w-4 shrink-0 text-[var(--text-muted)] rtl:rotate-180" aria-hidden="true" />
        <label className="space-y-0.5">
          <span className="block text-[11px] font-semibold text-[var(--text-muted)]">{t('pdu.destination')}</span>
          <select aria-label={t('pdu.destination')} value={effDst} onChange={(e) => setDst(e.target.value)} className={`${field} w-36`}>
            {devices
              .filter((d) => d.id !== effSrc)
              .map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
          </select>
        </label>
        <div role="group" aria-label={t('pdu.type')} className="inline-flex rounded-lg border border-[var(--border-strong)] p-0.5">
          {kinds.map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={kind === k}
              onClick={() => {
                setKind(k);
                onKindChange?.(k);
              }}
              className={`rounded-md px-2.5 py-1 text-xs font-semibold ${kind === k ? 'bg-[var(--accent-primary-soft)] text-[var(--accent-primary)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
            >
              {k}
            </button>
          ))}
        </div>
        <button
          type="button"
          disabled={!effSrc || !effDst}
          onClick={() => {
            setPicked(null);
            onSend(effSrc, effDst, kind);
          }}
          className="flex h-8 items-center gap-1.5 rounded-lg bg-[var(--accent-cta)] px-3 text-xs font-semibold text-[var(--on-accent)] hover:bg-[var(--accent-cta-hover)] disabled:opacity-40"
        >
          <Send className="h-3.5 w-3.5" />
          {t('pdu.send')}
        </button>
        <p className="ms-auto hidden text-xs text-[var(--text-muted)] xl:block">{t('pdu.canvasHint')}</p>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[minmax(18rem,26rem)_minmax(0,1fr)]">
        {/* PDU list */}
        <div className="min-h-0 overflow-y-auto border-b border-[var(--border-hairline)] lg:border-b-0 lg:border-e">
          <div className="sticky top-0 border-b border-[var(--border-hairline)] bg-[var(--bg-inset)] px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-[var(--text-muted)]">
            {t('pdu.list')} ({pdus.length})
          </div>
          {pdus.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
              <Mail className="h-6 w-6 text-[var(--text-muted)]" aria-hidden="true" />
              <p className="max-w-[18rem] text-xs text-[var(--text-secondary)]">{t('pdu.empty')}</p>
            </div>
          ) : (
            <ul>
              {[...pdus].reverse().map((p) => {
                const on = active?.id === p.id;
                return (
                  <li key={p.id} className={`border-b border-[var(--border-hairline)] ${on ? 'bg-[var(--accent-primary-soft)]' : ''}`}>
                    <div className="flex items-center gap-2 px-3 py-2">
                      <button type="button" onClick={() => setPicked(p.id)} aria-pressed={on} className="flex min-w-0 flex-1 items-start gap-2 text-start">
                        {p.status === 'Successful' ? (
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--tone-success)]" aria-label={t('pdu.successful')} />
                        ) : (
                          <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--tone-danger)]" aria-label={t('pdu.failed')} />
                        )}
                        <span className="min-w-0">
                          <span className="block truncate text-xs font-semibold text-[var(--text-primary)]">
                            #{p.id} {p.srcName} → {p.dstName}
                          </span>
                          <span className="block truncate font-mono text-[11px] text-[var(--text-muted)]">
                            {p.kind} · {(p.endMs - p.startMs).toFixed(1)} ms
                          </span>
                          {p.reason && <span className="block text-[11px] text-[var(--tone-danger)]">{p.reason}</span>}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setPicked(null);
                          onSend(p.srcId, p.dstId, p.kind);
                        }}
                        title={t('pdu.fireAgain')}
                        aria-label={t('pdu.fireAgain')}
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[var(--text-secondary)] hover:bg-[var(--bg-inset)] hover:text-[var(--text-primary)]"
                      >
                        <RotateCw className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Event list for the selected PDU */}
        <div className="min-h-0 overflow-y-auto">
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--border-hairline)] bg-[var(--bg-inset)] px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-[var(--text-muted)]">
            <span>
              {t('pdu.events')} {active ? `· PDU #${active.id}` : ''}
            </span>
            {active && (
              <span className={active.status === 'Successful' ? 'text-[var(--tone-success)]' : 'text-[var(--tone-danger)]'}>
                {active.status === 'Successful' ? t('pdu.successful') : t('pdu.failed')}
              </span>
            )}
          </div>
          {events.length === 0 ? (
            <p className="px-4 py-8 text-center text-xs text-[var(--text-muted)]">{active ? t('pdu.noEvents') : t('pdu.pickOne')}</p>
          ) : (
            <table className="w-full text-xs">
              <thead className="text-start text-[11px] text-[var(--text-muted)]">
                <tr className="border-b border-[var(--border-hairline)]">
                  <th className="px-3 py-1.5 text-start font-semibold">{t('pdu.time')}</th>
                  <th className="px-2 py-1.5 text-start font-semibold">{t('pdu.lastDevice')}</th>
                  <th className="px-2 py-1.5 text-start font-semibold">{t('pdu.atDevice')}</th>
                  <th className="px-2 py-1.5 text-start font-semibold">{t('pdu.protocol')}</th>
                  <th className="px-2 py-1.5 text-start font-semibold">{t('pdu.info')}</th>
                </tr>
              </thead>
              <tbody>
                {events.map((p) => {
                  const on = p.id === selectedPacketId;
                  return (
                    <tr
                      key={p.id}
                      onClick={() => onSelectEvent(p)}
                      onDoubleClick={() => onInspect(p.id)}
                      className={`cursor-pointer border-b border-[var(--border-hairline)] ${on ? 'bg-[var(--accent-primary-soft)]' : 'hover:bg-[var(--bg-inset)]'}`}
                    >
                      <td className="whitespace-nowrap px-3 py-1.5 font-mono tabular-nums text-[var(--text-secondary)]">{p.timestampMs.toFixed(1)}</td>
                      <td className="px-2 py-1.5 text-[var(--text-primary)]">{nameOf.get(p.fromDeviceId) ?? p.fromDeviceId}</td>
                      <td className="px-2 py-1.5 text-[var(--text-primary)]">{nameOf.get(p.toDeviceId) ?? p.toDeviceId}</td>
                      <td className="px-2 py-1.5">
                        <span className={`rounded px-1.5 py-0.5 font-mono text-[11px] font-semibold ${p.dropped ? 'bg-[var(--tone-danger)]/15 text-[var(--tone-danger)]' : 'bg-[var(--bg-inset)] text-[var(--text-secondary)]'}`}>
                          {p.protocol}
                        </span>
                      </td>
                      <td className="max-w-[24rem] truncate px-2 py-1.5 text-[var(--text-secondary)]" title={p.info}>
                        {p.info}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};
