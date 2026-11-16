import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight, X } from 'lucide-react';
import { COMPARE_PAIRS, getProtocolById } from '../../protocols';
import { useAppStore } from '../../store/useAppStore';
import { PACKET_COLORS } from './colors';

export const CompareView: React.FC = () => {
  const { t } = useTranslation();
  const { comparePairId, setComparePairId, setCompareMode, selectProtocol } = useAppStore();

  const pair = useMemo(
    () => COMPARE_PAIRS.find((p) => p.id === comparePairId) ?? COMPARE_PAIRS[0],
    [comparePairId]
  );

  const leftProto = getProtocolById(pair.leftId);
  const rightProto = getProtocolById(pair.rightId);
  const leftScenario = useMemo(() => leftProto.scenario({}), [leftProto]);
  const rightScenario = useMemo(() => rightProto.scenario({}), [rightProto]);

  return (
    <section
      aria-label={t('explore.compareHeader')}
      className="rounded-xl border border-[var(--accent-primary)]/40 bg-[var(--bg-surface)] p-4 sm:p-5 space-y-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-bold text-[var(--text-primary)]">
            {t('explore.compareHeader')}
          </h2>
          <p className="text-xs text-[var(--text-muted)]">
            {t('explore.keyDifferences')}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Select comparison pair"
            value={pair.id}
            onChange={(e) => setComparePairId(e.target.value)}
            className="h-9 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-inset)] px-3 text-xs font-medium text-[var(--text-primary)]"
          >
            {COMPARE_PAIRS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setCompareMode(false)}
            aria-label={t('common.close')}
            className="flex h-9 items-center gap-1 rounded-lg border border-[var(--border-hairline)] px-3 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] whitespace-nowrap shrink-0"
          >
            <X className="w-3.5 h-3.5" />
            <span>{t('common.close')}</span>
          </button>
        </div>
      </div>

      {/* Highlights Matrix */}
      <div className="overflow-x-auto rounded-lg border border-[var(--border-hairline)]">
        <table className="w-full text-start text-xs border-collapse">
          <thead className="bg-[var(--bg-inset)] text-[11px] uppercase tracking-wider text-[var(--text-muted)]">
            <tr>
              <th className="px-3 py-2 text-start">Aspect</th>
              <th className="px-3 py-2 text-start text-[var(--accent-primary)]">{leftProto.name}</th>
              <th className="px-3 py-2 text-start text-[var(--accent-teal)]">{rightProto.name}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-hairline)]">
            {pair.highlights.map((row) => (
              <tr key={row.aspect}>
                <td className="px-3 py-2 font-medium text-[var(--text-primary)]">{row.aspect}</td>
                <td className="px-3 py-2 font-mono text-[var(--text-secondary)]">{row.left}</td>
                <td className="px-3 py-2 font-mono text-[var(--text-secondary)]">{row.right}</td>
              </tr>
            ))}
            <tr>
              <td className="px-3 py-2 font-medium text-[var(--text-primary)]">Simulated Frames</td>
              <td className="px-3 py-2 font-mono text-[var(--accent-primary)]">{leftScenario.packets.length} packets</td>
              <td className="px-3 py-2 font-mono text-[var(--accent-teal)]">{rightScenario.packets.length} packets</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Two Packet Sequence Columns */}
      <div className="grid gap-4 md:grid-cols-2">
        {[
          { proto: leftProto, scenario: leftScenario, accent: 'border-[var(--accent-primary)]/40' },
          { proto: rightProto, scenario: rightScenario, accent: 'border-[var(--accent-teal)]/40' },
        ].map(({ proto, scenario, accent }) => (
          <div key={proto.id} className={`rounded-lg border ${accent} bg-[var(--bg-inset)] p-3 space-y-2`}>
            <div className="flex items-center justify-between">
              <span className="font-display font-bold text-sm text-[var(--text-primary)]">
                {proto.name} ({scenario.packets.length} frames)
              </span>
              <button
                type="button"
                onClick={() => {
                  setCompareMode(false);
                  selectProtocol(proto.id, 0);
                }}
                className="inline-flex items-center gap-1 text-xs font-mono text-[var(--accent-primary)] hover:underline"
              >
                <span>{t('common.open')}</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
            <div className="max-h-56 overflow-y-auto space-y-1 font-mono text-[11px]">
              {scenario.packets.map((pkt) => {
                const c = PACKET_COLORS[pkt.colorCategory]?.textClass || 'text-[var(--accent-primary)]';
                return (
                  <div
                    key={pkt.id}
                    className="flex items-center justify-between gap-2 rounded border border-[var(--border-hairline)]/60 bg-[var(--bg-surface)] px-2 py-1"
                  >
                    <span className="truncate">
                      <span className={`font-bold ${c}`}>{pkt.protocol}</span> · {pkt.info}
                    </span>
                    <span className="text-[var(--text-muted)] shrink-0">{pkt.sizeBytes}B</span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
