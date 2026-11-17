import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Play,
  RotateCcw,
  Send,
  Trash2,
  XCircle,
} from 'lucide-react';
import type { SimplePduEntry } from '../../engine/types';

interface PduListBarProps {
  pdus: SimplePduEntry[];
  onFirePdu: (srcId: string, dstId: string) => void;
  onClearPdus: () => void;
  onStartAddPdu: () => void;
  isAddingPdu: boolean;
}

export const PduListBar: React.FC<PduListBarProps> = ({
  pdus,
  onFirePdu,
  onClearPdus,
  onStartAddPdu,
  isAddingPdu,
}) => {
  const [collapsed, setCollapsed] = useState(pdus.length === 0);

  useEffect(() => {
    if (isAddingPdu || pdus.length > 0) {
      setCollapsed(false);
    }
  }, [isAddingPdu, pdus.length]);

  return (
    <div className="shrink-0 border-t border-[var(--border-hairline)] bg-[var(--bg-surface)] shadow-2xs transition-all duration-150">
      <div className="flex items-center justify-between border-b border-[var(--border-hairline)] bg-[var(--bg-inset)]/70 px-3.5 py-1.5 text-xs min-h-[36px]">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            className="flex items-center gap-1.5 font-display text-xs font-bold text-[var(--text-primary)] hover:text-[var(--accent-primary)] transition-colors"
          >
            {collapsed ? <ChevronUp className="w-3.5 h-3.5 text-[var(--text-muted)]" /> : <ChevronDown className="w-3.5 h-3.5 text-[var(--text-muted)]" />}
            <span>Simulation PDUs</span>
          </button>
          <span className="rounded-full bg-[var(--bg-surface)] px-2 py-0.2 font-mono text-[10px] font-bold text-[var(--accent-primary)] border border-[var(--border-hairline)]">
            {pdus.length}
          </span>
          {collapsed && pdus.length === 0 && (
            <span className="hidden sm:inline text-[11px] text-[var(--text-muted)] ms-1">
              — test end-to-end ping between devices
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onStartAddPdu}
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold transition-all shadow-2xs ${
              isAddingPdu
                ? 'bg-amber-500 text-white animate-pulse'
                : 'bg-[var(--accent-cta)] text-white hover:bg-[var(--accent-cta-hover)]'
            }`}
          >
            <Send className="w-3 h-3" />
            <span>{isAddingPdu ? 'Select Source Device...' : '+ Add Simple PDU'}</span>
          </button>

          {pdus.length > 0 && (
            <button
              type="button"
              onClick={onClearPdus}
              title="Clear all PDUs"
              aria-label="Clear all PDUs"
              className="text-[var(--text-muted)] hover:text-rose-500 rounded p-1 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {!collapsed && (
        <div className="max-h-36 overflow-y-auto">
          {pdus.length === 0 ? (
            <div className="py-2.5 px-3.5 text-center text-xs text-[var(--text-muted)]">
              No simulation PDUs. Click <strong className="text-[var(--text-primary)]">+ Add Simple PDU</strong> and click a source then destination device on the canvas to test end-to-end ping.
            </div>
          ) : (
            <table className="w-full text-start text-xs font-mono">
              <thead className="bg-[var(--bg-inset)]/60 text-[var(--text-muted)] text-[10.5px] border-b border-[var(--border-hairline)]">
                <tr>
                  <th className="py-1 px-3 text-start">Fire</th>
                  <th className="py-1 px-3 text-start">Status</th>
                  <th className="py-1 px-3 text-start">Source</th>
                  <th className="py-1 px-3 text-start">Destination</th>
                  <th className="py-1 px-3 text-start">Type</th>
                  <th className="py-1 px-3 text-start">Time</th>
                  <th className="py-1 px-3 text-start">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-hairline)]">
                {pdus.map((pdu) => (
                  <tr key={pdu.id} className="hover:bg-[var(--bg-inset)]/40 transition-colors">
                    <td className="py-1.5 px-3">
                      <button
                        type="button"
                        onClick={() => onFirePdu(pdu.srcId, pdu.dstId)}
                        title="Fire Simple PDU Ping"
                        aria-label={`Fire PDU ${pdu.srcId} to ${pdu.dstId}`}
                        className="flex items-center gap-1 rounded bg-[var(--accent-primary-soft)] text-[var(--accent-primary)] hover:bg-[var(--accent-primary)] hover:text-white px-2 py-0.5 font-bold text-[11px] transition-colors shadow-2xs"
                      >
                        <Play className="w-2.5 h-2.5" />
                        <span>Fire</span>
                      </button>
                    </td>
                    <td className="py-1.5 px-3">
                      {pdu.status === 'successful' && (
                        <span className="flex items-center gap-1 text-[var(--tone-success)] font-semibold text-[11px]">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Successful</span>
                        </span>
                      )}
                      {pdu.status === 'failed' && (
                        <span className="flex items-center gap-1 text-[var(--tone-danger)] font-semibold text-[11px]">
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Failed</span>
                        </span>
                      )}
                      {pdu.status === 'in_progress' && (
                        <span className="flex items-center gap-1 text-amber-500 font-semibold text-[11px]">
                          <RotateCcw className="w-3 h-3 animate-spin" />
                          <span>In Flight</span>
                        </span>
                      )}
                    </td>
                    <td className="py-1.5 px-3 text-[var(--text-primary)] font-semibold">{pdu.srcId}</td>
                    <td className="py-1.5 px-3 text-[var(--text-primary)] font-semibold">{pdu.dstId}</td>
                    <td className="py-1.5 px-3 text-[var(--accent-teal)] font-bold">ICMP</td>
                    <td className="py-1.5 px-3 text-[var(--text-secondary)]">{pdu.rttMs > 0 ? `${pdu.rttMs}ms` : `${pdu.timeMs}ms`}</td>
                    <td className="py-1.5 px-3 text-[var(--text-secondary)] truncate max-w-xs">{pdu.info || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
};
