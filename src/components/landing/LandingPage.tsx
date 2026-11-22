import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrowRight,
  BookOpen,
  Compass,
  Cpu,
  FileSearch,
  Globe,
  GraduationCap,
  Layers,
  Moon,
  Network,
  PlayCircle,
  ShieldCheck,
  Sun,
  Terminal,
  Trophy,
} from 'lucide-react';
import { LANGUAGES } from '../../i18n';
import { pathFor } from '../../lib/routes';
import { PROTOCOLS } from '../../protocols';
import { PRESET_LABS } from '../../simulator/labs';
import { useAppStore } from '../../store/useAppStore';
import { BrandLogo } from '../common/BrandLogo';
import { LanguageMenu } from '../common/LanguageMenu';
import { HeroDiagram } from './HeroDiagram';

const STARTERS = ['http', 'dns', 'tcp', 'tls', 'dhcp'];

const scrollToId = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

/** The front door: what NetPulse is, what you can do with it, and one-click ways in. */
export const LandingPage: React.FC = () => {
  const { t } = useTranslation();
  const { theme, toggleTheme, setLandingOpen, setMode, selectProtocol, setExperienceLevel } = useAppStore();

  const enter = (mode: 'explore' | 'simulator' | 'learn') => {
    setMode(mode);
    setLandingOpen(false);
    window.scrollTo?.(0, 0);
  };
  const startWith = (id: string) => {
    selectProtocol(id, 0);
    setLandingOpen(false);
  };

  const features = [
    { icon: PlayCircle, k: 'f1' },
    { icon: Layers, k: 'f2' },
    { icon: Network, k: 'f3' },
    { icon: Terminal, k: 'f4' },
    { icon: BookOpen, k: 'f5' },
    { icon: Trophy, k: 'f6' },
    { icon: FileSearch, k: 'f7' },
    { icon: Globe, k: 'f8' },
  ] as const;

  const stats = [
    { n: PROTOCOLS.length, label: t('landing.statProtocols') },
    { n: PRESET_LABS.length, label: t('landing.statLabs') },
    { n: LANGUAGES.length, label: t('landing.statLanguages') },
    { n: '0', label: t('landing.statPrivacy') },
  ];

  const byCategory = PROTOCOLS.reduce<Record<string, typeof PROTOCOLS>>((acc, p) => {
    (acc[p.category] ??= []).push(p);
    return acc;
  }, {});

  const primaryBtn =
    'inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[var(--accent-cta)] px-6 text-base font-semibold text-[var(--on-accent)] shadow-sm transition-colors hover:bg-[var(--accent-cta-hover)]';
  const ghostBtn =
    'inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)] px-5 text-base font-semibold text-[var(--text-primary)] transition-colors hover:border-[var(--accent-primary)] hover:text-[var(--accent-primary)]';

  return (
    <div data-testid="landing-page" className="h-dvh w-full overflow-y-auto bg-[var(--bg-canvas)] text-[var(--text-primary)] [overflow-wrap:anywhere]">
      {/* Top bar */}
      <header className="sticky top-0 z-40 border-b border-[var(--border-hairline)] bg-[var(--bg-surface)]/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-2 px-4 sm:gap-4 sm:px-6">
          <BrandLogo size={32} />
          <nav aria-label={t('nav.workspaces')} className="hidden items-center gap-1 md:flex">
            {(
              [
                ['features', t('landing.navFeatures')],
                ['how', t('landing.navHow')],
                ['simulator', t('landing.navSimulator')],
                ['protocols', t('landing.navProtocols')],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => scrollToId(id)}
                className="rounded-lg px-3 py-2 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-inset)] hover:text-[var(--text-primary)]"
              >
                {label}
              </button>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <LanguageMenu showName className="hidden sm:block" />
            <LanguageMenu className="sm:hidden" />
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? t('nav.switchLight') : t('nav.switchDark')}
              className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--text-secondary)] hover:bg-[var(--bg-inset)] hover:text-[var(--text-primary)]"
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <button type="button" onClick={() => enter('explore')} className="h-9 max-w-[9.5rem] truncate rounded-full bg-[var(--accent-cta)] px-4 text-sm font-semibold text-[var(--on-accent)] hover:bg-[var(--accent-cta-hover)] sm:max-w-none">
              {t('landing.launch')}
            </button>
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div className="pointer-events-none absolute inset-0 -z-0 bg-[radial-gradient(60rem_30rem_at_20%_-10%,var(--accent-primary-soft),transparent)]" aria-hidden="true" />
          <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:py-20">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-3 py-1 text-xs font-semibold text-[var(--accent-primary)]">
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                {t('landing.badge')}
              </span>
              <h1 className="mt-5 font-display text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">{t('landing.title')}</h1>
              <p className="mt-5 max-w-xl text-lg leading-relaxed text-[var(--text-secondary)]">{t('landing.subtitle')}</p>

              <div className="mt-8 flex flex-wrap gap-3">
                <button type="button" onClick={() => enter('simulator')} className={primaryBtn}>
                  <Cpu className="h-5 w-5" aria-hidden="true" />
                  {t('landing.ctaSim')}
                  <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
                </button>
                <button type="button" onClick={() => enter('explore')} className={ghostBtn}>
                  <Compass className="h-5 w-5" aria-hidden="true" />
                  {t('landing.ctaExplore')}
                </button>
                <button type="button" onClick={() => enter('learn')} className="inline-flex h-12 items-center gap-2 rounded-xl px-3 text-base font-semibold text-[var(--text-secondary)] hover:text-[var(--accent-primary)]">
                  <GraduationCap className="h-5 w-5" aria-hidden="true" />
                  {t('landing.ctaLearn')}
                </button>
              </div>

              <div className="mt-8">
                <p className="mb-2 text-sm text-[var(--text-muted)]">{t('landing.starters')}</p>
                <div className="flex flex-wrap gap-2">
                  {STARTERS.map((id) => {
                    const p = PROTOCOLS.find((x) => x.id === id);
                    if (!p) return null;
                    return (
                      <a
                        key={id}
                        href={pathFor('explore', id)}
                        onClick={(e) => {
                          e.preventDefault();
                          startWith(id);
                        }}
                        className="rounded-full border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-4 py-1.5 font-mono text-sm font-semibold text-[var(--text-primary)] transition-colors hover:border-[var(--accent-primary)] hover:text-[var(--accent-primary)]"
                      >
                        {p.name}
                      </a>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-3 shadow-[var(--shadow-card)]">
              <HeroDiagram />
            </div>
          </div>

          {/* Stats */}
          <div className="relative mx-auto max-w-7xl px-4 pb-12 sm:px-6">
            <dl className="grid grid-cols-2 gap-4 rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5 sm:grid-cols-4">
              {stats.map((s) => (
                <div key={s.label} className="text-center">
                  <dt className="sr-only">{s.label}</dt>
                  <dd>
                    <span className="block font-display text-3xl font-extrabold tabular-nums text-[var(--accent-primary)]">{s.n}</span>
                    <span className="text-sm text-[var(--text-secondary)]">{s.label}</span>
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="scroll-mt-20 border-t border-[var(--border-hairline)] bg-[var(--bg-surface)]">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
            <h2 className="max-w-2xl font-display text-2xl font-extrabold tracking-tight sm:text-4xl">{t('landing.featuresTitle')}</h2>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {features.map(({ icon: Icon, k }) => (
                <article key={k} className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-5 transition-colors hover:border-[var(--accent-primary)]/60">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--accent-primary-soft)] text-[var(--accent-primary)]">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <h3 className="mt-4 text-base font-bold">{t(`landing.${k}t`)}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-[var(--text-secondary)]">{t(`landing.${k}b`)}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="scroll-mt-20 border-t border-[var(--border-hairline)]">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
            <h2 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">{t('landing.howTitle')}</h2>
            <ol className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {(['s1', 's2', 's3', 's4'] as const).map((k, i) => (
                <li key={k} className="relative rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5">
                  <span className="font-mono text-sm font-bold text-[var(--accent-primary)]">{String(i + 1).padStart(2, '0')}</span>
                  <h3 className="mt-2 text-lg font-bold">{t(`landing.${k}t`)}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-[var(--text-secondary)]">{t(`landing.${k}b`)}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Simulator showcase */}
        <section id="simulator" className="scroll-mt-20 border-t border-[var(--border-hairline)] bg-[var(--bg-surface)]">
          <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2">
            <div>
              <h2 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">{t('landing.simTitle')}</h2>
              <p className="mt-4 max-w-xl text-lg text-[var(--text-secondary)]">{t('landing.simBody')}</p>
              <ul className="mt-6 space-y-3">
                {(['sim1', 'sim2', 'sim3', 'sim4'] as const).map((k) => (
                  <li key={k} className="flex gap-3 text-[var(--text-primary)]">
                    <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-[var(--accent-primary)]" aria-hidden="true" />
                    <span>{t(`landing.${k}`)}</span>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={() => {
                  setExperienceLevel('pro');
                  enter('simulator');
                }}
                className={`${primaryBtn} mt-8`}
              >
                {t('landing.simCta')}
                <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
              </button>
            </div>

            <div dir="ltr" className="overflow-hidden rounded-2xl border border-[var(--terminal-border)] bg-[var(--terminal-bg)] shadow-[var(--shadow-card)]">
              <div className="flex items-center gap-1.5 border-b border-[var(--terminal-border)] bg-[var(--terminal-header)] px-4 py-2.5">
                <span className="h-3 w-3 rounded-full bg-[var(--tone-danger)]/80" />
                <span className="h-3 w-3 rounded-full bg-[var(--tone-warning)]/80" />
                <span className="h-3 w-3 rounded-full bg-[var(--tone-success)]/80" />
                <span className="ms-3 font-mono text-xs text-[var(--terminal-muted)]">Router &mdash; CLI</span>
              </div>
              <pre className="overflow-x-auto p-5 font-mono text-[13px] leading-6 text-[var(--terminal-text)]">
                <span className="text-[var(--terminal-cmd)]">Router&gt; </span>enable{'\n'}
                <span className="text-[var(--terminal-cmd)]">Router# </span>configure terminal{'\n'}
                <span className="text-[var(--terminal-cmd)]">Router(config)# </span>interface lan0{'\n'}
                <span className="text-[var(--terminal-cmd)]">Router(config-if)# </span>ip address 192.168.1.1 255.255.255.0{'\n'}
                <span className="text-[var(--terminal-cmd)]">Router(config-if)# </span>no shutdown{'\n'}
                <span className="text-[var(--terminal-cmd)]">Router(config-if)# </span>end{'\n'}
                <span className="text-[var(--terminal-cmd)]">Router# </span>ping 203.0.113.10{'\n'}
                <span className="text-[var(--tone-success)]">!!!!!{'\n'}Success rate is 100 percent (5/5)</span>
              </pre>
            </div>
          </div>
        </section>

        {/* Protocol coverage */}
        <section id="protocols" className="scroll-mt-20 border-t border-[var(--border-hairline)]">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
            <h2 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">{t('landing.protocolsTitle', { count: PROTOCOLS.length })}</h2>
            <p className="mt-3 max-w-2xl text-[var(--text-secondary)]">{t('landing.protocolsSub')}</p>
            <div className="mt-8 space-y-5">
              {Object.entries(byCategory).map(([cat, list]) => (
                <div key={cat}>
                  <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-[var(--text-muted)]">{t(`drawer.${cat}`, { defaultValue: cat })}</h3>
                  <div className="flex flex-wrap gap-2">
                    {list.map((p) => (
                      <a
                        key={p.id}
                        href={pathFor('explore', p.id)}
                        onClick={(e) => {
                          e.preventDefault();
                          startWith(p.id);
                        }}
                        className="rounded-full border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-3 py-1 font-mono text-xs font-semibold text-[var(--text-secondary)] transition-colors hover:border-[var(--accent-primary)] hover:text-[var(--accent-primary)]"
                      >
                        {p.name}
                      </a>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Final call to action */}
        <section className="border-t border-[var(--border-hairline)] bg-[var(--bg-surface)]">
          <div className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6">
            <h2 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">{t('landing.ctaTitle')}</h2>
            <p className="mt-3 text-lg text-[var(--text-secondary)]">{t('landing.ctaBody')}</p>
            <button type="button" onClick={() => enter('explore')} className={`${primaryBtn} mt-8`}>
              {t('landing.launch')}
              <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
            </button>
          </div>
        </section>
      </main>

      <footer className="border-t border-[var(--border-hairline)] px-4 py-6 text-center text-sm text-[var(--text-muted)] sm:px-6">{t('credit')}</footer>
    </div>
  );
};
