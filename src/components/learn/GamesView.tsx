import React, { useState } from 'react';
import { ArrowDown, ArrowUp, CheckCircle2, RotateCcw, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface OrderChallenge {
  id: string;
  title: string;
  correctOrder: string[];
}

const ORDER_CHALLENGES: OrderChallenge[] = [
  {
    id: 'tcp-handshake',
    title: 'TCP 3-Way Handshake & HTTP GET',
    correctOrder: ['SYN (seq=100)', 'SYN-ACK (seq=500, ack=101)', 'ACK (ack=501)', 'GET / HTTP/1.1', 'HTTP/1.1 200 OK'],
  },
  {
    id: 'dhcp-dora',
    title: 'DHCP DORA IP Assignment',
    correctOrder: ['DHCP Discover (Broadcast)', 'DHCP Offer (192.168.1.50)', 'DHCP Request', 'DHCP Acknowledge (ACK)'],
  },
  {
    id: 'tls-13',
    title: 'TLS 1.3 1-RTT Handshake',
    correctOrder: [
      'ClientHello (KeyShare + SNI)',
      'ServerHello + EncryptedExtensions + Certificate + Finished',
      'Client Finished',
      'Encrypted Application Data',
    ],
  },
  {
    id: 'wpa2-4way',
    title: 'WPA2 4-Way Key Handshake',
    correctOrder: [
      'Message 1/4: AP sends ANonce',
      'Message 2/4: Client sends SNonce + MIC',
      'Message 3/4: AP sends GTK + Install PTK',
      'Message 4/4: Client confirms PTK active',
    ],
  },
];

const PORT_PAIRS = [
  { port: '21', service: 'FTP (Control)' },
  { port: '22', service: 'SSH' },
  { port: '25', service: 'SMTP' },
  { port: '53', service: 'DNS' },
  { port: '80', service: 'HTTP' },
  { port: '110', service: 'POP3' },
  { port: '123', service: 'NTP' },
  { port: '143', service: 'IMAP' },
  { port: '443', service: 'HTTPS / DoH / QUIC' },
  { port: '445', service: 'SMB' },
  { port: '502', service: 'Modbus TCP' },
  { port: '554', service: 'RTSP' },
  { port: '1812', service: 'RADIUS' },
  { port: '51820', service: 'WireGuard' },
];

function scramble<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = (i * 7 + 3) % (i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export const GamesView: React.FC = () => {
  const { t } = useTranslation();
  const [challengeIdx, setChallengeIdx] = useState(0);
  const challenge = ORDER_CHALLENGES[challengeIdx];
  const [items, setItems] = useState<string[]>(() => scramble(challenge.correctOrder));
  const [checkedOrder, setCheckedOrder] = useState(false);

  const [selectedPort, setSelectedPort] = useState<string | null>(null);
  const [matchedPorts, setMatchedPorts] = useState<string[]>([]);
  const [wrongMatch, setWrongMatch] = useState<string | null>(null);

  const selectChallenge = (idx: number) => {
    setChallengeIdx(idx);
    setItems(scramble(ORDER_CHALLENGES[idx].correctOrder));
    setCheckedOrder(false);
  };

  const moveItem = (idx: number, delta: -1 | 1) => {
    const nextIdx = idx + delta;
    if (nextIdx < 0 || nextIdx >= items.length) return;
    const copy = [...items];
    [copy[idx], copy[nextIdx]] = [copy[nextIdx], copy[idx]];
    setItems(copy);
    setCheckedOrder(false);
  };

  const allOrderCorrect = items.every((item, idx) => item === challenge.correctOrder[idx]);

  const handleServicePick = (service: string) => {
    if (!selectedPort) return;
    const pair = PORT_PAIRS.find((p) => p.port === selectedPort);
    if (pair && pair.service === service) {
      setMatchedPorts((prev) => [...prev, selectedPort]);
      setSelectedPort(null);
      setWrongMatch(null);
    } else {
      setWrongMatch(service);
      setTimeout(() => setWrongMatch(null), 900);
    }
  };

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      {/* Order the Packets Game */}
      <section className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-lg font-bold text-[var(--text-primary)]">
              {t('learn.orderGame')}
            </h2>
            <p className="mt-0.5 text-[13px] text-[var(--text-secondary)]">
              Arrange the protocol messages into chronological wire order.
            </p>
          </div>
          <select
            aria-label="Choose packet ordering challenge"
            value={challengeIdx}
            onChange={(e) => selectChallenge(Number(e.target.value))}
            className="h-9 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-inset)] px-3 text-[13px] font-medium text-[var(--text-primary)]"
          >
            {ORDER_CHALLENGES.map((c, idx) => (
              <option key={c.id} value={idx}>
                {c.title}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          {items.map((item, idx) => {
            const isCorrectPos = checkedOrder && item === challenge.correctOrder[idx];
            const isWrongPos = checkedOrder && item !== challenge.correctOrder[idx];
            return (
              <div
                key={item}
                className={`flex items-center justify-between gap-2 rounded-lg border px-3.5 py-2.5 text-[13px] font-mono ${
                  isCorrectPos
                    ? 'border-[var(--tone-success)] bg-[var(--tone-success)]/12 text-[var(--tone-success)] font-semibold'
                    : isWrongPos
                    ? 'border-[var(--tone-danger)] bg-[var(--tone-danger)]/12 text-[var(--tone-danger)]'
                    : 'border-[var(--border-hairline)] bg-[var(--bg-inset)] text-[var(--text-primary)]'
                }`}
              >
                <span>
                  <strong className="text-[var(--accent-primary)] me-2">#{idx + 1}</strong>
                  {item}
                </span>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => moveItem(idx, -1)}
                    disabled={idx === 0}
                    aria-label="Move up"
                    className="rounded-md border border-[var(--border-hairline)] p-1.5 hover:text-[var(--accent-primary)] disabled:opacity-30"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveItem(idx, 1)}
                    disabled={idx === items.length - 1}
                    aria-label="Move down"
                    className="rounded-md border border-[var(--border-hairline)] p-1.5 hover:text-[var(--accent-primary)] disabled:opacity-30"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => selectChallenge(challengeIdx)}
            className="flex h-9 items-center gap-1.5 rounded-lg border border-[var(--border-hairline)] px-3 text-[13px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Reshuffle
          </button>
          <button
            type="button"
            onClick={() => setCheckedOrder(true)}
            className="flex h-9 items-center gap-1.5 rounded-lg bg-[var(--accent-cta)] px-4 text-[13px] font-semibold text-white hover:bg-[var(--accent-cta-hover)] transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5" /> Check Sequence
          </button>
        </div>

        {checkedOrder && (
          <div
            className={`rounded-lg border px-3.5 py-2.5 text-[13px] font-semibold ${
              allOrderCorrect
                ? 'border-[var(--tone-success)]/50 bg-[var(--tone-success)]/12 text-[var(--tone-success)]'
                : 'border-[var(--tone-warning)]/50 bg-[var(--tone-warning)]/12 text-[var(--tone-warning)]'
            }`}
          >
            {allOrderCorrect
              ? 'Perfect sequence! Every packet is in exact wire order.'
              : 'Some frames are out of order — adjust the highlighted rows.'}
          </div>
        )}
      </section>

      {/* Match the Port Game */}
      <section className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-lg font-bold text-[var(--text-primary)]">
              {t('learn.portGame')} ({matchedPorts.length}/{PORT_PAIRS.length})
            </h2>
            <p className="mt-0.5 text-[13px] text-[var(--text-secondary)]">
              Click a port number on the left, then click its protocol on the right.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setMatchedPorts([]);
              setSelectedPort(null);
            }}
            className="flex h-9 items-center gap-1.5 rounded-lg border border-[var(--border-hairline)] px-3 text-[13px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          >
            <RotateCcw className="w-3.5 h-3.5" /> {t('playback.reset')}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 text-[13px]">
          <div className="space-y-1.5 max-h-80 overflow-y-auto">
            {PORT_PAIRS.map((p) => {
              const matched = matchedPorts.includes(p.port);
              const active = selectedPort === p.port;
              return (
                <button
                  key={p.port}
                  type="button"
                  disabled={matched}
                  onClick={() => setSelectedPort(p.port)}
                  className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 font-mono transition-colors ${
                    matched
                      ? 'border-[var(--tone-success)]/40 bg-[var(--tone-success)]/10 text-[var(--tone-success)] opacity-75'
                      : active
                      ? 'border-[var(--accent-primary)] bg-[var(--accent-primary-soft)] text-[var(--accent-primary)] font-bold'
                      : 'border-[var(--border-hairline)] bg-[var(--bg-inset)] text-[var(--text-primary)] hover:border-[var(--accent-primary)]/50'
                  }`}
                >
                  <span>Port {p.port}</span>
                  {matched && <CheckCircle2 className="w-4 h-4" />}
                </button>
              );
            })}
          </div>

          <div className="space-y-1.5 max-h-80 overflow-y-auto">
            {scramble(PORT_PAIRS).map((p) => {
              const matched = matchedPorts.includes(p.port);
              const isWrong = wrongMatch === p.service;
              return (
                <button
                  key={p.service}
                  type="button"
                  disabled={matched || !selectedPort}
                  onClick={() => handleServicePick(p.service)}
                  className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-start transition-colors ${
                    matched
                      ? 'border-[var(--tone-success)]/40 bg-[var(--tone-success)]/10 text-[var(--tone-success)] opacity-75'
                      : isWrong
                      ? 'border-[var(--tone-danger)] bg-[var(--tone-danger)]/15 text-[var(--tone-danger)]'
                      : 'border-[var(--border-hairline)] bg-[var(--bg-inset)] text-[var(--text-primary)] hover:border-[var(--accent-primary)]/50 disabled:opacity-60'
                  }`}
                >
                  <span className="truncate">{p.service}</span>
                </button>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
};
