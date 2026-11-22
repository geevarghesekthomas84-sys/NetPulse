import React from 'react';
import { useTranslation } from 'react-i18next';
import { Inbox } from 'lucide-react';
import type { SimDevice } from '../../engine/types';

export type NodeTableTab = 'arp' | 'routing' | 'nat' | 'mac';

interface Column {
  label: string;
  className?: string;
}

/** Compact data table with a header row; shows a friendly empty state instead of a bare sentence. */
const Grid: React.FC<{ columns: Column[]; rows: React.ReactNode[][]; empty: string }> = ({ columns, rows, empty }) => {
  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center gap-1.5 px-4 py-6 text-center">
        <Inbox className="h-5 w-5 text-[var(--text-muted)]" aria-hidden="true" />
        <p className="max-w-[16rem] text-xs text-[var(--text-secondary)]">{empty}</p>
      </div>
    );
  }
  const template = { gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` };
  return (
    <div role="table" className="text-xs">
      <div
        role="row"
        style={template}
        className="sticky top-0 grid gap-3 border-b border-[var(--border-hairline)] bg-[var(--bg-inset)] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]"
      >
        {columns.map((c) => (
          <span key={c.label} role="columnheader" className={c.className}>
            {c.label}
          </span>
        ))}
      </div>
      {rows.map((cells, i) => (
        <div
          key={i}
          role="row"
          style={template}
          className="grid gap-3 border-b border-[var(--border-hairline)] px-3 py-2 font-mono tabular-nums last:border-b-0"
        >
          {cells.map((cell, j) => (
            <span key={j} role="cell" className={`min-w-0 truncate ${columns[j].className ?? ''} ${j === 0 ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}`}>
              {cell}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
};

export const NodeTable: React.FC<{ device: SimDevice; tab: NodeTableTab }> = ({ device, tab }) => {
  const { t } = useTranslation();

  if (tab === 'arp') {
    return (
      <Grid
        columns={[{ label: t('simulator.colIp') }, { label: t('simulator.colMac') }]}
        rows={device.arpCache.map((a) => [a.ip, a.mac])}
        empty={t('simulator.emptyArp')}
      />
    );
  }
  if (tab === 'routing') {
    return (
      <Grid
        columns={[{ label: t('simulator.colNetwork') }, { label: t('simulator.colNextHop') }, { label: t('simulator.colIface') }]}
        rows={device.routingTable.map((r) => [`${r.network}/${r.mask}`, r.nextHop, r.iface])}
        empty={t('simulator.emptyRouting')}
      />
    );
  }
  if (tab === 'nat') {
    return (
      <Grid
        columns={[{ label: t('simulator.colInside') }, { label: t('simulator.colOutside') }]}
        rows={device.natTable.map((n) => [`${n.insideLocalIp}:${n.insideLocalPort}`, `${n.insideGlobalIp}:${n.insideGlobalPort}`])}
        empty={t('simulator.emptyNat')}
      />
    );
  }
  return (
    <Grid
      columns={[{ label: t('simulator.colMac') }, { label: t('simulator.colVlan') }, { label: t('simulator.colPort') }]}
      rows={device.macTable.map((m) => [m.mac, `${m.vlan}`, m.portIfaceId])}
      empty={t('simulator.emptyMac')}
    />
  );
};
