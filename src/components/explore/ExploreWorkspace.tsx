import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  BookOpen,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  FileText,
  FileUp,
  GitCompare,
  Layers,
  ListOrdered,
  Maximize2,
  Minimize2,
  Network,
  PanelLeft,
  RotateCcw,
  ScrollText,
  Share2,
  Sparkles,
  Star,
  X,
} from 'lucide-react';
import type { CapturedPacket, DeviceRole, SimLogEntry } from '../../engine/types';
import { encodeExploreHash } from '../../lib/deepLink';
import { parsePcapFile } from '../../lib/pcapReader';
import { getProtocolById } from '../../protocols';
import type { ProtocolLinkDef, ProtocolNodeDef, ProtocolStepDef, ScenarioResult } from '../../protocols/types';
import { useAppStore } from '../../store/useAppStore';
import { EventLogPanel } from '../common/EventLogPanel';
import { PacketInspectorContent } from '../common/PacketInspector';
import { CompareView } from './CompareView';
import { EncapsulationModal } from './EncapsulationModal';
import { EntrySite } from './EntrySite';
import { FinishedRecapCard } from './FinishedRecapCard';
import { GuidedTrackBanner } from './GuidedTrackBanner';
import { NetworkDiagram } from './NetworkDiagram';
import { OsiRuler } from './OsiRuler';
import { PacketTable } from './PacketTable';
import { PlaybackBar } from './PlaybackBar';
import { ProtocolOverview } from './ProtocolOverview';
import { SequenceDiagram } from './SequenceDiagram';

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
    setExperienceLevel,
    welcomeDismissed,
    dismissWelcome,
    selectProtocol,
    setMode,
    settings,
    customPcapPackets,
    setCustomPcapPackets,
  } = useAppStore();

  const [packetProgress, setPacketProgress] = useState(0.5);
  const [leftRailOpen, setLeftRailOpen] = useState(true);
  const [dockTab, setDockTab] = useState<'inspector' | 'logs' | 'packets' | 'overview'>(
    experienceLevel === 'simple' ? 'overview' : 'inspector'
  );
  const [dockSize, setDockSize] = useState<'collapsed' | 'compact' | 'expanded'>('compact');
  const [copiedLink, setCopiedLink] = useState(false);
  const [recapDismissed, setRecapDismissed] = useState(false);
  const [encapPacket, setEncapPacket] = useState<CapturedPacket | null>(null);
  const [pcapError, setPcapError] = useState<string | null>(null);

  const workbenchRef = useRef<HTMLDivElement>(null);
  const pcapInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setRecapDismissed(false);
  }, [activeProtocolId]);

  const handlePcapUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPcapError(null);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const buffer = reader.result as ArrayBuffer;
        const parsed = parsePcapFile(buffer);
        if (parsed.length === 0) {
          setPcapError('No packets found in PCAP file.');
          return;
        }
        setCustomPcapPackets(parsed);
        setCurrentPacketIndex(0);
        setCurrentStepIndex(0);
      } catch (err: unknown) {
        setPcapError(err instanceof Error ? err.message : 'Failed to parse PCAP file.');
      }
    };
    reader.onerror = () => setPcapError('Failed to read PCAP file.');
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  const jumpToWorkbench = (protocolId?: string) => {
    if (protocolId) {
      selectProtocol(protocolId, 0);
    }
    requestAnimationFrame(() => {
      workbenchRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const isSimple = experienceLevel === 'simple';

  // Keep dock tab valid when toggling Simple <-> Pro
  useEffect(() => {
    if (isSimple && (dockTab === 'logs' || dockTab === 'packets')) {
      setDockTab('overview');
    }
  }, [isSimple, dockTab]);

  const protocol = useMemo(() => getProtocolById(activeProtocolId), [activeProtocolId]);

  const scenarioResult = useMemo(() => {
    if (customPcapPackets && customPcapPackets.length > 0) {
      const uniqueDevs = new Set<string>();
      customPcapPackets.forEach((p) => {
        uniqueDevs.add(p.fromDeviceId);
        uniqueDevs.add(p.toDeviceId);
      });
      const devList = Array.from(uniqueDevs);
      const nodes: ProtocolNodeDef[] = devList.map((id, idx) => ({
        id,
        label: id,
        ip: id,
        role: (idx === 0 ? 'host' : idx === devList.length - 1 ? 'web_server' : 'router') as DeviceRole,
        x: Math.round(150 + (idx * 700) / Math.max(1, devList.length - 1)),
        y: 250,
      }));
      const links: ProtocolLinkDef[] = devList.slice(0, -1).map((id, idx) => ({
        id: `link-${id}-${devList[idx + 1]}`,
        sourceId: id,
        targetId: devList[idx + 1],
        bandwidthMbps: 1000,
        delayMs: 5,
      }));
      const steps: ProtocolStepDef[] = [
        {
          title: 'Imported PCAP Trace',
          subtitle: `${customPcapPackets.length} Frames`,
          caption: `Replaying ${customPcapPackets.length} captured frames. Step through the sequence diagram or packet table to inspect headers and payloads.`,
          osiLayer: customPcapPackets[0]?.osiLayer ?? 3,
        },
      ];
      return {
        packets: customPcapPackets,
        steps,
        nodes,
        links,
      } as ScenarioResult;
    }
    return protocol.scenario({ ...whatIfOptions, seed: settings.defaultSeed });
  }, [customPcapPackets, protocol, whatIfOptions, settings.defaultSeed]);

  const safePacketIndex = Math.min(currentPacketIndex, Math.max(0, scenarioResult.packets.length - 1));
  const activePacket = scenarioResult.packets[safePacketIndex] ?? null;
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
          ? `[${scenarioResult.steps[pkt.stepIndex].title}] `
          : '';
      return {
        id: `exp-log-${pkt.id}-${idx}`,
        timeMs: pkt.timestampMs,
        deviceId: from,
        level: pkt.dropped ? 'error' : pkt.retransmitted ? 'warn' : 'info',
        message: `${stepTitle}#${pkt.no} ${pkt.protocol} (${pkt.sizeBytes}B) → ${to}: ${pkt.info}${
          pkt.dropped && pkt.dropReason ? ` — DROPPED: ${pkt.dropReason}` : ''
        }`,
      };
    });
  }, [scenarioResult]);

  const showFinishedRecap =
    !recapDismissed &&
    !customPcapPackets &&
    scenarioResult.packets.length > 1 &&
    safePacketIndex >= scenarioResult.packets.length - 1;

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
      ? 'h-10'
      : dockSize === 'expanded'
      ? 'h-[450px]'
      : 'h-[310px]';

  return (
    <div className="flex flex-1 min-h-0 flex-col overflow-y-auto bg-[var(--bg-canvas)]">
      {/* Architectural Full-Page Entry Site */}
      {!welcomeDismissed && (
        <EntrySite
          activeProtocolId={activeProtocolId}
          activeProtocol={protocol}
          isSimple={isSimple}
          onSelectProtocol={(id) => selectProtocol(id, 0)}
          onJumpToWorkbench={jumpToWorkbench}
          onSwitchToPro={() => setExperienceLevel('pro')}
          onOpenSimulator={() => setMode('simulator')}
          onOpenLearn={() => setMode('learn')}
          onDismiss={dismissWelcome}
        />
      )}

      {/* Top Protocol Workbench Ribbon */}
      <div
        id="live-workbench"
        ref={workbenchRef}
        className="shrink-0 flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-hairline)] bg-[var(--bg-surface)] px-3.5 py-2 z-10"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={() => setLeftRailOpen((o) => !o)}
            aria-pressed={leftRailOpen}
            title={t('explore.stepsAndOsi')}
            className={`flex h-9 items-center gap-1.5 rounded-lg border px-2.5 text-[13px] font-semibold transition-colors whitespace-nowrap shrink-0 ${
              leftRailOpen
                ? 'border-[var(--accent-primary)] bg-[var(--accent-primary-soft)] text-[var(--accent-primary)]'
                : 'border-[var(--border-hairline)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <PanelLeft className="w-4 h-4" />
            <span className="hidden sm:inline">{t('explore.stepsAndOsi')}</span>
          </button>

          <div className="min-w-0">
            <div className="flex items-baseline gap-2 min-w-0">
              <h1 className="font-display text-base sm:text-lg font-bold text-[var(--text-primary)] truncate">
                {protocol.name}
              </h1>
              <span className="hidden md:inline text-[13px] text-[var(--text-secondary)] truncate">
                — {protocol.fullName}
              </span>
            </div>
            <div className="hidden sm:flex items-center gap-1.5 font-mono text-xs text-[var(--text-secondary)]">
              <span>{protocol.category}</span>
              <span aria-hidden="true">·</span>
              <span>{t('explore.port')} {protocol.defaultPort}</span>
              <span aria-hidden="true">·</span>
              <span>{t('explore.activeLayer', { layer: activeOsiLayer })}</span>
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
                  ? 'bg-[var(--accent-cta)] text-white'
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
                  ? 'bg-[var(--accent-cta)] text-white'
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

          <input
            ref={pcapInputRef}
            type="file"
            accept=".pcap"
            className="hidden"
            onChange={handlePcapUpload}
          />
          <button
            type="button"
            onClick={() => pcapInputRef.current?.click()}
            title="Import .pcap packet capture file"
            className="flex h-8 items-center gap-1.5 rounded-lg border border-[var(--border-hairline)] px-2.5 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--accent-teal)] whitespace-nowrap shrink-0"
          >
            <FileUp className="w-3.5 h-3.5 text-[var(--accent-teal)]" />
            <span className="hidden sm:inline">Import .pcap</span>
          </button>
        </div>
      </div>

      {/* PCAP Error Toast */}
      {pcapError && (
        <div className="shrink-0 flex items-center justify-between border-b border-[var(--tone-danger)] bg-[var(--tone-danger)]/15 px-3.5 py-1.5 text-xs text-[var(--tone-danger)]">
          <span>{pcapError}</span>
          <button type="button" onClick={() => setPcapError(null)} className="p-0.5">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Active PCAP Replay Banner */}
      {customPcapPackets && customPcapPackets.length > 0 && (
        <div className="shrink-0 flex items-center justify-between border-b border-[var(--border-hairline)] bg-[var(--accent-primary-soft)] px-3.5 py-1.5 text-xs text-[var(--accent-primary)] font-semibold">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            <span>Replaying Custom PCAP: {customPcapPackets.length} Packets</span>
          </div>
          <button
            type="button"
            onClick={() => setCustomPcapPackets(null)}
            className="flex items-center gap-1 rounded bg-[var(--bg-surface)] px-2.5 py-0.5 text-[11px] font-bold text-[var(--text-primary)] border border-[var(--border-hairline)] hover:bg-[var(--bg-inset)]"
          >
            <X className="w-3 h-3" />
            <span>Exit PCAP</span>
          </button>
        </div>
      )}

      {/* Guided First Path Banner */}
      {!customPcapPackets && <GuidedTrackBanner />}

      {/* Main Split Stage: Collapsible Steps & OSI Rail | Full-Width Canvas */}
      <div
        className={`flex flex-col lg:flex-row flex-1 overflow-hidden ${
          welcomeDismissed ? 'min-h-[300px]' : 'min-h-[540px]'
        }`}
      >
        {leftRailOpen && (
          <aside
            aria-label={t('explore.stepsAndOsi')}
            className="w-full lg:w-72 shrink-0 border-b lg:border-b-0 lg:border-e border-[var(--border-hairline)] bg-[var(--bg-surface)] flex flex-col overflow-y-auto"
          >
            <div className="p-3 border-b border-[var(--border-hairline)] space-y-2">
              <div className="flex items-center justify-between px-1">
                <span className="font-display text-xs font-bold text-[var(--text-secondary)]">
                  {t('explore.protocolSteps')} ({protocol.steps.length})
                </span>
                <button
                  type="button"
                  onClick={() => setLeftRailOpen(false)}
                  aria-label={t('drawer.collapse')}
                  className="hidden lg:flex h-6 w-6 items-center justify-center rounded text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
              </div>
              {protocol.steps.map((s, idx) => {
                const active = idx === currentStepIndex;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => selectProtocol(protocol.id, idx)}
                    className={`w-full rounded-lg border px-3 py-2 text-start transition-colors ${
                      active
                        ? 'border-[var(--accent-primary)] bg-[var(--accent-primary-soft)] text-[var(--text-primary)]'
                        : 'border-transparent hover:border-[var(--border-hairline)] bg-[var(--bg-inset)]/50 text-[var(--text-secondary)]'
                    }`}
                  >
                    <div className="flex items-center justify-between font-mono text-[11px]">
                      <span className={active ? 'font-bold text-[var(--accent-primary)]' : 'text-[var(--text-secondary)]'}>
                        {t('playback.step')} {idx + 1}
                      </span>
                      <span className="text-[var(--text-muted)] font-semibold">L{s.osiLayer}</span>
                    </div>
                    <div className="mt-0.5 text-[13px] font-semibold truncate">{s.title}</div>
                  </button>
                );
              })}
            </div>

            {!isSimple && (
              <div className="p-3">
                <OsiRuler activeLayer={activeOsiLayer} />
              </div>
            )}

            {isSimple && (
              <div className="p-3 text-[13px] text-[var(--text-secondary)] space-y-2.5">
                <div className="rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-inset)]/60 p-3">
                  <div className="font-display text-xs font-bold text-[var(--accent-teal)]">{t('explore.eli5')}</div>
                  <p className="mt-1.5 leading-relaxed text-xs">{protocol.eli5}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setExperienceLevel('pro')}
                  className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-inset)] py-2 text-xs font-semibold text-[var(--accent-primary)] hover:border-[var(--accent-primary)]"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{t('welcome.switchToPro')}</span>
                </button>
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
            <span className="font-mono text-[10px] font-bold text-[var(--accent-primary)]">L{activeOsiLayer}</span>
          </div>
        )}

        {/* Dominant Full-Width Canvas + Transport Strip */}
        <div className="flex-1 min-w-0 flex flex-col overflow-hidden bg-[var(--bg-canvas)]">
          {!isSimple && compareMode && (
            <div className="shrink-0 p-3 border-b border-[var(--border-hairline)] bg-[var(--bg-surface)]">
              <CompareView />
            </div>
          )}

          <div className="flex-1 min-h-[240px] flex flex-col overflow-hidden">
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

          {showFinishedRecap && (
            <FinishedRecapCard
              protocolId={protocol.id}
              protocolName={protocol.name}
              onReplay={() => {
                setCurrentPacketIndex(0);
                setCurrentStepIndex(0);
                setIsPlaying(true);
              }}
              onOpenEncapsulation={() => {
                setEncapPacket(activePacket || scenarioResult.packets[0] || null);
              }}
              onDismiss={() => setRecapDismissed(true)}
            />
          )}

          <PlaybackBar
            packets={scenarioResult.packets}
            steps={scenarioResult.steps}
            onProgressChange={setPacketProgress}
          />
        </div>
      </div>

      {/* Bottom Docked Workbench Deck */}
      <section
        aria-label="Explore Logs and Inspector Deck"
        className={`shrink-0 flex flex-col border-t border-[var(--border-strong)] bg-[var(--bg-surface)] transition-[height] duration-150 ${dockHeightClass}`}
      >
        <div className="shrink-0 flex items-center justify-between gap-2 border-b border-[var(--border-hairline)] bg-[var(--bg-inset)] px-3 pt-1.5">
          <div className="flex items-center gap-1 overflow-x-auto">
            {(
              isSimple
                ? ([
                    { id: 'overview', label: t('explore.overview'), icon: BookOpen },
                    { id: 'inspector', label: `${t('explore.packetInspector')}${activePacket ? ` (#${activePacket.no})` : ''}`, icon: Layers },
                  ] as const)
                : ([
                    { id: 'inspector', label: `${t('explore.packetInspector')}${activePacket ? ` (#${activePacket.no})` : ''}`, icon: Layers },
                    { id: 'logs', label: `${t('explore.eventLogs')} (${exploreEventLogs.length})`, icon: ScrollText },
                    { id: 'packets', label: `${t('explore.packetFlow')} (${scenarioResult.packets.length})`, icon: Network },
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
                  className={`relative flex h-9 items-center gap-1.5 rounded-t-lg border-t border-x px-3.5 text-[13px] font-semibold transition-colors whitespace-nowrap shrink-0 ${
                    active
                      ? 'border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[var(--accent-primary)] shadow-2xs -mb-px pb-px'
                      : 'border-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-surface)]/60 hover:text-[var(--text-primary)]'
                  }`}
                >
                  {active && (
                    <span
                      className="absolute inset-x-0 top-0 h-0.5 rounded-t-lg bg-[var(--accent-primary)]"
                      aria-hidden="true"
                    />
                  )}
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}

            {isSimple && (
              <span className="hidden xl:inline-block ms-3 pb-1 text-xs text-[var(--text-secondary)]">
                {t('explore.proHint')}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1 pb-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setDockSize((s) => (s === 'collapsed' ? 'compact' : 'collapsed'))}
              title={dockSize === 'collapsed' ? t('explore.expandDock') : t('explore.collapseDock')}
              aria-label={dockSize === 'collapsed' ? t('explore.expandDock') : t('explore.collapseDock')}
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            >
              {dockSize === 'collapsed' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={() => setDockSize((s) => (s === 'expanded' ? 'compact' : 'expanded'))}
              title={dockSize === 'expanded' ? t('explore.restoreDock') : t('explore.expandDock')}
              aria-label={dockSize === 'expanded' ? t('explore.restoreDock') : t('explore.expandDock')}
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            >
              {dockSize === 'expanded' ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {dockSize !== 'collapsed' && (
          <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
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
                emptyMessage="No protocol step events in this scenario."
              />
            )}

            {dockTab === 'packets' && !isSimple && (
              <div className="flex-1 min-h-0 overflow-y-auto">
                <PacketTable
                  packets={scenarioResult.packets}
                  currentPacketIndex={safePacketIndex}
                  filenamePrefix={`gg-${protocol.id}`}
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

      {encapPacket && (
        <EncapsulationModal
          packet={encapPacket}
          onClose={() => setEncapPacket(null)}
        />
      )}
    </div>
  );
};
