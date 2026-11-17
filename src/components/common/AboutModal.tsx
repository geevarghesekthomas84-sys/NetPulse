import React from 'react';
import { useTranslation } from 'react-i18next';
import { ExternalLink, X } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';

export const AboutModal: React.FC = () => {
  const { t } = useTranslation();
  const { aboutOpen, setAboutOpen } = useAppStore();
  if (!aboutOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div
        role="dialog"
        aria-label={t('modals.aboutTitle')}
        className="w-full max-w-md rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)] shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-[var(--border-hairline)] px-5 py-3.5">
          <h2 className="font-display text-base font-bold text-[var(--text-primary)]">{t('modals.aboutTitle')}</h2>
          <button
            type="button"
            onClick={() => setAboutOpen(false)}
            aria-label={t('common.close')}
            className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-3 text-sm text-[var(--text-secondary)] leading-relaxed">
          <p>
            <strong className="text-[var(--text-primary)]">{t('brand')}</strong> is an interactive network protocol visualizer
            and discrete-event network simulator that runs 100% inside your browser.
          </p>
          <p>
            <strong className="text-[var(--text-primary)]">{t('credit')}</strong>. Built with React,
            TypeScript, Zustand, Tailwind CSS, and a pure-TypeScript simulation kernel supporting real RFC 1071 checksums,
            TCP Reno/CUBIC congestion control, L2 MAC learning, LPM routing, and libpcap export.
          </p>
          <div className="rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-inset)] p-3 text-xs">
            <div className="font-semibold text-[var(--text-primary)]">{t('nav.aboutPrivacy')}</div>
            <p className="mt-1">
              {t('nav.footerTagline')} · All topologies and progress stay strictly in your browser’s localStorage. Licensed under Apache-2.0.
            </p>
          </div>
          <div className="flex items-center justify-between gap-4 pt-2 text-xs">
            <div className="flex items-center gap-3">
              <a
                href="https://github.com/geevarghesekthomas84-sys/NetPulse"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[var(--accent-primary)] hover:underline"
              >
                GitHub <ExternalLink className="w-3.5 h-3.5" />
              </a>
              <span className="text-[var(--text-muted)]">·</span>
              <a
                href="https://github.com/geevarghesekthomas84-sys/NetPulse/issues"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[var(--accent-primary)] hover:underline"
              >
                Report an issue <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
            <button
              type="button"
              onClick={() => setAboutOpen(false)}
              className="rounded-lg bg-[var(--accent-cta)] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[var(--accent-cta-hover)]"
            >
              {t('common.close')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
