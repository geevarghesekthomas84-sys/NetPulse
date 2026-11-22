/**
 * One-time move of saved settings from the old "gg-" keys to "netpulse-".
 * Imported for its side effect before anything reads localStorage, so nobody loses their
 * theme, language, favourites, streak or progress when the product was renamed.
 */
export function migrateLegacyStorage(): void {
  try {
    if (typeof localStorage === 'undefined') return;
    const legacy: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('gg-')) legacy.push(k);
    }
    for (const oldKey of legacy) {
      const newKey = `netpulse-${oldKey.slice(3)}`;
      if (localStorage.getItem(newKey) === null) {
        const value = localStorage.getItem(oldKey);
        if (value !== null) localStorage.setItem(newKey, value);
      }
      localStorage.removeItem(oldKey);
    }
  } catch {
    // Storage can be blocked (private windows); the app works without it.
  }
}

migrateLegacyStorage();
