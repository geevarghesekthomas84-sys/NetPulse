/**
 * Prints the "first-run" slice of content strings: what a new visitor sees
 * before choosing anything — all interface text, every protocol name, the five
 * starter protocols in full, lab titles and the first guided lab.
 *
 *   npx tsx scripts/content-priority.mts <english-list.json> <out.txt>
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { isTranslatable } from '../src/i18n/contentSource';
import { PROTOCOLS } from '../src/protocols';
import { PRESET_LABS } from '../src/simulator/labs';
import { scanReferenceTables, scanTcLiterals } from './content-scan.mts';

const STARTERS = ['http', 'dns', 'tcp', 'tls', 'dhcp'];
const all: string[] = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const index = new Map(all.map((s, i) => [s, i]));
const picked = new Set<number>();
const add = (s?: string) => {
  if (s && isTranslatable(s) && index.has(s)) picked.add(index.get(s)!);
};

for (const p of PROTOCOLS) {
  add(p.fullName);
  if (!STARTERS.includes(p.id)) continue;
  [p.layer, p.transport, p.dataFormat, p.description, p.eli5].forEach(add);
  p.steps.forEach((s) => [s.title, s.subtitle, s.caption].forEach(add));
  p.securityNotes.forEach((n) => [n.attack, n.description, n.defense].forEach(add));
  p.whatIfOptions.forEach((w) => [w.label, w.description].forEach(add));
  p.nodes.forEach((n) => add(n.label));
  p.links.forEach((l) => add(l.label));
}
PRESET_LABS.forEach((lab, i) => {
  add(lab.title);
  add(lab.category);
  if (i === 0) [lab.description, lab.solutionSummary, ...lab.goals, ...lab.hints].forEach(add);
});
scanTcLiterals().forEach(add);
scanReferenceTables().forEach(add);

const sorted = [...picked].sort((a, b) => a - b);
writeFileSync(process.argv[3], sorted.map((i) => `${i}|${all[i]}`).join('\n'));
console.log(`${sorted.length} strings, ${sorted.reduce((a, i) => a + all[i].length, 0)} chars`);
