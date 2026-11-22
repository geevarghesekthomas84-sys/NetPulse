import { Gloss } from '../common/Gloss';
import { inlineSvgStyles, resolveCssVars } from '../../lib/resolveCssVars';
import { useWheelZoom } from '../../lib/useWheelZoom';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Camera, Clapperboard, Download, Info, Maximize2, Volume2, VolumeX, ZoomIn, ZoomOut } from 'lucide-react';
import { useSpeech } from '../../lib/useSpeech';
import type { CapturedPacket } from '../../engine/types';
import type { ProtocolLinkDef, ProtocolNodeDef, ProtocolStepDef } from '../../protocols/types';
import { triggerDownload } from '../../lib/pcapWriter';
import { useAppStore } from '../../store/useAppStore';
import { IsometricHardwareArt } from '../icons/IsometricHardwareLibrary';
import { LEGEND_ITEMS, PACKET_COLORS } from './colors';
import { tc } from '../../i18n/content';

interface NetworkDiagramProps {
  protocolName: string;
  nodes: ProtocolNodeDef[];
  links: ProtocolLinkDef[];
  packets: CapturedPacket[];
  steps: ProtocolStepDef[];
  currentPacketIndex: number;
  currentStepIndex: number;
  packetProgress: number; // 0..1
  onInspectPacket: (id: string) => void;
}

