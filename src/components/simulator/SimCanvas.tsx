import { useWheelZoom } from '../../lib/useWheelZoom';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Cable, Camera, Check, Download, LayoutGrid, Maximize2, MessageSquarePlus, Plus, Radio, Redo2, Scissors, Table2, Trash2, Undo2, X, Zap, ZoomIn, ZoomOut, Mail, Clapperboard } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { CapturedPacket, DeviceRole, LinkMedium, SimDevice, SimLink } from '../../engine/types';
import { exportTopologyPng, prepareSvgForExport } from '../../lib/exportTopologyPng';
import { triggerDownload } from '../../lib/pcapWriter';
import { computeAnimatedPacketPosition, resolvePacketCurveGeometry } from '../../lib/simPlayback';
import { useAppStore } from '../../store/useAppStore';
import { formatPortLabel, IsometricHardwareArt } from '../icons/IsometricHardwareLibrary';
import { PACKET_COLORS } from '../explore/colors';
import { NodeTable } from './NodeTable';
import { tc } from '../../i18n/content';

export interface CanvasAnnotation {
  id: string;
  x: number;
  y: number;
  text: string;
}

export interface ConnectPortsPayload {
  sourceDeviceId: string;
  sourceIface: string;
  targetDeviceId: string;
  targetIface: string;
  medium: LinkMedium;
}

interface SimCanvasProps {
  devices: SimDevice[];
  links: SimLink[];
  packets: CapturedPacket[];
  selectedDeviceId: string | null;
  selectedLinkId: string | null;
  connectMode: boolean;
  linkMedium: LinkMedium;
  canUndo: boolean;
  canRedo: boolean;
  annotations: CanvasAnnotation[];
  onToggleConnectMode: (next?: boolean) => void;
  /** "Add PDU" mode: click a source device, then a destination, to send a test packet. */
  pduMode?: boolean;
  pduSourceName?: string | null;
  onTogglePduMode?: () => void;
  onChangeMedium: (medium: LinkMedium) => void;
  onSelectDevice: (id: string | null) => void;
  onSelectLink: (id: string | null) => void;
  onMoveDevice: (id: string, x: number, y: number) => void;
  onCommitMove: () => void;
  onConnectPorts: (payload: ConnectPortsPayload) => void;
  onToggleLinkUp: (linkId: string) => void;
  onDropNewDevice: (role: DeviceRole, x: number, y: number) => void;
  onDeleteSelected: () => void;
  onAutoLayout: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onAddAnnotation: (text: string) => void;
  onRemoveAnnotation: (id: string) => void;
  onInspectPacket: (id: string) => void;
  onOpenDockTables?: (deviceId: string) => void;
  topologyTitle?: string;
  activePacketId?: string | null;
  activePacketStateNote?: string | null;
  simPlaying?: boolean;
  stepDurationMs?: number;
  animationTick?: number;
  exportActionsRef?: React.MutableRefObject<{
    exportPng: () => Promise<Blob | null>;
    exportSvg: () => void;
    fitView?: () => void;
  } | null>;
}

const MULTI_PORT_ROLES = new Set<DeviceRole>([
  'router',
  'switch',
  'hub',
  'firewall',
  'nat_gateway',
  'access_point',
  'proxy',
  'reverse_proxy',
  'vpn_gateway',
  'cloud',
]);

const MEDIUM_META: Record<
  LinkMedium,
  { label: string; short: string; speed: string; color: string; dash?: string }
> = {
  ethernet: { label: 'Copper Ethernet', short: 'Eth', speed: '100M', color: '#10b981' },
  fiber: { label: 'Fiber Optic', short: 'Fiber', speed: '1G', color: '#22d3ee' },
  serial: { label: 'Serial WAN', short: 'WAN', speed: '10M', color: '#f59e0b', dash: '8 4 2 4' },
  wireless: { label: 'Wireless Wi-Fi', short: 'Wi-Fi', speed: '300M', color: '#818cf8', dash: '4 4' },
};

const PORT_OFFSETS: Array<{ dx: number; dy: number }> = [
  { dx: -40, dy: -10 },
  { dx: 40, dy: -10 },
  { dx: -40, dy: 14 },
  { dx: 40, dy: 14 },
  { dx: 0, dy: -40 },
  { dx: -22, dy: -36 },
  { dx: 22, dy: -36 },
];

function getNextFreePortName(dev: SimDevice): string {
  const existing = new Set(dev.interfaces.flatMap((i) => [i.name.toLowerCase(), i.id.toLowerCase()]));
  const prefix = dev.role === 'switch' || dev.role === 'hub' ? 'fa0/' : 'eth';
  let idx = dev.role === 'switch' || dev.role === 'hub' ? 1 : 0;
  while (existing.has(`${prefix}${idx}`)) idx++;
  return `${prefix}${idx}`;
}

