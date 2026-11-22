import React from 'react';
import { tc } from '../../i18n/content';
import { GLOSS_TOKENS } from '../../lib/glossary';

const TOKEN_RE = new RegExp(`\\b(${Object.keys(GLOSS_TOKENS).join('|')})\\b`, 'g');

/**
 * Renders text and turns known networking terms (TTL, SYN, MTU, ...) into
 * hoverable / focusable chips that explain themselves in the current language.
 */
export const Gloss: React.FC<{ text: string }> = ({ text }) => {
  const parts: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  TOKEN_RE.lastIndex = 0;
  while ((m = TOKEN_RE.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const entry = GLOSS_TOKENS[m[1]];
    parts.push(
      <span key={`${m.index}-${m[1]}`} className="relative group inline-block">
        <span
          tabIndex={0}
          className="cursor-help border-b border-dotted border-[var(--accent-primary)] text-inherit focus-visible:outline-2 focus-visible:outline-[var(--accent-primary)]"
        >
          {m[1]}
        </span>
        <span
          role="tooltip"
          className="pointer-events-none absolute start-0 top-full z-50 mt-1 hidden w-64 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-2.5 text-xs font-normal leading-snug text-[var(--text-primary)] shadow-[var(--shadow-card)] group-hover:block group-focus-within:block"
        >
          <span className="block font-semibold text-[var(--accent-primary)]">{entry.term}</span>
          {tc(entry.def)}
        </span>
      </span>
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
};
