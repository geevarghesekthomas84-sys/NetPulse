import React, { useEffect, useState } from 'react';
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Box,
  Check,
  ChevronRight,
  Layers,
  Maximize2,
  Minimize2,
  PackageCheck,
  Play,
  RotateCcw,
  Sparkles,
  X,
} from 'lucide-react';
import type { CapturedPacket } from '../../engine/types';

interface EncapsulationModalProps {
  packet: CapturedPacket | null;
  onClose: () => void;
}

export const EncapsulationModal: React.FC<EncapsulationModalProps> = ({ packet, onClose }) => {
  const [stage, setStage] = useState<number>(3); // 0 = L7 only, 1 = +L4, 2 = +L3, 3 = +L2 (Full Frame)
  const [direction, setDirection] = useState<'encapsulate' | 'decapsulate'>('encapsulate');
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    setStage(3);
  }, [packet?.id]);

  useEffect(() => {
    if (!isAnimating) return;
    const timer = setInterval(() => {
      setStage((prev) => {
        if (direction === 'encapsulate') {
          if (prev >= 3) {
            setIsAnimating(false);
            return 3;
          }
          return prev + 1;
        } else {
          if (prev <= 0) {
            setIsAnimating(false);
            return 0;
          }
          return prev - 1;
        }
      });
    }, 1200);
    return () => clearInterval(timer);
  }, [isAnimating, direction]);

  if (!packet) return null;

  const handleStartAnimation = (dir: 'encapsulate' | 'decapsulate') => {
    setDirection(dir);
    setStage(dir === 'encapsulate' ? 0 : 3);
    setIsAnimating(true);
  };

  const l4Type = packet.layers.tcp ? 'TCP' : packet.layers.udp ? 'UDP' : packet.layers.icmp ? 'ICMP' : 'L4 Transport';
  const l3Type = packet.layers.ipv4 ? 'IPv4' : packet.layers.ipv6 ? 'IPv6' : packet.layers.arp ? 'ARP' : 'L3 Network';

  const payloadText =
    packet.layers.app?.summary ||
    packet.layers.dns?.questions?.[0]?.name ||
    packet.info ||
    'Application Payload Data';

  const l4SrcPort = packet.layers.tcp?.srcPort ?? packet.layers.udp?.srcPort ?? '-';
  const l4DstPort = packet.layers.tcp?.dstPort ?? packet.layers.udp?.dstPort ?? '-';
  const tcpFlagStr = packet.layers.tcp?.flags
    ? Object.entries(packet.layers.tcp.flags)
        .filter(([, v]) => v)
        .map(([k]) => k.toUpperCase())
        .join(', ') || 'NONE'
    : '';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Packet Encapsulation & Decapsulation Explorer"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-5 animate-in fade-in"
    >
      <div className="relative flex flex-col w-full max-w-4xl max-h-[92vh] rounded-2xl border border-[var(--border-strong)] bg-[var(--bg-surface)] shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="shrink-0 flex items-center justify-between border-b border-[var(--border-hairline)] bg-[var(--bg-inset)]/60 px-5 py-3.5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--accent-primary)]/30 bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] shadow-xs">
              <PackageCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-display text-base font-bold text-[var(--text-primary)]">
                  OSI Packet Encapsulation Visualizer
                </h3>
                <span className="rounded-full bg-[var(--accent-primary-soft)] px-2.5 py-0.5 font-mono text-[11px] font-semibold text-[var(--accent-primary)]">
                  Packet #{packet.no} · {packet.protocol}
                </span>
              </div>
              <p className="text-xs text-[var(--text-muted)]">
                Watch how raw data gets wrapped layer-by-layer as it travels down the network stack.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close encapsulation view"
            className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-inset)] hover:text-[var(--text-primary)] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Controls Toolbar */}
        <div className="shrink-0 flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-hairline)] bg-[var(--bg-surface)] px-5 py-2.5">
          {/* Mode Switcher */}
          <div className="flex items-center gap-1.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-inset)] p-1">
            <button
              type="button"
              onClick={() => handleStartAnimation('encapsulate')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                direction === 'encapsulate' && isAnimating
                  ? 'bg-[var(--accent-cta)] text-white shadow-xs'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <ArrowDown className="w-3.5 h-3.5" />
              <span>Animate Encapsulation (Sender)</span>
            </button>
            <button
              type="button"
              onClick={() => handleStartAnimation('decapsulate')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                direction === 'decapsulate' && isAnimating
                  ? 'bg-teal-600 text-white shadow-xs'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <ArrowUp className="w-3.5 h-3.5" />
              <span>Animate Decapsulation (Receiver)</span>
            </button>
          </div>

          {/* Manual Layer Stepper */}
          <div className="flex items-center gap-1">
            <span className="text-xs font-medium text-[var(--text-muted)] me-2">Layers Visible:</span>
            {[
              { idx: 0, label: 'L7 Data' },
              { idx: 1, label: '+ L4 Transport' },
              { idx: 2, label: '+ L3 Network' },
              { idx: 3, label: '+ L2 Frame' },
            ].map((s) => (
              <button
                key={s.idx}
                type="button"
                onClick={() => {
                  setIsAnimating(false);
                  setStage(s.idx);
                }}
                className={`rounded-lg px-2.5 py-1 text-xs font-mono font-semibold transition-all ${
                  stage >= s.idx
                    ? 'border border-[var(--accent-primary)]/40 bg-[var(--accent-primary-soft)] text-[var(--accent-primary)] shadow-xs'
                    : 'border border-[var(--border-hairline)] text-[var(--text-muted)] hover:bg-[var(--bg-inset)]'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Interactive Concentric Wrapping Stage */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-7 space-y-6">
          {/* Explanation Banner */}
          <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-elevated)]/50 p-3.5 flex items-start gap-3 text-xs leading-relaxed text-[var(--text-secondary)]">
            <Sparkles className="w-4 h-4 text-[var(--accent-primary)] shrink-0 mt-0.5" />
            <div>
              {stage === 0 && (
                <span>
                  <strong>Layer 7 (Application Data):</strong> The process starts with user-generated application data
                  (HTTP request/response, DNS query, etc.). At this point, the packet has no network routing or addressing info.
                </span>
              )}
              {stage === 1 && (
                <span>
                  <strong>Layer 4 Encapsulation:</strong> The OS transport layer adds a <strong>{l4Type} Header</strong>.
                  This specifies source and destination <strong>Ports</strong> to deliver data to the correct application process on the host.
                </span>
              )}
              {stage === 2 && (
                <span>
                  <strong>Layer 3 Encapsulation:</strong> The internet layer wraps the segment with an <strong>{l3Type} Header</strong>.
                  This adds source/destination <strong>IP addresses</strong> and a <strong>TTL (Time To Live)</strong> counter for global routing.
                </span>
              )}
              {stage === 3 && (
                <span>
                  <strong>Layer 2 Encapsulation (Complete Frame):</strong> The network interface card (NIC) attaches an{' '}
                  <strong>Ethernet II Header</strong> (source/destination <strong>MAC addresses</strong>) and appends a{' '}
                  <strong>CRC/FCS Trailer</strong> to verify physical wire transmission integrity.
                </span>
              )}
            </div>
          </div>

          {/* Visual Russian Doll Nesting Box */}
          <div className="rounded-2xl border-2 border-dashed border-emerald-500/50 bg-emerald-500/5 p-4 sm:p-6 transition-all space-y-3">
            {/* L2 Outer Header & Label */}
            <div className="flex items-center justify-between font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                LAYER 2: DATA LINK (Ethernet II Frame)
              </span>
              <span className="text-[11px] font-normal text-[var(--text-muted)]">
                {stage >= 3 ? 'Frame Complete · Ready for Wire' : 'Awaiting Frame Wrapping...'}
              </span>
            </div>

            {stage >= 3 ? (
              <div className="flex items-center gap-2 font-mono text-xs p-2.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200 overflow-x-auto">
                <span className="font-bold text-emerald-600 dark:text-emerald-400 shrink-0">Eth Header:</span>
                <span>Dst MAC: {packet.dstMac || 'FF:FF:FF:FF:FF:FF'}</span>
                <span>•</span>
                <span>Src MAC: {packet.srcMac || '00:1A:2B:3C:4D:5E'}</span>
                <span>•</span>
                <span>Type: 0x0800 ({packet.layers.ipv4 ? 'IPv4' : 'IPv6'})</span>
              </div>
            ) : (
              <div className="p-2 border border-dashed border-emerald-500/30 rounded-lg text-center text-xs text-emerald-600/70 font-mono">
                [ Layer 2 Header Not Yet Added ]
              </div>
            )}

            {/* L3 Nested Network Box */}
            <div className={`rounded-xl border-2 transition-all p-3.5 space-y-2.5 ${
              stage >= 2
                ? 'border-sky-500/50 bg-sky-500/5'
                : 'border-slate-300 dark:border-slate-800 bg-slate-100/50 dark:bg-slate-900/30 opacity-60'
            }`}>
              <div className="flex items-center justify-between font-mono text-xs font-bold text-sky-600 dark:text-sky-400">
                <span>LAYER 3: NETWORK ({l3Type} Datagram)</span>
                {stage >= 2 && <span className="text-[11px] font-normal">TTL: {packet.layers.ipv4?.ttl ?? 64} · Protocol: {l4Type}</span>}
              </div>

              {stage >= 2 ? (
                <div className="flex items-center gap-2 font-mono text-xs p-2 rounded-lg border border-sky-500/30 bg-sky-500/10 text-sky-800 dark:text-sky-200 overflow-x-auto">
                  <span className="font-bold text-sky-600 dark:text-sky-400 shrink-0">IP Header:</span>
                  <span>Src: {packet.srcIp || '192.168.1.10'}</span>
                  <span>➔</span>
                  <span>Dst: {packet.dstIp || '93.184.216.34'}</span>
                  <span>•</span>
                  <span>Len: {packet.sizeBytes}B</span>
                </div>
              ) : (
                <div className="p-2 border border-dashed border-slate-300 dark:border-slate-700 rounded-lg text-center text-xs font-mono text-[var(--text-muted)]">
                  [ Layer 3 IP Header Not Yet Added ]
                </div>
              )}

              {/* L4 Nested Transport Box */}
              <div className={`rounded-lg border-2 transition-all p-3 space-y-2 ${
                stage >= 1
                  ? 'border-indigo-500/50 bg-indigo-500/5'
                  : 'border-slate-300 dark:border-slate-800 bg-slate-100/50 dark:bg-slate-900/30 opacity-50'
              }`}>
                <div className="flex items-center justify-between font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400">
                  <span>LAYER 4: TRANSPORT ({l4Type} Segment)</span>
                  {stage >= 1 && <span className="text-[11px] font-normal">Ports: {l4SrcPort} ➔ {l4DstPort}</span>}
                </div>

                {stage >= 1 ? (
                  <div className="flex items-center gap-2 font-mono text-xs p-2 rounded-md border border-indigo-500/30 bg-indigo-500/10 text-indigo-800 dark:text-indigo-200 overflow-x-auto">
                    <span className="font-bold text-indigo-600 dark:text-indigo-400 shrink-0">{l4Type} Header:</span>
                    <span>Src Port: {l4SrcPort}</span>
                    <span>•</span>
                    <span>Dst Port: {l4DstPort}</span>
                    {packet.layers.tcp && (
                      <>
                        <span>•</span>
                        <span>Flags: [{tcpFlagStr}]</span>
                        <span>•</span>
                        <span>Seq: {packet.layers.tcp.seq}</span>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="p-1.5 border border-dashed border-slate-300 dark:border-slate-700 rounded text-center text-xs font-mono text-[var(--text-muted)]">
                    [ Layer 4 Transport Header Not Yet Added ]
                  </div>
                )}

                {/* L7 Innermost Application Payload */}
                <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 space-y-1.5 shadow-xs">
                  <div className="flex items-center justify-between font-mono text-xs font-bold text-amber-700 dark:text-amber-300">
                    <span>LAYER 7: APPLICATION PAYLOAD ({packet.protocol})</span>
                    <span className="text-[10px] font-normal">{payloadText.length} Bytes</span>
                  </div>
                  <pre className="font-mono text-xs p-2 rounded bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border-hairline)] overflow-x-auto whitespace-pre-wrap break-all">
                    {payloadText}
                  </pre>
                </div>
              </div>
            </div>

            {/* L2 Trailer (CRC / FCS) */}
            {stage >= 3 && (
              <div className="flex items-center justify-end gap-2 font-mono text-[11px] text-emerald-700 dark:text-emerald-300 pt-1">
                <span>Ethernet FCS Trailer (CRC-32 checksum):</span>
                <span className="bg-emerald-500/15 px-2 py-0.5 rounded font-bold">0x8A4B29E1</span>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="shrink-0 flex items-center justify-between border-t border-[var(--border-hairline)] bg-[var(--bg-inset)]/50 px-5 py-3">
          <div className="text-xs text-[var(--text-muted)]">
            Step {stage + 1} of 4: {stage === 0 ? 'Application Payload' : stage === 1 ? 'Transport Segment' : stage === 2 ? 'Network Packet' : 'Physical Ethernet Frame'}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={stage <= 0}
              onClick={() => {
                setIsAnimating(false);
                setStage((s) => Math.max(0, s - 1));
              }}
              className="rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-40"
            >
              Previous Layer
            </button>
            <button
              type="button"
              disabled={stage >= 3}
              onClick={() => {
                setIsAnimating(false);
                setStage((s) => Math.min(3, s + 1));
              }}
              className="rounded-lg bg-[var(--accent-cta)] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[var(--accent-cta-hover)] disabled:opacity-40 transition-colors"
            >
              Next Layer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
