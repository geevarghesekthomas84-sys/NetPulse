import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  BookOpen,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Compass,
  FileUp,
  GitCompare,
  Layers,
  ListOrdered,
  Maximize2,
  Minimize2,
  Network,
  PanelLeft,
  ScrollText,
  Share2,
  Star,
  X,
} from 'lucide-react';
import type { SimLogEntry } from '../../engine/types';
import { encodeExploreHash } from '../../lib/deepLink';
import { getProtocolById } from '../../protocols';
import { useAppStore } from '../../store/useAppStore';
import { EventLogPanel } from '../common/EventLogPanel';
import { PacketInspectorContent } from '../common/PacketInspector';
import { CaptureViewer } from './CaptureViewer';
import { CompareView } from './CompareView';
import { EncapsulationView } from './EncapsulationView';
import { GuidedPath } from './GuidedPath';
import { RecapCard } from './RecapCard';
import { NetworkDiagram } from './NetworkDiagram';
import { OsiRuler } from './OsiRuler';
import { PacketTable } from './PacketTable';
import { StepPanel } from './StepPanel';
import { PACKET_COLORS } from './colors';
import { PlaybackBar } from './PlaybackBar';
import { ProtocolOverview } from './ProtocolOverview';
import { SequenceDiagram } from './SequenceDiagram';
import { tc } from '../../i18n/content';

