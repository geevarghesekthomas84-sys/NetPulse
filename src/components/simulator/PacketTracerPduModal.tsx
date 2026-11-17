import React from 'react';
import {
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Layers,
  Network,
  Shield,
  X,
} from 'lucide-react';
import type { CapturedPacket, SimDevice } from '../../engine/types';

interface PacketTracerPduModalProps {
  packet: CapturedPacket;
  device?: SimDevice | null;
  onClose: () => void;
}

export const PacketTracerPduModal: React.FC<PacketTracerPduModalProps> = ({
  packet,
  device,
  onClose,
}) => {
  const [selectedLayer, setSelectedLayer] = React.useState<number>(
    packet.osiLayer || (packet.layers.tcp || packet.layers.udp ? 4 : packet.layers.ipv4 ? 3 : 2)
  );

  const l4 = packet.layers.tcp ? 'TCP' : packet.layers.udp ? 'UDP' : packet.layers.icmp ? 'ICMP' : 'Transport';
  const l3 = packet.layers.ipv4 ? 'IPv4' : packet.layers.ipv6 ? 'IPv6' : packet.layers.arp ? 'ARP' : 'Network';
  const l2 = 'Ethernet II';

  const inIface = device?.interfaces[0]?.name || 'FastEthernet0/0';
  const outIface = device?.interfaces[1]?.name || device?.interfaces[0]?.name || 'FastEthernet0/1';

  const explanations: Record<number, { inText: string; outText: string }> = {
    1: {
      inText: `1. Physical interface ${inIface} detects incoming electrical carrier signal.\n2. Serial bit stream decoded into valid Layer 2 frame bytes.\n3. Frame check sequence (CRC32) verified without corruption.`,
      outText: `1. Interface ${outIface} encodes bytes onto physical medium.\n2. Preamble and Start-of-Frame delimiter attached.\n3. Frame transmitted with nominal serialization delay.`,
    },
    2: {
      inText: `1. Frame arrives with Destination MAC: ${packet.dstMac}.\n2. Device verifies destination MAC matches local interface or broadcast.\n3. Ethernet header decapsulated to expose Layer 3 payload (EtherType: ${packet.layers.ethernet?.etherType || '0x0800'}).`,
      outText: `1. Next-hop MAC address looked up in local ARP cache table.\n2. Ethernet II header attached with Src MAC: ${packet.srcMac} and Dst MAC: ${packet.dstMac}.\n3. Frame queued for transmission on ${outIface}.`,
    },
    3: {
      inText: `1. The packet destination IP is ${packet.dstIp}.\n2. Device checks local IP addresses. Packet is addressed to a remote network.\n3. Device looks up destination IP in routing table (LPM lookup).\n4. TTL decremented by 1 (TTL: ${packet.layers.ipv4?.ttl ?? 64} ➔ ${(packet.layers.ipv4?.ttl ?? 64) - 1}). Checksum updated.`,
      outText: `1. Routing table lookup selects outgoing interface ${outIface}.\n2. Next-hop resolved.\n3. IP datagram forwarded to egress queue without fragmentation.`,
    },
    4: {
      inText: `1. ${l4} segment extracted from IP payload.\n2. Source Port: ${packet.layers.tcp?.srcPort ?? packet.layers.udp?.srcPort ?? '-'}, Destination Port: ${packet.layers.tcp?.dstPort ?? packet.layers.udp?.dstPort ?? '-'}.\n3. Transport integrity checksum validated.`,
      outText: `1. Transport segment encapsulated with negotiated MSS and window scaling.\n2. Sequence number and acknowledgment tracking synchronized.`,
    },
    7: {
      inText: `1. Application layer payload decapsulated (${packet.protocol}).\n2. Request parsed: ${packet.info}.`,
      outText: `1. Application response payload assembled (${packet.sizeBytes} bytes).\n2. PDU passed down to Layer 4 for reliable transmission.`,
    },
  };

  const curr = explanations[selectedLayer] || explanations[3];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Cisco Packet Tracer PDU Details Inspector"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-sm p-4 animate-in fade-in"
    >
      <div className="flex h-[82vh] w-full max-w-3xl flex-col rounded-2xl border border-[var(--border-strong)] bg-[var(--bg-surface)] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between border-b border-[var(--border-hairline)] bg-[var(--bg-inset)] px-4 py-2.5">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--accent-primary-soft)] text-[var(--accent-primary)] font-bold font-mono text-xs">
              PDU
            </div>
            <div>
              <h3 className="font-display font-bold text-sm text-[var(--text-primary)]">
                PDU Information At Device: {device?.name || packet.fromDeviceId}
              </h3>
              <p className="text-[11px] text-[var(--text-muted)] font-mono">
                Packet #{packet.no} · Protocol: {packet.protocol} · Size: {packet.sizeBytes} Bytes
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border-hairline)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Layer Selector Bar */}
        <div className="shrink-0 flex items-center border-b border-[var(--border-hairline)] bg-[var(--bg-surface)] px-4 py-2 gap-2">
          <span className="text-xs font-bold text-[var(--text-secondary)]">OSI Layer:</span>
          {[
            { layer: 7, label: 'Layer 7 (Application)' },
            { layer: 4, label: `Layer 4 (${l4})` },
            { layer: 3, label: `Layer 3 (${l3})` },
            { layer: 2, label: `Layer 2 (${l2})` },
            { layer: 1, label: 'Layer 1 (Physical)' },
          ].map((item) => (
            <button
              key={item.layer}
              type="button"
              onClick={() => setSelectedLayer(item.layer)}
              className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-all ${
                selectedLayer === item.layer
                  ? 'bg-[var(--accent-primary)] text-white shadow-xs'
                  : 'bg-[var(--bg-inset)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* In Layers vs Out Layers Split View */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* In Layers Box */}
            <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-[var(--border-hairline)] pb-2">
                <span className="font-bold text-xs text-blue-600 dark:text-blue-400">
                  IN LAYERS (Inbound Processing)
                </span>
                <span className="font-mono text-[10px] text-[var(--text-muted)]">Port: {inIface}</span>
              </div>
              <pre className="font-mono text-xs whitespace-pre-wrap leading-relaxed text-[var(--text-primary)] bg-[var(--bg-inset)]/60 p-3 rounded-lg border border-[var(--border-hairline)]">
                {curr.inText}
              </pre>
            </div>

            {/* Out Layers Box */}
            <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-[var(--border-hairline)] pb-2">
                <span className="font-bold text-xs text-emerald-600 dark:text-emerald-400">
                  OUT LAYERS (Outbound Forwarding)
                </span>
                <span className="font-mono text-[10px] text-[var(--text-muted)]">Port: {outIface}</span>
              </div>
              <pre className="font-mono text-xs whitespace-pre-wrap leading-relaxed text-[var(--text-primary)] bg-[var(--bg-inset)]/60 p-3 rounded-lg border border-[var(--border-hairline)]">
                {curr.outText}
              </pre>
            </div>
          </div>

          {/* Decoded Layer Fields Summary */}
          <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-4 space-y-2">
            <h4 className="font-bold text-xs text-[var(--text-primary)]">
              Header Fields Evaluated At Layer {selectedLayer}
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-xs">
              <div className="rounded border border-[var(--border-hairline)] bg-[var(--bg-inset)]/40 p-2">
                <div className="text-[10px] text-[var(--text-muted)]">Source IP</div>
                <div className="font-bold text-[var(--text-primary)] truncate">{packet.srcIp}</div>
              </div>
              <div className="rounded border border-[var(--border-hairline)] bg-[var(--bg-inset)]/40 p-2">
                <div className="text-[10px] text-[var(--text-muted)]">Destination IP</div>
                <div className="font-bold text-[var(--text-primary)] truncate">{packet.dstIp}</div>
              </div>
              <div className="rounded border border-[var(--border-hairline)] bg-[var(--bg-inset)]/40 p-2">
                <div className="text-[10px] text-[var(--text-muted)]">Source MAC</div>
                <div className="font-bold text-[var(--text-primary)] truncate">{packet.srcMac}</div>
              </div>
              <div className="rounded border border-[var(--border-hairline)] bg-[var(--bg-inset)]/40 p-2">
                <div className="text-[10px] text-[var(--text-muted)]">Destination MAC</div>
                <div className="font-bold text-[var(--text-primary)] truncate">{packet.dstMac}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
