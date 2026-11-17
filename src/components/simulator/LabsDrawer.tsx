import React, { useState } from 'react';
import { AlertCircle, CheckCircle2, Lightbulb, Play, Sparkles, Wrench, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ALL_SIM_LABS, BREAK_IT_CHALLENGES, PRESET_LABS, type PresetLab } from '../../simulator/labs';
import { useAppStore } from '../../store/useAppStore';

interface LabsDrawerProps {
  open: boolean;
  onClose: () => void;
  onSelectLab: (lab: PresetLab) => void;
  onRunLabDemo: (lab: PresetLab) => void;
  onRunLabSolve: (lab: PresetLab) => void;
}

export const LabsDrawer: React.FC<LabsDrawerProps> = ({
  open,
  onClose,
  onSelectLab,
  onRunLabDemo,
  onRunLabSolve,
}) => {
  const { t } = useTranslation();
  const { activeLabId, completedLabs, markLabCompleted } = useAppStore();
  const [showHints, setShowHints] = useState(false);
  const [filterMode, setFilterMode] = useState<'all' | 'standard' | 'break'>('all');

  if (!open) return null;

  const activeLab = ALL_SIM_LABS.find((l) => l.id === activeLabId) ?? PRESET_LABS[0];
  const isCompleted = completedLabs.includes(activeLab.id);
  const isBreakIt = activeLab.category.includes('Break-It');

  const visibleLabs =
    filterMode === 'standard'
      ? PRESET_LABS
      : filterMode === 'break'
      ? BREAK_IT_CHALLENGES
      : ALL_SIM_LABS;

  return (
    <section
      aria-label="Preset Network Labs and Troubleshooting Challenges"
      className="shrink-0 border-b border-[var(--border-strong)] bg-[var(--bg-surface)] px-4 py-3 shadow-lg z-20"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <div className="flex items-center gap-2 font-mono text-[10px] font-semibold text-[var(--accent-primary)]">
              <span>{isBreakIt ? 'Challenge' : 'Lab'} {activeLab.number} · {activeLab.category}</span>
              <span>·</span>
              <span>{completedLabs.length}/{ALL_SIM_LABS.length} Solved</span>
              {isBreakIt && (
                <span className="inline-flex items-center gap-1 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300 px-1.5 py-0.2 font-bold animate-pulse">
                  <Wrench className="w-2.5 h-2.5" /> Troubleshooting
                </span>
              )}
            </div>
            <h2 className="font-display text-sm font-bold text-[var(--text-primary)]">{activeLab.title}</h2>
          </div>

          {/* Filter Pills */}
          <div className="inline-flex items-center rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-inset)] p-0.5 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setFilterMode('all')}
              className={`px-2 py-0.5 rounded-md transition-colors ${
                filterMode === 'all' ? 'bg-[var(--accent-cta)] text-white shadow-xs' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              All ({ALL_SIM_LABS.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('standard')}
              className={`px-2 py-0.5 rounded-md transition-colors ${
                filterMode === 'standard' ? 'bg-[var(--accent-cta)] text-white shadow-xs' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              Labs (20)
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('break')}
              className={`flex items-center gap-1 px-2 py-0.5 rounded-md transition-colors ${
                filterMode === 'break' ? 'bg-amber-600 text-white shadow-xs' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Wrench className="w-3 h-3" />
              <span>Break-It (3)</span>
            </button>
          </div>

          <select
            aria-label="Select preset lab or challenge"
            value={activeLab.id}
            onChange={(e) => {
              const lab = ALL_SIM_LABS.find((l) => l.id === e.target.value);
              if (lab) onSelectLab(lab);
            }}
            className="h-8 max-w-md rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-inset)] px-2.5 text-xs font-medium text-[var(--text-primary)]"
          >
            {visibleLabs.map((lab) => (
              <option key={lab.id} value={lab.id}>
                {completedLabs.includes(lab.id) ? '✓ ' : ''}
                {lab.category.includes('Break-It') ? '🔧 ' : ''}
                {lab.title} ({lab.category})
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => onRunLabDemo(activeLab)}
            className="flex h-8 items-center gap-1.5 rounded-lg bg-[var(--accent-cta)] px-3 text-xs font-semibold text-white hover:bg-[var(--accent-cta-hover)] whitespace-nowrap shrink-0 transition-colors"
          >
            <Play className="w-3.5 h-3.5" />
            <span>{t('simulator.runDemo')}</span>
          </button>
          <button
            type="button"
            onClick={() => onRunLabSolve(activeLab)}
            className="flex h-8 items-center gap-1.5 rounded-lg border border-[var(--tone-success)]/50 bg-[var(--tone-success)]/12 px-3 text-xs font-semibold text-[var(--tone-success)] hover:bg-[var(--tone-success)]/20 whitespace-nowrap shrink-0 transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{t('simulator.checkSolution')}</span>
          </button>
          <button
            type="button"
            onClick={() => markLabCompleted(activeLab.id)}
            className={`flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
              isCompleted
                ? 'border-[var(--tone-success)] bg-[var(--tone-success)]/15 text-[var(--tone-success)]'
                : 'border-[var(--border-hairline)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>{isCompleted ? 'Completed' : 'Complete'}</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.close')}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border-hairline)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="mt-2.5 grid gap-3 border-t border-[var(--border-hairline)] pt-2.5 text-xs md:grid-cols-3">
        <p className="text-[var(--text-secondary)] leading-relaxed">{activeLab.description}</p>

        <div>
          <div className="font-semibold text-[var(--text-primary)] mb-1">{t('simulator.labGoal')}</div>
          <ul className="list-disc ps-4 space-y-0.5 text-[var(--text-secondary)]">
            {activeLab.goals.map((g, idx) => (
              <li key={idx}>{g}</li>
            ))}
          </ul>
        </div>

        <div>
          <button
            type="button"
            onClick={() => setShowHints(!showHints)}
            className="inline-flex items-center gap-1 font-semibold text-[var(--tone-warning)] hover:underline mb-1"
          >
            <Lightbulb className="w-3.5 h-3.5" />
            <span>{showHints ? 'Hide Hints & Solution' : 'Show Hints & Solution'}</span>
          </button>
          {showHints && (
            <div className="space-y-1 text-[var(--text-secondary)]">
              {activeLab.hints.map((h, i) => (
                <div key={i}>• {h}</div>
              ))}
              <div className="pt-1 font-mono text-[11px] text-[var(--tone-success)]">
                Solution: {activeLab.solutionSummary}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
