import { describe, expect, it } from 'vitest';
import { activeStreak, addDays, atRisk, dayKey, EMPTY_STREAK, recordDay } from '../../lib/streak';

describe('streak', () => {
  it('formats local day keys and adds days across month, year and leap boundaries', () => {
    expect(dayKey(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('starts at 1, counts consecutive days, and ignores repeats on the same day', () => {
    let s = recordDay(EMPTY_STREAK, '2026-11-10');
    expect(s).toEqual({ current: 1, best: 1, lastDay: '2026-11-10' });
    expect(recordDay(s, '2026-11-10')).toBe(s);
    s = recordDay(s, '2026-11-11');
    s = recordDay(s, '2026-11-12');
    expect(s.current).toBe(3);
    expect(s.best).toBe(3);
  });

  it('resets after a missed day but remembers the best run', () => {
    let s = recordDay(recordDay(recordDay(EMPTY_STREAK, '2026-11-10'), '2026-11-11'), '2026-11-12');
    s = recordDay(s, '2026-11-14'); // skipped the 13th
    expect(s.current).toBe(1);
    expect(s.best).toBe(3);
  });

  it('shows a streak as alive today or yesterday, and broken after that', () => {
    const s = recordDay(recordDay(EMPTY_STREAK, '2026-11-10'), '2026-11-11');
    expect(activeStreak(s, '2026-11-11')).toBe(2);
    expect(activeStreak(s, '2026-11-12')).toBe(2);
    expect(atRisk(s, '2026-11-12')).toBe(true);
    expect(atRisk(s, '2026-11-11')).toBe(false);
    expect(activeStreak(s, '2026-11-13')).toBe(0);
    expect(activeStreak(EMPTY_STREAK, '2026-11-13')).toBe(0);
  });

  it('handles a year boundary', () => {
    const s = recordDay(recordDay(EMPTY_STREAK, '2026-12-31'), '2027-01-01');
    expect(s.current).toBe(2);
  });
});
