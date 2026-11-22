import React, { useEffect, useRef, useState } from 'react';
import { Terminal } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { SimDevice } from '../../engine/types';
import { tc } from '../../i18n/content';

interface TerminalLine {
  id: string;
  kind: 'cmd' | 'out';
  text: string;
}

interface TerminalEmulatorProps {
  devices: SimDevice[];
  activeDeviceId: string | null;
  onSelectDevice: (id: string) => void;
  onExecute: (deviceId: string, command: string) => string;
  /** Current prompt, e.g. `Router(config-if)#` (changes as the CLI moves between modes). */
  getPrompt?: (deviceId: string) => string;
  /** True for routers/switches/firewalls, which speak the IOS-style CLI. */
  isIos?: (deviceId: string) => boolean;
  /** Tab completion; returns the completed line or null. */
  onComplete?: (deviceId: string, line: string) => string | null;
  externalLogTrigger?: { deviceId: string; cmd: string; output: string } | null;
}

const IOS_QUICK_CMDS = [
  'enable',
  'configure terminal',
  'show ip interface brief',
  'show running-config',
  'show ip route',
  'show vlan brief',
  'show cdp neighbors',
  '?',
];

const QUICK_CMDS = [
  'help',
  'ipconfig',
  'ping 203.0.113.10 -c 2',
  'traceroute 203.0.113.10',
  'nslookup example.com',
  'curl http://203.0.113.10 -v',
  'arp -a',
  'show ip route',
  'nmap 203.0.113.10',
];

export const TerminalEmulator: React.FC<TerminalEmulatorProps> = ({
  devices,
  activeDeviceId,
  onSelectDevice,
  onExecute,
  getPrompt,
  isIos,
  onComplete,
  externalLogTrigger,
}) => {
  const { t } = useTranslation();
  const targetDevice = devices.find((d) => d.id === activeDeviceId) ?? devices[0] ?? null;
  const ios = targetDevice ? Boolean(isIos?.(targetDevice.id)) : false;
  const prompt = targetDevice ? getPrompt?.(targetDevice.id) ?? `${targetDevice.name}$` : 'host$';
  const quick = ios ? IOS_QUICK_CMDS : QUICK_CMDS;
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [histIdx, setHistIdx] = useState(-1);
  const [lines, setLines] = useState<TerminalLine[]>([
    {
      id: 'welcome',
      kind: 'out',
      text: t('simulator.cliReady'),
    },
  ]);

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (externalLogTrigger) {
      setLines((prev) => [
        ...prev,
        { id: `ec-${Date.now()}`, kind: 'cmd', text: `${externalLogTrigger.deviceId}$ ${externalLogTrigger.cmd}` },
        { id: `eo-${Date.now()}`, kind: 'out', text: externalLogTrigger.output },
      ]);
    }
  }, [externalLogTrigger]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [lines]);

  const runCmd = (raw: string) => {
    const cmd = raw.trim();
    if (!cmd || !targetDevice) return;
    if (cmd.toLowerCase() === 'clear') {
      setLines([]);
      setInput('');
      return;
    }
    const shownPrompt = prompt;
    const output = onExecute(targetDevice.id, cmd);
    setLines((prev) => [
      ...prev,
      { id: `c-${Date.now()}-${Math.random()}`, kind: 'cmd', text: `${shownPrompt} ${cmd}` },
      ...(output ? [{ id: `o-${Date.now()}-${Math.random()}`, kind: 'out' as const, text: output }] : []),
    ]);
    setHistory((prev) => [cmd, ...prev.slice(0, 30)]);
    setHistIdx(-1);
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      const next = Math.min(history.length - 1, histIdx + 1);
      if (history[next]) {
        setHistIdx(next);
        setInput(history[next]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = histIdx - 1;
      if (next < 0) {
        setHistIdx(-1);
        setInput('');
      } else if (history[next]) {
        setHistIdx(next);
        setInput(history[next]);
      }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      if (ios && targetDevice) {
        const done = onComplete?.(targetDevice.id, input);
        if (done) setInput(done);
        return;
      }
      const cmds = ['ping ', 'traceroute ', 'nslookup ', 'curl ', 'ipconfig', 'arp -a', 'netstat -an', 'nmap ', 'tcpdump', 'show ip route', 'show mac', 'show running-config'];
      const match = cmds.find((c) => c.startsWith(input.trim().toLowerCase()));
      if (match) setInput(match);
    }
  };

  return (
    <section
      aria-label={tc('Device CLI Terminal')}
      className="flex h-full min-h-0 flex-col bg-[var(--terminal-bg)] text-[var(--terminal-text)] overflow-hidden"
    >
      {/* Terminal Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--terminal-border)] bg-[var(--terminal-header)] px-3 py-2">
        <div className="flex items-center gap-2 text-xs font-mono font-semibold text-[var(--accent-primary)]">
          <Terminal className="w-4 h-4" />
          <span>{t('simulator.deviceCliTitle')}</span>
        </div>
        <select
          aria-label={tc('Target CLI device')}
          value={targetDevice?.id ?? ''}
          onChange={(e) => onSelectDevice(e.target.value)}
          className="rounded border border-[var(--terminal-border)] bg-[var(--bg-surface)] px-2.5 py-1 font-mono text-xs text-[var(--text-primary)]"
        >
          {devices.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name} ({d.interfaces[0]?.ip || 'unassigned'})
            </option>
          ))}
        </select>
      </div>

      {/* Quick Command Chips */}
      <div className="flex flex-wrap gap-1.5 border-b border-[var(--terminal-border)] bg-[var(--bg-inset)] px-3 py-1.5">
        {quick.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => runCmd(q)}
            className="rounded border border-[var(--terminal-border)] bg-[var(--bg-surface)] px-2 py-0.5 font-mono text-[11px] font-medium text-[var(--accent-primary)] hover:border-[var(--accent-primary)] hover:bg-[var(--accent-primary-soft)] transition-colors"
          >
            {q}
          </button>
        ))}
      </div>

      {/* Output Log */}
      <div ref={scrollRef} className="h-56 overflow-y-auto p-3 font-mono text-xs leading-relaxed space-y-1.5">
        {lines.map((line) => (
          <pre
            key={line.id}
            className={`whitespace-pre-wrap break-words ${
              line.kind === 'cmd' ? 'text-[var(--terminal-cmd)] font-semibold' : 'text-[var(--terminal-text)]'
            }`}
          >
            {line.text}
          </pre>
        ))}
      </div>

      {/* Command Input Prompt */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          runCmd(input);
        }}
        className="flex items-center gap-2 border-t border-[var(--terminal-border)] bg-[var(--terminal-header)] px-3 py-2 font-mono text-xs"
      >
        <span className="text-[var(--accent-primary)] font-bold shrink-0">{prompt}</span>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t('simulator.cliPlaceholder')}
          aria-label={tc('CLI command input')}
          className="flex-1 bg-transparent text-[var(--terminal-text)] placeholder:text-[var(--terminal-muted)] focus:outline-none"
        />
      </form>
    </section>
  );
};
