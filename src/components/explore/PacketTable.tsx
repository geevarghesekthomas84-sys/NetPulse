import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowUpDown, Copy, Download, Filter } from 'lucide-react';
import type { CapturedPacket } from '../../engine/types';
import { matchesDisplayFilter } from '../../lib/displayFilter';
import { buildCsvExport, buildPcapFile, triggerDownload } from '../../lib/pcapWriter';
import { PACKET_COLORS } from './colors';
import { tc } from '../../i18n/content';

interface PacketTableProps {
  packets: CapturedPacket[];
  currentPacketIndex: number;
  filenamePrefix: string;
  onSelectPacket: (packetId: string, index: number) => void;
  onInspectPacket: (packetId: string) => void;
  showAllRows?: boolean;
  externalFilter?: string;
  totalPacketCount?: number;
  onClearExternalFilter?: () => void;
  hideInternalFilter?: boolean;
  flat?: boolean;
}

type SortKey = 'no' | 'time' | 'protocol' | 'size';

export const PacketTable: React.FC<PacketTableProps> = ({
  packets,
  currentPacketIndex,
  filenamePrefix,
  onSelectPacket,
  onInspectPacket,
  showAllRows = true,
  externalFilter,
  totalPacketCount,
  onClearExternalFilter,
  hideInternalFilter = false,
  flat = false,
}) => {
  const { t } = useTranslation();
  const [filterExpr, setFilterExpr] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('no');
  const [sortAsc, setSortAsc] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const visiblePackets = useMemo(() => {
    const base = showAllRows ? packets : packets.slice(0, currentPacketIndex + 1);
    const filtered = filterExpr.trim()
      ? base.filter((p) => matchesDisplayFilter(p, filterExpr))
      : base;

    const sorted = [...filtered].sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'no') cmp = a.no - b.no;
      else if (sortKey === 'time') cmp = a.timestampMs - b.timestampMs;
      else if (sortKey === 'protocol') cmp = a.protocol.localeCompare(b.protocol);
      else if (sortKey === 'size') cmp = a.sizeBytes - b.sizeBytes;
      return sortAsc ? cmp : -cmp;
    });
    return sorted;
  }, [packets, showAllRows, currentPacketIndex, filterExpr, sortKey, sortAsc]);

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortAsc(!sortAsc);
    else {
      setSortKey(k);
      setSortAsc(true);
    }
  };

  const handleExportPcap = () => {
    const bytes = buildPcapFile(visiblePackets);
    const copy = new Uint8Array(bytes.byteLength);
    copy.set(bytes);
    triggerDownload(new Blob([copy], { type: 'application/vnd.tcpdump.pcap' }), `${filenamePrefix}.pcap`);
  };

  const handleExportCsv = () => {
    const csv = buildCsvExport(visiblePackets);
    triggerDownload(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `${filenamePrefix}.csv`);
  };

  const copySummary = async (pkt: CapturedPacket, e: React.MouseEvent) => {
    e.stopPropagation();
    const line = `#${pkt.no} ${(pkt.timestampMs / 1000).toFixed(4)}s ${pkt.srcIp} -> ${pkt.dstIp} ${pkt.protocol} (${pkt.sizeBytes}B) ${pkt.info}`;
    try {
      await navigator.clipboard.writeText(line);
      setCopiedId(pkt.id);
      setTimeout(() => setCopiedId(null), 1200);
    } catch {
      // Clipboard blocked in restricted context
    }
  };

  return (
    <section
      aria-label={tc('Wireshark Packet Capture Table')}
      className={
        flat
          ? 'bg-[var(--bg-surface)] overflow-hidden'
          : 'rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] overflow-hidden'
      }
    >
      {/* Toolbar: Display Filter + Exports */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-hairline)] px-3.5 py-2">
        {hideInternalFilter ? (
          <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-[var(--text-secondary)]">
            <Filter className="w-3.5 h-3.5 text-[var(--tone-info)] shrink-0" />
            {externalFilter?.trim() ? (
              <>
                <span>
                  {t('simulator.captureFilter')}: <strong className="text-[var(--text-primary)]">{externalFilter}</strong>
                </span>
                {onClearExternalFilter && (
                  <button
                    type="button"
                    onClick={onClearExternalFilter}
                    className="text-xs text-[var(--accent-primary)] hover:underline"
                  >
                    {t('common.clear')}
                  </button>
                )}
              </>
            ) : (
              <span className="text-[var(--text-muted)]">{t('simulator.allTraffic')}</span>
            )}
          </div>
        ) : (
          <div className="relative flex-1 min-w-[220px]">
            <Filter className="w-3.5 h-3.5 text-[var(--text-muted)] absolute start-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={filterExpr}
              onChange={(e) => setFilterExpr(e.target.value)}
              placeholder={t('simulator.filterPlaceholder')}
              aria-label={tc('Wireshark display filter')}
              className="w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-inset)] py-1.5 ps-8 pe-3 font-mono text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent-primary)] focus:outline-none"
            />
          </div>
        )}

        <div className="flex min-w-0 max-w-full flex-wrap items-center gap-2">
          <span className="font-mono text-xs text-[var(--text-muted)] tabular-nums">
            {visiblePackets.length}/{totalPacketCount ?? packets.length} pkts
          </span>
          <button
            type="button"
            onClick={handleExportPcap}
            className="flex items-center gap-1 rounded-lg border border-[var(--border-hairline)] px-2.5 py-1.5 text-xs font-mono text-[var(--text-secondary)] hover:text-[var(--text-primary)] whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{t('explore.exportPcap')}</span>
          </button>
          <button
            type="button"
            onClick={handleExportCsv}
            className="flex items-center gap-1 rounded-lg border border-[var(--border-hairline)] px-2.5 py-1.5 text-xs font-mono text-[var(--text-secondary)] hover:text-[var(--text-primary)] whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{t('explore.exportCsv')}</span>
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto max-h-80 overflow-y-auto">
        <table className="w-full text-start border-collapse font-mono text-xs tabular-nums">
          <thead className="sticky top-0 z-10 bg-[var(--bg-inset)] text-xs uppercase tracking-[0.14em] font-bold text-[var(--text-muted)] border-b border-[var(--border-hairline)]">
            <tr>
              <th className="px-3 py-2 text-start">
                <button type="button" onClick={() => toggleSort('no')} className="inline-flex items-center gap-1 hover:text-[var(--text-primary)]">
                  No. <ArrowUpDown className="w-3 h-3" />
                </button>
              </th>
              <th className="px-3 py-2 text-start">
                <button type="button" onClick={() => toggleSort('time')} className="inline-flex items-center gap-1 hover:text-[var(--text-primary)]">
                  Time <ArrowUpDown className="w-3 h-3" />
                </button>
              </th>
              <th className="px-3 py-2 text-start">{tc('Source')}</th>
              <th className="px-3 py-2 text-start">{tc('Destination')}</th>
              <th className="px-3 py-2 text-start">
                <button type="button" onClick={() => toggleSort('protocol')} className="inline-flex items-center gap-1 hover:text-[var(--text-primary)]">
                  Protocol <ArrowUpDown className="w-3 h-3" />
                </button>
              </th>
              <th className="px-3 py-2 text-start">{tc('Info')}</th>
              <th className="px-3 py-2 text-end">
                <button type="button" onClick={() => toggleSort('size')} className="inline-flex items-center gap-1 hover:text-[var(--text-primary)]">
                  Size <ArrowUpDown className="w-3 h-3" />
                </button>
              </th>
              <th className="px-2 py-2 text-end">{tc('Act')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-hairline)]/60">
            {visiblePackets.map((pkt) => {
              const origIndex = packets.findIndex((p) => p.id === pkt.id);
              const isCurrent = origIndex === currentPacketIndex;
              const isFuture = origIndex > currentPacketIndex;
              const colorMeta = PACKET_COLORS[pkt.colorCategory] || PACKET_COLORS.tcp;

              return (
                <tr
                  key={pkt.id}
                  onClick={() => {
                    onSelectPacket(pkt.id, origIndex);
                    onInspectPacket(pkt.id);
                  }}
                  className={`cursor-pointer transition-colors ${
                    isCurrent
                      ? 'bg-[var(--accent-primary-soft)] outline outline-1 outline-[var(--accent-primary)]/60'
                      : `${colorMeta.bgClass} hover:bg-[var(--accent-primary-soft)]/60`
                  } ${isFuture ? 'opacity-55' : ''}`}
                >
                  <td className="px-3 py-2">
                    <span
                      className="inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-[11px] font-bold text-white tabular-nums"
                      style={{ backgroundColor: colorMeta.hex }}
                    >
                      {pkt.no}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-[var(--text-secondary)]">
                    {(pkt.timestampMs / 1000).toFixed(4)}
                  </td>
                  <td className="px-3 py-2 text-[var(--text-primary)] whitespace-nowrap">{pkt.srcIp || pkt.srcMac}</td>
                  <td className="px-3 py-2 text-[var(--text-primary)] whitespace-nowrap">{pkt.dstIp || pkt.dstMac}</td>
                  <td className={`px-3 py-2 font-semibold whitespace-nowrap ${colorMeta.textClass}`}>
                    {pkt.protocol}
                  </td>
                  <td className="px-3 py-2 text-[var(--text-primary)] max-w-md truncate" title={pkt.info}>
                    {pkt.info}
                  </td>
                  <td className="px-3 py-2 text-end text-[var(--text-secondary)]">{pkt.sizeBytes}B</td>
                  <td className="px-2 py-2 text-end">
                    <button
                      type="button"
                      onClick={(e) => void copySummary(pkt, e)}
                      title={tc('Copy packet summary')}
                      className="rounded p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                    >
                      {copiedId === pkt.id ? (
                        <span className="text-[11px] font-bold text-[var(--tone-success)]">OK</span>
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </td>
                </tr>
              );
            })}
            {visiblePackets.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-xs text-[var(--text-muted)]">
                  <span>
                    {filterExpr || externalFilter
                      ? `No packets match display filter "${filterExpr || externalFilter}".`
                      : 'No packets captured yet. Run a CLI command or send traffic.'}
                  </span>
                  {externalFilter && onClearExternalFilter && (
                    <button
                      type="button"
                      onClick={onClearExternalFilter}
                      className="ms-2 font-mono text-[var(--accent-primary)] hover:underline"
                    >
                      {t('simulator.clearFilter')}
                    </button>
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
};
