import React from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Check } from 'lucide-react';
import { getProtocolById } from '../../protocols';
import { GUIDED_PATH } from '../../lib/guidedPath';
import { useAppStore } from '../../store/useAppStore';

/** "Start here" route with a progress bar; replaces the plain starter chips. */
export const GuidedPath: React.FC = () => {
  const { t } = useTranslation();
  const { finishedProtocols, activeProtocolId, selectProtocol } = useAppStore();
  const done = GUIDED_PATH.filter((id) => finishedProtocols.includes(id)).length;
  const next = GUIDED_PATH.find((id) => !finishedProtocols.includes(id));
  const pct = Math.round((done / GUIDED_PATH.length) * 100);

  return (
    <div className="mt-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-semibold text-[var(--text-primary)]">{t('welcome.pathTitle')}</span>
        <span className="text-xs text-[var(--text-secondary)]">
          {t('welcome.pathProgress', { done, total: GUIDED_PATH.length })}
        </span>
      </div>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        className="mt-1.5 h-2 overflow-hidden rounded-full bg-[var(--bg-surface)]"
      >
        <div className="h-full rounded-full bg-[var(--accent-cta)] transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>
      <ol className="mt-2.5 flex flex-wrap items-center gap-2">
        {GUIDED_PATH.map((id, i) => {
          const p = getProtocolById(id);
          const finished = finishedProtocols.includes(id);
          const active = activeProtocolId === id;
          const isNext = id === next;
          return (
            <li key={id}>
              <button
                type="button"
                onClick={() => selectProtocol(id, 0)}
                aria-current={active ? 'step' : undefined}
                className={`flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-semibold transition-colors ${
                  active
                    ? 'border-[var(--accent-cta)] bg-[var(--accent-cta)] text-[var(--on-accent)]'
                    : 'border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[var(--text-primary)] hover:border-[var(--accent-primary)]'
                }`}
              >
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold ${
                    finished
                      ? 'bg-[var(--tone-success)] text-[var(--bg-surface)]'
                      : active
                      ? 'bg-[var(--on-accent)] text-[var(--accent-cta)]'
                      : 'bg-[var(--bg-inset)] text-[var(--text-muted)]'
                  }`}
                >
                  {finished ? <Check className="w-3 h-3" /> : i + 1}
                </span>
                {p.name}
                {isNext && !active && (
                  <span className="rounded-full bg-[var(--accent-primary-soft)] px-1.5 py-0.5 text-[11px] font-medium text-[var(--accent-primary)]">
                    {t('welcome.pathNext')}
                  </span>
                )}
              </button>
            </li>
          );
        })}
        <li aria-hidden="true" className="text-[var(--text-muted)]">
          <ArrowRight className="w-4 h-4 rtl:rotate-180" />
        </li>
      </ol>
    </div>
  );
};
