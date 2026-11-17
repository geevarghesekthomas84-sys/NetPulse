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
  Zap,
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
    activeLabId,
    completedLabs,
    simPlaying,
    setSimPlaying,
    simSpeed,
    setSimSpeed,
    savedProjects,
    saveNamedProject,
    loadNamedProject,
  } = useAppStore();

  const isPro = experienceLevel === 'pro';
  const [srcId, setSrcId] = useState(devices[0]?.id ?? '');
  const [dstId, setDstId] = useState(devices[devices.length - 1]?.id ?? '');
  const [trafficMode, setTrafficMode] = useState<'cbr' | 'burst' | 'ping_flood' | 'http_load' | 'iperf'>('http_load');
  const [openMenu, setOpenMenu] = useState<'none' | 'templates' | 'traffic' | 'faults' | 'project'>('none');
  const [saveName, setSaveName] = useState('');
  const [copiedUrl, setCopiedUrl] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeLab = PRESET_LABS.find((l) => l.id === activeLabId) ?? PRESET_LABS[0];
  const effectiveSrc = devices.some((d) => d.id === srcId) ? srcId : devices[0]?.id ?? '';
  const effectiveDst = devices.some((d) => d.id === dstId)
    ? dstId
    : devices[devices.length - 1]?.id ?? '';

  const toggleMenu = (target: 'templates' | 'traffic' | 'faults' | 'project') =>
    setOpenMenu((curr) => (curr === target ? 'none' : target));

  useEffect(() => {
    if (openMenu === 'none') return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenMenu('none');
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [openMenu]);

  return (
    <div className="relative shrink-0 border-b border-[var(--border-hairline)] bg-[var(--bg-surface)] z-20">
      <div className="flex flex-wrap items-center justify-between gap-2.5 px-3.5 py-2">
        {/* Zone 1: Scenario & Topology Context */}
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={onToggleLabs}
            aria-expanded={labsOpen}
            className={`flex h-9 items-center gap-2 rounded-lg border px-3 text-[13px] font-semibold transition-colors whitespace-nowrap shrink-0 ${
              labsOpen
                ? 'border-[var(--accent-primary)] bg-[var(--accent-primary-soft)] text-[var(--accent-primary)] shadow-2xs'
                : 'border-[var(--border-hairline)] bg-[var(--bg-inset)] text-[var(--text-primary)] hover:border-[var(--accent-primary)]'
            }`}
          >
            <BookOpen className="w-4 h-4 text-[var(--accent-primary)] shrink-0" />
            <span>
              {t('simulator.labs')} #{activeLab.number}
            </span>
            <span className="font-mono text-[11px] font-bold text-[var(--accent-primary)] bg-[var(--accent-primary-soft)] px-1.5 py-0.5 rounded border border-[var(--accent-primary)]/30 tabular-nums">
              {completedLabs.length}/23
            </span>
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${labsOpen ? 'rotate-180' : ''}`} />
          </button>

          {onApplyTemplate && (
            <button
              type="button"
              onClick={() => toggleMenu('templates')}
              aria-expanded={openMenu === 'templates'}
              className={`flex h-9 items-center gap-1.5 rounded-lg border px-3 text-[13px] font-semibold transition-colors whitespace-nowrap shrink-0 ${
                openMenu === 'templates'
                  ? 'border-[var(--accent-teal)] bg-[var(--accent-teal-soft)] text-[var(--accent-teal)]'
                  : 'border-[var(--border-hairline)] bg-[var(--bg-inset)] text-[var(--text-primary)] hover:border-[var(--accent-teal)]'
              }`}
            >
              <LayoutTemplate className="w-4 h-4 text-[var(--accent-teal)] shrink-0" />
              <span>{t('simulator.templates')}</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${openMenu === 'templates' ? 'rotate-180' : ''}`} />
            </button>
          )}

          {warnings.length > 0 && isPro && (
            <button
              type="button"
              onClick={() => toggleMenu('faults')}
              title={warnings.map((w) => w.message).join('\n')}
              className="flex h-9 items-center gap-1.5 rounded-lg border border-[var(--tone-warning)]/50 bg-[var(--tone-warning)]/12 px-3 text-xs font-semibold text-[var(--tone-warning)] whitespace-nowrap shrink-0 tabular-nums"
            >
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{warnings.length} alert{warnings.length > 1 ? 's' : ''}</span>
            </button>
          )}
        </div>

        {/* Zone 2: Precision Simulation Transport & Clock Bay */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-inset)] px-3 py-1.5 font-mono text-[13px] font-bold text-[var(--accent-primary)] tabular-nums">
            t = {(clockMs / 1000).toFixed(3)}s
          </div>

          {/* Live vs Step-by-Step Mode Toggle */}
          <div
            role="group"
            aria-label="Simulation playback mode"
            className="inline-flex items-center rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-inset)] p-0.5"
          >
            <button
              type="button"
              onClick={() => onChangePlaybackMode('live')}
              aria-pressed={playbackMode === 'live'}
              title={`${t('simulator.liveMode')} (M)`}
              className={`rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
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
              className={`rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                playbackMode === 'step'
                  ? 'bg-[var(--accent-teal)] text-white shadow-xs'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {t('simulator.stepByStepMode')}
            </button>
          </div>

          {playbackMode === 'step' && (
            <button
              type="button"
              onClick={onStepBack}
              disabled={stepCursor <= 0}
              aria-label={t('simulator.stepBack')}
              title={`${t('simulator.stepBack')} (←)`}
              className="flex h-9 items-center gap-1 rounded-lg border border-[var(--border-hairline)] px-2.5 text-[13px] font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-40 whitespace-nowrap shrink-0"
            >
              <SkipBack className="w-4 h-4" />
              <span className="hidden md:inline">{t('simulator.stepBack')}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => (onTogglePlayPause ? onTogglePlayPause() : setSimPlaying(!simPlaying))}
            title={`${simPlaying ? t('simulator.pause') : t('simulator.run')} (Space)`}
            className="flex h-9 items-center gap-1.5 rounded-lg bg-[var(--accent-cta)] px-4 text-[13px] font-semibold text-white hover:bg-[var(--accent-cta-hover)] whitespace-nowrap shrink-0 transition-colors shadow-xs"
          >
            {simPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            <span>
              {simPlaying
                ? t('simulator.pause')
                : playbackMode === 'step' && stepCursor > 0 && stepCursor < totalSteps
                ? t('simulator.resume')
                : t('simulator.run')}
            </span>
          </button>

          <button
            type="button"
            onClick={onStep}
            aria-label={playbackMode === 'step' ? t('simulator.stepNext') : t('simulator.step')}
            title={`${playbackMode === 'step' ? t('simulator.stepNext') : t('simulator.step')} (→)`}
            className="flex h-9 items-center gap-1.5 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-inset)] px-3 text-[13px] font-semibold text-[var(--text-secondary)] hover:border-[var(--accent-primary)] hover:text-[var(--text-primary)] whitespace-nowrap shrink-0 transition-colors"
          >
            <StepForward className="w-4 h-4" />
            <span className="hidden sm:inline">
              {playbackMode === 'step' ? t('simulator.stepNext') : t('simulator.step')}
            </span>
          </button>

          <button
            type="button"
            onClick={onReset}
            title={`${t('simulator.reset')} (R)`}
            className="flex h-9 items-center gap-1.5 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-inset)] px-3 text-[13px] font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] whitespace-nowrap shrink-0 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            <span className="hidden sm:inline">{t('simulator.reset')}</span>
          </button>

          {(isPro || playbackMode === 'step') && (
            <select
              aria-label="Simulation speed"
              title={`${t('simulator.shortcutSpeed')} (+/-)`}
              value={simSpeed}
              onChange={(e) => setSimSpeed(Number(e.target.value))}
              className="h-9 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-inset)] px-2.5 font-mono text-[13px] font-semibold text-[var(--text-primary)]"
            >
              {SIM_PLAYBACK_SPEEDS.map((s) => (
                <option key={s} value={s}>
                  {s}x
                </option>
              ))}
            </select>
          )}

          {onToggleShortcuts && (
            <button
              type="button"
              onClick={onToggleShortcuts}
              aria-label={t('simulator.shortcutsTitle')}
              aria-expanded={shortcutsOpen}
              title={`${t('simulator.shortcutsTitle')} (?)`}
              className={`flex h-9 w-9 items-center justify-center rounded-lg border transition-colors shrink-0 ${
                shortcutsOpen
                  ? 'border-[var(--accent-primary)] bg-[var(--accent-primary-soft)] text-[var(--accent-primary)]'
                  : 'border-[var(--border-hairline)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Keyboard className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Right: Traffic, Faults, Save/Share & Inspector Toggle (Pro Mode) */}
        {isPro && (
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => toggleMenu('traffic')}
              aria-expanded={openMenu === 'traffic'}
              className={`flex h-9 items-center gap-1.5 rounded-lg border px-3 text-[13px] font-semibold transition-colors whitespace-nowrap shrink-0 ${
                openMenu === 'traffic'
                  ? 'border-[var(--accent-primary)] bg-[var(--accent-primary-soft)] text-[var(--accent-primary)]'
                  : 'border-[var(--border-hairline)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Zap className="w-4 h-4 text-[var(--accent-primary)]" />
              <span>Traffic Gen</span>
            </button>

            <button
              type="button"
              onClick={() => toggleMenu('faults')}
              aria-expanded={openMenu === 'faults'}
              className={`flex h-9 items-center gap-1.5 rounded-lg border px-3 text-[13px] font-semibold transition-colors whitespace-nowrap shrink-0 ${
                openMenu === 'faults'
                  ? 'border-[var(--tone-warning)] bg-[var(--tone-warning)]/15 text-[var(--tone-warning)]'
                  : 'border-[var(--border-hairline)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <ShieldAlert className="w-4 h-4 text-[var(--tone-warning)]" />
              <span>{t('simulator.faults')}</span>
            </button>

            <button
              type="button"
              onClick={() => toggleMenu('project')}
              aria-expanded={openMenu === 'project'}
              className={`flex h-9 items-center gap-1.5 rounded-lg border px-3 text-[13px] font-semibold transition-colors whitespace-nowrap shrink-0 ${
                openMenu === 'project'
                  ? 'border-[var(--accent-primary)] bg-[var(--accent-primary-soft)] text-[var(--accent-primary)]'
                  : 'border-[var(--border-hairline)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Save className="w-4 h-4" />
              <span className="hidden sm:inline">{t('common.save')} / {t('explore.share')}</span>
            </button>

            <button
              type="button"
              onClick={onToggleInspector}
              aria-pressed={inspectorOpen}
              title="Toggle Properties Inspector"
              className={`flex h-9 items-center gap-1.5 rounded-lg border px-3 text-[13px] font-semibold transition-colors whitespace-nowrap shrink-0 ${
                inspectorOpen
                  ? 'border-[var(--accent-primary)]/60 bg-[var(--accent-primary-soft)] text-[var(--accent-primary)]'
                  : 'border-[var(--border-hairline)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <PanelRight className="w-4 h-4" />
              <span className="hidden xl:inline">{t('simulator.properties')}</span>
            </button>
          </div>
        )}
      </div>

      {/* Contextual Keyboard Shortcuts Strip */}
      {shortcutsOpen && (
        <div
          role="dialog"
          aria-label={t('simulator.shortcutsTitle')}
          className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border-hairline)] bg-[var(--bg-inset)] px-4 py-2 text-xs"
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

      {/* Contextual Starter Topology Templates Studio Drawer */}
      {openMenu === 'templates' && onApplyTemplate && (
        <div
          role="region"
          aria-label={t('simulator.templates')}
          className="border-t border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-4 py-3.5 text-[13px] space-y-3"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <LayoutTemplate className="w-4 h-4 text-[var(--accent-teal)] shrink-0" />
              <span className="font-display text-base font-bold text-[var(--text-primary)]">{t('simulator.templates')}</span>
              <span className="text-[13px] text-[var(--text-secondary)] truncate hidden sm:inline">
                · {t('simulator.templatesHint')}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setOpenMenu('none')}
              className="rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-3 py-1 text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] whitespace-nowrap shrink-0"
            >
              {t('common.close')}
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {STARTER_TEMPLATES.map((tpl) => (
              <button
                key={tpl.id}
                type="button"
                data-template-id={tpl.id}
                onClick={() => {
                  onApplyTemplate(tpl);
                  setOpenMenu('none');
                }}
                className="flex flex-col items-start justify-between gap-2 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-3.5 text-start hover:border-[var(--accent-primary)] transition-colors"
              >
                <div className="w-full flex items-center justify-between gap-2">
                  <span className="font-display text-sm font-bold text-[var(--text-primary)] truncate">
                    {t(tpl.nameKey, { defaultValue: tpl.fallbackName })}
                  </span>
                </div>
                <span className="text-xs text-[var(--text-secondary)] line-clamp-2 leading-relaxed">
                  {t(tpl.descKey, { defaultValue: tpl.fallbackDesc })}
                </span>
                <span className="font-mono text-xs font-semibold text-[var(--accent-teal)] tabular-nums">
                  {tpl.devices.length} {t('simulator.nodes')} · {tpl.links.length} {t('simulator.links')}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Contextual Popover Strip for Traffic Generator */}
      {isPro && openMenu === 'traffic' && (
        <div className="flex flex-wrap items-center gap-2 border-t border-[var(--border-hairline)] bg-[var(--bg-inset)] px-4 py-2 text-xs">
          <span className="font-semibold text-[var(--accent-primary)]">Generate Traffic:</span>
          <select
            aria-label="Traffic source"
            value={effectiveSrc}
            onChange={(e) => setSrcId(e.target.value)}
            className="h-7 rounded border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-2 font-mono text-[11px] text-[var(--text-primary)]"
          >
            {devices.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          <span className="text-[var(--text-muted)]">→</span>
          <select
            aria-label="Traffic destination"
            value={effectiveDst}
            onChange={(e) => setDstId(e.target.value)}
            className="h-7 rounded border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-2 font-mono text-[11px] text-[var(--text-primary)]"
          >
            {devices.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          <select
            aria-label="Traffic pattern"
            value={trafficMode}
            onChange={(e) => setTrafficMode(e.target.value as typeof trafficMode)}
            className="h-7 rounded border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-2 font-mono text-[11px] text-[var(--text-primary)]"
          >
            <option value="http_load">HTTP Load</option>
            <option value="iperf">iPerf3 TCP cwnd</option>
            <option value="cbr">CBR UDP</option>
            <option value="burst">Large Burst (1400B)</option>
            <option value="ping_flood">ICMP Ping Flood</option>
          </select>
          <button
            type="button"
            onClick={() => {
              onTrafficGen(trafficMode, effectiveSrc, effectiveDst);
              setOpenMenu('none');
            }}
            className="h-7 rounded bg-[var(--accent-cta)] px-3 font-semibold text-white hover:bg-[var(--accent-cta-hover)] whitespace-nowrap shrink-0 transition-colors"
          >
            Send Packets
          </button>
        </div>
      )}

      {/* Contextual Popover Strip for Fault Injection + Warnings */}
      {isPro && openMenu === 'faults' && (
        <div className="border-t border-[var(--border-hairline)] bg-[var(--bg-inset)] px-4 py-2 text-xs space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-[var(--tone-warning)]">Inject Network Fault:</span>
            <button
              type="button"
              onClick={() => onFaultAction('cut_link')}
              className="rounded border border-[var(--tone-danger)]/40 bg-[var(--tone-danger)]/10 px-2.5 py-1 text-[11px] font-medium text-[var(--tone-danger)] hover:bg-[var(--tone-danger)]/20"
            >
              Cut / Restore Selected Link
            </button>
            <button
              type="button"
              onClick={() => onFaultAction('loss_20')}
              className="rounded border border-[var(--tone-warning)]/40 bg-[var(--tone-warning)]/10 px-2.5 py-1 text-[11px] font-medium text-[var(--tone-warning)] hover:bg-[var(--tone-warning)]/20"
            >
              Toggle 20% Loss
            </button>
            <button
              type="button"
              onClick={() => onFaultAction('low_mtu')}
              className="rounded border border-[var(--tone-warning)]/40 bg-[var(--tone-warning)]/10 px-2.5 py-1 text-[11px] font-medium text-[var(--tone-warning)] hover:bg-[var(--tone-warning)]/20"
            >
              MTU 576 Bottleneck
            </button>
            <button
              type="button"
              onClick={() => onFaultAction('dup_ip')}
              className="rounded border border-[var(--tone-danger)]/40 bg-[var(--tone-danger)]/10 px-2.5 py-1 text-[11px] font-medium text-[var(--tone-danger)] hover:bg-[var(--tone-danger)]/20"
            >
              Duplicate IP Conflict
            </button>
            <button
              type="button"
              onClick={() => onFaultAction('block_80')}
              className="rounded border border-[var(--tone-danger)]/40 bg-[var(--tone-danger)]/10 px-2.5 py-1 text-[11px] font-medium text-[var(--tone-danger)] hover:bg-[var(--tone-danger)]/20"
            >
              Firewall Block :80
            </button>
          </div>

          {warnings.length > 0 && (
            <div className="space-y-1 border-t border-[var(--border-hairline)] pt-1.5">
              {warnings.map((w) => (
                <div key={w.id} className="flex items-center gap-2 text-[var(--tone-warning)]">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>{w.message}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Contextual Popover Strip for Save / Load / Export / Share */}
      {isPro && openMenu === 'project' && (
        <div className="border-t border-[var(--border-hairline)] bg-[var(--bg-inset)] px-4 py-2.5 text-xs space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                saveNamedProject(saveName || `Topology ${savedProjects.length + 1}`);
                setSaveName('');
              }}
              className="flex flex-wrap items-center gap-1.5"
            >
              <input
                type="text"
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                placeholder="Save topology snapshot name..."
                className="h-7 min-w-[190px] rounded border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-2.5 text-xs text-[var(--text-primary)]"
              />
              <button type="submit" className="h-7 rounded bg-[var(--accent-cta)] px-3 font-semibold text-white hover:bg-[var(--accent-cta-hover)]">
                {t('common.save')}
              </button>
            </form>

            <span className="h-4 w-px bg-[var(--border-hairline)] hidden sm:inline-block" />

            <button
              type="button"
              onClick={onExportJson}
              className="flex h-7 items-center gap-1 rounded border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-2.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export JSON</span>
            </button>

            <button
              type="button"
              onClick={onExportPng}
              title={t('simulator.exportPngTooltip')}
              className="flex h-7 items-center gap-1 rounded border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-2.5 text-xs text-[var(--text-secondary)] hover:border-[var(--accent-primary)] hover:text-[var(--text-primary)]"
            >
              <Camera className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
              <span>{t('simulator.exportPng')}</span>
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex h-7 items-center gap-1 rounded border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-2.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
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
              className="flex h-7 items-center gap-1 rounded border border-[var(--accent-primary)]/50 bg-[var(--accent-primary-soft)] px-2.5 text-xs font-medium text-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/20"
            >
              {copiedUrl ? <Check className="w-3.5 h-3.5 text-[var(--tone-success)]" /> : <Share2 className="w-3.5 h-3.5" />}
              <span>{copiedUrl ? t('explore.copied') : t('explore.copyLink')}</span>
            </button>
          </div>

          {savedProjects.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[11px] text-[var(--text-muted)]">Saved snapshots:</span>
              {savedProjects.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    loadNamedProject(p.id);
                    setOpenMenu('none');
                  }}
                  className="flex items-center gap-1.5 rounded border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-2 py-0.5 text-[11px] text-[var(--text-primary)] hover:border-[var(--accent-primary)]/60"
                >
                  <FolderOpen className="w-3 h-3 text-[var(--accent-primary)]" />
                  <span>{p.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
