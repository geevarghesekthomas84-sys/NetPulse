import React from 'react';
import { useTranslation } from 'react-i18next';
import { Layers } from 'lucide-react';

interface OsiRulerProps {
  activeLayer: number;
}

const OSI_LAYERS = [
  { num: 7, name: 'Application', tcpip: 'Application', examples: 'HTTP, DNS, SSH, SMTP' },
  { num: 6, name: 'Presentation', tcpip: 'Application', examples: 'TLS, MIME, UTF-8' },
  { num: 5, name: 'Session', tcpip: 'Application', examples: 'WebRTC, SIP, NetBIOS' },
  { num: 4, name: 'Transport', tcpip: 'Transport', examples: 'TCP, UDP, QUIC' },
  { num: 3, name: 'Network', tcpip: 'Internet', examples: 'IPv4, IPv6, ICMP, BGP' },
  { num: 2, name: 'Data Link', tcpip: 'Link', examples: 'Ethernet, ARP, Wi-Fi' },
  { num: 1, name: 'Physical', tcpip: 'Link', examples: 'Copper, Fiber, Radio' },
];

export const OsiRuler: React.FC<OsiRulerProps> = ({ activeLayer }) => {
  const { t } = useTranslation();
  return (
    <div aria-label={t('explore.osiLayers')} className="space-y-1.5">
      <div className="flex items-center gap-1.5 px-1 font-mono text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
        <Layers className="w-3 h-3 text-[var(--accent-primary)]" />
        <span>{t('explore.osiLayers')}</span>
      </div>
      <div className="space-y-1">
        {OSI_LAYERS.map((layer) => {
          const isActive = activeLayer === layer.num;
          return (
            <div
              key={layer.num}
              className={`rounded-md border px-2 py-1.5 transition-colors ${
                isActive
                  ? 'border-[var(--accent-primary)] bg-[var(--accent-primary-soft)] text-[var(--text-primary)]'
                  : 'border-[var(--border-hairline)]/70 bg-[var(--bg-inset)]/50 text-[var(--text-muted)]'
              }`}
            >
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="font-mono font-bold">
                  L{layer.num} {layer.name}
                </span>
                <span className="text-[11px] font-mono opacity-80">{layer.tcpip}</span>
              </div>
              <div className="text-[11px] truncate opacity-85">{layer.examples}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
