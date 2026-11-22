import React from 'react';
import { AlertCircle, CheckCircle2, Filter, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { DisplayFilterValidation } from '../../lib/displayFilter';
import { tc } from '../../i18n/content';

export interface CaptureFilterPreset {
  label: string;
  expr: string;
}

const FILTER_PRESETS: CaptureFilterPreset[] = [
  { label: 'TCP', expr: 'tcp' },
  { label: 'DNS', expr: 'dns' },
  { label: 'ICMP', expr: 'icmp' },
  { label: 'SYN Only', expr: 'tcp.flags.syn == 1' },
  { label: 'HTTP Req', expr: 'http.request' },
  { label: '!ARP', expr: '!arp' },
];

interface CaptureFilterBarProps {
  value: string;
  validation: DisplayFilterValidation;
  matchedCount: number;
  totalCount: number;
  onChange: (next: string) => void;
  onClear: () => void;
}

export const CaptureFilterBar: React.FC<CaptureFilterBarProps> = ({
  value,
  validation,
  matchedCount,
  totalCount,
  onChange,
  onClear,
}) => {
  const { t } = useTranslation();
  const hasFilter = value.trim().length > 0;

  return (
    <section
      aria-label={tc('Simulator Capture Filter')}
      className="rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-inset)]/60 px-3 py-2 space-y-1.5"
    >
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text-primary)] whitespace-nowrap shrink-0">
          <Filter className="w-3.5 h-3.5 text-[var(--accent-primary)]" aria-hidden="true" />
          <span>{t('simulator.captureFilter')}</span>
        </div>

        {/* Display Filter Input */}
        <div className="relative flex-1 min-w-[240px]">
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape' && hasFilter) {
                e.preventDefault();
                onClear();
              }
            }}
            placeholder={t('simulator.filterPlaceholder')}
            aria-label={tc('Wireshark capture display filter')}
            aria-invalid={hasFilter && !validation.valid}
            className={`w-full rounded-lg border bg-[var(--bg-surface)] py-1.5 ps-3 pe-8 font-mono text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none transition-colors ${
              !hasFilter
                ? 'border-[var(--border-hairline)] focus:border-[var(--accent-primary)]'
                : validation.valid
                ? 'border-[var(--tone-success)]/60 focus:border-[var(--tone-success)]'
                : 'border-[var(--tone-danger)]/70 focus:border-[var(--tone-danger)]'
            }`}
          />
          {hasFilter && (
            <button
              type="button"
              onClick={onClear}
              aria-label={tc('Clear capture filter')}
              title={t('simulator.clearFilter')}
              className="absolute end-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Syntax Validation Indicator (Dual-coded icon + text) */}
        <div className="flex items-center gap-3 shrink-0 text-xs">
          {hasFilter ? (
            validation.valid ? (
              <span className="inline-flex items-center gap-1 font-medium text-[var(--tone-success)] whitespace-nowrap shrink-0">
                <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{t('simulator.validFilter')}</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 font-medium text-[var(--tone-danger)] whitespace-nowrap shrink-0">
                <AlertCircle className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{t('simulator.invalidFilter')}: {validation.reason}</span>
              </span>
            )
          ) : (
            <span className="text-[var(--text-muted)] whitespace-nowrap shrink-0">{t('simulator.allTraffic')}</span>
          )}

          <span className="text-[var(--border-strong)]" aria-hidden="true">·</span>

          <span className="font-mono text-xs text-[var(--text-secondary)] tabular-nums whitespace-nowrap shrink-0">
            {matchedCount} / {totalCount}
          </span>
        </div>
      </div>

      {/* Preset Filter Controls */}
      <div className="flex flex-wrap items-center gap-1.5">
        {FILTER_PRESETS.map((preset) => {
          const isActive = value.trim().toLowerCase() === preset.expr.toLowerCase();
          return (
            <button
              key={preset.expr}
              type="button"
              onClick={() => onChange(isActive ? '' : preset.expr)}
              aria-pressed={isActive}
              className={`rounded-md border px-2.5 py-1 font-mono text-xs transition-colors whitespace-nowrap shrink-0 ${
                isActive
                  ? 'border-[var(--accent-cta)] bg-[var(--accent-cta)] text-[var(--on-accent)] font-semibold'
                  : 'border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:border-[var(--accent-primary)]/50 hover:text-[var(--text-primary)]'
              }`}
            >
              {preset.label}
            </button>
          );
        })}
        {hasFilter && (
          <button
            type="button"
            onClick={onClear}
            className="ms-auto rounded-md border border-[var(--border-hairline)] px-2.5 py-1 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] whitespace-nowrap shrink-0"
          >
            {t('common.clear')}
          </button>
        )}
      </div>
    </section>
  );
};
