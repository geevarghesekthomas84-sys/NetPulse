import React from 'react';
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
  const [collapsed, setCollapsed] = React.useState(false);

  return (
    <div className="shrink-0 border-t border-[var(--border-strong)] bg-[var(--bg-surface)] shadow-lg transition-all duration-150">
      <div className="flex items-center justify-between border-b border-[var(--border-hairline)] bg-[var(--bg-inset)] px-3 py-1.5 text-xs">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            className="flex items-center gap-1 font-display font-bold text-[var(--text-primary)] hover:text-[var(--accent-primary)]"
          >
            {collapsed ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            <span>Packet Tracer PDU Simulation List</span>
          </button>
          <span className="rounded-full bg-[var(--bg-surface)] px-2 py-0.2 font-mono text-[10px] font-bold text-[var(--text-secondary)] border border-[var(--border-hairline)]">
            {pdus.length}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onStartAddPdu}
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-bold transition-all ${
              isAddingPdu
                ? 'bg-amber-500 text-white animate-pulse'
                : 'bg-[var(--accent-cta)] text-white hover:bg-[var(--accent-cta-hover)]'
            }`}
          >
            <Send className="w-3 h-3" />
            <span>{isAddingPdu ? 'Select Target Device...' : '+ Add Simple PDU'}</span>
          </button>

          {pdus.length > 0 && (
            <button
              type="button"
              onClick={onClearPdus}
              title="Clear all PDUs"
              className="text-[var(--text-muted)] hover:text-rose-500 p-1"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {!collapsed && (
        <div className="max-h-36 overflow-y-auto">
          {pdus.length === 0 ? (
            <div className="p-3 text-center text-xs text-[var(--text-muted)]">
              No simulation PDUs. Click <strong className="text-[var(--text-primary)]">+ Add Simple PDU</strong> and click a source then destination device on the canvas to test end-to-end connectivity.
            </div>
          ) : (
            <table className="w-full text-start text-xs font-mono">
              <thead className="bg-[var(--bg-inset)]/60 text-[var(--text-muted)] text-[10.5px] border-b border-[var(--border-hairline)]">
                <tr>
                  <th className="py-1 px-3 text-start">Fire</th>
                  <th className="py-1 px-3 text-start">Last Status</th>
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
                        title="Re-send this PDU"
                        className="rounded p-0.5 text-[var(--accent-primary)] hover:bg-[var(--accent-primary-soft)]"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                    </td>
                    <td className="py-1.5 px-3">
                      <span
                        className={`inline-flex items-center gap-1 font-bold ${
                          pdu.status === 'successful'
                            ? 'text-[var(--tone-success)]'
                            : 'text-[var(--tone-danger)]'
                        }`}
                      >
                        {pdu.status === 'successful' ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5" /> Successful
                          </>
                        ) : (
                          <>
                            <XCircle className="w-3.5 h-3.5" /> Failed
                          </>
                        )}
                      </span>
                    </td>
                    <td className="py-1.5 px-3 font-semibold text-[var(--text-primary)]">{pdu.srcId}</td>
                    <td className="py-1.5 px-3 font-semibold text-[var(--text-primary)]">{pdu.dstId}</td>
                    <td className="py-1.5 px-3 text-[var(--text-secondary)]">ICMP</td>
                    <td className="py-1.5 px-3 text-[var(--text-muted)]">{pdu.rttMs} ms</td>
                    <td className="py-1.5 px-3 text-[var(--text-secondary)] truncate max-w-xs">{pdu.info}</td>
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
