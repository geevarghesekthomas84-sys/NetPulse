import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertCircle, AlertTriangle, Info, ScrollText } from 'lucide-react';
import type { SimDevice, SimLogEntry } from '../../engine/types';

interface EventLogPanelProps {
  logs: SimLogEntry[];
  devices?: SimDevice[];
  emptyMessage?: string;
}

export const EventLogPanel: React.FC<EventLogPanelProps> = ({
  logs,
  devices = [],
  emptyMessage = 'No simulation events recorded yet. Step, play, or run CLI traffic to inspect kernel & forwarding events.',
}) => {
  const { t } = useTranslation();
  const [levelFilter, setLevelFilter] = useState<'all' | 'issues'>('all');

  const deviceNameMap = useMemo(() => new Map(devices.map((d) => [d.id, d.name])), [devices]);

  const filtered = useMemo(() => {
    const base =
      levelFilter === 'issues' ? logs.filter((l) => l.level === 'warn' || l.level === 'error') : logs;
    return [...base].reverse();
  }, [logs, levelFilter]);

  const issueCount = useMemo(
    () => logs.filter((l) => l.level === 'warn' || l.level === 'error').length,
    [logs]
  );

  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--bg-inset)]/60">
      {/* Toolbar */}
      <div className="shrink-0 flex items-center justify-between gap-2 border-b border-[var(--border-hairline)] bg-[var(--bg-surface)] px-4 py-2">
        <div className="flex items-center gap-2 text-[13px] font-display text-[var(--text-secondary)]">
          <ScrollText className="w-4 h-4 text-[var(--tone-info)]" />
          <span className="font-bold text-[var(--text-primary)]">{t('explore.eventLogs')}</span>
          <span className="font-mono text-xs font-semibold text-[var(--text-secondary)] tabular-nums">
            · {logs.length}
          </span>
        </div>

        <div className="flex items-center gap-1 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-inset)] p-0.5 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setLevelFilter('all')}
            className={`rounded-md px-2.5 py-1 transition-colors ${
              levelFilter === 'all'
                ? 'bg-[var(--accent-cta)] text-white'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            {t('drawer.all')} ({logs.length})
          </button>
          <button
            type="button"
            onClick={() => setLevelFilter('issues')}
            className={`rounded-md px-2.5 py-1 transition-colors ${
              levelFilter === 'issues'
                ? 'bg-amber-600 text-white'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            Warnings &amp; Errors ({issueCount})
          </button>
        </div>
      </div>

      {/* Log Stream */}
      <div className="flex-1 overflow-y-auto font-mono text-[13px] divide-y divide-[var(--border-hairline)]/60">
        {filtered.length === 0 ? (
          <div className="flex h-full min-h-[140px] items-center justify-center p-6 text-center font-sans text-[13px] text-[var(--text-secondary)]">
            {emptyMessage}
          </div>
        ) : (
          filtered.map((entry) => {
            const devName = deviceNameMap.get(entry.deviceId) ?? entry.deviceId;
            const isErr = entry.level === 'error';
            const isWarn = entry.level === 'warn';
            return (
              <div
                key={entry.id}
                className={`flex items-start gap-3 px-4 py-2 ${
                  isErr
                    ? 'bg-red-500/10 text-[var(--tone-danger)]'
                    : isWarn
                    ? 'bg-amber-500/10 text-[var(--tone-warning)]'
                    : 'bg-[var(--bg-surface)]/40 text-[var(--text-secondary)] hover:bg-[var(--accent-primary-soft)]/50'
                }`}
              >
                <span className="w-18 shrink-0 text-xs text-[var(--text-muted)] tabular-nums pt-0.5">
                  {(entry.timeMs / 1000).toFixed(3)}s
                </span>

                <span
                  className={`inline-flex w-18 shrink-0 items-center gap-1.5 text-xs font-bold pt-0.5 ${
                    isErr ? 'text-[var(--tone-danger)]' : isWarn ? 'text-[var(--tone-warning)]' : 'text-[var(--tone-info)]'
                  }`}
                >
                  {isErr ? (
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  ) : isWarn ? (
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  ) : (
                    <Info className="w-3.5 h-3.5 shrink-0" />
                  )}
                  <span className="capitalize">{entry.level}</span>
                </span>

                <span className="w-32 shrink-0 truncate font-semibold text-[var(--text-primary)]">
                  {devName}
                </span>

                <span className="min-w-0 flex-1 break-words text-[var(--text-primary)]">
                  {entry.message}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
