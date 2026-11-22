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
import { tc } from '../../i18n/content';

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
    <div className="@container relative shrink-0 border-b border-[var(--border-hairline)] bg-[var(--bg-surface)] z-20">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2">
        {/* Left: Active Lab Trigger */}
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={onToggleLabs}
            aria-expanded={labsOpen}
            className={`flex h-8 items-center gap-2 rounded-lg border px-2.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
              labsOpen
                ? 'border-[var(--accent-primary)] bg-[var(--accent-primary-soft)] text-[var(--accent-primary)]'
                : 'border-[var(--border-hairline)] bg-[var(--bg-inset)] text-[var(--text-primary)] hover:border-[var(--accent-primary)]/60'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
            <span className="max-w-[9rem] truncate @4xl:max-w-[16rem]">
              {t('simulator.labs')} · {activeLab.number}: {tc(activeLab.title)}
            </span>
            <span className="hidden font-mono text-[11px] text-[var(--text-muted)] @3xl:inline">
              {completedLabs.length}/20
            </span>
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${labsOpen ? 'rotate-180' : ''}`} />
          </button>

          {onApplyTemplate && (
            <button
              type="button"
              onClick={() => toggleMenu('templates')}
              aria-expanded={openMenu === 'templates'}
              aria-label={t('simulator.templates')}
              className={`flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                openMenu === 'templates'
                  ? 'border-[var(--accent-primary)] bg-[var(--accent-primary-soft)] text-[var(--accent-primary)]'
                  : 'border-[var(--border-hairline)] bg-[var(--bg-inset)] text-[var(--text-primary)] hover:border-[var(--accent-primary)]/60'
              }`}
            >
              <LayoutTemplate className="w-3.5 h-3.5 text-[var(--accent-teal)]" />
              <span className="hidden @3xl:inline">{t('simulator.templates')}</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${openMenu === 'templates' ? 'rotate-180' : ''}`} />
            </button>
          )}

          {warnings.length > 0 && isPro && (
            <button
              type="button"
              onClick={() => toggleMenu('faults')}
              title={warnings.map((w) => w.message).join('\n')}
              className="flex h-8 items-center gap-1 rounded-lg border border-[var(--tone-warning)]/50 bg-[var(--tone-warning)]/12 px-2 text-xs font-medium text-[var(--tone-warning)] whitespace-nowrap shrink-0"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>{warnings.length} alert{warnings.length > 1 ? 's' : ''}</span>
            </button>
          )}
        </div>

        {/* Transport: mode, run / step / reset, speed, clock */}
        <div className="flex flex-wrap items-center gap-1.5 @4xl:mx-auto">
          <div className="rounded-md border border-[var(--border-hairline)] bg-[var(--bg-inset)] px-2 py-1 font-mono text-xs font-semibold text-[var(--accent-primary)] tabular-nums">
            t = {(clockMs / 1000).toFixed(3)}s
          </div>

          {/* Live vs Step-by-Step Mode Toggle */}
          <div
            role="group"
            aria-label={tc('Simulation playback mode')}
            className="inline-flex items-center rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-inset)] p-0.5"
          >
            <button
              type="button"
              onClick={() => onChangePlaybackMode('live')}
              aria-pressed={playbackMode === 'live'}
              title={`${t('simulator.liveMode')} (M)`}
              className={`rounded-md px-2 py-1 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
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
              className={`rounded-md px-2 py-1 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                playbackMode === 'step'
                  ? 'bg-[var(--accent-teal)] text-[var(--on-teal)] shadow-xs'
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
              className="flex h-8 items-center gap-1 rounded-lg border border-[var(--border-hairline)] px-2 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-40 whitespace-nowrap shrink-0"
            >
              <SkipBack className="w-3.5 h-3.5" />
              <span className="hidden @3xl:inline">{t('simulator.stepBack')}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => (onTogglePlayPause ? onTogglePlayPause() : setSimPlaying(!simPlaying))}
            title={`${simPlaying ? t('simulator.pause') : t('simulator.run')} (Space)`}
            className="flex h-8 items-center gap-1.5 rounded-lg bg-[var(--accent-cta)] px-3 text-xs font-semibold text-[var(--on-accent)] hover:bg-[var(--accent-cta-hover)] whitespace-nowrap shrink-0 transition-colors"
          >
            {simPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
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
            className="flex h-8 items-center gap-1 rounded-lg border border-[var(--border-hairline)] px-2.5 text-xs font-medium text-[var(--text-secondary)] hover:border-[var(--accent-primary)] hover:text-[var(--text-primary)] whitespace-nowrap shrink-0"
          >
            <StepForward className="w-3.5 h-3.5" />
            <span className="hidden @3xl:inline">
              {playbackMode === 'step' ? t('simulator.stepNext') : t('simulator.step')}
            </span>
          </button>

          <button
            type="button"
            onClick={onReset}
            aria-label={t('simulator.reset')}
            title={`${t('simulator.reset')} (R)`}
            className="flex h-8 items-center gap-1 rounded-lg border border-[var(--border-hairline)] px-2.5 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] whitespace-nowrap shrink-0"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden @3xl:inline">{t('simulator.reset')}</span>
          </button>

          {(isPro || playbackMode === 'step') && (
            <select
              aria-label={tc('Simulation speed')}
              title={`${t('simulator.shortcutSpeed')} (+/-)`}
              value={simSpeed}
              onChange={(e) => setSimSpeed(Number(e.target.value))}
              className="h-8 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-inset)] px-2 font-mono text-xs text-[var(--text-primary)]"
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
              className={`hidden h-8 w-8 items-center justify-center rounded-lg border transition-colors shrink-0 sm:flex ${
                shortcutsOpen
                  ? 'border-[var(--accent-primary)] bg-[var(--accent-primary-soft)] text-[var(--accent-primary)]'
                  : 'border-[var(--border-hairline)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Keyboard className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Right: Traffic, Faults, Save/Share & Inspector Toggle (Pro Mode) */}
        {isPro && (
          <div className="ms-auto flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => toggleMenu('traffic')}
              aria-expanded={openMenu === 'traffic'}
              aria-label={tc('Traffic Gen')}
              title={tc('Traffic Gen')}
              className={`flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                openMenu === 'traffic'
                  ? 'border-[var(--accent-primary)] bg-[var(--accent-primary-soft)] text-[var(--accent-primary)]'
                  : 'border-[var(--border-hairline)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Zap className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
              <span className="hidden @5xl:inline">{tc('Traffic Gen')}</span>
            </button>

            <button
              type="button"
              onClick={() => toggleMenu('faults')}
              aria-expanded={openMenu === 'faults'}
              aria-label={t('simulator.faults')}
              title={t('simulator.faults')}
              className={`flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                openMenu === 'faults'
                  ? 'border-[var(--tone-warning)] bg-[var(--tone-warning)]/15 text-[var(--tone-warning)]'
                  : 'border-[var(--border-hairline)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5 text-[var(--tone-warning)]" />
              <span className="hidden @5xl:inline">{t('simulator.faults')}</span>
            </button>

            <button
              type="button"
              onClick={() => toggleMenu('project')}
              aria-expanded={openMenu === 'project'}
              aria-label={`${t('common.save')} / ${t('explore.share')}`}
              title={`${t('common.save')} / ${t('explore.share')}`}
              className={`flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                openMenu === 'project'
                  ? 'border-[var(--accent-primary)] bg-[var(--accent-primary-soft)] text-[var(--accent-primary)]'
                  : 'border-[var(--border-hairline)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Save className="w-3.5 h-3.5" />
              <span className="hidden @5xl:inline">{t('common.save')} / {t('explore.share')}</span>
            </button>

            <button
              type="button"
              onClick={onToggleInspector}
              aria-pressed={inspectorOpen}
              title={tc('Toggle Properties Inspector')}
              className={`flex h-8 items-center gap-1 rounded-lg border px-2.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                inspectorOpen
                  ? 'border-[var(--accent-primary)]/60 bg-[var(--accent-primary-soft)] text-[var(--accent-primary)]'
                  : 'border-[var(--border-hairline)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <PanelRight className="w-3.5 h-3.5" />
              <span className="hidden @5xl:inline">{t('simulator.properties')}</span>
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
                <kbd className="rounded border border-[var(--border-strong)] bg-[var(--bg-surface)] px-1.5 py-0.5 font-mono text-[11px] font-bold text-[var(--text-primary)]">
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
              className="rounded border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-2 py-0.5 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            >
              {t('common.close')}
            </button>
          )}
        </div>
      )}

      {/* Contextual Starter Topology Templates Strip (Simple & Pro Modes) */}
      {openMenu === 'templates' && onApplyTemplate && (
        <div
          role="region"
          aria-label={t('simulator.templates')}
          className="border-t border-[var(--border-hairline)] bg-[var(--bg-inset)] px-4 py-2.5 text-xs space-y-2"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <LayoutTemplate className="w-3.5 h-3.5 text-[var(--accent-teal)] shrink-0" />
              <span className="font-semibold text-[var(--text-primary)]">{t('simulator.templates')}</span>
              <span className="text-[var(--text-muted)] truncate hidden sm:inline">
                · {t('simulator.templatesHint')}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setOpenMenu('none')}
              className="rounded border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-2 py-0.5 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] whitespace-nowrap shrink-0"
            >
              {t('common.close')}
            </button>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            {STARTER_TEMPLATES.map((tpl) => (
              <button
                key={tpl.id}
                type="button"
                data-template-id={tpl.id}
                onClick={() => {
                  onApplyTemplate(tpl);
                  setOpenMenu('none');
                }}
                className="flex flex-col items-start justify-between gap-1 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-3 py-2 text-start hover:border-[var(--accent-primary)] hover:bg-[var(--accent-primary-soft)]/50 transition-colors"
              >
                <div className="w-full flex items-center justify-between gap-1">
                  <span className="font-semibold text-[var(--text-primary)] truncate">
                    {t(tpl.nameKey, { defaultValue: tpl.fallbackName })}
                  </span>
                </div>
                <span className="text-xs text-[var(--text-secondary)] line-clamp-2">
                  {t(tpl.descKey, { defaultValue: tpl.fallbackDesc })}
                </span>
                <span className="font-mono text-[11px] text-[var(--accent-primary)] tabular-nums">
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
          <span className="font-semibold text-[var(--accent-primary)]">{tc('Generate Traffic:')}</span>
          <select
            aria-label={tc('Traffic source')}
            value={effectiveSrc}
            onChange={(e) => setSrcId(e.target.value)}
            className="h-7 rounded border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-2 font-mono text-xs text-[var(--text-primary)]"
          >
            {devices.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          <span className="text-[var(--text-muted)]">→</span>
          <select
            aria-label={tc('Traffic destination')}
            value={effectiveDst}
            onChange={(e) => setDstId(e.target.value)}
            className="h-7 rounded border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-2 font-mono text-xs text-[var(--text-primary)]"
          >
            {devices.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          <select
            aria-label={tc('Traffic pattern')}
            value={trafficMode}
            onChange={(e) => setTrafficMode(e.target.value as typeof trafficMode)}
            className="h-7 rounded border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-2 font-mono text-xs text-[var(--text-primary)]"
          >
            <option value="http_load">{tc('HTTP Load')}</option>
            <option value="iperf">{tc('iPerf3 TCP cwnd')}</option>
            <option value="cbr">{tc('CBR UDP')}</option>
            <option value="burst">{tc('Large Burst (1400B)')}</option>
            <option value="ping_flood">{tc('ICMP Ping Flood')}</option>
          </select>
          <button
            type="button"
            onClick={() => {
              onTrafficGen(trafficMode, effectiveSrc, effectiveDst);
              setOpenMenu('none');
            }}
            className="h-7 rounded bg-[var(--accent-cta)] px-3 font-semibold text-[var(--on-accent)] hover:bg-[var(--accent-cta-hover)] whitespace-nowrap shrink-0 transition-colors"
          >
            {tc('Send Packets')}
          </button>
        </div>
      )}

      {/* Contextual Popover Strip for Fault Injection + Warnings */}
      {isPro && openMenu === 'faults' && (
        <div className="border-t border-[var(--border-hairline)] bg-[var(--bg-inset)] px-4 py-2 text-xs space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-[var(--tone-warning)]">{tc('Inject Network Fault:')}</span>
            <button
              type="button"
              onClick={() => onFaultAction('cut_link')}
              className="rounded border border-[var(--tone-danger)]/40 bg-[var(--tone-danger)]/10 px-2.5 py-1 text-xs font-medium text-[var(--tone-danger)] hover:bg-[var(--tone-danger)]/20"
            >
              {tc('Cut / Restore Selected Link')}
            </button>
            <button
              type="button"
              onClick={() => onFaultAction('loss_20')}
              className="rounded border border-[var(--tone-warning)]/40 bg-[var(--tone-warning)]/10 px-2.5 py-1 text-xs font-medium text-[var(--tone-warning)] hover:bg-[var(--tone-warning)]/20"
            >
              {tc('Toggle 20% Loss')}
            </button>
            <button
              type="button"
              onClick={() => onFaultAction('low_mtu')}
              className="rounded border border-[var(--tone-warning)]/40 bg-[var(--tone-warning)]/10 px-2.5 py-1 text-xs font-medium text-[var(--tone-warning)] hover:bg-[var(--tone-warning)]/20"
            >
              {tc('MTU 576 Bottleneck')}
            </button>
            <button
              type="button"
              onClick={() => onFaultAction('dup_ip')}
              className="rounded border border-[var(--tone-danger)]/40 bg-[var(--tone-danger)]/10 px-2.5 py-1 text-xs font-medium text-[var(--tone-danger)] hover:bg-[var(--tone-danger)]/20"
            >
              {tc('Duplicate IP Conflict')}
            </button>
            <button
              type="button"
              onClick={() => onFaultAction('block_80')}
              className="rounded border border-[var(--tone-danger)]/40 bg-[var(--tone-danger)]/10 px-2.5 py-1 text-xs font-medium text-[var(--tone-danger)] hover:bg-[var(--tone-danger)]/20"
            >
              {tc('Firewall Block :80')}
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
                placeholder={tc('Save topology snapshot name...')}
                className="h-7 min-w-[190px] rounded border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-2.5 text-xs text-[var(--text-primary)]"
              />
              <button type="submit" className="h-7 rounded bg-[var(--accent-cta)] px-3 font-semibold text-[var(--on-accent)] hover:bg-[var(--accent-cta-hover)]">
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
              <span>{tc('Export JSON')}</span>
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
              <span>{tc('Import JSON')}</span>
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
              <span className="text-xs text-[var(--text-muted)]">{tc('Saved snapshots:')}</span>
              {savedProjects.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    loadNamedProject(p.id);
                    setOpenMenu('none');
                  }}
                  className="flex items-center gap-1.5 rounded border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-2 py-0.5 text-xs text-[var(--text-primary)] hover:border-[var(--accent-primary)]/60"
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
