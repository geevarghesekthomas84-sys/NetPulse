import React, { useState } from 'react';
import { CheckCircle2, Lightbulb, Play, Sparkles, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { PRESET_LABS, type PresetLab } from '../../simulator/labs';
import { useAppStore } from '../../store/useAppStore';
import { tc } from '../../i18n/content';

interface LabsDrawerProps {
  open: boolean;
  onClose: () => void;
  onSelectLab: (lab: PresetLab) => void;
  onRunLabDemo: (lab: PresetLab) => void;
  onRunLabSolve: (lab: PresetLab) => void;
}

export const LabsDrawer: React.FC<LabsDrawerProps> = ({ open, onClose, onSelectLab, onRunLabDemo, onRunLabSolve }) => {
  const { t } = useTranslation();
  const { activeLabId, completedLabs, markLabCompleted } = useAppStore();
  const [showHints, setShowHints] = useState(false);

  if (!open) return null;

  const activeLab = PRESET_LABS.find((l) => l.id === activeLabId) ?? PRESET_LABS[0];
  const isCompleted = completedLabs.includes(activeLab.id);

  // Group labs by category, keeping the original order.
  const groups: { category: string; labs: PresetLab[] }[] = [];
  for (const lab of PRESET_LABS) {
    const g = groups.find((x) => x.category === lab.category);
    if (g) g.labs.push(lab);
    else groups.push({ category: lab.category, labs: [lab] });
  }
  const pct = Math.round((completedLabs.length / PRESET_LABS.length) * 100);

  return (
    <section
      aria-label={tc('20 Preset Network Labs')}
      className="z-20 shrink-0 max-md:max-h-[60vh] max-md:overflow-y-auto border-b border-[var(--border-strong)] bg-[var(--bg-surface)] shadow-lg"
    >
      <div className="grid md:h-[min(54vh,30rem)] md:grid-cols-[17rem_1fr] md:grid-rows-[minmax(0,1fr)] md:overflow-hidden">
        {/* Lab list */}
        <nav
          aria-label={tc('Select preset lab')}
          className="flex min-h-0 flex-col border-b border-[var(--border-hairline)] md:border-b-0 md:border-e"
        >
          <div className="px-4 pt-3 pb-2">
            <div className="flex items-baseline justify-between text-xs">
              <span className="font-semibold text-[var(--text-primary)]">{tc('20 Preset Network Labs')}</span>
              <span className="font-mono tabular-nums text-[var(--text-muted)]">
                {completedLabs.length}/{PRESET_LABS.length}
              </span>
            </div>
            <div
              className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--bg-inset)]"
              role="progressbar"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div className="h-full rounded-full bg-[var(--tone-success)] transition-[width]" style={{ width: `${pct}%` }} />
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3 max-md:max-h-40">
            {groups.map((g) => (
              <div key={g.category} className="mt-2 first:mt-0">
                <div className="px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-[var(--text-muted)]">{tc(g.category)}</div>
                {g.labs.map((lab) => {
                  const active = lab.id === activeLab.id;
                  const done = completedLabs.includes(lab.id);
                  return (
                    <button
                      key={lab.id}
                      type="button"
                      aria-current={active ? 'true' : undefined}
                      onClick={() => onSelectLab(lab)}
                      className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-start text-sm transition-colors ${
                        active
                          ? 'bg-[var(--accent-primary-soft)] font-semibold text-[var(--accent-primary)]'
                          : 'text-[var(--text-secondary)] hover:bg-[var(--bg-inset)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      <span
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold tabular-nums ${
                          done ? 'bg-[var(--tone-success)] text-[var(--on-accent)]' : 'bg-[var(--bg-inset)] text-[var(--text-secondary)]'
                        }`}
                      >
                        {done ? <CheckCircle2 className="h-3.5 w-3.5" aria-label={t('labs.completed')} /> : lab.number}
                      </span>
                      <span className="min-w-0 flex-1 truncate">{tc(lab.title)}</span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </nav>

        {/* Lab detail */}
        <div className="min-h-0 overflow-y-auto p-4 md:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs font-medium text-[var(--text-muted)]">
                {tc('Lab')} {activeLab.number} / {PRESET_LABS.length} · {tc(activeLab.category)}
              </div>
              <h2 className="font-display text-lg font-bold leading-snug text-[var(--text-primary)]">{tc(activeLab.title)}</h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label={t('common.close')}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--bg-inset)] hover:text-[var(--text-primary)]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[var(--text-secondary)]">{tc(activeLab.description)}</p>

          <div className="mt-4">
            <div className="mb-1.5 text-xs font-bold uppercase tracking-wide text-[var(--text-muted)]">{t('simulator.labGoal')}</div>
            <ul className="space-y-1.5">
              {activeLab.goals.map((g, idx) => (
                <li key={idx} className="flex gap-2 text-sm text-[var(--text-primary)]">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent-primary)]" aria-hidden="true" />
                  <span>{tc(g)}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onRunLabDemo(activeLab)}
              className="flex h-9 items-center gap-1.5 rounded-lg bg-[var(--accent-cta)] px-4 text-sm font-semibold text-[var(--on-accent)] transition-colors hover:bg-[var(--accent-cta-hover)]"
            >
              <Play className="h-4 w-4" />
              {t('simulator.runDemo')}
            </button>
            <button
              type="button"
              onClick={() => onRunLabSolve(activeLab)}
              className="flex h-9 items-center gap-1.5 rounded-lg border border-[var(--tone-success)]/50 bg-[var(--tone-success)]/12 px-4 text-sm font-semibold text-[var(--tone-success)] transition-colors hover:bg-[var(--tone-success)]/20"
            >
              <Sparkles className="h-4 w-4" />
              {t('simulator.checkSolution')}
            </button>
            <button
              type="button"
              onClick={() => markLabCompleted(activeLab.id)}
              aria-pressed={isCompleted}
              className={`flex h-9 items-center gap-1.5 rounded-lg border px-3.5 text-sm font-semibold transition-colors ${
                isCompleted
                  ? 'border-[var(--tone-success)] bg-[var(--tone-success)]/15 text-[var(--tone-success)]'
                  : 'border-[var(--border-strong)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <CheckCircle2 className="h-4 w-4" />
              {isCompleted ? t('labs.completed') : t('labs.markComplete')}
            </button>
          </div>

          <div className="mt-4 border-t border-[var(--border-hairline)] pt-3">
            <button
              type="button"
              onClick={() => setShowHints(!showHints)}
              aria-expanded={showHints}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--tone-warning)] hover:underline"
            >
              <Lightbulb className="h-4 w-4" />
              {showHints ? tc('Hide Hints & Solution') : tc('Show Hints & Solution')}
            </button>
            {showHints && (
              <div className="mt-2 space-y-1.5 text-sm text-[var(--text-secondary)]">
                {activeLab.hints.map((h, i) => (
                  <div key={i} className="flex gap-2">
                    <span aria-hidden="true">•</span>
                    <span>{tc(h)}</span>
                  </div>
                ))}
                <div className="mt-2 rounded-lg bg-[var(--bg-inset)] px-3 py-2 font-mono text-xs text-[var(--tone-success)]">
                  {tc('Solution')}: {tc(activeLab.solutionSummary)}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
