import React, { useState } from 'react';
import {
  ArrowDown,
  ArrowRight,
  BookOpen,
  Compass,
  Cpu,
  Layers,
  Network,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import heroStudioImg from '../../assets/images/network_hero_studio_1794850716473.jpg';
import packetBlueprintImg from '../../assets/images/packet_inspection_blueprint_1794851200225.jpg';
import simulatorRackImg from '../../assets/images/simulator_topology_rack_1794851199538.jpg';
import { getProtocolById } from '../../protocols';
import type { ProtocolEntry } from '../../protocols/types';

const STARTER_PROTOCOLS = ['http', 'dns', 'tcp', 'tls', 'dhcp'] as const;
const PATHWAY_PROTOCOLS = ['tcp', 'dns', 'http', 'tls', 'bgp', 'wireguard'] as const;

interface EntrySiteProps {
  activeProtocolId: string;
  activeProtocol: ProtocolEntry;
  isSimple: boolean;
  onSelectProtocol: (id: string) => void;
  onJumpToWorkbench: (id?: string) => void;
  onSwitchToPro: () => void;
  onOpenSimulator: () => void;
  onOpenLearn: () => void;
  onDismiss: () => void;
}

export const EntrySite: React.FC<EntrySiteProps> = ({
  activeProtocolId,
  activeProtocol,
  isSimple,
  onSelectProtocol,
  onJumpToWorkbench,
  onSwitchToPro,
  onOpenSimulator,
  onOpenLearn,
  onDismiss,
}) => {
  const { t } = useTranslation();
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});

  const markFailed = (key: string) => {
    setFailedImages((prev) => ({ ...prev, [key]: true }));
  };

  const stripSteps = [
    {
      num: '01.',
      title: t('welcome.step1Title').replace(/^\d+\.\s*/, ''),
      metric: t('welcome.protocolsCount'),
      body: t('welcome.step1Body'),
    },
    {
      num: '02.',
      title: t('welcome.step2Title').replace(/^\d+\.\s*/, ''),
      metric: t('welcome.osiCount'),
      body: t('welcome.step2Body'),
    },
    {
      num: '03.',
      title: t('welcome.step3Title').replace(/^\d+\.\s*/, ''),
      metric: t('welcome.languagesCount'),
      body: t('welcome.step3Body'),
    },
    {
      num: '04.',
      title: t('welcome.step4Title').replace(/^\d+\.\s*/, ''),
      metric: t('welcome.labsCount'),
      body: t('welcome.step4Body'),
    },
  ];

  return (
    <div className="shrink-0 bg-[var(--bg-canvas)] border-b border-[var(--border-hairline)]">
      {/* Section 1: Architectural Hero Viewport + Full-Width 4-Column Workflow Strip */}
      <section
        aria-label={t('welcome.badge')}
        className="border-b border-[var(--border-hairline)] bg-[var(--bg-surface)]"
      >
        <div className="mx-auto flex max-w-[1440px] flex-col justify-between gap-8 px-4 pt-6 pb-8 sm:px-8 lg:min-h-[calc(100dvh-108px)] lg:pt-10 lg:pb-10">
          {/* Top Metadata & Dismissal Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2.5 text-xs font-mono text-[var(--text-muted)] tabular-nums">
              <span className="font-semibold text-[var(--accent-teal)]">{t('welcome.badge')}</span>
              <span aria-hidden="true">·</span>
              <span>{t('welcome.protocolsCount')}</span>
              <span aria-hidden="true">·</span>
              <span>{t('welcome.labsCount')}</span>
              <span aria-hidden="true" className="hidden sm:inline">
                ·
              </span>
              <span className="hidden sm:inline">{t('welcome.osiCount')}</span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {isSimple && (
                <button
                  type="button"
                  onClick={onSwitchToPro}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-inset)] px-3 py-1.5 text-xs font-medium text-[var(--accent-primary)] hover:border-[var(--accent-primary)] transition-colors whitespace-nowrap shrink-0"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{t('welcome.switchToPro')}</span>
                </button>
              )}
              <button
                type="button"
                onClick={onDismiss}
                aria-label={t('welcome.dismiss')}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-inset)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)] transition-colors whitespace-nowrap shrink-0"
              >
                <X className="w-3.5 h-3.5" />
                <span>{t('welcome.dismiss')}</span>
              </button>
            </div>
          </div>

          {/* Monumental 12-Column Editorial Split */}
          <div className="grid flex-1 gap-8 lg:grid-cols-12 lg:items-stretch lg:gap-12">
            {/* Left Proposition & Direct Workspace Actions */}
            <div className="lg:col-span-6 flex flex-col justify-center gap-6 min-w-0">
              <div className="space-y-4">
                <h2
                  style={{ textWrap: 'balance' }}
                  className="font-display text-[clamp(2.25rem,3.6vw,3.35rem)] font-extrabold tracking-tight leading-[1.08] text-[var(--text-primary)] max-w-2xl"
                >
                  {t('welcome.title')}
                </h2>
                <p className="max-w-xl text-base text-[var(--text-secondary)] leading-relaxed">
                  {t('welcome.subtitle')}
                </p>
              </div>

              {/* Primary CTA + Live Diagram Scroll Anchor */}
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={onOpenSimulator}
                  className="inline-flex items-center gap-2 rounded-lg bg-[var(--accent-cta)] hover:bg-[var(--accent-cta-hover)] px-5 py-2.5 text-sm font-semibold text-white transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-[var(--accent-primary)]"
                >
                  <Network className="w-4 h-4" />
                  <span>{t('welcome.openSimulator')}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => onJumpToWorkbench()}
                  className="inline-flex items-center gap-2 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-inset)] hover:border-[var(--accent-primary)] px-4 py-2.5 text-sm font-semibold text-[var(--text-primary)] transition-colors whitespace-nowrap shrink-0"
                >
                  <span>{t('welcome.exploreLive')}</span>
                  <ArrowDown className="w-4 h-4 text-[var(--accent-primary)]" />
                </button>

                <button
                  type="button"
                  onClick={onOpenLearn}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-transparent hover:border-[var(--border-hairline)] px-3 py-2.5 text-sm font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors whitespace-nowrap shrink-0"
                >
                  <BookOpen className="w-4 h-4 text-[var(--accent-teal)]" />
                  <span>{t('welcome.openLearn')}</span>
                </button>
              </div>

              {/* Interactive Starter Protocol Segmented Switcher */}
              <div className="pt-2 space-y-2">
                <div className="text-xs font-medium text-[var(--text-muted)]">{t('welcome.starterLabel')}</div>
                <div
                  role="group"
                  aria-label={t('welcome.starterLabel')}
                  className="inline-flex flex-wrap items-center gap-1 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-inset)] p-1"
                >
                  {STARTER_PROTOCOLS.map((id) => {
                    const p = getProtocolById(id);
                    const active = activeProtocolId === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => onSelectProtocol(id)}
                        className={`rounded-md px-3.5 py-1.5 font-mono text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                          active
                            ? 'bg-[var(--accent-cta)] text-white shadow-xs'
                            : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)]'
                        }`}
                      >
                        {p.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Right Dominant Architectural Media Frame (Single img insideHero section) */}
            <div className="lg:col-span-6 flex">
              <div className="relative flex-1 min-h-[280px] lg:min-h-[380px] w-full overflow-hidden rounded-xl border border-[var(--border-hairline)] bg-slate-950 blueprint-grid">
                <div
                  aria-hidden="true"
                  className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-sky-950 flex items-center justify-center"
                >
                  <Compass className="w-14 h-14 text-sky-400/30" />
                </div>

                {!failedImages.hero && (
                  <img
                    src={heroStudioImg}
                    alt="Precision network routing hardware modules connected with cobalt and teal fiber optic patch cables"
                    referrerPolicy="no-referrer"
                    onError={() => markFailed('hero')}
                    className="relative h-full w-full object-cover"
                  />
                )}

                {/* Contrast Scrim Ensuring >= 4.5:1 Readout Contrast */}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/92 via-slate-950/35 to-transparent flex flex-col justify-end p-5 sm:p-7">
                  <div className="flex flex-wrap items-center gap-2 font-mono text-xs text-sky-300 tabular-nums">
                    <span className="font-semibold text-white">{activeProtocol.name}</span>
                    <span aria-hidden="true">·</span>
                    <span>
                      {t('explore.port')} {activeProtocol.defaultPort}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{activeProtocol.category}</span>
                    {activeProtocol.rfcs[0] && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>{activeProtocol.rfcs[0].number}</span>
                      </>
                    )}
                  </div>
                  <p className="mt-1.5 text-sm text-slate-100 leading-relaxed max-w-lg">
                    {activeProtocol.fullName} — {t('welcome.studioCaption')}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Full-Width 4-Column Quantitative Proof & Workflow Strip */}
          <div className="grid gap-6 border-t border-[var(--border-hairline)] pt-6 sm:grid-cols-2 lg:grid-cols-4">
            {stripSteps.map((step, idx) => (
              <div
                key={step.num}
                className={idx > 0 ? 'lg:border-s lg:border-[var(--border-hairline)] lg:ps-6' : ''}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs font-semibold text-[var(--accent-teal)] tabular-nums">
                    {step.num}
                  </span>
                  <span className="font-mono text-[11px] text-[var(--text-muted)] tabular-nums">
                    {step.metric}
                  </span>
                </div>
                <h3 className="mt-1.5 font-display text-sm font-bold text-[var(--text-primary)]">
                  {step.title}
                </h3>
                <p className="mt-1 text-xs text-[var(--text-secondary)] leading-relaxed">{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Section 2: Asymmetric Capabilities Bento & Curated Protocol Pathways */}
      <section aria-label={t('welcome.capabilitiesLabel')} className="bg-[var(--bg-canvas)] py-10 lg:py-14">
        <div className="mx-auto max-w-[1440px] space-y-8 px-4 sm:px-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="space-y-1.5 max-w-2xl">
              <div className="font-mono text-xs font-semibold text-[var(--accent-teal)]">
                {t('welcome.capabilitiesLabel')}
              </div>
              <h2
                style={{ textWrap: 'balance' }}
                className="font-display text-[clamp(1.5rem,2.4vw,2.25rem)] font-bold tracking-tight leading-tight text-[var(--text-primary)]"
              >
                {t('welcome.capabilitiesTitle')}
              </h2>
            </div>

            <button
              type="button"
              onClick={() => onJumpToWorkbench()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-4 py-2 text-xs font-semibold text-[var(--text-primary)] hover:border-[var(--accent-primary)] transition-colors whitespace-nowrap shrink-0"
            >
              <span>{t('welcome.exploreLive')}</span>
              <ArrowDown className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
            </button>
          </div>

          {/* Primary Asymmetric Row (7 : 5) */}
          <div className="grid gap-6 lg:grid-cols-12">
            {/* Simulator Rack Showcase */}
            <article className="lg:col-span-7 flex flex-col overflow-hidden rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)]">
              <div className="relative aspect-[16/9] w-full overflow-hidden bg-slate-900">
                <div
                  aria-hidden="true"
                  className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-teal-950 flex items-center justify-center"
                >
                  <Cpu className="w-10 h-10 text-teal-400/30" />
                </div>
                {!failedImages.rack && (
                  <img
                    src={simulatorRackImg}
                    alt="Modular enterprise switches and routers wired with teal and cobalt fiber optic patch cables"
                    referrerPolicy="no-referrer"
                    onError={() => markFailed('rack')}
                    className="relative h-full w-full object-cover"
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/20 to-transparent" />
              </div>

              <div className="flex flex-1 flex-col justify-between gap-4 p-6">
                <div className="space-y-2">
                  <div className="font-mono text-xs text-[var(--text-muted)] tabular-nums">
                    {t('nav.simulator')} · {t('welcome.labsCount')} · CLI
                  </div>
                  <h3 className="font-display text-xl font-bold text-[var(--text-primary)]">
                    {t('welcome.simCardTitle')}
                  </h3>
                  <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                    {t('welcome.simCardBody')}
                  </p>
                </div>

                <div>
                  <button
                    type="button"
                    onClick={onOpenSimulator}
                    className="inline-flex items-center gap-2 rounded-lg bg-[var(--accent-cta)] hover:bg-[var(--accent-cta-hover)] px-4 py-2 text-xs font-semibold text-white transition-colors whitespace-nowrap shrink-0"
                  >
                    <Network className="w-3.5 h-3.5" />
                    <span>{t('welcome.launchTopologyStudio')}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </article>

            {/* Layered OSI & Packet Framing Isometric Showcase */}
            <article className="lg:col-span-5 flex flex-col overflow-hidden rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)]">
              <div className="relative aspect-[4/3] w-full overflow-hidden bg-slate-900">
                <div
                  aria-hidden="true"
                  className="absolute inset-0 bg-gradient-to-br from-slate-900 via-sky-950 to-slate-900 flex items-center justify-center"
                >
                  <Layers className="w-10 h-10 text-sky-400/30" />
                </div>
                {!failedImages.blueprint && (
                  <img
                    src={packetBlueprintImg}
                    alt="Layered translucent sapphire protocol framing plates stacked above a copper printed circuit trace grid"
                    referrerPolicy="no-referrer"
                    onError={() => markFailed('blueprint')}
                    className="relative h-full w-full object-cover"
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/15 to-transparent" />
              </div>

              <div className="flex flex-1 flex-col justify-between gap-4 p-6">
                <div className="space-y-2">
                  <div className="font-mono text-xs text-[var(--text-muted)] tabular-nums">
                    {t('welcome.osiCount')} · PCAP · Hex
                  </div>
                  <h3 className="font-display text-xl font-bold text-[var(--text-primary)]">
                    {t('welcome.inspectorCardTitle')}
                  </h3>
                  <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                    {t('welcome.inspectorCardBody')}
                  </p>
                </div>

                <div>
                  <button
                    type="button"
                    onClick={() => onJumpToWorkbench('tls')}
                    className="inline-flex items-center gap-2 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-inset)] hover:border-[var(--accent-primary)] px-4 py-2 text-xs font-semibold text-[var(--text-primary)] transition-colors whitespace-nowrap shrink-0"
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-[var(--accent-teal)]" />
                    <span>{t('welcome.inspectTlsFraming')}</span>
                  </button>
                </div>
              </div>
            </article>
          </div>

          {/* Secondary Asymmetric Row (5 : 7) — Mastery Hub + Curated Protocol Pathways */}
          <div className="grid gap-6 lg:grid-cols-12">
            {/* Mastery Hub Editorial Block */}
            <div className="lg:col-span-5 flex flex-col justify-between gap-6 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-6">
              <div className="space-y-3">
                <div className="font-mono text-xs text-[var(--accent-teal)] tabular-nums">
                  {t('nav.learn')} · CIDR · OSI
                </div>
                <h3 className="font-display text-xl font-bold text-[var(--text-primary)]">
                  {t('welcome.masteryCardTitle')}
                </h3>
                <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                  {t('welcome.masteryCardBody')}
                </p>
              </div>

              <div>
                <button
                  type="button"
                  onClick={onOpenLearn}
                  className="inline-flex items-center gap-2 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-inset)] hover:border-[var(--accent-teal)] px-4 py-2 text-xs font-semibold text-[var(--text-primary)] transition-colors whitespace-nowrap shrink-0"
                >
                  <BookOpen className="w-3.5 h-3.5 text-[var(--accent-teal)]" />
                  <span>{t('welcome.openMasteryHub')}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Curated Protocol Pathways Hairline List */}
            <div className="lg:col-span-7 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-6">
              <div className="flex flex-wrap items-baseline justify-between gap-2 pb-4 border-b border-[var(--border-hairline)]">
                <h3 className="font-display text-lg font-bold text-[var(--text-primary)]">
                  {t('welcome.pathwaysTitle')}
                </h3>
                <span className="text-xs text-[var(--text-muted)]">{t('welcome.pathwaysHint')}</span>
              </div>

              <div className="divide-y divide-[var(--border-hairline)]">
                {PATHWAY_PROTOCOLS.map((id) => {
                  const proto = getProtocolById(id);
                  const isCurrent = activeProtocolId === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => onJumpToWorkbench(id)}
                      className="group flex w-full items-center justify-between gap-4 py-3 text-start transition-colors hover:bg-[var(--bg-inset)]/60 px-2 -mx-2 rounded-lg"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`font-mono text-xs font-bold ${
                              isCurrent ? 'text-[var(--accent-primary)]' : 'text-[var(--text-primary)]'
                            }`}
                          >
                            {proto.name}
                          </span>
                          <span className="text-xs font-medium text-[var(--text-secondary)] truncate">
                            {proto.fullName}
                          </span>
                        </div>
                        <div className="mt-0.5 text-xs text-[var(--text-muted)] truncate">{proto.eli5}</div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0 font-mono text-[11px] text-[var(--text-muted)] tabular-nums">
                        <span className="hidden sm:inline">
                          {t('explore.port')} {proto.defaultPort}
                        </span>
                        <span className="text-[var(--accent-primary)] group-hover:translate-x-0.5 transition-transform">
                          <ArrowRight className="w-3.5 h-3.5" />
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