export const NetworkDiagram: React.FC<NetworkDiagramProps> = ({
  protocolName,
  nodes,
  links,
  packets,
  steps,
  currentPacketIndex,
  currentStepIndex,
  packetProgress,
  onInspectPacket,
}) => {
  const { t, i18n } = useTranslation();
  const speech = useSpeech(i18n.language);
  const { settings, isPlaying, experienceLevel, theme } = useAppStore();
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [selectedPopoverPkt, setSelectedPopoverPkt] = useState<CapturedPacket | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [panning, setPanning] = useState<{ startX: number; startY: number; origX: number; origY: number } | null>(null);

  const vbW = 1000 / zoom;
  const vbH = 500 / zoom;

  const zoomAtPoint = (nextZoomRaw: number, anchorX: number, anchorY: number) => {
    const nextZoom = Math.max(0.6, Math.min(2.4, Number(nextZoomRaw.toFixed(2))));
    const nextW = 1000 / nextZoom;
    const nextH = 500 / nextZoom;
    const relX = (anchorX - pan.x) / vbW;
    const relY = (anchorY - pan.y) / vbH;
    setZoom(nextZoom);
    setPan({
      x: anchorX - relX * nextW,
      y: anchorY - relY * nextH,
    });
  };

  useWheelZoom(svgRef, (factor, clientX, clientY) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const anchorX = pan.x + ((clientX - rect.left) / rect.width) * vbW;
    const anchorY = pan.y + ((clientY - rect.top) / rect.height) * vbH;
    stopCamera();
    zoomAtPoint(zoom * factor, anchorX, anchorY);
  });

  const resetZoom = () => {
    stopCamera();
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const fitView = () => {
    stopCamera();
    if (nodes.length === 0) {
      resetZoom();
      return;
    }
    const minX = Math.min(...nodes.map((n) => n.x)) - 110;
    const maxX = Math.max(...nodes.map((n) => n.x)) + 110;
    const minY = Math.min(...nodes.map((n) => n.y)) - 85;
    const maxY = Math.max(...nodes.map((n) => n.y)) + 95;
    const spanX = Math.max(360, maxX - minX);
    const spanY = Math.max(200, maxY - minY);
    const nextZoom = Math.max(0.6, Math.min(1.8, Math.min(1000 / spanX, 500 / spanY)));
    setZoom(Number(nextZoom.toFixed(2)));
    setPan({
      x: minX + spanX / 2 - 500 / nextZoom,
      y: minY + spanY / 2 - 250 / nextZoom,
    });
  };

  // Step camera: glides to the devices involved in the current step. Any manual zoom/pan switches it off.
  const [cameraOn, setCameraOn] = useState(true);
  const viewRef = useRef({ zoom: 1, panX: 0, panY: 0 });
  viewRef.current = { zoom, panX: pan.x, panY: pan.y };
  const animRef = useRef<number | null>(null);

  const glideTo = (toZoom: number, toX: number, toY: number) => {
    if (animRef.current !== null) cancelAnimationFrame(animRef.current);
    const from = { ...viewRef.current };
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    if (reduce || typeof requestAnimationFrame === 'undefined') {
      setZoom(toZoom);
      setPan({ x: toX, y: toY });
      return;
    }
    const start = performance.now();
    const dur = 520;
    const ease = (t: number) => 1 - Math.pow(1 - t, 3);
    const tick = (now: number) => {
      const k = ease(Math.min(1, (now - start) / dur));
      setZoom(from.zoom + (toZoom - from.zoom) * k);
      setPan({ x: from.panX + (toX - from.panX) * k, y: from.panY + (toY - from.panY) * k });
      animRef.current = k < 1 ? requestAnimationFrame(tick) : null;
    };
    animRef.current = requestAnimationFrame(tick);
  };

  const stopCamera = () => {
    if (animRef.current !== null) cancelAnimationFrame(animRef.current);
    animRef.current = null;
    setCameraOn(false);
  };

  useEffect(() => () => {
    if (animRef.current !== null) cancelAnimationFrame(animRef.current);
  }, []);

  // Aim at the two devices of the packet in flight (or the step's devices, or everything when there are none).
  const livePacket = packets[currentPacketIndex] ?? null;
  const focusKey = `${currentStepIndex}|${livePacket ? [livePacket.fromDeviceId, livePacket.toDeviceId].sort().join('~') : ''}|${nodes.map((n) => n.id).join(',')}`;
  useEffect(() => {
    if (!cameraOn || nodes.length === 0) return;
    const ids = new Set<string>();
    if (livePacket) {
      ids.add(livePacket.fromDeviceId);
      ids.add(livePacket.toDeviceId);
    } else {
      for (const p of packets) {
        if ((p.stepIndex ?? 0) === currentStepIndex) {
          ids.add(p.fromDeviceId);
          ids.add(p.toDeviceId);
        }
      }
    }
    const focus = nodes.filter((n) => ids.has(n.id));
    const set = focus.length > 0 ? focus : nodes;
    const minX = Math.min(...set.map((n) => n.x)) - 150;
    const maxX = Math.max(...set.map((n) => n.x)) + 150;
    const minY = Math.min(...set.map((n) => n.y)) - 120;
    const maxY = Math.max(...set.map((n) => n.y)) + 130;
    const spanX = Math.max(300, maxX - minX);
    const spanY = Math.max(190, maxY - minY);
    const z = Number(Math.max(0.7, Math.min(1.9, Math.min(1000 / spanX, 500 / spanY))).toFixed(3));
    glideTo(z, minX + spanX / 2 - 500 / z, minY + spanY / 2 - 250 / z);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusKey, cameraOn]);

  const activePacket = packets[currentPacketIndex] ?? null;
  const currentStep = steps[currentStepIndex];
  const captionText = currentStep ? `${tc(currentStep.title)}. ${tc(currentStep.caption)}` : '';
  const { stop: stopSpeech } = speech;
  // A new step or language makes the spoken caption stale, so silence it.
  React.useEffect(() => {
    stopSpeech();
  }, [currentStepIndex, i18n.language, stopSpeech]);

  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const srcNode = activePacket ? nodeMap.get(activePacket.fromDeviceId) : undefined;
  const dstNode = activePacket ? nodeMap.get(activePacket.toDeviceId) : undefined;

  const isActiveLink = (l: ProtocolLinkDef) => {
    if (!activePacket) return false;
    return (
      (l.sourceId === activePacket.fromDeviceId && l.targetId === activePacket.toDeviceId) ||
      (l.targetId === activePacket.fromDeviceId && l.sourceId === activePacket.toDeviceId)
    );
  };

  const pktPos = (() => {
    if (!activePacket || !srcNode || !dstNode) return null;
    const tVal = isPlaying ? Math.min(1, Math.max(0.05, packetProgress)) : 0.5;
    const clampedT = activePacket.dropped ? Math.min(0.55, tVal) : tVal;
    const x = srcNode.x + (dstNode.x - srcNode.x) * clampedT;
    const y = srcNode.y + (dstNode.y - srcNode.y) * clampedT;
    const trailT = Math.max(0, clampedT - 0.14);
    const tx = srcNode.x + (dstNode.x - srcNode.x) * trailT;
    const ty = srcNode.y + (dstNode.y - srcNode.y) * trailT;
    return { x, y, tx, ty };
  })();

  const exportSvg = () => {
    if (!svgRef.current) return;
    const serializer = new XMLSerializer();
    const raw = resolveCssVars(serializer.serializeToString(inlineSvgStyles(svgRef.current)));
    const blob = new Blob([raw], { type: 'image/svg+xml;charset=utf-8' });
    triggerDownload(blob, `${protocolName.toLowerCase().replace(/[^a-z0-9]/g, '-')}-diagram.svg`);
  };

  const exportPng = () => {
    if (!svgRef.current) return;
    const serializer = new XMLSerializer();
    const raw = resolveCssVars(serializer.serializeToString(inlineSvgStyles(svgRef.current)));
    const img = new Image();
    const svgBlob = new Blob([raw], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 1600;
      canvas.height = 800;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = theme === 'dark' ? '#14161d' : '#f7f5f0';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((pngBlob) => {
          if (pngBlob) {
            triggerDownload(pngBlob, `${protocolName.toLowerCase().replace(/[^a-z0-9]/g, '-')}-diagram.png`);
          }
        });
      }
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };

  const hoveredNode = hoveredNodeId ? nodeMap.get(hoveredNodeId) : undefined;
  const activeColor = activePacket
    ? PACKET_COLORS[activePacket.colorCategory]?.hex || 'var(--pkt-tcp)'
    : 'var(--pkt-tcp)';

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-[var(--bg-canvas)] blueprint-grid">
      {/* Top Floating Caption + Zoom/Export Strip */}
      <div className="@container shrink-0 flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-hairline)] bg-[var(--bg-surface)] px-4 py-2.5">
        <div className="min-w-0 flex-1 basis-full text-sm leading-snug @3xl:basis-0" aria-live="polite">
          <span className="font-semibold text-[var(--accent-primary)]">
            {t('playback.step')} {currentStepIndex + 1}
            {currentStep ? ` · ${tc(currentStep.title)}` : ''}
          </span>
          <span className="block text-[var(--text-primary)]">
            {currentStep ? <Gloss text={tc(currentStep.caption)} /> : protocolName}
          </span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {speech.supported && currentStep && (
            <button
              type="button"
              onClick={() => (speech.speaking ? speech.stop() : speech.speak(captionText))}
              aria-pressed={speech.speaking}
              title={speech.voiceOk ? t('explore.readAloud') : t('explore.noVoice')}
              aria-label={speech.speaking ? t('explore.stopReading') : t('explore.readAloud')}
              className={`flex h-8 items-center gap-1.5 rounded-md border px-2 text-[11px] font-semibold ${
                speech.speaking
                  ? 'border-[var(--accent-primary)] bg-[var(--accent-primary-soft)] text-[var(--accent-primary)]'
                  : 'border-[var(--border-hairline)] bg-[var(--bg-inset)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              } ${speech.voiceOk ? '' : 'opacity-60'}`}
            >
              {speech.speaking ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{speech.speaking ? t('explore.stopReading') : t('explore.readAloud')}</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setCameraOn((on) => !on)}
            aria-pressed={cameraOn}
            title={t('explore.cameraHint')}
            className={`flex h-8 items-center gap-1.5 rounded-md border px-2 text-[11px] font-semibold ${
              cameraOn
                ? 'border-[var(--accent-primary)] bg-[var(--accent-primary-soft)] text-[var(--accent-primary)]'
                : 'border-[var(--border-hairline)] bg-[var(--bg-inset)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Clapperboard className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t('explore.camera')}</span>
          </button>
          {/* Zoom Controls */}
          <div className="inline-flex items-center rounded-md border border-[var(--border-hairline)] bg-[var(--bg-inset)] p-0.5">
            <button
              type="button"
              onClick={() => {
                stopCamera();
                zoomAtPoint(zoom - 0.15, pan.x + vbW / 2, pan.y + vbH / 2);
              }}
              title={t('explore.zoomOut')}
              aria-label={tc('Zoom Out')}
              className="flex h-6 w-6 items-center justify-center rounded text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)]"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={resetZoom}
              title={t('explore.resetZoom')}
              aria-label={tc('Reset Zoom')}
              className="px-1.5 font-mono text-[11px] font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] tabular-nums"
            >
              {Math.round(zoom * 100)}%
            </button>
            <button
              type="button"
              onClick={() => {
                stopCamera();
                zoomAtPoint(zoom + 0.15, pan.x + vbW / 2, pan.y + vbH / 2);
              }}
              title={t('explore.zoomIn')}
              aria-label={tc('Zoom In')}
              className="flex h-6 w-6 items-center justify-center rounded text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)]"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={fitView}
              title={t('explore.fitDiagram')}
              aria-label={tc('Fit Diagram to View')}
              className="flex h-6 items-center gap-1 rounded px-1.5 text-[11px] font-mono text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)]"
            >
              <Maximize2 className="w-3 h-3" />
              <span className="hidden sm:inline">{t('explore.fitDiagram')}</span>
            </button>
          </div>

          {experienceLevel === 'pro' && (
            <>
              <button
                type="button"
                onClick={exportSvg}
                title={t('explore.downloadSvg')}
                className="flex items-center gap-1 rounded-md border border-[var(--border-hairline)] px-2 py-1 text-xs font-mono text-[var(--text-secondary)] hover:text-[var(--text-primary)] whitespace-nowrap shrink-0"
              >
                <Download className="w-3 h-3" />
                <span>{t('explore.downloadSvg')}</span>
              </button>
              <button
                type="button"
                onClick={exportPng}
                title={t('explore.downloadPng')}
                className="flex items-center gap-1 rounded-md border border-[var(--border-hairline)] px-2 py-1 text-xs font-mono text-[var(--text-secondary)] hover:text-[var(--text-primary)] whitespace-nowrap shrink-0"
              >
                <Camera className="w-3 h-3" />
                <span>{t('explore.downloadPng')}</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Responsive SVG Canvas */}
      <div className="relative flex-1 min-h-[240px] w-full flex items-center justify-center overflow-hidden">
        <svg
          ref={svgRef}
          viewBox={`${pan.x} ${pan.y} ${vbW} ${vbH}`}
          onMouseDown={(e) => {
            if (e.target === svgRef.current) {
              stopCamera();
              setPanning({ startX: e.clientX, startY: e.clientY, origX: pan.x, origY: pan.y });
            }
          }}
          onMouseMove={(e) => {
            if (!panning || !svgRef.current) return;
            const rect = svgRef.current.getBoundingClientRect();
            const dx = ((e.clientX - panning.startX) / rect.width) * vbW;
            const dy = ((e.clientY - panning.startY) / rect.height) * vbH;
            setPan({ x: panning.origX - dx, y: panning.origY - dy });
          }}
          onMouseUp={() => setPanning(null)}
          onMouseLeave={() => setPanning(null)}
          className="h-full max-h-full w-full select-none cursor-grab active:cursor-grabbing"
          role="img"
          aria-label={`${protocolName} network topology animation diagram`}
        >
          <defs>
            <marker id="linkArrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M1.5 1.5 L8.5 5 L1.5 8.5" fill="none" stroke="context-stroke" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
            </marker>
            <filter id="packetGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Links: dashed with arrowheads; the active one flows in the packet's direction */}
          {links.map((l) => {
            const a = nodeMap.get(l.sourceId);
            const b = nodeMap.get(l.targetId);
            if (!a || !b) return null;
            const active = isActiveLink(l);
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const len = Math.hypot(dx, dy) || 1;
            const trim = len > 150 ? 50 : 0;
            const ux = dx / len;
            const uy = dy / len;
            const x1 = a.x + ux * trim;
            const y1 = a.y + uy * trim;
            const x2 = b.x - ux * trim;
            const y2 = b.y - uy * trim;
            const reversed = active && activePacket ? activePacket.fromDeviceId === l.targetId : false;
            return (
              <g key={l.id}>
                <line
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke={active ? activeColor : 'var(--link-stroke)'}
                  strokeWidth={active ? 2.6 : 1.5}
                  strokeLinecap="round"
                  strokeDasharray={active ? undefined : '5 6'}
                  strokeOpacity={active ? 1 : 0.8}
                  className={active ? `link-flow${reversed ? ' link-flow-rev' : ''}` : undefined}
                  markerStart={trim ? 'url(#linkArrow)' : undefined}
                  markerEnd={trim ? 'url(#linkArrow)' : undefined}
                />
                {l.label && (
                  <text
                    x={(a.x + b.x) / 2}
                    y={(a.y + b.y) / 2 - 8}
                    textAnchor="middle"
                    className="fill-[var(--text-muted)] text-[11px] font-mono"
                  >
                    {l.label}
                  </text>
                )}
              </g>
            );
          })}

          {/* Device Nodes */}
          {nodes.map((node) => {
            const isSenderOrReceiver =
              activePacket &&
              (activePacket.fromDeviceId === node.id || activePacket.toDeviceId === node.id);
            return (
              <g
                key={node.id}
                transform={`translate(${node.x}, ${node.y})`}
                onMouseEnter={() => setHoveredNodeId(node.id)}
                onMouseLeave={() => setHoveredNodeId(null)}
                className="cursor-pointer"
              >
                {isSenderOrReceiver && (
                  <>
                    <circle className="node-ring" cx={0} cy={0} r={50} fill="none" stroke={activeColor} strokeWidth={1.6} strokeOpacity={0.75} strokeDasharray="5 5" />
                    {activePacket?.toDeviceId === node.id && (
                      <circle className="node-pulse" cx={0} cy={0} r={46} fill="none" stroke={activeColor} strokeWidth={2} />
                    )}
                  </>
                )}
                <g transform="translate(-40, -56) scale(1.25)" filter={isSenderOrReceiver ? 'url(#packetGlow)' : undefined}>
                  <IsometricHardwareArt
                    role={node.role}
                    active={Boolean(isSenderOrReceiver)}
                    connectedPortCount={1}
                  />
                </g>
                <text
                  x={0}
                  y={52}
                  textAnchor="middle"
                  className="fill-[var(--text-primary)] font-mono text-[13px] font-bold"
                >
                  {tc(node.label)}
                </text>
                <text
                  x={0}
                  y={67}
                  textAnchor="middle"
                  className="fill-[var(--text-secondary)] text-[11.5px] font-mono"
                >
                  {node.ip}
                </text>
                {settings.showMacAddresses && node.mac && (
                  <text
                    x={0}
                    y={80}
                    textAnchor="middle"
                    className="fill-[var(--text-muted)] text-[11px] font-mono"
                  >
                    {node.mac}
                  </text>
                )}
              </g>
            );
          })}

          {/* Animated Traveling Packet + Colored Trail */}
          {activePacket && pktPos && (
            <g
              onClick={() => setSelectedPopoverPkt(activePacket)}
              className="cursor-pointer"
              filter="url(#packetGlow)"
            >
              <line
                x1={pktPos.tx}
                y1={pktPos.ty}
                x2={pktPos.x}
                y2={pktPos.y}
                stroke={activeColor}
                strokeWidth={4 * settings.packetScale}
                strokeLinecap="round"
                strokeOpacity={0.55}
              />
              {activePacket.dropped ? (
                <g transform={`translate(${pktPos.x}, ${pktPos.y})`}>
                  <circle r={11 * settings.packetScale} fill="var(--pkt-error)" fillOpacity={0.25} stroke="var(--pkt-error)" strokeWidth={2} />
                  <path d="M-5 -5 L5 5 M5 -5 L-5 5" stroke="var(--pkt-error)" strokeWidth={2.5} strokeLinecap="round" />
                </g>
              ) : (
                <g transform={`translate(${pktPos.x}, ${pktPos.y})`}>
                  <circle className="node-pulse" r={9 * settings.packetScale} fill="none" stroke={activeColor} strokeWidth={1.6} />
                  <circle r={7 * settings.packetScale} fill={activeColor} stroke="#ffffff" strokeWidth={1.5} />
                </g>
              )}
              <g transform={`translate(${pktPos.x}, ${pktPos.y - 22})`}>
                <rect
                  x={-72}
                  y={-12}
                  width={144}
                  height={20}
                  rx={5}
                  fill="var(--bg-surface)"
                  stroke={activeColor}
                  strokeWidth={1.2}
                />
                <text
                  x={0}
                  y={2}
                  textAnchor="middle"
                  className="fill-[var(--text-primary)] text-[11px] font-mono font-semibold"
                >
                  {activePacket.protocol} · {activePacket.sizeBytes}B
                </text>
              </g>
            </g>
          )}
        </svg>

        {/* Node Hover Tooltip */}
        {hoveredNode && (
          <div
            role="status"
            className="pointer-events-none absolute top-3 start-3 z-10 max-w-xs rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)]/95 p-3 text-xs shadow-xl backdrop-blur-md"
          >
            <div className="font-semibold text-[var(--text-primary)]">{hoveredNode.label}</div>
            <div className="mt-1 space-y-0.5 font-mono text-xs text-[var(--text-secondary)]">
              <div>Role: {hoveredNode.role.replace('_', ' ')}</div>
              <div>IP: {hoveredNode.ip}</div>
              {hoveredNode.mac && <div>MAC: {hoveredNode.mac}</div>}
              {hoveredNode.openPorts && hoveredNode.openPorts.length > 0 && (
                <div>Open Ports: {hoveredNode.openPorts.join(', ')}</div>
              )}
              {hoveredNode.asn && <div>ASN: AS{hoveredNode.asn}</div>}
            </div>
          </div>
        )}

        {/* Clicked Packet Popover */}
        {selectedPopoverPkt && (
          <div className="absolute bottom-12 end-3 z-20 w-72 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)] p-3 text-xs shadow-2xl">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono font-bold text-[var(--accent-primary)]">
                #{selectedPopoverPkt.no} · {selectedPopoverPkt.protocol}
              </span>
              <button
                type="button"
                onClick={() => setSelectedPopoverPkt(null)}
                aria-label={t('common.close')}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                ✕
              </button>
            </div>
            <p className="mt-1 font-mono text-xs text-[var(--text-secondary)] break-words">
              {selectedPopoverPkt.srcIp} → {selectedPopoverPkt.dstIp} ({selectedPopoverPkt.sizeBytes} bytes)
            </p>
            <p className="mt-1 text-[var(--text-primary)]">{selectedPopoverPkt.info}</p>
            <button
              type="button"
              onClick={() => {
                onInspectPacket(selectedPopoverPkt.id);
                setSelectedPopoverPkt(null);
              }}
              className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-lg bg-[var(--accent-cta)] py-1.5 font-semibold text-[var(--on-accent)] hover:bg-[var(--accent-cta-hover)]"
            >
              <Info className="w-3.5 h-3.5" />
              <span>{t('explore.packetInspector')}</span>
            </button>
          </div>
        )}
      </div>

      {/* Packet Color Legend Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border-hairline)] bg-[var(--bg-surface)]/85 px-4 py-1.5 text-xs">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          {LEGEND_ITEMS.map((item) => (
            <span key={item.key} className="flex items-center gap-1.5 font-mono text-[var(--text-secondary)]">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: item.hex }}
                aria-hidden="true"
              />
              <span>{item.label}</span>
            </span>
          ))}
        </div>
        <span className="hidden lg:inline text-xs text-[var(--text-muted)]">
          {t('explore.clickPacketHint')}
        </span>
      </div>
    </div>
  );
};
