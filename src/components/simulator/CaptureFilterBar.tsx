import React from 'react';
import { AlertCircle, CheckCircle2, Download, Filter, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { DisplayFilterValidation } from '../../lib/displayFilter';

export interface CaptureFilterPreset {
  label: string;
  expr: string;
}

const FILTER_PRESETS: CaptureFilterPreset[] = [
  { label: 'TCP', expr: 'tcp' },
  { label: 'DNS', expr: 'dns' },
  { label: 'ICMP', expr: 'icmp' },
  { label: 'SYN', expr: 'tcp.flags.syn == 1' },
  { label: 'HTTP', expr: 'http.request' },
  { label: '!ARP', expr: '!arp' },
];

interface CaptureFilterBarProps {
  value: string;
  validation: DisplayFilterValidation;
  matchedCount: number;
  totalCount: number;
  onChange: (next: string) => void;
  onClear: () => void;
  onExportPcap?: () => void;
  onExportCsv?: () => void;
}

export const CaptureFilterBar: React.FC<CaptureFilterBarProps> = ({
  value,
  validation,
  matchedCount,
  totalCount,
  onChange,
  onClear,
  onExportPcap,
  onExportCsv,
}) => {
  const { t } = useTranslation();
  const hasFilter = value.trim().length > 0;

  return (
    <section
      aria-label="Simulator Capture Filter Toolbar"
      className="flex flex-wrap items-center justify-between gap-2.5 border-b border-[var(--border-hairline)] bg-[var(--bg-surface)] px-3 py-2 text-xs"
    >
      {/* Left: Filter Input with syntax status + Presets */}
      <div className="flex flex-1 flex-wrap items-center gap-2 min-w-[280px]">
        {/* Search input with embedded icons */}
        <div className="relative flex-1 min-w-[220px] max-w-lg flex items-center">
          <span className="absolute start-2.5 flex items-center pointer-events-none text-[var(--accent-primary)] font-bold text-xs" aria-hidden="true">
            <Filter className="w-3.5 h-3.5" />
          </span>
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
            aria-label="Wireshark capture display filter"
            aria-invalid={hasFilter && !validation.valid}
            className={`h-8 w-full rounded-lg border bg-[var(--bg-inset)] ps-8 pe-16 font-mono text-[12.5px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none transition-colors ${
              !hasFilter
                ? 'border-[var(--border-hairline)] focus:border-[var(--accent-primary)]'
                : validation.valid
                ? 'border-[var(--tone-success)]/80 focus:border-[var(--tone-success)] bg-[var(--tone-success)]/5'
                : 'border-[var(--tone-danger)]/80 focus:border-[var(--tone-danger)] bg-[var(--tone-danger)]/5'
            }`}
          />
          {/* Quick status icon & clear button */}
          <div className="absolute end-2 flex items-center gap-1.5">
            {hasFilter && (
              <>
                {validation.valid ? (
                  <span title={t('simulator.validFilter')} className="flex items-center">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[var(--tone-success)]" />
                  </span>
                ) : (
                  <span title={`${t('simulator.invalidFilter')}: ${validation.reason}`} className="flex items-center">
                    <AlertCircle className="w-3.5 h-3.5 text-[var(--tone-danger)]" />
                  </span>
                )}
                <button
                  type="button"
                  onClick={onClear}
                  aria-label={t('simulator.clearFilter')}
                  title={t('simulator.clearFilter')}
                  className="rounded p-0.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)]"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Quick Filter Presets Chips */}
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
          {FILTER_PRESETS.map((preset) => {
            const isActive = value.trim().toLowerCase() === preset.expr.toLowerCase();
            return (
              <button
                key={preset.expr}
                type="button"
                onClick={() => onChange(isActive ? '' : preset.expr)}
                aria-pressed={isActive}
                className={`h-7 rounded-md border px-2 font-mono text-[11px] font-semibold transition-all shrink-0 ${
                  isActive
                    ? 'border-[var(--accent-cta)] bg-[var(--accent-cta)] text-white shadow-2xs'
                    : 'border-[var(--border-hairline)] bg-[var(--bg-inset)]/70 text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]'
                }`}
              >
                {preset.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Right: Matched Counts + Export Action Buttons */}
      <div className="flex items-center gap-2.5 shrink-0">
        <span className="font-mono text-xs font-semibold text-[var(--text-secondary)] tabular-nums">
          <strong className="text-[var(--text-primary)]">{matchedCount}</strong> / {totalCount} pkts
        </span>

        <span className="h-4 w-px bg-[var(--border-hairline)] shrink-0" aria-hidden="true" />

        {onExportPcap && (
          <button
            type="button"
            onClick={onExportPcap}
            title={t('explore.exportPcap')}
            aria-label={t('explore.exportPcap')}
            className="flex h-7.5 items-center gap-1.5 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-inset)]/60 px-2.5 font-mono text-xs font-semibold text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-all whitespace-nowrap shadow-2xs"
          >
            <Download className="w-3 h-3 text-[var(--accent-teal)]" />
            <span className="hidden sm:inline">{t('explore.exportPcap')}</span>
            <span className="sm:hidden">PCAP</span>
          </button>
        )}

        {onExportCsv && (
          <button
            type="button"
            onClick={onExportCsv}
            title={t('explore.exportCsv')}
            aria-label={t('explore.exportCsv')}
            className="flex h-7.5 items-center gap-1.5 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-inset)]/60 px-2.5 font-mono text-xs font-semibold text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-all whitespace-nowrap shadow-2xs"
          >
            <Download className="w-3 h-3 text-[var(--accent-teal)]" />
            <span className="hidden sm:inline">{t('explore.exportCsv')}</span>
            <span className="sm:hidden">CSV</span>
          </button>
        )}
      </div>
    </section>
  );
};
