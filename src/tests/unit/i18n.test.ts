import { describe, expect, it } from 'vitest';
import ar from '../../i18n/ar.json';
import en from '../../i18n/en.json';
import es from '../../i18n/es.json';
import hi from '../../i18n/hi.json';
import ml from '../../i18n/ml.json';
import ta from '../../i18n/ta.json';
import { LANGUAGES } from '../../i18n';

const flattenKeys = (obj: Record<string, unknown>, prefix = ''): Record<string, string> => {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(result, flattenKeys(value as Record<string, unknown>, path));
    } else {
      result[path] = String(value ?? '');
    }
  }
  return result;
};

describe('i18n Locale Completeness & Parity Across All 6 Languages', () => {
  const locales = { en, es, ar, hi, ml, ta } as const;
  const enFlat = flattenKeys(en as unknown as Record<string, unknown>);
  const enKeys = Object.keys(enFlat).sort();

  it('registers all 6 supported languages with expected text directionality', () => {
    expect(LANGUAGES.map((l) => l.code)).toEqual(['en', 'hi', 'ml', 'ta', 'es', 'ar']);
    expect(LANGUAGES.find((l) => l.code === 'ar')?.dir).toBe('rtl');
    for (const l of LANGUAGES.filter((item) => item.code !== 'ar')) {
      expect(l.dir).toBe('ltr');
    }
  });

  it.each(Object.entries(locales))('locale "%s" matches all English translation keys with non-empty strings', (code, data) => {
    const flat = flattenKeys(data as unknown as Record<string, unknown>);
    // Languages differ in plural categories (Arabic has six), so compare keys without the plural suffix.
    const base = (k: string) => k.replace(/_(zero|one|two|few|many|other)$/, '');
    const keys = [...new Set(Object.keys(flat).map(base))].sort();
    expect(keys).toEqual([...new Set(enKeys.map(base))].sort());
    for (const key of Object.keys(flat)) {
      expect(flat[key].trim().length, `Empty string for ${code}.${key}`).toBeGreaterThan(0);
    }
  });
});
