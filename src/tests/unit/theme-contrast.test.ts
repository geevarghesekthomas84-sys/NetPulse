import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Guards the promise that text stays readable in every theme: each text token
 * must reach WCAG AA (4.5:1) on each surface token, in both light and dark.
 */
const css = readFileSync(resolve(__dirname, '../../index.css'), 'utf8');

const parseBlock = (selector: string): Record<string, string> => {
  const start = css.indexOf(`${selector} {`);
  const end = css.indexOf('\n}', start);
  const tokens: Record<string, string> = {};
  for (const m of css.slice(start, end).matchAll(/(--[\w-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) {
    tokens[m[1]] = m[2];
  }
  return tokens;
};

const luminance = (hex: string): number => {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const contrast = (a: string, b: string): number => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

const SURFACES = ['--bg-canvas', '--bg-surface', '--bg-elevated', '--bg-inset'];
const TEXT = [
  '--text-primary',
  '--text-secondary',
  '--text-muted',
  '--accent-primary',
  '--accent-teal',
  '--tone-info',
  '--tone-success',
  '--tone-warning',
  '--tone-danger',
];
const FILLED: Array<[string, string]> = [
  ['--on-accent', '--accent-cta'],
  ['--on-accent', '--accent-cta-hover'],
  ['--on-teal', '--accent-teal'],
  ['--terminal-text', '--terminal-bg'],
  ['--terminal-muted', '--terminal-bg'],
  ['--terminal-cmd', '--terminal-bg'],
  ['--terminal-text', '--terminal-header'],
];

describe.each([
  ['light', ':root'],
  ['dark', '.dark'],
])('%s theme keeps all text readable (WCAG AA)', (_name, selector) => {
  const tokens = parseBlock(selector);

  it('defines every color token used for text and surfaces', () => {
    for (const key of [...SURFACES, ...TEXT, ...FILLED.flat()]) {
      expect(tokens[key], `${selector} is missing ${key}`).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });

  it.each(TEXT.flatMap((t) => SURFACES.map((s) => [t, s] as const)))('%s on %s >= 4.5:1', (text, surface) => {
    expect(contrast(tokens[text], tokens[surface])).toBeGreaterThanOrEqual(4.5);
  });

  it.each(FILLED)('%s on %s >= 4.5:1', (text, fill) => {
    expect(contrast(tokens[text], tokens[fill])).toBeGreaterThanOrEqual(4.5);
  });
});

describe('light and dark themes define the same token set', () => {
  it('has no token present in one theme but missing in the other', () => {
    const all = (sel: string) => {
      const start = css.indexOf(`${sel} {`);
      return [...css.slice(start, css.indexOf('\n}', start)).matchAll(/(--[\w-]+):/g)].map((m) => m[1]).sort();
    };
    expect(all('.dark')).toEqual(all(':root'));
  });
});

/** Packet colors: shapes need 3:1 (WCAG non-text), labels need 4.5:1 on every surface. */
describe.each([
  ['light', ':root'],
  ['dark', '.dark'],
])('%s theme packet colors', (_name, selector) => {
  const tokens = parseBlock(selector);
  const cats = ['dns', 'tcp', 'tls', 'http-req', 'http-res', 'udp', 'icmp', 'error', 'l2', 'sec', 'routing'];

  it.each(cats)('%s is defined and readable', (cat) => {
    const shape = tokens[`--pkt-${cat}`];
    const text = tokens[`--pkt-${cat}-text`];
    expect(shape, `${selector} --pkt-${cat}`).toMatch(/^#[0-9a-fA-F]{6}$/);
    expect(text, `${selector} --pkt-${cat}-text`).toMatch(/^#[0-9a-fA-F]{6}$/);
    for (const s of ['--bg-canvas', '--bg-surface']) {
      expect(contrast(shape, tokens[s]), `${cat} shape on ${s}`).toBeGreaterThanOrEqual(3);
    }
    for (const s of SURFACES) {
      expect(contrast(text, tokens[s]), `${cat} text on ${s}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('keeps the eleven categories visually distinct', () => {
    const values = cats.map((c) => tokens[`--pkt-${c}`].toLowerCase());
    expect(new Set(values).size).toBe(cats.length);
  });
});