export const ExploreWorkspace: React.FC = () => {
  const { t } = useTranslation();
  const {
    activeProtocolId,
    whatIfOptions,
    exploreView,
    setExploreView,
    currentPacketIndex,
    currentStepIndex,
    setCurrentPacketIndex,
    setCurrentStepIndex,
    setIsPlaying,
    setInspectedPacketId,
    compareMode,
    setCompareMode,
    favorites,
    toggleFavorite,
    playbackSpeed,
    theme,
    experienceLevel,
    welcomeDismissed,
    dismissWelcome,
    selectProtocol,
    settings,
    isPlaying,
    markProtocolFinished,
  } = useAppStore();

  const [packetProgress, setPacketProgress] = useState(0.5);
  const [captureOpen, setCaptureOpen] = useState(false);
  const [hasPlayed, setHasPlayed] = useState(false);
  const [recapClosed, setRecapClosed] = useState(false);
  // On phones the step list is a tall block above the diagram; start it closed (one tap on "Steps" opens it).
  const [leftRailOpen, setLeftRailOpen] = useState(() => typeof window === 'undefined' || window.innerWidth >= 1024);
  const [dockTab, setDockTab] = useState<'inspector' | 'logs' | 'packets' | 'overview' | 'encap'>('packets');
  // On short screens, first-time (Simple) users get the diagram first; notes stay one click away.
  const [dockSize, setDockSize] = useState<'collapsed' | 'compact' | 'expanded'>(() =>
    typeof window !== 'undefined' && window.innerHeight < 820 ? 'collapsed' : 'compact'
  );
  const [copiedLink, setCopiedLink] = useState(false);

  const isSimple = experienceLevel === 'simple';

  // Keep dock tab valid when toggling Simple <-> Pro
  useEffect(() => {
    if (isSimple && dockTab === 'logs') {
      setDockTab('overview');
    }
  }, [isSimple, dockTab]);

  const protocol = useMemo(() => getProtocolById(activeProtocolId), [activeProtocolId]);
  const scenarioResult = useMemo(
    () => protocol.scenario({ ...whatIfOptions, seed: settings.defaultSeed }),
    [protocol, whatIfOptions, settings.defaultSeed]
  );

  const safePacketIndex = Math.min(currentPacketIndex, Math.max(0, scenarioResult.packets.length - 1));
  const activePacket = scenarioResult.packets[safePacketIndex] ?? null;

  // The learner has "finished" a protocol once playback ends on the last packet.
  const atEnd = scenarioResult.packets.length > 0 && safePacketIndex === scenarioResult.packets.length - 1;
  const showRecap = hasPlayed && atEnd && !isPlaying && !recapClosed;

  useEffect(() => {
    setHasPlayed(false);
    setRecapClosed(false);
  }, [activeProtocolId, whatIfOptions]);

  useEffect(() => {
    if (isPlaying) {
      setHasPlayed(true);
      setRecapClosed(false);
    }
  }, [isPlaying]);

  useEffect(() => {
    if (showRecap) markProtocolFinished(activeProtocolId);
  }, [showRecap, activeProtocolId, markProtocolFinished]);
  const activeOsiLayer =
    activePacket?.osiLayer ??
    scenarioResult.steps[currentStepIndex]?.osiLayer ??
    protocol.osiLayer;

  const exploreEventLogs: SimLogEntry[] = useMemo(() => {
    const nodeNameMap = new Map(scenarioResult.nodes.map((n) => [n.id, n.label]));
    return scenarioResult.packets.map((pkt, idx) => {
      const from = nodeNameMap.get(pkt.fromDeviceId) ?? pkt.fromDeviceId;
      const to = nodeNameMap.get(pkt.toDeviceId) ?? pkt.toDeviceId;
      const stepTitle =
        pkt.stepIndex !== undefined && scenarioResult.steps[pkt.stepIndex]
          ? `[${tc(scenarioResult.steps[pkt.stepIndex].title)}] `
          : '';
      return {
        id: `exp-log-${pkt.id}-${idx}`,
        timeMs: pkt.timestampMs,
        deviceId: from,
        level: pkt.dropped ? 'error' : pkt.retransmitted ? 'warn' : 'info',
        message: `${stepTitle}#${pkt.no} ${pkt.protocol} (${pkt.sizeBytes}B) → ${to}: ${pkt.info}${
          pkt.dropped && pkt.dropReason ? ` — ${tc('DROPPED')}: ${tc(pkt.dropReason)}` : ''
        }`,
      };
    });
  }, [scenarioResult]);

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

  const dockHeightClass =
    dockSize === 'collapsed'
      ? 'h-9'
      : dockSize === 'expanded'
      ? 'h-[min(72vh,580px)]'
      : 'h-[clamp(210px,28vh,300px)]';

  return (
    <div className="relative flex flex-1 min-h-0 flex-col overflow-y-auto lg:overflow-hidden bg-[var(--bg-canvas)]">
      {captureOpen && (
        <CaptureViewer
          samplePackets={scenarioResult.packets}
          sampleName={protocol.name}
          onClose={() => setCaptureOpen(false)}
        />
      )}
      {/* First-visit guide: what this is, the three things to do, and a place to start */}
      {!welcomeDismissed && (
        <section
          aria-label={t('welcome.badge')}
          className="shrink-0 border-b border-[var(--border-hairline)] bg-[var(--accent-primary-soft)] px-4 sm:px-6 py-4"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="text-xs font-semibold text-[var(--accent-primary)]">{t('welcome.badge')}</div>
              <h2 className="mt-1 font-display text-lg sm:text-xl font-bold text-[var(--text-primary)]">
                {t('welcome.title')}
              </h2>
            </div>
            <button
              type="button"
              onClick={dismissWelcome}
              aria-label={t('welcome.dismiss')}
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)] whitespace-nowrap shrink-0"
            >
              <X className="w-4 h-4" />
              <span className="hidden sm:inline">{t('welcome.dismiss')}</span>
            </button>
          </div>

          <ol className="mt-3 flex flex-col sm:flex-row sm:flex-wrap gap-x-6 gap-y-2 text-sm text-[var(--text-primary)]">
            {(['step1', 'step2', 'step3'] as const).map((k, i) => (
              <li key={k} className="flex items-center gap-2" title={t(`welcome.${k}Body`)}>
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--accent-cta)] text-xs font-bold text-[var(--on-accent)]">
                  {i + 1}
                </span>
                <span>{t(`welcome.${k}Title`)}</span>
              </li>
            ))}
          </ol>

          <GuidedPath />
        </section>
      )}

      {/* Top Protocol Workbench Ribbon */}
      <div className="shrink-0 flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-hairline)] bg-[var(--bg-surface)] px-3 sm:px-5 py-2.5 z-10">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={() => setLeftRailOpen((o) => !o)}
            aria-pressed={leftRailOpen}
            title={t('explore.stepsAndOsi')}
            className={`flex h-8 items-center gap-1.5 rounded-lg border px-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              leftRailOpen
                ? 'border-[var(--accent-primary)] bg-[var(--accent-primary-soft)] text-[var(--accent-primary)]'
                : 'border-[var(--border-hairline)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <PanelLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t('explore.stepsAndOsi')}</span>
          </button>

          <div className="min-w-0">
            <div className="flex items-baseline gap-2 min-w-0">
              <h1 className="font-display text-lg font-bold text-[var(--text-primary)] truncate">
                {protocol.name}
              </h1>
              <span className="hidden md:inline text-sm text-[var(--text-secondary)] truncate">
                — {tc(protocol.fullName)}
              </span>
            </div>
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
              <span>{t(`category.${protocol.category}`)}</span>
              <span aria-hidden="true">·</span>
              <span>{t('explore.port')} {protocol.defaultPort}</span>
              {!isSimple && <span aria-hidden="true">·</span>}
              {!isSimple && <span>{t('explore.activeLayer', { layer: activeOsiLayer })}</span>}
              {!isSimple && protocol.rfcs[0] && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{protocol.rfcs[0].number}</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
          {/* NETWORK vs SEQUENCE segmented switch */}
          <div className="inline-flex rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-inset)] p-0.5">
            <button
              type="button"
              onClick={() => setExploreView('network')}
              className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                exploreView === 'network'
                  ? 'bg-[var(--accent-cta)] text-[var(--on-accent)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Network className="w-3.5 h-3.5" />
              <span>{t('explore.networkView')}</span>
            </button>
            <button
              type="button"
              onClick={() => setExploreView('sequence')}
              className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                exploreView === 'sequence'
                  ? 'bg-[var(--accent-cta)] text-[var(--on-accent)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <ListOrdered className="w-3.5 h-3.5" />
              <span>{t('explore.sequenceView')}</span>
            </button>
          </div>

          {!isSimple && (
            <button
              type="button"
              onClick={() => setCompareMode(!compareMode)}
              aria-pressed={compareMode}
              className={`flex h-8 items-center gap-1 rounded-lg border px-2.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                compareMode
                  ? 'border-[var(--accent-primary)] bg-[var(--accent-primary-soft)] text-[var(--accent-primary)]'
                  : 'border-[var(--border-hairline)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <GitCompare className="w-3.5 h-3.5" />
              <span className="hidden md:inline">{t('explore.compare')}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setCaptureOpen(true)}
            title={t('pcap.open')}
            className="flex h-8 items-center gap-1.5 rounded-lg border border-[var(--border-hairline)] px-2.5 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] whitespace-nowrap shrink-0"
          >
            <FileUp className="w-3.5 h-3.5" />
            <span className="hidden md:inline">{t('pcap.open')}</span>
          </button>

          <button
            type="button"
            onClick={() => toggleFavorite(protocol.id)}
            aria-label={isFav ? t('explore.removeFavorite') : t('explore.addFavorite')}
            className={`flex h-8 w-8 items-center justify-center rounded-lg border transition-colors shrink-0 ${
              isFav
                ? 'border-amber-500/60 bg-amber-500/12 text-[var(--tone-warning)]'
                : 'border-[var(--border-hairline)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Star className={`w-3.5 h-3.5 ${isFav ? 'fill-amber-400 text-amber-500' : ''}`} />
          </button>

          {!isSimple && (
            <button
              type="button"
              onClick={() => void handleCopyShareLink()}
              title={t('explore.copyLink')}
              className="flex h-8 items-center gap-1 rounded-lg border border-[var(--border-hairline)] px-2.5 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] whitespace-nowrap shrink-0"
            >
              {copiedLink ? <Check className="w-3.5 h-3.5 text-[var(--tone-success)]" /> : <Share2 className="w-3.5 h-3.5" />}
              <span className="hidden md:inline">{copiedLink ? t('explore.copied') : t('explore.share')}</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Split Stage: Collapsible Steps & OSI Rail | Full-Width Canvas */}
      <div className="flex flex-col lg:flex-row flex-1 min-h-[280px] overflow-hidden">
        {leftRailOpen && (
          <aside
            aria-label={t('explore.stepsAndOsi')}
            className="w-full lg:w-72 shrink-0 border-b lg:border-b-0 lg:border-e border-[var(--border-hairline)] bg-[var(--bg-surface)] flex flex-col overflow-y-auto"
          >
            <div className="p-2.5 border-b border-[var(--border-hairline)] space-y-1.5">
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-semibold text-[var(--text-muted)]">
                  {t('explore.protocolSteps')} ({protocol.steps.length})
                </span>
                <button
                  type="button"
                  onClick={() => setLeftRailOpen(false)}
                  aria-label={t('drawer.collapse')}
                  className="hidden lg:flex h-5 w-5 items-center justify-center rounded text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
              </div>
              {protocol.steps.map((s, idx) => {
                const active = idx === currentStepIndex;
                const done = idx < currentStepIndex;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => selectProtocol(protocol.id, idx)}
                    aria-current={active ? 'step' : undefined}
                    className={`flex w-full items-start gap-2.5 rounded-xl border px-3 py-2 text-start transition-colors ${
                      active
                        ? 'border-[var(--accent-primary)] bg-[var(--accent-primary-soft)]'
                        : 'border-transparent hover:bg-[var(--bg-inset)]'
                    }`}
                  >
                    <span
                      className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                        active
                          ? 'bg-[var(--accent-cta)] text-[var(--on-accent)]'
                          : done
                          ? 'bg-[var(--accent-teal-soft)] text-[var(--accent-teal)]'
                          : 'bg-[var(--bg-inset)] text-[var(--text-muted)]'
                      }`}
                    >
                      {done ? <Check className="w-3.5 h-3.5" /> : idx + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-[var(--text-primary)]">{tc(s.title)}</span>
                      {isSimple ? (
                        <span className="block text-xs text-[var(--text-muted)] leading-snug">{tc(s.subtitle)}</span>
                      ) : (
                        <span className="block font-mono text-xs text-[var(--text-muted)]">L{s.osiLayer}</span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>

            {!isSimple && (
              <div className="p-2.5">
                <OsiRuler activeLayer={activeOsiLayer} />
              </div>
            )}

          </aside>
        )}

        {!leftRailOpen && (
          <div className="hidden lg:flex w-10 shrink-0 flex-col items-center border-e border-[var(--border-hairline)] bg-[var(--bg-surface)] py-2 gap-2">
            <button
              type="button"
              onClick={() => setLeftRailOpen(true)}
              title={t('explore.stepsAndOsi')}
              aria-label={t('explore.stepsAndOsi')}
              className="flex h-7 w-7 items-center justify-center rounded border border-[var(--border-hairline)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
            <Layers className="w-4 h-4 text-[var(--accent-primary)] mt-1" />
            <span className="font-mono text-[11px] font-bold text-[var(--accent-primary)]">L{activeOsiLayer}</span>
          </div>
        )}

        {/* Stage: framed canvas + transport strip, with the step details panel on wide screens */}
        <div className="flex min-w-0 flex-1 gap-3 overflow-hidden bg-[var(--bg-canvas)] p-0 lg:p-3">
        <div className="hud-panel flex min-w-0 flex-1 flex-col overflow-hidden">
          {!isSimple && compareMode && (
            <div className="shrink-0 p-3 border-b border-[var(--border-hairline)] bg-[var(--bg-surface)]">
              <CompareView />
            </div>
          )}

          <div className="relative flex-1 min-h-[240px] flex flex-col overflow-hidden">
            {showRecap && (
              <RecapCard
                protocolId={activeProtocolId}
                onClose={() => setRecapClosed(true)}
                onReplay={() => {
                  setCurrentPacketIndex(0);
                  setCurrentStepIndex(0);
                  setRecapClosed(true);
                  setIsPlaying(true);
                }}
              />
            )}
            {exploreView === 'network' ? (
              <NetworkDiagram
                protocolName={protocol.name}
                nodes={scenarioResult.nodes}
                links={scenarioResult.links}
                packets={scenarioResult.packets}
                steps={scenarioResult.steps}
                currentPacketIndex={safePacketIndex}
                currentStepIndex={currentStepIndex}
                packetProgress={packetProgress}
                onInspectPacket={(id) => {
                  const idx = scenarioResult.packets.findIndex((p) => p.id === id);
                  if (idx >= 0) setCurrentPacketIndex(idx);
                  setDockTab('inspector');
                  if (dockSize === 'collapsed') setDockSize('compact');
                }}
              />
            ) : (
              <SequenceDiagram
                nodes={scenarioResult.nodes}
                packets={scenarioResult.packets}
                currentPacketIndex={safePacketIndex}
                onSelectPacket={(idx) => {
                  setIsPlaying(false);
                  setCurrentPacketIndex(idx);
                  const pkt = scenarioResult.packets[idx];
                  if (pkt?.stepIndex !== undefined) setCurrentStepIndex(pkt.stepIndex);
                  setDockTab('inspector');
                  if (dockSize === 'collapsed') setDockSize('compact');
                }}
              />
            )}
          </div>

          <PlaybackBar
            packets={scenarioResult.packets}
            steps={scenarioResult.steps}
            onProgressChange={setPacketProgress}
          />
        </div>
        <StepPanel
          protocol={protocol}
          step={scenarioResult.steps[currentStepIndex]}
          stepIndex={currentStepIndex}
          stepCount={scenarioResult.steps.length}
          packet={activePacket}
        />
        </div>
      </div>

      {/* Bottom Docked Workbench Deck */}
      <section
        aria-label={tc('Explore Logs and Inspector Deck')}
        className={`shrink-0 flex flex-col border-t border-[var(--border-strong)] bg-[var(--bg-surface)] transition-[height] duration-150 ${dockHeightClass}`}
      >
        <div className="shrink-0 flex items-center justify-between gap-2 border-b border-[var(--border-hairline)] bg-[var(--bg-surface)] px-3">
          <div className="hidden items-center gap-3 pe-2 lg:flex">
            <span className="hud-title shrink-0 whitespace-nowrap text-sm text-[var(--text-primary)]">{t('explore.packetFlow')}</span>
            <span className="hidden items-center gap-2.5 text-[11px] text-[var(--text-secondary)] 2xl:flex" aria-hidden="true">
              {(['dns', 'tcp', 'http_req', 'http_res'] as const).map((k) => (
                <span key={k} className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: PACKET_COLORS[k].hex }} />
                  {k === 'dns' ? 'DNS' : k === 'tcp' ? 'TCP' : k === 'http_req' ? 'Request' : 'Response'}
                </span>
              ))}
            </span>
          </div>
          <div role="tablist" className="flex items-center gap-1 overflow-x-auto">
            {(
              isSimple
                ? ([
                    { id: 'packets', label: `${t('explore.packetFlow')} (${scenarioResult.packets.length})`, icon: Network },
                    { id: 'overview', label: t('explore.overview'), icon: BookOpen },
                    { id: 'encap', label: t('explore.encapsulation'), icon: Layers },
                    { id: 'inspector', label: `${t('explore.packetInspector')}${activePacket ? ` (#${activePacket.no})` : ''}`, icon: Layers },
                  ] as const)
                : ([
                    { id: 'packets', label: `${t('explore.packetFlow')} (${scenarioResult.packets.length})`, icon: Network },
                    { id: 'inspector', label: `${t('explore.packetInspector')}${activePacket ? ` (#${activePacket.no})` : ''}`, icon: Layers },
                    { id: 'logs', label: `${t('explore.eventLogs')} (${exploreEventLogs.length})`, icon: ScrollText },
                    { id: 'encap', label: t('explore.encapsulation'), icon: Layers },
                    { id: 'overview', label: t('explore.overview'), icon: BookOpen },
                  ] as const)
            ).map((tab) => {
              const Icon = tab.icon;
              const active = dockTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setDockTab(tab.id);
                    if (dockSize === 'collapsed') setDockSize('compact');
                  }}
                  role="tab"
                  aria-selected={active}
                  className={`-mb-px flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2 text-xs font-semibold transition-colors ${
                    active
                      ? 'border-[var(--accent-primary)] text-[var(--accent-primary)]'
                      : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}

          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => setDockSize((s) => (s === 'collapsed' ? 'compact' : 'collapsed'))}
              title={dockSize === 'collapsed' ? t('explore.expandDock') : t('explore.collapseDock')}
              aria-label={dockSize === 'collapsed' ? t('explore.expandDock') : t('explore.collapseDock')}
              className="flex h-6 w-6 items-center justify-center rounded border border-[var(--border-hairline)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            >
              {dockSize === 'collapsed' ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
            <button
              type="button"
              onClick={() => setDockSize((s) => (s === 'expanded' ? 'compact' : 'expanded'))}
              title={dockSize === 'expanded' ? t('explore.restoreDock') : t('explore.expandDock')}
              aria-label={dockSize === 'expanded' ? t('explore.restoreDock') : t('explore.expandDock')}
              className="flex h-6 w-6 items-center justify-center rounded border border-[var(--border-hairline)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            >
              {dockSize === 'expanded' ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
            </button>
          </div>
        </div>

        {dockSize !== 'collapsed' && (
          <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
            {dockTab === 'encap' && (
              <div className="flex-1 min-h-0">
                <EncapsulationView packet={activePacket} />
              </div>
            )}

            {dockTab === 'inspector' && (
              <PacketInspectorContent
                packet={activePacket}
                defaultShowHex={!isSimple && settings.showHexByDefault}
                embedded
                onPopOut={activePacket ? () => setInspectedPacketId(activePacket.id) : undefined}
              />
            )}

            {dockTab === 'logs' && !isSimple && (
              <EventLogPanel
                logs={exploreEventLogs}
                emptyMessage={tc('No protocol step events in this scenario.')}
              />
            )}

            {dockTab === 'packets' && (
              <div className="flex-1 min-h-0 overflow-y-auto">
                <PacketTable
                  packets={scenarioResult.packets}
                  currentPacketIndex={safePacketIndex}
                  filenamePrefix={`netpulse-${protocol.id}`}
                  flat
                  onSelectPacket={(_id, idx) => {
                    setIsPlaying(false);
                    setCurrentPacketIndex(idx);
                    const pkt = scenarioResult.packets[idx];
                    if (pkt?.stepIndex !== undefined) setCurrentStepIndex(pkt.stepIndex);
                  }}
                  onInspectPacket={(id) => {
                    const idx = scenarioResult.packets.findIndex((p) => p.id === id);
                    if (idx >= 0) setCurrentPacketIndex(idx);
                    setDockTab('inspector');
                    setDockSize((s) => (s === 'collapsed' ? 'compact' : s));
                  }}
                />
              </div>
            )}

            {dockTab === 'overview' && (
              <div className="flex-1 min-h-0 overflow-y-auto">
                <ProtocolOverview protocol={protocol} scenarioResult={scenarioResult} />
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
};
