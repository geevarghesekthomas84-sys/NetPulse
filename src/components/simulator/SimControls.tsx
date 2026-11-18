import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  Camera,
  Check,
  ChevronDown,
  Download,
  FolderOpen,
  Keyboard,
  LayoutTemplate,
  PanelRight,
  Pause,
  Play,
  RotateCcw,
  Save,
  Share2,
  ShieldAlert,
  SkipBack,
  StepForward,
  Upload,
  X,
  Zap,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { SimDevice, TopologyWarning } from '../../engine/types';
import { SIM_PLAYBACK_SPEEDS } from '../../lib/simPlayback';
import { PRESET_LABS } from '../../simulator/labs';
import { STARTER_TEMPLATES, type StarterTemplate } from '../../simulator/templates';
import { useAppStore } from '../../store/useAppStore';

interface SimControlsProps {
  clockMs: number;
  devices: SimDevice[];
  warnings: TopologyWarning[];
  labsOpen: boolean;
  inspectorOpen: boolean;
  playbackMode: 'live' | 'step';
  stepCursor: number;
  totalSteps: number;
  shortcutsOpen?: boolean;
  onChangePlaybackMode: (mode: 'live' | 'step') => void;
  onTogglePlayPause?: () => void;
  onToggleShortcuts?: () => void;
  onToggleLabs: () => void;
  onToggleInspector: () => void;
  onStep: () => void;
  onStepBack: () => void;
  onReset: () => void;
  onFaultAction: (fault: 'cut_link' | 'loss_20' | 'dup_ip' | 'low_mtu' | 'block_80') => void;
  onTrafficGen: (mode: 'cbr' | 'burst' | 'ping_flood' | 'http_load' | 'iperf', srcId: string, dstId: string) => void;
  onShareUrl: () => Promise<void>;
  onExportJson: () => void;
  onExportPng: () => void;
  onImportJson: (jsonText: string) => void;
  onApplyTemplate?: (template: StarterTemplate) => void;
}

