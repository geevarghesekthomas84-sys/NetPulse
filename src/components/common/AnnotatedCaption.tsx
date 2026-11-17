import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { type GlossaryEntry, parseGlossaryTokens } from '../../lib/glossary';

interface AnnotatedCaptionProps {
  text: string;
  className?: string;
}

interface ActiveTooltip {
  entry: GlossaryEntry;
  targetRect: DOMRect;
  pinned: boolean;
}

export const AnnotatedCaption: React.FC<AnnotatedCaptionProps> = ({ text, className = '' }) => {
  const [activeTooltip, setActiveTooltip] = useState<ActiveTooltip | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const activeTriggerRef = useRef<HTMLButtonElement | null>(null);

  const tokens = parseGlossaryTokens(text);

  // Close when clicking outside or pressing Escape
  useEffect(() => {
    if (!activeTooltip) return;

    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (
        tooltipRef.current &&
        !tooltipRef.current.contains(target) &&
        activeTriggerRef.current &&
        !activeTriggerRef.current.contains(target)
      ) {
        setActiveTooltip(null);
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActiveTooltip(null);
      }
    };

    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [activeTooltip]);

  if (tokens.length === 0) {
    return <span className={className}>{text}</span>;
  }

  // Calculate coordinates if tooltip is active
  let tooltipNode: React.ReactNode = null;
  if (activeTooltip && typeof document !== 'undefined') {
    const tooltipWidth = 320;
    const spaceAbove = activeTooltip.targetRect.top;
    // If less than 190px above, show below the term
    const showBelow = spaceAbove < 190;
    const top = showBelow
      ? activeTooltip.targetRect.bottom + 8
      : activeTooltip.targetRect.top - 8;

    const centerX = activeTooltip.targetRect.left + activeTooltip.targetRect.width / 2;
    const left = Math.max(16, Math.min(window.innerWidth - tooltipWidth - 16, centerX - tooltipWidth / 2));
    const arrowLeft = Math.max(16, Math.min(tooltipWidth - 24, centerX - left - 5));

    tooltipNode = createPortal(
      <div
        ref={tooltipRef}
        role="tooltip"
        className={`fixed z-[9999] w-80 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)] p-3.5 text-start shadow-2xl animate-in fade-in zoom-in-95 duration-150 select-text ${
          showBelow ? '' : '-translate-y-full'
        }`}
        style={{
          top: `${Math.max(8, top)}px`,
          left: `${left}px`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Subtle arrow pointer */}
        <div
          className={`absolute w-2.5 h-2.5 bg-[var(--bg-surface)] border-[var(--border-strong)] rotate-45 ${
            showBelow ? '-top-1.5 border-t border-l' : '-bottom-1.5 border-b border-r'
          }`}
          style={{ left: `${arrowLeft}px` }}
        />

        <div className="flex items-center justify-between border-b border-[var(--border-hairline)] pb-2 mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-mono font-bold text-xs px-1.5 py-0.5 rounded bg-[var(--accent-primary-soft)] text-[var(--accent-primary)] border border-[var(--accent-primary)]/30">
              {activeTooltip.entry.term}
            </span>
            <span className="font-display text-xs font-bold text-[var(--text-primary)] truncate">
              {activeTooltip.entry.fullName}
            </span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {activeTooltip.entry.layer && (
              <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-[var(--bg-inset)] text-[var(--text-secondary)] border border-[var(--border-hairline)]">
                L{activeTooltip.entry.layer}
              </span>
            )}
            <button
              type="button"
              onClick={() => setActiveTooltip(null)}
              aria-label="Close tooltip"
              className="text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded p-0.5 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <p className="text-xs leading-relaxed text-[var(--text-secondary)]">
          {activeTooltip.entry.definition}
        </p>

        {activeTooltip.entry.rfc && (
          <div className="mt-2.5 flex items-center justify-between pt-1.5 border-t border-[var(--border-hairline)] text-[10.5px] font-mono text-[var(--text-muted)]">
            <span>
              Standard: <strong className="text-[var(--text-secondary)]">{activeTooltip.entry.rfc}</strong>
            </span>
          </div>
        )}
      </div>,
      document.body
    );
  }

  return (
    <span className={`relative inline ${className}`}>
      {tokens.map((token, i) => {
        if (!token.isTerm || !token.entry) {
          return <React.Fragment key={i}>{token.text}</React.Fragment>;
        }

        const entry = token.entry;
        const isCurrentActive = activeTooltip?.entry.term === entry.term;

        return (
          <button
            key={i}
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const rect = e.currentTarget.getBoundingClientRect();
              activeTriggerRef.current = e.currentTarget;
              setActiveTooltip((prev) => {
                if (prev && prev.entry.term === entry.term && prev.pinned) {
                  return null;
                }
                return { entry, targetRect: rect, pinned: true };
              });
            }}
            onMouseEnter={(e) => {
              if (activeTooltip?.pinned) return;
              const rect = e.currentTarget.getBoundingClientRect();
              activeTriggerRef.current = e.currentTarget;
              setActiveTooltip({ entry, targetRect: rect, pinned: false });
            }}
            onMouseLeave={() => {
              setActiveTooltip((prev) => (prev?.pinned ? prev : null));
            }}
            aria-label={`${entry.term} (${entry.fullName}) definition`}
            className={`cursor-pointer inline-flex items-baseline font-semibold text-[var(--accent-primary)] border-b-2 border-dotted border-[var(--accent-primary)]/70 hover:border-solid hover:bg-[var(--accent-primary-soft)] rounded-xs px-0.5 transition-colors focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)] ${
              isCurrentActive ? 'bg-[var(--accent-primary-soft)] border-solid' : ''
            }`}
          >
            {token.text}
          </button>
        );
      })}

      {tooltipNode}
    </span>
  );
};
