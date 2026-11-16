import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Code2, Layers, Maximize2, X } from 'lucide-react';
import type { CapturedPacket, FieldByteRange } from '../../engine/types';
import { formatChecksum } from '../../lib/checksum';
import { formatHexDump } from '../../lib/hexDump';

interface PacketInspectorContentProps {
  packet: CapturedPacket | null;
  defaultShowHex?: boolean;
  embedded?: boolean;
  onPopOut?: () => void;
  onClose?: () => void;
}

export const PacketInspectorContent: React.FC<PacketInspectorContentProps> = ({
  packet,
  defaultShowHex = true,
  embedded = false,
  onPopOut,
  onClose,
}) => {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    frame: true,
    ethernet: true,
    l3: true,
    l4: true,
    l7: true,
  });
  const [activeRange, setActiveRange] = useState<FieldByteRange | null>(null);
  const [showHex, setShowHex] = useState(defaultShowHex);

  const hexLines = useMemo(() => (packet ? formatHexDump(packet.rawBytes) : []), [packet]);

  if (!packet) {
    return (
      <div className="flex h-full min-h-[160px] flex-col items-center justify-center gap-2 p-6 text-center">
        <Layers className="w-6 h-6 text-[var(--accent-primary)] opacity-70" />
        <p className="font-display text-sm font-semibold text-[var(--text-primary)]">
          No Frame Selected
        </p>
        <p className="max-w-md text-[13px] text-[var(--text-secondary)]">
          Select any captured frame in the table or click a moving packet on the topology canvas to decode its OSI headers and raw hex bytes.
        </p>
      </div>
    );
  }

  const toggle = (key: string) => setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));

  const rangesForLayer = (layer: FieldByteRange['layer']) =>
    packet.fieldRanges.filter((r) => r.layer === layer);

  const isByteHighlighted = (byteIndex: number) =>
    activeRange !== null && byteIndex >= activeRange.startByte && byteIndex <= activeRange.endByte;

  const tcpFlags = packet.layers.tcp?.flags;

  const focusLayer = (key: keyof typeof expanded) => {
    setExpanded((prev) => ({ ...prev, [key]: true }));
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--bg-canvas)]/40">
      {/* Unified Header + Stepped Encapsulation Bar */}
      <div className="shrink-0 flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-hairline)] bg-[var(--bg-surface)] px-4 py-2.5">
        <div className="min-w-0 flex flex-wrap items-center gap-3">
          {/* Frame Index + Protocol Headline */}
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="inline-flex h-7 items-center rounded-lg bg-[var(--accent-primary)] px-2.5 font-mono text-xs font-bold text-white tabular-nums shrink-0 shadow-xs">
              #{packet.no}
            </span>
            <h3 className="font-display text-[15px] font-bold text-[var(--text-primary)] whitespace-nowrap">
              {packet.protocol}
            </h3>
            <span className="font-mono text-xs font-semibold text-[var(--text-secondary)] tabular-nums">
              {packet.sizeBytes} bytes
            </span>
          </div>

          <span className="hidden md:inline-block h-4 w-px bg-[var(--border-hairline)]" aria-hidden="true" />

          {/* Flow Tuple */}
          <div className="hidden sm:flex items-center gap-2 font-mono text-[13px] font-medium text-[var(--text-secondary)] tabular-nums truncate">
            <span className="text-[var(--text-primary)]">{packet.srcIp}</span>
            <span className="text-[var(--accent-primary)] font-bold">→</span>
            <span className="text-[var(--text-primary)]">{packet.dstIp}</span>
            <span className="text-[var(--text-muted)]">·</span>
            <span className="text-xs text-[var(--text-muted)]">{(packet.timestampMs / 1000).toFixed(4)}s</span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setShowHex((s) => !s)}
            className={`flex h-8 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold transition-colors ${
              showHex
                ? 'border-[var(--accent-primary)]/40 bg-[var(--accent-primary-soft)] text-[var(--accent-primary)]'
                : 'border-[var(--border-hairline)] bg-[var(--bg-inset)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>{showHex ? 'Hide Hex' : 'Show Hex'}</span>
          </button>
          {onPopOut && (
            <button
              type="button"
              onClick={onPopOut}
              title="Open Full Packet Inspector Drawer"
              aria-label="Open Full Packet Inspector Drawer"
              className="flex h-8 items-center gap-1.5 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 text-xs font-semibold text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)] transition-colors"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Pop Out</span>
            </button>
          )}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close Packet Inspector"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Stepped Encapsulation Breadcrumb Strip */}
      <div className="shrink-0 flex flex-wrap items-center gap-2 border-b border-[var(--border-hairline)] bg-[var(--bg-inset)]/75 px-4 py-2 text-xs">
        <span className="inline-flex items-center gap-1.5 font-display text-xs font-bold text-[var(--text-secondary)] me-1">
          <Layers className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
          <span>Stack</span>
        </span>

        <nav aria-label="Protocol encapsulation stack" className="flex flex-wrap items-center gap-1.5 font-mono text-xs tabular-nums">
          <button
            type="button"
            onClick={() => focusLayer('ethernet')}
            className="inline-flex items-center gap-1.5 rounded-md border border-[var(--accent-teal)]/40 bg-[var(--bg-surface)] px-2.5 py-1 font-semibold text-[var(--accent-teal)] hover:border-[var(--accent-teal)] transition-colors"
          >
            <span className="h-2.5 w-1 rounded-xs bg-[var(--accent-teal)]" aria-hidden="true" />
            <span>L2 Eth ({packet.sizeBytes}B)</span>
          </button>

          <ChevronRight className="w-3.5 h-3.5 text-[var(--text-muted)]" aria-hidden="true" />

          <button
            type="button"
            onClick={() => focusLayer('l3')}
            className="inline-flex items-center gap-1.5 rounded-md border border-[var(--tone-info)]/40 bg-[var(--bg-surface)] px-2.5 py-1 font-semibold text-[var(--tone-info)] hover:border-[var(--tone-info)] transition-colors"
          >
            <span className="h-2.5 w-1 rounded-xs bg-[var(--tone-info)]" aria-hidden="true" />
            <span>{packet.layers.arp ? 'ARP' : packet.layers.ipv6 ? 'L3 IPv6' : 'L3 IPv4'}</span>
          </button>

          {(packet.layers.tcp || packet.layers.udp || packet.layers.icmp) && (
            <>
              <ChevronRight className="w-3.5 h-3.5 text-[var(--text-muted)]" aria-hidden="true" />
              <button
                type="button"
                onClick={() => focusLayer('l4')}
                className="inline-flex items-center gap-1.5 rounded-md border border-[var(--tone-success)]/40 bg-[var(--bg-surface)] px-2.5 py-1 font-semibold text-[var(--tone-success)] hover:border-[var(--tone-success)] transition-colors"
              >
                <span className="h-2.5 w-1 rounded-xs bg-[var(--tone-success)]" aria-hidden="true" />
                <span>{packet.layers.tcp ? 'L4 TCP' : packet.layers.udp ? 'L4 UDP' : 'ICMP'}</span>
              </button>
            </>
          )}

          <ChevronRight className="w-3.5 h-3.5 text-[var(--text-muted)]" aria-hidden="true" />

          <button
            type="button"
            onClick={() => focusLayer('l7')}
            className="inline-flex items-center gap-1.5 rounded-md border border-[var(--tone-warning)]/40 bg-[var(--bg-surface)] px-2.5 py-1 font-semibold text-[var(--tone-warning)] hover:border-[var(--tone-warning)] transition-colors"
          >
            <span className="h-2.5 w-1 rounded-xs bg-[var(--tone-warning)]" aria-hidden="true" />
            <span>{packet.protocol}</span>
          </button>
        </nav>

        {activeRange && (
          <div className="ms-auto flex items-center gap-2 rounded-md border border-[var(--accent-primary)]/35 bg-[var(--bg-surface)] px-2.5 py-1 font-mono text-xs text-[var(--accent-primary)] truncate max-w-full">
            <span className="font-bold">{activeRange.label}:</span>
            <span className="font-semibold text-[var(--text-primary)]">{activeRange.value}</span>
            <span className="hidden lg:inline text-[var(--text-secondary)] truncate">— {activeRange.description}</span>
          </div>
        )}
      </div>

      {/* Split Content */}
      <div
        className={`flex-1 min-h-0 ${
          embedded ? 'grid grid-cols-1 lg:grid-cols-12 overflow-hidden' : 'flex flex-col overflow-y-auto divide-y divide-[var(--border-hairline)]'
        }`}
      >
        {/* Layered Wireshark Tree */}
        <div
          className={`space-y-2 p-3.5 text-[13px] overflow-y-auto ${
            embedded
              ? showHex
                ? 'lg:col-span-7 border-b lg:border-b-0 lg:border-e border-[var(--border-hairline)]'
                : 'lg:col-span-12'
              : ''
          }`}
        >
          {/* Frame Layer */}
          <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] overflow-hidden shadow-2xs">
            <button
              type="button"
              onClick={() => toggle('frame')}
              className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-start font-display text-[13.5px] font-bold text-[var(--text-primary)] hover:bg-[var(--bg-inset)]/50 transition-colors"
            >
              {expanded.frame ? <ChevronDown className="w-4 h-4 text-[var(--text-secondary)] shrink-0" /> : <ChevronRight className="w-4 h-4 text-[var(--text-secondary)] shrink-0" />}
              <span className="h-3.5 w-1 rounded-xs bg-[var(--text-muted)] shrink-0" aria-hidden="true" />
              <span>Frame {packet.no}: {packet.sizeBytes} bytes on wire ({packet.sizeBytes * 8} bits)</span>
            </button>
            {expanded.frame && (
              <div className="border-t border-[var(--border-hairline)] bg-[var(--bg-canvas)]/55 px-4 py-2.5 grid gap-1.5 sm:grid-cols-2 font-mono text-xs text-[var(--text-secondary)] tabular-nums">
                <div>
                  <span className="text-[var(--text-muted)]">Arrival:</span>{' '}
                  <strong className="text-[var(--text-primary)]">{(packet.arrivalMs / 1000).toFixed(4)}s</strong>
                  <span className="text-[var(--text-muted)]"> · Delta:</span>{' '}
                  <strong className="text-[var(--text-primary)]">{(packet.arrivalMs - packet.timestampMs).toFixed(2)} ms</strong>
                </div>
                <div>
                  <span className="text-[var(--text-muted)]">OSI Layer:</span>{' '}
                  <strong className="text-[var(--text-primary)]">{packet.osiLayer}</strong>
                  <span className="text-[var(--text-muted)]"> · Status:</span>{' '}
                  <strong className={packet.dropped ? 'text-[var(--tone-danger)]' : 'text-[var(--tone-success)]'}>
                    {packet.dropped ? `DROPPED (${packet.dropReason})` : 'Delivered'}
                  </strong>
                </div>
              </div>
            )}
          </div>

          {/* Ethernet II Layer */}
          <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] overflow-hidden shadow-2xs">
            <button
              type="button"
              onClick={() => toggle('ethernet')}
              className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-start font-display text-[13.5px] font-bold text-[var(--text-primary)] hover:bg-[var(--bg-inset)]/50 transition-colors"
            >
              {expanded.ethernet ? <ChevronDown className="w-4 h-4 text-[var(--accent-teal)] shrink-0" /> : <ChevronRight className="w-4 h-4 text-[var(--accent-teal)] shrink-0" />}
              <span className="h-3.5 w-1 rounded-xs bg-[var(--accent-teal)] shrink-0" aria-hidden="true" />
              <span className="truncate">
                Ethernet II, Src: <span className="font-mono text-[13px] font-semibold">{packet.layers.ethernet.srcMac}</span>, Dst: <span className="font-mono text-[13px] font-semibold">{packet.layers.ethernet.dstMac}</span>
              </span>
            </button>
            {expanded.ethernet && (
              <div className="border-t border-[var(--border-hairline)] bg-[var(--bg-canvas)]/55 px-3 py-2 space-y-1">
                {rangesForLayer('ethernet').map((r) => (
                  <button
                    key={`${r.label}-${r.startByte}`}
                    type="button"
                    onMouseEnter={() => setActiveRange(r)}
                    onClick={() => setActiveRange(r)}
                    title={r.description}
                    className={`flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-start font-mono text-xs transition-colors ${
                      activeRange === r
                        ? 'bg-[var(--accent-primary-soft)] text-[var(--accent-primary)] font-semibold'
                        : 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface)]'
                    }`}
                  >
                    <span>
                      {r.label}: <strong className="text-[var(--text-primary)]">{r.value}</strong>
                    </span>
                    <span className="text-[11px] text-[var(--text-muted)] tabular-nums shrink-0">
                      bytes {r.startByte}..{r.endByte}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* L3: ARP / IPv4 / IPv6 */}
          {(packet.layers.arp || packet.layers.ipv4 || packet.layers.ipv6) && (
            <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] overflow-hidden shadow-2xs">
              <button
                type="button"
                onClick={() => toggle('l3')}
                className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-start font-display text-[13.5px] font-bold text-[var(--text-primary)] hover:bg-[var(--bg-inset)]/50 transition-colors"
              >
                {expanded.l3 ? <ChevronDown className="w-4 h-4 text-[var(--tone-info)] shrink-0" /> : <ChevronRight className="w-4 h-4 text-[var(--tone-info)] shrink-0" />}
                <span className="h-3.5 w-1 rounded-xs bg-[var(--tone-info)] shrink-0" aria-hidden="true" />
                <span className="truncate">
                  {packet.layers.arp
                    ? `Address Resolution Protocol (${packet.layers.arp.opcode === 1 ? 'request' : 'reply'})`
                    : packet.layers.ipv6
                    ? `IPv6, Src: ${packet.layers.ipv6.srcIp}, Dst: ${packet.layers.ipv6.dstIp}`
                    : `IPv4, Src: ${packet.layers.ipv4?.srcIp}, Dst: ${packet.layers.ipv4?.dstIp} · Checksum: ${formatChecksum(packet.layers.ipv4?.checksum ?? 0)}`}
                </span>
              </button>
              {expanded.l3 && (
                <div className="border-t border-[var(--border-hairline)] bg-[var(--bg-canvas)]/55 px-3 py-2 space-y-1">
                  {rangesForLayer(packet.layers.arp ? 'arp' : packet.layers.ipv6 ? 'ipv6' : 'ipv4').map((r) => (
                    <button
                      key={`${r.label}-${r.startByte}`}
                      type="button"
                      onMouseEnter={() => setActiveRange(r)}
                      onClick={() => setActiveRange(r)}
                      title={r.description}
                      className={`flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-start font-mono text-xs transition-colors ${
                        activeRange === r
                          ? 'bg-[var(--accent-primary-soft)] text-[var(--accent-primary)] font-semibold'
                          : 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface)]'
                      }`}
                    >
                      <span>
                        {r.label}: <strong className="text-[var(--text-primary)]">{r.value}</strong>
                      </span>
                      <span className="text-[11px] text-[var(--text-muted)] tabular-nums shrink-0">
                        bytes {r.startByte}..{r.endByte}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* L4: TCP / UDP / ICMP */}
          {(packet.layers.tcp || packet.layers.udp || packet.layers.icmp) && (
            <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] overflow-hidden shadow-2xs">
              <button
                type="button"
                onClick={() => toggle('l4')}
                className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-start font-display text-[13.5px] font-bold text-[var(--text-primary)] hover:bg-[var(--bg-inset)]/50 transition-colors"
              >
                {expanded.l4 ? <ChevronDown className="w-4 h-4 text-[var(--tone-success)] shrink-0" /> : <ChevronRight className="w-4 h-4 text-[var(--tone-success)] shrink-0" />}
                <span className="h-3.5 w-1 rounded-xs bg-[var(--tone-success)] shrink-0" aria-hidden="true" />
                <span className="truncate">
                  {packet.layers.tcp
                    ? `TCP, Src Port: ${packet.layers.tcp.srcPort}, Dst Port: ${packet.layers.tcp.dstPort}, Seq: ${packet.layers.tcp.seq}, Ack: ${packet.layers.tcp.ack}`
                    : packet.layers.udp
                    ? `UDP, Src Port: ${packet.layers.udp.srcPort}, Dst Port: ${packet.layers.udp.dstPort}, Len: ${packet.layers.udp.length}`
                    : `ICMP, Type: ${packet.layers.icmp?.type}, Code: ${packet.layers.icmp?.code}`}
                </span>
              </button>
              {expanded.l4 && (
                <div className="border-t border-[var(--border-hairline)] bg-[var(--bg-canvas)]/55 px-3 py-2 space-y-1">
                  {rangesForLayer(packet.layers.tcp ? 'tcp' : packet.layers.udp ? 'udp' : 'icmp').map((r) => (
                    <button
                      key={`${r.label}-${r.startByte}`}
                      type="button"
                      onMouseEnter={() => setActiveRange(r)}
                      onClick={() => setActiveRange(r)}
                      title={r.description}
                      className={`flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-start font-mono text-xs transition-colors ${
                        activeRange === r
                          ? 'bg-[var(--accent-primary-soft)] text-[var(--accent-primary)] font-semibold'
                          : 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface)]'
                      }`}
                    >
                      <span>
                        {r.label}: <strong className="text-[var(--text-primary)]">{r.value}</strong>
                      </span>
                      <span className="text-[11px] text-[var(--text-muted)] tabular-nums shrink-0">
                        bytes {r.startByte}..{r.endByte}
                      </span>
                    </button>
                  ))}

                  {tcpFlags && (
                    <div className="mt-2 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-2.5">
                      <div className="mb-1.5 font-sans text-xs font-semibold text-[var(--text-secondary)]">
                        TCP Control Flags (6 active bits)
                      </div>
                      <div className="grid grid-cols-6 gap-1.5 font-mono text-xs tabular-nums">
                        {(['urg', 'ack', 'psh', 'rst', 'syn', 'fin'] as const).map((flag) => {
                          const lit = tcpFlags[flag];
                          return (
                            <div
                              key={flag}
                              className={`rounded-md border px-1.5 py-1 text-center font-bold ${
                                lit
                                  ? 'border-[var(--accent-primary)] bg-[var(--accent-primary-soft)] text-[var(--accent-primary)]'
                                  : 'border-[var(--border-hairline)] bg-[var(--bg-inset)]/50 text-[var(--text-muted)]'
                              }`}
                            >
                              {flag.toUpperCase()}={lit ? '1' : '0'}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* L6/L7: TLS / DNS / HTTP / App */}
          {(packet.layers.tls || packet.layers.dns || packet.layers.app) && (
            <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] overflow-hidden shadow-2xs">
              <button
                type="button"
                onClick={() => toggle('l7')}
                className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-start font-display text-[13.5px] font-bold text-[var(--text-primary)] hover:bg-[var(--bg-inset)]/50 transition-colors"
              >
                {expanded.l7 ? <ChevronDown className="w-4 h-4 text-[var(--tone-warning)] shrink-0" /> : <ChevronRight className="w-4 h-4 text-[var(--tone-warning)] shrink-0" />}
                <span className="h-3.5 w-1 rounded-xs bg-[var(--tone-warning)] shrink-0" aria-hidden="true" />
                <span>{packet.protocol} Payload</span>
              </button>
              {expanded.l7 && (
                <div className="border-t border-[var(--border-hairline)] bg-[var(--bg-canvas)]/55 px-4 py-2.5 space-y-1.5 font-mono text-xs">
                  {packet.layers.tls && (
                    <div className="space-y-1 text-[var(--tone-success)]">
                      <div>Version: {packet.layers.tls.version} · Record: {packet.layers.tls.recordType}</div>
                      {packet.layers.tls.handshakeType && <div>Handshake: {packet.layers.tls.handshakeType}</div>}
                      {packet.layers.tls.cipherSuite && <div>Cipher: {packet.layers.tls.cipherSuite}</div>}
                      {packet.layers.tls.sni && <div>SNI: {packet.layers.tls.sni}</div>}
                    </div>
                  )}
                  {packet.layers.dns && (
                    <div className="space-y-1 text-[var(--tone-info)]">
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
                    <pre className="mt-2 overflow-x-auto rounded-lg border border-[var(--terminal-border)] bg-[var(--terminal-bg)] p-3 text-xs leading-relaxed text-[var(--terminal-text)]">
                      {packet.layers.app.rawText.split('\r\n').map((line, i) => (
                        <div
                          key={i}
                          className={
                            i === 0
                              ? 'text-[var(--tone-warning)] font-semibold'
                              : line.includes(':')
                              ? 'text-[var(--terminal-cmd)]'
                              : 'text-[var(--terminal-text)]'
                          }
                        >
                          {line || ' '}
                        </div>
                      ))}
                    </pre>
                  )}
                </div>
              )}
            </div>
          )}

          {!embedded && activeRange && (
            <div className="rounded-xl border border-[var(--accent-primary)]/40 bg-[var(--accent-primary-soft)] p-3 text-[13px]">
              <div className="font-display font-bold text-[var(--accent-primary)]">
                {activeRange.label}: {activeRange.value}
              </div>
              <div className="mt-1 text-[var(--text-secondary)]">{activeRange.description}</div>
            </div>
          )}
        </div>

        {/* Hex + ASCII Dump */}
        {showHex && (
          <div className={`bg-[var(--bg-inset)]/60 p-3.5 overflow-y-auto flex flex-col ${embedded ? 'lg:col-span-5' : ''}`}>
            <div className="mb-2 flex items-center justify-between">
              <span className="font-display text-[13px] font-bold text-[var(--text-primary)]">
                Wire Hex + ASCII Dump
              </span>
              <span className="rounded-md border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-2 py-0.5 font-mono text-xs font-semibold text-[var(--text-secondary)] tabular-nums">
                {packet.rawBytes.length} B
              </span>
            </div>
            <div className="flex-1 overflow-x-auto rounded-xl border border-[var(--terminal-border)] bg-[var(--terminal-bg)] p-3 font-mono text-[12.5px] leading-6 text-[var(--terminal-text)] shadow-2xs tabular-nums">
              {hexLines.map((line) => (
                <div key={line.offset} className="flex gap-3 whitespace-pre">
                  <span className="text-[var(--terminal-muted)] select-none font-semibold">{line.offsetHex}</span>
                  <span className="flex gap-1">
                    {line.bytes.map((b, idx) => {
                      const absIdx = line.offset + idx;
                      const hi = isByteHighlighted(absIdx);
                      return (
                        <span
                          key={absIdx}
                          className={`px-0.5 rounded transition-colors ${
                            hi ? 'bg-[var(--accent-cta)] text-white font-bold' : ''
                          }`}
                        >
                          {b.toString(16).padStart(2, '0')}
                        </span>
                      );
                    })}
                  </span>
                  <span className="text-[var(--terminal-cmd)] ms-auto ps-2 font-medium">{line.ascii}</span>
                </div>
              ))}
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

export const PacketInspector: React.FC<PacketInspectorProps> = ({
  packet,
  onClose,
  defaultShowHex = true,
}) => {
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
