const FAMILIES: Record<string, string> = {
  ar: 'Noto+Sans+Arabic',
  hi: 'Noto+Sans+Devanagari',
  ml: 'Noto+Sans+Malayalam',
  ta: 'Noto+Sans+Tamil',
};

/** Loads the Noto font a language needs only when it is chosen, instead of blocking every first paint. */
export function loadScriptFont(lang: string): void {
  const family = FAMILIES[lang];
  if (!family || typeof document === 'undefined') return;
  const id = `font-${lang}`;
  if (document.getElementById(id)) return;
  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${family}:wght@400;500;600;700&display=swap`;
  document.head.appendChild(link);
}
