import { describe, expect, it } from 'vitest';
import { scanReferenceTables, scanTcLiterals } from '../../../scripts/content-scan.mts';
import ar from '../../i18n/content/ar.json';
import es from '../../i18n/content/es.json';
import hi from '../../i18n/content/hi.json';
import ml from '../../i18n/content/ml.json';
import ta from '../../i18n/content/ta.json';
import { registerContentDict, tc, translateContent } from '../../i18n/content';
import { collectContentStrings, isTranslatable } from '../../i18n/contentSource';
import i18n from '../../i18n';
import { PROTOCOLS } from '../../protocols';

const dicts: Record<string, Record<string, string>> = { es, ar, hi, ml, ta };

const allStrings = (): string[] => {
  const set = new Set<string>();
  Object.values(collectContentStrings()).forEach((list) => list.forEach((s) => set.add(s)));
  scanTcLiterals().forEach((s) => set.add(s));
  scanReferenceTables().forEach((s) => set.add(s));
  return [...set].filter(isTranslatable);
};

/** What a first-time visitor sees before choosing anything. */
const firstRunStrings = (): string[] => {
  const starters = ['http', 'dns', 'tcp', 'tls', 'dhcp'];
  const set = new Set<string>();
  const add = (s?: string) => {
    if (s && isTranslatable(s)) set.add(s);
  };
  for (const p of PROTOCOLS) {
    add(p.fullName);
    if (!starters.includes(p.id)) continue;
    [p.description, p.eli5].forEach(add);
    p.steps.forEach((s) => [s.title, s.subtitle, s.caption].forEach(add));
    p.whatIfOptions.forEach((w) => [w.label, w.description].forEach(add));
    p.securityNotes.forEach((n) => [n.attack, n.description, n.defense].forEach(add));
    p.nodes.forEach((n) => add(n.label));
  }
  scanTcLiterals().forEach(add);
  return [...set];
};

describe('lesson-content dictionaries', () => {
  const strings = allStrings();

  it.each(Object.keys(dicts))('"%s" has no stale or empty entries', (lang) => {
    const known = new Set(strings);
    for (const [key, value] of Object.entries(dicts[lang])) {
      expect(known.has(key), `${lang}: "${key.slice(0, 60)}" is no longer used`).toBe(true);
      expect(value.trim().length).toBeGreaterThan(0);
    }
  });

  it.each(Object.keys(dicts))('"%s" keeps IP addresses and `commands` intact', (lang) => {
    for (const [key, value] of Object.entries(dicts[lang])) {
      for (const token of key.match(/`[^`]+`|\b\d{1,3}(?:\.\d{1,3}){3}(?:\/\d+)?\b/g) ?? []) {
        expect(value, `${lang}: lost "${token}"`).toContain(token);
      }
    }
  });

  it.each(Object.keys(dicts))('"%s" fully covers the first-run experience', (lang) => {
    const missing = firstRunStrings().filter((s) => !dicts[lang][s]);
    expect(missing).toEqual([]);
  });

  it('reports overall coverage per language', () => {
    for (const lang of Object.keys(dicts)) {
      const done = strings.filter((s) => dicts[lang][s]).length;
      // eslint-disable-next-line no-console
      console.log(`content coverage ${lang}: ${done}/${strings.length} (${((done / strings.length) * 100).toFixed(1)}%)`);
      expect(done).toBeGreaterThan(0);
    }
  });
});

describe('content translator', () => {
  it('returns English untouched, translates known strings, and falls back for unknown ones', async () => {
    expect(translateContent('Hypertext Transfer Protocol', 'en')).toBe('Hypertext Transfer Protocol');

    registerContentDict('es', es);
    expect(translateContent('Hypertext Transfer Protocol', 'es')).toBe(es['Hypertext Transfer Protocol']);
    expect(translateContent('A string nobody translated yet', 'es')).toBe('A string nobody translated yet');

    await i18n.changeLanguage('es');
    expect(tc('Client')).toBe('Cliente');
    await i18n.changeLanguage('en');
    expect(tc('Client')).toBe('Client');
  });
});
