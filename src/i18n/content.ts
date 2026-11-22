import { useCallback, useEffect, useState } from 'react';
import i18n from './index';

/**
 * Content translation layer.
 *
 * The UI chrome is translated through i18next keys (en.json, es.json, ...).
 * The lesson content — protocol descriptions, steps, quizzes, labs, glossary —
 * lives in TypeScript data files written in English. Rather than restructuring
 * every data file, the English sentence itself is the lookup key into a
 * per-language dictionary (src/i18n/content/<lang>.json), loaded on demand.
 *
 * Anything missing from a dictionary falls back to English, so a new protocol
 * is never blank; src/tests/unit/content-i18n.test.ts reports coverage.
 */
export type ContentDict = Record<string, string>;

const loaders: Record<string, () => Promise<{ default: ContentDict }>> = {
  es: () => import('./content/es.json'),
  ar: () => import('./content/ar.json'),
  hi: () => import('./content/hi.json'),
  ml: () => import('./content/ml.json'),
  ta: () => import('./content/ta.json'),
};

const cache = new Map<string, ContentDict>();
const pending = new Map<string, Promise<void>>();
const listeners = new Set<() => void>();

export function loadContentLanguage(lang: string): Promise<void> {
  if (lang === 'en' || cache.has(lang) || !loaders[lang]) return Promise.resolve();
  let p = pending.get(lang);
  if (!p) {
    p = loaders[lang]()
      .then((mod) => {
        cache.set(lang, mod.default);
      })
      .catch(() => {
        cache.set(lang, {});
      })
      .then(() => {
        pending.delete(lang);
        listeners.forEach((fn) => fn());
      });
    pending.set(lang, p);
  }
  return p;
}

/** Test/SSR helper: install a dictionary synchronously. */
export function registerContentDict(lang: string, dict: ContentDict): void {
  cache.set(lang, dict);
  listeners.forEach((fn) => fn());
}

/** Translate one English content string into `lang` (falls back to English). */
export function translateContent(text: string, lang: string = i18n.language): string {
  if (!text || lang === 'en') return text;
  const dict = cache.get(lang);
  if (!dict) return text;
  return dict[text] ?? text;
}

/** Translate English content into the active language. Safe to call anywhere. */
export function tc(text: string): string {
  return translateContent(text, i18n.language);
}

/** Subscribe to dictionary loads (used by the store to trigger a re-render). */
export function onContentLoaded(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/**
 * Hook returning `tc(englishText)`. Re-renders when the language changes or
 * when that language's dictionary finishes loading.
 */
export function useContentT(): (text: string) => string {
  const [, bump] = useState(0);

  useEffect(() => {
    const rerender = () => bump((n) => n + 1);
    const onLang = (lng: string) => {
      void loadContentLanguage(lng);
      rerender();
    };
    listeners.add(rerender);
    i18n.on('languageChanged', onLang);
    void loadContentLanguage(i18n.language);
    return () => {
      listeners.delete(rerender);
      i18n.off('languageChanged', onLang);
    };
  }, []);

  const lang = i18n.language;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useCallback((text: string) => translateContent(text, lang), [lang, cache.get(lang)]);
}
