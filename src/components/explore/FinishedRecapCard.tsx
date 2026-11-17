import React from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Box, CheckCircle2, RotateCcw, Sparkles, X } from 'lucide-react';
import { getProtocolRecap } from '../../lib/protocolRecaps';
import { useAppStore } from '../../store/useAppStore';

interface FinishedRecapCardProps {
  protocolId: string;
  protocolName: string;
  onReplay: () => void;
  onOpenEncapsulation: () => void;
  onDismiss: () => void;
}

export const FinishedRecapCard: React.FC<FinishedRecapCardProps> = ({
  protocolId,
  protocolName,
  onReplay,
  onOpenEncapsulation,
  onDismiss,
}) => {
  const { t } = useTranslation();
  const { selectProtocol } = useAppStore();
  const recap = getProtocolRecap(protocolId, protocolName);

  return (
    <div className="mx-3.5 my-2.5 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)] p-4 shadow-xl animate-in fade-in slide-in-from-bottom-2 duration-200">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--tone-success)]/15 text-[var(--tone-success)]">
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-display text-sm font-bold text-[var(--text-primary)]">
              What did you just see?
            </h3>
            <p className="text-xs text-[var(--text-secondary)]">
              Recap of the complete {protocolName} packet exchange
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onDismiss}
          title="Dismiss Recap"
          aria-label="Dismiss Recap"
          className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* 3-Line Bullet Recap */}
      <ul className="mt-3 space-y-1.5 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-inset)]/60 p-3 text-xs text-[var(--text-primary)]">
        {recap.bullets.map((bullet, idx) => (
          <li key={idx} className="flex items-start gap-2 leading-relaxed">
            <span className="font-mono font-bold text-[var(--accent-primary)] mt-0.5">#{idx + 1}</span>
            <span>{bullet}</span>
          </li>
        ))}
      </ul>

      {/* Action Buttons */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onReplay}
            className="flex h-8 items-center gap-1.5 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-inset)] px-3 text-xs font-semibold text-[var(--text-primary)] hover:border-[var(--accent-primary)] transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Replay</span>
          </button>

          <button
            type="button"
            onClick={onOpenEncapsulation}
            className="flex h-8 items-center gap-1.5 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-inset)] px-3 text-xs font-semibold text-[var(--text-primary)] hover:border-[var(--accent-primary)] transition-colors"
          >
            <Box className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
            <span>Encapsulation View</span>
          </button>
        </div>

        <button
          type="button"
          onClick={() => selectProtocol(recap.nextProtocolId, 0)}
          className="flex h-8 items-center gap-1.5 rounded-lg bg-[var(--accent-cta)] px-3.5 text-xs font-semibold text-white hover:bg-[var(--accent-cta-hover)] transition-colors"
        >
          <span>Next: {recap.nextProtocolName}</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
