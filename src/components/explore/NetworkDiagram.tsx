import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Camera, Download, Info, Maximize2, ZoomIn, ZoomOut } from 'lucide-react';
import type { CapturedPacket } from '../../engine/types';
import type { ProtocolLinkDef, ProtocolNodeDef, ProtocolStepDef } from '../../protocols/types';
import { triggerDownload } from '../../lib/pcapWriter';
import {
  clientDeltaToSvg,
  clientPointToSvg,
  computeFitViewport,
  computeZoomAtAnchor,
  SVG_MAX_ZOOM,
  SVG_MIN_ZOOM,
  wheelDeltaToZoomFactor,
} from '../../lib/svgViewport';
import { useAppStore } from '../../store/useAppStore';
import { IsometricHardwareArt } from '../icons/IsometricHardwareLibrary';
import { LEGEND_ITEMS, PACKET_COLORS } from './colors';
import { AnnotatedCaption } from '../common/AnnotatedCaption';
import { TextToSpeechButton } from '../common/TextToSpeechButton';

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
  const { t } = useTranslation();
  const { settings, isPlaying, experienceLevel, theme } = useAppStore();
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [selectedPopoverPkt, setSelectedPopoverPkt] = useState<CapturedPacket | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const viewportRef = useRef({ zoom: 1, pan: { x: 0, y: 0 } });
  viewportRef.current = { zoom, pan };
  const pinchRef = useRef<{ dist: number; anchorSvg: { x: number; y: number } } | null>(null);
  const touchPanRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const [panning, setPanning] = useState<{ startX: number; startY: number; origX: number; origY: number } | null>(null);

  const vbW = 1000 / zoom;
  const vbH = 500 / zoom;

  const applyViewport = (nextZoom: number, nextPan: { x: number; y: number }) => {
    viewportRef.current = { zoom: nextZoom, pan: nextPan };
    setZoom(nextZoom);
    setPan(nextPan);
  };

  const zoomAtPoint = (nextZoomRaw: number, anchorX: number, anchorY: number) => {
    const vp = viewportRef.current;
    const next = computeZoomAtAnchor({
      currentZoom: vp.zoom,
      currentPan: vp.pan,
      nextZoomRaw,
      anchorX,
      anchorY,
      baseWidth: 1000,
      baseHeight: 500,
      minZoom: SVG_MIN_ZOOM,
      maxZoom: SVG_MAX_ZOOM,
    });
    applyViewport(next.zoom, next.pan);
  };

  const resetZoom = () => {
    applyViewport(1, { x: 0, y: 0 });
  };

  const fitView = () => {
    const next = computeFitViewport(
      nodes.map((n) => ({ x: n.x, y: n.y })),
      1000,
      500,
      { x: 110, y: 90 },
      0.5,
      1.8
    );
    applyViewport(next.zoom, next.pan);
  };

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onNativeWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const vp = viewportRef.current;
      const curW = 1000 / vp.zoom;
      const curH = 500 / vp.zoom;
      const anchor = clientPointToSvg(svg, e.clientX, e.clientY, vp.pan.x, vp.pan.y, curW, curH);
      const factor = wheelDeltaToZoomFactor(e.deltaY, e.deltaMode);
      const next = computeZoomAtAnchor({
        currentZoom: vp.zoom,
        currentPan: vp.pan,
        nextZoomRaw: vp.zoom * factor,
        anchorX: anchor.x,
        anchorY: anchor.y,
        baseWidth: 1000,
        baseHeight: 500,
        minZoom: SVG_MIN_ZOOM,
        maxZoom: SVG_MAX_ZOOM,
      });
      viewportRef.current = next;
      setZoom(next.zoom);
      setPan(next.pan);
    };
    svg.addEventListener('wheel', onNativeWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onNativeWheel);
  }, []);

  const activePacket = packets[currentPacketIndex] ?? null;
  const currentStep = steps[currentStepIndex];

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
    const raw = serializer.serializeToString(svgRef.current);
    const blob = new Blob([raw], { type: 'image/svg+xml;charset=utf-8' });
    triggerDownload(blob, `${protocolName.toLowerCase().replace(/[^a-z0-9]/g, '-')}-diagram.svg`);
  };

  const exportPng = () => {
    if (!svgRef.current) return;
    const serializer = new XMLSerializer();
    const raw = serializer.serializeToString(svgRef.current);
    const img = new Image();
    const svgBlob = new Blob([raw], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 1600;
      canvas.height = 800;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = theme === 'dark' ? '#08111e' : '#f6f8fb';
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
    ? theme === 'dark'
      ? PACKET_COLORS[activePacket.colorCategory]?.darkHex || PACKET_COLORS[activePacket.colorCategory]?.hex || '#38bdf8'
      : PACKET_COLORS[activePacket.colorCategory]?.hex || '#0284c7'
    : (theme === 'dark' ? '#38bdf8' : '#0284c7');

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-[var(--bg-canvas)] blueprint-grid">
      {/* Top Floating Caption + Zoom/Export Strip */}
      <div className="shrink-0 flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-hairline)] bg-[var(--bg-surface)]/92 px-3.5 py-1.5 backdrop-blur-sm">
        <div className="min-w-0 flex items-center gap-2 text-xs">
          <span className="font-mono font-bold text-[var(--accent-primary)] uppercase shrink-0">
            {t('playback.step')} {currentStepIndex + 1}
          </span>
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-[var(--text-primary)] font-medium truncate">
              {currentStep ? (
                <>
                  <span className="font-semibold">{currentStep.title}</span> —{' '}
                  <AnnotatedCaption text={currentStep.caption} />
                </>
              ) : (
                protocolName
              )}
            </span>
            {currentStep && (
              <TextToSpeechButton text={`${currentStep.title}. ${currentStep.caption}`} />
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Zoom Controls */}
          <div className="inline-flex items-center rounded-md border border-[var(--border-hairline)] bg-[var(--bg-inset)] p-0.5">
            <button
              type="button"
              onClick={() => {
                const vp = viewportRef.current;
                const w = 1000 / vp.zoom;
                const h = 500 / vp.zoom;
                zoomAtPoint(vp.zoom - 0.15, vp.pan.x + w / 2, vp.pan.y + h / 2);
              }}
              disabled={zoom <= SVG_MIN_ZOOM + 0.001}
              title={t('explore.zoomOut')}
              aria-label="Zoom Out"
              className="flex h-6 w-6 items-center justify-center rounded text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] disabled:opacity-35"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={resetZoom}
              title={t('explore.resetZoom')}
              aria-label="Reset Zoom"
              className="px-1.5 font-mono text-[10.5px] font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] tabular-nums"
            >
              {Math.round(zoom * 100)}%
            </button>
            <button
              type="button"
              onClick={() => {
                const vp = viewportRef.current;
                const w = 1000 / vp.zoom;
                const h = 500 / vp.zoom;
                zoomAtPoint(vp.zoom + 0.15, vp.pan.x + w / 2, vp.pan.y + h / 2);
              }}
              disabled={zoom >= SVG_MAX_ZOOM - 0.001}
              title={t('explore.zoomIn')}
              aria-label="Zoom In"
              className="flex h-6 w-6 items-center justify-center rounded text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] disabled:opacity-35"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={fitView}
              title={t('explore.fitDiagram')}
              aria-label="Fit Diagram to View"
              className="flex h-6 items-center gap-1 rounded px-1.5 text-[10.5px] font-mono text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)]"
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
                className="flex items-center gap-1 rounded-md border border-[var(--border-hairline)] px-2 py-1 text-[11px] font-mono text-[var(--text-secondary)] hover:text-[var(--text-primary)] whitespace-nowrap shrink-0"
              >
                <Download className="w-3 h-3" />
                <span>{t('explore.downloadSvg')}</span>
              </button>
              <button
                type="button"
                onClick={exportPng}
                title={t('explore.downloadPng')}
                className="flex items-center gap-1 rounded-md border border-[var(--border-hairline)] px-2 py-1 text-[11px] font-mono text-[var(--text-secondary)] hover:text-[var(--text-primary)] whitespace-nowrap shrink-0"
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
          onTouchStart={(e) => {
            if (e.touches.length === 2 && svgRef.current) {
              const t1 = e.touches[0];
              const t2 = e.touches[1];
              const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
              const midX = (t1.clientX + t2.clientX) / 2;
              const midY = (t1.clientY + t2.clientY) / 2;
              const vp = viewportRef.current;
              const anchorSvg = clientPointToSvg(svgRef.current, midX, midY, vp.pan.x, vp.pan.y, 1000 / vp.zoom, 500 / vp.zoom);
              pinchRef.current = { dist, anchorSvg };
              touchPanRef.current = null;
            } else if (e.touches.length === 1 && e.target === svgRef.current) {
              const t0 = e.touches[0];
              touchPanRef.current = {
                startX: t0.clientX,
                startY: t0.clientY,
                origX: viewportRef.current.pan.x,
                origY: viewportRef.current.pan.y,
              };
            }
          }}
          onTouchMove={(e) => {
            if (e.touches.length === 2 && pinchRef.current && svgRef.current) {
              const t1 = e.touches[0];
              const t2 = e.touches[1];
              const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
              if (pinchRef.current.dist > 0) {
                const factor = dist / pinchRef.current.dist;
                pinchRef.current.dist = dist;
                const vp = viewportRef.current;
                const next = computeZoomAtAnchor({
                  currentZoom: vp.zoom,
                  currentPan: vp.pan,
                  nextZoomRaw: vp.zoom * factor,
                  anchorX: pinchRef.current.anchorSvg.x,
                  anchorY: pinchRef.current.anchorSvg.y,
                  baseWidth: 1000,
                  baseHeight: 500,
                  minZoom: SVG_MIN_ZOOM,
                  maxZoom: SVG_MAX_ZOOM,
                });
                applyViewport(next.zoom, next.pan);
              }
            } else if (e.touches.length === 1 && touchPanRef.current && svgRef.current) {
              const t0 = e.touches[0];
              const vp = viewportRef.current;
              const { dx, dy } = clientDeltaToSvg(
                svgRef.current,
                t0.clientX - touchPanRef.current.startX,
                t0.clientY - touchPanRef.current.startY,
                1000 / vp.zoom,
                500 / vp.zoom
              );
              applyViewport(vp.zoom, { x: touchPanRef.current.origX - dx, y: touchPanRef.current.origY - dy });
            }
          }}
          onTouchEnd={(e) => {
            if (e.touches.length < 2) pinchRef.current = null;
            if (e.touches.length === 0) touchPanRef.current = null;
          }}
          onMouseDown={(e) => {
            if (e.target === svgRef.current) {
              setPanning({
                startX: e.clientX,
                startY: e.clientY,
                origX: viewportRef.current.pan.x,
                origY: viewportRef.current.pan.y,
              });
            }
          }}
          onMouseMove={(e) => {
            if (!panning || !svgRef.current) return;
            const { dx, dy } = clientDeltaToSvg(
              svgRef.current,
              e.clientX - panning.startX,
              e.clientY - panning.startY,
              vbW,
              vbH
            );
            applyViewport(viewportRef.current.zoom, { x: panning.origX - dx, y: panning.origY - dy });
          }}
          onMouseUp={() => setPanning(null)}
          onMouseLeave={() => setPanning(null)}
          className="h-full max-h-full w-full select-none touch-none cursor-grab active:cursor-grabbing"
          role="img"
          aria-label={`${protocolName} network topology animation diagram`}
        >
          <defs>
            <filter id="packetGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Dashed Link Lines */}
          {links.map((l) => {
            const a = nodeMap.get(l.sourceId);
            const b = nodeMap.get(l.targetId);
            if (!a || !b) return null;
            const active = isActiveLink(l);
            return (
              <g key={l.id}>
                <line
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  stroke={active ? activeColor : 'var(--link-stroke)'}
                  strokeWidth={active ? 3 : 1.75}
                  strokeDasharray={active ? undefined : '6 5'}
                  strokeOpacity={active ? 0.95 : 0.72}
                />
                {l.label && (
                  <text
                    x={(a.x + b.x) / 2}
                    y={(a.y + b.y) / 2 - 8}
                    textAnchor="middle"
                    className="fill-[var(--text-muted)] text-[10px] font-mono"
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
                  <circle
                    cx={0}
                    cy={0}
                    r={38}
                    fill="none"
                    stroke={activeColor}
                    strokeWidth={1.75}
                    strokeOpacity={0.55}
                    strokeDasharray="4 3"
                  />
                )}
                <g transform="translate(-31, -33) scale(0.97)" filter={isSenderOrReceiver ? 'url(#packetGlow)' : undefined}>
                  <IsometricHardwareArt
                    role={node.role}
                    active={Boolean(isSenderOrReceiver)}
                    connectedPortCount={1}
                  />
                </g>
                <text
                  x={0}
                  y={42}
                  textAnchor="middle"
                  className="fill-[var(--text-primary)] text-[12px] font-semibold"
                >
                  {node.label}
                </text>
                <text
                  x={0}
                  y={56}
                  textAnchor="middle"
                  className="fill-[var(--accent-primary)] text-[10.5px] font-mono"
                >
                  {node.ip}
                </text>
                {settings.showMacAddresses && node.mac && (
                  <text
                    x={0}
                    y={69}
                    textAnchor="middle"
                    className="fill-[var(--text-muted)] text-[9.5px] font-mono"
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
                  <circle r={11 * settings.packetScale} fill="#ef4444" fillOpacity={0.25} stroke="#ef4444" strokeWidth={2} />
                  <path d="M-5 -5 L5 5 M5 -5 L-5 5" stroke="#ef4444" strokeWidth={2.5} strokeLinecap="round" />
                </g>
              ) : (
                <g transform={`translate(${pktPos.x}, ${pktPos.y})`}>
                  <circle r={8 * settings.packetScale} fill={activeColor} stroke="#ffffff" strokeWidth={1.5} />
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
                  className="fill-[var(--text-primary)] text-[10px] font-mono font-semibold"
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
            <div className="mt-1 space-y-0.5 font-mono text-[11px] text-[var(--text-secondary)]">
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
            <p className="mt-1 font-mono text-[11px] text-[var(--text-secondary)] break-words">
              {selectedPopoverPkt.srcIp} → {selectedPopoverPkt.dstIp} ({selectedPopoverPkt.sizeBytes} bytes)
            </p>
            <p className="mt-1 text-[var(--text-primary)]">{selectedPopoverPkt.info}</p>
            <button
              type="button"
              onClick={() => {
                onInspectPacket(selectedPopoverPkt.id);
                setSelectedPopoverPkt(null);
              }}
              className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-lg bg-[var(--accent-cta)] py-1.5 font-semibold text-white hover:bg-[var(--accent-cta-hover)]"
            >
              <Info className="w-3.5 h-3.5" />
              <span>{t('explore.packetInspector')}</span>
            </button>
          </div>
        )}
      </div>

      {/* Packet Color Legend Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border-hairline)] bg-[var(--bg-surface)]/85 px-4 py-1.5 text-[11px]">
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
        <span className="hidden lg:inline text-[11px] text-[var(--text-muted)]">
          {t('explore.clickPacketHint')}
        </span>
      </div>
    </div>
  );
};
