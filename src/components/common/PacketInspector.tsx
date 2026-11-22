import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronRight, Code2, Maximize2, X } from 'lucide-react';
import type { CapturedPacket, FieldByteRange } from '../../engine/types';
import { formatChecksum } from '../../lib/checksum';
import { formatHexDump } from '../../lib/hexDump';
import { tc } from '../../i18n/content';

interface PacketInspectorContentProps {
  packet: CapturedPacket | null;
  defaultShowHex?: boolean;
  embedded?: boolean;
  onPopOut?: () => void;
  onClose?: () => void;
}

type Layer = FieldByteRange['layer'];

/** One colour per protocol layer, used by the stack bar, the field cards and the hex dump so they read as one system. */
const LAYER_COLOR: Record<Layer, string> = {
  frame: 'var(--text-muted)',
  ethernet: 'var(--accent-teal)',
  arp: 'var(--tone-info)',
  ipv4: 'var(--tone-info)',
  ipv6: 'var(--tone-info)',
  icmp: 'var(--tone-success)',
  tcp: 'var(--tone-success)',
  udp: 'var(--tone-success)',
  tls: 'var(--tone-warning)',
  app: 'var(--tone-warning)',
};

const tint = (color: string, pct: number) => `color-mix(in srgb, ${color} ${pct}%, transparent)`;

/** A collapsible layer card with a coloured spine, a name and a one-line summary. */
const LayerCard: React.FC<{
  layer: Layer;
  title: string;
  summary?: React.ReactNode;
  badge?: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}> = ({ layer, title, summary, badge, open, onToggle, children }) => {
  const color = LAYER_COLOR[layer];
  return (
    <section
      className="overflow-hidden rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)]"
      style={{ borderInlineStartColor: color, borderInlineStartWidth: 3 }}
    >
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full items-center gap-2 px-3 py-2 text-start hover:bg-[var(--bg-inset)]">
        {open ? <ChevronDown className="h-4 w-4 shrink-0 text-[var(--text-muted)]" /> : <ChevronRight className="h-4 w-4 shrink-0 text-[var(--text-muted)]" />}
        <span className="shrink-0 text-sm font-bold text-[var(--text-primary)]">{title}</span>
        {summary && <span className="min-w-0 truncate font-mono text-xs text-[var(--text-secondary)]">{summary}</span>}
        {badge && <span className="ms-auto shrink-0 rounded-full bg-[var(--bg-inset)] px-2 py-0.5 font-mono text-[11px] text-[var(--text-muted)]">{badge}</span>}
      </button>
      {open && <div className="border-t border-[var(--border-hairline)] px-2 py-1.5">{children}</div>}
    </section>
  );
};

/** Clickable header fields; hovering one lights up its bytes in the hex dump. */
const Fields: React.FC<{ ranges: FieldByteRange[]; active: FieldByteRange | null; onActive: (r: FieldByteRange) => void }> = ({ ranges, active, onActive }) => (
  <div role="list">
    {ranges.map((r) => {
      const on = active === r;
      return (
        <button
          key={`${r.label}-${r.startByte}`}
          type="button"
          role="listitem"
          onMouseEnter={() => onActive(r)}
          onFocus={() => onActive(r)}
          onClick={() => onActive(r)}
          title={r.description}
          className={`grid w-full grid-cols-[minmax(7rem,11rem)_1fr_auto] items-baseline gap-3 rounded-md px-2 py-1 text-start text-xs transition-colors ${
            on ? 'bg-[var(--accent-primary-soft)]' : 'hover:bg-[var(--bg-inset)]'
          }`}
        >
          <span className={`truncate ${on ? 'font-semibold text-[var(--accent-primary)]' : 'text-[var(--text-secondary)]'}`}>{r.label}</span>
          <span className="min-w-0 truncate font-mono font-semibold text-[var(--text-primary)]">{r.value}</span>
          <span className="font-mono text-[11px] tabular-nums text-[var(--text-muted)]">{r.startByte === r.endByte ? r.startByte : `${r.startByte}–${r.endByte}`}</span>
        </button>
      );
    })}
  </div>
);

