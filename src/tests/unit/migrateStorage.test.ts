// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { migrateLegacyStorage } from '../../lib/migrateStorage';

describe('legacy storage migration', () => {
  beforeEach(() => localStorage.clear());

  it('moves every gg- key to netpulse- and removes the old one', () => {
    localStorage.setItem('gg-theme', 'dark');
    localStorage.setItem('gg-streak', '{"current":4}');
    localStorage.setItem('unrelated', 'keep');
    migrateLegacyStorage();
    expect(localStorage.getItem('netpulse-theme')).toBe('dark');
    expect(localStorage.getItem('netpulse-streak')).toBe('{"current":4}');
    expect(localStorage.getItem('gg-theme')).toBeNull();
    expect(localStorage.getItem('gg-streak')).toBeNull();
    expect(localStorage.getItem('unrelated')).toBe('keep');
  });

  it('never overwrites a value the new key already has', () => {
    localStorage.setItem('gg-lang', 'es');
    localStorage.setItem('netpulse-lang', 'ar');
    migrateLegacyStorage();
    expect(localStorage.getItem('netpulse-lang')).toBe('ar');
    expect(localStorage.getItem('gg-lang')).toBeNull();
  });

  it('is safe to run twice', () => {
    localStorage.setItem('gg-favorites', '["http"]');
    migrateLegacyStorage();
    migrateLegacyStorage();
    expect(localStorage.getItem('netpulse-favorites')).toBe('["http"]');
  });
});
