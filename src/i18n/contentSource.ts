import { PROTOCOLS } from '../protocols';
import { CHALLENGES } from '../simulator/challenges';
import { PRESET_LABS } from '../simulator/labs';

/**
 * A string is worth translating when it contains at least one ordinary word
 * (a letter followed by two lowercase letters). Pure technical literals — "TCP",
 * "RFC 9110", "8.8.8.8", "GET / HTTP/1.1" — are the same in every language.
 */
export function isTranslatable(s: string): boolean {
  return /[A-Za-z][a-z]{2}/.test(s);
}

/**
 * Collects every learner-facing English content string that lives in data files
 * (protocol library and guided labs) rather than in the UI locale JSON.
 * The English text itself is the lookup key in the content dictionaries.
 */
export function collectContentStrings(): Record<string, string[]> {
  const groups: Record<string, Set<string>> = {
    protoMeta: new Set(),
    protoSteps: new Set(),
    protoSecurity: new Set(),
    protoWhatIf: new Set(),
    protoQuiz: new Set(),
    protoNodes: new Set(),
    labs: new Set(),
    challenges: new Set(),
  };
  const add = (g: string, s?: string) => {
    if (s && isTranslatable(s)) groups[g].add(s);
  };

  for (const p of PROTOCOLS) {
    add('protoMeta', p.fullName);
    add('protoMeta', p.layer);
    add('protoMeta', p.transport);
    add('protoMeta', p.dataFormat);
    add('protoMeta', p.description);
    add('protoMeta', p.eli5);
    for (const s of p.steps) {
      add('protoSteps', s.title);
      add('protoSteps', s.subtitle);
      add('protoSteps', s.caption);
    }
    for (const n of p.securityNotes) {
      add('protoSecurity', n.attack);
      add('protoSecurity', n.description);
      add('protoSecurity', n.defense);
    }
    for (const w of p.whatIfOptions) {
      add('protoWhatIf', w.label);
      add('protoWhatIf', w.description);
    }
    for (const q of p.quiz) {
      add('protoQuiz', q.question);
      add('protoQuiz', q.explanation);
      for (const o of q.options) add('protoQuiz', o);
    }
    for (const n of p.nodes) add('protoNodes', n.label);
    for (const l of p.links) add('protoNodes', l.label);
  }

  for (const lab of PRESET_LABS) {
    add('labs', lab.title);
    add('labs', lab.category);
    add('labs', lab.description);
    add('labs', lab.solutionSummary);
    for (const g of lab.goals) add('labs', g);
    for (const h of lab.hints) add('labs', h);
  }

  for (const c of CHALLENGES) {
    add('challenges', c.title);
    add('challenges', c.symptom);
    add('challenges', c.fixLabel);
    add('challenges', c.lesson);
    for (const o of c.options) add('challenges', o.text);
    for (const h of c.hints) add('challenges', h);
  }

  return Object.fromEntries(Object.entries(groups).map(([k, v]) => [k, [...v]]));
}
