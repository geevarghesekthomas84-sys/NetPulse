export interface StreakState {
  /** Consecutive days with activity, as of `lastDay`. */
  current: number;
  best: number;
  /** Local calendar day (YYYY-MM-DD) of the most recent activity. */
  lastDay: string | null;
}

export const EMPTY_STREAK: StreakState = { current: 0, best: 0, lastDay: null };

/** Local-calendar day key. Uses the user's own timezone so "today" matches their clock. */
export function dayKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Calendar-day arithmetic that is safe across daylight-saving changes. */
export function addDays(key: string, n: number): string {
  const [y, m, d] = key.split('-').map(Number);
  return dayKey(new Date(y, m - 1, d + n, 12));
}

/** Registers activity on `today` and returns the updated streak. */
export function recordDay(prev: StreakState, today: string): StreakState {
  if (prev.lastDay === today) return prev;
  const continues = prev.lastDay === addDays(today, -1);
  const current = continues ? prev.current + 1 : 1;
  return { current, best: Math.max(prev.best, current), lastDay: today };
}

/** The streak to display: it is broken once a full day has been missed. */
export function activeStreak(s: StreakState, today: string): number {
  if (!s.lastDay) return 0;
  return s.lastDay === today || s.lastDay === addDays(today, -1) ? s.current : 0;
}

/** True when the streak is alive but today's activity has not happened yet. */
export function atRisk(s: StreakState, today: string): boolean {
  return s.lastDay === addDays(today, -1) && s.current > 0;
}
