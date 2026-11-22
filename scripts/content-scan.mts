/**
 * Node-only helpers that find every English string passed through the content
 * translator `tc(...)`: string literals in components plus the small reference
 * tables (glossary, OSI explorer, ordering games, comparison aspects).
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), '../src');

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return name === 'tests' ? [] : walk(full);
    return /\.tsx?$/.test(name) ? [full] : [];
  });

const unescape = (s: string) => s.replace(/\\(['"\\])/g, '$1');

/** Literal arguments of tc('...') across the source tree. */
export function scanTcLiterals(): string[] {
  const found = new Set<string>();
  for (const file of walk(SRC)) {
    const text = readFileSync(file, 'utf8');
    for (const m of text.matchAll(/\btc\(\s*'((?:[^'\\\n]|\\.)*)'\s*\)/g)) found.add(unescape(m[1]));
    for (const m of text.matchAll(/\btc\(\s*"((?:[^"\\\n]|\\.)*)"\s*\)/g)) found.add(unescape(m[1]));
  }
  return [...found];
}

/** String fields of reference tables that are rendered through tc(variable). */
export function scanReferenceTables(): string[] {
  const found = new Set<string>();
  const grab = (rel: string, fields: string[]) => {
    const text = readFileSync(join(SRC, rel), 'utf8');
    for (const f of fields) {
      for (const m of text.matchAll(new RegExp(`\\b${f}:\\s*'((?:[^'\\\\\\n]|\\\\.)*)'`, 'g'))) {
        found.add(unescape(m[1]));
      }
    }
  };
  grab('components/learn/ToolsAndRefView.tsx', ['role', 'name', 'tcpip']);
  grab('lib/glossary.ts', ['def']);
  grab('components/learn/GamesView.tsx', ['title']);
  grab('protocols/index.ts', ['aspect']);
  return [...found];
}
