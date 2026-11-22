import React, { useState } from 'react';
import { Activity, BarChart3, Network, Table2 } from 'lucide-react';
import type { CapturedPacket, SimDevice, SimLink, SimMetrics } from '../../engine/types';
import { PacketTable } from '../explore/PacketTable';
import { tc } from '../../i18n/content';

interface LiveDashboardsProps {
  metrics: SimMetrics;
  packets: CapturedPacket[];
  totalPacketCount?: number;
  activeFilter?: string;
  onClearFilter?: () => void;
  devices: SimDevice[];
  links: SimLink[];
  selectedDevice: SimDevice | null;
  onInspectPacket: (id: string) => void;
}

export const LiveDashboards: React.FC<LiveDashboardsProps> = ({
  metrics,
  packets,
  totalPacketCount,
  activeFilter,
  onClearFilter,
  devices,
  links,
  selectedDevice,
  onInspectPacket,
}) => {
  const [tab, setTab] = useState<'capture' | 'metrics' | 'tables'>('capture');
  const devMap = new Map(devices.map((d) => [d.id, d]));

  const countLabel =
    totalPacketCount !== undefined && totalPacketCount !== packets.length
      ? `${packets.length}/${totalPacketCount}`
      : `${packets.length}`;

  return (
    <section
      aria-label={tc('Simulator Dashboards and Packet Capture')}
      className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] overflow-hidden"
    >
      {/* Dashboard Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-hairline)] px-4 py-2">
        <div className="flex items-center gap-1">
          {[
            { id: 'capture', label: `Packet Capture (${countLabel})`, icon: Network },
            { id: 'metrics', label: 'Metrics & cwnd', icon: BarChart3 },
            { id: 'tables', label: 'ARP / MAC / Route / NAT', icon: Table2 },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id as typeof tab)}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  tab === item.id
                    ? 'bg-[var(--accent-cta)] text-[var(--on-accent)]'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-3 font-mono text-xs text-[var(--text-muted)] tabular-nums">
          <span>Sent: {metrics.totalPacketsSent}</span>
          <span>Delivered: {metrics.totalPacketsDelivered}</span>
          <span className={metrics.totalPacketsDropped > 0 ? 'text-[var(--tone-danger)]' : ''}>
            Dropped: {metrics.totalPacketsDropped}
          </span>
          <span>Avg RTT: {metrics.avgLatencyMs}ms</span>
        </div>
      </div>

      {tab === 'capture' && (
        <div className="p-2">
          <PacketTable
            packets={packets}
            currentPacketIndex={Math.max(0, packets.length - 1)}
            filenamePrefix="netpulse-sim-capture"
            onSelectPacket={() => {}}
            onInspectPacket={onInspectPacket}
            externalFilter={activeFilter}
            totalPacketCount={totalPacketCount}
            onClearExternalFilter={onClearFilter}
            hideInternalFilter
          />
        </div>
      )}

      {tab === 'metrics' && (
        <div className="p-4 space-y-4">
          {/* KPI Summary Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 font-mono text-xs tabular-nums">
            <div className="rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-inset)] p-3">
              <div className="text-[11px] text-[var(--text-muted)]">{tc('THROUGHPUT')}</div>
              <div className="mt-1 text-base font-bold text-[var(--accent-primary)]">{metrics.throughputKbps} Kbps</div>
            </div>
            <div className="rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-inset)] p-3">
              <div className="text-[11px] text-[var(--text-muted)]">{tc('GOODPUT')}</div>
              <div className="mt-1 text-base font-bold text-[var(--tone-success)]">{metrics.goodputKbps} Kbps</div>
            </div>
            <div className="rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-inset)] p-3">
              <div className="text-[11px] text-[var(--text-muted)]">{tc('AVG LATENCY')}</div>
              <div className="mt-1 text-base font-bold text-[var(--text-primary)]">{metrics.avgLatencyMs} ms</div>
            </div>
            <div className="rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-inset)] p-3">
              <div className="text-[11px] text-[var(--text-muted)]">{tc('JITTER')}</div>
              <div className="mt-1 text-base font-bold text-[var(--text-primary)]">{metrics.jitterMs} ms</div>
            </div>
            <div className="rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-inset)] p-3">
              <div className="text-[11px] text-[var(--text-muted)]">{tc('RETRANSMITS')}</div>
              <div className="mt-1 text-base font-bold text-[var(--tone-warning)]">{metrics.totalRetransmissions}</div>
            </div>
            <div className="rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-inset)] p-3">
              <div className="text-[11px] text-[var(--text-muted)]">{tc('TOTAL BYTES')}</div>
              <div className="mt-1 text-base font-bold text-[var(--text-primary)]">{metrics.totalBytesTransferred} B</div>
            </div>
          </div>

          {/* Link Utilization Bars */}
          <div className="space-y-2">
            <div className="text-xs font-semibold text-[var(--text-primary)]">{tc('Link Utilization')}</div>
            <div className="grid gap-2 sm:grid-cols-2">
              {links.map((l) => {
                const a = devMap.get(l.sourceId)?.name || l.sourceId;
                const b = devMap.get(l.targetId)?.name || l.targetId;
                const util = metrics.linkUtilization[l.id] ?? 0;
                return (
                  <div
                    key={l.id}
                    className="rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-inset)] px-3 py-2 text-xs"
                  >
                    <div className="flex justify-between font-mono text-xs">
                      <span>
                        {a} ↔ {b}
                      </span>
                      <span className="text-[var(--accent-primary)]">{util}%</span>
                    </div>
                    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[var(--border-hairline)]">
                      <div
                        className="h-full bg-[var(--accent-cta)] transition-all"
                        style={{ width: `${Math.min(100, Math.max(2, util))}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Live cwnd Chart */}
          {metrics.cwndSeries.length > 1 && (
            <div className="rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-inset)] p-3">
              <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-[var(--text-primary)]">
                <Activity className="w-4 h-4 text-[var(--accent-teal)]" />
                <span>{tc('TCP cwnd / ssthresh Sawtooth')}</span>
              </div>
              <svg viewBox="0 0 600 120" className="w-full h-28">
                {(() => {
                  const maxY = Math.max(20, ...metrics.cwndSeries.map((d) => Math.max(d.cwnd, d.ssthresh)));
                  const stepX = 560 / Math.max(1, metrics.cwndSeries.length - 1);
                  const toY = (v: number) => 105 - (v / maxY) * 88;
                  const pts = metrics.cwndSeries
                    .map((d, i) => `${20 + i * stepX},${toY(d.cwnd).toFixed(1)}`)
                    .join(' ');
                  const ss = metrics.cwndSeries
                    .map((d, i) => `${20 + i * stepX},${toY(d.ssthresh).toFixed(1)}`)
                    .join(' ');
                  return (
                    <>
                      <polyline fill="none" stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="4 3" points={ss} />
                      <polyline fill="none" stroke="#06b6d4" strokeWidth="2.5" points={pts} />
                    </>
                  );
                })()}
              </svg>
            </div>
          )}
        </div>
      )}

      {tab === 'tables' && (
        <div className="p-4 grid gap-4 md:grid-cols-2 font-mono text-xs">
          {!selectedDevice ? (
            <div className="text-[var(--text-muted)]">{tc('Select a device on the canvas to inspect its forwarding tables.')}</div>
          ) : (
            <>
              <div className="rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-inset)] p-3">
                <div className="mb-2 font-bold text-[var(--accent-primary)]">{selectedDevice.name} · ARP Cache</div>
                {selectedDevice.arpCache.length === 0 ? (
                  <div className="text-[var(--text-muted)]">{tc('(empty — send traffic to populate)')}</div>
                ) : (
                  selectedDevice.arpCache.map((a, idx) => (
                    <div key={idx} className="flex justify-between py-0.5 border-b border-[var(--border-hairline)]/40">
                      <span>{a.ip}</span>
                      <span className="text-[var(--text-muted)]">{a.mac}</span>
                    </div>
                  ))
                )}
              </div>

              <div className="rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-inset)] p-3">
                <div className="mb-2 font-bold text-[var(--accent-primary)]">{selectedDevice.name} · Routing Table</div>
                {selectedDevice.routingTable.length === 0 ? (
                  <div className="text-[var(--text-muted)]">{tc('(using connected subnet / default gateway)')}</div>
                ) : (
                  selectedDevice.routingTable.map((r, idx) => (
                    <div key={idx} className="flex justify-between py-0.5 border-b border-[var(--border-hairline)]/40">
                      <span>
                        {r.network}/{r.mask}
                      </span>
                      <span className="text-[var(--text-muted)]">
                        via {r.nextHop} ({r.protocol.toUpperCase()})
                      </span>
                    </div>
                  ))
                )}
              </div>

              <div className="rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-inset)] p-3">
                <div className="mb-2 font-bold text-[var(--accent-primary)]">{selectedDevice.name} · Switch MAC Table</div>
                {selectedDevice.macTable.length === 0 ? (
                  <div className="text-[var(--text-muted)]">{tc('(empty)')}</div>
                ) : (
                  selectedDevice.macTable.map((m, idx) => (
                    <div key={idx} className="flex justify-between py-0.5 border-b border-[var(--border-hairline)]/40">
                      <span>{m.mac}</span>
                      <span className="text-[var(--text-muted)]">
                        VLAN {m.vlan} · {m.portIfaceId}
                      </span>
                    </div>
                  ))
                )}
              </div>

              <div className="rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-inset)] p-3">
                <div className="mb-2 font-bold text-[var(--accent-primary)]">{selectedDevice.name} · NAT Translations</div>
                {selectedDevice.natTable.length === 0 ? (
                  <div className="text-[var(--text-muted)]">{tc('(no active NAT translations)')}</div>
                ) : (
                  selectedDevice.natTable.map((n) => (
                    <div key={n.id} className="flex justify-between py-0.5 border-b border-[var(--border-hairline)]/40">
                      <span>
                        {n.insideLocalIp}:{n.insideLocalPort}
                      </span>
                      <span className="text-[var(--tone-success)]">
                        → {n.insideGlobalIp}:{n.insideGlobalPort}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
};
