import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Lightbulb,
  Play,
  Search,
  Sparkles,
  Target,
  Wrench,
  X,
} from 'lucide-react';
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
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [dropdownOpen]);

  if (!open) return null;

  const activeLab = ALL_SIM_LABS.find((l) => l.id === activeLabId) ?? PRESET_LABS[0];
  const activeIndex = ALL_SIM_LABS.findIndex((l) => l.id === activeLab.id);
  const isCompleted = completedLabs.includes(activeLab.id);
  const isBreakIt = activeLab.category.includes('Break-It');

  const visibleLabs =
    filterMode === 'standard'
      ? PRESET_LABS
      : filterMode === 'break'
      ? BREAK_IT_CHALLENGES
      : ALL_SIM_LABS;

  const filteredVisibleLabs = visibleLabs.filter((lab) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      lab.title.toLowerCase().includes(q) ||
      lab.category.toLowerCase().includes(q) ||
      `lab ${lab.number}`.includes(q)
    );
  });

  const handlePrevLab = () => {
    if (activeIndex > 0) {
      onSelectLab(ALL_SIM_LABS[activeIndex - 1]);
    }
  };

  const handleNextLab = () => {
    if (activeIndex < ALL_SIM_LABS.length - 1) {
      onSelectLab(ALL_SIM_LABS[activeIndex + 1]);
    }
  };

  return (
    <section
      aria-label="Preset Network Labs and Troubleshooting Challenges"
      className="shrink-0 border-b border-[var(--border-strong)] bg-[var(--bg-surface)] px-4 py-3 shadow-lg z-20 transition-all animate-in fade-in"
    >
      {/* Top Header Strip */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Left: Lab Identification & Quick Navigation */}
        <div className="flex flex-wrap items-center gap-2.5 min-w-0">
          {/* Lab Tag & Number Badge */}
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-mono text-xs font-bold ${
                isBreakIt
                  ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30'
                  : 'bg-[var(--accent-primary-soft)] text-[var(--accent-primary)] border border-[var(--accent-primary)]/30'
              }`}
            >
              {isBreakIt ? <Wrench className="w-3 h-3" /> : <BookOpen className="w-3 h-3" />}
              <span>{isBreakIt ? 'Challenge' : 'Lab'} #{activeLab.number}</span>
            </span>

            <h2 className="font-display text-sm font-bold text-[var(--text-primary)] truncate max-w-[280px] sm:max-w-md">
              {activeLab.title}
            </h2>

            <span className="hidden sm:inline-block rounded-full bg-[var(--bg-inset)] px-2 py-0.5 font-mono text-[11px] font-semibold text-[var(--text-secondary)] border border-[var(--border-hairline)]">
              {activeLab.category}
            </span>

            {isCompleted ? (
              <span className="hidden md:inline-flex items-center gap-1 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 text-[11px] font-bold border border-emerald-500/30">
                <Check className="w-3 h-3" /> Solved
              </span>
            ) : null}
          </div>

          <span className="hidden lg:inline-block h-4 w-px bg-[var(--border-hairline)]" aria-hidden="true" />

          {/* Stepper Buttons: Prev & Next */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={handlePrevLab}
              disabled={activeIndex <= 0}
              title="Previous Lab"
              aria-label="Previous Lab"
              className="flex h-7.5 w-7.5 items-center justify-center rounded-md border border-[var(--border-hairline)] bg-[var(--bg-inset)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)] disabled:opacity-40 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleNextLab}
              disabled={activeIndex >= ALL_SIM_LABS.length - 1}
              title="Next Lab"
              aria-label="Next Lab"
              className="flex h-7.5 w-7.5 items-center justify-center rounded-md border border-[var(--border-hairline)] bg-[var(--bg-inset)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)] disabled:opacity-40 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Custom Lab Selector Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setDropdownOpen((o) => !o)}
              aria-expanded={dropdownOpen}
              className="flex h-7.5 items-center gap-1.5 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-inset)] px-2.5 text-xs font-semibold text-[var(--text-primary)] hover:border-[var(--accent-primary)] transition-colors shadow-2xs"
            >
              <span>Browse All {ALL_SIM_LABS.length} Labs</span>
              <span className="font-mono text-[10.5px] text-[var(--accent-primary)] font-bold">
                ({completedLabs.length}/{ALL_SIM_LABS.length})
              </span>
              <ChevronDown className={`w-3.5 h-3.5 text-[var(--text-secondary)] transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {dropdownOpen && (
              <div className="absolute start-0 top-full mt-1.5 z-50 w-80 sm:w-96 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)] p-2 shadow-2xl animate-in fade-in zoom-in-95">
                {/* Search inside Lab Selector */}
                <div className="relative mb-2">
                  <Search className="w-3.5 h-3.5 text-[var(--text-muted)] absolute start-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search labs & challenges..."
                    aria-label="Search labs"
                    className="w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-inset)] ps-8 pe-3 py-1.5 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-[var(--accent-primary)] focus:outline-none"
                  />
                </div>

                {/* Filter Pills */}
                <div className="flex items-center gap-1 border-b border-[var(--border-hairline)] pb-2 mb-2">
                  <button
                    type="button"
                    onClick={() => setFilterMode('all')}
                    className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors ${
                      filterMode === 'all'
                        ? 'bg-[var(--accent-cta)] text-white'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    All ({ALL_SIM_LABS.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterMode('standard')}
                    className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors ${
                      filterMode === 'standard'
                        ? 'bg-[var(--accent-cta)] text-white'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    Labs (20)
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterMode('break')}
                    className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold transition-colors ${
                      filterMode === 'break'
                        ? 'bg-amber-600 text-white'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    <Wrench className="w-2.5 h-2.5" />
                    <span>Break-It (3)</span>
                  </button>
                </div>

                {/* Scrollable Labs List */}
                <div className="max-h-64 overflow-y-auto space-y-1 pe-1">
                  {filteredVisibleLabs.map((lab) => {
                    const active = lab.id === activeLab.id;
                    const solved = completedLabs.includes(lab.id);
                    const isBreak = lab.category.includes('Break-It');
                    return (
                      <button
                        key={lab.id}
                        type="button"
                        onClick={() => {
                          onSelectLab(lab);
                          setDropdownOpen(false);
                        }}
                        className={`flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-start text-xs transition-colors ${
                          active
                            ? 'bg-[var(--accent-primary-soft)] text-[var(--accent-primary)] font-bold ring-1 ring-[var(--accent-primary)]'
                            : 'text-[var(--text-primary)] hover:bg-[var(--bg-inset)]'
                        }`}
                      >
                        <div className="min-w-0 flex items-center gap-2 truncate">
                          <span className="font-mono text-[11px] text-[var(--text-secondary)] shrink-0">
                            #{lab.number}
                          </span>
                          <span className="truncate">{lab.title}</span>
                          {isBreak && (
                            <Wrench className="w-3 h-3 text-amber-500 shrink-0" />
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-[10px] text-[var(--text-muted)]">{lab.category}</span>
                          {solved && (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                          )}
                        </div>
                      </button>
                    );
                  })}
                  {filteredVisibleLabs.length === 0 && (
                    <div className="p-3 text-center text-xs text-[var(--text-muted)]">
                      No labs matching &quot;{searchQuery}&quot;
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Accessible Native Select (visually hidden or accessible for test compatibility) */}
          <select
            aria-label="Select preset lab or challenge"
            value={activeLab.id}
            onChange={(e) => {
              const lab = ALL_SIM_LABS.find((l) => l.id === e.target.value);
              if (lab) onSelectLab(lab);
            }}
            className="sr-only"
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

        {/* Right: Actions */}
        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => onRunLabDemo(activeLab)}
            className="flex h-7.5 items-center gap-1.5 rounded-lg bg-[var(--accent-cta)] px-3 text-xs font-semibold text-white hover:bg-[var(--accent-cta-hover)] whitespace-nowrap shrink-0 transition-colors shadow-2xs"
          >
            <Play className="w-3.5 h-3.5" />
            <span>{t('simulator.runDemo')}</span>
          </button>
          <button
            type="button"
            onClick={() => onRunLabSolve(activeLab)}
            className="flex h-7.5 items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 text-xs font-semibold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20 whitespace-nowrap shrink-0 transition-colors shadow-2xs"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{t('simulator.checkSolution')}</span>
          </button>
          <button
            type="button"
            onClick={() => markLabCompleted(activeLab.id)}
            className={`flex h-7.5 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
              isCompleted
                ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                : 'border-[var(--border-hairline)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)]'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>{isCompleted ? 'Solved' : 'Mark Done'}</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.close')}
            title={t('common.close')}
            className="flex h-7.5 w-7.5 items-center justify-center rounded-lg border border-[var(--border-hairline)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Modern 3-Column Brief Cards */}
      <div className="mt-2.5 grid gap-2.5 border-t border-[var(--border-hairline)] pt-2.5 text-xs md:grid-cols-3">
        {/* Card 1: Scenario Overview */}
        <div className="rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-inset)]/40 p-2.5 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-1.5 font-bold text-[var(--text-primary)] mb-1">
              <BookOpen className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
              <span>Scenario Architecture</span>
            </div>
            <p className="text-[var(--text-secondary)] leading-relaxed">{activeLab.description}</p>
          </div>
        </div>

        {/* Card 2: Mission Goals Checklist */}
        <div className="rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-inset)]/40 p-2.5">
          <div className="flex items-center gap-1.5 font-bold text-[var(--text-primary)] mb-1">
            <Target className="w-3.5 h-3.5 text-emerald-500" />
            <span>{t('simulator.labGoal')}</span>
          </div>
          <ul className="space-y-1 text-[var(--text-secondary)]">
            {activeLab.goals.map((g, idx) => (
              <li key={idx} className="flex items-start gap-1.5">
                <span className="font-mono text-[10px] font-bold text-[var(--accent-primary)] mt-0.5">
                  {idx + 1}.
                </span>
                <span className="leading-tight">{g}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Card 3: Guided Hints & Solution Accordion */}
        <div className="rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-inset)]/40 p-2.5">
          <div className="flex items-center justify-between gap-2 mb-1">
            <button
              type="button"
              onClick={() => setShowHints(!showHints)}
              className="inline-flex items-center gap-1.5 font-semibold text-[var(--tone-warning)] hover:underline"
            >
              <Lightbulb className="w-3.5 h-3.5" />
              <span>{showHints ? 'Hide Hints & Solution' : 'Show Hints & Solution'}</span>
            </button>
            {isBreakIt && (
              <span className="text-[10.5px] font-mono text-amber-600 dark:text-amber-400 font-semibold">
                Break-It Mode
              </span>
            )}
          </div>
          {showHints ? (
            <div className="space-y-1.5 text-[var(--text-secondary)] animate-in fade-in">
              {activeLab.hints.map((h, i) => (
                <div key={i} className="leading-tight text-[11.5px]">• {h}</div>
              ))}
              <div className="mt-1.5 rounded-md border border-emerald-500/30 bg-emerald-500/10 p-1.5 font-mono text-[11px] text-emerald-700 dark:text-emerald-300">
                <strong>Solution:</strong> {activeLab.solutionSummary}
              </div>
            </div>
          ) : (
            <p className="text-[11.5px] text-[var(--text-muted)] leading-relaxed">
              Click above to reveal troubleshooting steps and target CLI commands.
            </p>
          )}
        </div>
      </div>
    </section>
  );
};
