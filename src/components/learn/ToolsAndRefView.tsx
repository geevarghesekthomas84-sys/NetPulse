import React, { useMemo, useState } from 'react';
import { Calculator, Layers, Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { calculateSubnet, ipToInt } from '../../lib/ipUtils';
import { PROTOCOLS } from '../../protocols';
import { useAppStore } from '../../store/useAppStore';
import { tc } from '../../i18n/content';
import { GLOSSARY_TERMS } from '../../lib/glossary';

const OSI_EXPLORER = [
  { layer: 7, name: 'Application', tcpip: 'Application', role: 'User-facing protocols: HTTP, HTTPS, DNS, DoH, SMTP, IMAP, POP3, FTP, SSH, SMB, Modbus.' },
  { layer: 6, name: 'Presentation', tcpip: 'Application', role: 'Encryption, compression, encoding: TLS 1.3, X.509 certificates, MIME, UTF-8.' },
  { layer: 5, name: 'Session', tcpip: 'Application', role: 'Session establishment and synchronization: SIP, WebRTC ICE/SDP, SOCKS5, RADIUS.' },
  { layer: 4, name: 'Transport', tcpip: 'Transport', role: 'End-to-end ports, reliability, congestion control: TCP, UDP, QUIC.' },
  { layer: 3, name: 'Network', tcpip: 'Internet', role: 'Logical addressing and global routing: IPv4, IPv6, ICMP, IGMP, BGP, IPsec.' },
  { layer: 2, name: 'Data Link', tcpip: 'Link', role: 'Local frame delivery, MAC switching, VLANs, Wi-Fi auth: Ethernet, ARP, PPPoE, WPA2, WPA3.' },
  { layer: 1, name: 'Physical', tcpip: 'Link', role: 'Electrical pulses, optical wavelengths, and RF modulation over copper, fiber, and air.' },
];

export const ToolsAndRefView: React.FC = () => {
  const { t } = useTranslation();
  const { selectProtocol } = useAppStore();
  const [ipInput, setIpInput] = useState('192.168.10.45');
  const [prefixInput, setPrefixInput] = useState(24);
  const [glossaryQ, setGlossaryQ] = useState('');
  const [selectedOsi, setSelectedOsi] = useState(4);

  const subnet = useMemo(() => {
    try {
      return calculateSubnet(ipInput.trim(), prefixInput);
    } catch {
      return null;
    }
  }, [ipInput, prefixInput]);

  const binaryOctets = useMemo(() => {
    const parts = ipInput.trim().split('.').map(Number);
    if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return null;
    return parts.map((n) => n.toString(2).padStart(8, '0')).join('.');
  }, [ipInput]);

  const filteredGlossary = useMemo(() => {
    const q = glossaryQ.trim().toLowerCase();
    if (!q) return GLOSSARY_TERMS;
    return GLOSSARY_TERMS.filter(
      (g) => g.term.toLowerCase().includes(q) || g.def.toLowerCase().includes(q)
    );
  }, [glossaryQ]);

  const layerProtocols = useMemo(
    () => PROTOCOLS.filter((p) => p.osiLayer === selectedOsi),
    [selectedOsi]
  );

  return (
    <div className="space-y-5">
      {/* Subnet Calculator & Binary Converter */}
      <section className="hud-panel p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Calculator className="w-4 h-4 text-[var(--accent-primary)]" />
          <h2 className="font-display text-base font-bold text-[var(--text-primary)]">
            {t('learn.subnetCalc')}
          </h2>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <label className="space-y-1 text-xs">
            <span className="text-[var(--text-muted)]">{tc('IPv4 Address')}</span>
            <input
              type="text"
              value={ipInput}
              onChange={(e) => setIpInput(e.target.value)}
              className="block w-48 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-inset)] px-3 py-1.5 font-mono text-xs text-[var(--text-primary)]"
            />
          </label>
          <label className="space-y-1 text-xs">
            <span className="text-[var(--text-muted)]">Prefix (/{prefixInput})</span>
            <input
              type="range"
              min={1}
              max={32}
              value={prefixInput}
              onChange={(e) => setPrefixInput(Number(e.target.value))}
              className="block w-48 accent-[var(--accent-cta)]"
            />
          </label>
          {binaryOctets && (
            <div className="rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-inset)] px-3 py-1.5 font-mono text-xs text-[var(--accent-teal)]">
              Binary: {binaryOctets} (uint32: {ipToInt(ipInput) >>> 0})
            </div>
          )}
        </div>

        {subnet && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 font-mono text-xs tabular-nums">
            <div className="rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-inset)] p-3">
              <div className="text-[11px] text-[var(--text-muted)]">{tc('NETWORK / CIDR')}</div>
              <div className="mt-1 font-bold text-[var(--accent-primary)]">
                {subnet.network}/{subnet.prefix}
              </div>
            </div>
            <div className="rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-inset)] p-3">
              <div className="text-[11px] text-[var(--text-muted)]">{tc('SUBNET MASK / WILDCARD')}</div>
              <div className="mt-1 font-bold text-[var(--text-primary)]">
                {subnet.mask} · {subnet.wildcard}
              </div>
            </div>
            <div className="rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-inset)] p-3">
              <div className="text-[11px] text-[var(--text-muted)]">{tc('USABLE HOST RANGE')}</div>
              <div className="mt-1 font-bold text-[var(--tone-success)]">
                {subnet.firstHost} – {subnet.lastHost}
              </div>
            </div>
            <div className="rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-inset)] p-3">
              <div className="text-[11px] text-[var(--text-muted)]">{tc('BROADCAST · USABLE HOSTS')}</div>
              <div className="mt-1 font-bold text-[var(--text-primary)]">
                {subnet.broadcast} ({subnet.usableHosts.toLocaleString()})
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Interactive OSI vs TCP/IP Map */}
      <section className="hud-panel p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-[var(--accent-primary)]" />
          <h2 className="font-display text-base font-bold text-[var(--text-primary)]">
            {t('learn.osiMap')}
          </h2>
        </div>

        <div className="grid gap-4 md:grid-cols-[260px_1fr]">
          <div className="space-y-1.5">
            {OSI_EXPLORER.map((item) => (
              <button
                key={item.layer}
                type="button"
                onClick={() => setSelectedOsi(item.layer)}
                className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-xs transition-colors ${
                  selectedOsi === item.layer
                    ? 'border-[var(--accent-primary)] bg-[var(--accent-primary-soft)] text-[var(--text-primary)] font-semibold'
                    : 'border-[var(--border-hairline)] bg-[var(--bg-inset)] text-[var(--text-secondary)]'
                }`}
              >
                <span>
                  L{item.layer} {tc(item.name)}
                </span>
                <span className="font-mono text-[11px] text-[var(--text-muted)]">{item.tcpip}</span>
              </button>
            ))}
          </div>

          <div className="rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-inset)] p-4 space-y-3">
            <div className="text-sm font-bold text-[var(--text-primary)]">
              {tc('Layer')} {selectedOsi}: {tc(OSI_EXPLORER.find((o) => o.layer === selectedOsi)?.name ?? '')}
            </div>
            <p className="text-xs text-[var(--text-secondary)]">
              {tc(OSI_EXPLORER.find((o) => o.layer === selectedOsi)?.role ?? '')}
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              {layerProtocols.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => selectProtocol(p.id, 0)}
                  className="rounded-lg border border-[var(--accent-primary)]/40 bg-[var(--accent-primary-soft)] px-3 py-1.5 font-mono text-xs font-semibold text-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/20 transition-colors"
                >
                  {p.name} →
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Searchable Glossary & Cheat Sheets */}
      <div className="grid gap-5 lg:grid-cols-2">
        <section className="hud-panel p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-display text-base font-bold text-[var(--text-primary)]">
              {t('learn.glossary')}
            </h2>
            <div className="relative w-48">
              <Search className="w-3.5 h-3.5 text-[var(--text-muted)] absolute start-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="search"
                value={glossaryQ}
                onChange={(e) => setGlossaryQ(e.target.value)}
                placeholder={`${t('common.search')}...`}
                className="w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-inset)] py-1 ps-7 pe-2 text-xs text-[var(--text-primary)]"
              />
            </div>
          </div>
          <div className="max-h-72 overflow-y-auto divide-y divide-[var(--border-hairline)]">
            {filteredGlossary.map((g) => (
              <div key={g.term} className="py-2 text-xs">
                <div className="font-mono font-bold text-[var(--accent-primary)]">{g.term}</div>
                <div className="mt-0.5 text-[var(--text-secondary)]">{tc(g.def)}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="hud-panel p-4 space-y-3">
          <h2 className="font-display text-base font-bold text-[var(--text-primary)]">
            {t('learn.cheatSheets')}
          </h2>
          <div className="space-y-3 font-mono text-xs">
            <div className="rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-inset)] p-3">
              <div className="font-bold text-[var(--accent-teal)] mb-1">{tc('HTTP Status Classes')}</div>
              <div className="text-[var(--text-secondary)]">
                {tc('1xx Info (101 Switching) · 2xx OK (200, 201, 204) · 3xx Redirect (301, 304) · 4xx Client (400, 401, 403, 404) · 5xx Server (500, 502, 503)')}
              </div>
            </div>
            <div className="rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-inset)] p-3">
              <div className="font-bold text-purple-700 dark:text-purple-300 mb-1">{tc('DNS Record Types')}</div>
              <div className="text-[var(--text-secondary)]">
                {tc('A (IPv4) · AAAA (IPv6) · CNAME (Alias) · MX (Mail) · NS (Authority) · TXT (SPF/DKIM) · DS/RRSIG (DNSSEC)')}
              </div>
            </div>
            <div className="rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-inset)] p-3">
              <div className="font-bold text-pink-700 dark:text-pink-300 mb-1">{tc('ICMP Type Reference')}</div>
              <div className="text-[var(--text-secondary)]">
                {tc('0 Echo Reply · 3 Dest Unreachable (Code 4: Frag Needed) · 8 Echo Request · 11 Time Exceeded (TTL=0)')}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
