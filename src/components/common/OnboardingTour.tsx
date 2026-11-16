import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight, X } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';

export const OnboardingTour: React.FC = () => {
  const { t } = useTranslation();
  const { tourOpen, setTourOpen } = useAppStore();
  const [step, setStep] = useState(0);

  if (!tourOpen) return null;

  const steps = [
    { title: t('modals.tour1Title'), body: t('modals.tour1Body') },
    { title: t('modals.tour2Title'), body: t('modals.tour2Body') },
    { title: t('modals.tour3Title'), body: t('modals.tour3Body') },
    { title: t('modals.tour4Title'), body: t('modals.tour4Body') },
  ];

  const current = steps[step];

  return (
    <div className="fixed bottom-5 end-5 z-50 w-full max-w-sm rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)] p-4 shadow-2xl">
      <div className="flex items-start justify-between gap-2">
        <span className="text-[11px] font-mono font-semibold uppercase text-[var(--accent-teal)]">
          {t('modals.tourTitle')} · {step + 1}/{steps.length}
        </span>
        <button
          type="button"
          onClick={() => setTourOpen(false)}
          aria-label={t('common.close')}
          className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      <h4 className="mt-1.5 font-display text-sm font-bold text-[var(--text-primary)]">{current.title}</h4>
      <p className="mt-1 text-xs leading-relaxed text-[var(--text-secondary)]">{current.body}</p>
      <div className="mt-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setTourOpen(false)}
          className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)]"
        >
          {t('common.skip')}
        </button>
        <button
          type="button"
          onClick={() => {
            if (step < steps.length - 1) setStep(step + 1);
            else {
              setStep(0);
              setTourOpen(false);
            }
          }}
          className="inline-flex items-center gap-1 rounded-lg bg-[var(--accent-cta)] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[var(--accent-cta-hover)]"
        >
          {step < steps.length - 1 ? (
            <>
              {t('common.next')} <ArrowRight className="w-3.5 h-3.5" />
            </>
          ) : (
            t('common.finish')
          )}
        </button>
      </div>
    </div>
  );
};
