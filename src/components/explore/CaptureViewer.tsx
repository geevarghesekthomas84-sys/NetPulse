import React, { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FileUp, Info, Lock, X } from 'lucide-react';
import type { CapturedPacket } from '../../engine/types';
import { buildPcapFile } from '../../lib/pcapWriter';
import { busiestHosts, MAX_PCAP_PACKETS, parsePcap, type PcapErrorCode } from '../../lib/pcapReader';
import type { ProtocolNodeDef } from '../../protocols/types';
import { PacketInspectorContent } from '../common/PacketInspector';
import { PacketTable } from './PacketTable';
import { SequenceDiagram } from './SequenceDiagram';

interface Loaded {
  name: string;
  packets: CapturedPacket[];
  totalRecords: number;
  truncated: boolean;
}

interface CaptureViewerProps {
  /** Packets of the protocol currently open, offered as a one-click sample. */
  samplePackets: CapturedPacket[];
  sampleName: string;
  onClose: () => void;
}

/**
 * Opens a .pcap from the user's computer and shows it with the same sequence
 * diagram, packet table and inspector used for the built-in lessons.
 * The file is read in the browser with FileReader and is never uploaded.
 */
export const CaptureViewer: React.FC<CaptureViewerProps> = ({ samplePackets, sampleName, onClose }) => {
  const { t } = useTranslation();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState<{ code: PcapErrorCode | 'read'; linkType?: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback((buf: ArrayBuffer, name: string) => {
    const res = parsePcap(buf);
    if (!res.ok) {
      setError({ code: res.error, linkType: res.linkType });
      return;
    }
    setError(null);
    setSelected(0);
    setLoaded({ name, packets: res.packets, totalRecords: res.totalRecords, truncated: res.truncated });
  }, []);

  const readFile = useCallback(
    (file: File | undefined) => {
      if (!file) return;
      const reader = new FileReader();
      reader.onerror = () => setError({ code: 'read' });
      reader.onload = () => load(reader.result as ArrayBuffer, file.name);
      reader.readAsArrayBuffer(file);
    },
    [load]
  );

  const useSample = () => {
    const bytes = buildPcapFile(samplePackets);
    load(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer, `${sampleName}.pcap`);
  };

  const hostIds = useMemo(() => (loaded ? busiestHosts(loaded.packets) : []), [loaded]);
  const nodes: ProtocolNodeDef[] = useMemo(
    () => hostIds.map((id, i) => ({ id, label: id, ip: id, role: 'host', x: i * 100, y: 0 })),
    [hostIds]
  );
  const diagramPackets = useMemo(() => {
    if (!loaded) return [];
    const set = new Set(hostIds);
    return loaded.packets.filter((p) => set.has(p.fromDeviceId) && set.has(p.toDeviceId));
  }, [loaded, hostIds]);

  const durationSec = loaded ? (loaded.packets[loaded.packets.length - 1].timestampMs / 1000).toFixed(2) : '0';
  const allHosts = loaded ? new Set(loaded.packets.flatMap((p) => [p.fromDeviceId, p.toDeviceId])).size : 0;
  const current = loaded?.packets[selected] ?? null;

  const errorText = error
    ? error.code === 'link_type'
      ? t('pcap.errorLinkType', { type: error.linkType })
      : t(`pcap.error.${error.code}`)
    : null;

  return (
    <div role="dialog" aria-label={t('pcap.title')} className="absolute inset-0 z-30 flex flex-col bg-[var(--bg-canvas)]">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-[var(--border-hairline)] bg-[var(--bg-surface)] px-4 py-2.5">
        <div className="min-w-0">
          <h2 className="font-display text-base font-bold text-[var(--text-primary)]">{t('pcap.title')}</h2>
          {loaded && (
            <p className="truncate text-xs text-[var(--text-secondary)]" dir="ltr">
              {loaded.name} · {t('pcap.summary', { packets: loaded.packets.length, hosts: allHosts, duration: durationSec })}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {loaded && (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="flex items-center gap-1.5 rounded-full border border-[var(--border-hairline)] px-3 py-1.5 text-sm font-medium text-[var(--text-primary)] hover:border-[var(--accent-primary)]"
            >
              <FileUp className="w-4 h-4" />
              {t('pcap.another')}
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label={t('pcap.close')}
            className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--text-secondary)] hover:bg-[var(--bg-inset)] hover:text-[var(--text-primary)]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".pcap,.cap,application/vnd.tcpdump.pcap"
        className="sr-only"
        aria-label={t('pcap.choose')}
        onChange={(e) => {
          readFile(e.target.files?.[0]);
          e.target.value = '';
        }}
      />

      {!loaded ? (
        <div className="flex flex-1 items-center justify-center overflow-y-auto p-4">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              readFile(e.dataTransfer.files?.[0]);
            }}
            className={`w-full max-w-xl rounded-3xl border-2 border-dashed p-8 text-center transition-colors ${
              dragging ? 'border-[var(--accent-primary)] bg-[var(--accent-primary-soft)]' : 'border-[var(--border-strong)] bg-[var(--bg-surface)]'
            }`}
          >
            <FileUp className="mx-auto h-9 w-9 text-[var(--accent-primary)]" aria-hidden="true" />
            <p className="mt-3 text-base font-semibold text-[var(--text-primary)]">{t('pcap.drop')}</p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="rounded-full bg-[var(--accent-cta)] px-5 py-2 text-sm font-semibold text-[var(--on-accent)] hover:bg-[var(--accent-cta-hover)]"
              >
                {t('pcap.choose')}
              </button>
              <button
                type="button"
                onClick={useSample}
                className="rounded-full border border-[var(--border-hairline)] px-5 py-2 text-sm font-semibold text-[var(--text-primary)] hover:border-[var(--accent-primary)]"
              >
                {t('pcap.sample', { name: sampleName })}
              </button>
            </div>
            {errorText && (
              <p role="alert" className="mt-4 rounded-xl bg-[var(--bg-inset)] px-3 py-2 text-sm font-medium text-[var(--tone-danger)]">
                {errorText}
              </p>
            )}
            <p className="mt-5 flex items-center justify-center gap-1.5 text-xs text-[var(--text-muted)]">
              <Lock className="w-3.5 h-3.5" aria-hidden="true" />
              {t('pcap.privacy')}
            </p>
            <p className="mt-1 text-xs text-[var(--text-muted)]">{t('pcap.formats')}</p>
          </div>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          {(loaded.truncated || hostIds.length < allHosts) && (
            <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 border-b border-[var(--border-hairline)] bg-[var(--bg-inset)] px-4 py-1.5 text-xs text-[var(--text-secondary)]">
              <Info className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              {loaded.truncated && <span>{t('pcap.truncated', { count: MAX_PCAP_PACKETS })}</span>}
              {hostIds.length < allHosts && <span>{t('pcap.hostsShown', { count: hostIds.length })}</span>}
            </div>
          )}
          <div className="min-h-[200px] flex-[1.1] overflow-hidden border-b border-[var(--border-hairline)]">
            <SequenceDiagram
              nodes={nodes}
              packets={diagramPackets}
              currentPacketIndex={Math.max(0, diagramPackets.findIndex((p) => p.id === current?.id))}
              onSelectPacket={(_i, id) => {
                const idx = loaded.packets.findIndex((p) => p.id === id);
                if (idx >= 0) setSelected(idx);
              }}
            />
          </div>
          <div className="grid min-h-0 flex-1 overflow-hidden lg:grid-cols-2">
            <div className="min-h-0 overflow-y-auto border-b border-[var(--border-hairline)] lg:border-b-0 lg:border-e">
              <PacketTable
                packets={loaded.packets}
                currentPacketIndex={selected}
                filenamePrefix="netpulse-capture"
                flat
                onSelectPacket={(_id, idx) => setSelected(idx)}
                onInspectPacket={(id) => {
                  const idx = loaded.packets.findIndex((p) => p.id === id);
                  if (idx >= 0) setSelected(idx);
                }}
              />
            </div>
            <div className="min-h-0 overflow-hidden">
              <PacketInspectorContent packet={current} defaultShowHex embedded />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