export const SimCanvas: React.FC<SimCanvasProps> = ({
  devices,
  links,
  packets,
  selectedDeviceId,
  selectedLinkId,
  connectMode,
  linkMedium,
  canUndo,
  canRedo,
  annotations,
  onToggleConnectMode,
  pduMode = false,
  pduSourceName = null,
  onTogglePduMode,
  onChangeMedium,
  onSelectDevice,
  onSelectLink,
  onMoveDevice,
  onCommitMove,
  onConnectPorts,
  onToggleLinkUp,
  onDropNewDevice,
  onDeleteSelected,
  onAutoLayout,
  onUndo,
  onRedo,
  onAddAnnotation,
  onRemoveAnnotation,
  onInspectPacket,
  onOpenDockTables,
  topologyTitle,
  activePacketId,
  activePacketStateNote,
  simPlaying = false,
  stepDurationMs = 720,
  animationTick = 0,
  exportActionsRef,
}) => {
  const { t } = useTranslation();
  const { theme, settings } = useAppStore();
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [panning, setPanning] = useState<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const [hoveredDeviceId, setHoveredDeviceId] = useState<string | null>(null);
  const [hoveredLinkId, setHoveredLinkId] = useState<string | null>(null);
  const [noteInputOpen, setNoteInputOpen] = useState(false);
  const [noteDraft, setNoteDraft] = useState('');
  const [exportedPng, setExportedPng] = useState(false);
  const [travelProgress, setTravelProgress] = useState(1);
  const [dashOffset, setDashOffset] = useState(0);
  const [inspectedTableNodeId, setInspectedTableNodeId] = useState<string | null>(null);
  const [activeTableTab, setActiveTableTab] = useState<'arp' | 'routing' | 'nat' | 'mac'>('arp');

  // Interactive Drag-and-Drop / Click Rubber-Band Cabling Connection State
  const [activeWire, setActiveWire] = useState<{
    mode: 'drag' | 'click';
    sourceDeviceId: string;
    sourceIface: string;
    startX: number;
    startY: number;
    cursorX: number;
    cursorY: number;
    hasDragged: boolean;
    snapTarget: { deviceId: string; iface: string; x: number; y: number } | null;
  } | null>(null);
  const activeWireRef = useRef(activeWire);
  activeWireRef.current = activeWire;

  // Port Picker Popover (anchored over SVG coordinates)
  const [portPicker, setPortPicker] = useState<{
    step: 'source' | 'target';
    deviceId: string;
    sourceDeviceId?: string;
    sourceIface?: string;
    x: number;
    y: number;
  } | null>(null);

  const devMap = useMemo(() => new Map(devices.map((d) => [d.id, d])), [devices]);
  const recentPackets = useMemo(() => {
    if (activePacketId) {
      const idx = packets.findIndex((p) => p.id === activePacketId);
      if (idx >= 0) {
        return packets.slice(Math.max(0, idx - 3), idx + 1);
      }
    }
    return packets.slice(-5);
  }, [packets, activePacketId]);
  const activeStepPacket = useMemo(
    () => (activePacketId ? packets.find((p) => p.id === activePacketId) ?? null : null),
    [packets, activePacketId]
  );

  const latestPacketId = packets[packets.length - 1]?.id ?? null;
  const focusPacketId = activePacketId ?? latestPacketId;
  const focusPacket = useMemo(
    () => (focusPacketId ? packets.find((p) => p.id === focusPacketId) ?? null : null),
    [packets, focusPacketId]
  );

  const multiHopLinkSet = useMemo(() => {
    const set = new Set<string>();
    if (!focusPacket) return set;
    if (focusPacket.flowLinkIds?.length) {
      for (const lid of focusPacket.flowLinkIds) set.add(lid);
    } else if (focusPacket.linkId) {
      set.add(focusPacket.linkId);
    }
    return set;
  }, [focusPacket]);

  const multiHopNodeOrder = useMemo(() => {
    const map = new Map<string, number>();
    if (!focusPacket) return map;
    const nodes =
      focusPacket.flowPathNodeIds && focusPacket.flowPathNodeIds.length >= 2
        ? focusPacket.flowPathNodeIds
        : [focusPacket.fromDeviceId, focusPacket.toDeviceId];
    nodes.forEach((id, idx) => {
      if (!map.has(id)) map.set(id, idx + 1);
    });
    return map;
  }, [focusPacket]);

  const inspectedTableDevice = inspectedTableNodeId ? devMap.get(inspectedTableNodeId) ?? null : null;

  useEffect(() => {
    if (inspectedTableNodeId && !devMap.has(inspectedTableNodeId)) {
      setInspectedTableNodeId(null);
    }
  }, [inspectedTableNodeId, devMap]);

  const hopStartRef = useRef<number>(0);
  const lastFocusKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!focusPacketId) {
      lastFocusKeyRef.current = null;
      setTravelProgress(1);
      return;
    }
    if (!settings.animationsEnabled) {
      setTravelProgress(1);
      return;
    }

    const focusKey = `${focusPacketId}:${animationTick}:${simPlaying ? 'run' : 'idle'}`;
    if (lastFocusKeyRef.current !== focusKey) {
      lastFocusKeyRef.current = focusKey;
      hopStartRef.current = performance.now();
      setTravelProgress(0.06);
    }

    let rafId = 0;
    let last = performance.now();
    const duration = Math.max(150, stepDurationMs * 0.88);
    let active = true;

    const onFrame = (now: number) => {
      if (!active) return;
      const dt = now - last;
      last = now;

      const elapsed = now - hopStartRef.current;
      const raw = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - raw, 2.5);
      setTravelProgress(0.06 + eased * 0.94);

      if (simPlaying) {
        setDashOffset((prev) => (prev - dt * 0.045) % 24);
      }

      if (simPlaying || raw < 1) {
        rafId = requestAnimationFrame(onFrame);
      }
    };

    rafId = requestAnimationFrame(onFrame);
    return () => {
      active = false;
      cancelAnimationFrame(rafId);
    };
  }, [focusPacketId, animationTick, simPlaying, stepDurationMs, settings.animationsEnabled]);

  // Build map of connected port status per device+iface (keyed by both iface.id and iface.name)
  const portConnectionMap = useMemo(() => {
    const map = new Map<string, { link: SimLink; peerName: string; peerIface: string }>();
    for (const l of links) {
      const src = devMap.get(l.sourceId);
      const dst = devMap.get(l.targetId);
      const srcIfaceObj = src?.interfaces.find((i) => i.id === l.sourceIface || i.name === l.sourceIface);
      const dstIfaceObj = dst?.interfaces.find((i) => i.id === l.targetIface || i.name === l.targetIface);
      const srcDisplay = srcIfaceObj?.name ?? l.sourceIface;
      const dstDisplay = dstIfaceObj?.name ?? l.targetIface;

      const srcInfo = { link: l, peerName: dst?.name ?? l.targetId, peerIface: dstDisplay };
      const dstInfo = { link: l, peerName: src?.name ?? l.sourceId, peerIface: srcDisplay };

      map.set(`${l.sourceId}:${l.sourceIface}`, srcInfo);
      if (srcIfaceObj) {
        map.set(`${l.sourceId}:${srcIfaceObj.id}`, srcInfo);
        map.set(`${l.sourceId}:${srcIfaceObj.name}`, srcInfo);
      }

      map.set(`${l.targetId}:${l.targetIface}`, dstInfo);
      if (dstIfaceObj) {
        map.set(`${l.targetId}:${dstIfaceObj.id}`, dstInfo);
        map.set(`${l.targetId}:${dstIfaceObj.name}`, dstInfo);
      }
    }
    return map;
  }, [links, devMap]);

  // Calculate parallel curve offsets when multiple cables link the same two nodes
  const linkCurves = useMemo(() => {
    const pairCount = new Map<string, number>();
    const pairSeen = new Map<string, number>();
    for (const l of links) {
      const key = [l.sourceId, l.targetId].sort().join('::');
      pairCount.set(key, (pairCount.get(key) ?? 0) + 1);
    }
    const result = new Map<string, number>();
    for (const l of links) {
      const key = [l.sourceId, l.targetId].sort().join('::');
      const total = pairCount.get(key) ?? 1;
      const idx = pairSeen.get(key) ?? 0;
      pairSeen.set(key, idx + 1);
      if (total <= 1) {
        result.set(l.id, 0);
      } else {
        const centered = idx - (total - 1) / 2;
        result.set(l.id, centered * 28);
      }
    }
    return result;
  }, [links]);

  // Cancel active wiring on Escape or shortcut C to toggle Connect Mode
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const inInput =
        target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT');
      if (inInput) return;

      if (e.key === 'Escape') {
        if (inspectedTableNodeId) {
          setInspectedTableNodeId(null);
        }
        if (activeWire || portPicker || connectMode) {
          setActiveWire(null);
          setPortPicker(null);
          onToggleConnectMode(false);
        }
      } else if (e.key.toLowerCase() === 'c' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setActiveWire(null);
        setPortPicker(null);
        onToggleConnectMode(!connectMode);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeWire, portPicker, connectMode, onToggleConnectMode, inspectedTableNodeId]);

  const vbW = 1000 / zoom;
  const vbH = 520 / zoom;

  const clientToSvgCoords = (clientX: number, clientY: number, snapGrid = true) => {
    const svg = svgRef.current;
    if (!svg) return { x: 400, y: 240 };
    const rect = svg.getBoundingClientRect();
    const relX = (clientX - rect.left) / rect.width;
    const relY = (clientY - rect.top) / rect.height;
    const rawX = pan.x + relX * vbW;
    const rawY = pan.y + relY * vbH;
    return snapGrid
      ? { x: Math.round(rawX / 10) * 10, y: Math.round(rawY / 10) * 10 }
      : { x: rawX, y: rawY };
  };

  const getDevicePortCoords = (dev: SimDevice, ifaceKey: string) => {
    const idx = dev.interfaces.findIndex((i) => i.id === ifaceKey || i.name === ifaceKey);
    if (idx >= 0) {
      const offset = PORT_OFFSETS[idx % PORT_OFFSETS.length];
      return { x: dev.x + offset.dx, y: dev.y + offset.dy };
    }
    if (MULTI_PORT_ROLES.has(dev.role) && dev.interfaces.length < 6 && ifaceKey === getNextFreePortName(dev)) {
      const offset = PORT_OFFSETS[dev.interfaces.length % PORT_OFFSETS.length];
      return { x: dev.x + offset.dx, y: dev.y + offset.dy };
    }
    return { x: dev.x, y: dev.y };
  };

  // Find nearest valid free port handle (or free-port device fallback) for rubber-band wire snapping
  const findSnapTarget = (cursorX: number, cursorY: number, excludeDeviceId: string) => {
    let best: { deviceId: string; iface: string; x: number; y: number; dist: number } | null = null;

    for (const dev of devices) {
      if (dev.id === excludeDeviceId) continue;

      // 1. Snap specifically to free existing port handles
      dev.interfaces.slice(0, 6).forEach((iface, idx) => {
        if (portConnectionMap.has(`${dev.id}:${iface.name}`)) return; // occupied port is not a free snap target
        const offset = PORT_OFFSETS[idx % PORT_OFFSETS.length];
        const px = dev.x + offset.dx;
        const py = dev.y + offset.dy;
        const dist = Math.hypot(cursorX - px, cursorY - py);
        if (dist < 28 && (!best || dist < best.dist)) {
          best = { deviceId: dev.id, iface: iface.name, x: px, y: py, dist };
        }
      });

      // 2. Snap to "+ New Port" handle on multi-port infrastructure devices
      if (MULTI_PORT_ROLES.has(dev.role) && dev.interfaces.length < 6) {
        const nextName = getNextFreePortName(dev);
        const pos = PORT_OFFSETS[dev.interfaces.length % PORT_OFFSETS.length];
        const px = dev.x + pos.dx;
        const py = dev.y + pos.dy;
        const dist = Math.hypot(cursorX - px, cursorY - py);
        if (dist < 28 && (!best || dist < best.dist)) {
          best = { deviceId: dev.id, iface: nextName, x: px, y: py, dist };
        }
      }

      // 3. Fallback snap onto device body ONLY if it has a valid free port available
      const bodyDist = Math.hypot(cursorX - dev.x, cursorY - dev.y);
      if (bodyDist < 44) {
        const freeIface = dev.interfaces.find((i) => !portConnectionMap.has(`${dev.id}:${i.name}`));
        const chosenIface = freeIface
          ? freeIface.name
          : MULTI_PORT_ROLES.has(dev.role)
          ? getNextFreePortName(dev)
          : null;
        if (chosenIface) {
          const portPos = getDevicePortCoords(dev, chosenIface);
          if (!best || bodyDist < best.dist) {
            best = { deviceId: dev.id, iface: chosenIface, x: portPos.x, y: portPos.y, dist: bodyDist };
          }
        }
      }
    }

    return best ? { deviceId: best.deviceId, iface: best.iface, x: best.x, y: best.y } : null;
  };

  const startWireFromPort = (
    dev: SimDevice,
    ifaceName: string,
    portX: number,
    portY: number,
    mode: 'drag' | 'click'
  ) => {
    setPortPicker(null);
    setDraggingId(null);
    setPanning(null);
    setActiveWire({
      mode,
      sourceDeviceId: dev.id,
      sourceIface: ifaceName,
      startX: portX,
      startY: portY,
      cursorX: portX,
      cursorY: portY,
      hasDragged: false,
      snapTarget: null,
    });
  };

  const completeWire = (targetDeviceId: string, targetIface: string) => {
    if (!activeWire) return;
    if (activeWire.sourceDeviceId === targetDeviceId) {
      setActiveWire(null);
      return;
    }
    onConnectPorts({
      sourceDeviceId: activeWire.sourceDeviceId,
      sourceIface: activeWire.sourceIface,
      targetDeviceId,
      targetIface,
      medium: linkMedium,
    });
    setActiveWire(null);
    setPortPicker(null);
  };

  // Window-level pointer/mouse tracking during active rubber-band wiring so drags never get lost at canvas edges
  useEffect(() => {
    if (!activeWire) return;

    const onWindowPointerMove = (e: PointerEvent) => {
      const current = activeWireRef.current;
      if (!current) return;
      const coords = clientToSvgCoords(e.clientX, e.clientY, false);
      const snapTarget = findSnapTarget(coords.x, coords.y, current.sourceDeviceId);
      const moved = Math.hypot(coords.x - current.startX, coords.y - current.startY);
      const nextWire = {
        ...current,
        hasDragged: current.hasDragged || moved > 8,
        cursorX: snapTarget ? snapTarget.x : coords.x,
        cursorY: snapTarget ? snapTarget.y : coords.y,
        snapTarget,
      };
      activeWireRef.current = nextWire;
      setActiveWire(nextWire);
    };

    const onWindowPointerUp = () => {
      const current = activeWireRef.current;
      if (!current) return;
      if (current.mode === 'drag') {
        if (current.snapTarget && current.snapTarget.deviceId !== current.sourceDeviceId) {
          activeWireRef.current = null;
          setActiveWire(null);
          setPortPicker(null);
          onConnectPorts({
            sourceDeviceId: current.sourceDeviceId,
            sourceIface: current.sourceIface,
            targetDeviceId: current.snapTarget.deviceId,
            targetIface: current.snapTarget.iface,
            medium: linkMedium,
          });
          return;
        }
        // If user clicked a port handle cleanly without dragging away, stay in click-wiring mode
        if (!current.hasDragged) {
          const clickWire = { ...current, mode: 'click' as const };
          activeWireRef.current = clickWire;
          setActiveWire(clickWire);
          return;
        }
        activeWireRef.current = null;
        setActiveWire(null);
      }
    };

    window.addEventListener('pointermove', onWindowPointerMove);
    window.addEventListener('pointerup', onWindowPointerUp);
    return () => {
      window.removeEventListener('pointermove', onWindowPointerMove);
      window.removeEventListener('pointerup', onWindowPointerUp);
    };
  });

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (activeWire) return; // handled smoothly by window pointermove

    if (draggingId) {
      const coords = clientToSvgCoords(e.clientX, e.clientY, true);
      onMoveDevice(draggingId, Math.max(40, Math.min(960, coords.x)), Math.max(40, Math.min(480, coords.y)));
    } else if (panning && svgRef.current) {
      const rect = svgRef.current.getBoundingClientRect();
      const dx = ((e.clientX - panning.startX) / rect.width) * vbW;
      const dy = ((e.clientY - panning.startY) / rect.height) * vbH;
      setPan({ x: panning.origX - dx, y: panning.origY - dy });
    }
  };

  const handleMouseUp = () => {
    if (draggingId) {
      setDraggingId(null);
      onCommitMove();
    }
    setPanning(null);
  };

  const zoomAtPoint = (nextZoomRaw: number, anchorX: number, anchorY: number) => {
    const nextZoom = Math.max(0.55, Math.min(2.4, Number(nextZoomRaw.toFixed(2))));
    const nextW = 1000 / nextZoom;
    const nextH = 520 / nextZoom;
    const relX = (anchorX - pan.x) / vbW;
    const relY = (anchorY - pan.y) / vbH;
    setZoom(nextZoom);
    setPan({
      x: anchorX - relX * nextW,
      y: anchorY - relY * nextH,
    });
  };

  useWheelZoom(svgRef, (factor, clientX, clientY) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const anchorX = pan.x + ((clientX - rect.left) / rect.width) * vbW;
    const anchorY = pan.y + ((clientY - rect.top) / rect.height) * vbH;
    stopCamera();
    zoomAtPoint(zoom * factor, anchorX, anchorY);
  });

  const resetZoom = () => {
    stopCamera();
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const handleFitView = () => {
    stopCamera();
    if (devices.length === 0) {
      setZoom(1);
      setPan({ x: 0, y: 0 });
      return;
    }
    const minX = Math.min(...devices.map((d) => d.x)) - 90;
    const maxX = Math.max(...devices.map((d) => d.x)) + 90;
    const minY = Math.min(...devices.map((d) => d.y)) - 80;
    const maxY = Math.max(...devices.map((d) => d.y)) + 95;
    const spanX = Math.max(320, maxX - minX);
    const spanY = Math.max(200, maxY - minY);
    const nextZoom = Math.max(0.65, Math.min(1.4, Math.min(1000 / spanX, 520 / spanY)));
    setZoom(Number(nextZoom.toFixed(2)));
    setPan({
      x: Math.max(-100, minX + spanX / 2 - 500 / nextZoom),
      y: Math.max(-80, minY + spanY / 2 - 260 / nextZoom),
    });
  };

  // Follow camera: while packets are playing or being stepped, glide to the devices they travel between.
  // Editing stays untouched (nothing moves when idle) and any manual zoom or pan switches it off.
  const [cameraOn, setCameraOn] = useState(true);
  const viewRef = useRef({ zoom: 1, panX: 0, panY: 0 });
  viewRef.current = { zoom, panX: pan.x, panY: pan.y };
  const animRef = useRef<number | null>(null);

  const glideTo = (toZoom: number, toX: number, toY: number) => {
    if (animRef.current !== null) cancelAnimationFrame(animRef.current);
    const from = { ...viewRef.current };
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    if (reduce || typeof requestAnimationFrame === 'undefined') {
      setZoom(toZoom);
      setPan({ x: toX, y: toY });
      return;
    }
    const start = performance.now();
    const dur = 520;
    const ease = (v: number) => 1 - Math.pow(1 - v, 3);
    const tick = (now: number) => {
      const k = ease(Math.min(1, (now - start) / dur));
      setZoom(from.zoom + (toZoom - from.zoom) * k);
      setPan({ x: from.panX + (toX - from.panX) * k, y: from.panY + (toY - from.panY) * k });
      animRef.current = k < 1 ? requestAnimationFrame(tick) : null;
    };
    animRef.current = requestAnimationFrame(tick);
  };

  const stopCamera = () => {
    if (animRef.current !== null) cancelAnimationFrame(animRef.current);
    animRef.current = null;
    setCameraOn(false);
  };

  useEffect(
    () => () => {
      if (animRef.current !== null) cancelAnimationFrame(animRef.current);
    },
    []
  );

  const cameraActive = cameraOn && Boolean(focusPacket) && (simPlaying || Boolean(activePacketId));
  const cameraIds = (() => {
    if (!focusPacket) return '';
    // One hop when stepping; the whole route while live traffic flows.
    const ids = activePacketId
      ? [focusPacket.fromDeviceId, focusPacket.toDeviceId]
      : focusPacket.flowPathNodeIds && focusPacket.flowPathNodeIds.length >= 2
      ? focusPacket.flowPathNodeIds
      : [focusPacket.fromDeviceId, focusPacket.toDeviceId];
    return Array.from(new Set(ids)).sort().join('~');
  })();
  useEffect(() => {
    if (!cameraActive || !cameraIds) return;
    const set = devices.filter((d) => cameraIds.split('~').includes(d.id));
    if (set.length === 0) return;
    const minX = Math.min(...set.map((d) => d.x)) - 150;
    const maxX = Math.max(...set.map((d) => d.x)) + 150;
    const minY = Math.min(...set.map((d) => d.y)) - 120;
    const maxY = Math.max(...set.map((d) => d.y)) + 130;
    const spanX = Math.max(300, maxX - minX);
    const spanY = Math.max(190, maxY - minY);
    const z = Number(Math.max(0.7, Math.min(1.8, Math.min(1000 / spanX, 520 / spanY))).toFixed(3));
    glideTo(z, minX + spanX / 2 - 500 / z, minY + spanY / 2 - 260 / z);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraActive, cameraIds]);

  const exportSvg = () => {
    if (!svgRef.current) return;
    const raw = prepareSvgForExport(svgRef.current, theme);
    triggerDownload(new Blob([raw], { type: 'image/svg+xml;charset=utf-8' }), 'netpulse-simulator-topology.svg');
  };

  const exportPng = async () => {
    if (!svgRef.current) return null;
    const caption = topologyTitle ? `NetPulse · ${topologyTitle}` : 'NetPulse Network Topology';
    const blob = await exportTopologyPng({
      svgElement: svgRef.current,
      theme,
      filename: 'netpulse-simulator-topology.png',
      caption,
    });
    if (blob) {
      setExportedPng(true);
      setTimeout(() => setExportedPng(false), 1600);
    }
    return blob;
  };

  useEffect(() => {
    if (!exportActionsRef) return;
    exportActionsRef.current = { exportPng, exportSvg, fitView: handleFitView };
    return () => {
      exportActionsRef.current = null;
    };
  });

  const activeLinkObj = useMemo(
    () => links.find((l) => l.id === (selectedLinkId ?? hoveredLinkId)) ?? null,
    [links, selectedLinkId, hoveredLinkId]
  );

  const pickerDevice = portPicker ? devMap.get(portPicker.deviceId) ?? null : null;

  return (
    <div
      ref={containerRef}
      className="hud-panel relative flex-1 min-h-[260px] flex flex-col blueprint-grid overflow-hidden"
    >
      {/* Floating Canvas HUD Bar (Top) */}
      <div className="@container shrink-0 flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-hairline)] bg-[var(--bg-surface)]/92 backdrop-blur-sm px-3 py-1.5 z-10">
        {/* Left: Edit & Viewport Tools */}
        <div className="flex flex-wrap items-center gap-1">
          <button
            type="button"
            onClick={onUndo}
            disabled={!canUndo}
            title={tc('Undo (Ctrl+Z)')}
            aria-label={tc('Undo')}
            className="flex h-7 w-7 items-center justify-center rounded border border-[var(--border-hairline)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-35"
          >
            <Undo2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onRedo}
            disabled={!canRedo}
            title={tc('Redo (Ctrl+Y)')}
            aria-label={tc('Redo')}
            className="flex h-7 w-7 items-center justify-center rounded border border-[var(--border-hairline)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-35"
          >
            <Redo2 className="w-3.5 h-3.5" />
          </button>

          <span className="mx-1 h-4 w-px bg-[var(--border-hairline)]" aria-hidden="true" />

          <div className="inline-flex items-center rounded border border-[var(--border-hairline)] bg-[var(--bg-inset)] p-0.5">
            <button
              type="button"
              onClick={() => {
                stopCamera();
                zoomAtPoint(zoom - 0.15, pan.x + vbW / 2, pan.y + vbH / 2);
              }}
              title={tc('Zoom Out')}
              aria-label={tc('Zoom Out')}
              className="flex h-6 w-6 items-center justify-center rounded text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)]"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={resetZoom}
              title={tc('Reset Zoom (100%)')}
              aria-label={tc('Reset Zoom')}
              className="px-1.5 font-mono text-[11px] font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] tabular-nums"
            >
              {Math.round(zoom * 100)}%
            </button>
            <button
              type="button"
              onClick={() => {
                stopCamera();
                zoomAtPoint(zoom + 0.15, pan.x + vbW / 2, pan.y + vbH / 2);
              }}
              title={tc('Zoom In')}
              aria-label={tc('Zoom In')}
              className="flex h-6 w-6 items-center justify-center rounded text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)]"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>
          <button
            type="button"
            onClick={() => setCameraOn((on) => !on)}
            aria-pressed={cameraOn}
            title={t('explore.cameraHint')}
            aria-label={t('explore.camera')}
            className={`flex h-7 items-center gap-1 rounded border px-2 text-xs whitespace-nowrap shrink-0 ${
              cameraOn
                ? 'border-[var(--accent-primary)] bg-[var(--accent-primary-soft)] font-semibold text-[var(--accent-primary)]'
                : 'border-[var(--border-hairline)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Clapperboard className="w-3 h-3" />
            <span className="hidden @3xl:inline">{t('explore.camera')}</span>
          </button>
          <button
            type="button"
            onClick={handleFitView}
            title={tc('Fit Topology')}
            aria-label={tc('Fit Topology')}
            className="flex h-7 items-center gap-1 rounded border border-[var(--border-hairline)] px-2 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] whitespace-nowrap shrink-0"
          >
            <Maximize2 className="w-3 h-3" />
            <span className="hidden @3xl:inline">{t('simulator.fitTopology')}</span>
          </button>
          <button
            type="button"
            onClick={onAutoLayout}
            title={t('simulator.autoLayout')}
            aria-label={t('simulator.autoLayout')}
            className="flex h-7 items-center gap-1 rounded border border-[var(--border-hairline)] px-2 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] whitespace-nowrap shrink-0"
          >
            <LayoutGrid className="w-3 h-3" />
            <span className="hidden @3xl:inline">{t('simulator.autoLayout')}</span>
          </button>
          <button
            type="button"
            onClick={() => setNoteInputOpen(!noteInputOpen)}
            title={t('simulator.addNote')}
            aria-label={t('simulator.addNote')}
            className="flex h-7 items-center gap-1 rounded border border-[var(--border-hairline)] px-2 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] whitespace-nowrap shrink-0"
          >
            <MessageSquarePlus className="w-3 h-3" />
            <span className="hidden @3xl:inline">{t('simulator.addNote')}</span>
          </button>

          <span className="mx-1 h-4 w-px bg-[var(--border-hairline)]" aria-hidden="true" />

          {/* Quick Cable Connect Tool + Medium Selector right on Canvas HUD */}
          <button
            type="button"
            onClick={() => {
              setActiveWire(null);
              setPortPicker(null);
              onToggleConnectMode(!connectMode);
            }}
            aria-pressed={connectMode}
            title={tc('Connect Cable (Shortcut: C)')}
            aria-label={connectMode ? t('simulator.cancelConnect') : t('simulator.connectCable')}
            className={`flex h-7 items-center gap-1.5 rounded border px-2.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
              connectMode
                ? 'border-[var(--accent-cta)] bg-[var(--accent-cta)] text-[var(--on-accent)] shadow-sm'
                : 'border-[var(--border-hairline)] bg-[var(--bg-inset)] text-[var(--text-primary)] hover:border-[var(--accent-primary)]/60'
            }`}
          >
            <Cable className="w-3.5 h-3.5" />
            <span className="hidden @xl:inline">{connectMode ? t('simulator.cancelConnect') : t('simulator.connectCable')}</span>
          </button>

          {onTogglePduMode && (
            <button
              type="button"
              onClick={() => {
                setActiveWire(null);
                setPortPicker(null);
                onToggleConnectMode(false);
                onTogglePduMode();
              }}
              aria-pressed={pduMode}
              title={t('pdu.addTooltip')}
              aria-label={pduMode ? t('pdu.cancel') : t('pdu.add')}
              className={`flex h-7 items-center gap-1.5 rounded border px-2.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                pduMode
                  ? 'border-[var(--accent-cta)] bg-[var(--accent-cta)] text-[var(--on-accent)] shadow-sm'
                  : 'border-[var(--border-hairline)] bg-[var(--bg-inset)] text-[var(--text-primary)] hover:border-[var(--accent-primary)]/60'
              }`}
            >
              <Mail className="w-3.5 h-3.5" />
              <span className="hidden @xl:inline">{pduMode ? t('pdu.cancel') : t('pdu.add')}</span>
            </button>
          )}

          <div
            role="group"
            aria-label={tc('Cable Medium')}
            className="hidden @4xl:flex items-center rounded border border-[var(--border-hairline)] bg-[var(--bg-inset)] p-0.5"
          >
            {(['ethernet', 'fiber', 'serial', 'wireless'] as LinkMedium[]).map((med) => {
              const m = MEDIUM_META[med];
              const active = linkMedium === med;
              return (
                <button
                  key={med}
                  type="button"
                  onClick={() => onChangeMedium(med)}
                  title={`${m.label} (${m.speed}bps)`}
                  className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-mono transition-colors whitespace-nowrap shrink-0 ${
                    active
                      ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] font-semibold shadow-xs'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <span
                    className="inline-block h-1.5 w-2.5 rounded-xs"
                    style={{ backgroundColor: m.color }}
                    aria-hidden="true"
                  />
                  <span>{m.short}</span>
                </button>
              );
            })}
          </div>

          {(selectedDeviceId || selectedLinkId) && (
            <button
              type="button"
              onClick={onDeleteSelected}
              aria-label={t('simulator.deleteSelected')}
              className="flex h-7 items-center gap-1 rounded border border-[var(--tone-danger)]/45 bg-[var(--tone-danger)]/10 px-2 text-xs font-medium text-[var(--tone-danger)] hover:bg-[var(--tone-danger)]/20 whitespace-nowrap shrink-0"
            >
              <Trash2 className="w-3 h-3" />
              <span className="hidden @xl:inline">{t('simulator.deleteSelected')}</span>
            </button>
          )}
        </div>

        {/* Right: Topology Count + SVG/PNG Export */}
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="hidden @4xl:inline font-mono text-xs text-[var(--text-muted)] tabular-nums me-1">
            {devices.length} {t('simulator.nodes')} · {links.length} {t('simulator.links')}
          </span>
          <button
            type="button"
            onClick={exportSvg}
            title={t('simulator.exportSvg')}
            aria-label={t('simulator.exportSvg')}
            className="flex h-7 items-center gap-1 rounded border border-[var(--border-hairline)] px-2 text-xs font-mono text-[var(--text-secondary)] hover:text-[var(--text-primary)] whitespace-nowrap shrink-0"
          >
            <Download className="w-3 h-3" /> <span className="hidden @4xl:inline">SVG</span>
          </button>
          <button
            type="button"
            onClick={() => void exportPng()}
            title={t('simulator.exportPngTooltip')}
            aria-label={t('simulator.exportPng')}
            className={`flex h-7 items-center gap-1 rounded border px-2 text-xs font-mono whitespace-nowrap shrink-0 transition-colors ${
              exportedPng
                ? 'border-[var(--tone-success)] bg-[var(--tone-success)]/12 text-[var(--tone-success)]'
                : 'border-[var(--border-hairline)] text-[var(--text-secondary)] hover:border-[var(--accent-primary)] hover:text-[var(--text-primary)]'
            }`}
          >
            {exportedPng ? <Check className="w-3 h-3" /> : <Camera className="w-3 h-3" />}
            <span className="hidden @4xl:inline">{exportedPng ? t('simulator.exportedPng') : 'PNG'}</span>
          </button>
        </div>
      </div>

      {/* Inline Annotation Input */}
      {noteInputOpen && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (noteDraft.trim()) {
              onAddAnnotation(noteDraft.trim());
              setNoteDraft('');
              setNoteInputOpen(false);
            }
          }}
          className="flex items-center gap-2 border-b border-[var(--border-hairline)] bg-[var(--bg-inset)] px-3 py-1.5 z-10"
        >
          <input
            type="text"
            value={noteDraft}
            onChange={(e) => setNoteDraft(e.target.value)}
            placeholder={tc('Add topology annotation (e.g. \'DMZ 203.0.113.0/24\')...')}
            className="flex-1 rounded border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-2.5 py-1 text-xs text-[var(--text-primary)]"
          />
          <button type="submit" className="rounded bg-[var(--accent-cta)] hover:bg-[var(--accent-cta-hover)] px-3 py-1 text-xs font-semibold text-[var(--on-accent)]">
            {tc('Add')}
          </button>
        </form>
      )}

      {/* Interactive SVG Topology Stage */}
      <div
        className="relative flex-1 min-h-[220px] w-full overflow-hidden"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const role = e.dataTransfer.getData('application/netpulse-device-role') as DeviceRole;
          if (role) {
            const coords = clientToSvgCoords(e.clientX, e.clientY, true);
            onDropNewDevice(role, coords.x, coords.y);
          }
        }}
      >
        <svg
          ref={svgRef}
          viewBox={`${pan.x} ${pan.y} ${vbW} ${vbH}`}
          data-animation-tick={animationTick}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onMouseDown={(e) => {
            if (e.target === svgRef.current) {
              setPortPicker(null);
              setInspectedTableNodeId(null);
              if (activeWire) {
                setActiveWire(null);
                return;
              }
              onSelectDevice(null);
              onSelectLink(null);
              stopCamera();
              setPanning({ startX: e.clientX, startY: e.clientY, origX: pan.x, origY: pan.y });
            }
          }}
          className={`h-full w-full select-none ${
            activeWire || connectMode ? 'cursor-crosshair' : 'cursor-grab active:cursor-grabbing'
          }`}
          role="img"
          aria-label={tc('Interactive network simulator canvas')}
        >
          <defs>
            <filter id="simWireGlow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="2.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Physical Cables / Links */}
          {links.map((l) => {
            const a = devMap.get(l.sourceId);
            const b = devMap.get(l.targetId);
            if (!a || !b) return null;

            const selected = selectedLinkId === l.id;
            const hovered = hoveredLinkId === l.id;
            const isStepActiveLink = focusPacket?.linkId === l.id;
            const isMultiHopLink = multiHopLinkSet.has(l.id);
            const medMeta = MEDIUM_META[l.medium];
            const stroke = !l.up
              ? '#ef4444'
              : selected || hovered || isStepActiveLink || isMultiHopLink
              ? 'var(--accent-primary)'
              : medMeta.color;

            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const len = Math.max(1, Math.hypot(dx, dy));
            const ux = dx / len;
            const uy = dy / len;
            const nx = -uy;
            const ny = ux;
            const curveOffset = linkCurves.get(l.id) ?? 0;

            const mx = (a.x + b.x) / 2 + nx * curveOffset;
            const my = (a.y + b.y) / 2 + ny * curveOffset;
            const pathD =
              curveOffset === 0
                ? `M ${a.x} ${a.y} L ${b.x} ${b.y}`
                : `M ${a.x} ${a.y} Q ${mx} ${my} ${b.x} ${b.y}`;

            // RJ45/SFP connector boots & LED dot positions near endpoints (approx 44px out from center)
            const bootDist = Math.min(44, len * 0.35);
            const bootAx = a.x + ux * bootDist + nx * (curveOffset * 0.3);
            const bootAy = a.y + uy * bootDist + ny * (curveOffset * 0.3);
            const bootBx = b.x - ux * bootDist + nx * (curveOffset * 0.3);
            const bootBy = b.y - uy * bootDist + ny * (curveOffset * 0.3);

            return (
              <g
                key={l.id}
                onMouseEnter={() => setHoveredLinkId(l.id)}
                onMouseLeave={() => setHoveredLinkId(null)}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectLink(l.id);
                  onSelectDevice(null);
                  setInspectedTableNodeId(null);
                }}
                className="cursor-pointer"
              >
                {/* Wide invisible hit target */}
                <path d={pathD} fill="none" stroke="transparent" strokeWidth={16} />

                {/* End-to-End Multi-Hop Path Highlight Halo */}
                {l.up && isMultiHopLink && (
                  <path
                    data-multihop-link={l.id}
                    d={pathD}
                    fill="none"
                    stroke={isStepActiveLink ? 'var(--accent-teal)' : 'var(--accent-primary)'}
                    strokeOpacity={isStepActiveLink ? 0.36 : 0.24}
                    strokeWidth={isStepActiveLink ? 8.5 : 7}
                    strokeLinecap="round"
                    style={settings.animationsEnabled ? { transition: 'stroke-opacity 180ms ease' } : undefined}
                  />
                )}

                {/* Fiber outer cladding halo */}
                {l.medium === 'fiber' && l.up && (
                  <path
                    d={pathD}
                    fill="none"
                    stroke="#22d3ee"
                    strokeOpacity={0.22}
                    strokeWidth={selected ? 8 : 6}
                    strokeLinecap="round"
                  />
                )}

                {/* Main cable trace */}
                <path
                  d={pathD}
                  fill="none"
                  stroke={stroke}
                  strokeWidth={selected ? 3.5 : hovered || isStepActiveLink ? 3 : isMultiHopLink ? 2.8 : 2.25}
                  strokeDasharray={!l.up ? '6 4' : medMeta.dash}
                  strokeLinecap="round"
                />

                {/* Animated traffic stream on the active hop or multi-hop flow, flowing the way the packet travels */}
                {l.up && (isStepActiveLink || isMultiHopLink) && (() => {
                  const path = focusPacket?.flowPathNodeIds;
                  const ia = path ? path.indexOf(l.sourceId) : -1;
                  const ib = path ? path.indexOf(l.targetId) : -1;
                  const reversed =
                    isStepActiveLink && focusPacket
                      ? focusPacket.fromDeviceId === l.targetId
                      : ia >= 0 && ib >= 0 && ib < ia;
                  const color = isStepActiveLink ? 'var(--accent-teal)' : 'var(--accent-primary)';
                  const angle = (Math.atan2(dy, dx) * 180) / Math.PI + (reversed ? 180 : 0);
                  return (
                    <>
                      <path
                        d={pathD}
                        fill="none"
                        stroke={color}
                        strokeWidth={isStepActiveLink ? 3.5 : 2.5}
                        strokeOpacity={isStepActiveLink ? 0.9 : 0.6}
                        strokeLinecap="round"
                        className={settings.animationsEnabled ? `link-flow${reversed ? ' link-flow-rev' : ''}` : undefined}
                        strokeDasharray={settings.animationsEnabled ? undefined : '6 6'}
                      />
                      {/* direction chevron at the middle of the cable */}
                      <path
                        d="M-6 -5 L6 0 L-6 5 Z"
                        fill={color}
                        stroke="var(--wire-base)"
                        strokeWidth={1}
                        strokeLinejoin="round"
                        transform={`translate(${mx}, ${my}) rotate(${angle})`}
                      />
                    </>
                  );
                })()}

                {/* Physical Link LEDs near both ends */}
                {len > 90 && (
                  <>
                    <circle
                      cx={bootAx}
                      cy={bootAy}
                      r={3.2}
                      fill={l.up ? '#22c55e' : '#ef4444'}
                      stroke="#060b16"
                      strokeWidth={1}
                    />
                    <circle
                      cx={bootBx}
                      cy={bootBy}
                      r={3.2}
                      fill={l.up ? '#22c55e' : '#ef4444'}
                      stroke="#060b16"
                      strokeWidth={1}
                    />
                  </>
                )}

                {/* Midpoint port/medium pill when selected or hovered */}
                {(selected || hovered) && l.up && (
                  <g transform={`translate(${mx}, ${my})`}>
                    <rect
                      x={-48}
                      y={-11}
                      width={96}
                      height={18}
                      rx={4}
                      fill="var(--bg-surface)"
                      stroke={stroke}
                      strokeWidth={1}
                    />
                    <text
                      x={0}
                      y={1.5}
                      textAnchor="middle"
                      className="fill-[var(--text-primary)] text-[8.5px] font-mono font-semibold"
                    >
                      {l.sourceIface} ↔ {l.targetIface}
                    </text>
                  </g>
                )}

                {!l.up && (
                  <g transform={`translate(${mx}, ${my})`}>
                    <circle r={9.5} fill="#450a0a" stroke="#ef4444" strokeWidth={1.6} />
                    <path d="M-4 -4 L4 4 M4 -4 L-4 4" stroke="#ef4444" strokeWidth={2} strokeLinecap="round" />
                  </g>
                )}

                {l.lossPercent > 0 && l.up && (
                  <text x={mx} y={my - 14} textAnchor="middle" className="fill-amber-400 text-[11px] font-mono font-semibold">
                    {l.lossPercent}% loss
                  </text>
                )}
              </g>
            );
          })}

          {/* Live Rubber-Band Cabling Preview */}
          {activeWire && (
            <g pointerEvents="none" filter="url(#simWireGlow)">
              {(() => {
                const med = MEDIUM_META[linkMedium];
                const midX = (activeWire.startX + activeWire.cursorX) / 2;
                const midY = (activeWire.startY + activeWire.cursorY) / 2 - 22;
                const d = `M ${activeWire.startX} ${activeWire.startY} Q ${midX} ${midY} ${activeWire.cursorX} ${activeWire.cursorY}`;
                return (
                  <>
                    <path
                      d={d}
                      fill="none"
                      stroke={med.color}
                      strokeWidth={2.75}
                      strokeDasharray={med.dash ?? '6 3'}
                      strokeLinecap="round"
                    />
                    <circle cx={activeWire.startX} cy={activeWire.startY} r={5} fill={med.color} stroke="#fff" strokeWidth={1.5} />
                    {activeWire.snapTarget ? (
                      <>
                        <circle
                          cx={activeWire.snapTarget.x}
                          cy={activeWire.snapTarget.y}
                          r={10}
                          fill={med.color}
                          fillOpacity={0.22}
                          stroke="#ffffff"
                          strokeWidth={1.8}
                        />
                        <g transform={`translate(${activeWire.snapTarget.x}, ${activeWire.snapTarget.y - 22})`}>
                          <rect x={-64} y={-11} width={128} height={19} rx={4} fill="var(--bg-surface)" stroke={med.color} strokeWidth={1} />
                          <text x={0} y={2} textAnchor="middle" className="fill-[var(--text-primary)] text-[11px] font-mono font-semibold">
                            {activeWire.sourceIface} → {devMap.get(activeWire.snapTarget.deviceId)?.name}:{activeWire.snapTarget.iface}
                          </text>
                        </g>
                      </>
                    ) : (
                      <circle cx={activeWire.cursorX} cy={activeWire.cursorY} r={4} fill={med.color} />
                    )}
                  </>
                );
              })()}
            </g>
          )}

          {/* Live / Step-by-Step Traveling Packet Indicators & Non-Direct Curved Paths */}
          {recentPackets.map((pkt, idx) => {
            const a = devMap.get(pkt.fromDeviceId);
            const b = devMap.get(pkt.toDeviceId);
            if (!a || !b) return null;
            const isFocus = focusPacketId === pkt.id;
            const targetT = pkt.dropped ? 0.5 : activePacketId ? 0.78 : 0.88;
            const trailDrift = simPlaying ? (Math.abs(dashOffset) / 24) * 0.08 : 0;
            const tPos = isFocus
              ? 0.08 + travelProgress * (targetT - 0.08)
              : Math.min(0.85, 0.22 + idx * 0.12 + trailDrift);

            const matchedLink = pkt.linkId ? links.find((l) => l.id === pkt.linkId) : undefined;
            const curveOff = matchedLink ? linkCurves.get(matchedLink.id) ?? 0 : 0;
            const curveGeom = resolvePacketCurveGeometry(a, b, matchedLink, curveOff, devMap, pkt.curvedPath);
            const { x: px, y: py } = computeAnimatedPacketPosition(a, b, tPos, curveGeom.control);

            const color = pkt.dropped ? 'var(--pkt-error)' : PACKET_COLORS[pkt.colorCategory]?.hex || 'var(--pkt-tcp)';
            const labelText =
              isFocus && activePacketStateNote
                ? `#${pkt.no} ${pkt.protocol} · ${activePacketStateNote}`
                : isFocus
                ? `#${pkt.no} ${pkt.protocol}`
                : pkt.protocol;

            return (
              <React.Fragment key={pkt.id}>
                {curveGeom.isNonDirect && (
                  <path
                    data-curved-connection={pkt.id}
                    d={curveGeom.svgPathD}
                    fill="none"
                    stroke={color}
                    strokeWidth={isFocus ? 2.4 : 1.5}
                    strokeOpacity={isFocus ? 0.72 : 0.3}
                    strokeDasharray="6 4"
                    strokeDashoffset={simPlaying && settings.animationsEnabled ? dashOffset : 0}
                    strokeLinecap="round"
                    style={settings.animationsEnabled ? { transition: 'stroke-opacity 180ms ease' } : undefined}
                  />
                )}
                <g
                  data-packet-id={pkt.id}
                  data-packet-progress={tPos.toFixed(3)}
                  data-packet-tick={animationTick}
                  data-packet-curved={curveGeom.control ? 'true' : 'false'}
                  data-packet-non-direct={curveGeom.isNonDirect ? 'true' : 'false'}
                  transform={`translate(${px}, ${py})`}
                  style={
                    settings.animationsEnabled
                      ? {
                          transition: simPlaying
                            ? 'opacity 160ms ease'
                            : 'transform 220ms cubic-bezier(0.22, 1, 0.36, 1), opacity 160ms ease',
                        }
                      : undefined
                  }
                  onClick={(e) => {
                    e.stopPropagation();
                    onInspectPacket(pkt.id);
                  }}
                  opacity={focusPacketId && !isFocus ? 0.42 : 1}
                  className="cursor-pointer"
                >
                  {isFocus && (
                    <circle
                      r={simPlaying ? 12 + Math.sin(travelProgress * Math.PI) * 3 : 12}
                      fill={color}
                      fillOpacity={0.22}
                      stroke={color}
                      strokeWidth={1.6}
                      strokeDasharray="3 2"
                    />
                  )}
                  <circle r={isFocus ? 7.5 : 5.5} fill={color} stroke="#ffffff" strokeWidth={1.5} />
                  {pkt.dropped && travelProgress >= 0.45 && (
                    <path d="M-3.5 -3.5 L3.5 3.5 M3.5 -3.5 L-3.5 3.5" stroke="#ffffff" strokeWidth={1.6} strokeLinecap="round" />
                  )}
                  {isFocus ? (
                    <g transform="translate(0, -18)">
                      <rect
                        x={-(labelText.length * 3.1 + 10)}
                        y={-11}
                        width={labelText.length * 6.2 + 20}
                        height={18}
                        rx={4}
                        fill="var(--bg-surface)"
                        stroke={color}
                        strokeWidth={1.2}
                      />
                      <text x={0} y={1.5} textAnchor="middle" className="fill-[var(--text-primary)] text-[8.5px] font-mono font-bold">
                        {labelText}
                      </text>
                    </g>
                  ) : (
                    <text x={0} y={-10} textAnchor="middle" className="fill-[var(--text-primary)] text-[11px] font-mono font-bold">
                      {pkt.protocol}
                    </text>
                  )}
                </g>
              </React.Fragment>
            );
          })}

          {/* Canvas Annotations */}
          {annotations.map((ann) => (
            <g
              key={ann.id}
              transform={`translate(${ann.x}, ${ann.y})`}
              onClick={(e) => {
                e.stopPropagation();
                onRemoveAnnotation(ann.id);
              }}
              className="cursor-pointer"
            >
              <title>{tc('Click annotation to remove')}</title>
              <rect
                x={-8}
                y={-14}
                width={ann.text.length * 6.5 + 16}
                height={20}
                rx={4}
                fill="var(--bg-surface)"
                stroke="var(--border-strong)"
              />
              <text x={0} y={0} className="fill-[var(--tone-warning)] text-[11px] font-mono">
                {ann.text}
              </text>
            </g>
          ))}

          {/* Hardware Devices + Interactive Port Handles */}
          {devices.map((dev) => {
            const isSelected = selectedDeviceId === dev.id;
            const isHovered = hoveredDeviceId === dev.id;
            const isWireSource = activeWire?.sourceDeviceId === dev.id || portPicker?.deviceId === dev.id;
            const isSnapTarget = activeWire?.snapTarget?.deviceId === dev.id;
            const showPortHandles = isSelected || isHovered || connectMode || Boolean(activeWire);
            const primaryIp = dev.interfaces[0]?.ip;
            const nextPortName = getNextFreePortName(dev);
            const devLinks = links.filter((l) => l.sourceId === dev.id || l.targetId === dev.id);
            const connectedPortCount = devLinks.filter((l) => l.up).length;
            const hasLinkDown = devLinks.some((l) => !l.up);

            return (
              <g
                key={dev.id}
                transform={`translate(${dev.x}, ${dev.y})`}
                onMouseEnter={() => setHoveredDeviceId(dev.id)}
                onMouseLeave={() => setHoveredDeviceId((curr) => (curr === dev.id ? null : curr))}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  // If completing a click-mode wire by clicking target device body
                  if (activeWire && activeWire.sourceDeviceId !== dev.id) {
                    const freeIfaces = dev.interfaces.filter((i) => !portConnectionMap.has(`${dev.id}:${i.name}`));
                    if (freeIfaces.length === 1 && !MULTI_PORT_ROLES.has(dev.role)) {
                      completeWire(dev.id, freeIfaces[0].name);
                    } else {
                      setPortPicker({
                        step: 'target',
                        deviceId: dev.id,
                        sourceDeviceId: activeWire.sourceDeviceId,
                        sourceIface: activeWire.sourceIface,
                        x: dev.x,
                        y: dev.y,
                      });
                    }
                    return;
                  }

                  if (connectMode) {
                    const freeIfaces = dev.interfaces.filter((i) => !portConnectionMap.has(`${dev.id}:${i.name}`));
                    if (freeIfaces.length === 1 && !MULTI_PORT_ROLES.has(dev.role)) {
                      startWireFromPort(dev, freeIfaces[0].name, dev.x, dev.y, 'click');
                    } else {
                      setPortPicker({ step: 'source', deviceId: dev.id, x: dev.x, y: dev.y });
                    }
                    return;
                  }

                  onSelectDevice(dev.id);
                  onSelectLink(null);
                  setPortPicker(null);
                  setDraggingId(dev.id);
                }}
                className="cursor-pointer"
              >
                {/* Generous invisible hit pad so hovering perimeter port handles never flickers */}
                <circle cx={0} cy={0} r={54} fill="transparent" />

                {(isSelected || isWireSource || isSnapTarget) && (
                  <circle
                    cx={0}
                    cy={0}
                    r={38}
                    fill={isSnapTarget ? 'rgba(56,189,248,0.12)' : 'none'}
                    stroke={isWireSource ? '#f59e0b' : '#38bdf8'}
                    strokeWidth={2}
                    strokeDasharray={isWireSource ? '4 3' : undefined}
                  />
                )}

                <g transform="translate(-37, -51) scale(1.15)" filter={isSelected && dev.poweredOn ? 'url(#simWireGlow)' : undefined}>
                  <IsometricHardwareArt
                    role={dev.role}
                    active={isSelected || isSnapTarget}
                    poweredOff={!dev.poweredOn}
                    connectedPortCount={connectedPortCount}
                    hasLinkDown={hasLinkDown}
                    showPortLabels
                    portLabels={dev.interfaces.map((i) => i.name)}
                  />
                </g>

                {/* Interactive RJ-45 / SFP Port Handles around device perimeter */}
                {showPortHandles && (
                  <g>
                    {dev.interfaces.slice(0, 6).map((iface, idx) => {
                      const offset = PORT_OFFSETS[idx % PORT_OFFSETS.length];
                      const conn = portConnectionMap.get(`${dev.id}:${iface.name}`);
                      const isConnected = Boolean(conn);
                      const isPortUp = conn ? conn.link.up : false;
                      const isSourcePort =
                        activeWire?.sourceDeviceId === dev.id && activeWire?.sourceIface === iface.name;
                      const isValidDropTarget =
                        Boolean(activeWire) && activeWire?.sourceDeviceId !== dev.id && !isConnected;
                      const isThisSnap =
                        isSnapTarget && activeWire?.snapTarget?.iface === iface.name;

                      return (
                        <g
                          key={iface.id}
                          transform={`translate(${offset.dx}, ${offset.dy})`}
                          onMouseDown={(e) => e.stopPropagation()}
                          onPointerDown={(e) => {
                            e.stopPropagation();
                            if (activeWire && activeWire.sourceDeviceId !== dev.id) {
                              completeWire(dev.id, iface.name);
                              return;
                            }
                            startWireFromPort(
                              dev,
                              iface.name,
                              dev.x + offset.dx,
                              dev.y + offset.dy,
                              connectMode ? 'click' : 'drag'
                            );
                          }}
                          className="cursor-crosshair"
                        >
                          <title>
                            {iface.name} ({iface.ip || 'unassigned'})
                            {conn ? ` — Connected to ${conn.peerName}:${conn.peerIface}` : ' — Drag or click to connect cable'}
                          </title>
                          {(isValidDropTarget || isSourcePort) && (
                            <circle
                              r={isThisSnap ? 11 : 9}
                              fill={isSourcePort ? 'rgba(245,158,11,0.2)' : 'rgba(56,189,248,0.18)'}
                              stroke={isSourcePort ? '#f59e0b' : '#38bdf8'}
                              strokeWidth={1.2}
                              strokeDasharray={isThisSnap ? undefined : '2 2'}
                            />
                          )}
                          <circle
                            r={isThisSnap ? 7.5 : 5.8}
                            fill={
                              isSourcePort
                                ? '#f59e0b'
                                : isConnected
                                ? isPortUp
                                  ? '#16a34a'
                                  : '#dc2626'
                                : 'var(--bg-surface)'
                            }
                            stroke={
                              isThisSnap
                                ? '#ffffff'
                                : isSourcePort
                                ? '#fde68a'
                                : isConnected
                                ? '#86efac'
                                : '#38bdf8'
                            }
                            strokeWidth={1.6}
                          />
                          {(() => {
                            const labelText = formatPortLabel(iface.name);
                            const badgeW = Math.max(24, labelText.length * 5.2 + 8);
                            const anchorX = offset.dx < 0 ? -9 : offset.dx > 0 ? 9 : 0;
                            const rectX =
                              offset.dx < 0 ? anchorX - badgeW : offset.dx > 0 ? anchorX : -badgeW / 2;
                            const rectY = offset.dy < -30 ? -18 : -6.5;
                            const textX = rectX + badgeW / 2;
                            const textY = rectY + 9.2;
                            return (
                              <g className="pointer-events-none">
                                <rect
                                  x={rectX}
                                  y={rectY}
                                  width={badgeW}
                                  height={13}
                                  rx={3}
                                  fill="var(--bg-surface)"
                                  fillOpacity={0.94}
                                  stroke={
                                    isThisSnap
                                      ? '#38bdf8'
                                      : isSourcePort
                                      ? '#f59e0b'
                                      : isConnected
                                      ? isPortUp
                                        ? '#22c55e'
                                        : '#ef4444'
                                      : 'var(--border-strong)'
                                  }
                                  strokeWidth={isThisSnap || isSourcePort ? 1.1 : 0.75}
                                />
                                <text
                                  x={textX}
                                  y={textY}
                                  textAnchor="middle"
                                  className={`text-[8px] font-mono font-bold ${
                                    isThisSnap
                                      ? 'fill-[var(--accent-primary)]'
                                      : isSourcePort
                                      ? 'fill-[var(--tone-warning)]'
                                      : isConnected && activeWire && activeWire.sourceDeviceId !== dev.id
                                      ? 'fill-[var(--text-muted)] opacity-70'
                                      : 'fill-[var(--text-primary)]'
                                  }`}
                                >
                                  {labelText}
                                </text>
                              </g>
                            );
                          })()}
                        </g>
                      );
                    })}

                    {/* "+ Port" handle for multi-port infrastructure devices */}
                    {MULTI_PORT_ROLES.has(dev.role) && dev.interfaces.length < 6 && (() => {
                      const pos = PORT_OFFSETS[dev.interfaces.length % PORT_OFFSETS.length];
                      const nextLabel = `+${formatPortLabel(nextPortName)}`;
                      const badgeW = Math.max(28, nextLabel.length * 5.2 + 8);
                      const anchorX = pos.dx < 0 ? -9 : pos.dx > 0 ? 9 : 0;
                      const rectX = pos.dx < 0 ? anchorX - badgeW : pos.dx > 0 ? anchorX : -badgeW / 2;
                      const rectY = pos.dy < -30 ? -18 : -6.5;
                      const snappedHere = isSnapTarget && activeWire?.snapTarget?.iface === nextPortName;
                      return (
                        <g
                          transform={`translate(${pos.dx}, ${pos.dy})`}
                          onMouseDown={(e) => e.stopPropagation()}
                          onPointerDown={(e) => {
                            e.stopPropagation();
                            if (activeWire && activeWire.sourceDeviceId !== dev.id) {
                              completeWire(dev.id, nextPortName);
                              return;
                            }
                            startWireFromPort(
                              dev,
                              nextPortName,
                              dev.x + pos.dx,
                              dev.y + pos.dy,
                              connectMode ? 'click' : 'drag'
                            );
                          }}
                          className="cursor-crosshair"
                        >
                          <title>Add &amp; connect new port ({formatPortLabel(nextPortName)})</title>
                          {snappedHere && (
                            <circle r={11} fill="rgba(56,189,248,0.22)" stroke="#ffffff" strokeWidth={1.4} />
                          )}
                          <circle
                            r={snappedHere ? 7.5 : 5.5}
                            fill="var(--bg-inset)"
                            stroke={snappedHere ? '#ffffff' : 'var(--accent-primary)'}
                            strokeWidth={1.5}
                            strokeDasharray="2 2"
                          />
                          <path d="M-2.5 0 H2.5 M0 -2.5 V2.5" stroke="var(--accent-primary)" strokeWidth={1.4} strokeLinecap="round" />
                          <g className="pointer-events-none">
                            <rect
                              x={rectX}
                              y={rectY}
                              width={badgeW}
                              height={13}
                              rx={3}
                              fill="var(--bg-surface)"
                              fillOpacity={0.94}
                              stroke={snappedHere ? 'var(--accent-primary)' : 'var(--border-strong)'}
                              strokeWidth={0.75}
                              strokeDasharray="2 1"
                            />
                            <text
                              x={rectX + badgeW / 2}
                              y={rectY + 9.2}
                              textAnchor="middle"
                              className="fill-[var(--accent-primary)] text-[8px] font-mono font-bold"
                            >
                              {nextLabel}
                            </text>
                          </g>
                        </g>
                      );
                    })()}
                  </g>
                )}

                <text
                  x={0}
                  y={48}
                  textAnchor="middle"
                  className="fill-[var(--text-primary)] font-mono text-[12.5px] font-bold"
                >
                  {dev.name}
                </text>
                {primaryIp && primaryIp !== '0.0.0.0' && (
                  <text
                    x={0}
                    y={62}
                    textAnchor="middle"
                    className="fill-[var(--text-secondary)] text-[11.5px] font-mono"
                  >
                    {primaryIp}
                  </text>
                )}

                {/* Sequential Multi-Hop Route Badge (1, 2, 3...) */}
                {(() => {
                  const hopIndex = multiHopNodeOrder.get(dev.id);
                  if (!hopIndex || multiHopNodeOrder.size < 2) return null;
                  const isHopEndpoint =
                    focusPacket?.fromDeviceId === dev.id || focusPacket?.toDeviceId === dev.id;
                  return (
                    <g
                      data-multihop-node={dev.id}
                      data-hop-index={hopIndex}
                      transform="translate(-30, -34)"
                      className="pointer-events-none"
                    >
                      <circle
                        r={8.5}
                        fill={isHopEndpoint ? 'var(--accent-teal)' : 'var(--accent-primary)'}
                        stroke="var(--bg-surface)"
                        strokeWidth={1.5}
                      />
                      <text
                        x={0}
                        y={3.2}
                        textAnchor="middle"
                        className="fill-white text-[11px] font-mono font-bold tabular-nums"
                      >
                        {hopIndex}
                      </text>
                    </g>
                  );
                })()}

                {/* On-Canvas Node Tables Inspect Trigger */}
                {(isSelected || isHovered || inspectedTableNodeId === dev.id) && !connectMode && !activeWire && (
                  <g
                    role="button"
                    tabIndex={0}
                    aria-label={t('simulator.inspectTables', { device: dev.name })}
                    data-inspect-tables={dev.id}
                    transform="translate(30, -34)"
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      onSelectDevice(dev.id);
                      onSelectLink(null);
                      if (inspectedTableNodeId === dev.id) {
                        setInspectedTableNodeId(null);
                      } else {
                        const defaultTab =
                          dev.natTable.length > 0 || dev.role === 'nat_gateway'
                            ? 'nat'
                            : dev.macTable.length > 0 || dev.role === 'switch'
                            ? 'mac'
                            : dev.routingTable.length > 0 || dev.role === 'router'
                            ? 'routing'
                            : 'arp';
                        setActiveTableTab(defaultTab);
                        setInspectedTableNodeId(dev.id);
                      }
                    }}
                    className="cursor-pointer"
                  >
                    <title>{t('simulator.inspectTables', { device: dev.name })}</title>
                    <rect
                      x={-10}
                      y={-10}
                      width={20}
                      height={20}
                      rx={5}
                      fill={inspectedTableNodeId === dev.id ? 'var(--accent-primary)' : 'var(--bg-surface)'}
                      stroke="var(--accent-primary)"
                      strokeWidth={1.2}
                    />
                    <path
                      d="M-5 -3.5 H5 M-5 0 H5 M-5 3.5 H5 M-1.5 -3.5 V5"
                      stroke={inspectedTableNodeId === dev.id ? '#ffffff' : 'var(--accent-primary)'}
                      strokeWidth={1.2}
                      strokeLinecap="round"
                    />
                  </g>
                )}
              </g>
            );
          })}
        </svg>

        {/* Bottom-Left Subtle Cabling Guide or Active Wiring Banner */}
        <div className="pointer-events-none absolute bottom-2.5 start-3 flex max-w-[calc(55%-0.75rem)] items-center gap-2">
          {pduMode ? (
            <div className="pointer-events-auto flex items-center gap-2 rounded-lg border border-[var(--accent-primary)]/60 bg-[var(--bg-surface)]/95 px-3 py-1.5 text-xs shadow-lg backdrop-blur-md">
              <Mail className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
              <span className="font-medium text-[var(--text-primary)]">
                {pduSourceName ? t('pdu.pickDestination', { source: pduSourceName }) : t('pdu.pickSource')}
              </span>
              <button
                type="button"
                onClick={() => onTogglePduMode?.()}
                className="rounded px-1.5 py-0.5 text-xs font-mono text-[var(--text-muted)] hover:bg-[var(--bg-inset)] hover:text-[var(--text-primary)]"
              >
                Esc
              </button>
            </div>
          ) : connectMode || activeWire ? (
            <div className="pointer-events-auto flex items-center gap-2 rounded-lg border border-[var(--accent-primary)]/60 bg-[var(--bg-surface)]/95 px-3 py-1.5 text-xs shadow-lg backdrop-blur-md">
              <Cable className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
              <span className="font-medium text-[var(--text-primary)]">
                {activeWire
                  ? activeWire.snapTarget
                    ? `${devMap.get(activeWire.sourceDeviceId)?.name}:${activeWire.sourceIface} → ${devMap.get(activeWire.snapTarget.deviceId)?.name}:${activeWire.snapTarget.iface}`
                    : `${devMap.get(activeWire.sourceDeviceId)?.name}:${activeWire.sourceIface} → ...`
                  : `${MEDIUM_META[linkMedium].label}`}
              </span>
              <button
                type="button"
                onClick={() => {
                  setActiveWire(null);
                  setPortPicker(null);
                  onToggleConnectMode(false);
                }}
                className="rounded px-1.5 py-0.5 text-xs font-mono text-[var(--text-muted)] hover:bg-[var(--bg-inset)] hover:text-[var(--text-primary)]"
              >
                Esc
              </button>
            </div>
          ) : activeLinkObj ? (
            <div className="pointer-events-auto flex items-center gap-2.5 rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)]/95 px-3 py-1.5 text-xs shadow-lg backdrop-blur-md">
              <Radio className="w-3.5 h-3.5 text-[var(--tone-success)]" />
              <span className="font-mono text-xs text-[var(--text-primary)]">
                {devMap.get(activeLinkObj.sourceId)?.name}:{activeLinkObj.sourceIface} ↔{' '}
                {devMap.get(activeLinkObj.targetId)?.name}:{activeLinkObj.targetIface} ·{' '}
                {MEDIUM_META[activeLinkObj.medium].label} · {activeLinkObj.bandwidthMbps}M · {activeLinkObj.delayMs}ms
              </span>
              {selectedLinkId === activeLinkObj.id && (
                <button
                  type="button"
                  onClick={() => onToggleLinkUp(activeLinkObj.id)}
                  className={`flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-mono font-semibold ${
                    activeLinkObj.up
                      ? 'bg-[var(--tone-danger)]/15 text-[var(--tone-danger)] hover:bg-[var(--tone-danger)]/25'
                      : 'bg-[var(--tone-success)]/15 text-[var(--tone-success)] hover:bg-[var(--tone-success)]/25'
                  }`}
                >
                  <Scissors className="w-3 h-3" />
                  <span>{activeLinkObj.up ? 'Cut' : 'Restore'}</span>
                </button>
              )}
            </div>
          ) : (
            <div className="rounded-md border border-[var(--border-hairline)] bg-[var(--bg-surface)]/90 px-2.5 py-1 text-xs text-[var(--text-muted)] backdrop-blur-xs">
              {t('simulator.canvasTip')}
            </div>
          )}
        </div>

        {/* Anchored Port Picker Popover */}
        {portPicker && pickerDevice && (
          <div
            role="dialog"
            aria-label={`Select port on ${pickerDevice.name}`}
            style={{
              left: `${Math.min(72, Math.max(10, ((portPicker.x - pan.x) / vbW) * 100))}%`,
              top: `${Math.min(62, Math.max(12, ((portPicker.y - pan.y) / vbH) * 100))}%`,
            }}
            className="absolute z-30 w-64 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)]/98 p-2.5 text-xs shadow-2xl backdrop-blur-md"
          >
            <div className="flex items-center justify-between border-b border-[var(--border-hairline)] pb-1.5 mb-2">
              <div className="min-w-0">
                <div className="font-semibold text-[var(--text-primary)] truncate">
                  {portPicker.step === 'source' ? t('simulator.selectPortSource') : t('simulator.selectPortTarget')}
                </div>
                <div className="font-mono text-[11px] text-[var(--accent-primary)] truncate">
                  {pickerDevice.name} · {MEDIUM_META[linkMedium].label}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPortPicker(null)}
                aria-label={tc('Close port picker')}
                className="rounded p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-1 max-h-44 overflow-y-auto">
              {pickerDevice.interfaces.map((iface) => {
                const conn = portConnectionMap.get(`${pickerDevice.id}:${iface.name}`);
                const portPos = getDevicePortCoords(pickerDevice, iface.name);
                return (
                  <button
                    key={iface.id}
                    type="button"
                    onClick={() => {
                      if (portPicker.step === 'source') {
                        startWireFromPort(pickerDevice, iface.name, portPos.x, portPos.y, 'click');
                      } else {
                        completeWire(pickerDevice.id, iface.name);
                      }
                    }}
                    className="flex w-full items-center justify-between gap-2 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-inset)]/70 px-2.5 py-1.5 text-start hover:border-[var(--accent-primary)] hover:bg-[var(--accent-primary-soft)] transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 font-mono font-semibold text-[var(--text-primary)]">
                        <span
                          className={`inline-block h-2 w-2 rounded-full ${
                            conn ? (conn.link.up ? 'bg-emerald-500' : 'bg-red-500') : 'bg-[var(--accent-primary)]'
                          }`}
                        />
                        <span>{iface.name}</span>
                      </div>
                      <div className="truncate font-mono text-[11px] text-[var(--text-muted)]">
                        {conn ? `${conn.peerName}:${conn.peerIface}` : iface.ip || 'Unassigned'}
                      </div>
                    </div>
                    <span className="text-[11px] font-mono text-[var(--accent-primary)] shrink-0">
                      {conn ? t('simulator.rewire') : t('simulator.usePort')}
                    </span>
                  </button>
                );
              })}

              {/* Add Free Port Option */}
              <button
                type="button"
                onClick={() => {
                  const freshName = getNextFreePortName(pickerDevice);
                  const portPos = getDevicePortCoords(pickerDevice, freshName);
                  if (portPicker.step === 'source') {
                    startWireFromPort(pickerDevice, freshName, portPos.x, portPos.y, 'click');
                  } else {
                    completeWire(pickerDevice.id, freshName);
                  }
                }}
                className="flex w-full items-center justify-between gap-2 rounded-lg border border-dashed border-[var(--accent-primary)]/50 bg-[var(--accent-primary-soft)] px-2.5 py-1.5 font-mono text-xs font-semibold text-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/20 transition-colors"
              >
                <span className="flex items-center gap-1.5">
                  <Plus className="w-3.5 h-3.5" />
                  <span>{t('simulator.addAndWire')} {getNextFreePortName(pickerDevice)}</span>
                </span>
                <Check className="w-3 h-3" />
              </button>
            </div>
          </div>
        )}

        {/* Anchored Node Table Inspector Popover (ARP · Routing · NAT · MAC) */}
        {inspectedTableDevice && !portPicker && (
          <div
            role="dialog"
            aria-label={t('simulator.nodeTablesTitle', { device: inspectedTableDevice.name })}
            data-testid="node-tables-popover"
            style={{
              left: `${Math.min(58, Math.max(8, ((inspectedTableDevice.x - pan.x) / vbW) * 100 + 4))}%`,
              top: `${Math.min(46, Math.max(8, ((inspectedTableDevice.y - pan.y) / vbH) * 100 - 8))}%`,
            }}
            className="absolute z-30 w-[26rem] max-w-[94%] overflow-hidden rounded-2xl border border-[var(--border-strong)] bg-[var(--bg-surface)] text-sm shadow-2xl"
          >
            <div className="flex items-start justify-between gap-3 px-4 pt-3.5 pb-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 font-display text-base font-bold text-[var(--text-primary)]">
                  <Table2 className="h-4 w-4 shrink-0 text-[var(--accent-primary)]" />
                  <span className="truncate">{inspectedTableDevice.name}</span>
                </div>
                <div className="mt-0.5 flex items-center gap-2 text-xs text-[var(--text-muted)]">
                  <span className="rounded-full bg-[var(--bg-inset)] px-2 py-0.5 font-medium capitalize text-[var(--text-secondary)]">
                    {inspectedTableDevice.role.replace('_', ' ').toLowerCase()}
                  </span>
                  <span className="font-mono tabular-nums">{inspectedTableDevice.interfaces[0]?.ip || '0.0.0.0'}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setInspectedTableNodeId(null)}
                aria-label={tc('Close node tables')}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--bg-inset)] hover:text-[var(--text-primary)]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div role="tablist" aria-label={tc('Device table types')} className="flex gap-1 border-b border-[var(--border-hairline)] px-3">
              {(
                [
                  { id: 'arp', label: t('simulator.arpTable'), count: inspectedTableDevice.arpCache.length },
                  { id: 'routing', label: t('simulator.routingTable'), count: inspectedTableDevice.routingTable.length },
                  { id: 'nat', label: t('simulator.natTable'), count: inspectedTableDevice.natTable.length },
                  { id: 'mac', label: t('simulator.macTable'), count: inspectedTableDevice.macTable.length },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={activeTableTab === tab.id}
                  onClick={() => setActiveTableTab(tab.id)}
                  className={`-mb-px flex items-center gap-1.5 border-b-2 px-2.5 pb-2 pt-1 text-xs font-semibold transition-colors ${
                    activeTableTab === tab.id
                      ? 'border-[var(--accent-primary)] text-[var(--accent-primary)]'
                      : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  {tab.label}
                  <span
                    className={`min-w-5 rounded-full px-1.5 text-center text-[11px] tabular-nums ${
                      tab.count > 0 ? 'bg-[var(--accent-primary-soft)] text-[var(--accent-primary)]' : 'bg-[var(--bg-inset)] text-[var(--text-muted)]'
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>

            <div className="max-h-52 overflow-y-auto">
              <NodeTable device={inspectedTableDevice} tab={activeTableTab} />
            </div>

            {onOpenDockTables && (
              <div className="flex justify-end border-t border-[var(--border-hairline)] px-4 py-2.5">
                <button
                  type="button"
                  onClick={() => {
                    onOpenDockTables(inspectedTableDevice.id);
                    setInspectedTableNodeId(null);
                  }}
                  className="text-xs font-semibold text-[var(--accent-primary)] hover:underline"
                >
                  {t('simulator.viewFullTables')} →
                </button>
              </div>
            )}
          </div>
        )}

        {/* Bottom-left Live / Idle Animation Status Pill */}
        {devices.length > 0 && (simPlaying || packets.length === 0) && (
          <div
            aria-live="polite"
            className="pointer-events-none absolute bottom-2.5 end-3 z-10 max-w-[45%] inline-flex items-center gap-2 rounded-full border border-[var(--border-hairline)] bg-[var(--bg-surface)]/92 px-3 py-1 text-xs font-mono text-[var(--text-secondary)] shadow-sm backdrop-blur-sm"
          >
            <span
              className={`h-2 w-2 rounded-full ${
                simPlaying ? 'bg-emerald-500 animate-pulse' : 'bg-[var(--accent-primary)]'
              }`}
            />
            <span className="truncate">
              {simPlaying
                ? activeStepPacket
                  ? `Running · #${activeStepPacket.no} ${activeStepPacket.protocol}`
                  : `Running · ${packets.length} frames`
                : 'Ready · Press Run (Space) to animate'}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
