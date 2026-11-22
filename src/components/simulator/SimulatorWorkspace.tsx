import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BarChart3, ChevronDown, ChevronUp, Layers, Maximize2, Minimize2, Network, Play, Pause, RotateCcw, ScrollText, SkipBack, Sparkles, StepForward, Table2, Terminal, Mail } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { createDefaultInterface, SimulationEngine } from '../../engine/simulator';
import type { CapturedPacket, DeviceRole, LinkMedium, SimDevice, SimLink } from '../../engine/types';
import { compressTopology, encodeExploreHash } from '../../lib/deepLink';
import { matchesDisplayFilter, validateDisplayFilter } from '../../lib/displayFilter';
import { triggerDownload } from '../../lib/pcapWriter';
import { computeSimulationAnalytics } from '../../lib/simAnalytics';
import { describePacketStateChange, resolveSimShortcutAction, SIM_PLAYBACK_SPEEDS } from '../../lib/simPlayback';
import { PRESET_LABS, type PresetLab } from '../../simulator/labs';
import type { StarterTemplate } from '../../simulator/templates';
import { useAppStore } from '../../store/useAppStore';
import { EventLogPanel } from '../common/EventLogPanel';
import { PacketInspector, PacketInspectorContent } from '../common/PacketInspector';
import { PacketTable } from '../explore/PacketTable';
import { CaptureFilterBar } from './CaptureFilterBar';
import { DevicePalette, PALETTE_ITEMS } from './DevicePalette';
import { LabsDrawer } from './LabsDrawer';
import { DeviceDesktop } from './DeviceDesktop';
import { PduPanel } from './PduPanel';
import { PropertiesPanel } from './PropertiesPanel';
import type { PduKind } from '../../engine/simulator';
import { SimAnalyticsPanel } from './SimAnalyticsPanel';
import { type CanvasAnnotation, type ConnectPortsPayload, SimCanvas } from './SimCanvas';
import { SimControls } from './SimControls';
import { TerminalEmulator } from './TerminalEmulator';
import { tc } from '../../i18n/content';

interface Snapshot {
  devices: SimDevice[];
  links: SimLink[];
}

