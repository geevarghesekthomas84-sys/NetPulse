import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Play, RotateCcw } from 'lucide-react';
import type { CapturedPacket } from '../../engine/types';

interface Layer {
  key: string;
  /** Protocol name as shown on the layer (technical names stay in English). */
  name: string;
  whyKey: string;
  headerBytes: number;
  summary: string;
}

/** Builds the stack from the innermost payload outwards: app -> ... -> Ethernet. */
function buildLayers(p: CapturedPacket): Layer[] {
  const l = p.layers;
  const out: Layer[] = [];
  if (l.dns || l.app) {
    out.push({
      key: 'app',
      name: l.dns ? 'DNS' : l.app?.protocolName ?? p.protocol,
      whyKey: 'encap.why.app',
      headerBytes: 0,
      summary: l.app?.summary ?? p.info,
    });
  }
  if (l.tls) {
    out.push({
      key: 'tls',
      name: 'TLS',
      whyKey: 'encap.why.tls',
      headerBytes: 5,
      summary: `${l.tls.version} · ${l.tls.recordType}`,
    });
  }
  if (l.tcp) {
    out.push({ key: 'tcp', name: 'TCP', whyKey: 'encap.why.tcp', headerBytes: 20, summary: `${l.tcp.srcPort} → ${l.tcp.dstPort}` });
  } else if (l.udp) {
    out.push({ key: 'udp', name: 'UDP', whyKey: 'encap.why.udp', headerBytes: 8, summary: `${l.udp.srcPort} → ${l.udp.dstPort}` });
  } else if (l.icmp) {
    out.push({ key: 'icmp', name: 'ICMP', whyKey: 'encap.why.icmp', headerBytes: 8, summary: `Type ${l.icmp.type}` });
  }
  if (l.ipv4) {
    out.push({ key: 'ip', name: 'IPv4', whyKey: 'encap.why.ip', headerBytes: 20, summary: `${l.ipv4.srcIp} → ${l.ipv4.dstIp}` });
  } else if (l.ipv6) {
    out.push({ key: 'ip', name: 'IPv6', whyKey: 'encap.why.ip', headerBytes: 40, summary: `${l.ipv6.srcIp} → ${l.ipv6.dstIp}` });
  } else if (l.arp) {
    out.push({ key: 'arp', name: 'ARP', whyKey: 'encap.why.arp', headerBytes: 28, summary: l.arp.opcode === 1 ? 'Request' : 'Reply' });
  }
  out.push({
    key: 'eth',
    name: 'Ethernet',
    whyKey: 'encap.why.eth',
    headerBytes: 14,
    summary: `${l.ethernet.srcMac} → ${l.ethernet.dstMac}`,
  });
  return out;
}

const LAYER_COLOR: Record<string, string> = {
  app: 'var(--tone-info)',
  tls: 'var(--tone-success)',
  tcp: 'var(--accent-primary)',
  udp: 'var(--tone-warning)',
  icmp: 'var(--tone-danger)',
  ip: 'var(--accent-teal)',
  arp: 'var(--accent-teal)',
  eth: 'var(--text-secondary)',
};

export const EncapsulationView: React.FC<{ packet: CapturedPacket | null }> = ({ packet }) => {
  const { t } = useTranslation();
  const layers = useMemo(() => (packet ? buildLayers(packet) : []), [packet]);
  const [shown, setShown] = useState(1);
  const [playing, setPlaying] = useState(true);

  // Start the wrap-up animation whenever a different packet is chosen.
  useEffect(() => {
    setShown(1);
    setPlaying(true);
  }, [packet?.id]);

  useEffect(() => {
    if (!playing || layers.length === 0) return;
    if (shown >= layers.length) {
      setPlaying(false);
      return;
    }
    const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const id = window.setTimeout(() => setShown((n) => n + 1), reduced ? 0 : 900);
    return () => window.clearTimeout(id);
  }, [playing, shown, layers.length]);

  if (!packet || layers.length === 0) {
    return <div className="p-4 text-sm text-[var(--text-secondary)]">{t('explore.encapNoPacket')}</div>;
  }

  const visible = layers.slice(0, shown);
  const total = visible.reduce((a, l) => a + l.headerBytes, 0);
  const payloadBytes = Math.max(0, packet.sizeBytes - layers.reduce((a, l) => a + l.headerBytes, 0));

  // Render outermost-first as nested boxes.
  const nest = (idx: number): React.ReactNode => {
    const layer = visible[idx];
    const inner = idx > 0 ? nest(idx - 1) : null;
    const color = LAYER_COLOR[layer.key] ?? 'var(--border-strong)';
    return (
      <div
        key={layer.key}
        className="rounded-xl border-2 p-2.5 transition-all duration-500"
        style={{ borderColor: color, background: 'var(--bg-surface)' }}
      >
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="text-sm font-bold" style={{ color }}>
            {layer.name}
          </span>
          {layer.headerBytes > 0 && (
            <span className="rounded-full bg-[var(--bg-inset)] px-2 py-0.5 text-xs font-medium text-[var(--text-secondary)]">
              +{t('explore.encapBytes', { count: layer.headerBytes })}
            </span>
          )}
          <span className="text-xs text-[var(--text-muted)] break-all" dir="ltr">
            {layer.summary}
          </span>
        </div>
        <p className="mt-0.5 text-xs text-[var(--text-secondary)]">{t(layer.whyKey)}</p>
        {inner && <div className="mt-2">{inner}</div>}
        {!inner && payloadBytes > 0 && layer.key === 'app' && (
          <div className="mt-2 rounded-lg bg-[var(--bg-inset)] px-2.5 py-1.5 text-xs text-[var(--text-secondary)]">
            {t('explore.encapPayload', { count: payloadBytes })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-[var(--text-primary)]">{t('explore.encapTitle')}</h3>
          <p className="text-xs text-[var(--text-secondary)]">{t('explore.encapHint')}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--text-muted)]">
            {shown}/{layers.length} · {t('explore.encapBytes', { count: total })}
          </span>
          <button
            type="button"
            onClick={() => {
              if (shown >= layers.length) setShown(1);
              setPlaying((p) => !p || shown >= layers.length);
            }}
            className="flex items-center gap-1.5 rounded-full border border-[var(--border-hairline)] px-3 py-1 text-xs font-semibold text-[var(--text-primary)] hover:border-[var(--accent-primary)]"
          >
            {shown >= layers.length ? <RotateCcw className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            {t('recap.replay')}
          </button>
        </div>
      </div>

      <input
        type="range"
        min={1}
        max={layers.length}
        value={shown}
        onChange={(e) => {
          setPlaying(false);
          setShown(Number(e.target.value));
        }}
        aria-label={t('explore.encapTitle')}
        className="w-full accent-[var(--accent-cta)]"
      />

      {nest(visible.length - 1)}
    </div>
  );
};