const Mono: React.FC<{ children: React.ReactNode }> = ({ children }) => <span className="font-mono">{children}</span>;

export const PacketInspectorContent: React.FC<PacketInspectorContentProps> = ({
  packet,
  defaultShowHex = true,
  embedded = false,
  onPopOut,
  onClose,
}) => {
  const { t } = useTranslation();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [activeRange, setActiveRange] = useState<FieldByteRange | null>(null);
  const [showHex, setShowHex] = useState(defaultShowHex);

  const hexLines = useMemo(() => (packet ? formatHexDump(packet.rawBytes) : []), [packet]);

  // Which layer owns each byte, so the hex dump can be tinted by layer.
  const byteLayer = useMemo(() => {
    const map = new Map<number, Layer>();
    if (!packet) return map;
    for (const r of packet.fieldRanges) {
      for (let i = r.startByte; i <= r.endByte; i++) if (!map.has(i)) map.set(i, r.layer);
    }
    return map;
  }, [packet]);

  if (!packet) {
    return (
      <div className="flex h-full min-h-[140px] items-center justify-center p-6 text-center text-sm text-[var(--text-muted)]">
        {tc('Select any captured frame or click a live packet on the topology canvas to decode its OSI headers and raw hex bytes.')}
      </div>
    );
  }

  const toggle = (key: string) => setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));
  const rangesForLayer = (layer: Layer) => packet.fieldRanges.filter((r) => r.layer === layer);
  const isByteHighlighted = (i: number) => activeRange !== null && i >= activeRange.startByte && i <= activeRange.endByte;
  const tcpFlags = packet.layers.tcp?.flags;

  const l3Layer: Layer = packet.layers.arp ? 'arp' : packet.layers.ipv6 ? 'ipv6' : 'ipv4';
  const l4Layer: Layer | null = packet.layers.tcp ? 'tcp' : packet.layers.udp ? 'udp' : packet.layers.icmp ? 'icmp' : null;

  const stack: { label: string; layer: Layer }[] = [
    { label: `L2 Eth (${packet.sizeBytes}B)`, layer: 'ethernet' },
    { label: packet.layers.arp ? 'ARP' : packet.layers.ipv6 ? 'L3 IPv6' : 'L3 IPv4', layer: l3Layer },
    ...(l4Layer ? [{ label: packet.layers.tcp ? 'L4 TCP' : packet.layers.udp ? 'L4 UDP' : 'ICMP', layer: l4Layer }] : []),
    { label: packet.protocol, layer: 'app' as Layer },
  ];

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Header: what packet is this, and what can I do with it */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-[var(--border-hairline)] bg-[var(--bg-surface)] px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="shrink-0 rounded-md bg-[var(--accent-primary-soft)] px-2 py-1 font-mono text-xs font-bold tabular-nums text-[var(--accent-primary)]">
            #{packet.no}
          </span>
          <div className="min-w-0">
            <h3 className="truncate font-display text-base font-bold leading-tight text-[var(--text-primary)]">
              {packet.protocol} <span className="font-sans text-sm font-medium text-[var(--text-muted)]">· {packet.sizeBytes} bytes</span>
            </h3>
            <p className="truncate font-mono text-xs text-[var(--text-secondary)]">
              {packet.srcIp} → {packet.dstIp} · {(packet.timestampMs / 1000).toFixed(4)}s
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            role="switch"
            aria-checked={showHex}
            onClick={() => setShowHex((s) => !s)}
            className={`flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold transition-colors ${
              showHex
                ? 'border-[var(--accent-primary)] bg-[var(--accent-primary-soft)] text-[var(--accent-primary)]'
                : 'border-[var(--border-strong)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Code2 className="h-3.5 w-3.5" />
            {t('inspector.hex')}
          </button>
          {onPopOut && (
            <button
              type="button"
              onClick={onPopOut}
              title={tc('Open Full Packet Inspector Drawer')}
              aria-label={tc('Open Full Packet Inspector Drawer')}
              className="flex h-8 items-center gap-1.5 rounded-lg border border-[var(--border-strong)] px-2.5 text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            >
              <Maximize2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{tc('Pop Out')}</span>
            </button>
          )}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label={tc('Close Packet Inspector')}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border-strong)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Stack: how the layers wrap each other, outermost first */}
      <div className="flex shrink-0 items-center gap-2 overflow-x-auto border-b border-[var(--border-hairline)] bg-[var(--bg-inset)] px-4 py-1.5">
        <span className="shrink-0 text-[11px] font-bold uppercase tracking-wide text-[var(--text-muted)]">{tc('Stack')}</span>
        <div className="flex items-center gap-1" aria-label={tc('Stack')}>
          {stack.map((s, i) => (
            <React.Fragment key={`${s.label}-${i}`}>
              {i > 0 && <ChevronRight className="h-3 w-3 shrink-0 text-[var(--text-muted)] rtl:rotate-180" aria-hidden="true" />}
              <span
                className="shrink-0 rounded-md px-2 py-0.5 font-mono text-xs font-semibold text-[var(--text-primary)]"
                style={{ backgroundColor: tint(LAYER_COLOR[s.layer], 18), boxShadow: `inset 0 -2px 0 ${LAYER_COLOR[s.layer]}` }}
              >
                {s.label}
              </span>
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Body: fields on one side, bytes on the other */}
      <div
        className={`min-h-0 flex-1 ${
          embedded && showHex ? 'grid grid-cols-1 overflow-hidden lg:grid-cols-[minmax(0,1fr)_minmax(20rem,26rem)]' : embedded ? 'flex overflow-hidden' : 'flex flex-col overflow-y-auto'
        }`}
      >
        <div className={`min-h-0 space-y-2 overflow-y-auto p-3 ${embedded && showHex ? 'lg:border-e lg:border-[var(--border-hairline)]' : 'flex-1'}`}>
          <LayerCard
            open={!collapsed.frame}
            onToggle={() => toggle('frame')}
            layer="frame"
            title={`${t('inspector.frame')} ${packet.no}`}
            summary={`${packet.sizeBytes} ${t('inspector.bytes')} · ${packet.sizeBytes * 8} bits`}
          >
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 px-2 py-1 text-xs">
              <dt className="text-[var(--text-secondary)]">{t('inspector.arrival')}</dt>
              <dd className="font-mono text-[var(--text-primary)]">{(packet.arrivalMs / 1000).toFixed(4)}s</dd>
              <dt className="text-[var(--text-secondary)]">{t('inspector.delta')}</dt>
              <dd className="font-mono text-[var(--text-primary)]">{(packet.arrivalMs - packet.timestampMs).toFixed(2)} ms</dd>
              <dt className="text-[var(--text-secondary)]">{t('inspector.osiLayer')}</dt>
              <dd className="font-mono text-[var(--text-primary)]">{packet.osiLayer}</dd>
              <dt className="text-[var(--text-secondary)]">{t('inspector.status')}</dt>
              <dd className={`font-semibold ${packet.dropped ? 'text-[var(--tone-danger)]' : 'text-[var(--tone-success)]'}`}>
                {packet.dropped ? `${t('inspector.dropped')} (${packet.dropReason})` : t('inspector.delivered')}
              </dd>
            </dl>
          </LayerCard>

          <LayerCard
            open={!collapsed.ethernet}
            onToggle={() => toggle('ethernet')}
            layer="ethernet"
            title="Ethernet II"
            summary={<>{packet.layers.ethernet.srcMac} → {packet.layers.ethernet.dstMac}</>}
          >
            <Fields ranges={rangesForLayer('ethernet')} active={activeRange} onActive={setActiveRange} />
          </LayerCard>

          {(packet.layers.arp || packet.layers.ipv4 || packet.layers.ipv6) && (
            <LayerCard
              open={!collapsed.l3}
              onToggle={() => toggle('l3')}
              layer={l3Layer}
              title={packet.layers.arp ? 'ARP' : packet.layers.ipv6 ? 'IPv6' : 'IPv4'}
              summary={
                packet.layers.arp
                  ? packet.layers.arp.opcode === 1
                    ? 'request'
                    : 'reply'
                  : packet.layers.ipv6
                  ? <>{packet.layers.ipv6.srcIp} → {packet.layers.ipv6.dstIp}</>
                  : <>{packet.layers.ipv4?.srcIp} → {packet.layers.ipv4?.dstIp}</>
              }
              badge={packet.layers.ipv4 ? `chk ${formatChecksum(packet.layers.ipv4.checksum ?? 0)}` : undefined}
            >
              <Fields ranges={rangesForLayer(l3Layer)} active={activeRange} onActive={setActiveRange} />
            </LayerCard>
          )}

          {l4Layer && (
            <LayerCard
              open={!collapsed.l4}
              onToggle={() => toggle('l4')}
              layer={l4Layer}
              title={packet.layers.tcp ? 'TCP' : packet.layers.udp ? 'UDP' : 'ICMP'}
              summary={
                packet.layers.tcp ? (
                  <>
                    {packet.layers.tcp.srcPort} → {packet.layers.tcp.dstPort} · seq {packet.layers.tcp.seq} · ack {packet.layers.tcp.ack}
                  </>
                ) : packet.layers.udp ? (
                  <>
                    {packet.layers.udp.srcPort} → {packet.layers.udp.dstPort} · len {packet.layers.udp.length}
                  </>
                ) : (
                  <>
                    type {packet.layers.icmp?.type} · code {packet.layers.icmp?.code}
                  </>
                )
              }
            >
              <Fields ranges={rangesForLayer(l4Layer)} active={activeRange} onActive={setActiveRange} />
              {tcpFlags && (
                <div className="mx-2 mt-2 mb-1 rounded-lg bg-[var(--bg-inset)] p-2">
                  <div className="mb-1.5 text-[11px] font-semibold text-[var(--text-muted)]">{t('inspector.flags')}</div>
                  <div className="grid grid-cols-6 gap-1.5 font-mono text-[11px]">
                    {(['urg', 'ack', 'psh', 'rst', 'syn', 'fin'] as const).map((flag) => {
                      const lit = tcpFlags[flag];
                      return (
                        <div
                          key={flag}
                          className={`rounded-md border px-1 py-1 text-center font-bold ${
                            lit
                              ? 'border-[var(--accent-primary)] bg-[var(--accent-primary-soft)] text-[var(--accent-primary)]'
                              : 'border-[var(--border-hairline)] text-[var(--text-muted)]'
                          }`}
                        >
                          {flag.toUpperCase()}
                          <span className="block text-[10px] font-medium">{lit ? '1' : '0'}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </LayerCard>
          )}

          {(packet.layers.tls || packet.layers.dns || packet.layers.app) && (
            <LayerCard open={!collapsed.l7} onToggle={() => toggle('l7')} layer="app" title={`${packet.protocol} ${t('inspector.payload')}`}>
              <div className="space-y-1 px-2 py-1 font-mono text-xs">
                {packet.layers.tls && (
                  <div className="space-y-0.5 text-[var(--tone-success)]">
                    <div>Version: {packet.layers.tls.version} · Record: {packet.layers.tls.recordType}</div>
                    {packet.layers.tls.handshakeType && <div>Handshake: {packet.layers.tls.handshakeType}</div>}
                    {packet.layers.tls.cipherSuite && <div>Cipher: {packet.layers.tls.cipherSuite}</div>}
                    {packet.layers.tls.sni && <div>SNI: {packet.layers.tls.sni}</div>}
                  </div>
                )}
                {packet.layers.dns && (
                  <div className="space-y-0.5 text-[var(--tone-info)]">
                    <div>Transaction ID: 0x{packet.layers.dns.transactionId.toString(16)} · Flags: {packet.layers.dns.flags.join(', ')}</div>
                    {packet.layers.dns.questions.map((q, idx) => (
                      <div key={idx}>Query: {q.name} ({q.type})</div>
                    ))}
                    {packet.layers.dns.answers.map((a, idx) => (
                      <div key={idx}>Answer: {a.name} {a.type} → {a.value} (TTL {a.ttl}s)</div>
                    ))}
                  </div>
                )}
                {packet.layers.app?.fields.map((f, idx) => (
                  <div key={idx} className="text-[var(--text-secondary)]">
                    {f.key}: <strong className="text-[var(--text-primary)]">{f.value}</strong>
                  </div>
                ))}
                {packet.layers.app?.rawText && (
                  <pre className="mt-1 overflow-x-auto rounded-lg border border-[var(--terminal-border)] bg-[var(--terminal-bg)] p-2.5 text-xs leading-relaxed text-[var(--terminal-text)]">
                    {packet.layers.app.rawText.split('\r\n').map((line, i) => (
                      <div
                        key={i}
                        className={i === 0 ? 'font-semibold text-[var(--tone-warning)]' : line.includes(':') ? 'text-[var(--terminal-cmd)]' : 'text-[var(--terminal-text)]'}
                      >
                        {line || ' '}
                      </div>
                    ))}
                  </pre>
                )}
              </div>
            </LayerCard>
          )}
        </div>

        {showHex && (
          <div className={`flex min-h-0 flex-col gap-3 bg-[var(--bg-inset)] p-3 ${embedded ? 'overflow-y-auto' : ''}`}>
            {/* What am I pointing at? */}
            <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-3 py-2 text-xs" aria-live="polite">
              {activeRange ? (
                <>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-bold" style={{ color: LAYER_COLOR[activeRange.layer] }}>
                      {tc(activeRange.label)}
                    </span>
                    <span className="font-mono text-[11px] tabular-nums text-[var(--text-muted)]">
                      {t('inspector.bytes')} {activeRange.startByte}–{activeRange.endByte}
                    </span>
                  </div>
                  <div className="mt-0.5 break-all font-mono font-semibold text-[var(--text-primary)]">{activeRange.value}</div>
                  {activeRange.description && <p className="mt-1 text-[var(--text-secondary)]">{tc(activeRange.description)}</p>}
                </>
              ) : (
                <p className="text-[var(--text-muted)]">{t('inspector.hoverHint')}</p>
              )}
            </div>

            <div className="min-h-0">
              <div className="mb-1.5 flex items-center justify-between text-[11px] font-bold uppercase tracking-wide text-[var(--text-muted)]">
                <span>{tc('Wire Hex + ASCII Dump')}</span>
                <Mono>{packet.rawBytes.length} B</Mono>
              </div>
              <div className="overflow-x-auto rounded-xl border border-[var(--terminal-border)] bg-[var(--terminal-bg)] p-3 font-mono text-xs leading-6 text-[var(--terminal-text)]">
                {hexLines.map((line) => (
                  <div key={line.offset} className="flex gap-3 whitespace-pre">
                    <span className="select-none text-[var(--terminal-muted)]">{line.offsetHex}</span>
                    <span className="flex gap-1">
                      {line.bytes.map((b, idx) => {
                        const absIdx = line.offset + idx;
                        const hi = isByteHighlighted(absIdx);
                        const layer = byteLayer.get(absIdx);
                        return (
                          <span
                            key={absIdx}
                            className={`rounded px-0.5 ${hi ? 'bg-[var(--accent-cta)] font-bold text-[var(--on-accent)]' : ''}`}
                            style={!hi && layer ? { backgroundColor: tint(LAYER_COLOR[layer], 22) } : undefined}
                          >
                            {b.toString(16).padStart(2, '0')}
                          </span>
                        );
                      })}
                    </span>
                    <span className="ps-2 text-[var(--terminal-cmd)]">{line.ascii}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

interface PacketInspectorProps {
  packet: CapturedPacket | null;
  onClose: () => void;
  defaultShowHex?: boolean;
}

export const PacketInspector: React.FC<PacketInspectorProps> = ({ packet, onClose, defaultShowHex = true }) => {
  if (!packet) return null;

  return (
    <div
      role="dialog"
      aria-label={`Packet #${packet.no} Inspector`}
      className="fixed inset-y-0 end-0 z-50 flex w-full max-w-2xl flex-col border-s border-[var(--border-strong)] bg-[var(--bg-surface)] shadow-2xl"
    >
      <PacketInspectorContent packet={packet} defaultShowHex={defaultShowHex} onClose={onClose} />
    </div>
  );
};