export const SimulatorWorkspace: React.FC = () => {
  const { t } = useTranslation();
  const {
    experienceLevel,
    setExperienceLevel,
    activeLabId,
    simDevices,
    simLinks,
    setSimTopology,
    selectedDeviceId,
    setSelectedDeviceId,
    simPlaying,
    setSimPlaying,
    simSpeed,
    setSimSpeed,
    loadLab,
    settings,
    commandPaletteOpen,
    settingsOpen,
    aboutOpen,
    tourOpen,
  } = useAppStore();
  const isPro = experienceLevel === 'pro';
  const activeLab = PRESET_LABS.find((l) => l.id === activeLabId) ?? PRESET_LABS[0];

  const engineRef = useRef<SimulationEngine>(
    new SimulationEngine({ seed: settings.defaultSeed, devices: simDevices, links: simLinks })
  );
  const canvasExportRef = useRef<{
    exportPng: () => Promise<Blob | null>;
    exportSvg: () => void;
    fitView?: () => void;
  } | null>(null);

  const [tickVersion, setTickVersion] = useState(0);
  const [playbackMode, setPlaybackMode] = useState<'live' | 'step'>('live');
  const [stepCursor, setStepCursor] = useState(0);
  const [liveCursor, setLiveCursor] = useState<number | null>(null);
  const stepCursorRef = useRef(0);
  const liveCursorRef = useRef<number | null>(null);
  stepCursorRef.current = stepCursor;
  liveCursorRef.current = liveCursor;

  const commitStepCursor = (next: number) => {
    stepCursorRef.current = next;
    setStepCursor(next);
  };

  const commitLiveCursor = (next: number | null) => {
    liveCursorRef.current = next;
    setLiveCursor(next);
  };
  const [activeTemplate, setActiveTemplate] = useState<StarterTemplate | null>(null);
  const [selectedLinkId, setSelectedLinkId] = useState<string | null>(null);
  const [connectMode, setConnectMode] = useState(false);
  const [desktopDeviceId, setDesktopDeviceId] = useState<string | null>(null);
  const [pduMode, setPduMode] = useState(false);
  const [pduSourceId, setPduSourceId] = useState<string | null>(null);
  const [pduKind, setPduKind] = useState<PduKind>('ICMP');
  const [linkMedium, setLinkMedium] = useState<LinkMedium>('ethernet');
  const [annotations, setAnnotations] = useState<CanvasAnnotation[]>([]);
  const [undoStack, setUndoStack] = useState<Snapshot[]>([]);
  const [redoStack, setRedoStack] = useState<Snapshot[]>([]);
  const [dockInspectedId, setDockInspectedId] = useState<string | null>(null);
  const [modalInspectedId, setModalInspectedId] = useState<string | null>(null);
  const [externalLog, setExternalLog] = useState<{ deviceId: string; cmd: string; output: string } | null>(null);
  const [captureFilter, setCaptureFilter] = useState('');
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  // Packet-Tracer IDE Workbench Panel States
  const [labsOpen, setLabsOpen] = useState(false);
  const [leftRailCollapsed, setLeftRailCollapsed] = useState(false);
  const [rightInspectorOpen, setRightInspectorOpen] = useState(true);
  const [dockTab, setDockTab] = useState<'capture' | 'logs' | 'inspector' | 'terminal' | 'metrics' | 'tables' | 'pdu'>(
    'capture'
  );
  const [dockSize, setDockSize] = useState<'collapsed' | 'compact' | 'expanded'>('compact');

  const effectiveDockTab = !isPro && dockTab === 'logs' ? 'capture' : dockTab;

  const bump = () => setTickVersion((v) => v + 1);

  const seedTopologyPackets = (eng: SimulationEngine): boolean => {
    if (activeTemplate?.probe && eng.devices.has(activeTemplate.probe.deviceId)) {
      eng.execCommand(activeTemplate.probe.deviceId, activeTemplate.probe.command);
      if (eng.packets.length > 0 || eng.queue.size > 0) return true;
    }
    const runner = !activeTemplate ? activeLab.onLoadRun ?? activeLab.onSolve : undefined;
    if (runner) {
      runner(eng);
    }
    if (eng.packets.length > 0 || eng.queue.size > 0) return true;

    // Fallback for custom or modified topologies: send traffic between the first two reachable powered-on devices
    const activeDevs = Array.from(eng.devices.values()).filter((d) => d.poweredOn);
    for (let i = 0; i < activeDevs.length; i++) {
      for (let j = activeDevs.length - 1; j > i; j--) {
        const src = activeDevs[i];
        const dst = activeDevs[j];
        if (eng.findPath(src.id, dst.id).length > 1) {
          const dstIp = dst.interfaces.find((inf) => inf.ip && inf.ip !== '0.0.0.0')?.ip;
          if (dstIp) {
            eng.execCommand(src.id, `ping ${dstIp} -c 2`);
          }
          if (eng.packets.length === 0) {
            eng.enqueueDirectPacket({
              fromId: src.id,
              toId: dst.id,
              protocol: 'ICMP',
              colorCategory: 'icmp',
              info: 'Echo (ping) probe',
              osiLayer: 3,
            });
            eng.runAll();
          }
          return eng.packets.length > 0;
        }
      }
    }
    return false;
  };

  const syncAfterPacketEmission = (prevCount: number) => {
    const nextCount = engineRef.current.packets.length;
    if (playbackMode === 'step' && nextCount > prevCount) {
      const nextStep = prevCount + 1;
      setStepCursor(nextStep);
      const pkt = engineRef.current.packets[nextStep - 1];
      if (pkt) setDockInspectedId(pkt.id);
      setSimPlaying(false);
    } else if (playbackMode === 'live') {
      setLiveCursor(null);
    }
    bump();
  };

  useEffect(() => {
    engineRef.current.loadTopology(simDevices, simLinks);
    bump();
  }, [simDevices, simLinks]);

  /** Stores any configuration the engine changed (DHCP lease, CLI edits) so it persists and can be undone. */
  const commitEngineConfig = () => {
    const changed = engineRef.current.consumeConfigChanges();
    if (changed) pushHistory(changed.devices, changed.links);
  };

  const handleDesktopDhcp = (deviceId: string) => {
    const prev = engineRef.current.packets.length;
    const result = engineRef.current.requestDhcp(deviceId);
    syncAfterPacketEmission(prev);
    commitEngineConfig();
    return result;
  };

  const handleDesktopRelease = (deviceId: string) => {
    const msg = engineRef.current.releaseDhcp(deviceId);
    commitEngineConfig();
    return msg;
  };

  const handleDesktopStatic = (deviceId: string, cfg: { ip: string; mask: string; gateway: string; dns: string }) => {
    pushHistory(
      simDevices.map((d) =>
        d.id !== deviceId
          ? d
          : {
              ...d,
              dhcpEnabled: false,
              dnsServer: cfg.dns || undefined,
              interfaces: d.interfaces.map((i, idx) => (idx === 0 ? { ...i, ip: cfg.ip, mask: cfg.mask, gateway: cfg.gateway || undefined } : i)),
            }
      ),
      simLinks
    );
  };

  /** Sends a test packet and shows what happened to it in the PDU tab. */
  const handleSendPdu = (srcId: string, dstId: string, kind: PduKind) => {
    const prevCount = engineRef.current.packets.length;
    const rec = engineRef.current.sendPdu(srcId, dstId, kind);
    if (!rec) return;
    syncAfterPacketEmission(prevCount);
    setDockTab('pdu');
    setDockSize((s) => (s === 'collapsed' ? 'compact' : s));
  };

  useEffect(() => {
    if (!pduMode) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPduMode(false);
        setPduSourceId(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pduMode]);

  const togglePduMode = () => {
    setPduMode((on) => !on);
    setPduSourceId(null);
    setConnectMode(false);
  };

  /** Canvas selection doubles as source/destination picking while "Add PDU" is on. */
  const handleCanvasSelectDevice = (id: string | null) => {
    if (!pduMode || !id) {
      setSelectedDeviceId(id);
      return;
    }
    if (!pduSourceId) {
      setPduSourceId(id);
      setSelectedDeviceId(id);
      return;
    }
    if (id === pduSourceId) return;
    handleSendPdu(pduSourceId, id, pduKind);
    setPduMode(false);
    setPduSourceId(null);
    setSelectedDeviceId(id);
  };

  const stepIntervalMs =
    playbackMode === 'step'
      ? Math.max(160, 950 / Math.max(0.25, simSpeed))
      : Math.max(180, 720 / Math.max(0.25, simSpeed));

  useEffect(() => {
    if (!simPlaying) return;

    if (playbackMode === 'step') {
      const interval = setInterval(() => {
        const eng = engineRef.current;
        if (eng.packets.length === 0 && eng.queue.size === 0) {
          if (seedTopologyPackets(eng)) {
            commitStepCursor(eng.packets.length > 0 ? 1 : 0);
            if (eng.packets[0]) setDockInspectedId(eng.packets[0].id);
            bump();
            if (eng.packets.length <= 1) setSimPlaying(false);
            return;
          }
          setSimPlaying(false);
          return;
        }
        if (eng.queue.size > 0) {
          eng.stepOneEvent();
          bump();
        }
        const total = eng.packets.length;
        const curr = stepCursorRef.current;
        if (curr >= total) {
          setSimPlaying(false);
          return;
        }
        const next = curr + 1;
        commitStepCursor(next);
        const pkt = eng.packets[next - 1];
        if (pkt) setDockInspectedId(pkt.id);
        if (next >= total) {
          setSimPlaying(false);
        }
      }, stepIntervalMs);
      return () => clearInterval(interval);
    }

    const interval = setInterval(() => {
      const eng = engineRef.current;
      if (eng.queue.size > 0) {
        eng.stepOneEvent();
        bump();
      }
      const total = eng.packets.length;
      if (total === 0 && eng.queue.size === 0) {
        setSimPlaying(false);
        commitLiveCursor(null);
        return;
      }
      const current = liveCursorRef.current ?? 0;
      if (current < total) {
        const next = current + 1;
        commitLiveCursor(next);
        const pkt = eng.packets[next - 1];
        if (pkt) setDockInspectedId(pkt.id);
        return;
      }
      if (eng.queue.size === 0) {
        setSimPlaying(false);
        commitLiveCursor(null);
      }
    }, stepIntervalMs);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [simPlaying, stepIntervalMs, playbackMode, activeLab, setSimPlaying]);

  const pushHistory = (nextDevices: SimDevice[], nextLinks: SimLink[]) => {
    setUndoStack((prev) => [
      ...prev.slice(-19),
      { devices: structuredClone(simDevices), links: structuredClone(simLinks) },
    ]);
    setRedoStack([]);
    setSimTopology(nextDevices, nextLinks);
  };

  const handleUndo = () => {
    if (undoStack.length === 0) return;
    const last = undoStack[undoStack.length - 1];
    setRedoStack((prev) => [...prev, { devices: structuredClone(simDevices), links: structuredClone(simLinks) }]);
    setUndoStack((prev) => prev.slice(0, -1));
    setSimPlaying(false);
    setActiveTemplate(null);
    engineRef.current = new SimulationEngine({
      seed: settings.defaultSeed,
      devices: last.devices,
      links: last.links,
    });
    setStepCursor(0);
    setLiveCursor(null);
    setDockInspectedId(null);
    setSimTopology(last.devices, last.links);
    setSelectedDeviceId(last.devices[0]?.id ?? null);
    setSelectedLinkId(null);
    bump();
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setUndoStack((prev) => [...prev, { devices: structuredClone(simDevices), links: structuredClone(simLinks) }]);
    setRedoStack((prev) => prev.slice(0, -1));
    setSimPlaying(false);
    engineRef.current = new SimulationEngine({
      seed: settings.defaultSeed,
      devices: next.devices,
      links: next.links,
    });
    setStepCursor(0);
    setLiveCursor(null);
    setDockInspectedId(null);
    setSimTopology(next.devices, next.links);
    setSelectedDeviceId(next.devices[0]?.id ?? null);
    setSelectedLinkId(null);
    bump();
  };

  const addDeviceAt = (role: DeviceRole, x: number, y: number) => {
    const meta = PALETTE_ITEMS.find((p) => p.role === role);
    const num = simDevices.length + 1;
    const suffix = (num + 10).toString(16).padStart(2, '0');
    const ipParts = (meta?.defaultIp || '192.168.1.50').split('.');
    const ip =
      meta?.defaultIp === '0.0.0.0'
        ? '0.0.0.0'
        : `${ipParts[0]}.${ipParts[1]}.${ipParts[2]}.${Math.min(250, Number(ipParts[3]) + num)}`;

    const newDev: SimDevice = {
      id: `dev-${Date.now()}-${num}`,
      name: `${meta?.label.split(' ')[0] || role}-${num}`,
      role,
      x,
      y,
      poweredOn: true,
      interfaces: [createDefaultInterface('eth0', 'eth0', ip, '255.255.255.0', '192.168.1.1', suffix)],
      routingTable: [],
      arpCache: [],
      macTable: [],
      natTable: [],
      firewallRules: [],
      openPorts: role === 'web_server' ? [80, 443] : role === 'dns_server' ? [53] : [22],
      services:
        role === 'web_server'
          ? { http: { enabled: true, port: 80, body: `<h1>Hello from ${role}-${num}</h1>` } }
          : role === 'dns_server'
          ? { dns: { enabled: true, role: 'recursive', records: [] } }
          : {},
      cpuLoad: 5,
    };
    pushHistory([...simDevices, newDev], simLinks);
    setSelectedDeviceId(newDev.id);
    setSelectedLinkId(null);
  };

  const handleAddDevicePort = (deviceId: string) => {
    const nextDevices = simDevices.map((d) => {
      if (d.id !== deviceId) return d;
      const prefix = d.role === 'switch' || d.role === 'hub' ? 'fa0/' : 'eth';
      let idx = d.role === 'switch' || d.role === 'hub' ? 1 : 0;
      const existing = new Set(d.interfaces.flatMap((i) => [i.name.toLowerCase(), i.id.toLowerCase()]));
      while (existing.has(`${prefix}${idx}`)) idx++;
      const name = `${prefix}${idx}`;
      const macSuffix = (d.interfaces.length + 20).toString(16).padStart(2, '0');
      return {
        ...d,
        interfaces: [...d.interfaces, createDefaultInterface(name, name, '0.0.0.0', '255.255.255.0', undefined, macSuffix)],
      };
    });
    pushHistory(nextDevices, simLinks);
  };

  const handleConnectPorts = ({
    sourceDeviceId,
    sourceIface,
    targetDeviceId,
    targetIface,
    medium,
  }: ConnectPortsPayload) => {
    if (sourceDeviceId === targetDeviceId) return;

    let canonicalSourceIface = sourceIface;
    let canonicalTargetIface = targetIface;
    let sourceNameAlt = sourceIface;
    let targetNameAlt = targetIface;

    // Ensure both interfaces exist and are enabled (up: true)
    const nextDevices = simDevices.map((d) => {
      if (d.id === sourceDeviceId) {
        const matched = d.interfaces.find((i) => i.id === sourceIface || i.name === sourceIface);
        if (!matched) {
          const suffix = (d.interfaces.length + 30).toString(16).padStart(2, '0');
          return {
            ...d,
            interfaces: [
              ...d.interfaces,
              createDefaultInterface(sourceIface, sourceIface, '0.0.0.0', '255.255.255.0', undefined, suffix),
            ],
          };
        }
        canonicalSourceIface = matched.id;
        sourceNameAlt = matched.name;
        return {
          ...d,
          interfaces: d.interfaces.map((i) => (i.id === matched.id ? { ...i, up: true } : i)),
        };
      }
      if (d.id === targetDeviceId) {
        const matched = d.interfaces.find((i) => i.id === targetIface || i.name === targetIface);
        if (!matched) {
          const suffix = (d.interfaces.length + 40).toString(16).padStart(2, '0');
          return {
            ...d,
            interfaces: [
              ...d.interfaces,
              createDefaultInterface(targetIface, targetIface, '0.0.0.0', '255.255.255.0', undefined, suffix),
            ],
          };
        }
        canonicalTargetIface = matched.id;
        targetNameAlt = matched.name;
        return {
          ...d,
          interfaces: d.interfaces.map((i) => (i.id === matched.id ? { ...i, up: true } : i)),
        };
      }
      return d;
    });

    // Replace any stale link already occupying either selected physical port
    const isSamePort = (lDev: string, lIface: string, devId: string, idA: string, idB: string) =>
      lDev === devId && (lIface === idA || lIface === idB);

    const cleanedLinks = simLinks.filter(
      (l) =>
        !(
          isSamePort(l.sourceId, l.sourceIface, sourceDeviceId, canonicalSourceIface, sourceNameAlt) ||
          isSamePort(l.targetId, l.targetIface, sourceDeviceId, canonicalSourceIface, sourceNameAlt) ||
          isSamePort(l.sourceId, l.sourceIface, targetDeviceId, canonicalTargetIface, targetNameAlt) ||
          isSamePort(l.targetId, l.targetIface, targetDeviceId, canonicalTargetIface, targetNameAlt)
        )
    );

    const bw = medium === 'fiber' ? 1000 : medium === 'wireless' ? 300 : medium === 'serial' ? 10 : 100;
    const newLink: SimLink = {
      id: `lnk-${Date.now()}`,
      sourceId: sourceDeviceId,
      sourceIface: canonicalSourceIface,
      targetId: targetDeviceId,
      targetIface: canonicalTargetIface,
      medium,
      bandwidthMbps: bw,
      delayMs: medium === 'serial' ? 20 : 4,
      jitterMs: medium === 'wireless' ? 3 : 0,
      lossPercent: 0,
      mtu: 1500,
      duplex: 'full',
      up: true,
    };

    pushHistory(nextDevices, [...cleanedLinks, newLink]);
    setSelectedLinkId(newLink.id);
    setSelectedDeviceId(null);
    setConnectMode(false);
  };

  const handleDeleteSelected = () => {
    if (selectedDeviceId) {
      pushHistory(
        simDevices.filter((d) => d.id !== selectedDeviceId),
        simLinks.filter((l) => l.sourceId !== selectedDeviceId && l.targetId !== selectedDeviceId)
      );
      setSelectedDeviceId(null);
    } else if (selectedLinkId) {
      pushHistory(
        simDevices,
        simLinks.filter((l) => l.id !== selectedLinkId)
      );
      setSelectedLinkId(null);
    }
  };

  const handleAutoLayout = () => {
    const cols = Math.max(2, Math.ceil(Math.sqrt(simDevices.length)));
    const next = simDevices.map((d, idx) => ({
      ...d,
      x: 140 + (idx % cols) * 210,
      y: 120 + Math.floor(idx / cols) * 160,
    }));
    pushHistory(next, simLinks);
  };

  const handleFaultAction = (fault: 'cut_link' | 'loss_20' | 'dup_ip' | 'low_mtu' | 'block_80') => {
    if (fault === 'cut_link') {
      const targetLink = simLinks.find((l) => l.id === selectedLinkId) ?? simLinks[0];
      if (!targetLink) return;
      pushHistory(
        simDevices,
        simLinks.map((l) => (l.id === targetLink.id ? { ...l, up: !l.up } : l))
      );
    } else if (fault === 'loss_20') {
      const targetLink = simLinks.find((l) => l.id === selectedLinkId) ?? simLinks[0];
      if (!targetLink) return;
      pushHistory(
        simDevices,
        simLinks.map((l) => (l.id === targetLink.id ? { ...l, lossPercent: l.lossPercent > 0 ? 0 : 20 } : l))
      );
    } else if (fault === 'low_mtu') {
      const targetLink = simLinks.find((l) => l.id === selectedLinkId) ?? simLinks[0];
      if (!targetLink) return;
      pushHistory(
        simDevices,
        simLinks.map((l) => (l.id === targetLink.id ? { ...l, mtu: l.mtu < 1500 ? 1500 : 576 } : l))
      );
    } else if (fault === 'dup_ip') {
      if (simDevices.length < 2) return;
      const firstIp = simDevices[0].interfaces[0]?.ip || '192.168.1.10';
      const target = simDevices[1];
      pushHistory(
        simDevices.map((d) =>
          d.id === target.id
            ? { ...d, interfaces: d.interfaces.map((i, idx) => (idx === 0 ? { ...i, ip: firstIp } : i)) }
            : d
        ),
        simLinks
      );
    } else if (fault === 'block_80') {
      const target = simDevices.find((d) => d.role === 'firewall' || d.role === 'router') ?? simDevices[0];
      if (!target) return;
      pushHistory(
        simDevices.map((d) =>
          d.id === target.id
            ? {
                ...d,
                firewallRules: [
                  ...d.firewallRules,
                  {
                    id: `fw-block80-${Date.now()}`,
                    action: 'deny',
                    direction: 'both',
                    protocol: 'TCP',
                    srcIp: 'any',
                    dstIp: 'any',
                    dstPort: 80,
                  },
                ],
              }
            : d
        ),
        simLinks
      );
    }
  };

  const handleSelectLab = (lab: PresetLab) => {
    engineRef.current = new SimulationEngine({
      seed: settings.defaultSeed,
      devices: lab.devices,
      links: lab.links,
    });
    loadLab(lab.id);
    setActiveTemplate(null);
    setSimPlaying(false);
    setStepCursor(0);
    setLiveCursor(null);
    setSelectedLinkId(null);
    setDockInspectedId(null);
    setModalInspectedId(null);
    setUndoStack([]);
    setRedoStack([]);
    bump();
  };

  const handleApplyTemplate = (template: StarterTemplate) => {
    const nextDevices = structuredClone(template.devices);
    const nextLinks = structuredClone(template.links);
    setSimPlaying(false);
    setActiveTemplate(template);
    engineRef.current = new SimulationEngine({
      seed: settings.defaultSeed,
      devices: nextDevices,
      links: nextLinks,
    });
    pushHistory(nextDevices, nextLinks);
    setStepCursor(0);
    setLiveCursor(null);
    setSelectedDeviceId(nextDevices[0]?.id ?? null);
    setSelectedLinkId(null);
    setDockInspectedId(null);
    setModalInspectedId(null);
    bump();
    requestAnimationFrame(() => canvasExportRef.current?.fitView?.());
  };

  const handleRunLabDemo = (lab: PresetLab) => {
    handleSelectLab(lab);
    if (lab.onLoadRun) {
      const output = lab.onLoadRun(engineRef.current);
      setExternalLog({
        deviceId: lab.devices[0]?.name || 'host',
        cmd: `demo(${lab.title})`,
        output,
      });
      if (playbackMode === 'step') {
        syncAfterPacketEmission(0);
      } else {
        if (engineRef.current.packets.length > 0) {
          setLiveCursor(1);
          setDockInspectedId(engineRef.current.packets[0].id);
          setSimPlaying(true);
        }
        if (dockSize === 'collapsed') setDockSize('compact');
        bump();
      }
    }
  };

  const handleRunLabSolve = (lab: PresetLab) => {
    handleSelectLab(lab);
    if (lab.onSolve) {
      const output = lab.onSolve(engineRef.current);
      setExternalLog({
        deviceId: lab.devices[0]?.name || 'host',
        cmd: `solve(${lab.title})`,
        output,
      });
      if (playbackMode === 'step') {
        syncAfterPacketEmission(0);
      } else {
        if (engineRef.current.packets.length > 0) {
          setLiveCursor(1);
          setDockInspectedId(engineRef.current.packets[0].id);
          setSimPlaying(true);
        }
        if (dockSize === 'collapsed') setDockSize('compact');
        bump();
      }
    }
  };

  const engine = engineRef.current;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const warnings = useMemo(() => engine.validateTopology(), [simDevices, simLinks, tickVersion]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const metrics = useMemo(() => engine.getMetrics(), [tickVersion]);
  const allPackets: CapturedPacket[] = engine.packets;
  const clampedStepCursor =
    playbackMode === 'step' ? Math.max(0, Math.min(stepCursor, allPackets.length)) : allPackets.length;
  const clampedLiveCursor =
    playbackMode === 'live' && liveCursor !== null ? Math.max(0, Math.min(liveCursor, allPackets.length)) : null;

  const packets: CapturedPacket[] =
    playbackMode === 'step'
      ? allPackets.slice(0, clampedStepCursor)
      : clampedLiveCursor !== null
      ? allPackets.slice(0, clampedLiveCursor)
      : allPackets;

  const liveDevices = useMemo(
    () =>
      simDevices.map((d) => {
        const engDev = engine.devices.get(d.id);
        if (!engDev) return d;
        return {
          ...d,
          routingTable: engDev.routingTable,
          arpCache: engDev.arpCache,
          macTable: engDev.macTable,
          natTable: engDev.natTable,
        };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [simDevices, tickVersion]
  );

  const liveAnalytics = useMemo(
    () => computeSimulationAnalytics(packets, simLinks, liveDevices, metrics.cwndSeries),
    [packets, simLinks, liveDevices, metrics.cwndSeries]
  );

  const filterValidation = useMemo(() => validateDisplayFilter(captureFilter), [captureFilter]);
  const filteredPackets = useMemo(() => {
    const trimmed = captureFilter.trim();
    if (!trimmed || !filterValidation.valid) return packets;
    return packets.filter((p) => matchesDisplayFilter(p, trimmed));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [packets, packets.length, captureFilter, filterValidation.valid, tickVersion, clampedStepCursor, clampedLiveCursor, playbackMode]);

  const selectedDevice = liveDevices.find((d) => d.id === selectedDeviceId) ?? null;
  const selectedLink = simLinks.find((l) => l.id === selectedLinkId) ?? null;

  const activeStepPacket =
    playbackMode === 'step' && clampedStepCursor > 0
      ? allPackets[clampedStepCursor - 1] ?? null
      : clampedLiveCursor !== null && clampedLiveCursor > 0
      ? allPackets[clampedLiveCursor - 1] ?? null
      : null;

  const dockedInspectedPacket = useMemo(() => {
    if (activeStepPacket) {
      return packets.find((p) => p.id === dockInspectedId) ?? activeStepPacket;
    }
    if (dockInspectedId) {
      return packets.find((p) => p.id === dockInspectedId) ?? null;
    }
    return filteredPackets[filteredPackets.length - 1] ?? packets[packets.length - 1] ?? null;
  }, [dockInspectedId, packets, filteredPackets, activeStepPacket]);

  const modalInspectedPacket = modalInspectedId
    ? allPackets.find((p) => p.id === modalInspectedId) ?? null
    : null;

  const devMap = new Map(liveDevices.map((d) => [d.id, d]));

  const activeStateSnapshot = useMemo(() => {
    if (!activeStepPacket) return null;
    const fromName = devMap.get(activeStepPacket.fromDeviceId)?.name ?? activeStepPacket.fromDeviceId;
    const toName = devMap.get(activeStepPacket.toDeviceId)?.name ?? activeStepPacket.toDeviceId;
    return describePacketStateChange(activeStepPacket, fromName, toName);
  }, [activeStepPacket, devMap]);

  const displayedClockMs =
    playbackMode === 'step' || clampedLiveCursor !== null
      ? activeStepPacket?.arrivalMs ?? activeStepPacket?.timestampMs ?? 0
      : engine.clockMs;

  const visibleLogs =
    playbackMode === 'step' || clampedLiveCursor !== null
      ? engine.logs.filter((l) => l.timeMs <= displayedClockMs)
      : engine.logs;

  const handleChangePlaybackMode = (nextMode: 'live' | 'step') => {
    setSimPlaying(false);
    setPlaybackMode(nextMode);
    if (nextMode === 'step') {
      const seedIdx = clampedLiveCursor && clampedLiveCursor > 0 ? clampedLiveCursor : stepCursor;
      setLiveCursor(null);
      if (allPackets.length > 0) {
        const nextIdx = seedIdx > 0 && seedIdx <= allPackets.length ? seedIdx : 1;
        setStepCursor(nextIdx);
        const pkt = allPackets[nextIdx - 1];
        if (pkt) setDockInspectedId(pkt.id);
      } else {
        setStepCursor(0);
      }
    } else {
      setLiveCursor(null);
    }
  };

  const handleSingleStepForward = () => {
    setSimPlaying(false);
    if (playbackMode === 'step') {
      if (engine.queue.size > 0) {
        engine.stepOneEvent();
      }
      if (allPackets.length === 0) {
        if (seedTopologyPackets(engine)) {
          setStepCursor(engine.packets.length > 0 ? 1 : 0);
          if (engine.packets[0]) setDockInspectedId(engine.packets[0].id);
          bump();
          return;
        }
      }
      const next = Math.min(engine.packets.length, stepCursorRef.current + 1);
      commitStepCursor(next);
      const pkt = engine.packets[next - 1];
      if (pkt) setDockInspectedId(pkt.id);
      bump();
      return;
    }

    if (engine.queue.size > 0) {
      const prevCount = engine.packets.length;
      engine.stepOnePacket();
      syncAfterPacketEmission(prevCount);
      return;
    }

    if (engine.packets.length === 0) {
      seedTopologyPackets(engine);
      if (engine.packets.length > 0) {
        commitLiveCursor(1);
        setDockInspectedId(engine.packets[0].id);
      }
      bump();
      return;
    }

    const curr = liveCursorRef.current;
    const base = curr === null ? 0 : curr >= engine.packets.length ? 0 : curr;
    const next = Math.min(engine.packets.length, base + 1);
    commitLiveCursor(next);
    const pkt = engine.packets[next - 1];
    if (pkt) setDockInspectedId(pkt.id);
  };

  const handleSingleStepBack = () => {
    setSimPlaying(false);
    const next = Math.max(0, stepCursorRef.current - 1);
    commitStepCursor(next);
    const pkt = next > 0 ? allPackets[next - 1] : null;
    setDockInspectedId(pkt ? pkt.id : null);
  };

  const handleRewindStep = () => {
    setSimPlaying(false);
    setStepCursor(0);
    setDockInspectedId(null);
  };

  const handleJumpToEnd = () => {
    setSimPlaying(false);
    if (playbackMode === 'step') {
      const total = engine.packets.length;
      setStepCursor(total);
      const last = total > 0 ? engine.packets[total - 1] : null;
      setDockInspectedId(last ? last.id : null);
    }
  };

  const handleResetSimulation = () => {
    setSimPlaying(false);
    engine.reset(settings.defaultSeed);
    setStepCursor(0);
    setLiveCursor(null);
    setDockInspectedId(null);
    bump();
  };

  const handleTogglePlayPause = () => {
    if (simPlaying) {
      setSimPlaying(false);
      return;
    }

    if (playbackMode === 'step') {
      if (engine.packets.length === 0 && engine.queue.size === 0) {
        seedTopologyPackets(engine);
        setStepCursor(engine.packets.length > 0 ? 1 : 0);
        if (engine.packets[0]) setDockInspectedId(engine.packets[0].id);
        bump();
        if (engine.packets.length <= 1) return;
      } else if (stepCursor >= engine.packets.length && engine.packets.length > 0) {
        setStepCursor(1);
        if (engine.packets[0]) setDockInspectedId(engine.packets[0].id);
      }
      setSimPlaying(true);
      return;
    }

    // Live mode animated playback
    if (engine.packets.length === 0 && engine.queue.size === 0) {
      seedTopologyPackets(engine);
      bump();
    }
    if (engine.packets.length > 0) {
      if (liveCursor === null || liveCursor >= engine.packets.length) {
        setLiveCursor(1);
        setDockInspectedId(engine.packets[0].id);
      }
      setSimPlaying(true);
    } else if (engine.queue.size > 0) {
      setSimPlaying(true);
    }
  };

  const shortcutHandlerRef = useRef<(e: KeyboardEvent) => void>(() => undefined);
  shortcutHandlerRef.current = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && shortcutsOpen) {
      setShortcutsOpen(false);
      return;
    }

    const target = e.target as HTMLElement | null;
    const action = resolveSimShortcutAction({
      key: e.key,
      code: e.code,
      ctrlKey: e.ctrlKey,
      metaKey: e.metaKey,
      altKey: e.altKey,
      playbackMode,
      targetTagName: target?.tagName,
      isContentEditable: Boolean(target?.isContentEditable),
      modalOpen: commandPaletteOpen || settingsOpen || aboutOpen || tourOpen || Boolean(modalInspectedId),
    });
    if (!action) return;

    e.preventDefault();
    switch (action) {
      case 'toggle_play':
        handleTogglePlayPause();
        break;
      case 'step_forward':
        handleSingleStepForward();
        break;
      case 'step_back':
        handleSingleStepBack();
        break;
      case 'rewind':
        handleRewindStep();
        break;
      case 'jump_end':
        handleJumpToEnd();
        break;
      case 'reset':
        handleResetSimulation();
        break;
      case 'toggle_mode':
        handleChangePlaybackMode(playbackMode === 'live' ? 'step' : 'live');
        break;
      case 'speed_up': {
        const idx = SIM_PLAYBACK_SPEEDS.indexOf(simSpeed as (typeof SIM_PLAYBACK_SPEEDS)[number]);
        if (idx === -1) {
          const next = SIM_PLAYBACK_SPEEDS.find((s) => s > simSpeed);
          if (next) setSimSpeed(next);
        } else if (idx < SIM_PLAYBACK_SPEEDS.length - 1) {
          setSimSpeed(SIM_PLAYBACK_SPEEDS[idx + 1]);
        }
        break;
      }
      case 'speed_down': {
        const idx = SIM_PLAYBACK_SPEEDS.indexOf(simSpeed as (typeof SIM_PLAYBACK_SPEEDS)[number]);
        if (idx === -1) {
          const prev = [...SIM_PLAYBACK_SPEEDS].reverse().find((s) => s < simSpeed);
          if (prev) setSimSpeed(prev);
        } else if (idx > 0) {
          setSimSpeed(SIM_PLAYBACK_SPEEDS[idx - 1]);
        }
        break;
      }
      case 'toggle_shortcuts_help':
        setShortcutsOpen((o) => !o);
        break;
    }
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => shortcutHandlerRef.current(e);
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const countLabel =
    packets.length !== filteredPackets.length ? `${filteredPackets.length}/${packets.length}` : `${packets.length}`;

  const dockHeightClass =
    dockSize === 'collapsed'
      ? 'h-9'
      : dockSize === 'expanded'
      ? 'h-[410px]'
      : 'h-[260px]';

  return (
    <div className="flex flex-1 min-h-0 flex-col overflow-y-auto bg-[var(--bg-canvas)]">
      {/* Top Compact Command Strip */}
      <SimControls
        clockMs={displayedClockMs}
        devices={simDevices}
        warnings={warnings}
        labsOpen={labsOpen}
        inspectorOpen={rightInspectorOpen}
        playbackMode={playbackMode}
        stepCursor={clampedStepCursor}
        totalSteps={allPackets.length}
        shortcutsOpen={shortcutsOpen}
        onChangePlaybackMode={handleChangePlaybackMode}
        onTogglePlayPause={handleTogglePlayPause}
        onToggleShortcuts={() => setShortcutsOpen((o) => !o)}
        onToggleLabs={() => setLabsOpen((o) => !o)}
        onToggleInspector={() => setRightInspectorOpen((o) => !o)}
        onStep={handleSingleStepForward}
        onStepBack={handleSingleStepBack}
        onReset={handleResetSimulation}
        onFaultAction={handleFaultAction}
        onTrafficGen={(mode, sId, dId) => {
          const prevCount = engine.packets.length;
          const out = engine.runTrafficGenerator(mode, sId, dId);
          setExternalLog({ deviceId: sId, cmd: `traffic ${mode}`, output: out });
          syncAfterPacketEmission(prevCount);
        }}
        onShareUrl={async () => {
          const encoded = compressTopology({ devices: simDevices, links: simLinks });
          const hash = encodeExploreHash({ mode: 'simulator', sim: encoded });
          const url = `${window.location.origin}${window.location.pathname}${hash}`;
          window.history.replaceState(null, '', hash);
          try {
            await navigator.clipboard.writeText(url);
          } catch {
            // ignore clipboard failure
          }
        }}
        onExportJson={() => {
          const json = JSON.stringify({ devices: simDevices, links: simLinks }, null, 2);
          triggerDownload(new Blob([json], { type: 'application/json' }), 'netpulse-topology.json');
        }}
        onExportPng={() => {
          void canvasExportRef.current?.exportPng();
        }}
        onImportJson={(text) => {
          try {
            const parsed = JSON.parse(text) as { devices?: SimDevice[]; links?: SimLink[] };
            if (Array.isArray(parsed.devices) && Array.isArray(parsed.links)) {
              setActiveTemplate(null);
              pushHistory(parsed.devices, parsed.links);
            }
          } catch {
            // ignore malformed JSON
          }
        }}
        onApplyTemplate={handleApplyTemplate}
      />

      {/* Slide-down Lab Brief Drawer */}
      <LabsDrawer
        open={labsOpen}
        onClose={() => setLabsOpen(false)}
        onSelectLab={handleSelectLab}
        onRunLabDemo={handleRunLabDemo}
        onRunLabSolve={handleRunLabSolve}
      />

      {/* Simple Mode Guided Lab Goal Strip */}
      {!isPro && (
        <div className="@container shrink-0 flex items-center justify-between gap-3 border-b border-[var(--border-hairline)] bg-[var(--accent-primary-soft)] px-4 py-2 text-xs">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <span className="shrink-0 font-mono text-[11px] font-bold uppercase tracking-wider text-[var(--accent-teal)]">
              {t('simulator.labGoal')}:
            </span>
            <span className="min-w-0 truncate font-medium text-[var(--text-primary)]">
              {tc(activeLab.goals[0] ?? activeLab.description)}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={() => handleRunLabDemo(activeLab)}
              aria-label={t('simulator.runDemo')}
              className="flex h-7 items-center gap-1 rounded-md bg-[var(--accent-cta)] hover:bg-[var(--accent-cta-hover)] px-2.5 text-xs font-semibold text-[var(--on-accent)] transition-colors whitespace-nowrap"
            >
              <Play className="w-3 h-3" />
              <span className="hidden @2xl:inline">{t('simulator.runDemo')}</span>
            </button>
            <button
              type="button"
              onClick={() => handleRunLabSolve(activeLab)}
              aria-label={t('simulator.checkSolution')}
              className="flex h-7 items-center gap-1 rounded-md border border-[var(--tone-success)]/45 bg-[var(--bg-surface)] px-2.5 text-xs font-semibold text-[var(--tone-success)] hover:bg-[var(--tone-success)]/10 transition-colors whitespace-nowrap"
            >
              <Sparkles className="w-3 h-3" />
              <span className="hidden @2xl:inline">{t('simulator.checkSolution')}</span>
            </button>
            <button
              type="button"
              onClick={() => setExperienceLevel('pro')}
              title={t('simulator.proHint')}
              className="hidden xl:inline-flex h-7 items-center rounded-md border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-2.5 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] whitespace-nowrap"
            >
              {t('welcome.switchToPro')}
            </button>
          </div>
        </div>
      )}

      {/* Step-by-Step Protocol State Observation Bar */}
      {playbackMode === 'step' && (
        <div
          role="region"
          aria-label={t('simulator.stepByStepMode')}
          className="shrink-0 flex flex-wrap items-center justify-between gap-2.5 border-b border-[var(--border-hairline)] bg-[var(--bg-surface)] px-4 py-2 text-xs"
        >
          <div className="flex flex-wrap items-center gap-2 min-w-0 flex-1">
            <span className="rounded bg-[var(--accent-teal-soft)] px-2 py-0.5 font-mono text-[11px] font-bold text-[var(--accent-teal)] tabular-nums shrink-0">
              {t('simulator.stepProgress', { current: clampedStepCursor, total: allPackets.length })}
            </span>

            {activeStepPacket && activeStateSnapshot ? (
              <div className="flex flex-wrap items-center gap-2 min-w-0">
                <span
                  className={`rounded px-2 py-0.5 font-mono text-[11px] font-bold shrink-0 ${
                    activeStateSnapshot.tone === 'danger'
                      ? 'bg-[var(--tone-danger)]/15 text-[var(--tone-danger)]'
                      : activeStateSnapshot.tone === 'warning'
                      ? 'bg-[var(--tone-warning)]/15 text-[var(--tone-warning)]'
                      : activeStateSnapshot.tone === 'success'
                      ? 'bg-[var(--tone-success)]/15 text-[var(--tone-success)]'
                      : 'bg-[var(--accent-primary-soft)] text-[var(--accent-primary)]'
                  }`}
                >
                  #{activeStepPacket.no} · {activeStateSnapshot.phase}: {activeStateSnapshot.transition}
                </span>
                <span className="text-[var(--text-secondary)] truncate max-w-xl" title={activeStateSnapshot.detail}>
                  {activeStateSnapshot.detail}
                </span>
              </div>
            ) : (
              <span className="text-[var(--text-secondary)]">{t('simulator.stepEmptyHint')}</span>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {allPackets.length > 0 && (
              <input
                type="range"
                aria-label={tc('Packet delivery timeline scrubber')}
                min={0}
                max={allPackets.length}
                value={clampedStepCursor}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setSimPlaying(false);
                  setStepCursor(val);
                  const pkt = val > 0 ? allPackets[val - 1] : null;
                  setDockInspectedId(pkt ? pkt.id : null);
                }}
                className="w-24 sm:w-32 accent-[var(--accent-teal)] cursor-pointer"
              />
            )}

            <button
              type="button"
              onClick={handleRewindStep}
              disabled={clampedStepCursor === 0}
              title={`${t('simulator.rewind')} (Home)`}
              className="flex h-7 items-center gap-1 rounded border border-[var(--border-hairline)] bg-[var(--bg-inset)] px-2 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-40 whitespace-nowrap"
            >
              <RotateCcw className="w-3 h-3" />
              <span className="hidden sm:inline">{t('simulator.rewind')}</span>
            </button>

            <button
              type="button"
              onClick={handleSingleStepBack}
              disabled={clampedStepCursor <= 0}
              aria-label={tc('Step Back One Event')}
              title={`${t('simulator.stepBack')} (←)`}
              className="flex h-7 items-center gap-1 rounded border border-[var(--border-hairline)] bg-[var(--bg-inset)] px-2 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-40 whitespace-nowrap"
            >
              <SkipBack className="w-3 h-3" />
            </button>

            <button
              type="button"
              onClick={handleTogglePlayPause}
              aria-label={simPlaying ? 'Pause Step Playback' : 'Resume Step Playback'}
              title={`${simPlaying ? t('simulator.pause') : t('simulator.resume')} (Space)`}
              className="flex h-7 items-center gap-1 rounded bg-[var(--accent-cta)] hover:bg-[var(--accent-cta-hover)] px-2.5 text-xs font-semibold text-[var(--on-accent)] whitespace-nowrap"
            >
              {simPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
              <span>{simPlaying ? t('simulator.pause') : t('simulator.resume')}</span>
            </button>

            <button
              type="button"
              onClick={handleSingleStepForward}
              aria-label={tc('Single Step Next Event')}
              title={`${t('simulator.stepNext')} (→)`}
              className="flex h-7 items-center gap-1 rounded border border-[var(--accent-teal)]/50 bg-[var(--accent-teal-soft)] px-2.5 text-xs font-semibold text-[var(--accent-teal)] hover:bg-[var(--accent-teal)]/20 whitespace-nowrap"
            >
              <StepForward className="w-3 h-3" />
              <span>{t('simulator.stepNext')}</span>
            </button>
          </div>
        </div>
      )}

      {/* Middle Stage: Topology Canvas (+ Palette & Inspector in Pro Mode) */}
      <div className="flex flex-col lg:flex-row flex-1 min-h-[280px] overflow-hidden lg:gap-3 lg:p-3">
        {isPro && (
          <DevicePalette
            collapsed={leftRailCollapsed}
            onToggleCollapse={() => setLeftRailCollapsed((c) => !c)}
            connectMode={connectMode}
            linkMedium={linkMedium}
            onToggleConnectMode={() => setConnectMode((c) => !c)}
            onChangeMedium={setLinkMedium}
            onAddDevice={(role) =>
              addDeviceAt(role, 260 + (simDevices.length % 4) * 140, 140 + (simDevices.length % 3) * 110)
            }
          />
        )}

        <SimCanvas
          devices={liveDevices}
          links={simLinks}
          packets={filteredPackets}
          selectedDeviceId={selectedDeviceId}
          selectedLinkId={selectedLinkId}
          connectMode={connectMode}
          linkMedium={linkMedium}
          canUndo={undoStack.length > 0}
          canRedo={redoStack.length > 0}
          annotations={annotations}
          onToggleConnectMode={(next) => setConnectMode((curr) => (next !== undefined ? next : !curr))}
          pduMode={pduMode}
          pduSourceName={pduSourceId ? simDevices.find((d) => d.id === pduSourceId)?.name ?? null : null}
          onTogglePduMode={togglePduMode}
          onChangeMedium={setLinkMedium}
          onSelectDevice={handleCanvasSelectDevice}
          onSelectLink={setSelectedLinkId}
          onMoveDevice={(id, x, y) => {
            setSimTopology(
              simDevices.map((d) => (d.id === id ? { ...d, x, y } : d)),
              simLinks
            );
          }}
          onCommitMove={() => bump()}
          onConnectPorts={handleConnectPorts}
          onToggleLinkUp={(linkId) => {
            pushHistory(
              simDevices,
              simLinks.map((l) => (l.id === linkId ? { ...l, up: !l.up } : l))
            );
          }}
          onDropNewDevice={addDeviceAt}
          onDeleteSelected={handleDeleteSelected}
          onAutoLayout={handleAutoLayout}
          onUndo={handleUndo}
          onRedo={handleRedo}
          onAddAnnotation={(text) =>
            setAnnotations((prev) => [...prev, { id: `ann-${Date.now()}`, x: 120, y: 80 + prev.length * 28, text }])
          }
          onRemoveAnnotation={(id) => setAnnotations((prev) => prev.filter((a) => a.id !== id))}
          onInspectPacket={(id) => {
            setDockInspectedId(id);
            setDockTab('inspector');
            if (dockSize === 'collapsed') setDockSize('compact');
          }}
          onOpenDockTables={(devId) => {
            setSelectedDeviceId(devId);
            setDockTab('tables');
            if (dockSize === 'collapsed') setDockSize('compact');
          }}
          topologyTitle={
            activeTemplate
              ? t(activeTemplate.nameKey, { defaultValue: activeTemplate.fallbackName })
              : activeLab.title
          }
          activePacketId={activeStepPacket?.id ?? null}
          activePacketStateNote={activeStateSnapshot?.transition ?? null}
          simPlaying={simPlaying}
          stepDurationMs={stepIntervalMs}
          animationTick={playbackMode === 'step' ? clampedStepCursor : clampedLiveCursor ?? tickVersion}
          exportActionsRef={canvasExportRef}
        />

        {isPro && rightInspectorOpen && (
          <PropertiesPanel
            onOpenDesktop={setDesktopDeviceId}
            device={selectedDevice}
            link={selectedLink}
            devices={simDevices}
            links={simLinks}
            onUpdateDevice={(updated) => {
              pushHistory(
                simDevices.map((d) => (d.id === updated.id ? updated : d)),
                simLinks
              );
            }}
            onUpdateLink={(updated) => {
              pushHistory(
                simDevices,
                simLinks.map((l) => (l.id === updated.id ? updated : l))
              );
            }}
            onDeleteLink={(linkId) => {
              pushHistory(
                simDevices,
                simLinks.filter((l) => l.id !== linkId)
              );
              setSelectedLinkId(null);
            }}
            onAddDevicePort={handleAddDevicePort}
          />
        )}
      </div>

      {desktopDeviceId && liveDevices.find((d) => d.id === desktopDeviceId) && (
        <DeviceDesktop
          device={liveDevices.find((d) => d.id === desktopDeviceId)!}
          onClose={() => setDesktopDeviceId(null)}
          onApplyStatic={(cfg) => handleDesktopStatic(desktopDeviceId, cfg)}
          onRequestDhcp={() => handleDesktopDhcp(desktopDeviceId)}
          onRelease={() => handleDesktopRelease(desktopDeviceId)}
          onExecute={(devId, cmd) => {
            const prev = engine.packets.length;
            const out = engine.execCommand(devId, cmd);
            syncAfterPacketEmission(prev);
            commitEngineConfig();
            return out;
          }}
          getPrompt={(id) => engine.getCliPrompt(id)}
          onComplete={(id, line) => engine.completeCli(id, line)}
        />
      )}

      {/* Bottom Docked Resizable IDE Workbench Deck: Capture | Event Logs | Packet Inspector | CLI | Metrics | Tables */}
      <section
        aria-label={tc('Simulator Docked Console Deck')}
        className={`shrink-0 flex flex-col border-t border-[var(--border-strong)] bg-[var(--bg-surface)] transition-[height] duration-150 ${dockHeightClass}`}
      >
        {/* Dock Tab Bar + Size Controls */}
        <div className="shrink-0 flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-hairline)] bg-[var(--bg-surface)] px-3">
          <div className="flex items-center gap-1 overflow-x-auto">
            {(
              [
                { id: 'capture', label: `${t('simulator.capture')} (${countLabel})`, icon: Network, proOnly: false },
                { id: 'logs', label: `${t('simulator.logs')} (${visibleLogs.length})`, icon: ScrollText, proOnly: true },
                {
                  id: 'inspector',
                  label: `${t('simulator.inspector')}${dockedInspectedPacket ? ` (#${dockedInspectedPacket.no})` : ''}`,
                  icon: Layers,
                  proOnly: false,
                },
                { id: 'pdu', label: `${t('pdu.tab')} (${engine.pdus.length})`, icon: Mail, proOnly: false },
                { id: 'terminal', label: t('simulator.terminal'), icon: Terminal, proOnly: false },
                { id: 'metrics', label: t('simulator.metrics'), icon: BarChart3, proOnly: false },
                { id: 'tables', label: t('simulator.tables'), icon: Table2, proOnly: false },
              ] as const
            )
              .filter((item) => isPro || !item.proOnly)
              .map((item) => {
                const Icon = item.icon;
                const active = effectiveDockTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setDockTab(item.id);
                      if (dockSize === 'collapsed') setDockSize('compact');
                    }}
                    aria-current={active ? 'true' : undefined}
                    className={`-mb-px flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2 text-xs font-semibold transition-colors ${
                      active
                        ? 'border-[var(--accent-primary)] text-[var(--accent-primary)]'
                        : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <div className="hidden xl:flex items-center gap-3 font-mono text-xs text-[var(--text-muted)] tabular-nums">
              <span>Sent: {liveAnalytics.sentCount}</span>
              <span>Delivered: {liveAnalytics.deliveredCount}</span>
              <span className={liveAnalytics.droppedCount > 0 ? 'text-[var(--tone-danger)]' : ''}>
                Dropped: {liveAnalytics.droppedCount}
              </span>
              <span>Avg RTT: {liveAnalytics.avgLatencyMs}ms</span>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setDockSize((s) => (s === 'collapsed' ? 'compact' : 'collapsed'))}
                title={dockSize === 'collapsed' ? 'Expand Console Deck' : 'Collapse Console Deck'}
                aria-label={dockSize === 'collapsed' ? 'Expand Console Deck' : 'Collapse Console Deck'}
                className="flex h-6 w-6 items-center justify-center rounded border border-[var(--border-hairline)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                {dockSize === 'collapsed' ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
              <button
                type="button"
                onClick={() => setDockSize((s) => (s === 'expanded' ? 'compact' : 'expanded'))}
                title={dockSize === 'expanded' ? 'Compact Height' : 'Maximize Console Deck'}
                aria-label={dockSize === 'expanded' ? 'Compact Height' : 'Maximize Console Deck'}
                className="flex h-6 w-6 items-center justify-center rounded border border-[var(--border-hairline)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                {dockSize === 'expanded' ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
              </button>
            </div>
          </div>
        </div>

        {/* Dock Body */}
        {dockSize !== 'collapsed' && (
          <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
            {effectiveDockTab === 'capture' && (
              <div className="flex-1 min-h-0 overflow-y-auto">
                <div className="border-b border-[var(--border-hairline)] bg-[var(--bg-surface)] px-3 py-2">
                  <CaptureFilterBar
                    value={captureFilter}
                    validation={filterValidation}
                    matchedCount={filteredPackets.length}
                    totalCount={packets.length}
                    onChange={setCaptureFilter}
                    onClear={() => setCaptureFilter('')}
                  />
                </div>
                <PacketTable
                  packets={filteredPackets}
                  currentPacketIndex={Math.max(0, filteredPackets.length - 1)}
                  filenamePrefix="netpulse-sim-capture"
                  flat
                  onSelectPacket={(id) => setDockInspectedId(id)}
                  onInspectPacket={(id) => {
                    setDockInspectedId(id);
                    setDockTab('inspector');
                    setDockSize((s) => (s === 'collapsed' ? 'compact' : s));
                  }}
                  externalFilter={captureFilter}
                  totalPacketCount={packets.length}
                  onClearExternalFilter={() => setCaptureFilter('')}
                  hideInternalFilter
                />
              </div>
            )}

            {effectiveDockTab === 'logs' && <EventLogPanel logs={visibleLogs} devices={simDevices} />}

            {effectiveDockTab === 'inspector' && (
              <PacketInspectorContent
                packet={dockedInspectedPacket}
                defaultShowHex={settings.showHexByDefault}
                embedded
                onPopOut={
                  dockedInspectedPacket ? () => setModalInspectedId(dockedInspectedPacket.id) : undefined
                }
              />
            )}

            {effectiveDockTab === 'pdu' && (
              <PduPanel
                devices={simDevices}
                pdus={engine.pdus}
                packets={allPackets}
                onSend={handleSendPdu}
                onSelectEvent={(pkt) => {
                  setDockInspectedId(pkt.id);
                  if (playbackMode === 'step') {
                    const idx = allPackets.findIndex((p) => p.id === pkt.id);
                    if (idx >= 0) commitStepCursor(idx + 1);
                  }
                }}
                onInspect={(id) => {
                  setDockInspectedId(id);
                  setDockTab('inspector');
                }}
                selectedPacketId={dockInspectedId}
                pendingSourceId={pduSourceId}
                initialKind={pduKind}
                onKindChange={setPduKind}
              />
            )}

            {effectiveDockTab === 'terminal' && (
              <TerminalEmulator
                devices={simDevices}
                activeDeviceId={selectedDeviceId}
                onSelectDevice={(id) => setSelectedDeviceId(id)}
                onExecute={(devId, cmd) => {
                  const prevCount = engine.packets.length;
                  const out = engine.execCommand(devId, cmd);
                  syncAfterPacketEmission(prevCount);
                  // CLI configuration (ip address, shutdown, vlan...) is real: store it so it survives and can be undone.
                  const changed = engine.consumeConfigChanges();
                  if (changed) pushHistory(changed.devices, changed.links);
                  return out;
                }}
                getPrompt={(id) => engine.getCliPrompt(id)}
                isIos={(id) => engine.isIosDevice(id)}
                onComplete={(id, line) => engine.completeCli(id, line)}
                externalLogTrigger={externalLog}
              />
            )}

            {effectiveDockTab === 'metrics' && (
              <SimAnalyticsPanel
                analytics={liveAnalytics}
                playbackMode={playbackMode}
                visiblePacketCount={packets.length}
                totalPacketCount={allPackets.length}
              />
            )}

            {effectiveDockTab === 'tables' && (
              <div className="flex-1 min-h-0 overflow-y-auto p-3 grid gap-3 md:grid-cols-2 lg:grid-cols-4 font-mono text-xs">
                {!selectedDevice ? (
                  <div className="col-span-full text-[var(--text-muted)]">
                    {tc('Select a device on the canvas to inspect its ARP cache, MAC table, Routing table, and NAT translations.')}
                  </div>
                ) : (
                  <>
                    <div className="rounded border border-[var(--border-hairline)] bg-[var(--bg-inset)] p-2.5">
                      <div className="mb-1.5 font-bold text-[var(--accent-primary)]">{selectedDevice.name} · ARP Cache</div>
                      {selectedDevice.arpCache.length === 0 ? (
                        <div className="text-[var(--text-muted)]">{tc('(empty)')}</div>
                      ) : (
                        selectedDevice.arpCache.map((a, idx) => (
                          <div key={idx} className="flex justify-between py-0.5 border-b border-[var(--border-hairline)]/40">
                            <span>{a.ip}</span>
                            <span className="text-[var(--text-muted)]">{a.mac}</span>
                          </div>
                        ))
                      )}
                    </div>

                    <div className="rounded border border-[var(--border-hairline)] bg-[var(--bg-inset)] p-2.5">
                      <div className="mb-1.5 font-bold text-[var(--accent-primary)]">{selectedDevice.name} · Routing Table</div>
                      {selectedDevice.routingTable.length === 0 ? (
                        <div className="text-[var(--text-muted)]">{tc('(connected / default gw)')}</div>
                      ) : (
                        selectedDevice.routingTable.map((r, idx) => (
                          <div key={idx} className="flex justify-between py-0.5 border-b border-[var(--border-hairline)]/40">
                            <span>
                              {r.network}/{r.mask}
                            </span>
                            <span className="text-[var(--text-muted)]">via {r.nextHop}</span>
                          </div>
                        ))
                      )}
                    </div>

                    <div className="rounded border border-[var(--border-hairline)] bg-[var(--bg-inset)] p-2.5">
                      <div className="mb-1.5 font-bold text-[var(--accent-primary)]">{selectedDevice.name} · MAC Table</div>
                      {selectedDevice.macTable.length === 0 ? (
                        <div className="text-[var(--text-muted)]">{tc('(empty)')}</div>
                      ) : (
                        selectedDevice.macTable.map((m, idx) => (
                          <div key={idx} className="flex justify-between py-0.5 border-b border-[var(--border-hairline)]/40">
                            <span>{m.mac}</span>
                            <span className="text-[var(--text-muted)]">
                              V{m.vlan} · {m.portIfaceId}
                            </span>
                          </div>
                        ))
                      )}
                    </div>

                    <div className="rounded border border-[var(--border-hairline)] bg-[var(--bg-inset)] p-2.5">
                      <div className="mb-1.5 font-bold text-[var(--accent-primary)]">{selectedDevice.name} · NAT</div>
                      {selectedDevice.natTable.length === 0 ? (
                        <div className="text-[var(--text-muted)]">{tc('(no NAT sessions)')}</div>
                      ) : (
                        selectedDevice.natTable.map((n) => (
                          <div key={n.id} className="flex justify-between py-0.5 border-b border-[var(--border-hairline)]/40">
                            <span>
                              {n.insideLocalIp}:{n.insideLocalPort}
                            </span>
                            <span className="text-[var(--tone-success)]">
                              → {n.insideGlobalIp}:{n.insideGlobalPort}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </section>

      <PacketInspector
        packet={modalInspectedPacket}
        onClose={() => setModalInspectedId(null)}
        defaultShowHex={settings.showHexByDefault}
      />
    </div>
  );
};
