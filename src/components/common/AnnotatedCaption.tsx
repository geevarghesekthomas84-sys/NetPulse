import React, { useState } from 'react';
import { BookOpen, Layers } from 'lucide-react';
import { type GlossaryEntry, parseGlossaryTokens } from '../../lib/glossary';

interface AnnotatedCaptionProps {
  text: string;
  className?: string;
}

export const AnnotatedCaption: React.FC<AnnotatedCaptionProps> = ({ text, className = '' }) => {
  const [activeEntry, setActiveEntry] = useState<{
    entry: GlossaryEntry;
    x: number;
    y: number;
  } | null>(null);

  const tokens = parseGlossaryTokens(text);

  if (tokens.length === 0) {
    return <span className={className}>{text}</span>;
  }

  return (
    <span className={`relative inline ${className}`}>
      {tokens.map((token, i) => {
        if (!token.isTerm || !token.entry) {
          return <React.Fragment key={i}>{token.text}</React.Fragment>;
        }

        const entry = token.entry;
        return (
          <span
            key={i}
            onMouseEnter={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              setActiveEntry({
                entry,
                x: rect.left + rect.width / 2,
                y: rect.top,
              });
            }}
            onMouseLeave={() => setActiveEntry(null)}
            className="cursor-help font-semibold text-[var(--accent-primary)] border-b border-dotted border-[var(--accent-primary)]/70 hover:border-solid hover:bg-[var(--accent-primary-soft)] rounded-xs px-0.5 transition-colors"
          >
            {token.text}
          </span>
        );
      })}

      {activeEntry && (
        <div
          role="tooltip"
          className="fixed z-50 w-72 -translate-x-1/2 -translate-y-full -mt-2 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)] p-3 text-start shadow-xl backdrop-blur-md animate-in fade-in duration-150 pointer-events-none"
          style={{
            left: `${Math.max(150, Math.min(window.innerWidth - 150, activeEntry.x))}px`,
            top: `${activeEntry.y}px`,
          }}
        >
          <div className="flex items-center justify-between border-b border-[var(--border-hairline)] pb-1.5 mb-1.5">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="font-mono font-bold text-xs text-[var(--accent-primary)]">
                {activeEntry.entry.term}
              </span>
              <span className="font-display text-xs font-semibold text-[var(--text-primary)] truncate">
                {activeEntry.entry.fullName}
              </span>
            </div>
            {activeEntry.entry.layer && (
              <span className="shrink-0 text-[10px] font-mono font-semibold px-1.5 py-0.2 rounded bg-[var(--bg-inset)] text-[var(--text-muted)]">
                L{activeEntry.entry.layer}
              </span>
            )}
          </div>
          <p className="text-xs leading-relaxed text-[var(--text-secondary)]">
            {activeEntry.entry.definition}
          </p>
          {activeEntry.entry.rfc && (
            <div className="mt-2 text-[10px] font-mono text-[var(--text-muted)]">
              Standard: {activeEntry.entry.rfc}
            </div>
          )}
        </div>
      )}
    </span>
  );
};
