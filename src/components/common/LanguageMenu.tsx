import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, ChevronDown, Globe } from 'lucide-react';
import { LANGUAGES } from '../../i18n';
import { useAppStore } from '../../store/useAppStore';

/**
 * Compact language picker: a globe and the language code, opening a list where each language is
 * written in its own script. Replaces the browser's native select, which looked out of place.
 */
export const LanguageMenu: React.FC<{ showName?: boolean; className?: string }> = ({ showName = false, className = '' }) => {
  const { t } = useTranslation();
  const { language, setLanguage } = useAppStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = LANGUAGES.find((l) => l.code === language);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t('nav.selectLanguage')}
        title={t('nav.selectLanguage')}
        className={`flex h-9 items-center gap-1.5 rounded-full px-3 text-sm font-semibold transition-colors ${
          open
            ? 'bg-[var(--accent-primary-soft)] text-[var(--accent-primary)]'
            : 'text-[var(--text-secondary)] hover:bg-[var(--bg-inset)] hover:text-[var(--text-primary)]'
        }`}
      >
        <Globe className="h-4 w-4" aria-hidden="true" />
        <span className="uppercase tracking-wide">{showName ? current?.name ?? language : language}</span>
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>

      {open && (
        <ul
          role="listbox"
          aria-label={t('nav.selectLanguage')}
          className="absolute end-0 top-full z-50 mt-2 w-52 overflow-hidden rounded-2xl border border-[var(--border-strong)] bg-[var(--bg-surface)] p-1.5 shadow-2xl"
        >
          {LANGUAGES.map((l) => {
            const on = l.code === language;
            return (
              <li key={l.code} role="option" aria-selected={on}>
                <button
                  type="button"
                  lang={l.code}
                  onClick={() => {
                    setLanguage(l.code);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-start text-sm ${
                    on ? 'bg-[var(--accent-primary-soft)] font-semibold text-[var(--accent-primary)]' : 'text-[var(--text-primary)] hover:bg-[var(--bg-inset)]'
                  }`}
                >
                  <span>{l.name}</span>
                  {on ? <Check className="h-4 w-4" aria-hidden="true" /> : <span className="font-mono text-xs uppercase text-[var(--text-muted)]">{l.code}</span>}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
