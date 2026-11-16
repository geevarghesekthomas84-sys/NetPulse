import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Pause, Play, Repeat, RotateCcw, SkipBack, SkipForward, FastForward } from 'lucide-react';
import type { CapturedPacket } from '../../engine/types';
import type { ProtocolStepDef } from '../../protocols/types';
import { useAppStore } from '../../store/useAppStore';

interface PlaybackBarProps {
  packets: CapturedPacket[];
  steps: ProtocolStepDef[];
  onProgressChange: (packetProgress: number) => void;
}

const SPEEDS = [0.25, 0.5, 1, 2, 4];

export const PlaybackBar: React.FC<PlaybackBarProps> = ({ packets, steps, onProgressChange }) => {
  const { t } = useTranslation();
  const {
    currentPacketIndex,
    currentStepIndex,
    isPlaying,
    playbackSpeed,
    loopEnabled,
    autoAdvanceSteps,
    experienceLevel,
    settings,
    setCurrentPacketIndex,
    setCurrentStepIndex,
    setIsPlaying,
    setPlaybackSpeed,
    setLoopEnabled,
    setAutoAdvanceSteps,
  } = useAppStore();

  const rafRef = useRef<number | null>(null);
  const progressRef = useRef<number>(0);
  const lastFrameRef = useRef<number | null>(null);

  const totalPackets = packets.length;
  const safePacketIndex = Math.min(currentPacketIndex, Math.max(0, totalPackets - 1));

  useEffect(() => {
    const pkt = packets[safePacketIndex];
    if (pkt && pkt.stepIndex !== undefined && pkt.stepIndex !== currentStepIndex && autoAdvanceSteps) {
      setCurrentStepIndex(pkt.stepIndex);
    }
  }, [safePacketIndex, packets, currentStepIndex, autoAdvanceSteps, setCurrentStepIndex]);

  useEffect(() => {
    if (!isPlaying || totalPackets === 0) {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      lastFrameRef.current = null;
      return;
    }

    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const reduced = prefersReduced || !settings.animationsEnabled;

    const tick = (now: number) => {
      if (lastFrameRef.current === null) {
        lastFrameRef.current = now;
      }
      const dtMs = now - lastFrameRef.current;
      lastFrameRef.current = now;

      const durationMs = (reduced ? 700 : 950) / playbackSpeed;
      progressRef.current += dtMs / durationMs;

      if (progressRef.current >= 1) {
        progressRef.current = 0;
        const state = useAppStore.getState();
        const curr = state.currentPacketIndex;
        const nextIdx = curr + 1;

        if (nextIdx >= totalPackets) {
          if (state.loopEnabled) {
            state.setCurrentPacketIndex(0);
            state.setCurrentStepIndex(packets[0]?.stepIndex ?? 0);
          } else {
            state.setIsPlaying(false);
            onProgressChange(1);
            return;
          }
        } else {
          const nextPkt = packets[nextIdx];
          const prevPkt = packets[curr];
          if (
            !state.autoAdvanceSteps &&
            prevPkt &&
            nextPkt &&
            nextPkt.stepIndex !== prevPkt.stepIndex
          ) {
            state.setIsPlaying(false);
            onProgressChange(0);
            return;
          }
          state.setCurrentPacketIndex(nextIdx);
          if (nextPkt?.stepIndex !== undefined) {
            state.setCurrentStepIndex(nextPkt.stepIndex);
          }
        }
      }

      onProgressChange(reduced ? 0.5 : progressRef.current);
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      lastFrameRef.current = null;
    };
  }, [isPlaying, playbackSpeed, totalPackets, packets, settings.animationsEnabled, onProgressChange]);

  const jumpToPacket = (idx: number) => {
    const clamped = Math.max(0, Math.min(totalPackets - 1, idx));
    progressRef.current = 0;
    onProgressChange(0.5);
    setCurrentPacketIndex(clamped);
    const pkt = packets[clamped];
    if (pkt?.stepIndex !== undefined) setCurrentStepIndex(pkt.stepIndex);
  };

  const handleReset = () => {
    setIsPlaying(false);
    progressRef.current = 0;
    onProgressChange(0);
    setCurrentPacketIndex(0);
    setCurrentStepIndex(0);
  };

  const handlePrev = () => {
    setIsPlaying(false);
    jumpToPacket(safePacketIndex - 1);
  };

  const handleNext = () => {
    setIsPlaying(false);
    jumpToPacket(safePacketIndex + 1);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
      if (useAppStore.getState().mode !== 'explore') return;

      if (e.code === 'Space') {
        e.preventDefault();
        setIsPlaying(!useAppStore.getState().isPlaying);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        jumpToPacket(useAppStore.getState().currentPacketIndex + 1);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        jumpToPacket(useAppStore.getState().currentPacketIndex - 1);
      } else if (e.key.toLowerCase() === 'r') {
        e.preventDefault();
        handleReset();
      } else if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        const i = SPEEDS.indexOf(useAppStore.getState().playbackSpeed);
        if (i < SPEEDS.length - 1) setPlaybackSpeed(SPEEDS[i + 1]);
      } else if (e.key === '-') {
        e.preventDefault();
        const i = SPEEDS.indexOf(useAppStore.getState().playbackSpeed);
        if (i > 0) setPlaybackSpeed(SPEEDS[i - 1]);
      } else if (/^[1-5]$/.test(e.key)) {
        const targetStep = Number(e.key) - 1;
        if (targetStep < steps.length) {
          const pktIdx = packets.findIndex((p) => (p.stepIndex ?? 0) >= targetStep);
          setIsPlaying(false);
          setCurrentStepIndex(targetStep);
          setCurrentPacketIndex(Math.max(0, pktIdx));
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const visibleSpeeds = experienceLevel === 'simple' ? [0.5, 1, 2] : SPEEDS;

  return (
    <div className="shrink-0 border-t border-[var(--border-hairline)] bg-[var(--bg-surface)]/95 px-4 py-2 backdrop-blur-md">
      {/* Scrubber Timeline */}
      <div className="mb-1.5 flex items-center gap-3">
        <span className="font-mono text-xs text-[var(--text-muted)] tabular-nums shrink-0">
          {totalPackets ? `${safePacketIndex + 1}/${totalPackets}` : '0/0'}
        </span>
        <div className="relative flex-1 flex items-center">
          <input
            type="range"
            min={0}
            max={Math.max(0, totalPackets - 1)}
            value={safePacketIndex}
            onChange={(e) => {
              setIsPlaying(false);
              jumpToPacket(Number(e.target.value));
            }}
            aria-label={t('playback.scrubber')}
            className="w-full accent-[var(--accent-primary)] cursor-pointer"
          />
        </div>
        <span className="hidden sm:inline font-mono text-xs text-[var(--text-muted)] tabular-nums shrink-0">
          {t('playback.step')} {Math.min(currentStepIndex + 1, Math.max(1, steps.length))}/{Math.max(1, steps.length)}
        </span>
      </div>

      {/* Transport Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        {/* Speed Selector */}
        <div className="flex items-center gap-1 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-inset)] p-0.5">
          {visibleSpeeds.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setPlaybackSpeed(s)}
              className={`rounded-md px-2 py-1 text-xs font-mono transition-colors whitespace-nowrap shrink-0 ${
                playbackSpeed === s
                  ? 'bg-[var(--accent-cta)] text-white font-semibold'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {s}x
            </button>
          ))}
        </div>

        {/* Center Primary Playback */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handlePrev}
            disabled={safePacketIndex <= 0}
            aria-label={t('playback.prev')}
            title="Previous Packet (Left Arrow)"
            className="flex h-9 items-center gap-1 rounded-lg border border-[var(--border-hairline)] px-2.5 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-40 whitespace-nowrap shrink-0"
          >
            <SkipBack className="w-3.5 h-3.5" />
            <span className="hidden md:inline">{t('playback.prev')}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (!isPlaying && safePacketIndex >= totalPackets - 1 && totalPackets > 1) {
                setCurrentPacketIndex(0);
                setCurrentStepIndex(0);
              }
              setIsPlaying(!isPlaying);
            }}
            aria-label={isPlaying ? t('playback.pause') : t('playback.play')}
            title="Play / Pause (Space)"
            className="flex h-9 items-center gap-1.5 rounded-lg bg-[var(--accent-cta)] px-4 text-xs font-semibold text-white hover:bg-[var(--accent-cta-hover)] transition-colors shadow-sm whitespace-nowrap shrink-0"
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            <span>{isPlaying ? t('playback.pause') : t('playback.play')}</span>
          </button>

          <button
            type="button"
            onClick={handleNext}
            disabled={safePacketIndex >= totalPackets - 1}
            aria-label={t('playback.next')}
            title="Next Packet (Right Arrow)"
            className="flex h-9 items-center gap-1 rounded-lg border border-[var(--border-hairline)] px-2.5 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-40 whitespace-nowrap shrink-0"
          >
            <span className="hidden md:inline">{t('playback.next')}</span>
            <SkipForward className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={handleReset}
            aria-label={t('playback.reset')}
            title="Reset (R)"
            className="flex h-9 items-center gap-1 rounded-lg border border-[var(--border-hairline)] px-2.5 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] whitespace-nowrap shrink-0"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t('playback.reset')}</span>
          </button>
        </div>

        {/* Loop + Auto Advance */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setLoopEnabled(!loopEnabled)}
            aria-pressed={loopEnabled}
            className={`flex h-9 items-center gap-1 rounded-lg border px-2.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              loopEnabled
                ? 'border-[var(--accent-primary)] bg-[var(--accent-primary-soft)] text-[var(--accent-primary)] font-semibold'
                : 'border-[var(--border-hairline)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Repeat className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t('playback.loop')}</span>
          </button>
          {experienceLevel === 'pro' && (
            <button
              type="button"
              onClick={() => setAutoAdvanceSteps(!autoAdvanceSteps)}
              aria-pressed={autoAdvanceSteps}
              className={`flex h-9 items-center gap-1 rounded-lg border px-2.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                autoAdvanceSteps
                  ? 'border-[var(--accent-primary)] bg-[var(--accent-primary-soft)] text-[var(--accent-primary)] font-semibold'
                  : 'border-[var(--border-hairline)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <FastForward className="w-3.5 h-3.5" />
              <span className="hidden md:inline">{t('playback.autoAdvance')}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
