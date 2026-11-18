import React, { useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, HelpCircle, RefreshCw, Sparkles, Wrench, X } from 'lucide-react';
import type { PresetLab } from '../../simulator/labs';
import { playChallengeFailSound, playChallengeSuccessSound } from '../../lib/sound';
import { useAppStore } from '../../store/useAppStore';

interface BreakItChallengeHUDProps {
  lab: PresetLab;
  onRunTest: () => string;
  onReset: () => void;
  onNext?: () => void;
  onClose: () => void;
}

export const BreakItChallengeHUD: React.FC<BreakItChallengeHUDProps> = ({
  lab,
  onRunTest,
  onReset,
  onNext,
  onClose,
}) => {
  const [hintsExpanded, setHintsExpanded] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    timestamp: number;
  } | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  const { completedLabs, markLabCompleted, settings } = useAppStore();
  const isAlreadySolved = completedLabs.includes(lab.id);

  const handleVerify = () => {
    setIsVerifying(true);
    setTestResult(null);

    // Run verification probe
    const output = onRunTest();

    // Check for success markers (e.g. 0% packet loss, 1 packets received, successful solve)
    const success =
      output.includes('0% packet loss') ||
      output.includes('1 received') ||
      output.includes('2 received') ||
      output.includes('64 bytes from') ||
      output.includes('bytes from') ||
      output.toLowerCase().includes('success');

    setTimeout(() => {
      setIsVerifying(false);
      setTestResult({
        success,
        message: success
          ? 'Network connectivity restored! All diagnostic test probes passed.'
          : 'Diagnostic probe failed or timed out. Check your configurations and try again.',
        timestamp: Date.now(),
      });

      if (success) {
        markLabCompleted(lab.id);
        if (settings.soundEffects) {
          playChallengeSuccessSound();
        }
      } else {
        if (settings.soundEffects) {
          playChallengeFailSound();
        }
      }
    }, 350);
  };

  return (
    <div
      role="region"
      aria-label={`Troubleshooting Challenge: ${lab.title}`}
      className="shrink-0 relative z-20 border-b border-[var(--border-strong)] bg-[var(--bg-surface)] px-4 py-2.5 shadow-md select-none animate-in fade-in slide-in-from-top-2 duration-150"
    >
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
        {/* Left Side: Challenge Identity & Goals */}
        <div className="flex items-start lg:items-center gap-3 min-w-0 flex-1">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--tone-warning)]/15 text-[var(--tone-warning)] border border-[var(--tone-warning)]/30">
            <Wrench className="h-4 w-4" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs font-bold text-[var(--tone-warning)] uppercase tracking-wider">
                Troubleshooting #{lab.number}
              </span>
              <span className="h-3 w-px bg-[var(--border-hairline)]" aria-hidden="true" />
              <h2 className="font-display text-xs sm:text-sm font-bold text-[var(--text-primary)] truncate">
                {lab.title}
              </h2>

              {(isAlreadySolved || testResult?.success) && (
                <span className="inline-flex items-center gap-1 rounded-full bg-[var(--tone-success)]/15 px-2 py-0.5 text-[10.5px] font-semibold text-[var(--tone-success)] border border-[var(--tone-success)]/30">
                  <CheckCircle2 className="h-3 w-3" />
                  <span>SOLVED</span>
                </span>
              )}
            </div>

            <p className="mt-0.5 text-xs text-[var(--text-secondary)] line-clamp-1 max-w-3xl">
              {lab.description}
            </p>
          </div>
        </div>

        {/* Right Side: Action Controls */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {/* Hints Toggle */}
          <button
            type="button"
            onClick={() => setHintsExpanded(!hintsExpanded)}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-2.5 text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)] transition-colors"
          >
            <HelpCircle className="h-3.5 w-3.5 text-[var(--tone-warning)]" />
            <span>{hintsExpanded ? 'Hide Clues' : 'Diagnostic Clues'}</span>
            {hintsExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          </button>

          {/* Reset Topology Button */}
          <button
            type="button"
            onClick={onReset}
            title="Reset challenge to initial faulty state"
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-2.5 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Reset</span>
          </button>

          {/* Verify Fix Button */}
          <button
            type="button"
            onClick={handleVerify}
            disabled={isVerifying}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[var(--accent-cta)] hover:bg-[var(--accent-cta-hover)] px-3 text-xs font-semibold text-white shadow-xs transition-colors disabled:opacity-50"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>{isVerifying ? 'Verifying Probes...' : 'Verify Fix'}</span>
          </button>

          {/* Next Challenge Button (when solved) */}
          {(isAlreadySolved || testResult?.success) && onNext && (
            <button
              type="button"
              onClick={onNext}
              className="inline-flex h-8 items-center gap-1 rounded-lg border border-[var(--tone-success)]/40 bg-[var(--tone-success)]/10 px-2.5 text-xs font-semibold text-[var(--tone-success)] hover:bg-[var(--tone-success)]/20 transition-colors"
            >
              <span>Next</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          )}

          {/* Close HUD */}
          <button
            type="button"
            onClick={onClose}
            aria-label="Dismiss challenge banner"
            className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Expandable Diagnostic Hints */}
      {hintsExpanded && lab.hints.length > 0 && (
        <div className="mt-2.5 pt-2.5 border-t border-[var(--border-hairline)] flex flex-col gap-1.5 animate-in fade-in duration-100">
          <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--tone-warning)]">
            <AlertTriangle className="h-3.5 w-3.5" />
            <span>Investigation Clues:</span>
          </div>
          <ul className="list-disc list-inside text-xs text-[var(--text-secondary)] space-y-1 pl-1">
            {lab.hints.map((hint, i) => (
              <li key={i}>{hint}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Verification Feedback Banner */}
      {testResult && (
        <div
          role="status"
          className={`mt-2.5 flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-xs font-semibold animate-in fade-in duration-150 ${
            testResult.success
              ? 'border border-[var(--tone-success)]/40 bg-[var(--tone-success)]/10 text-[var(--tone-success)]'
              : 'border border-[var(--tone-danger)]/40 bg-[var(--tone-danger)]/10 text-[var(--tone-danger)]'
          }`}
        >
          <div className="flex items-center gap-2">
            {testResult.success ? (
              <CheckCircle2 className="h-4 w-4 shrink-0" />
            ) : (
              <AlertTriangle className="h-4 w-4 shrink-0" />
            )}
            <span>{testResult.message}</span>
          </div>
          {testResult.success && onNext && (
            <button
              type="button"
              onClick={onNext}
              className="underline hover:no-underline font-bold text-xs shrink-0"
            >
              Continue to Challenge #{lab.number + 1} →
            </button>
          )}
        </div>
      )}
    </div>
  );
};
