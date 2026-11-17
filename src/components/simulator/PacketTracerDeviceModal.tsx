import React, { useEffect, useRef, useState } from 'react';
import {
  Activity,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronRight,
  Cpu,
  Edit3,
  ExternalLink,
  Flame,
  Globe,
  HardDrive,
  Laptop,
  Layers,
  Lock,
  Maximize2,
  Minimize2,
  Network,
  Plus,
  Power,
  Radio,
  RefreshCw,
  RotateCcw,
  Router,
  Save,
  Send,
  Server,
  Settings2,
  Shield,
  Sliders,
  Terminal,
  Trash2,
  Wifi,
  X,
  XCircle,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { SimulationEngine } from '../../engine/simulator';
import type { DeviceRole, SimDevice, SimLink } from '../../engine/types';

interface PacketTracerDeviceModalProps {
  device: SimDevice;
  engine: SimulationEngine;
  links: SimLink[];
  onUpdateDevice: (updated: SimDevice) => void;
  onClose: () => void;
}

export const PacketTracerDeviceModal: React.FC<PacketTracerDeviceModalProps> = ({
  device,
  engine,
  links,
  onUpdateDevice,
  onClose,
}) => {
  const { t } = useTranslation();
  const isCisco =
    device.role === 'router' ||
    device.role === 'switch' ||
    device.role === 'firewall' ||
    device.role === 'nat_gateway';
  const isServer = device.role.includes('server');
  const isHost = !isCisco && !isServer;

  // Tabs: 'physical' | 'config' | 'cli' | 'desktop' | 'services'
  const [activeTab, setActiveTab] = useState<'physical' | 'config' | 'cli' | 'desktop' | 'services'>(
    isCisco ? 'cli' : isHost ? 'desktop' : 'services'
  );

  // Desktop Sub-App for PCs
  const [desktopApp, setDesktopApp] = useState<'menu' | 'ipconfig' | 'cmd' | 'browser' | 'traffic'>('menu');

  // Config tab state
  const [selectedIfaceIdx, setSelectedIfaceIdx] = useState(0);

  // Browser state
  const [browserUrl, setBrowserUrl] = useState('http://192.168.1.100');
  const [browserOutput, setBrowserOutput] = useState<{ status: number; html: string } | null>(null);
  const [browserLoading, setBrowserLoading] = useState(false);

  // CLI state
  const [cliInput, setCliInput] = useState('');
  const [cliLines, setCliLines] = useState<Array<{ id: string; prompt: string; cmd: string; out: string }>>([
    {
      id: 'init-line',
      prompt: '',
      cmd: '',
      out: isCisco
        ? `Cisco IOS Software, C2900 Software (C2900-UNIVERSALK9-M)\nPress RETURN to get started!`
        : `Microsoft Windows [Version 10.0.19045]\n(c) NetPulse Network Simulation Environment. All rights reserved.`,
    },
  ]);
  const cliScrollRef = useRef<HTMLDivElement>(null);

  // Static Route Add Form
  const [routeNet, setRouteNet] = useState('');
  const [routeMask, setRouteMask] = useState('255.255.255.0');
  const [routeHop, setRouteHop] = useState('');

  // DNS Record Add Form
  const [dnsName, setDnsName] = useState('');
  const [dnsIp, setDnsIp] = useState('');

  // DHCP status message
  const [dhcpMsg, setDhcpMsg] = useState<string | null>(null);

  useEffect(() => {
    if (cliScrollRef.current) {
      cliScrollRef.current.scrollTop = cliScrollRef.current.scrollHeight;
    }
  }, [cliLines]);

  const currentIface = device.interfaces[selectedIfaceIdx] || device.interfaces[0];

  const updateIface = (idx: number, patch: Partial<SimDevice['interfaces'][0]>) => {
    const next = device.interfaces.map((inf, i) => (i === idx ? { ...inf, ...patch } : inf));
    const updated = { ...device, interfaces: next };
    onUpdateDevice(updated);
  };

  const handleDhcpRequest = (idx: number) => {
    setDhcpMsg('Requesting IP lease via DHCP (DORA)...');
    setTimeout(() => {
      const iface = device.interfaces[idx];
      const res = engine.requestDhcp(device.id, iface?.name);
      setDhcpMsg(res.message);
      // Refresh device state from engine
      const updated = engine.devices.get(device.id);
      if (updated) onUpdateDevice(structuredClone(updated));
    }, 200);
  };

  const handleCliSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cmd = cliInput.trim();
    if (!cmd) return;

    if (cmd.toLowerCase() === 'clear' || cmd.toLowerCase() === 'cls') {
      setCliLines([]);
      setCliInput('');
      return;
    }

    const currentPrompt = engine.getCiscoPrompt(device.id);
    const out = engine.execCommand(device.id, cmd);

    setCliLines((prev) => [
      ...prev,
      { id: `cli-${Date.now()}-${Math.random()}`, prompt: currentPrompt, cmd, out },
    ]);
    setCliInput('');

    // Sync updated device config (e.g. if hostname, ip, or no shut changed)
    const updated = engine.devices.get(device.id);
    if (updated) onUpdateDevice(structuredClone(updated));
  };

  const handleBrowserGo = () => {
    setBrowserLoading(true);
    setBrowserOutput(null);
    setTimeout(() => {
      const out = engine.execCommand(device.id, `curl ${browserUrl} -v`);
      let html = '<html><body><h1>Connection Failed</h1><p>Could not connect to host.</p></body></html>';
      let status = 404;

      if (!out.includes('Could not resolve host') && !out.includes('Failed to connect') && !out.includes('Recv failure')) {
        status = 200;
        // Search host
        const cleanHost = browserUrl.replace(/^https?:\/\//, '').split('/')[0].split(':')[0];
        const srv = Array.from(engine.devices.values()).find(
          (d) => d.interfaces.some((i) => i.ip === cleanHost) || d.name.toLowerCase() === cleanHost.toLowerCase()
        );
        html = srv?.services?.http?.body || `<div style="font-family:sans-serif;padding:20px;"><h1>Welcome to ${cleanHost}</h1><p>Served via NetPulse HTTP 1.1 Web Server</p><hr/><p>Status: 200 OK</p></div>`;
      }
      setBrowserOutput({ status, html });
      setBrowserLoading(false);
    }, 250);
  };

  const connectedLinks = links.filter(
    (l) => l.sourceId === device.id || l.targetId === device.id
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${device.name} Cisco Packet Tracer Configuration Dialog`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-sm p-3 sm:p-6 animate-in fade-in"
    >
      <div className="flex h-[88vh] w-full max-w-4xl flex-col rounded-2xl border border-[var(--border-strong)] bg-[var(--bg-surface)] shadow-2xl overflow-hidden">
        {/* Packet Tracer Title Bar */}
        <div className="shrink-0 flex items-center justify-between border-b border-[var(--border-hairline)] bg-[var(--bg-inset)] px-4 py-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-lg border font-mono text-xs font-bold ${
                device.poweredOn
                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                  : 'border-slate-400 bg-slate-200 dark:bg-slate-800 text-slate-400'
              }`}
            >
              {isCisco ? <Router className="w-4 h-4" /> : isServer ? <Server className="w-4 h-4" /> : <Laptop className="w-4 h-4" />}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="font-display font-bold text-sm text-[var(--text-primary)] truncate">
                  {device.name}
                </h2>
                <span className="font-mono text-[11px] rounded bg-[var(--bg-surface)] px-1.5 py-0.5 border border-[var(--border-hairline)] text-[var(--text-secondary)]">
                  {isCisco ? 'Cisco IOS' : isServer ? 'Multi-Service Host' : 'Desktop Host'}
                </span>
              </div>
              <p className="text-[11px] text-[var(--text-muted)] truncate">
                Role: {device.role.replace('_', ' ').toUpperCase()} · Ports: {device.interfaces.length}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Direct Hardware Power Toggle */}
            <button
              type="button"
              onClick={() => {
                const updated = { ...device, poweredOn: !device.poweredOn };
                engine.devices.set(device.id, updated);
                onUpdateDevice(updated);
              }}
              title="Toggle Power"
              className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold transition-all ${
                device.poweredOn
                  ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                  : 'border-slate-300 dark:border-slate-700 bg-[var(--bg-surface)] text-[var(--text-muted)]'
              }`}
            >
              <Power className={`w-3.5 h-3.5 ${device.poweredOn ? 'text-emerald-500' : 'text-slate-400'}`} />
              <span>{device.poweredOn ? 'POWER ON' : 'POWER OFF'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close dialog"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border-hairline)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-inset)]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Cisco Packet Tracer Dialog Tabs Bar */}
        <div className="shrink-0 flex items-center border-b border-[var(--border-hairline)] bg-[var(--bg-surface)] px-3 pt-2 gap-1 overflow-x-auto">
          {[
            { id: 'physical', label: 'Physical', icon: Layers },
            { id: 'config', label: 'Config', icon: Settings2 },
            ...(isCisco ? [{ id: 'cli', label: 'CLI', icon: Terminal }] : []),
            ...(isHost || isServer ? [{ id: 'desktop', label: 'Desktop', icon: Laptop }] : []),
            ...(isServer ? [{ id: 'services', label: 'Services', icon: Globe }] : []),
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`flex items-center gap-1.5 rounded-t-lg border-t border-s border-e px-4 py-2 text-xs font-bold transition-colors whitespace-nowrap ${
                  active
                    ? 'border-[var(--accent-primary)] bg-[var(--bg-inset)] text-[var(--accent-primary)] shadow-xs -mb-[1px]'
                    : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-inset)]/40'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Modal Tab Viewport */}
        <div className="flex-1 min-h-0 overflow-y-auto bg-[var(--bg-inset)]/30 p-4">
          {/* TAB 1: PHYSICAL CHASSIS VIEW */}
          {activeTab === 'physical' && (
            <div className="space-y-4 max-w-2xl mx-auto">
              <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5 space-y-4 shadow-xs">
                <div className="flex items-center justify-between border-b border-[var(--border-hairline)] pb-3">
                  <div>
                    <h3 className="font-display font-bold text-sm text-[var(--text-primary)]">
                      Chassis Physical View
                    </h3>
                    <p className="text-xs text-[var(--text-secondary)]">
                      Front-panel modular ports & hardware power interface
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-[var(--text-muted)]">Power Switch:</span>
                    <button
                      type="button"
                      onClick={() => {
                        const updated = { ...device, poweredOn: !device.poweredOn };
                        engine.devices.set(device.id, updated);
                        onUpdateDevice(updated);
                      }}
                      className={`h-6 w-12 rounded-full p-0.5 transition-colors ${
                        device.poweredOn ? 'bg-emerald-500' : 'bg-slate-400'
                      }`}
                    >
                      <div
                        className={`h-5 w-5 rounded-full bg-white transition-transform ${
                          device.poweredOn ? 'translate-x-6' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                </div>

                {/* Simulated Front-Panel Chassis Bay */}
                <div className="rounded-xl border-2 border-slate-700 bg-slate-900 p-4 text-white shadow-inner space-y-3">
                  <div className="flex items-center justify-between font-mono text-[11px] text-slate-400">
                    <span>CISCO 2900 SERIES INTEGRATED SERVICES CHASSIS</span>
                    <span className="flex items-center gap-1.5">
                      <span className={`h-2 w-2 rounded-full ${device.poweredOn ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'bg-rose-500'}`} />
                      <span>{device.poweredOn ? 'PWR OK' : 'NO POWER'}</span>
                    </span>
                  </div>

                  {/* RJ45 Ports Matrix */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
                    {device.interfaces.map((inf) => {
                      const link = connectedLinks.find(
                        (l) => l.sourceIface === inf.name || l.targetIface === inf.name
                      );
                      const isUp = inf.up && link?.up;

                      return (
                        <div
                          key={inf.id}
                          className="rounded-lg border border-slate-700 bg-slate-800/90 p-2 text-center space-y-1.5"
                        >
                          <div className="flex items-center justify-center gap-1.5">
                            <span
                              className={`h-2 w-2 rounded-full ${
                                !device.poweredOn
                                  ? 'bg-slate-600'
                                  : isUp
                                  ? 'bg-emerald-400 shadow-[0_0_6px_#34d399]'
                                  : 'bg-amber-500/80'
                              }`}
                            />
                            <span className="font-mono text-[10px] text-slate-300 font-bold">
                              {inf.name}
                            </span>
                          </div>
                          {/* RJ-45 Socket Graphic */}
                          <div className="mx-auto h-5 w-7 rounded border border-slate-600 bg-slate-950 flex items-center justify-center">
                            <div className="h-2 w-4 bg-slate-700 rounded-xs" />
                          </div>
                          <div className="font-mono text-[9px] text-slate-400 truncate">
                            {inf.ip || 'no ip'}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="text-xs text-[var(--text-secondary)] leading-relaxed">
                  Tip: Toggle device power or connect cables directly in the simulation canvas. Port status LEDs reflect link carrier detection and line protocol readiness.
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: CONFIGURATION VIEW */}
          {activeTab === 'config' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Left Config Navigation Menu */}
              <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-2 space-y-1">
                <div className="px-2 py-1 text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
                  GLOBAL
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedIfaceIdx(-1)}
                  className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-start transition-colors ${
                    selectedIfaceIdx === -1
                      ? 'bg-[var(--accent-primary-soft)] text-[var(--accent-primary)]'
                      : 'text-[var(--text-secondary)] hover:bg-[var(--bg-inset)]'
                  }`}
                >
                  <Settings2 className="w-3.5 h-3.5" />
                  <span>Settings & Routing</span>
                </button>

                <div className="mt-2 px-2 py-1 text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
                  INTERFACES
                </div>
                {device.interfaces.map((inf, idx) => (
                  <button
                    key={inf.id}
                    type="button"
                    onClick={() => setSelectedIfaceIdx(idx)}
                    className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-semibold text-start transition-colors ${
                      selectedIfaceIdx === idx
                        ? 'bg-[var(--accent-primary-soft)] text-[var(--accent-primary)]'
                        : 'text-[var(--text-secondary)] hover:bg-[var(--bg-inset)]'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <Network className="w-3.5 h-3.5" />
                      <span>{inf.name}</span>
                    </div>
                    <span className={`h-1.5 w-1.5 rounded-full ${inf.up ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                  </button>
                ))}
              </div>

              {/* Right Configuration Inspector */}
              <div className="md:col-span-2 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-4 space-y-4">
                {selectedIfaceIdx === -1 ? (
                  /* Global Settings */
                  <div className="space-y-4">
                    <h3 className="font-display font-bold text-sm text-[var(--text-primary)]">
                      Global Settings & Routing
                    </h3>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <label className="space-y-1">
                        <span className="font-medium text-[var(--text-secondary)]">Display Name</span>
                        <input
                          type="text"
                          value={device.name}
                          onChange={(e) => onUpdateDevice({ ...device, name: e.target.value })}
                          className="w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-inset)] px-2.5 py-1.5 font-mono text-xs text-[var(--text-primary)]"
                        />
                      </label>
                      <label className="space-y-1">
                        <span className="font-medium text-[var(--text-secondary)]">Gateway</span>
                        <input
                          type="text"
                          value={device.interfaces[0]?.gateway || ''}
                          onChange={(e) => updateIface(0, { gateway: e.target.value })}
                          placeholder="192.168.1.1"
                          className="w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-inset)] px-2.5 py-1.5 font-mono text-xs text-[var(--text-primary)]"
                        />
                      </label>
                      <label className="space-y-1">
                        <span className="font-medium text-[var(--text-secondary)]">DNS Server</span>
                        <input
                          type="text"
                          value={device.dnsServer || ''}
                          onChange={(e) => onUpdateDevice({ ...device, dnsServer: e.target.value })}
                          placeholder="8.8.8.8"
                          className="w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-inset)] px-2.5 py-1.5 font-mono text-xs text-[var(--text-primary)]"
                        />
                      </label>
                      <label className="space-y-1">
                        <span className="font-medium text-[var(--text-secondary)]">Routing Protocol</span>
                        <select
                          value={device.routingProtocol || 'none'}
                          onChange={(e) => onUpdateDevice({ ...device, routingProtocol: e.target.value as any })}
                          className="w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-inset)] px-2.5 py-1.5 font-mono text-xs text-[var(--text-primary)]"
                        >
                          <option value="none">Static Only</option>
                          <option value="rip">RIP</option>
                          <option value="ospf">OSPF</option>
                          <option value="bgp">BGP</option>
                        </select>
                      </label>
                    </div>

                    {/* Static Routing Table */}
                    <div className="pt-3 border-t border-[var(--border-hairline)] space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-[var(--text-primary)]">Static Routes</span>
                        <span className="text-[11px] text-[var(--text-muted)] font-mono">{device.routingTable.length} routes</span>
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <input
                          type="text"
                          placeholder="Network (e.g. 10.0.0.0)"
                          value={routeNet}
                          onChange={(e) => setRouteNet(e.target.value)}
                          className="rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-inset)] px-2 py-1 text-xs font-mono"
                        />
                        <input
                          type="text"
                          placeholder="Mask (e.g. 255.0.0.0)"
                          value={routeMask}
                          onChange={(e) => setRouteMask(e.target.value)}
                          className="rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-inset)] px-2 py-1 text-xs font-mono"
                        />
                        <div className="flex gap-1.5">
                          <input
                            type="text"
                            placeholder="Next Hop IP"
                            value={routeHop}
                            onChange={(e) => setRouteHop(e.target.value)}
                            className="flex-1 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-inset)] px-2 py-1 text-xs font-mono"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              if (routeNet && routeHop) {
                                const nextRt = [
                                  ...device.routingTable,
                                  {
                                    id: `rt-${Date.now()}`,
                                    network: routeNet,
                                    mask: routeMask,
                                    nextHop: routeHop,
                                    iface: device.interfaces[0]?.name || 'eth0',
                                    metric: 1,
                                    protocol: 'static' as const,
                                  },
                                ];
                                onUpdateDevice({ ...device, routingTable: nextRt });
                                setRouteNet('');
                                setRouteHop('');
                              }
                            }}
                            className="rounded-lg bg-[var(--accent-cta)] px-3 text-xs font-bold text-white hover:bg-[var(--accent-cta-hover)]"
                          >
                            Add
                          </button>
                        </div>
                      </div>

                      <div className="max-h-32 overflow-y-auto rounded-lg border border-[var(--border-hairline)] divide-y divide-[var(--border-hairline)] text-xs font-mono">
                        {device.routingTable.length === 0 ? (
                          <div className="p-2 text-center text-[var(--text-muted)]">No static routes configured</div>
                        ) : (
                          device.routingTable.map((rt, idx) => (
                            <div key={`${rt.network}-${rt.mask}-${idx}`} className="flex items-center justify-between p-2">
                              <span>{rt.network} / {rt.mask} via {rt.nextHop}</span>
                              <button
                                type="button"
                                onClick={() => {
                                  onUpdateDevice({
                                    ...device,
                                    routingTable: device.routingTable.filter((_, i) => i !== idx),
                                  });
                                }}
                                className="text-rose-500 hover:text-rose-700"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Interface Settings */
                  <div className="space-y-4">
                    <div className="flex items-center justify-between border-b border-[var(--border-hairline)] pb-2.5">
                      <div>
                        <h3 className="font-display font-bold text-sm text-[var(--text-primary)]">
                          {currentIface?.name} Interface
                        </h3>
                        <p className="text-xs text-[var(--text-secondary)]">MAC: {currentIface?.mac}</p>
                      </div>

                      <label className="flex items-center gap-2 text-xs font-bold text-[var(--text-primary)] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={currentIface?.up}
                          onChange={(e) => updateIface(selectedIfaceIdx, { up: e.target.checked })}
                          className="h-4 w-4 rounded accent-[var(--accent-primary)]"
                        />
                        <span>Port Status: {currentIface?.up ? 'ON' : 'OFF'}</span>
                      </label>
                    </div>

                    {/* IP Configuration (DHCP vs Static) */}
                    <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-inset)]/50 p-3 space-y-3">
                      <div className="flex items-center gap-4 text-xs font-bold text-[var(--text-primary)]">
                        <span>IP Configuration:</span>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="radio"
                            name={`ip-mode-${currentIface?.id}`}
                            checked={device.dhcpEnabled}
                            onChange={() => {
                              onUpdateDevice({ ...device, dhcpEnabled: true });
                              handleDhcpRequest(selectedIfaceIdx);
                            }}
                            className="accent-[var(--accent-primary)]"
                          />
                          <span>DHCP</span>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="radio"
                            name={`ip-mode-${currentIface?.id}`}
                            checked={!device.dhcpEnabled}
                            onChange={() => onUpdateDevice({ ...device, dhcpEnabled: false })}
                            className="accent-[var(--accent-primary)]"
                          />
                          <span>Static</span>
                        </label>
                      </div>

                      {dhcpMsg && (
                        <div className="rounded-md border border-[var(--accent-primary)]/30 bg-[var(--accent-primary-soft)] p-2 text-xs font-mono text-[var(--accent-primary)]">
                          {dhcpMsg}
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <label className="space-y-1">
                          <span className="font-medium text-[var(--text-secondary)]">IP Address</span>
                          <input
                            type="text"
                            value={currentIface?.ip || ''}
                            onChange={(e) => updateIface(selectedIfaceIdx, { ip: e.target.value })}
                            placeholder="192.168.1.10"
                            className="w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-2.5 py-1.5 font-mono text-xs text-[var(--text-primary)]"
                          />
                        </label>
                        <label className="space-y-1">
                          <span className="font-medium text-[var(--text-secondary)]">Subnet Mask</span>
                          <input
                            type="text"
                            value={currentIface?.mask || '255.255.255.0'}
                            onChange={(e) => updateIface(selectedIfaceIdx, { mask: e.target.value })}
                            placeholder="255.255.255.0"
                            className="w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-2.5 py-1.5 font-mono text-xs text-[var(--text-primary)]"
                          />
                        </label>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: CLI / IOS TERMINAL */}
          {activeTab === 'cli' && (
            <div className="flex h-full flex-col rounded-xl border border-slate-800 bg-slate-950 font-mono text-xs text-emerald-400 overflow-hidden shadow-inner">
              <div ref={cliScrollRef} className="flex-1 min-h-[340px] overflow-y-auto p-4 space-y-2">
                {cliLines.map((line) => (
                  <div key={line.id} className="space-y-0.5">
                    {line.cmd && (
                      <div className="text-white font-bold">
                        <span>{line.prompt} </span>
                        <span className="text-emerald-300">{line.cmd}</span>
                      </div>
                    )}
                    {line.out && (
                      <pre className="whitespace-pre-wrap text-slate-300 text-[11.5px] leading-relaxed">
                        {line.out}
                      </pre>
                    )}
                  </div>
                ))}
              </div>

              {/* IOS Prompt Line */}
              <form
                onSubmit={handleCliSubmit}
                className="flex items-center gap-2 border-t border-slate-800 bg-slate-900/90 px-3 py-2.5"
              >
                <span className="font-bold text-amber-400 shrink-0">
                  {engine.getCiscoPrompt(device.id)}
                </span>
                <input
                  type="text"
                  value={cliInput}
                  onChange={(e) => setCliInput(e.target.value)}
                  placeholder="Enter command (e.g. enable, conf t, int g0/0, ip address ...)"
                  className="flex-1 bg-transparent text-emerald-300 outline-none placeholder:text-slate-600 font-mono text-xs"
                />
              </form>
            </div>
          )}

          {/* TAB 4: DESKTOP APPS (FOR HOSTS & PCS) */}
          {activeTab === 'desktop' && (
            <div>
              {desktopApp === 'menu' && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4">
                  {/* App 1: IP Configuration */}
                  <button
                    type="button"
                    onClick={() => setDesktopApp('ipconfig')}
                    className="flex flex-col items-center justify-center gap-2.5 rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5 text-center hover:border-[var(--accent-primary)] hover:shadow-lg transition-all"
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/15 text-blue-500">
                      <Network className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="font-display font-bold text-xs text-[var(--text-primary)]">IP Configuration</div>
                      <div className="text-[10px] text-[var(--text-muted)]">DHCP / Static IP Setup</div>
                    </div>
                  </button>

                  {/* App 2: Command Prompt */}
                  <button
                    type="button"
                    onClick={() => setDesktopApp('cmd')}
                    className="flex flex-col items-center justify-center gap-2.5 rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5 text-center hover:border-[var(--accent-primary)] hover:shadow-lg transition-all"
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-900 text-emerald-400">
                      <Terminal className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="font-display font-bold text-xs text-[var(--text-primary)]">Command Prompt</div>
                      <div className="text-[10px] text-[var(--text-muted)]">ping, tracert, ipconfig</div>
                    </div>
                  </button>

                  {/* App 3: Web Browser */}
                  <button
                    type="button"
                    onClick={() => setDesktopApp('browser')}
                    className="flex flex-col items-center justify-center gap-2.5 rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5 text-center hover:border-[var(--accent-primary)] hover:shadow-lg transition-all"
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/15 text-amber-500">
                      <Globe className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="font-display font-bold text-xs text-[var(--text-primary)]">Web Browser</div>
                      <div className="text-[10px] text-[var(--text-muted)]">HTTP Web Page Viewer</div>
                    </div>
                  </button>

                  {/* App 4: Simple PDU Generator */}
                  <button
                    type="button"
                    onClick={() => setDesktopApp('traffic')}
                    className="flex flex-col items-center justify-center gap-2.5 rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5 text-center hover:border-[var(--accent-primary)] hover:shadow-lg transition-all"
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-500/15 text-purple-500">
                      <Send className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="font-display font-bold text-xs text-[var(--text-primary)]">Simple PDU</div>
                      <div className="text-[10px] text-[var(--text-muted)]">Test Traffic Generator</div>
                    </div>
                  </button>
                </div>
              )}

              {/* Sub-App: IP Configuration */}
              {desktopApp === 'ipconfig' && (
                <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5 space-y-4 max-w-xl mx-auto">
                  <div className="flex items-center justify-between border-b border-[var(--border-hairline)] pb-3">
                    <h3 className="font-display font-bold text-sm text-[var(--text-primary)]">
                      Desktop IP Configuration
                    </h3>
                    <button
                      type="button"
                      onClick={() => setDesktopApp('menu')}
                      className="text-xs text-[var(--accent-primary)] hover:underline font-semibold"
                    >
                      ← Back to Desktop
                    </button>
                  </div>

                  <div className="flex items-center gap-4 text-xs font-bold text-[var(--text-primary)]">
                    <span>IP Configuration:</span>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        checked={device.dhcpEnabled}
                        onChange={() => {
                          onUpdateDevice({ ...device, dhcpEnabled: true });
                          handleDhcpRequest(0);
                        }}
                        className="accent-[var(--accent-primary)]"
                      />
                      <span>DHCP</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        checked={!device.dhcpEnabled}
                        onChange={() => onUpdateDevice({ ...device, dhcpEnabled: false })}
                        className="accent-[var(--accent-primary)]"
                      />
                      <span>Static</span>
                    </label>
                  </div>

                  {dhcpMsg && (
                    <div className="rounded-lg border border-[var(--accent-primary)]/40 bg-[var(--accent-primary-soft)] p-2.5 text-xs font-mono text-[var(--accent-primary)]">
                      {dhcpMsg}
                    </div>
                  )}

                  <div className="space-y-3 text-xs">
                    <label className="space-y-1 block">
                      <span className="font-medium text-[var(--text-secondary)]">IP Address</span>
                      <input
                        type="text"
                        value={device.interfaces[0]?.ip || ''}
                        onChange={(e) => updateIface(0, { ip: e.target.value })}
                        className="w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-inset)] px-3 py-2 font-mono text-xs"
                      />
                    </label>
                    <label className="space-y-1 block">
                      <span className="font-medium text-[var(--text-secondary)]">Subnet Mask</span>
                      <input
                        type="text"
                        value={device.interfaces[0]?.mask || '255.255.255.0'}
                        onChange={(e) => updateIface(0, { mask: e.target.value })}
                        className="w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-inset)] px-3 py-2 font-mono text-xs"
                      />
                    </label>
                    <label className="space-y-1 block">
                      <span className="font-medium text-[var(--text-secondary)]">Default Gateway</span>
                      <input
                        type="text"
                        value={device.interfaces[0]?.gateway || ''}
                        onChange={(e) => updateIface(0, { gateway: e.target.value })}
                        className="w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-inset)] px-3 py-2 font-mono text-xs"
                      />
                    </label>
                    <label className="space-y-1 block">
                      <span className="font-medium text-[var(--text-secondary)]">DNS Server</span>
                      <input
                        type="text"
                        value={device.dnsServer || ''}
                        onChange={(e) => onUpdateDevice({ ...device, dnsServer: e.target.value })}
                        className="w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-inset)] px-3 py-2 font-mono text-xs"
                      />
                    </label>
                  </div>
                </div>
              )}

              {/* Sub-App: Command Prompt */}
              {desktopApp === 'cmd' && (
                <div className="flex h-[420px] flex-col rounded-xl border border-slate-800 bg-slate-950 font-mono text-xs text-slate-200 overflow-hidden">
                  <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900 px-3 py-1.5">
                    <span className="text-slate-400 font-bold">Command Prompt — {device.name}</span>
                    <button
                      type="button"
                      onClick={() => setDesktopApp('menu')}
                      className="text-xs text-blue-400 hover:underline"
                    >
                      Back to Desktop
                    </button>
                  </div>
                  <div ref={cliScrollRef} className="flex-1 min-h-0 overflow-y-auto p-4 space-y-2">
                    {cliLines.map((line) => (
                      <div key={line.id} className="space-y-0.5">
                        {line.cmd && (
                          <div className="text-white font-bold">
                            <span>C:\&gt; </span>
                            <span className="text-amber-300">{line.cmd}</span>
                          </div>
                        )}
                        {line.out && (
                          <pre className="whitespace-pre-wrap text-slate-300 text-[11.5px] leading-relaxed">
                            {line.out}
                          </pre>
                        )}
                      </div>
                    ))}
                  </div>
                  <form onSubmit={handleCliSubmit} className="flex items-center gap-2 border-t border-slate-800 bg-slate-900 px-3 py-2">
                    <span className="text-slate-400 font-bold shrink-0">C:\&gt;</span>
                    <input
                      type="text"
                      value={cliInput}
                      onChange={(e) => setCliInput(e.target.value)}
                      placeholder="ping, ipconfig /all, ipconfig /renew, tracert ..."
                      className="flex-1 bg-transparent text-white outline-none font-mono text-xs"
                    />
                  </form>
                </div>
              )}

              {/* Sub-App: Web Browser */}
              {desktopApp === 'browser' && (
                <div className="flex h-[420px] flex-col rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] overflow-hidden">
                  {/* Browser Toolbar */}
                  <div className="flex items-center gap-2 border-b border-[var(--border-hairline)] bg-[var(--bg-inset)] px-3 py-2">
                    <button
                      type="button"
                      onClick={() => setDesktopApp('menu')}
                      className="text-xs text-[var(--accent-primary)] font-bold hover:underline"
                    >
                      Desktop
                    </button>
                    <div className="flex-1 flex items-center gap-1.5 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-2.5 py-1">
                      <Globe className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" />
                      <input
                        type="text"
                        value={browserUrl}
                        onChange={(e) => setBrowserUrl(e.target.value)}
                        placeholder="http://192.168.1.100 or domain"
                        className="flex-1 bg-transparent font-mono text-xs text-[var(--text-primary)] outline-none"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleBrowserGo}
                      disabled={browserLoading}
                      className="flex items-center gap-1 rounded-lg bg-[var(--accent-cta)] px-3 py-1 text-xs font-bold text-white hover:bg-[var(--accent-cta-hover)]"
                    >
                      <RefreshCw className={`w-3 h-3 ${browserLoading ? 'animate-spin' : ''}`} />
                      <span>Go</span>
                    </button>
                  </div>

                  {/* Browser Viewport */}
                  <div className="flex-1 min-h-0 overflow-y-auto p-4 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">
                    {browserLoading ? (
                      <div className="flex items-center justify-center h-full text-xs text-[var(--text-muted)]">
                        Connecting to {browserUrl}...
                      </div>
                    ) : browserOutput ? (
                      <div dangerouslySetInnerHTML={{ __html: browserOutput.html }} />
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full text-center space-y-2 text-[var(--text-muted)]">
                        <Globe className="w-8 h-8 opacity-40" />
                        <p className="text-xs">Enter a URL e.g. <code className="font-mono bg-[var(--bg-inset)] px-1 py-0.5 rounded">http://192.168.1.100</code> and click Go to load.</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Sub-App: Simple PDU Generator */}
              {desktopApp === 'traffic' && (
                <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5 space-y-4 max-w-lg mx-auto">
                  <div className="flex items-center justify-between border-b border-[var(--border-hairline)] pb-3">
                    <h3 className="font-display font-bold text-sm text-[var(--text-primary)]">
                      Simple PDU Generator
                    </h3>
                    <button
                      type="button"
                      onClick={() => setDesktopApp('menu')}
                      className="text-xs text-[var(--accent-primary)] hover:underline font-semibold"
                    >
                      ← Back to Desktop
                    </button>
                  </div>

                  <p className="text-xs text-[var(--text-secondary)]">
                    Dispatch an ICMP echo request from {device.name} to another device in the simulation.
                  </p>

                  <div className="space-y-3">
                    <label className="space-y-1 block text-xs">
                      <span className="font-medium text-[var(--text-secondary)]">Destination Device:</span>
                      <select
                        id="pdu-dest-select"
                        className="w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-inset)] px-3 py-2 font-mono text-xs"
                      >
                        {Array.from(engine.devices.values())
                          .filter((d) => d.id !== device.id)
                          .map((d) => (
                            <option key={d.id} value={d.id}>
                              {d.name} ({d.interfaces[0]?.ip || 'unassigned'})
                            </option>
                          ))}
                      </select>
                    </label>

                    <button
                      type="button"
                      onClick={() => {
                        const sel = document.getElementById('pdu-dest-select') as HTMLSelectElement | null;
                        if (sel && sel.value) {
                          const res = engine.sendSimplePdu(device.id, sel.value);
                          alert(res.info);
                        }
                      }}
                      className="w-full flex items-center justify-center gap-2 rounded-xl bg-[var(--accent-cta)] py-2.5 text-xs font-bold text-white hover:bg-[var(--accent-cta-hover)] shadow-xs"
                    >
                      <Send className="w-4 h-4" />
                      <span>Send Simple PDU</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 5: SERVICES (FOR SERVERS) */}
          {activeTab === 'services' && (
            <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5 space-y-4 max-w-2xl mx-auto">
              <h3 className="font-display font-bold text-sm text-[var(--text-primary)]">
                Server Services Configuration
              </h3>

              {/* HTTP Service */}
              <div className="rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-inset)]/40 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-[var(--text-primary)] flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-blue-500" />
                    <span>HTTP Server Service</span>
                  </span>
                  <label className="flex items-center gap-2 text-xs font-bold text-[var(--text-primary)] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={device.services?.http?.enabled ?? true}
                      onChange={(e) => {
                        onUpdateDevice({
                          ...device,
                          services: {
                            ...device.services,
                            http: {
                              enabled: e.target.checked,
                              port: 80,
                              body: device.services?.http?.body || `<html><body><h1>Welcome to ${device.name}</h1></body></html>`,
                            },
                          },
                        });
                      }}
                      className="h-4 w-4 rounded accent-[var(--accent-primary)]"
                    />
                    <span>Service: {device.services?.http?.enabled ?? true ? 'ON' : 'OFF'}</span>
                  </label>
                </div>
                <textarea
                  rows={3}
                  value={device.services?.http?.body || `<html><body><h1>Welcome to ${device.name}</h1></body></html>`}
                  onChange={(e) => {
                    onUpdateDevice({
                      ...device,
                      services: {
                        ...device.services,
                        http: {
                          enabled: device.services?.http?.enabled ?? true,
                          port: 80,
                          body: e.target.value,
                        },
                      },
                    });
                  }}
                  className="w-full rounded-md border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-2 font-mono text-xs"
                />
              </div>

              {/* DHCP Service */}
              <div className="rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-inset)]/40 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-[var(--text-primary)] flex items-center gap-1.5">
                    <Network className="w-3.5 h-3.5 text-amber-500" />
                    <span>DHCP Server Service</span>
                  </span>
                  <label className="flex items-center gap-2 text-xs font-bold text-[var(--text-primary)] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={device.services?.dhcp?.enabled ?? (device.role === 'dhcp_server')}
                      onChange={(e) => {
                        onUpdateDevice({
                          ...device,
                          services: {
                            ...device.services,
                            dhcp: {
                              enabled: e.target.checked,
                              poolStart: '192.168.1.10',
                              poolEnd: '192.168.1.200',
                              mask: '255.255.255.0',
                              gateway: device.interfaces[0]?.ip || '192.168.1.1',
                              dns: device.dnsServer || '8.8.8.8',
                            },
                          },
                        });
                      }}
                      className="h-4 w-4 rounded accent-[var(--accent-primary)]"
                    />
                    <span>Service: {device.services?.dhcp?.enabled ?? (device.role === 'dhcp_server') ? 'ON' : 'OFF'}</span>
                  </label>
                </div>
              </div>

              {/* DNS Service */}
              <div className="rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-inset)]/40 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-[var(--text-primary)] flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-emerald-500" />
                    <span>DNS Server Service (Resource Records)</span>
                  </span>
                </div>
                <div className="flex gap-2 text-xs">
                  <input
                    type="text"
                    placeholder="Domain Name (e.g. cisco.com)"
                    value={dnsName}
                    onChange={(e) => setDnsName(e.target.value)}
                    className="flex-1 rounded-md border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-2 py-1 font-mono"
                  />
                  <input
                    type="text"
                    placeholder="IP Address (e.g. 192.168.1.100)"
                    value={dnsIp}
                    onChange={(e) => setDnsIp(e.target.value)}
                    className="flex-1 rounded-md border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-2 py-1 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (dnsName && dnsIp) {
                        const recs = device.services?.dns?.records || [];
                        onUpdateDevice({
                          ...device,
                          services: {
                            ...device.services,
                            dns: {
                              enabled: true,
                              role: 'authoritative',
                              records: [...recs, { name: dnsName, type: 'A', value: dnsIp, ttl: 3600 }],
                            },
                          },
                        });
                        setDnsName('');
                        setDnsIp('');
                      }
                    }}
                    className="rounded-md bg-[var(--accent-cta)] px-3 text-xs font-bold text-white hover:bg-[var(--accent-cta-hover)]"
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
