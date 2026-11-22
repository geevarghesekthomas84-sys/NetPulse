import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Activity,
  Baby,
  Check,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  FlaskConical,
  GitCompare,
  Share2,
  ShieldAlert,
  Star,
} from 'lucide-react';
import type { ProtocolEntry, ScenarioOptions, ScenarioResult } from '../../protocols/types';
import { encodeExploreHash } from '../../lib/deepLink';
import { useAppStore } from '../../store/useAppStore';
import { tc } from '../../i18n/content';
import { Gloss } from '../common/Gloss';

interface ProtocolOverviewProps {
  protocol: ProtocolEntry;
  scenarioResult: ScenarioResult;
}

export const ProtocolOverview: React.FC<ProtocolOverviewProps> = ({ protocol, scenarioResult }) => {
  const { t } = useTranslation();
  const {
    whatIfOptions,
    toggleWhatIf,
    resetWhatIf,
    favorites,
    toggleFavorite,
    compareMode,
    setCompareMode,
    currentStepIndex,
    playbackSpeed,
    exploreView,
    theme,
    experienceLevel,
    selectProtocol,
  } = useAppStore();

  const [eli5, setEli5] = useState(experienceLevel === 'simple');
  const [secOpen, setSecOpen] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const isFav = favorites.includes(protocol.id);

  const handleCopyShareLink = async () => {
    const hash = encodeExploreHash({
      mode: 'explore',
      protocol: protocol.id,
      step: currentStepIndex,
      speed: playbackSpeed,
      view: exploreView,
      theme,
    });
    const url = `${window.location.origin}${window.location.pathname}${hash}`;
    try {
      await navigator.clipboard.writeText(url);
      window.history.replaceState(null, '', hash);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 1800);
    } catch {
      window.location.hash = hash;
    }
  };

  const cwndSeries = scenarioResult.cwndSeries;

  return (
    <section
      aria-label={t('explore.overview')}
      className="bg-[var(--bg-surface)] p-4 space-y-5"
    >
      {/* Top Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
            <span className="font-bold text-[var(--tone-success)] uppercase">{t('common.active')}</span>
            <span className="text-[var(--text-muted)]">·</span>
            <span className="text-[var(--text-muted)]">{protocol.category}</span>
            <span className="text-[var(--text-muted)]">·</span>
            <span className="text-[var(--text-muted)]">{tc(protocol.layer)}</span>
          </div>
          <h1 className="mt-1 font-display text-xl sm:text-2xl font-bold text-[var(--text-primary)]">
            {protocol.name}{' '}
            <span className="font-normal text-base sm:text-lg text-[var(--text-secondary)]">
              — {tc(protocol.fullName)}
            </span>
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => toggleFavorite(protocol.id)}
            aria-label={isFav ? t('explore.removeFavorite') : t('explore.addFavorite')}
            className={`flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              isFav
                ? 'border-amber-500/60 bg-amber-500/12 text-[var(--tone-warning)] font-semibold'
                : 'border-[var(--border-hairline)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Star className={`w-3.5 h-3.5 ${isFav ? 'fill-amber-400 text-amber-500' : ''}`} />
            <span>{isFav ? t('drawer.favorites') : t('explore.addFavorite')}</span>
          </button>

          <button
            type="button"
            onClick={() => setEli5(!eli5)}
            aria-pressed={eli5}
            className={`flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              eli5
                ? 'border-[var(--accent-teal)] bg-[var(--accent-teal-soft)] text-[var(--accent-teal)] font-semibold'
                : 'border-[var(--border-hairline)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Baby className="w-3.5 h-3.5" />
            <span>{t('explore.eli5')}</span>
          </button>

          {experienceLevel === 'pro' && (
            <>
              <button
                type="button"
                onClick={() => setCompareMode(!compareMode)}
                aria-pressed={compareMode}
                className={`flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  compareMode
                    ? 'border-[var(--accent-primary)] bg-[var(--accent-primary-soft)] text-[var(--accent-primary)] font-semibold'
                    : 'border-[var(--border-hairline)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                <GitCompare className="w-3.5 h-3.5" />
                <span>{t('explore.compare')}</span>
              </button>

              <button
                type="button"
                onClick={() => void handleCopyShareLink()}
                className="flex h-9 items-center gap-1.5 rounded-lg border border-[var(--border-hairline)] px-3 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] whitespace-nowrap shrink-0"
              >
                {copiedLink ? <Check className="w-3.5 h-3.5 text-[var(--tone-success)]" /> : <Share2 className="w-3.5 h-3.5" />}
                <span>{copiedLink ? t('explore.copied') : t('explore.share')}</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Plain-English or ELI5 Explanation */}
      <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
        <Gloss text={eli5 ? tc(protocol.eli5) : tc(protocol.description)} />
      </p>

      {/* Numbered Steps Strip */}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {protocol.steps.map((s, idx) => {
          const active = idx === currentStepIndex;
          return (
            <button
              key={idx}
              type="button"
              onClick={() => selectProtocol(protocol.id, idx)}
              className={`rounded-lg border p-2.5 text-start transition-colors ${
                active
                  ? 'border-[var(--accent-primary)] bg-[var(--accent-primary-soft)] text-[var(--text-primary)]'
                  : 'border-[var(--border-hairline)] bg-[var(--bg-inset)]/60 text-[var(--text-secondary)] hover:border-[var(--accent-primary)]/40'
              }`}
            >
              <div className="font-mono text-[11px] font-bold text-[var(--accent-primary)] uppercase">
                {t('playback.step')} {idx + 1} · L{s.osiLayer}
              </div>
              <div className="mt-0.5 text-xs font-semibold truncate">{tc(s.title)}</div>
              <div className="text-xs text-[var(--text-muted)] truncate">{tc(s.subtitle)}</div>
            </button>
          );
        })}
      </div>

      {/* Spec Grid */}
      <div className="hud-panel grid gap-3 !bg-[var(--bg-inset)]/70 p-3.5 text-xs sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <div className="hud-title text-[11px] text-[var(--text-muted)]">
            {t('explore.osiLayers')}
          </div>
          <div className="mt-0.5 font-medium text-[var(--text-primary)]">{tc(protocol.layer)}</div>
        </div>
        <div>
          <div className="hud-title text-[11px] text-[var(--text-muted)]">
            {t('explore.port')}
          </div>
          <div className="mt-0.5 font-mono font-medium text-[var(--text-primary)]">{protocol.defaultPort}</div>
        </div>
        <div>
          <div className="hud-title text-[11px] text-[var(--text-muted)]">
            {tc('Transport')}
          </div>
          <div className="mt-0.5 font-medium text-[var(--text-primary)]">{tc(protocol.transport)}</div>
        </div>
        <div>
          <div className="hud-title text-[11px] text-[var(--text-muted)]">
            {t('explore.realWorldNote')}
          </div>
          <div className="mt-0.5 font-medium text-[var(--text-primary)]">{tc(protocol.dataFormat)}</div>
        </div>
        <div>
          <div className="hud-title text-[11px] text-[var(--text-muted)]">
            {tc('Methods')}
          </div>
          <div className="mt-0.5 font-mono text-xs text-[var(--text-primary)]">
            {protocol.methods.join(' · ')}
          </div>
        </div>
        <div>
          <div className="hud-title text-[11px] text-[var(--text-muted)]">
            {t('explore.rfcsLabel')}
          </div>
          <div className="mt-0.5 flex flex-wrap gap-2">
            {protocol.rfcs.map((rfc) => (
              <a
                key={rfc.number}
                href={rfc.url}
                target="_blank"
                rel="noreferrer"
                title={rfc.title}
                className="inline-flex items-center gap-1 font-mono text-[var(--accent-primary)] hover:underline"
              >
                <span>{rfc.number}</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* Live TCP Congestion Window Chart */}
      {cwndSeries && cwndSeries.length > 1 && (
        <div className="rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-inset)] p-3.5">
          <div className="mb-2 flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 font-semibold text-[var(--text-primary)]">
              <Activity className="w-4 h-4 text-[var(--accent-teal)]" />
              <span>{tc('TCP Congestion Window (cwnd vs ssthresh)')}</span>
            </span>
            <span className="font-mono text-xs text-[var(--text-muted)]">
              {cwndSeries.length} RTT rounds
            </span>
          </div>
          <svg viewBox="0 0 600 130" className="w-full h-32">
            {(() => {
              const maxY = Math.max(20, ...cwndSeries.map((d) => Math.max(d.cwnd, d.ssthresh)));
              const stepX = 560 / Math.max(1, cwndSeries.length - 1);
              const toY = (val: number) => 112 - (val / maxY) * 95;
              const cwndPoints = cwndSeries
                .map((d, i) => `${25 + i * stepX},${toY(d.cwnd).toFixed(1)}`)
                .join(' ');
              const ssPoints = cwndSeries
                .map((d, i) => `${25 + i * stepX},${toY(d.ssthresh).toFixed(1)}`)
                .join(' ');
              return (
                <>
                  <line x1="25" y1="112" x2="585" y2="112" stroke="var(--border-strong)" strokeWidth="1" />
                  <polyline fill="none" stroke="var(--pkt-udp)" strokeWidth="1.5" strokeDasharray="4 3" points={ssPoints} />
                  <polyline fill="none" stroke="var(--pkt-tcp)" strokeWidth="2.5" points={cwndPoints} />
                  {cwndSeries.map((d, i) => (
                    <circle
                      key={i}
                      cx={25 + i * stepX}
                      cy={toY(d.cwnd)}
                      r={d.event ? 4 : 2.5}
                      fill={d.event?.includes('Drop') || d.event?.includes('RTO') ? 'var(--pkt-error)' : 'var(--pkt-tcp)'}
                    />
                  ))}
                  <text x="30" y="15" className="fill-[var(--accent-teal)] text-[11px] font-mono">{tc('cwnd (MSS)')}</text>
                  <text x="115" y="15" className="fill-[var(--tone-warning)] text-[11px] font-mono">ssthresh</text>
                </>
              );
            })()}
          </svg>
        </div>
      )}

      {/* What-if Failure Scenario Toggles */}
      {protocol.whatIfOptions.length > 0 && (
        <div className="rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-inset)]/60 p-3.5">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text-primary)]">
              <FlaskConical className="w-4 h-4 text-[var(--tone-warning)]" />
              <span>{t('explore.whatIf')}</span>
            </span>
            {Object.values(whatIfOptions).some(Boolean) && (
              <button
                type="button"
                onClick={resetWhatIf}
                className="text-xs font-mono text-[var(--accent-primary)] hover:underline"
              >
                {t('explore.whatIfReset')}
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {protocol.whatIfOptions.map((opt) => {
              const key = opt.id as keyof ScenarioOptions;
              const active = Boolean(whatIfOptions[key]);
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => toggleWhatIf(key)}
                  title={tc(opt.description)}
                  aria-pressed={active}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    active
                      ? 'border-red-500/70 bg-red-500/12 text-[var(--tone-danger)] font-semibold'
                      : 'border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  {tc(opt.label)}
                </button>
              );
            })}
          </div>
          {scenarioResult.summaryNote && (
            <p className="mt-2 font-mono text-xs text-[var(--tone-warning)]">{scenarioResult.summaryNote}</p>
          )}
        </div>
      )}

      {/* Security Notes Accordion */}
      <div className="rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-inset)]/60">
        <button
          type="button"
          onClick={() => setSecOpen(!secOpen)}
          aria-expanded={secOpen}
          className="flex w-full items-center justify-between px-3.5 py-2.5 text-xs font-semibold text-[var(--text-primary)]"
        >
          <span className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-[var(--tone-danger)]" />
            <span>{t('explore.securityNotes')} ({protocol.securityNotes.length})</span>
          </span>
          {secOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
        {secOpen && (
          <div className="border-t border-[var(--border-hairline)] divide-y divide-[var(--border-hairline)] px-3.5">
            {protocol.securityNotes.map((note, idx) => (
              <div key={idx} className="py-2.5 text-xs space-y-1">
                <div className="font-semibold text-[var(--tone-danger)]">{tc(note.attack)}</div>
                <p className="text-[var(--text-secondary)]">{tc(note.description)}</p>
                <p className="font-mono text-xs text-[var(--tone-success)]">{tc('Defense')}: {tc(note.defense)}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};
