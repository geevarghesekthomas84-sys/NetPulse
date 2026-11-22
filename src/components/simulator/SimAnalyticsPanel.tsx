import React, { useState } from 'react';
import { Activity, AlertTriangle, BarChart3, CheckCircle2, Layers } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { SimulationAnalytics } from '../../lib/simAnalytics';
import { PACKET_COLORS } from '../explore/colors';
import { tc } from '../../i18n/content';

interface SimAnalyticsPanelProps {
  analytics: SimulationAnalytics;
  playbackMode: 'live' | 'step';
  visiblePacketCount: number;
  totalPacketCount: number;
}

export const SimAnalyticsPanel: React.FC<SimAnalyticsPanelProps> = ({
  analytics,
  playbackMode,
  visiblePacketCount,
  totalPacketCount,
}) => {
  const { t } = useTranslation();
  const [hoveredBucketIdx, setHoveredBucketIdx] = useState<number | null>(null);

  const hasPackets = analytics.sentCount > 0;
  const hasDrops = analytics.droppedCount > 0;
  const maxThroughput = Math.max(
    10,
    ...analytics.buckets.map((b) => Math.max(b.throughputKbps, b.goodputKbps))
  );

  const hoveredBucket =
    hoveredBucketIdx !== null ? analytics.buckets[hoveredBucketIdx] ?? null : null;
  const activeBucket =
    hoveredBucket ?? analytics.buckets[analytics.buckets.length - 1] ?? null;

  const chartW = 540;
  const chartH = 136;
  const padL = 42;
  const padR = 14;
  const padT = 14;
  const padB = 24;
  const innerW = chartW - padL - padR;
  const innerH = chartH - padT - padB;

  const xForIdx = (idx: number, len: number) =>
    len <= 1 ? padL + innerW / 2 : padL + (idx / (len - 1)) * innerW;
  const yForVal = (val: number) => padT + innerH - (val / maxThroughput) * innerH;

  const throughputPoints = analytics.buckets.map((b, i) => ({
    x: xForIdx(i, analytics.buckets.length),
    y: yForVal(b.throughputKbps),
  }));
  const goodputPoints = analytics.buckets.map((b, i) => ({
    x: xForIdx(i, analytics.buckets.length),
    y: yForVal(b.goodputKbps),
  }));

  const throughputPolyline = throughputPoints.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const goodputPolyline = goodputPoints.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const areaPath =
    throughputPoints.length > 0
      ? `M ${throughputPoints[0].x.toFixed(1)},${(padT + innerH).toFixed(1)} ` +
        throughputPoints.map((p) => `L ${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ') +
        ` L ${throughputPoints[throughputPoints.length - 1].x.toFixed(1)},${(padT + innerH).toFixed(1)} Z`
      : '';

  return (
    <div
      data-testid="sim-analytics-panel"
      className="flex-1 min-h-0 overflow-y-auto p-3 space-y-3"
    >
      {/* Top Status & KPI Summary Strip */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-hairline)] pb-2 text-xs">
        <div className="flex items-center gap-2 min-w-0">
          <BarChart3 className="w-3.5 h-3.5 text-[var(--accent-primary)] shrink-0" />
          <span className="font-semibold text-[var(--text-primary)]">{t('simulator.liveAnalytics')}</span>
          <span className="font-mono text-xs text-[var(--text-muted)] tabular-nums">
            · {visiblePacketCount}/{totalPacketCount} · {playbackMode === 'step' ? t('simulator.stepByStepMode') : t('simulator.liveMode')}
          </span>
        </div>

        <div className="flex items-center gap-1.5 font-mono text-xs font-semibold tabular-nums">
          {hasDrops ? (
            <span className="inline-flex items-center gap-1 text-[var(--tone-danger)]">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>
                {t('simulator.lossDetected')}: {analytics.droppedCount} ({analytics.dropRatePercent}%)
              </span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[var(--tone-success)]">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{t('simulator.nominalStatus')} · 0% {t('simulator.dropRate')}</span>
            </span>
          )}
        </div>
      </div>

      {/* KPI Numeric Strip (Tabular Numerals) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 font-mono text-xs tabular-nums">
        <div className="rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-inset)] px-2.5 py-2">
          <div className="text-[11px] uppercase tracking-wide text-[var(--text-muted)]">
            {t('simulator.throughputLabel')}
          </div>
          <div data-testid="kpi-throughput" className="mt-0.5 text-sm font-bold text-[var(--accent-primary)]">
            {analytics.throughputKbps} Kbps
          </div>
        </div>
        <div className="rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-inset)] px-2.5 py-2">
          <div className="text-[11px] uppercase tracking-wide text-[var(--text-muted)]">
            {t('simulator.goodputLabel')}
          </div>
          <div data-testid="kpi-goodput" className="mt-0.5 text-sm font-bold text-[var(--tone-success)]">
            {analytics.goodputKbps} Kbps
          </div>
        </div>
        <div className="rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-inset)] px-2.5 py-2">
          <div className="text-[11px] uppercase tracking-wide text-[var(--text-muted)]">{tc('AVG RTT')}</div>
          <div className="mt-0.5 text-sm font-bold text-[var(--text-primary)]">{analytics.avgLatencyMs} ms</div>
        </div>
        <div className="rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-inset)] px-2.5 py-2">
          <div className="text-[11px] uppercase tracking-wide text-[var(--text-muted)]">{tc('JITTER')}</div>
          <div className="mt-0.5 text-sm font-bold text-[var(--text-primary)]">{analytics.jitterMs} ms</div>
        </div>
        <div className="rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-inset)] px-2.5 py-2">
          <div className="text-[11px] uppercase tracking-wide text-[var(--text-muted)]">
            {t('simulator.dropRate')}
          </div>
          <div
            className={`mt-0.5 text-sm font-bold ${
              hasDrops ? 'text-[var(--tone-danger)]' : 'text-[var(--text-primary)]'
            }`}
          >
            {analytics.dropRatePercent}% ({analytics.droppedCount})
          </div>
        </div>
        <div className="rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-inset)] px-2.5 py-2">
          <div className="text-[11px] uppercase tracking-wide text-[var(--text-muted)]">{tc('TOTAL BYTES')}</div>
          <div className="mt-0.5 text-sm font-bold text-[var(--text-primary)]">{analytics.totalBytes} B</div>
        </div>
      </div>

      {!hasPackets ? (
        <div className="rounded-lg border border-dashed border-[var(--border-hairline)] bg-[var(--bg-inset)]/60 px-4 py-6 text-center text-xs text-[var(--text-muted)]">
          {t('simulator.noTrafficAnalytics')}
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-12">
          {/* Live Throughput & Goodput Time-Series SVG Chart */}
          <div className="lg:col-span-7 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-inset)] p-2.5 space-y-1.5">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-3">
                <span className="font-semibold text-[var(--text-primary)]">{t('simulator.throughputChart')}</span>
                <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-[var(--text-secondary)]">
                  <span className="inline-block h-2 w-2 rounded-xs bg-[var(--accent-primary)]" />
                  {t('simulator.throughputLabel')}
                </span>
                <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-[var(--text-secondary)]">
                  <span className="inline-block h-0.5 w-3 border-t-2 border-dashed border-[var(--tone-success)]" />
                  {t('simulator.goodputLabel')}
                </span>
              </div>

              {activeBucket && (
                <span className="font-mono text-[11px] text-[var(--accent-primary)] tabular-nums">
                  {activeBucket.startMs}–{activeBucket.endMs}ms · {activeBucket.throughputKbps} Kbps · {activeBucket.packetCount}{' '}
                  {t('simulator.packetsPerBucket')}
                </span>
              )}
            </div>

            <svg
              viewBox={`0 0 ${chartW} ${chartH}`}
              role="img"
              aria-label={t('simulator.throughputChart')}
              data-testid="live-throughput-chart"
              className="w-full h-32 select-none"
            >
              <defs>
                <linearGradient id="simThroughputArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--accent-primary)" stopOpacity="0.28" />
                  <stop offset="100%" stopColor="var(--accent-primary)" stopOpacity="0.02" />
                </linearGradient>
              </defs>

              {/* Horizontal Y-Axis Gridlines */}
              {[0, 0.5, 1].map((frac) => {
                const y = padT + innerH - frac * innerH;
                const val = Math.round(maxThroughput * frac);
                return (
                  <g key={frac}>
                    <line
                      x1={padL}
                      y1={y}
                      x2={chartW - padR}
                      y2={y}
                      stroke="var(--border-hairline)"
                      strokeDasharray={frac === 0 ? undefined : '3 3'}
                    />
                    <text
                      x={padL - 5}
                      y={y + 3}
                      textAnchor="end"
                      className="fill-[var(--text-muted)] text-[11px] font-mono tabular-nums"
                    >
                      {val}
                    </text>
                  </g>
                );
              })}

              {/* Area fill + Line Traces */}
              {areaPath && <path d={areaPath} fill="url(#simThroughputArea)" />}
              {throughputPolyline && (
                <polyline
                  fill="none"
                  stroke="var(--accent-primary)"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  points={throughputPolyline}
                />
              )}
              {goodputPolyline && (
                <polyline
                  fill="none"
                  stroke="var(--tone-success)"
                  strokeWidth="1.7"
                  strokeDasharray="4 3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  points={goodputPolyline}
                />
              )}

              {/* Interactive Bucket Nodes & X-axis labels */}
              {analytics.buckets.map((b, i) => {
                const cx = xForIdx(i, analytics.buckets.length);
                const cy = yForVal(b.throughputKbps);
                const isHover = hoveredBucketIdx === i;
                const showTick =
                  i === 0 ||
                  i === analytics.buckets.length - 1 ||
                  i === Math.floor(analytics.buckets.length / 2);
                return (
                  <g
                    key={b.index}
                    onMouseEnter={() => setHoveredBucketIdx(i)}
                    onMouseLeave={() => setHoveredBucketIdx(null)}
                    className="cursor-crosshair"
                  >
                    <rect
                      x={cx - 16}
                      y={padT}
                      width={32}
                      height={innerH}
                      fill="transparent"
                    />
                    <circle
                      cx={cx}
                      cy={cy}
                      r={isHover ? 4.5 : 2.8}
                      fill={b.droppedCount > 0 ? 'var(--tone-danger)' : 'var(--accent-primary)'}
                      stroke="var(--bg-surface)"
                      strokeWidth={1.3}
                    />
                    {showTick && (
                      <text
                        x={cx}
                        y={chartH - 6}
                        textAnchor="middle"
                        className="fill-[var(--text-muted)] text-[11px] font-mono tabular-nums"
                      >
                        {b.label}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Protocol Distribution + Per-Link Utilization */}
          <div className="lg:col-span-5 flex flex-col gap-2.5">
            <div className="rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-inset)] p-2.5 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="inline-flex items-center gap-1.5 font-semibold text-[var(--text-primary)]">
                  <Layers className="w-3.5 h-3.5 text-[var(--accent-teal)]" />
                  <span>{t('simulator.protocolMix')}</span>
                </span>
                <span className="font-mono text-[11px] text-[var(--text-muted)] tabular-nums">
                  {analytics.sentCount} frames
                </span>
              </div>

              <div className="space-y-1.5">
                {analytics.protocolStats.slice(0, 5).map((item) => {
                  const hex = PACKET_COLORS[item.colorCategory]?.hex || 'var(--pkt-tcp)';
                  return (
                    <div key={item.protocol} className="space-y-0.5 font-mono text-xs tabular-nums">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5 font-semibold text-[var(--text-primary)]">
                          <span
                            className="inline-block h-2 w-2 rounded-xs shrink-0"
                            style={{ backgroundColor: hex }}
                          />
                          <span>{item.protocol}</span>
                        </span>
                        <span className="text-[var(--text-secondary)]">
                          {item.count} · {item.percent}% · {item.bytes} B
                        </span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--border-hairline)]">
                        <div
                          className="h-full transition-[width] duration-150"
                          style={{ width: `${Math.max(4, item.percent)}%`, backgroundColor: hex }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-inset)] p-2.5 space-y-1.5">
              <div className="text-xs font-semibold text-[var(--text-primary)]">
                {t('simulator.linkUtilization')}
              </div>
              <div className="space-y-1.5 max-h-28 overflow-y-auto">
                {analytics.linkStats.map((ls) => (
                  <div key={ls.linkId} className="font-mono text-xs tabular-nums">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-[var(--text-secondary)]">
                        {ls.label} {!ls.up ? '(DOWN)' : ''}
                      </span>
                      <span className="text-[var(--accent-primary)] shrink-0">
                        {ls.packets}p · {ls.utilizationPercent}%
                      </span>
                    </div>
                    <div className="mt-0.5 h-1.5 w-full overflow-hidden rounded-full bg-[var(--border-hairline)]">
                      <div
                        className={`h-full transition-[width] duration-150 ${
                          !ls.up ? 'bg-[var(--tone-danger)]' : 'bg-[var(--accent-cta)]'
                        }`}
                        style={{ width: `${Math.min(100, Math.max(ls.packets > 0 ? 4 : 0, ls.utilizationPercent))}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* TCP Congestion Window Sawtooth when active TCP sessions exist */}
          {analytics.cwndSeries.length > 1 && (
            <div className="lg:col-span-12 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-inset)] p-2.5">
              <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-[var(--text-primary)]">
                <Activity className="w-3.5 h-3.5 text-[var(--accent-teal)]" />
                <span>{tc('TCP cwnd / ssthresh Sawtooth')}</span>
              </div>
              <svg viewBox="0 0 600 110" className="w-full h-24">
                {(() => {
                  const maxY = Math.max(20, ...analytics.cwndSeries.map((d) => Math.max(d.cwnd, d.ssthresh)));
                  const stepX = 560 / Math.max(1, analytics.cwndSeries.length - 1);
                  const toY = (v: number) => 95 - (v / maxY) * 80;
                  const pts = analytics.cwndSeries
                    .map((d, i) => `${20 + i * stepX},${toY(d.cwnd).toFixed(1)}`)
                    .join(' ');
                  const ss = analytics.cwndSeries
                    .map((d, i) => `${20 + i * stepX},${toY(d.ssthresh).toFixed(1)}`)
                    .join(' ');
                  return (
                    <>
                      <polyline fill="none" stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="4 3" points={ss} />
                      <polyline fill="none" stroke="#06b6d4" strokeWidth="2.4" points={pts} />
                    </>
                  );
                })()}
              </svg>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
