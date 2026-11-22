/**
 * Lists every English string that goes through the content translator and
 * reports how much of it each language dictionary covers.
 *
 *   npx tsx scripts/extract-content.mts                 -> coverage report
 *   npx tsx scripts/extract-content.mts --json out.json -> also write the English list
 *   npx tsx scripts/extract-content.mts --missing es    -> print strings missing in a language
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectContentStrings, isTranslatable } from '../src/i18n/contentSource';
import { scanReferenceTables, scanTcLiterals } from './content-scan.mts';

const here = dirname(fileURLToPath(import.meta.url));

export function allContentStrings(): string[] {
  const groups = collectContentStrings();
  const all = new Set<string>();
  for (const list of Object.values(groups)) list.forEach((s) => all.add(s));
  scanTcLiterals().forEach((s) => all.add(s));
  scanReferenceTables().forEach((s) => all.add(s));
  return [...all].filter(isTranslatable);
}

const strings = allContentStrings();
console.log(`${strings.length} translatable content strings, ${strings.reduce((a, s) => a + s.length, 0)} chars`);

for (const lang of ['es', 'ar', 'hi', 'ml', 'ta']) {
  const dict = JSON.parse(readFileSync(resolve(here, `../src/i18n/content/${lang}.json`), 'utf8')) as Record<string, string>;
  const missing = strings.filter((s) => !dict[s]);
  const stale = Object.keys(dict).filter((k) => !strings.includes(k));
  console.log(
    `${lang}: ${strings.length - missing.length}/${strings.length} translated (${(
      ((strings.length - missing.length) / strings.length) *
      100
    ).toFixed(1)}%), ${stale.length} unused entries`
  );
  if (process.argv.includes('--missing') && process.argv[process.argv.indexOf('--missing') + 1] === lang) {
    missing.forEach((s) => console.log('  ' + s));
  }
}

const outIdx = process.argv.indexOf('--json');
if (outIdx !== -1) writeFileSync(process.argv[outIdx + 1], JSON.stringify(strings, null, 0));
