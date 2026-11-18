import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ArrowRight, Compass, Sparkles, X } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';

export const OnboardingTour: React.FC = () => {
  const { t } = useTranslation();
  const { tourOpen, setTourOpen, mode } = useAppStore();
  const [step, setStep] = useState(0);

  if (!tourOpen) return null;

  const simSteps = [
    {
      title: '1. Select a Guided Lab or Template',
      body: 'Browse 23 hands-on networking scenarios covering DHCP leasing, VLAN trunking, multi-hop OSPF, and broken network diagnostics.',
      badge: 'Scenario Context',
    },
    {
      title: '2. Run or Step Simulation',
      body: 'Press Run (or Space) to start virtual time and watch packet traffic flow. Switch to Step-by-Step mode to analyze protocol handshakes event-by-event.',
      badge: 'Transport Deck',
    },
    {
      title: '3. Inspect Packets & Capture',
      body: 'Click any packet on the wire or in the Capture table below to dissect L2 Ethernet, L3 IPv4/IPv6, L4 TCP/UDP, and application payloads.',
      badge: 'Wireshark Deck',
    },
    {
      title: '4. Simple vs Pro Workspace',
      body: 'Stay in Simple mode for focused guided learning, or toggle to Pro anytime to unlock Cisco Packet Tracer CLI, hardware cabling, and link fault injection.',
      badge: 'Mode Switcher',
    },
  ];

  const generalSteps = [
    { title: t('modals.tour1Title'), body: t('modals.tour1Body'), badge: 'Protocols' },
    { title: t('modals.tour2Title'), body: t('modals.tour2Body'), badge: 'Workspaces' },
    { title: t('modals.tour3Title'), body: t('modals.tour3Body'), badge: 'Deep Inspection' },
    { title: t('modals.tour4Title'), body: t('modals.tour4Body'), badge: 'Simulation' },
  ];

  const steps = mode === 'simulator' ? simSteps : generalSteps;
  const current = steps[Math.min(step, steps.length - 1)];

  const handleClose = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('netpulse-sim-tour-dismissed', 'true');
    }
    setStep(0);
    setTourOpen(false);
  };

  return (
    <div
      role="dialog"
      aria-label={t('modals.tourTitle')}
      className="fixed bottom-16 sm:bottom-6 end-4 sm:end-6 z-50 w-[92vw] sm:w-96 rounded-2xl border border-[var(--border-strong)] bg-[var(--bg-surface)] p-4 shadow-2xl backdrop-blur-md animate-in slide-in-from-bottom-3"
    >
      <div className="flex items-center justify-between gap-2 pb-2 border-b border-[var(--border-hairline)]">
        <div className="flex items-center gap-1.5 text-[11px] font-mono font-bold uppercase text-[var(--accent-teal)]">
          <Compass className="w-3.5 h-3.5" />
          <span>{current.badge}</span>
          <span className="text-[var(--text-muted)]">·</span>
          <span>{step + 1}/{steps.length}</span>
        </div>
        <button
          type="button"
          onClick={handleClose}
          aria-label={t('common.close')}
          className="rounded-md p-1 text-[var(--text-muted)] hover:bg-[var(--bg-inset)] hover:text-[var(--text-primary)] transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="pt-2.5">
        <h4 className="font-display text-sm font-bold text-[var(--text-primary)] flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
          <span>{current.title}</span>
        </h4>
        <p className="mt-1 text-xs leading-relaxed text-[var(--text-secondary)]">{current.body}</p>
      </div>

      {/* Progress Dots & Navigation */}
      <div className="mt-3.5 pt-2 border-t border-[var(--border-hairline)] flex items-center justify-between">
        <div className="flex items-center gap-1">
          {steps.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i === step ? 'w-4 bg-[var(--accent-primary)]' : 'w-1.5 bg-[var(--border-strong)]'
              }`}
            />
          ))}
        </div>

        <div className="flex items-center gap-2">
          {step > 0 ? (
            <button
              type="button"
              onClick={() => setStep(step - 1)}
              className="flex h-7 items-center gap-1 rounded-lg border border-[var(--border-hairline)] px-2.5 text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            >
              <ArrowLeft className="w-3 h-3" />
              <span>Back</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleClose}
              className="text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] px-2 py-1"
            >
              {t('common.skip')}
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              if (step < steps.length - 1) {
                setStep(step + 1);
              } else {
                handleClose();
              }
            }}
            className="flex h-7 items-center gap-1 rounded-lg bg-[var(--accent-cta)] hover:bg-[var(--accent-cta-hover)] px-3 text-xs font-bold text-white transition-colors shadow-xs"
          >
            {step < steps.length - 1 ? (
              <>
                <span>{t('common.next')}</span>
                <ArrowRight className="w-3 h-3" />
              </>
            ) : (
              <span>{t('common.finish')}</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
