import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ZoomIn, ZoomOut } from 'lucide-react';
import type { CapturedPacket } from '../../engine/types';
import { clampSvgZoom, wheelDeltaToZoomFactor } from '../../lib/svgViewport';
import type { ProtocolNodeDef } from '../../protocols/types';
import { useAppStore } from '../../store/useAppStore';
import { PACKET_COLORS } from './colors';

const SEQ_MIN_ZOOM = 0.5;
const SEQ_MAX_ZOOM = 2.4;

interface SequenceDiagramProps {
  nodes: ProtocolNodeDef[];
  packets: CapturedPacket[];
  currentPacketIndex: number;
  onSelectPacket: (packetIndex: number, packetId: string) => void;
}

export const SequenceDiagram: React.FC<SequenceDiagramProps> = ({
  nodes,
  packets,
  currentPacketIndex,
  onSelectPacket,
}) => {
  const { t } = useTranslation();
  const { theme } = useAppStore();
  const [zoom, setZoom] = useState(1);
  const zoomRef = useRef(1);
  zoomRef.current = zoom;
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const width = Math.max(720, nodes.length * 165);
  const colWidth = width / Math.max(1, nodes.length);
  const topHeaderY = 48;
  const rowHeight = 46;
  const height = topHeaderY + Math.max(4, packets.length) * rowHeight + 40;

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      e.stopPropagation();
      const factor = wheelDeltaToZoomFactor(e.deltaY, e.deltaMode);
      const next = clampSvgZoom(zoomRef.current * factor, SEQ_MIN_ZOOM, SEQ_MAX_ZOOM);
      zoomRef.current = next;
      setZoom(next);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const xForNode = (id: string) => {
    const idx = nodes.findIndex((n) => n.id === id);
    return (idx >= 0 ? idx : 0) * colWidth + colWidth / 2;
  };

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-[var(--bg-canvas)] blueprint-grid">
      {/* Top Zoom Strip */}
      <div className="shrink-0 flex items-center justify-between gap-2 border-b border-[var(--border-hairline)] bg-[var(--bg-surface)]/92 px-3.5 py-1.5 backdrop-blur-sm">
        <span className="font-mono text-[11px] font-semibold uppercase text-[var(--text-muted)]">
          {t('explore.sequenceLadder', { count: packets.length })}
        </span>
        <div className="inline-flex items-center rounded-md border border-[var(--border-hairline)] bg-[var(--bg-inset)] p-0.5">
          <button
            type="button"
            onClick={() => setZoom((z) => clampSvgZoom(z - 0.15, SEQ_MIN_ZOOM, SEQ_MAX_ZOOM))}
            disabled={zoom <= SEQ_MIN_ZOOM + 0.001}
            title={t('explore.zoomOut')}
            aria-label="Zoom Out"
            className="flex h-6 w-6 items-center justify-center rounded text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] disabled:opacity-35"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setZoom(1)}
            title={t('explore.resetZoom')}
            aria-label="Reset Zoom"
            className="px-1.5 font-mono text-[10.5px] font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] tabular-nums"
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            type="button"
            onClick={() => setZoom((z) => clampSvgZoom(z + 0.15, SEQ_MIN_ZOOM, SEQ_MAX_ZOOM))}
            disabled={zoom >= SEQ_MAX_ZOOM - 0.001}
            title={t('explore.zoomIn')}
            aria-label="Zoom In"
            className="flex h-6 w-6 items-center justify-center rounded text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] disabled:opacity-35"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div ref={scrollContainerRef} className="flex-1 min-h-0 overflow-auto thin-scrollbar p-2">
        <svg
          style={{
            width: `${Math.round(width * zoom)}px`,
            height: `${Math.round(height * zoom)}px`,
            minWidth: zoom >= 1 ? `${Math.round(zoom * 100)}%` : undefined,
          }}
          viewBox={`0 0 ${width} ${height}`}
          className="mx-auto block select-none"
          role="img"
          aria-label="Protocol sequence ladder diagram"
        >
          <defs>
            <marker
              id="seq-arrow"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 10 5 L 0 9 z" fill="context-stroke" />
            </marker>
          </defs>

          {/* Vertical Lifelines & Node Headers */}
          {nodes.map((node, i) => {
            const x = i * colWidth + colWidth / 2;
            return (
              <g key={node.id}>
                <rect
                  x={x - 62}
                  y={10}
                  width={124}
                  height={34}
                  rx={6}
                  fill="var(--bg-surface)"
                  stroke="var(--accent-primary)"
                  strokeWidth={1.2}
                />
                <text
                  x={x}
                  y={25}
                  textAnchor="middle"
                  className="fill-[var(--text-primary)] text-[11px] font-semibold"
                >
                  {node.label}
                </text>
                <text
                  x={x}
                  y={38}
                  textAnchor="middle"
                  className="fill-[var(--text-muted)] text-[9.5px] font-mono"
                >
                  {node.ip}
                </text>
                <line
                  x1={x}
                  y1={topHeaderY}
                  x2={x}
                  y2={height - 20}
                  stroke="var(--border-strong)"
                  strokeWidth={1.25}
                  strokeDasharray="4 4"
                />
              </g>
            );
          })}

          {/* Progressive Message Arrows */}
          {packets.map((pkt, idx) => {
            const y = topHeaderY + 26 + idx * rowHeight;
            const x1 = xForNode(pkt.fromDeviceId);
            const x2 = xForNode(pkt.toDeviceId);
            const isCurrent = idx === currentPacketIndex;
            const isReached = idx <= currentPacketIndex;
            const color = theme === 'dark'
              ? (PACKET_COLORS[pkt.colorCategory]?.darkHex || PACKET_COLORS[pkt.colorCategory]?.hex || '#38bdf8')
              : (PACKET_COLORS[pkt.colorCategory]?.hex || '#0284c7');
            const dir = x2 >= x1 ? 1 : -1;
            const midX = (x1 + x2) / 2;

            return (
              <g
                key={pkt.id}
                onClick={() => onSelectPacket(idx, pkt.id)}
                className="cursor-pointer"
                opacity={isReached ? 1 : 0.38}
              >
                {isCurrent && (
                  <rect
                    x={8}
                    y={y - 20}
                    width={width - 16}
                    height={36}
                    rx={6}
                    fill={color}
                    fillOpacity={0.12}
                    stroke={color}
                    strokeOpacity={0.55}
                  />
                )}

                <rect x={x1 - 4} y={y - 10} width={8} height={20} rx={2} fill={color} fillOpacity={0.35} />
                <rect x={x2 - 4} y={y - 10} width={8} height={20} rx={2} fill={color} fillOpacity={0.35} />

                <line
                  x1={x1}
                  y1={y}
                  x2={pkt.dropped ? midX : x2 - dir * 8}
                  y2={y}
                  stroke={color}
                  strokeWidth={isCurrent ? 2.5 : 1.75}
                  strokeDasharray={pkt.retransmitted ? '5 3' : undefined}
                  markerEnd={pkt.dropped ? undefined : 'url(#seq-arrow)'}
                />

                {pkt.dropped && (
                  <g transform={`translate(${midX}, ${y})`}>
                    <path d="M-6 -6 L6 6 M6 -6 L-6 6" stroke="#dc2626" strokeWidth={2.5} strokeLinecap="round" />
                  </g>
                )}

                <text
                  x={midX}
                  y={y - 7}
                  textAnchor="middle"
                  className="fill-[var(--text-primary)] text-[10.5px] font-mono font-medium"
                >
                  #{pkt.no} {pkt.protocol}: {pkt.info.slice(0, 56)}
                  {pkt.info.length > 56 ? '…' : ''}
                </text>

                <text
                  x={14}
                  y={y + 4}
                  className="fill-[var(--text-muted)] text-[9.5px] font-mono"
                >
                  {(pkt.timestampMs / 1000).toFixed(3)}s
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
};
