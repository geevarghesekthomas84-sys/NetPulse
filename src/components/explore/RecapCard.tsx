import React from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight, PartyPopper, RotateCcw, X } from 'lucide-react';
import { tc } from '../../i18n/content';
import { GUIDED_PATH, nextSuggestion } from '../../lib/guidedPath';
import { getProtocolById } from '../../protocols';
import { useAppStore } from '../../store/useAppStore';

/** Shown over the diagram when playback has reached the end of a protocol. */
export const RecapCard: React.FC<{ protocolId: string; onReplay: () => void; onClose: () => void }> = ({
  protocolId,
  onReplay,
  onClose,
}) => {
  const { t } = useTranslation();
  const { finishedProtocols, selectProtocol } = useAppStore();
  const protocol = getProtocolById(protocolId);
  const next = nextSuggestion(protocolId, finishedProtocols);
  const nextName = next ? getProtocolById(next.id).name : '';
  const pathDone = GUIDED_PATH.every((id) => finishedProtocols.includes(id));

  return (
    <div
      role="dialog"
      aria-label={t('recap.title')}
      className="absolute inset-x-3 bottom-3 z-20 mx-auto max-w-xl rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-4 shadow-[var(--shadow-card)] sm:inset-x-auto sm:end-4"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label={t('common.close')}
        className="absolute end-2.5 top-2.5 flex h-7 w-7 items-center justify-center rounded-full text-[var(--text-muted)] hover:bg-[var(--bg-inset)] hover:text-[var(--text-primary)]"
      >
        <X className="w-4 h-4" />
      </button>
      <h3 className="flex items-center gap-2 pe-8 font-display text-base font-bold text-[var(--text-primary)]">
        <PartyPopper className="w-4 h-4 text-[var(--accent-primary)]" aria-hidden="true" />
        {pathDone ? t('recap.pathDone') : t('recap.title')}
      </h3>
      <p className="mt-1.5 text-sm leading-relaxed text-[var(--text-secondary)]">{tc(protocol.eli5)}</p>
      <ol className="mt-2.5 space-y-1">
        {protocol.steps.slice(0, 5).map((s, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-[var(--text-primary)]">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--accent-primary-soft)] text-[11px] font-bold text-[var(--accent-primary)]">
              {i + 1}
            </span>
            {tc(s.title)}
          </li>
        ))}
      </ol>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {next && (
          <button
            type="button"
            onClick={() => selectProtocol(next.id, 0)}
            className="flex items-center gap-1.5 rounded-full bg-[var(--accent-cta)] px-4 py-1.5 text-sm font-semibold text-[var(--on-accent)] hover:bg-[var(--accent-cta-hover)]"
          >
            {t('recap.next', { name: nextName })}
            <ArrowRight className="w-4 h-4 rtl:rotate-180" />
          </button>
        )}
        <button
          type="button"
          onClick={onReplay}
          className="flex items-center gap-1.5 rounded-full border border-[var(--border-hairline)] px-4 py-1.5 text-sm font-semibold text-[var(--text-primary)] hover:border-[var(--accent-primary)]"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          {t('recap.replay')}
        </button>
      </div>
    </div>
  );
};
