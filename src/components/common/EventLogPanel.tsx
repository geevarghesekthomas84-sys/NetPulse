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

  const chip = (active: boolean, tone: 'accent' | 'warn') =>
    `rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
      active
        ? tone === 'warn'
          ? 'border-[var(--tone-warning)] bg-[var(--tone-warning)]/15 text-[var(--tone-warning)]'
          : 'border-[var(--accent-primary)] bg-[var(--accent-primary-soft)] text-[var(--accent-primary)]'
        : 'border-[var(--border-hairline)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
    }`;

  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--bg-surface)]">
      {/* Toolbar */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-[var(--border-hairline)] px-4 py-2">
        <div className="flex items-center gap-2">
          <ScrollText className="h-4 w-4 text-[var(--accent-primary)]" aria-hidden="true" />
          <span className="hud-title text-xs text-[var(--text-primary)]">{t('explore.eventLogs')}</span>
          <span className="font-mono text-xs tabular-nums text-[var(--text-muted)]">{logs.length}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={() => setLevelFilter('all')} aria-pressed={levelFilter === 'all'} className={chip(levelFilter === 'all', 'accent')}>
            {t('drawer.all')} ({logs.length})
          </button>
          <button type="button" onClick={() => setLevelFilter('issues')} aria-pressed={levelFilter === 'issues'} className={chip(levelFilter === 'issues', 'warn')}>
            {t('explore.warningsErrors')} ({issueCount})
          </button>
        </div>
      </div>

      {/* Log stream */}
      <div className="min-h-0 flex-1 overflow-y-auto font-mono text-xs">
        {filtered.length === 0 ? (
          <div className="flex h-full min-h-[120px] items-center justify-center p-6 text-center font-sans text-sm text-[var(--text-muted)]">{emptyMessage}</div>
        ) : (
          <>
            <div className="hud-title sticky top-0 z-10 grid grid-cols-[4.5rem_5.5rem_8rem_1fr] gap-3 border-b border-[var(--border-hairline)] bg-[var(--bg-inset)] px-4 py-1.5 text-[11px] text-[var(--text-muted)]">
              <span>{t('pdu.time')}</span>
              <span>{t('explore.level')}</span>
              <span>{t('explore.device')}</span>
              <span>{t('explore.message')}</span>
            </div>
            {filtered.map((entry) => {
              const devName = deviceNameMap.get(entry.deviceId) ?? entry.deviceId;
              const isErr = entry.level === 'error';
              const isWarn = entry.level === 'warn';
              const color = isErr ? 'var(--tone-danger)' : isWarn ? 'var(--tone-warning)' : 'var(--tone-info)';
              return (
                <div
                  key={entry.id}
                  className="grid grid-cols-[4.5rem_5.5rem_8rem_1fr] items-baseline gap-3 border-b border-[var(--border-hairline)] px-4 py-2 hover:bg-[var(--bg-inset)]"
                  style={{ borderInlineStartWidth: 3, borderInlineStartColor: color }}
                >
                  <span className="tabular-nums text-[var(--text-muted)]">{entry.timeMs.toFixed(1)}</span>
                  <span className="inline-flex items-center gap-1 font-bold uppercase" style={{ color }}>
                    {isErr ? <AlertCircle className="h-3 w-3 shrink-0" /> : isWarn ? <AlertTriangle className="h-3 w-3 shrink-0" /> : <Info className="h-3 w-3 shrink-0" />}
                    {entry.level}
                  </span>
                  <span className="truncate font-semibold text-[var(--text-primary)]" title={devName}>
                    {devName}
                  </span>
                  <span className="min-w-0 break-words text-[var(--text-primary)]">{entry.message}</span>
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
};