export const SimControls: React.FC<SimControlsProps> = ({
  clockMs,
  devices,
  warnings,
  labsOpen,
  inspectorOpen,
  playbackMode,
  stepCursor,
  totalSteps,
  shortcutsOpen = false,
  onChangePlaybackMode,
  onTogglePlayPause,
  onToggleShortcuts,
  onToggleLabs,
  onToggleInspector,
  onStep,
  onStepBack,
  onReset,
  onFaultAction,
  onTrafficGen,
  onShareUrl,
  onExportJson,
  onExportPng,
  onImportJson,
  onApplyTemplate,
}) => {
  const { t } = useTranslation();
  const {
    experienceLevel,
    setExperienceLevel,
    activeLabId,
    completedLabs,
    simPlaying,
    setSimPlaying,
    simSpeed,
    setSimSpeed,
    savedProjects,
    saveNamedProject,
    loadNamedProject,
    settings,
    updateSettings,
  } = useAppStore();

  const isPro = experienceLevel === 'pro';
  const [srcId, setSrcId] = useState(devices[0]?.id ?? '');
  const [dstId, setDstId] = useState(devices[devices.length - 1]?.id ?? '');
  const [trafficMode, setTrafficMode] = useState<'cbr' | 'burst' | 'ping_flood' | 'http_load' | 'iperf'>('http_load');
  const [openMenu, setOpenMenu] = useState<'none' | 'templates' | 'traffic' | 'faults' | 'project'>('none');
  const [saveName, setSaveName] = useState('');
  const [copiedUrl, setCopiedUrl] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Floating Popover anchor refs for outside click dismissal
  const templatesRef = useRef<HTMLDivElement>(null);
  const trafficRef = useRef<HTMLDivElement>(null);
  const faultsRef = useRef<HTMLDivElement>(null);
  const projectRef = useRef<HTMLDivElement>(null);

  const activeLab = PRESET_LABS.find((l) => l.id === activeLabId) ?? PRESET_LABS[0];
  const effectiveSrc = devices.some((d) => d.id === srcId) ? srcId : devices[0]?.id ?? '';
  const effectiveDst = devices.some((d) => d.id === dstId) ? dstId : devices[devices.length - 1]?.id ?? '';

  const toggleMenu = (target: 'templates' | 'traffic' | 'faults' | 'project') =>
    setOpenMenu((curr) => (curr === target ? 'none' : target));

  // Handle outside click & escape key to dismiss floating popovers gracefully
  useEffect(() => {
    if (openMenu === 'none') return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenMenu('none');
    };

    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (openMenu === 'templates' && templatesRef.current && !templatesRef.current.contains(target)) {
        setOpenMenu('none');
      } else if (openMenu === 'traffic' && trafficRef.current && !trafficRef.current.contains(target)) {
        setOpenMenu('none');
      } else if (openMenu === 'faults' && faultsRef.current && !faultsRef.current.contains(target)) {
        setOpenMenu('none');
      } else if (openMenu === 'project' && projectRef.current && !projectRef.current.contains(target)) {
        setOpenMenu('none');
      }
    };

    window.addEventListener('keydown', onKeyDown);
    document.addEventListener('mousedown', onMouseDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('mousedown', onMouseDown);
    };
  }, [openMenu]);

  return (
    <header
      aria-label="Simulator Command Bar"
      className="relative shrink-0 border-b border-[var(--border-hairline)] bg-[var(--bg-surface)] z-30 select-none"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-3 py-1.5 sm:px-4 sm:py-2">
        {/* Cluster 1 (Left): Scenario, Labs & Templates Context */}
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
          {/* Guided Labs Badge & Selector */}
          <button
            type="button"
            onClick={onToggleLabs}
            aria-expanded={labsOpen}
            title={`${t('simulator.labs')}: ${activeLab.title}`}
            className={`flex h-8.5 items-center gap-1.5 sm:gap-2 rounded-lg border px-2.5 sm:px-3 text-xs sm:text-[13px] font-semibold transition-all whitespace-nowrap shrink-0 shadow-2xs ${
              labsOpen
                ? 'border-[var(--accent-primary)] bg-[var(--accent-primary-soft)] text-[var(--accent-primary)] ring-1 ring-[var(--accent-primary)]/40'
                : 'border-[var(--border-hairline)] bg-[var(--bg-inset)] text-[var(--text-primary)] hover:border-[var(--accent-primary)]'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[var(--accent-primary)] shrink-0" />
            <span className="font-semibold truncate max-w-[110px] sm:max-w-[150px] md:max-w-[180px]">
              {t('simulator.labs')} #{activeLab.number}
            </span>
            <span className="font-mono text-[10.5px] font-bold text-[var(--accent-primary)] bg-[var(--accent-primary-soft)] px-1.5 py-0.5 rounded border border-[var(--accent-primary)]/30 tabular-nums">
              {completedLabs.length}/23
            </span>
            <ChevronDown className={`w-3.5 h-3.5 text-[var(--text-secondary)] transition-transform duration-150 ${labsOpen ? 'rotate-180' : ''}`} />
          </button>

          {/* Starter Templates Popover Trigger */}
          {onApplyTemplate && (
            <div className="relative" ref={templatesRef}>
              <button
                type="button"
                onClick={() => toggleMenu('templates')}
                aria-expanded={openMenu === 'templates'}
                className={`flex h-8.5 items-center gap-1.5 rounded-lg border px-2.5 sm:px-3 text-xs sm:text-[13px] font-semibold transition-all whitespace-nowrap shrink-0 shadow-2xs ${
                  openMenu === 'templates'
                    ? 'border-[var(--accent-teal)] bg-[var(--accent-teal-soft)] text-[var(--accent-teal)] ring-1 ring-[var(--accent-teal)]/40'
                    : 'border-[var(--border-hairline)] bg-[var(--bg-inset)] text-[var(--text-primary)] hover:border-[var(--accent-teal)]'
                }`}
              >
                <LayoutTemplate className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[var(--accent-teal)] shrink-0" />
                <span>{t('simulator.templates')}</span>
                <ChevronDown className={`w-3 h-3 text-[var(--text-secondary)] transition-transform duration-150 ${openMenu === 'templates' ? 'rotate-180' : ''}`} />
              </button>

              {/* Anchored Floating Templates Studio Popover */}
              {openMenu === 'templates' && (
                <div
                  role="region"
                  aria-label={t('simulator.templates')}
                  className="absolute start-0 top-full mt-2 z-50 w-[92vw] sm:w-[580px] md:w-[700px] lg:w-[820px] max-w-4xl rounded-2xl border border-[var(--border-strong)] bg-[var(--bg-surface)] p-3.5 sm:p-4 shadow-2xl backdrop-blur-md animate-in fade-in zoom-in-95"
                >
                  <div className="flex items-center justify-between gap-2 pb-3 border-b border-[var(--border-hairline)]">
                    <div className="flex items-center gap-2 min-w-0">
                      <LayoutTemplate className="w-4 h-4 text-[var(--accent-teal)] shrink-0" />
                      <span className="font-display text-sm sm:text-base font-bold text-[var(--text-primary)]">
                        {t('simulator.templates')}
                      </span>
                      <span className="text-xs text-[var(--text-secondary)] truncate hidden sm:inline">
                        · {t('simulator.templatesHint')}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setOpenMenu('none')}
                      aria-label="Close templates dialog"
                      className="rounded-lg p-1 text-[var(--text-secondary)] hover:bg-[var(--bg-inset)] hover:text-[var(--text-primary)] transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid gap-2.5 pt-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 max-h-[60vh] overflow-y-auto pe-1">
                    {STARTER_TEMPLATES.map((tpl) => (
                      <button
                        key={tpl.id}
                        type="button"
                        data-template-id={tpl.id}
                        onClick={() => {
                          onApplyTemplate(tpl);
                          setOpenMenu('none');
                        }}
                        className="flex flex-col items-start justify-between gap-2 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-inset)]/40 hover:bg-[var(--bg-inset)] p-3 text-start hover:border-[var(--accent-teal)] transition-all group"
                      >
                        <div className="w-full flex items-center justify-between gap-2">
                          <span className="font-display text-xs sm:text-sm font-bold text-[var(--text-primary)] group-hover:text-[var(--accent-teal)] transition-colors truncate">
                            {t(tpl.nameKey, { defaultValue: tpl.fallbackName })}
                          </span>
                        </div>
                        <span className="text-[11.5px] text-[var(--text-secondary)] line-clamp-2 leading-relaxed">
                          {t(tpl.descKey, { defaultValue: tpl.fallbackDesc })}
                        </span>
                        <div className="flex items-center justify-between w-full pt-1 border-t border-[var(--border-hairline)]/60">
                          <span className="font-mono text-[11px] font-semibold text-[var(--accent-teal)] tabular-nums">
                            {tpl.devices.length} {t('simulator.nodes')} · {tpl.links.length} {t('simulator.links')}
                          </span>
                          <span className="text-[10px] font-medium text-[var(--text-muted)] group-hover:text-[var(--text-primary)]">
                            Apply →
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Topology Warnings / Diagnostic Alerts Chip */}
          {warnings.length > 0 && isPro && (
            <div className="relative" ref={faultsRef}>
              <button
                type="button"
                onClick={() => toggleMenu('faults')}
                aria-expanded={openMenu === 'faults'}
                title={warnings.map((w) => w.message).join('\n')}
                className="flex h-8.5 items-center gap-1.5 rounded-lg border border-[var(--tone-warning)]/50 bg-[var(--tone-warning)]/15 px-2.5 text-xs font-semibold text-[var(--tone-warning)] whitespace-nowrap shrink-0 tabular-nums shadow-2xs hover:bg-[var(--tone-warning)]/25 transition-colors"
              >
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>{warnings.length} alert{warnings.length > 1 ? 's' : ''}</span>
              </button>
            </div>
          )}
        </div>

        {/* Cluster 2 (Center): Unified Precision Transport Deck & Time Readout */}
        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap justify-center">
          {/* Segmented Mode Toggle: Live vs Step */}
          <div
            role="group"
            aria-label="Simulation playback mode"
            className="inline-flex items-center rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-inset)] p-0.5 shadow-2xs"
          >
            <button
              type="button"
              onClick={() => onChangePlaybackMode('live')}
              aria-pressed={playbackMode === 'live'}
              title={`${t('simulator.liveMode')} (M)`}
              className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-all whitespace-nowrap shrink-0 ${
                playbackMode === 'live'
                  ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-xs'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {t('simulator.liveMode')}
            </button>
            <button
              type="button"
              onClick={() => onChangePlaybackMode('step')}
              aria-pressed={playbackMode === 'step'}
              title={`${t('simulator.stepByStepMode')} (M)`}
              className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-all whitespace-nowrap shrink-0 ${
                playbackMode === 'step'
                  ? 'bg-[var(--accent-teal)] text-white shadow-xs'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {t('simulator.stepByStepMode')}
            </button>
          </div>

          {/* Precision Digital Clock Display */}
          <div
            title="Simulation Virtual Elapsed Time"
            className="flex h-8.5 items-center rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-inset)] px-2.5 font-mono text-xs sm:text-[13px] font-bold text-[var(--accent-primary)] tabular-nums shadow-2xs"
          >
            t = {(clockMs / 1000).toFixed(3)}s
          </div>

          {/* Transport Button Island */}
          <div className="inline-flex items-center rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-inset)] p-0.5 gap-0.5 shadow-2xs">
            {/* Reset */}
            <button
              type="button"
              onClick={onReset}
              title={`${t('simulator.reset')} (R)`}
              aria-label={t('simulator.reset')}
              className="flex h-7.5 w-7.5 sm:w-8 items-center justify-center rounded-md text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>

            {/* Step Back (In Step mode) */}
            {playbackMode === 'step' && (
              <button
                type="button"
                onClick={onStepBack}
                disabled={stepCursor <= 0}
                aria-label={t('simulator.stepBack')}
                title={`${t('simulator.stepBack')} (←)`}
                className="flex h-7.5 w-7.5 sm:w-8 items-center justify-center rounded-md text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] disabled:opacity-35 transition-colors"
              >
                <SkipBack className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Main Play / Pause CTA */}
            <button
              type="button"
              onClick={() => (onTogglePlayPause ? onTogglePlayPause() : setSimPlaying(!simPlaying))}
              title={`${simPlaying ? t('simulator.pause') : t('simulator.run')} (Space)`}
              className={`flex h-7.5 items-center gap-1.5 rounded-md px-3 sm:px-3.5 text-xs font-bold transition-all shadow-xs ${
                simPlaying
                  ? 'bg-amber-600 hover:bg-amber-500 text-white'
                  : 'bg-[var(--accent-cta)] hover:bg-[var(--accent-cta-hover)] text-white'
              }`}
            >
              {simPlaying ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current" />}
              <span>
                {simPlaying
                  ? t('simulator.pause')
                  : playbackMode === 'step' && stepCursor > 0 && stepCursor < totalSteps
                  ? t('simulator.resume')
                  : t('simulator.run')}
              </span>
            </button>

            {/* Step Next */}
            <button
              type="button"
              onClick={onStep}
              aria-label={playbackMode === 'step' ? t('simulator.stepNext') : t('simulator.step')}
              title={`${playbackMode === 'step' ? t('simulator.stepNext') : t('simulator.step')} (→)`}
              className="flex h-7.5 items-center gap-1 rounded-md px-2 text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-colors"
            >
              <StepForward className="w-3.5 h-3.5" />
              <span className="hidden md:inline">
                {playbackMode === 'step' ? t('simulator.stepNext') : t('simulator.step')}
              </span>
            </button>

            {/* Playback Speed Selector */}
            {(isPro || playbackMode === 'step') && (
              <select
                aria-label="Simulation speed"
                title={`${t('simulator.shortcutSpeed')} (+/-)`}
                value={simSpeed}
                onChange={(e) => setSimSpeed(Number(e.target.value))}
                className="h-7.5 rounded-md border-0 bg-transparent px-1.5 font-mono text-xs font-bold text-[var(--text-primary)] hover:bg-[var(--bg-surface)] cursor-pointer focus:outline-none"
              >
                {SIM_PLAYBACK_SPEEDS.map((s) => (
                  <option key={s} value={s}>
                    {s}x
                  </option>
                ))}
              </select>
            )}

            {/* Keyboard Shortcuts (?) Button */}
            {onToggleShortcuts && (
              <button
                type="button"
                onClick={onToggleShortcuts}
                aria-label={t('simulator.shortcutsTitle')}
                aria-expanded={shortcutsOpen}
                title={`${t('simulator.shortcutsTitle')} (?)`}
                className={`flex h-7.5 w-7.5 items-center justify-center rounded-md transition-colors ${
                  shortcutsOpen
                    ? 'bg-[var(--accent-primary-soft)] text-[var(--accent-primary)] font-bold'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)]'
                }`}
              >
                <Keyboard className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Datacenter Web Audio Sound Effects Toggle */}
            <button
              type="button"
              onClick={() => updateSettings({ soundEffects: !settings.soundEffects })}
              aria-label={settings.soundEffects ? 'Mute datacenter sound effects' : 'Enable datacenter sound effects'}
              title={settings.soundEffects ? 'Sound Effects: ON (Click to mute)' : 'Sound Effects: OFF (Click to unmute)'}
              className={`flex h-7.5 w-7.5 items-center justify-center rounded-md transition-colors ${
                settings.soundEffects
                  ? 'bg-[var(--accent-primary-soft)] text-[var(--accent-primary)] font-bold'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)]'
              }`}
            >
              {settings.soundEffects ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Cluster 3 (Right): Simulation Tools, Share/Export & Inspector Toggles */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Traffic Generator Popover Button (Pro Mode) */}
          {isPro && (
            <div className="relative" ref={trafficRef}>
              <button
                type="button"
                onClick={() => toggleMenu('traffic')}
                aria-expanded={openMenu === 'traffic'}
                className={`flex h-8.5 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold transition-all whitespace-nowrap shrink-0 shadow-2xs ${
                  openMenu === 'traffic'
                    ? 'border-[var(--accent-primary)] bg-[var(--accent-primary-soft)] text-[var(--accent-primary)] ring-1 ring-[var(--accent-primary)]/40'
                    : 'border-[var(--border-hairline)] bg-[var(--bg-inset)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--accent-primary)]'
                }`}
              >
                <Zap className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                <span className="hidden sm:inline">Traffic Gen</span>
              </button>

              {/* Anchored Floating Traffic Generator Popover */}
              {openMenu === 'traffic' && (
                <div
                  role="region"
                  aria-label="Generate Traffic"
                  className="absolute end-0 top-full mt-2 z-50 w-80 sm:w-96 rounded-2xl border border-[var(--border-strong)] bg-[var(--bg-surface)] p-4 shadow-2xl backdrop-blur-md animate-in fade-in zoom-in-95 space-y-3"
                >
                  <div className="flex items-center justify-between pb-2 border-b border-[var(--border-hairline)]">
                    <span className="font-display text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
                      <Zap className="w-4 h-4 text-[var(--accent-primary)]" />
                      Generate Network Traffic
                    </span>
                    <button
                      type="button"
                      onClick={() => setOpenMenu('none')}
                      className="rounded-lg p-1 text-[var(--text-secondary)] hover:bg-[var(--bg-inset)] hover:text-[var(--text-primary)]"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-[var(--text-secondary)]">Source Device:</label>
                      <select
                        aria-label="Traffic source"
                        value={effectiveSrc}
                        onChange={(e) => setSrcId(e.target.value)}
                        className="w-full h-8 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-inset)] px-2.5 font-mono text-xs text-[var(--text-primary)]"
                      >
                        {devices.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name} ({d.interfaces[0]?.ip || 'no-ip'})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-[var(--text-secondary)]">Destination Device:</label>
                      <select
                        aria-label="Traffic destination"
                        value={effectiveDst}
                        onChange={(e) => setDstId(e.target.value)}
                        className="w-full h-8 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-inset)] px-2.5 font-mono text-xs text-[var(--text-primary)]"
                      >
                        {devices.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name} ({d.interfaces[0]?.ip || 'no-ip'})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-[var(--text-secondary)]">Traffic Pattern:</label>
                      <select
                        aria-label="Traffic pattern"
                        value={trafficMode}
                        onChange={(e) => setTrafficMode(e.target.value as typeof trafficMode)}
                        className="w-full h-8 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-inset)] px-2.5 font-mono text-xs text-[var(--text-primary)]"
                      >
                        <option value="http_load">HTTP Load (Web Request / Response)</option>
                        <option value="iperf">iPerf3 TCP cwnd (Window Probing)</option>
                        <option value="cbr">CBR UDP (Constant Bitrate Stream)</option>
                        <option value="burst">Large Burst (1400B Fragmentation)</option>
                        <option value="ping_flood">ICMP Ping Flood (Echo Diagnostics)</option>
                      </select>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        onTrafficGen(trafficMode, effectiveSrc, effectiveDst);
                        setOpenMenu('none');
                      }}
                      className="w-full mt-2 h-8.5 rounded-lg bg-[var(--accent-cta)] hover:bg-[var(--accent-cta-hover)] px-3 text-xs font-bold text-white transition-colors shadow-xs"
                    >
                      Send Packets
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Fault Injection Popover Button (Pro Mode) */}
          {isPro && (
            <div className="relative" ref={faultsRef}>
              <button
                type="button"
                onClick={() => toggleMenu('faults')}
                aria-expanded={openMenu === 'faults'}
                className={`flex h-8.5 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold transition-all whitespace-nowrap shrink-0 shadow-2xs ${
                  openMenu === 'faults'
                    ? 'border-[var(--tone-warning)] bg-[var(--tone-warning)]/15 text-[var(--tone-warning)] ring-1 ring-[var(--tone-warning)]/40'
                    : 'border-[var(--border-hairline)] bg-[var(--bg-inset)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--tone-warning)]'
                }`}
              >
                <ShieldAlert className="w-3.5 h-3.5 text-[var(--tone-warning)]" />
                <span className="hidden sm:inline">{t('simulator.faults')}</span>
              </button>

              {/* Anchored Floating Fault Injection Popover */}
              {openMenu === 'faults' && (
                <div
                  role="region"
                  aria-label="Network Fault Injection"
                  className="absolute end-0 top-full mt-2 z-50 w-80 sm:w-96 rounded-2xl border border-[var(--border-strong)] bg-[var(--bg-surface)] p-4 shadow-2xl backdrop-blur-md animate-in fade-in zoom-in-95 space-y-3"
                >
                  <div className="flex items-center justify-between pb-2 border-b border-[var(--border-hairline)]">
                    <span className="font-display text-sm font-bold text-[var(--tone-warning)] flex items-center gap-2">
                      <ShieldAlert className="w-4 h-4 text-[var(--tone-warning)]" />
                      Inject Network Fault
                    </span>
                    <button
                      type="button"
                      onClick={() => setOpenMenu('none')}
                      className="rounded-lg p-1 text-[var(--text-secondary)] hover:bg-[var(--bg-inset)] hover:text-[var(--text-primary)]"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => onFaultAction('cut_link')}
                      className="flex items-center justify-between rounded-lg border border-[var(--tone-danger)]/40 bg-[var(--tone-danger)]/10 px-3 py-2 text-xs font-medium text-[var(--tone-danger)] hover:bg-[var(--tone-danger)]/20 transition-colors"
                    >
                      <span>Cut / Restore Selected Link</span>
                      <span className="text-[10px] font-mono">Link State</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onFaultAction('loss_20')}
                      className="flex items-center justify-between rounded-lg border border-[var(--tone-warning)]/40 bg-[var(--tone-warning)]/10 px-3 py-2 text-xs font-medium text-[var(--tone-warning)] hover:bg-[var(--tone-warning)]/20 transition-colors"
                    >
                      <span>Toggle 20% Packet Loss</span>
                      <span className="text-[10px] font-mono">Impairment</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onFaultAction('low_mtu')}
                      className="flex items-center justify-between rounded-lg border border-[var(--tone-warning)]/40 bg-[var(--tone-warning)]/10 px-3 py-2 text-xs font-medium text-[var(--tone-warning)] hover:bg-[var(--tone-warning)]/20 transition-colors"
                    >
                      <span>MTU 576 Bottleneck</span>
                      <span className="text-[10px] font-mono">Fragmentation</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onFaultAction('dup_ip')}
                      className="flex items-center justify-between rounded-lg border border-[var(--tone-danger)]/40 bg-[var(--tone-danger)]/10 px-3 py-2 text-xs font-medium text-[var(--tone-danger)] hover:bg-[var(--tone-danger)]/20 transition-colors"
                    >
                      <span>Duplicate IP Conflict</span>
                      <span className="text-[10px] font-mono">ARP Spoof</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onFaultAction('block_80')}
                      className="flex items-center justify-between rounded-lg border border-[var(--tone-danger)]/40 bg-[var(--tone-danger)]/10 px-3 py-2 text-xs font-medium text-[var(--tone-danger)] hover:bg-[var(--tone-danger)]/20 transition-colors"
                    >
                      <span>Firewall Block :80</span>
                      <span className="text-[10px] font-mono">ACL Filter</span>
                    </button>
                  </div>

                  {warnings.length > 0 && (
                    <div className="space-y-1.5 border-t border-[var(--border-hairline)] pt-2.5 max-h-36 overflow-y-auto">
                      <div className="text-[11px] font-bold text-[var(--tone-warning)] uppercase tracking-wide">
                        Active Topology Alerts:
                      </div>
                      {warnings.map((w) => (
                        <div key={w.id} className="flex items-start gap-1.5 text-[11.5px] text-[var(--tone-warning)]">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                          <span>{w.message}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Save / Share / Export Popover Button (Pro Mode) */}
          {isPro && (
            <div className="relative" ref={projectRef}>
              <button
                type="button"
                onClick={() => toggleMenu('project')}
                aria-expanded={openMenu === 'project'}
                className={`flex h-8.5 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold transition-all whitespace-nowrap shrink-0 shadow-2xs ${
                  openMenu === 'project'
                    ? 'border-[var(--accent-primary)] bg-[var(--accent-primary-soft)] text-[var(--accent-primary)] ring-1 ring-[var(--accent-primary)]/40'
                    : 'border-[var(--border-hairline)] bg-[var(--bg-inset)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--accent-primary)]'
                }`}
              >
                <Save className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{t('common.save')} / {t('explore.share')}</span>
              </button>

              {/* Anchored Floating Save / Share Popover */}
              {openMenu === 'project' && (
                <div
                  role="region"
                  aria-label="Save and Share Topology"
                  className="absolute end-0 top-full mt-2 z-50 w-80 sm:w-[420px] rounded-2xl border border-[var(--border-strong)] bg-[var(--bg-surface)] p-4 shadow-2xl backdrop-blur-md animate-in fade-in zoom-in-95 space-y-3.5"
                >
                  <div className="flex items-center justify-between pb-2 border-b border-[var(--border-hairline)]">
                    <span className="font-display text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
                      <Save className="w-4 h-4 text-[var(--accent-primary)]" />
                      Save, Export & Share Topology
                    </span>
                    <button
                      type="button"
                      onClick={() => setOpenMenu('none')}
                      className="rounded-lg p-1 text-[var(--text-secondary)] hover:bg-[var(--bg-inset)] hover:text-[var(--text-primary)]"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Save Snapshot Section */}
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      saveNamedProject(saveName || `Topology ${savedProjects.length + 1}`);
                      setSaveName('');
                    }}
                    className="flex items-center gap-1.5"
                  >
                    <input
                      type="text"
                      value={saveName}
                      onChange={(e) => setSaveName(e.target.value)}
                      placeholder="Snapshot name..."
                      className="h-8 flex-1 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-inset)] px-2.5 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-primary)]"
                    />
                    <button
                      type="submit"
                      className="h-8 rounded-lg bg-[var(--accent-cta)] hover:bg-[var(--accent-cta-hover)] px-3 text-xs font-semibold text-white transition-colors"
                    >
                      {t('common.save')}
                    </button>
                  </form>

                  {/* Export & Import Actions */}
                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-[var(--border-hairline)]">
                    <button
                      type="button"
                      onClick={onExportJson}
                      className="flex h-8 items-center justify-center gap-1.5 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-inset)] px-2.5 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--accent-primary)] transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Export JSON</span>
                    </button>

                    <button
                      type="button"
                      onClick={onExportPng}
                      title={t('simulator.exportPngTooltip')}
                      className="flex h-8 items-center justify-center gap-1.5 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-inset)] px-2.5 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--accent-primary)] transition-colors"
                    >
                      <Camera className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                      <span>{t('simulator.exportPng')}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex h-8 items-center justify-center gap-1.5 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-inset)] px-2.5 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--accent-primary)] transition-colors"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Import JSON</span>
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".json,application/json"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onload = () => {
                          if (typeof reader.result === 'string') onImportJson(reader.result);
                        };
                        reader.readAsText(file);
                      }}
                    />

                    <button
                      type="button"
                      onClick={async () => {
                        await onShareUrl();
                        setCopiedUrl(true);
                        setTimeout(() => setCopiedUrl(false), 1800);
                      }}
                      className="flex h-8 items-center justify-center gap-1.5 rounded-lg border border-[var(--accent-primary)]/50 bg-[var(--accent-primary-soft)] px-2.5 text-xs font-semibold text-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/20 transition-colors"
                    >
                      {copiedUrl ? <Check className="w-3.5 h-3.5 text-[var(--tone-success)]" /> : <Share2 className="w-3.5 h-3.5" />}
                      <span>{copiedUrl ? t('explore.copied') : t('explore.copyLink')}</span>
                    </button>
                  </div>

                  {/* Saved Snapshots Browser */}
                  {savedProjects.length > 0 && (
                    <div className="space-y-1.5 pt-2 border-t border-[var(--border-hairline)]">
                      <span className="text-[11px] font-semibold text-[var(--text-muted)]">Saved snapshots:</span>
                      <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
                        {savedProjects.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => {
                              loadNamedProject(p.id);
                              setOpenMenu('none');
                            }}
                            className="flex items-center gap-1.5 rounded-md border border-[var(--border-hairline)] bg-[var(--bg-inset)] px-2 py-1 text-xs text-[var(--text-primary)] hover:border-[var(--accent-primary)]/60 transition-colors"
                          >
                            <FolderOpen className="w-3 h-3 text-[var(--accent-primary)]" />
                            <span>{p.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Properties Panel Toggle Button (Pro Mode) */}
          {isPro && (
            <button
              type="button"
              onClick={onToggleInspector}
              aria-pressed={inspectorOpen}
              title="Toggle Properties Inspector"
              className={`flex h-8.5 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold transition-all whitespace-nowrap shrink-0 shadow-2xs ${
                inspectorOpen
                  ? 'border-[var(--accent-primary)]/60 bg-[var(--accent-primary-soft)] text-[var(--accent-primary)]'
                  : 'border-[var(--border-hairline)] bg-[var(--bg-inset)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--accent-primary)]'
              }`}
            >
              <PanelRight className="w-3.5 h-3.5" />
              <span className="hidden xl:inline">{t('simulator.properties')}</span>
            </button>
          )}

          {/* Experience Level Switcher Pill (Simple <-> Pro) */}
          <div
            role="group"
            aria-label="Experience Level"
            className="inline-flex items-center rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-inset)] p-0.5 shadow-2xs"
          >
            <button
              type="button"
              onClick={() => setExperienceLevel('simple')}
              aria-pressed={!isPro}
              title="Clean, focused view for beginners and quick lab practice"
              className={`rounded-md px-2 py-1 text-[11px] font-semibold transition-all whitespace-nowrap shrink-0 ${
                !isPro
                  ? 'bg-[var(--bg-surface)] text-[var(--accent-primary)] shadow-xs'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              Simple
            </button>
            <button
              type="button"
              onClick={() => setExperienceLevel('pro')}
              aria-pressed={isPro}
              title="Pro Packet Tracer workspace: hardware palette, CLI, PDU list & properties"
              className={`rounded-md px-2 py-1 text-[11px] font-semibold transition-all whitespace-nowrap shrink-0 ${
                isPro
                  ? 'bg-[var(--accent-primary)] text-white shadow-xs'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              Pro
            </button>
          </div>
        </div>
      </div>

      {/* Contextual Keyboard Shortcuts Strip */}
      {shortcutsOpen && (
        <div
          role="dialog"
          aria-label={t('simulator.shortcutsTitle')}
          className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border-hairline)] bg-[var(--bg-inset)] px-4 py-2 text-xs animate-in slide-in-from-top-1"
        >
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
            <span className="font-semibold text-[var(--accent-primary)] flex items-center gap-1.5">
              <Keyboard className="w-3.5 h-3.5" />
              {t('simulator.shortcutsTitle')}:
            </span>
            {[
              { keys: 'Space', label: t('simulator.shortcutPlayPause') },
              { keys: '→', label: t('simulator.shortcutStepForward') },
              { keys: '←', label: t('simulator.shortcutStepBack') },
              { keys: 'M', label: t('simulator.shortcutToggleMode') },
              { keys: 'R', label: t('simulator.shortcutReset') },
              { keys: '+ / -', label: t('simulator.shortcutSpeed') },
              { keys: 'Home / End', label: t('simulator.shortcutRewindEnd') },
            ].map((item) => (
              <span key={item.keys} className="inline-flex items-center gap-1.5 text-[var(--text-secondary)]">
                <kbd className="rounded border border-[var(--border-strong)] bg-[var(--bg-surface)] px-1.5 py-0.5 font-mono text-[10px] font-bold text-[var(--text-primary)]">
                  {item.keys}
                </kbd>
                <span>{item.label}</span>
              </span>
            ))}
          </div>
          {onToggleShortcuts && (
            <button
              type="button"
              onClick={onToggleShortcuts}
              className="rounded border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-2 py-0.5 text-[11px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            >
              {t('common.close')}
            </button>
          )}
        </div>
      )}
    </header>
  );
};
