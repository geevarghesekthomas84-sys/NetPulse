import React from 'react';
import { useTranslation } from 'react-i18next';
import type { CapturedPacket } from '../../engine/types';
import type { ProtocolEntry, ProtocolStepDef } from '../../protocols/types';
import { tc } from '../../i18n/content';
import { Gloss } from '../common/Gloss';
import { PACKET_COLORS } from './colors';

interface StepPanelProps {
  protocol: ProtocolEntry;
  step: ProtocolStepDef | undefined;
  stepIndex: number;
  stepCount: number;
  packet: CapturedPacket | null;
}

/** Right-hand HUD panel: what is happening in this step, plus the protocol's key facts. */
export const StepPanel: React.FC<StepPanelProps> = ({ protocol, step, stepIndex, stepCount, packet }) => {
  const { t } = useTranslation();
  const facts: [string, string][] = [
    [t('explore.layerLabel'), tc(protocol.layer)],
    [t('explore.defaultPort'), protocol.defaultPort],
    [t('explore.transport'), tc(protocol.transport)],
    [t('explore.dataFormat'), tc(protocol.dataFormat)],
    ...(protocol.methods.length ? ([[t('explore.methods'), protocol.methods.join(', ')]] as [string, string][]) : []),
  ];
  const color = packet ? PACKET_COLORS[packet.colorCategory]?.hex : undefined;

  return (
    <aside aria-label={t('explore.stepDetails')} className="hud-panel hidden min-h-0 w-80 shrink-0 flex-col overflow-hidden xl:flex">
      <div className="flex items-center justify-between border-b border-[var(--border-hairline)] px-4 py-3">
        <h2 className="hud-title text-base text-[var(--text-primary)]">{t('explore.stepDetails')}</h2>
        <span className="rounded border border-[var(--tone-success)]/50 bg-[var(--tone-success)]/12 px-2 py-0.5 hud-title text-[10px] text-[var(--tone-success)]">
          {protocol.status === 'full' ? t('explore.active') : protocol.status.toUpperCase()}
        </span>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        {step ? (
          <div>
            <p className="hud-title text-[11px] text-[var(--accent-primary)]">{t('explore.stepOf', { current: stepIndex + 1, total: stepCount })}</p>
            <h3 className="hud-title mt-1 text-xl leading-tight text-[var(--text-primary)]">{tc(step.title)}</h3>
            <p className="mt-1 font-mono text-sm text-[var(--text-secondary)]">{tc(step.subtitle)}</p>
            <p className="mt-3 text-sm leading-relaxed text-[var(--text-secondary)]">
              <Gloss text={tc(step.caption)} />
            </p>
          </div>
        ) : (
          <p className="text-sm leading-relaxed text-[var(--text-secondary)]">{tc(protocol.description)}</p>
        )}

        {packet && (
          <div className="rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-inset)] px-3 py-2 font-mono text-xs">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} aria-hidden="true" />
              <span className="font-bold text-[var(--text-primary)]">
                #{packet.no} {packet.protocol}
              </span>
              <span className="ms-auto tabular-nums text-[var(--text-muted)]">{packet.sizeBytes} B</span>
            </div>
            <div className="mt-1 truncate text-[var(--text-secondary)]">
              {packet.srcIp} → {packet.dstIp}
            </div>
          </div>
        )}

        <dl className="border-t border-[var(--border-hairline)]">
          {facts.map(([k, v]) => (
            <div key={k} className="grid grid-cols-[7.5rem_1fr] gap-3 border-b border-[var(--border-hairline)] py-2 text-sm">
              <dt className="hud-title text-[11px] leading-5 text-[var(--text-muted)]">{k}</dt>
              <dd className="min-w-0 break-words font-mono text-[13px] text-[var(--text-primary)]">{v}</dd>
            </div>
          ))}
        </dl>
      </div>
    </aside>
  );
};
