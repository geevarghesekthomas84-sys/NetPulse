import React from 'react';
import { useTranslation } from 'react-i18next';
import { Flame } from 'lucide-react';
import { activeStreak, atRisk, dayKey } from '../../lib/streak';
import { useAppStore } from '../../store/useAppStore';

/** Flame + day count. Dim until the first day of activity; amber when today is still open. */
export const StreakBadge: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { t } = useTranslation();
  const streak = useAppStore((s) => s.streak);
  const today = dayKey();
  const days = activeStreak(streak, today);
  const open = atRisk(streak, today);
  const doneToday = streak.lastDay === today;

  const message = doneToday ? t('streak.done') : days > 0 ? t('streak.keep') : t('streak.start');

  return (
    <span
      title={`${t('streak.label', { count: days })} · ${t('streak.best', { count: streak.best })}\n${message}`}
      aria-label={`${t('streak.label', { count: days })}. ${message}`}
      role="status"
      className={`inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-sm font-semibold tabular-nums ${
        days > 0
          ? open
            ? 'border-[var(--tone-warning)] text-[var(--tone-warning)]'
            : 'border-[var(--accent-primary)] bg-[var(--accent-primary-soft)] text-[var(--accent-primary)]'
          : 'border-[var(--border-hairline)] text-[var(--text-muted)]'
      } ${className}`}
    >
      <Flame className={`w-4 h-4 ${days > 0 ? 'fill-current' : ''}`} aria-hidden="true" />
      {days}
    </span>
  );
};
