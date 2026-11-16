import React, { useState } from 'react';
import { CheckCircle2, Lightbulb, Play, Sparkles, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { PRESET_LABS, type PresetLab } from '../../simulator/labs';
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

  if (!open) return null;

  const activeLab = PRESET_LABS.find((l) => l.id === activeLabId) ?? PRESET_LABS[0];
  const isCompleted = completedLabs.includes(activeLab.id);

  return (
    <section
      aria-label="20 Preset Network Labs"
      className="shrink-0 border-b border-[var(--border-strong)] bg-[var(--bg-surface)] px-4 py-3 shadow-lg z-20"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <div className="font-mono text-[10px] font-semibold text-[var(--accent-primary)]">
              Lab {activeLab.number} / 20 · {activeLab.category} · {completedLabs.length}/20
            </div>
            <h2 className="font-display text-sm font-bold text-[var(--text-primary)]">{activeLab.title}</h2>
          </div>

          <select
            aria-label="Select preset lab"
            value={activeLab.id}
            onChange={(e) => {
              const lab = PRESET_LABS.find((l) => l.id === e.target.value);
              if (lab) onSelectLab(lab);
            }}
            className="h-8 max-w-md rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-inset)] px-2.5 text-xs font-medium text-[var(--text-primary)]"
          >
            {PRESET_LABS.map((lab) => (
              <option key={lab.id} value={lab.id}>
                {completedLabs.includes(lab.id) ? '✓ ' : ''}
                Lab {lab.number}: {lab.title} ({lab.category})
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
