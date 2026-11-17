import React from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight, CheckCircle2, ChevronRight, Compass, Sparkles, X } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';

const GUIDED_STEPS = [
  { id: 'http', label: '1. HTTP', subtitle: 'Web Requests' },
  { id: 'dns', label: '2. DNS', subtitle: 'Name Resolution' },
  { id: 'tcp', label: '3. TCP', subtitle: '3-Way Handshake' },
  { id: 'tls', label: '4. TLS', subtitle: 'Encryption' },
] as const;

export const GuidedTrackBanner: React.FC = () => {
  const { t } = useTranslation();
  const {
    activeProtocolId,
    viewedProtocols,
    selectProtocol,
    guidedTrackDismissed,
    setGuidedTrackDismissed,
  } = useAppStore();

  const completedCount = GUIDED_STEPS.filter((s) => viewedProtocols.includes(s.id)).length;
  const progressPercent = Math.round((completedCount / GUIDED_STEPS.length) * 100);

  if (guidedTrackDismissed) {
    return (
      <div className="shrink-0 flex items-center justify-between border-b border-[var(--border-hairline)] bg-[var(--bg-inset)]/60 px-3.5 py-1 text-xs">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-[var(--accent-primary)]">
            🎓 Guided First Path: {completedCount}/{GUIDED_STEPS.length} Completed ({progressPercent}%)
          </span>
        </div>
        <button
          type="button"
          onClick={() => setGuidedTrackDismissed(false)}
          className="text-[var(--accent-primary)] hover:underline font-medium text-[11px]"
        >
          Show Path
        </button>
      </div>
    );
  }

  return (
    <div className="shrink-0 border-b border-[var(--border-hairline)] bg-[var(--bg-surface)] px-3.5 py-2.5 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--accent-primary-soft)] text-[var(--accent-primary)]">
            <Compass className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-display text-xs font-bold uppercase tracking-wider text-[var(--accent-primary)]">
                Start Here: The Web's Journey
              </span>
              <span className="rounded-full bg-[var(--bg-inset)] border border-[var(--border-hairline)] px-2 py-0.5 font-mono text-[11px] font-bold text-[var(--text-secondary)]">
                Step {completedCount} of {GUIDED_STEPS.length} ({progressPercent}%)
              </span>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setGuidedTrackDismissed(true)}
          title="Dismiss Track Banner"
          aria-label="Dismiss Track Banner"
          className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Progress Track Bar */}
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[var(--bg-inset)]">
        <div
          className="h-full bg-gradient-to-r from-[var(--accent-teal)] to-[var(--accent-primary)] transition-all duration-300"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Step Pills */}
      <div className="mt-2.5 grid grid-cols-2 sm:grid-cols-4 gap-2">
        {GUIDED_STEPS.map((step, idx) => {
          const isDone = viewedProtocols.includes(step.id);
          const isActive = activeProtocolId === step.id;

          return (
            <button
              key={step.id}
              type="button"
              onClick={() => selectProtocol(step.id, 0)}
              className={`flex items-center justify-between gap-1.5 rounded-lg border px-2.5 py-1.5 text-start transition-all ${
                isActive
                  ? 'border-[var(--accent-primary)] bg-[var(--accent-primary-soft)] text-[var(--accent-primary)] shadow-xs ring-1 ring-[var(--accent-primary)]'
                  : isDone
                  ? 'border-[var(--tone-success)]/40 bg-[var(--tone-success)]/8 text-[var(--text-primary)]'
                  : 'border-[var(--border-hairline)] bg-[var(--bg-inset)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <div className="min-w-0">
                <div className="font-mono text-xs font-bold leading-tight truncate">{step.label}</div>
                <div className="text-[10.5px] text-[var(--text-muted)] truncate">{step.subtitle}</div>
              </div>
              {isDone ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 text-[var(--tone-success)]" />
              ) : (
                <span className="font-mono text-[10px] text-[var(--text-muted)]">#{idx + 1}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
