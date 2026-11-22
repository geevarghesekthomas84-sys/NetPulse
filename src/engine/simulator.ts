import { intToIp, ipToInt, isValidIpv4, maskToPrefix as maskToPrefixLocal, prefixToMask as prefixToMaskLocal, sameSubnet } from '../lib/ipUtils';
import { EventQueue } from './eventQueue';
import { completeIos, execIos, iosPrompt, isIosDevice, type IosHost, type IosSession } from './ios';
import {
  applyNatOutbound,
  convergeRoutingTables,
  evaluateFirewall,
  findOutInterface,
  fragmentByMtu,
  lookupArp,
  lookupNatInbound,
  lookupRouteLpm,
  switchForward,
  upsertArp,
} from './l2l3';
import { buildRealPacket } from './packetBuilder';
import { SeededRNG } from './rng';
import {
  createTcpControlBlock,
  onNewAckCongestionControl,
  onRtoTimeout,
  stepTcpFsm,
  updateRttEstimate,
} from './tcp';
import type {
  CapturedPacket,
  CongestionAlgorithm,
  DhcpLease,
  DnsRecord,
  NetworkInterface,
  PacketColorCategory,
  PacketCurvedPath,
  SimDevice,
  SimEvent,
  SimLink,
  SimLogEntry,
  SimMetrics,
  TcpControlBlock,
  TopologyWarning,
} from './types';

const cidrOf = (mask: string): number => maskToPrefixLocal(mask);

export type PduKind = 'ICMP' | 'TCP' | 'UDP';

/** A "Simple PDU" (Packet Tracer): one test packet sent between two devices and its outcome. */
export interface PduRecord {
  id: number;
  kind: PduKind;
  srcId: string;
  dstId: string;
  srcName: string;
  dstName: string;
  srcIp: string;
  dstIp: string;
  status: 'Successful' | 'Failed';
  reason?: string;
  startMs: number;
  endMs: number;
  /** Packet numbers (1-based, inclusive) that belong to this PDU in the capture; 0 when none were created. */
  firstPacketNo: number;
  lastPacketNo: number;
}

export function computeNonDirectCurvedPath(
  from: { id: string; x: number; y: number },
  to: { id: string; x: number; y: number },
  viaNodes: Array<{ id: string; x: number; y: number }> = [],
  arcIndex = 0
): PacketCurvedPath {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dist = Math.hypot(dx, dy);

  if (dist < 1) {
    const control = { x: from.x, y: Number((from.y - 48).toFixed(2)) };
    const svgPathD = `M ${from.x} ${from.y} C ${from.x - 36} ${from.y - 44}, ${from.x + 36} ${from.y - 44}, ${to.x} ${to.y}`;
    return {
      isNonDirect: true,
      viaNodeIds: viaNodes.map((n) => n.id),
      start: { x: from.x, y: from.y },
      control,
      end: { x: to.x, y: to.y },
      svgPathD,
      arcOffset: 36,
    };
  }

  const mx = (from.x + to.x) / 2;
  const my = (from.y + to.y) / 2;
  const nx = -dy / dist;
  const ny = dx / dist;

  // Bias arc direction toward intermediate relay nodes when off-axis, else keep symmetric directional separation
  let sign = 1;
  const intermediateNodes = viaNodes.slice(1, -1);
  if (intermediateNodes.length > 0) {
    const avgProj =
      intermediateNodes.reduce((acc, node) => acc + (node.x - mx) * nx + (node.y - my) * ny, 0) /
      intermediateNodes.length;
    if (Math.abs(avgProj) > 12) {
      sign = Math.sign(avgProj);
    }
  }

  const magnitude = Math.max(48, Math.min(132, dist * 0.24)) + arcIndex * 16;
  const arcOffset = Number((sign * magnitude).toFixed(2));
  const control = {
    x: Number((mx + nx * arcOffset).toFixed(2)),
    y: Number((my + ny * arcOffset).toFixed(2)),
  };
  const svgPathD = `M ${from.x} ${from.y} Q ${control.x} ${control.y} ${to.x} ${to.y}`;

  return {
    isNonDirect: true,
    viaNodeIds: viaNodes.map((n) => n.id),
    start: { x: from.x, y: from.y },
    control,
    end: { x: to.x, y: to.y },
    svgPathD,
    arcOffset,
  };
}

export interface SimulationConfig {
  seed?: number;
  devices: SimDevice[];
  links: SimLink[];
}

export interface DnsCacheEntry extends DnsRecord {
  expiresAtMs: number;
}

function isRfc1918PrivateIp(ip: string): boolean {
  if (!isValidIpv4(ip)) return false;
  const [a, b] = ip.split('.').map(Number);
  return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

export class SimulationEngine {
  public clockMs = 0;
  public rng: SeededRNG;
  public queue = new EventQueue();
  public devices: Map<string, SimDevice> = new Map();
  public links: Map<string, SimLink> = new Map();
  public packets: CapturedPacket[] = [];
  public logs: SimLogEntry[] = [];
  public tcpSessions: Map<string, TcpControlBlock> = new Map();
  public dnsCaches: Map<string, DnsCacheEntry[]> = new Map();
  public establishedFlows: Set<string> = new Set();

  private initialConfig: SimulationConfig;
  private eventSeq = 0;
  private packetSeq = 0;
  private scheduledActions: Array<{ timeMs: number; fn: () => void }> = [];
  private linkBytesInWindow: Map<string, number> = new Map();
  private latencies: number[] = [];

  constructor(config: SimulationConfig) {
    this.initialConfig = structuredClone(config);
    this.rng = new SeededRNG(config.seed ?? 42);
    this.loadTopology(config.devices, config.links);
  }

  public loadTopology(devices: SimDevice[], links: SimLink[]): void {
    this.devices.clear();
    this.links.clear();
    for (const d of devices) {
      this.devices.set(d.id, structuredClone(d));
    }
    for (const l of links) {
      this.links.set(l.id, structuredClone(l));
    }
    convergeRoutingTables(Array.from(this.devices.values()), Array.from(this.links.values()));
  }

  public reset(newSeed?: number): void {
    this.clockMs = 0;
    this.eventSeq = 0;
    this.packetSeq = 0;
    this.packets = [];
    this.pdus = [];
    this.pduSeq = 0;
    this.dhcpLeases.clear();
    this.logs = [];
    this.scheduledActions = [];
    this.tcpSessions.clear();
    this.dnsCaches.clear();
    this.establishedFlows.clear();
    this.linkBytesInWindow.clear();
    this.latencies = [];
    this.queue.clear();
    this.rng = new SeededRNG(newSeed ?? this.initialConfig.seed ?? 42);
    this.loadTopology(this.initialConfig.devices, this.initialConfig.links);
  }

  public addLog(deviceId: string, level: SimLogEntry['level'], message: string): void {
    this.logs.push({
      id: `log-${this.logs.length + 1}`,
      timeMs: Number(this.clockMs.toFixed(3)),
      deviceId,
      level,
      message,
    });
  }

  public getDevice(idOrName: string): SimDevice | undefined {
    const byId = this.devices.get(idOrName);
    if (byId) return byId;
    for (const d of this.devices.values()) {
      if (d.name.toLowerCase() === idOrName.toLowerCase()) return d;
    }
    return undefined;
  }

  public findDeviceByIp(ip: string): SimDevice | undefined {
    for (const d of this.devices.values()) {
      if (d.interfaces.some((i) => i.ip === ip || i.ipv6 === ip)) return d;
    }
    return undefined;
  }

  public findLinkBetween(aId: string, bId: string): SimLink | undefined {
    for (const l of this.links.values()) {
      if ((l.sourceId === aId && l.targetId === bId) || (l.sourceId === bId && l.targetId === aId)) {
        return l;
      }
    }
    return undefined;
  }

  public getConnectedLinks(deviceId: string): SimLink[] {
    return Array.from(this.links.values()).filter(
      (l) => l.sourceId === deviceId || l.targetId === deviceId
    );
  }

  public getPeerOnLink(link: SimLink, deviceId: string): { peerId: string; peerIface: string; localIface: string } {
    if (link.sourceId === deviceId) {
      return { peerId: link.targetId, peerIface: link.targetIface, localIface: link.sourceIface };
    }
    return { peerId: link.sourceId, peerIface: link.sourceIface, localIface: link.targetIface };
  }

  /**
   * Computes serialization delay + propagation delay + random jitter for a packet over a link.
   */
  public computeLinkTransitMs(link: SimLink, sizeBytes: number): number {
    const bwBps = Math.max(0.01, link.bandwidthMbps) * 1_000_000;
    const serializationMs = ((sizeBytes * 8) / bwBps) * 1000;
    const jitter = link.jitterMs > 0 ? this.rng.jitterFactor() * link.jitterMs : 0;
    return Math.max(0.2, link.delayMs + serializationMs + jitter);
  }

  /**
   * Calculates a quadratic Bezier curved path when a packet travels between non-direct nodes.
   */
  public calculateCurvedPath(fromId: string, toId: string, arcIndex = 0): PacketCurvedPath | undefined {
    const fromDev = this.devices.get(fromId);
    const toDev = this.devices.get(toId);
    if (!fromDev || !toDev) return undefined;

    const directLink = this.findLinkBetween(fromId, toId);
    if (directLink && fromId !== toId) return undefined;

    const viaIds = this.findPath(fromId, toId);
    const viaNodes = viaIds
      .map((id) => this.devices.get(id))
      .filter((d): d is SimDevice => Boolean(d));

    return computeNonDirectCurvedPath(fromDev, toDev, viaNodes, arcIndex);
  }

  private resolveLinkIdsForPath(nodeIds: string[]): string[] {
    const ids: string[] = [];
    for (let k = 0; k < nodeIds.length - 1; k++) {
      const l = this.findLinkBetween(nodeIds[k], nodeIds[k + 1]);
      if (l) ids.push(l.id);
    }
    return ids;
  }

  /**
   * Schedules an arbitrary packet transmission between two directly connected nodes (or next-hop resolved).
   */
  public enqueueDirectPacket(opts: {
    fromId: string;
    toId: string;
    startTimeMs?: number;
    flowPathNodeIds?: string[];
    flowLinkIds?: string[];
    protocol: string;
    colorCategory: PacketColorCategory;
    info: string;
    osiLayer: number;
    stepIndex?: number;
    note?: string;
    etherType?: string;
    vlanId?: number;
    arp?: Parameters<typeof buildRealPacket>[0]['arp'];
    ipv4?: Parameters<typeof buildRealPacket>[0]['ipv4'];
    ipv6?: Parameters<typeof buildRealPacket>[0]['ipv6'];
    icmp?: Parameters<typeof buildRealPacket>[0]['icmp'];
    tcp?: Parameters<typeof buildRealPacket>[0]['tcp'];
    udp?: Parameters<typeof buildRealPacket>[0]['udp'];
    tls?: Parameters<typeof buildRealPacket>[0]['tls'];
    dns?: Parameters<typeof buildRealPacket>[0]['dns'];
    app?: Parameters<typeof buildRealPacket>[0]['app'];
    payloadSizeOverride?: number;
    payloadText?: string;
    forceDrop?: boolean;
    dropReason?: string;
    retransmitted?: boolean;
  }): CapturedPacket {
    const fromDev = this.devices.get(opts.fromId);
    const toDev = this.devices.get(opts.toId);
    const link = this.findLinkBetween(opts.fromId, opts.toId);
    const curvedPath = !link || opts.fromId === opts.toId ? this.calculateCurvedPath(opts.fromId, opts.toId) : undefined;
    const resolvedFlowNodeIds =
      opts.flowPathNodeIds && opts.flowPathNodeIds.length >= 2
        ? opts.flowPathNodeIds
        : curvedPath?.viaNodeIds && curvedPath.viaNodeIds.length >= 2
        ? curvedPath.viaNodeIds
        : link
        ? [opts.fromId, opts.toId]
        : undefined;
    const resolvedFlowLinkIds =
      opts.flowLinkIds && opts.flowLinkIds.length > 0
        ? opts.flowLinkIds
        : resolvedFlowNodeIds
        ? this.resolveLinkIdsForPath(resolvedFlowNodeIds)
        : link
        ? [link.id]
        : undefined;
    const sendTime = opts.startTimeMs ?? this.clockMs;

    const srcMac = fromDev?.interfaces[0]?.mac ?? '02:00:00:00:00:01';
    const dstMac = opts.arp?.opcode === 1 ? 'ff:ff:ff:ff:ff:ff' : toDev?.interfaces[0]?.mac ?? '02:00:00:00:00:02';

    const estBytes = opts.payloadSizeOverride ?? 74;
    const transitMs = link ? this.computeLinkTransitMs(link, estBytes) : 12;

    const lossRoll = this.rng.next() * 100;
    const ifaceShut = link
      ? [
          this.devices.get(link.sourceId)?.interfaces.find((i) => i.id === link.sourceIface),
          this.devices.get(link.targetId)?.interfaces.find((i) => i.id === link.targetIface),
        ].some((i) => i?.up === false)
      : false;
    const linkDown = link ? !link.up || ifaceShut : false;
    const deviceDown = !fromDev?.poweredOn || !toDev?.poweredOn;
    const randomLoss = link ? lossRoll < link.lossPercent : false;
    const dropped = Boolean(opts.forceDrop || linkDown || deviceDown || randomLoss);
    const dropReason =
      opts.dropReason ||
      (linkDown ? (link && link.up ? 'Interface administratively down' : 'Link Down') : deviceDown ? 'Device Powered Off' : randomLoss ? 'Link Packet Loss' : undefined);

    const no = ++this.packetSeq;
    const pkt = buildRealPacket({
      id: `pkt-${no}`,
      no,
      timestampMs: Number(sendTime.toFixed(3)),
      arrivalMs: Number((sendTime + transitMs).toFixed(3)),
      fromDeviceId: opts.fromId,
      toDeviceId: opts.toId,
      linkId: link?.id,
      flowPathNodeIds: resolvedFlowNodeIds,
      flowLinkIds: resolvedFlowLinkIds,
      curvedPath,
      protocol: opts.protocol,
      colorCategory: dropped ? 'error' : opts.colorCategory,
      info: dropped && dropReason ? `${opts.info} [DROPPED: ${dropReason}]` : opts.info,
      osiLayer: opts.osiLayer,
      stepIndex: opts.stepIndex,
      dropped,
      dropReason,
      retransmitted: opts.retransmitted,
      note: opts.note,
      ethernet: {
        srcMac,
        dstMac,
        etherType: opts.etherType ?? (opts.arp ? '0x0806' : opts.ipv6 ? '0x86dd' : '0x0800'),
        vlanId: opts.vlanId,
      },
      arp: opts.arp,
      ipv4: opts.ipv4,
      ipv6: opts.ipv6,
      icmp: opts.icmp,
      tcp: opts.tcp,
      udp: opts.udp,
      tls: opts.tls,
      dns: opts.dns,
      app: opts.app,
      payloadSizeOverride: opts.payloadSizeOverride,
      payloadText: opts.payloadText,
    });

    this.queue.push({
      seq: ++this.eventSeq,
      timeMs: sendTime,
      type: 'PACKET_SEND',
      deviceId: opts.fromId,
      targetId: opts.toId,
      linkId: link?.id,
      packet: pkt,
    });

    return pkt;
  }

  /**
   * Executes one discrete event from the priority queue.
   */
  public stepOneEvent(): SimEvent | undefined {
    const ev = this.queue.pop();
    if (!ev) return undefined;
    this.clockMs = Math.max(this.clockMs, ev.timeMs);

    if (ev.type === 'PACKET_SEND' && ev.packet) {
      const pkt = ev.packet;
      this.packets.push(pkt);
      if (pkt.linkId) {
        this.linkBytesInWindow.set(pkt.linkId, (this.linkBytesInWindow.get(pkt.linkId) ?? 0) + pkt.sizeBytes);
      }
      if (!pkt.dropped) {
        this.queue.push({
          seq: ++this.eventSeq,
          timeMs: pkt.arrivalMs,
          type: 'PACKET_DELIVER',
          deviceId: pkt.toDeviceId,
          targetId: pkt.fromDeviceId,
          linkId: pkt.linkId,
          packet: pkt,
        });
      } else {
        this.addLog(pkt.fromDeviceId, 'warn', `Packet #${pkt.no} dropped: ${pkt.dropReason ?? 'loss'}`);
      }
    } else if (ev.type === 'PACKET_DELIVER' && ev.packet) {
      const rttSample = ev.packet.arrivalMs - ev.packet.timestampMs;
      this.latencies.push(rttSample);
    }

    return ev;
  }

  /**
   * Advances simulation until the next PACKET_SEND or PACKET_DELIVER event completes.
   */
  public stepOnePacket(): CapturedPacket | undefined {
    while (this.queue.size > 0) {
      const ev = this.stepOneEvent();
      if (ev?.type === 'PACKET_SEND' && ev.packet) {
        return ev.packet;
      }
    }
    return undefined;
  }

  /**
   * Runs simulation events up to `targetTimeMs`.
   */
  public runUntil(targetTimeMs: number): void {
    while (this.queue.size > 0) {
      const next = this.queue.peek();
      if (!next || next.timeMs > targetTimeMs) break;
      this.stepOneEvent();
    }
    this.clockMs = Math.max(this.clockMs, targetTimeMs);
  }

  /**
   * Runs all queued events to completion.
   */
  public runAll(maxEvents = 2000): void {
    let count = 0;
    while (this.queue.size > 0 && count < maxEvents) {
      this.stepOneEvent();
      count++;
    }
  }

  /**
   * Rewind by replaying deterministic seed and scheduled actions up to `targetTimeMs`.
   */
  public rewindTo(targetTimeMs: number): void {
    const savedActions = [...this.scheduledActions];
    this.reset(this.rng.seed);
    this.scheduledActions = savedActions;
    for (const act of savedActions) {
      if (act.timeMs <= targetTimeMs) {
        act.fn();
      }
    }
    this.runUntil(targetTimeMs);
  }

  /**
   * Computes shortest L3/L2 hop path between two devices in current topology using BFS.
   */
  public findPath(srcId: string, dstId: string): string[] {
    if (srcId === dstId) return [srcId];
    const visited = new Set<string>([srcId]);
    const parent = new Map<string, string>();
    const queue = [srcId];

    while (queue.length > 0) {
      const curr = queue.shift()!;
      const dev = this.devices.get(curr);
      if (!dev || !dev.poweredOn) continue;

      for (const link of this.getConnectedLinks(curr)) {
        if (!link.up) continue;
        const { peerId } = this.getPeerOnLink(link, curr);
        const peer = this.devices.get(peerId);
        if (!peer || !peer.poweredOn || visited.has(peerId)) continue;
        visited.add(peerId);
        parent.set(peerId, curr);
        if (peerId === dstId) {
          const path: string[] = [dstId];
          let step = dstId;
          while (parent.has(step)) {
            step = parent.get(step)!;
            path.unshift(step);
          }
          return path;
        }
        queue.push(peerId);
      }
    }
    return [];
  }

  /**
   * Routes a real multi-hop IP packet across the topology (performing ARP, MAC learning,
   * LPM routing checks, firewall ACL evaluation, NAT/PAT, TTL decrement, and MTU fragmentation).
   */
  public transmitMultiHopPacket(opts: {
    srcDeviceId: string;
    dstDeviceId: string;
    srcIp: string;
    dstIp: string;
    protocol: string;
    colorCategory: PacketColorCategory;
    info: string;
    osiLayer: number;
    ttl?: number;
    sizeBytes?: number;
    df?: boolean;
    icmp?: Parameters<typeof buildRealPacket>[0]['icmp'];
    tcp?: Parameters<typeof buildRealPacket>[0]['tcp'];
    udp?: Parameters<typeof buildRealPacket>[0]['udp'];
    tls?: Parameters<typeof buildRealPacket>[0]['tls'];
    dns?: Parameters<typeof buildRealPacket>[0]['dns'];
    app?: Parameters<typeof buildRealPacket>[0]['app'];
    stepIndex?: number;
  }): { delivered: boolean; packets: CapturedPacket[]; dropReason?: string; finalTtl?: number } {
    const path = this.findPath(opts.srcDeviceId, opts.dstDeviceId);
    const emitted: CapturedPacket[] = [];
    if (path.length < 2) {
      return { delivered: false, packets: emitted, dropReason: 'No route / link down' };
    }
    const flowPathNodeIds = [...path];
    const flowLinkIds = this.resolveLinkIdsForPath(path);

    let currentTtl = opts.ttl ?? 64;
    let currentSrcIp = opts.srcIp;
    let currentDstIp = opts.dstIp;
    let currentTcp = opts.tcp ? { ...opts.tcp } : undefined;
    let currentUdp = opts.udp ? { ...opts.udp } : undefined;
    const totalLen = opts.sizeBytes ?? 84;
    const originMac = this.devices.get(opts.srcDeviceId)?.interfaces[0]?.mac ?? '02:00:00:00:00:aa';
    const destMac = this.devices.get(opts.dstDeviceId)?.interfaces[0]?.mac ?? '02:00:00:00:00:bb';

    for (let i = 0; i < path.length - 1; i++) {
      const hopFrom = this.devices.get(path[i])!;
      const hopTo = this.devices.get(path[i + 1])!;
      const link = this.findLinkBetween(hopFrom.id, hopTo.id)!;

      // L2 Switch MAC Learning on actual ingress port
      if (hopFrom.role === 'switch') {
        const prevLink = i > 0 ? this.findLinkBetween(path[i - 1], hopFrom.id) : link;
        const inIfaceId = prevLink
          ? this.getPeerOnLink(prevLink, hopFrom.id).localIface
          : hopFrom.interfaces[0]?.id ?? 'p1';
        switchForward(
          hopFrom,
          inIfaceId,
          originMac,
          destMac,
          1,
          this.clockMs,
          Array.from(this.links.values())
        );
      }

      // L3 Router / Firewall checks
      const isL3Hop =
        hopFrom.role === 'router' ||
        hopFrom.role === 'firewall' ||
        hopFrom.role === 'nat_gateway' ||
        hopFrom.role === 'vpn_gateway';

      if (isL3Hop && i > 0) {
        currentTtl -= 1;
        if (currentTtl <= 0) {
          // Send ICMP Time Exceeded back to source
          const routerIp = hopFrom.interfaces[0]?.ip || opts.srcIp;
          const icmpErr = this.enqueueDirectPacket({
            fromId: hopFrom.id,
            toId: path[i - 1],
            startTimeMs: this.clockMs + 1,
            protocol: 'ICMP',
            colorCategory: 'icmp',
            info: `Time-to-live exceeded (TTL=0 at ${hopFrom.name})`,
            osiLayer: 3,
            ipv4: {
              version: 4,
              ihl: 5,
              tos: 0,
              identification: 0x3300 + i,
              flags: { df: false, mf: false },
              fragmentOffset: 0,
              ttl: 64,
              protocol: 1,
              srcIp: routerIp,
              dstIp: currentSrcIp,
            },
            icmp: {
              type: 11,
              code: 0,
              identifier: opts.icmp?.identifier ?? 1,
              sequence: opts.icmp?.sequence ?? 1,
              message: `TTL exceeded at ${routerIp}`,
            },
          });
          emitted.push(icmpErr);
          this.runAll();
          return { delivered: false, packets: emitted, dropReason: 'TTL exceeded', finalTtl: 0 };
        }
      }

      // NAT translation on nat_gateway or router with natEnabled (outbound PAT + inbound reverse lookup)
      if ((hopFrom.natEnabled || hopFrom.role === 'nat_gateway') && hopFrom.interfaces.length > 0) {
        const wanIface = hopFrom.interfaces[hopFrom.interfaces.length - 1];
        const proto: 'TCP' | 'UDP' | 'ICMP' = currentTcp ? 'TCP' : currentUdp ? 'UDP' : 'ICMP';
        if (wanIface?.ip && currentDstIp === wanIface.ip) {
          const dPort = currentTcp?.dstPort ?? currentUdp?.dstPort ?? 1000;
          const natEntry = lookupNatInbound(hopFrom, dPort, proto);
          if (natEntry) {
            currentDstIp = natEntry.insideLocalIp;
            if (currentTcp) currentTcp.dstPort = natEntry.insideLocalPort;
            if (currentUdp) currentUdp.dstPort = natEntry.insideLocalPort;
          }
        } else if (wanIface?.ip && wanIface.ip !== currentSrcIp && isRfc1918PrivateIp(currentSrcIp)) {
          const sPort = currentTcp?.srcPort ?? currentUdp?.srcPort ?? 1000;
          const dPort = currentTcp?.dstPort ?? currentUdp?.dstPort ?? 80;
          const nat = applyNatOutbound(
            hopFrom,
            currentSrcIp,
            sPort,
            currentDstIp,
            dPort,
            proto,
            wanIface.ip,
            this.clockMs
          );
          currentSrcIp = nat.translatedIp;
          if (currentTcp) currentTcp.srcPort = nat.translatedPort;
          if (currentUdp) currentUdp.srcPort = nat.translatedPort;
        }
      }

      // ARP resolution on source host if not cached
      if (i === 0 && !lookupArp(hopFrom, hopTo.interfaces[0]?.ip || opts.dstIp, this.clockMs)) {
        const targetIp = hopTo.interfaces[0]?.ip || opts.dstIp;
        const srcIpIface = hopFrom.interfaces[0]?.ip || currentSrcIp;
        const srcMac = hopFrom.interfaces[0]?.mac || '02:00:00:00:00:01';
        const dstMac = hopTo.interfaces[0]?.mac || '02:00:00:00:00:02';
        const arpReq = this.enqueueDirectPacket({
          fromId: hopFrom.id,
          toId: hopTo.id,
          startTimeMs: this.clockMs,
          protocol: 'ARP',
          colorCategory: 'l2',
          info: `Who has ${targetIp}? Tell ${srcIpIface}`,
          osiLayer: 2,
          arp: { opcode: 1, senderMac: srcMac, senderIp: srcIpIface, targetMac: '00:00:00:00:00:00', targetIp },
        });
        emitted.push(arpReq);
        this.clockMs += 1.5;
        const arpRep = this.enqueueDirectPacket({
          fromId: hopTo.id,
          toId: hopFrom.id,
          startTimeMs: this.clockMs,
          protocol: 'ARP',
          colorCategory: 'l2',
          info: `${targetIp} is at ${dstMac}`,
          osiLayer: 2,
          arp: { opcode: 2, senderMac: dstMac, senderIp: targetIp, targetMac: srcMac, targetIp: srcIpIface },
        });
        emitted.push(arpRep);
        upsertArp(hopFrom, targetIp, dstMac, this.clockMs);
        this.clockMs += 1.5;
      }

      // MTU Check & Fragmentation
      if (totalLen > link.mtu && opts.df) {
        const errPkt = this.enqueueDirectPacket({
          fromId: hopFrom.id,
          toId: path[Math.max(0, i - 1)],
          startTimeMs: this.clockMs,
          protocol: 'ICMP',
          colorCategory: 'error',
          info: `Fragmentation needed but DF set (MTU=${link.mtu}, pkt=${totalLen})`,
          osiLayer: 3,
          ipv4: {
            version: 4,
            ihl: 5,
            tos: 0,
            identification: 0x4401,
            flags: { df: false, mf: false },
            fragmentOffset: 0,
            ttl: 64,
            protocol: 1,
            srcIp: hopFrom.interfaces[0]?.ip || currentSrcIp,
            dstIp: currentSrcIp,
          },
          icmp: { type: 3, code: 4, identifier: 0, sequence: link.mtu, message: `Next-hop MTU ${link.mtu}` },
        });
        emitted.push(errPkt);
        this.runAll();
        return { delivered: false, packets: emitted, dropReason: `Fragmentation needed (MTU ${link.mtu})` };
      }

      const frags = fragmentByMtu(totalLen, link.mtu);
      for (let fIdx = 0; fIdx < frags.length; fIdx++) {
        const frag = frags[fIdx];
        const protoNum = currentTcp ? 6 : currentUdp ? 17 : 1;
        const pkt = this.enqueueDirectPacket({
          fromId: hopFrom.id,
          toId: hopTo.id,
          startTimeMs: this.clockMs,
          flowPathNodeIds,
          flowLinkIds,
          protocol: opts.protocol,
          colorCategory: opts.colorCategory,
          info: frags.length > 1 ? `${opts.info} [Frag ${fIdx + 1}/${frags.length}, offset=${frag.offset * 8}]` : opts.info,
          osiLayer: opts.osiLayer,
          stepIndex: opts.stepIndex,
          payloadSizeOverride: frag.length,
          ipv4: {
            version: 4,
            ihl: 5,
            tos: 0,
            identification: 0x1a00 + this.packetSeq,
            flags: { df: Boolean(opts.df), mf: frag.mf },
            fragmentOffset: frag.offset,
            ttl: currentTtl,
            protocol: protoNum,
            srcIp: currentSrcIp,
            dstIp: currentDstIp,
          },
          icmp: fIdx === 0 ? opts.icmp : undefined,
          tcp: fIdx === 0 ? currentTcp : undefined,
          udp: fIdx === 0 ? currentUdp : undefined,
          tls: fIdx === 0 ? opts.tls : undefined,
          dns: fIdx === 0 ? opts.dns : undefined,
          app: fIdx === 0 ? opts.app : undefined,
        });
        emitted.push(pkt);

        // Evaluate Firewall on receiving device
        if (hopTo.role === 'firewall' || hopTo.firewallRules.length > 0) {
          const fwRes = evaluateFirewall(hopTo, pkt, 'inbound', this.establishedFlows);
          if (!fwRes.allowed) {
            pkt.dropped = true;
            pkt.dropReason = 'Blocked by Firewall ACL';
            pkt.colorCategory = 'error';
            pkt.info = `${pkt.info} [BLOCKED by ${hopTo.name}]`;
            this.runAll();
            return { delivered: false, packets: emitted, dropReason: `Blocked by ${hopTo.name} firewall ACL` };
          }
        }

        if (pkt.dropped) {
          this.runAll();
          return { delivered: false, packets: emitted, dropReason: pkt.dropReason };
        }
        this.clockMs = pkt.arrivalMs;
      }
    }

    this.runAll();
    return { delivered: true, packets: emitted, finalTtl: currentTtl };
  }

  /**
   * Simulates a full TCP transfer with Slow Start, Congestion Avoidance (Reno/Tahoe/CUBIC),
   * Fast Retransmit, and RTO tracking. Returns the TCB with cwndHistory.
   */
  public runTcpTransfer(opts: {
    clientId: string;
    serverId: string;
    serverPort?: number;
    segments?: number;
    algorithm?: CongestionAlgorithm;
  }): TcpControlBlock {
    const client = this.devices.get(opts.clientId);
    const server = this.devices.get(opts.serverId);
    const cIp = client?.interfaces[0]?.ip || '192.168.1.10';
    const sIp = server?.interfaces[0]?.ip || '203.0.113.10';
    const cPort = 52000 + this.rng.intRange(100, 999);
    const sPort = opts.serverPort ?? 80;

    const cTcb = createTcpControlBlock({
      id: `${cIp}:${cPort}->${sIp}:${sPort}`,
      localIp: cIp,
      localPort: cPort,
      remoteIp: sIp,
      remotePort: sPort,
      iss: 0,
      algorithm: opts.algorithm ?? 'reno',
    });
    const sTcb = createTcpControlBlock({
      id: `${sIp}:${sPort}->${cIp}:${cPort}`,
      localIp: sIp,
      localPort: sPort,
      remoteIp: cIp,
      remotePort: cPort,
      iss: 0,
      initialState: 'LISTEN',
      algorithm: opts.algorithm ?? 'reno',
    });

    this.tcpSessions.set(cTcb.id, cTcb);

    // 3-Way Handshake
    cTcb.state = 'SYN_SENT';
    const synStart = this.clockMs;
    const synRes = this.transmitMultiHopPacket({
      srcDeviceId: opts.clientId,
      dstDeviceId: opts.serverId,
      srcIp: cIp,
      dstIp: sIp,
      protocol: 'TCP',
      colorCategory: 'tcp',
      info: `${cPort} -> ${sPort} [SYN] Seq=0 Win=65535 Len=0 MSS=1460`,
      osiLayer: 4,
      tcp: {
        srcPort: cPort,
        dstPort: sPort,
        seq: 0,
        ack: 0,
        dataOffset: 6,
        flags: { urg: false, ack: false, psh: false, rst: false, syn: true, fin: false },
        window: 65535,
        urgentPointer: 0,
        mss: 1460,
        sackPermitted: true,
      },
    });
    if (!synRes.delivered) return cTcb;

    stepTcpFsm(sTcb, { urg: false, ack: false, psh: false, rst: false, syn: true, fin: false }, 0, 0, 0);
    const synAckRes = this.transmitMultiHopPacket({
      srcDeviceId: opts.serverId,
      dstDeviceId: opts.clientId,
      srcIp: sIp,
      dstIp: cIp,
      protocol: 'TCP',
      colorCategory: 'tcp',
      info: `${sPort} -> ${cPort} [SYN, ACK] Seq=0 Ack=1 Win=65535 Len=0`,
      osiLayer: 4,
      tcp: {
        srcPort: sPort,
        dstPort: cPort,
        seq: 0,
        ack: 1,
        dataOffset: 6,
        flags: { urg: false, ack: true, psh: false, rst: false, syn: true, fin: false },
        window: 65535,
        urgentPointer: 0,
        mss: 1460,
      },
    });
    if (!synAckRes.delivered) return cTcb;

    updateRttEstimate(cTcb, this.clockMs - synStart);
    stepTcpFsm(cTcb, { urg: false, ack: true, psh: false, rst: false, syn: true, fin: false }, 0, 1, 0);
    cTcb.sndNxt = 1;

    this.transmitMultiHopPacket({
      srcDeviceId: opts.clientId,
      dstDeviceId: opts.serverId,
      srcIp: cIp,
      dstIp: sIp,
      protocol: 'TCP',
      colorCategory: 'tcp',
      info: `${cPort} -> ${sPort} [ACK] Seq=1 Ack=1 Win=65535 Len=0`,
      osiLayer: 4,
      tcp: {
        srcPort: cPort,
        dstPort: sPort,
        seq: 1,
        ack: 1,
        dataOffset: 5,
        flags: { urg: false, ack: true, psh: false, rst: false, syn: false, fin: false },
        window: 65535,
        urgentPointer: 0,
      },
    });
    stepTcpFsm(sTcb, { urg: false, ack: true, psh: false, rst: false, syn: false, fin: false }, 1, 1, 0);

    // Data Rounds (Congestion Control)
    const totalSegments = opts.segments ?? 12;
    for (let i = 0; i < totalSegments; i++) {
      const segStart = this.clockMs;
      const segSize = 1460;
      const res = this.transmitMultiHopPacket({
        srcDeviceId: opts.clientId,
        dstDeviceId: opts.serverId,
        srcIp: cIp,
        dstIp: sIp,
        protocol: 'TCP',
        colorCategory: 'tcp',
        info: `${cPort} -> ${sPort} [PSH, ACK] Seq=${cTcb.sndNxt} Ack=1 Len=${segSize} (cwnd=${cTcb.cwnd.toFixed(1)})`,
        osiLayer: 4,
        sizeBytes: segSize + 40,
        tcp: {
          srcPort: cPort,
          dstPort: sPort,
          seq: cTcb.sndNxt,
          ack: 1,
          dataOffset: 5,
          flags: { urg: false, ack: true, psh: true, rst: false, syn: false, fin: false },
          window: 65535,
          urgentPointer: 0,
        },
      });

      if (!res.delivered) {
        // Trigger RTO Timeout + Retransmit
        onRtoTimeout(cTcb, this.clockMs + cTcb.rtoMs);
        this.clockMs += 25;
        this.transmitMultiHopPacket({
          srcDeviceId: opts.clientId,
          dstDeviceId: opts.serverId,
          srcIp: cIp,
          dstIp: sIp,
          protocol: 'TCP',
          colorCategory: 'error',
          info: `[TCP Retransmission] ${cPort} -> ${sPort} Seq=${cTcb.sndNxt} Len=${segSize}`,
          osiLayer: 4,
          sizeBytes: segSize + 40,
          tcp: {
            srcPort: cPort,
            dstPort: sPort,
            seq: cTcb.sndNxt,
            ack: 1,
            dataOffset: 5,
            flags: { urg: false, ack: true, psh: true, rst: false, syn: false, fin: false },
            window: 65535,
            urgentPointer: 0,
          },
        });
      }

      cTcb.sndNxt += segSize;
      this.transmitMultiHopPacket({
        srcDeviceId: opts.serverId,
        dstDeviceId: opts.clientId,
        srcIp: sIp,
        dstIp: cIp,
        protocol: 'TCP',
        colorCategory: 'tcp',
        info: `${sPort} -> ${cPort} [ACK] Seq=1 Ack=${cTcb.sndNxt} Win=65535 Len=0`,
        osiLayer: 4,
        tcp: {
          srcPort: sPort,
          dstPort: cPort,
          seq: 1,
          ack: cTcb.sndNxt,
          dataOffset: 5,
          flags: { urg: false, ack: true, psh: false, rst: false, syn: false, fin: false },
          window: 65535,
          urgentPointer: 0,
        },
      });
      updateRttEstimate(cTcb, this.clockMs - segStart);
      onNewAckCongestionControl(cTcb, this.clockMs);
    }

    // 4-Way FIN Teardown
    cTcb.state = 'FIN_WAIT_1';
    this.transmitMultiHopPacket({
      srcDeviceId: opts.clientId,
      dstDeviceId: opts.serverId,
      srcIp: cIp,
      dstIp: sIp,
      protocol: 'TCP',
      colorCategory: 'tcp',
      info: `${cPort} -> ${sPort} [FIN, ACK] Seq=${cTcb.sndNxt} Ack=1`,
      osiLayer: 4,
      tcp: {
        srcPort: cPort,
        dstPort: sPort,
        seq: cTcb.sndNxt,
        ack: 1,
        dataOffset: 5,
        flags: { urg: false, ack: true, psh: false, rst: false, syn: false, fin: true },
        window: 65535,
        urgentPointer: 0,
      },
    });
    cTcb.state = 'FIN_WAIT_2';
    this.transmitMultiHopPacket({
      srcDeviceId: opts.serverId,
      dstDeviceId: opts.clientId,
      srcIp: sIp,
      dstIp: cIp,
      protocol: 'TCP',
      colorCategory: 'tcp',
      info: `${sPort} -> ${cPort} [FIN, ACK] Seq=1 Ack=${cTcb.sndNxt + 1}`,
      osiLayer: 4,
      tcp: {
        srcPort: sPort,
        dstPort: cPort,
        seq: 1,
        ack: cTcb.sndNxt + 1,
        dataOffset: 5,
        flags: { urg: false, ack: true, psh: false, rst: false, syn: false, fin: true },
        window: 65535,
        urgentPointer: 0,
      },
    });
    this.transmitMultiHopPacket({
      srcDeviceId: opts.clientId,
      dstDeviceId: opts.serverId,
      srcIp: cIp,
      dstIp: sIp,
      protocol: 'TCP',
      colorCategory: 'tcp',
      info: `${cPort} -> ${sPort} [ACK] Seq=${cTcb.sndNxt + 1} Ack=2`,
      osiLayer: 4,
      tcp: {
        srcPort: cPort,
        dstPort: sPort,
        seq: cTcb.sndNxt + 1,
        ack: 2,
        dataOffset: 5,
        flags: { urg: false, ack: true, psh: false, rst: false, syn: false, fin: false },
        window: 65535,
        urgentPointer: 0,
      },
    });
    cTcb.state = 'CLOSED';
    return cTcb;
  }

  /**
   * Resolves a domain name through configured DNS servers with real TTL caching.
   */
  public resolveDns(
    clientId: string,
    domain: string,
    qtype: DnsRecord['type'] = 'A'
  ): { ip?: string; cached: boolean; trace: string[] } {
    const client = this.devices.get(clientId);
    const trace: string[] = [];
    if (!client) return { cached: false, trace: ['Unknown client device'] };

    // Check local DNS cache first
    const localCache = (this.dnsCaches.get(client.id) ?? []).filter((c) => c.expiresAtMs > this.clockMs);
    this.dnsCaches.set(client.id, localCache);
    const localHit = localCache.find((c) => c.name === domain && c.type === qtype);
    if (localHit) {
      trace.push(`Local DNS cache hit on ${client.name}: ${domain} -> ${localHit.value} (TTL remaining ${Math.round((localHit.expiresAtMs - this.clockMs) / 1000)}s)`);
      return { ip: localHit.value, cached: true, trace };
    }

    const resolver =
      (client.dnsServer ? this.findDeviceByIp(client.dnsServer) : undefined) ||
      Array.from(this.devices.values()).find((d) => d.services.dns?.enabled && d.services.dns.role === 'recursive') ||
      Array.from(this.devices.values()).find((d) => d.services.dns?.enabled);

    if (!resolver) {
      trace.push('No DNS server reachable in topology');
      return { cached: false, trace };
    }

    const cIp = client.interfaces[0]?.ip || '192.168.1.10';
    const rIp = resolver.interfaces[0]?.ip || '8.8.8.8';
    const txId = this.rng.intRange(0x1000, 0xffff);

    this.transmitMultiHopPacket({
      srcDeviceId: client.id,
      dstDeviceId: resolver.id,
      srcIp: cIp,
      dstIp: rIp,
      protocol: 'DNS',
      colorCategory: 'dns',
      info: `Standard query 0x${txId.toString(16)} ${qtype} ${domain}`,
      osiLayer: 7,
      udp: { srcPort: 53000 + (txId % 1000), dstPort: 53 },
      dns: {
        transactionId: txId,
        isResponse: false,
        opcode: 'Standard query',
        flags: ['RD'],
        questions: [{ name: domain, type: qtype }],
        answers: [],
      },
    });
    trace.push(`${client.name} -> ${resolver.name} (${rIp}): Query ${qtype} ${domain}`);

    // Check resolver cache
    const rCache = (this.dnsCaches.get(resolver.id) ?? []).filter((c) => c.expiresAtMs > this.clockMs);
    this.dnsCaches.set(resolver.id, rCache);
    const cacheHit = rCache.find((c) => c.name === domain && c.type === qtype);
    if (cacheHit) {
      this.transmitMultiHopPacket({
        srcDeviceId: resolver.id,
        dstDeviceId: client.id,
        srcIp: rIp,
        dstIp: cIp,
        protocol: 'DNS',
        colorCategory: 'dns',
        info: `Standard query response 0x${txId.toString(16)} ${qtype} ${domain} ${cacheHit.value} (cached)`,
        osiLayer: 7,
        udp: { srcPort: 53, dstPort: 53000 + (txId % 1000) },
        dns: {
          transactionId: txId,
          isResponse: true,
          opcode: 'Standard query response',
          flags: ['QR', 'RD', 'RA'],
          questions: [{ name: domain, type: qtype }],
          answers: [{ name: domain, type: qtype, value: cacheHit.value, ttl: cacheHit.ttl }],
        },
      });
      localCache.push({ ...cacheHit });
      this.dnsCaches.set(client.id, localCache);
      trace.push(`Cache hit on ${resolver.name}: ${domain} -> ${cacheHit.value}`);
      return { ip: cacheHit.value, cached: true, trace };
    }

    // Search all DNS servers (root -> tld -> authoritative)
    const allDns = Array.from(this.devices.values()).filter((d) => d.services.dns?.enabled);
    let foundRecord: DnsRecord | undefined;
    for (const srv of allDns) {
      const rec = srv.services.dns?.records.find((r) => r.name === domain && r.type === qtype);
      if (rec) {
        if (srv.id !== resolver.id) {
          const srvIp = srv.interfaces[0]?.ip || '198.51.100.53';
          this.transmitMultiHopPacket({
            srcDeviceId: resolver.id,
            dstDeviceId: srv.id,
            srcIp: rIp,
            dstIp: srvIp,
            protocol: 'DNS',
            colorCategory: 'dns',
            info: `Iterative query ${qtype} ${domain}`,
            osiLayer: 7,
            udp: { srcPort: 54112, dstPort: 53 },
            dns: {
              transactionId: txId + 1,
              isResponse: false,
              opcode: 'Standard query',
              flags: [],
              questions: [{ name: domain, type: qtype }],
              answers: [],
            },
          });
          this.transmitMultiHopPacket({
            srcDeviceId: srv.id,
            dstDeviceId: resolver.id,
            srcIp: srvIp,
            dstIp: rIp,
            protocol: 'DNS',
            colorCategory: 'dns',
            info: `Authoritative response ${qtype} ${domain} -> ${rec.value}`,
            osiLayer: 7,
            udp: { srcPort: 53, dstPort: 54112 },
            dns: {
              transactionId: txId + 1,
              isResponse: true,
              opcode: 'Standard query response',
              flags: ['QR', 'AA'],
              questions: [{ name: domain, type: qtype }],
              answers: [{ name: domain, type: qtype, value: rec.value, ttl: rec.ttl }],
            },
          });
          trace.push(`${resolver.name} -> ${srv.name} (${srvIp}): Authoritative answer ${rec.value}`);
        }
        foundRecord = rec;
        break;
      }
    }

    // Fallback: match web server hostname in topology
    if (!foundRecord) {
      const webSrv = Array.from(this.devices.values()).find(
        (d) => d.role === 'web_server' || d.services.http?.enabled
      );
      if (webSrv?.interfaces[0]?.ip) {
        foundRecord = { name: domain, type: qtype, value: webSrv.interfaces[0].ip, ttl: 300 };
      }
    }

    if (foundRecord) {
      const expiresAtMs = this.clockMs + foundRecord.ttl * 1000;
      rCache.push({ ...foundRecord, expiresAtMs });
      localCache.push({ ...foundRecord, expiresAtMs });
      this.dnsCaches.set(resolver.id, rCache);
      this.dnsCaches.set(client.id, localCache);

      this.transmitMultiHopPacket({
        srcDeviceId: resolver.id,
        dstDeviceId: client.id,
        srcIp: rIp,
        dstIp: cIp,
        protocol: 'DNS',
        colorCategory: 'dns',
        info: `Standard query response 0x${txId.toString(16)} ${qtype} ${domain} ${foundRecord.value} (TTL ${foundRecord.ttl}s)`,
        osiLayer: 7,
        udp: { srcPort: 53, dstPort: 53000 + (txId % 1000) },
        dns: {
          transactionId: txId,
          isResponse: true,
          opcode: 'Standard query response',
          flags: ['QR', 'RD', 'RA'],
          questions: [{ name: domain, type: qtype }],
          answers: [{ name: domain, type: qtype, value: foundRecord.value, ttl: foundRecord.ttl }],
        },
      });
      trace.push(`${resolver.name} -> ${client.name}: ${foundRecord.value} (TTL ${foundRecord.ttl}s)`);
      return { ip: foundRecord.value, cached: false, trace };
    }

    trace.push(`NXDOMAIN: ${domain} not found`);
    return { cached: false, trace };
  }

  /**
   * Validates topology for duplicate IPs, missing gateways, subnet mismatches, and routing loops.
   */
  public validateTopology(): TopologyWarning[] {
    const warnings: TopologyWarning[] = [];
    const seenIps = new Map<string, string[]>();

    for (const dev of this.devices.values()) {
      for (const iface of dev.interfaces) {
        if (!iface.ip || iface.ip === '0.0.0.0') continue;
        const list = seenIps.get(iface.ip) ?? [];
        list.push(`${dev.name} (${iface.name})`);
        seenIps.set(iface.ip, list);

        if (dev.role === 'host' && iface.gateway && !sameSubnet(iface.ip, iface.gateway, iface.mask)) {
          warnings.push({
            id: `gw-mismatch-${dev.id}-${iface.id}`,
            severity: 'error',
            deviceId: dev.id,
            message: `${dev.name}: Default gateway ${iface.gateway} is not in subnet ${iface.ip}/${iface.mask}`,
          });
        }
      }

      const hasL3Router = Array.from(this.devices.values()).some(
        (d) => d.role === 'router' || d.role === 'nat_gateway' || d.role === 'firewall' || d.role === 'vpn_gateway'
      );
      if (
        dev.role === 'host' &&
        hasL3Router &&
        dev.interfaces[0] &&
        dev.interfaces[0].ip &&
        dev.interfaces[0].ip !== '0.0.0.0' &&
        !dev.interfaces[0].gateway &&
        this.devices.size > 2
      ) {
        warnings.push({
          id: `no-gw-${dev.id}`,
          severity: 'warning',
          deviceId: dev.id,
          message: `${dev.name} has no default gateway configured; off-subnet traffic will fail`,
        });
      }
    }

    for (const [ip, owners] of seenIps.entries()) {
      if (owners.length > 1) {
        warnings.push({
          id: `dup-ip-${ip}`,
          severity: 'error',
          message: `Duplicate IP conflict ${ip} assigned to: ${owners.join(', ')}`,
        });
      }
    }

    // Simple routing loop check
    for (const dev of this.devices.values()) {
      for (const rt of dev.routingTable) {
        if (rt.nextHop === '0.0.0.0') continue;
        const nextDev = this.findDeviceByIp(rt.nextHop);
        if (!nextDev) continue;
        const reverseRt = lookupRouteLpm(nextDev.routingTable, rt.network);
        if (reverseRt && dev.interfaces.some((i) => i.ip === reverseRt.nextHop)) {
          warnings.push({
            id: `loop-${dev.id}-${nextDev.id}-${rt.network}`,
            severity: 'error',
            deviceId: dev.id,
            message: `Routing loop detected for ${rt.network} between ${dev.name} and ${nextDev.name}`,
          });
        }
      }
    }

    return warnings;
  }

  public getMetrics(): SimMetrics {
    const sent = this.packets.length;
    const delivered = this.packets.filter((p) => !p.dropped).length;
    const dropped = this.packets.filter((p) => p.dropped).length;
    const retrans = this.packets.filter((p) => p.retransmitted || p.info.includes('Retransmission')).length;
    const totalBytes = this.packets.reduce((acc, p) => acc + p.sizeBytes, 0);
    const minLat = this.latencies.length ? Math.min(...this.latencies) : 0;
    const maxLat = this.latencies.length ? Math.max(...this.latencies) : 0;
    const avgLat = this.latencies.length
      ? this.latencies.reduce((a, b) => a + b, 0) / this.latencies.length
      : 0;
    const jitter =
      this.latencies.length > 1
        ? this.latencies.slice(1).reduce((acc, v, idx) => acc + Math.abs(v - this.latencies[idx]), 0) /
          (this.latencies.length - 1)
        : 0;
    const elapsedSec = Math.max(0.05, this.clockMs / 1000);
    const throughputKbps = (totalBytes * 8) / 1000 / elapsedSec;
    const goodputKbps = ((delivered / Math.max(1, sent)) * throughputKbps);

    const linkUtilization: Record<string, number> = {};
    for (const link of this.links.values()) {
      const bytes = this.linkBytesInWindow.get(link.id) ?? 0;
      const capBytes = (link.bandwidthMbps * 1_000_000 / 8) * elapsedSec;
      linkUtilization[link.id] = Math.min(100, Number(((bytes / Math.max(1, capBytes)) * 100).toFixed(1)));
    }

    const firstTcb = Array.from(this.tcpSessions.values())[0];

    return {
      totalPacketsSent: sent,
      totalPacketsDelivered: delivered,
      totalPacketsDropped: dropped,
      totalRetransmissions: retrans,
      totalBytesTransferred: totalBytes,
      minLatencyMs: Number(minLat.toFixed(2)),
      maxLatencyMs: Number(maxLat.toFixed(2)),
      avgLatencyMs: Number(avgLat.toFixed(2)),
      jitterMs: Number(jitter.toFixed(2)),
      throughputKbps: Number(throughputKbps.toFixed(1)),
      goodputKbps: Number(goodputKbps.toFixed(1)),
      linkUtilization,
      cwndSeries: firstTcb?.cwndHistory ?? [],
    };
  }

  public pdus: PduRecord[] = [];
  /** DHCP leases handed out, by server device id. */
  public dhcpLeases = new Map<string, DhcpLease[]>();
  private pduSeq = 0;
  private iosSessions = new Map<string, IosSession>();
  private configDirty = false;
  private skipIos = false;

  private iosSession(id: string): IosSession {
    let s = this.iosSessions.get(id);
    if (!s) {
      s = { mode: 'user' };
      this.iosSessions.set(id, s);
    }
    return s;
  }

  /** Rebuilds learned routes from scratch (used after a CLI change so show commands reflect it at once). */
  public reconverge(): void {
    const routerLike = new Set(['router', 'firewall', 'nat_gateway', 'vpn_gateway']);
    for (const d of this.devices.values()) {
      if (routerLike.has(d.role)) d.routingTable = d.routingTable.filter((r) => r.protocol === 'static');
    }
    convergeRoutingTables(Array.from(this.devices.values()), Array.from(this.links.values()));
  }

  /** The CLI prompt for a device, e.g. Router# or Router(config-if)#; name$ for hosts. */
  public getCliPrompt(deviceId: string): string {
    const dev = this.devices.get(deviceId);
    if (!dev) return '$';
    return isIosDevice(dev) ? iosPrompt(dev, this.iosSession(dev.id)) : `${dev.name}$`;
  }

  public isIosDevice(deviceId: string): boolean {
    const dev = this.devices.get(deviceId);
    return Boolean(dev && isIosDevice(dev));
  }

  /** Tab completion for the CLI line; null when there is nothing unique to complete. */
  public completeCli(deviceId: string, line: string): string | null {
    const dev = this.devices.get(deviceId);
    return dev && isIosDevice(dev) ? completeIos(this.iosSession(dev.id).mode, line) : null;
  }

  /**
   * If CLI commands changed device configuration since the last call, returns the new topology
   * (configuration only, learned and derived state stripped) so the UI can store it. Otherwise null.
   */
  public consumeConfigChanges(): { devices: SimDevice[]; links: SimLink[] } | null {
    if (!this.configDirty) return null;
    this.configDirty = false;
    const routerLike = new Set(['router', 'firewall', 'nat_gateway', 'vpn_gateway']);
    const devices = Array.from(this.devices.values()).map((d) => {
      const c = structuredClone(d);
      if (routerLike.has(c.role)) c.routingTable = c.routingTable.filter((r) => r.protocol === 'static');
      c.arpCache = [];
      c.macTable = [];
      c.natTable = [];
      return c;
    });
    return { devices, links: Array.from(this.links.values()).map((l) => structuredClone(l)) };
  }

  /**
   * Executes OS-realistic CLI commands directly against the simulation engine.
   */
  public execCommand(deviceId: string, rawCmd: string): string {
    const dev = this.devices.get(deviceId);
    if (!dev) return 'Error: device not found.';
    if (!dev.poweredOn) return `Device ${dev.name} is powered off.`;

    const trimmed = rawCmd.trim();
    if (!trimmed) return '';
    if (isIosDevice(dev) && !this.skipIos) {
      const host: IosHost = {
        links: () => Array.from(this.links.values()),
        devices: () => Array.from(this.devices.values()),
        dhcpLeases: () => this.dhcpLeases.get(dev.id) ?? [],
        markDirty: () => {
          this.configDirty = true;
          this.reconverge();
        },
        runGeneric: (c) => {
          this.skipIos = true;
          try {
            return this.execCommand(deviceId, c);
          } finally {
            this.skipIos = false;
          }
        },
      };
      const out = execIos(host, dev, this.iosSession(dev.id), trimmed);
      if (out !== null) return out;
    }

    const tokens = trimmed.split(/\s+/);
    const cmd = tokens[0].toLowerCase();
    const args = tokens.slice(1);

    const resolveTarget = (target: string): { device?: SimDevice; ip?: string } => {
      const byDev = this.getDevice(target);
      if (byDev) return { device: byDev, ip: byDev.interfaces[0]?.ip };
      const byIp = this.findDeviceByIp(target);
      if (byIp) return { device: byIp, ip: target };
      // Try DNS resolution
      const dnsRes = this.resolveDns(dev.id, target, 'A');
      if (dnsRes.ip) {
        return { device: this.findDeviceByIp(dnsRes.ip), ip: dnsRes.ip };
      }
      return {};
    };

    if (cmd === 'help') {
      return [
        'Available commands:',
        '  ping <host|ip> [-c n] [-t ttl] [-s size]',
        '  traceroute | tracert <host|ip>',
        '  nslookup | dig <domain> [type]',
        '  curl <url> [-v] [-I]',
        '  ipconfig | ifconfig | ip addr | ip route | route print',
        '  arp -a | arp -d',
        '  netstat -an | ss -tuln',
        '  telnet | nc <host> <port>',
        '  ssh <user@host> | ftp <host>',
        '  nmap <host>',
        '  tcpdump',
        '  show ip route | show mac address-table | show running-config',
        '  clear | help',
      ].join('\n');
    }

    if (!isIosDevice(dev) && ((cmd === 'ipconfig' && args[0]?.toLowerCase() === '/renew') || cmd === 'dhclient' || (cmd === 'dhcp' && args[0] === 'renew'))) {
      return this.requestDhcp(dev.id).message;
    }
    if (!isIosDevice(dev) && ((cmd === 'ipconfig' && args[0]?.toLowerCase() === '/release') || (cmd === 'dhclient' && args[0] === '-r'))) {
      return this.releaseDhcp(dev.id);
    }

    // Host configuration: ifconfig eth0 10.0.0.5 netmask 255.255.255.0, ip addr add IP/N dev eth0,
    // ip route add default via X, route add default gw X, hostname NAME.
    const hostCfg = !isIosDevice(dev);
    if (hostCfg && cmd === 'ifconfig' && args.length >= 2) {
      const iface = dev.interfaces.find((i) => i.name === args[0] || i.id === args[0]);
      if (!iface) return `ifconfig: interface ${args[0]} not found`;
      if (!isValidIpv4(args[1])) return `ifconfig: bad address '${args[1]}'`;
      const mi = args.findIndex((a) => a === 'netmask');
      iface.ip = args[1];
      iface.mask = mi >= 0 ? args[mi + 1] : iface.mask || '255.255.255.0';
      this.configDirty = true;
      return '';
    }
    if (hostCfg && cmd === 'ip' && args[0] === 'addr' && args[1] === 'add') {
      const [ip, pfx] = (args[2] ?? '').split('/');
      const iface = dev.interfaces.find((i) => i.name === args[4] || i.id === args[4]) ?? dev.interfaces[0];
      if (!isValidIpv4(ip) || !pfx) return 'Usage: ip addr add <ip>/<prefix> dev <iface>';
      iface.ip = ip;
      iface.mask = prefixToMaskLocal(Number(pfx));
      this.configDirty = true;
      return '';
    }
    if (hostCfg && ((cmd === 'ip' && args[0] === 'route' && args[1] === 'add' && args[2] === 'default' && args[3] === 'via') || (cmd === 'route' && args[0] === 'add' && args[1] === 'default' && args[2] === 'gw'))) {
      const gw = cmd === 'ip' ? args[4] : args[3];
      if (!isValidIpv4(gw ?? '')) return 'Usage: ip route add default via <gateway>';
      for (const i of dev.interfaces) i.gateway = gw;
      this.configDirty = true;
      return '';
    }
    if (hostCfg && cmd === 'hostname' && args[0]) {
      dev.name = args[0];
      this.configDirty = true;
      return '';
    }

    if (cmd === 'ipconfig' || cmd === 'ifconfig' || (cmd === 'ip' && args[0] === 'addr')) {
      return dev.interfaces
        .map(
          (i) =>
            `${i.name}: flags=4163<${i.up ? 'UP,BROADCAST,RUNNING' : 'DOWN'}>  mtu 1500\n` +
            `        inet ${i.ip || 'unassigned'}  netmask ${i.mask || '255.255.255.0'}` +
            (i.gateway ? `  gateway ${i.gateway}` : '') +
            `\n        ether ${i.mac}  (VLAN ${i.vlan ?? 1})`
        )
        .join('\n');
    }

    if ((cmd === 'ip' && args[0] === 'route') || cmd === 'route' || (cmd === 'show' && args[0] === 'ip' && args[1] === 'route')) {
      const header = 'Destination        Netmask            Next Hop           Interface   Metric  Proto';
      const rows =
        dev.routingTable.length > 0
          ? dev.routingTable.map(
              (r) =>
                `${r.network.padEnd(18)} ${r.mask.padEnd(18)} ${r.nextHop.padEnd(18)} ${r.iface.padEnd(11)} ${String(r.metric).padEnd(7)} ${r.protocol.toUpperCase()}`
            )
          : ['(no routes; using connected subnet + default gateway ' + (dev.interfaces[0]?.gateway || 'none') + ')'];
      return [header, ...rows].join('\n');
    }

    if (cmd === 'show' && args[0] === 'mac') {
      const header = 'Vlan    Mac Address       Type        Ports';
      const rows =
        dev.macTable.length > 0
          ? dev.macTable.map((m) => `${String(m.vlan).padEnd(7)} ${m.mac.padEnd(17)} DYNAMIC     ${m.portIfaceId}`)
          : ['(MAC address table is empty)'];
      return [header, ...rows].join('\n');
    }

    if (cmd === 'show' && args[0] === 'running-config') {
      return [
        `! Running configuration for ${dev.name} (${dev.role})`,
        `hostname ${dev.name}`,
        dev.asn ? `router bgp ${dev.asn}` : `! routing-protocol ${dev.routingProtocol ?? 'none'}`,
        ...dev.interfaces.map((i) => `interface ${i.name}\n ip address ${i.ip} ${i.mask}\n mac-address ${i.mac}`),
        ...dev.firewallRules.map(
          (r) => `access-list ${r.action} ${r.protocol} ${r.srcIp} ${r.dstIp} port ${r.dstPort} (${r.direction})`
        ),
        'end',
      ].join('\n');
    }

    if (cmd === 'arp') {
      if (args[0] === '-d') {
        dev.arpCache = [];
        return 'ARP cache cleared.';
      }
      const header = 'Address                  HWtype  HWaddress           Iface';
      const rows =
        dev.arpCache.length > 0
          ? dev.arpCache.map((a) => `${a.ip.padEnd(24)} ether   ${a.mac.padEnd(19)} ${dev.interfaces[0]?.name || 'eth0'}`)
          : ['(ARP table is empty)'];
      return [header, ...rows].join('\n');
    }

    if (cmd === 'netstat' || cmd === 'ss') {
      const header = 'Proto  Local Address           Foreign Address         State';
      const listenRows = dev.openPorts.map(
        (p) => `tcp    ${(dev.interfaces[0]?.ip || '0.0.0.0')}:${String(p).padEnd(15)} 0.0.0.0:*               LISTEN`
      );
      const tcbRows = Array.from(this.tcpSessions.values())
        .filter((t) => t.localIp === dev.interfaces[0]?.ip)
        .map((t) => `tcp    ${t.localIp}:${t.localPort}   ${t.remoteIp}:${t.remotePort}   ${t.state}`);
      return [header, ...listenRows, ...tcbRows].join('\n');
    }

    if (cmd === 'ping') {
      const target = args.find((a) => !a.startsWith('-'));
      if (!target) return 'Usage: ping <host|ip> [-c count] [-t ttl] [-s size]';
      const cIdx = args.indexOf('-c');
      const tIdx = args.indexOf('-t');
      const sIdx = args.indexOf('-s');
      const count = cIdx >= 0 ? Math.min(10, Math.max(1, Number(args[cIdx + 1]) || 4)) : 4;
      const ttl = tIdx >= 0 ? Math.max(1, Number(args[tIdx + 1]) || 64) : 64;
      const size = sIdx >= 0 ? Math.max(32, Number(args[sIdx + 1]) || 64) : 64;

      const resolved = resolveTarget(target);
      const srcIp = dev.interfaces[0]?.ip || '192.168.1.10';
      if (!resolved.device || !resolved.ip) {
        if (isValidIpv4(target)) {
          // Walk connected router LPM tables for unowned IPs (e.g., routing loops)
          const firstHopRouter =
            (dev.interfaces[0]?.gateway ? this.findDeviceByIp(dev.interfaces[0].gateway) : undefined) ||
            this.getConnectedLinks(dev.id)
              .map((l) => this.devices.get(this.getPeerOnLink(l, dev.id).peerId))
              .find((d) => d && (d.role === 'router' || d.role === 'nat_gateway' || d.role === 'firewall'));
          if (firstHopRouter && lookupRouteLpm(firstHopRouter.routingTable, target)) {
            const lines = [`PING ${target} (${target}) ${size} bytes of data.`];
            for (let seq = 1; seq <= count; seq++) {
              let currDev: SimDevice = dev;
              let nextDev: SimDevice = firstHopRouter;
              let remTtl = ttl;
              let exceededAt: string | null = null;
              for (let step = 0; step < Math.min(ttl + 2, 64); step++) {
                this.enqueueDirectPacket({
                  fromId: currDev.id,
                  toId: nextDev.id,
                  startTimeMs: this.clockMs,
                  protocol: 'ICMP',
                  colorCategory: 'icmp',
                  info: `Echo (ping) request -> ${target} (TTL=${remTtl})`,
                  osiLayer: 3,
                  ipv4: {
                    version: 4, ihl: 5, tos: 0, identification: 0x0900 + seq, flags: { df: true, mf: false },
                    fragmentOffset: 0, ttl: remTtl, protocol: 1, srcIp, dstIp: target,
                  },
                  icmp: { type: 8, code: 0, identifier: 0x0401, sequence: seq, message: 'ping-loop' },
                });
                this.clockMs += 6;
                remTtl -= 1;
                if (remTtl <= 0) {
                  exceededAt = nextDev.interfaces[0]?.ip || nextDev.name;
                  this.enqueueDirectPacket({
                    fromId: nextDev.id,
                    toId: currDev.id,
                    startTimeMs: this.clockMs,
                    protocol: 'ICMP',
                    colorCategory: 'error',
                    info: `Time-to-live exceeded (TTL=0 at ${nextDev.name})`,
                    osiLayer: 3,
                    ipv4: {
                      version: 4, ihl: 5, tos: 0, identification: 0x0950 + seq, flags: { df: false, mf: false },
                      fragmentOffset: 0, ttl: 64, protocol: 1, srcIp: exceededAt, dstIp: srcIp,
                    },
                    icmp: { type: 11, code: 0, identifier: 0x0401, sequence: seq, message: 'TTL exceeded' },
                  });
                  break;
                }
                const rt = lookupRouteLpm(nextDev.routingTable, target);
                const nhDev = rt && rt.nextHop !== '0.0.0.0' ? this.findDeviceByIp(rt.nextHop) : undefined;
                if (!nhDev) break;
                currDev = nextDev;
                nextDev = nhDev;
              }
              this.runAll();
              lines.push(
                exceededAt
                  ? `From ${exceededAt} icmp_seq=${seq} Time to live exceeded`
                  : `From ${srcIp} icmp_seq=${seq} Destination Net Unreachable`
              );
            }
            lines.push(`\n--- ${target} ping statistics ---`);
            lines.push(`${count} packets transmitted, 0 received, 100% packet loss, avg rtt = 0.00 ms`);
            return lines.join('\n');
          }
        }
        return `ping: ${target}: Name or service not known`;
      }
      const lines = [`PING ${target} (${resolved.ip}) ${size} bytes of data.`];
      let received = 0;
      const times: number[] = [];

      for (let seq = 1; seq <= count; seq++) {
        const start = this.clockMs;
        const req = this.transmitMultiHopPacket({
          srcDeviceId: dev.id,
          dstDeviceId: resolved.device.id,
          srcIp,
          dstIp: resolved.ip,
          protocol: 'ICMP',
          colorCategory: 'icmp',
          info: `Echo (ping) request  id=0x0401, seq=${seq}/${count}, ttl=${ttl}`,
          osiLayer: 3,
          ttl,
          sizeBytes: size + 28,
          df: true,
          icmp: { type: 8, code: 0, identifier: 0x0401, sequence: seq, message: 'ping-payload' },
        });
        if (!req.delivered) {
          lines.push(`From ${srcIp} icmp_seq=${seq} ${req.dropReason ?? 'Destination Host Unreachable'}`);
          continue;
        }
        const rep = this.transmitMultiHopPacket({
          srcDeviceId: resolved.device.id,
          dstDeviceId: dev.id,
          srcIp: resolved.ip,
          dstIp: srcIp,
          protocol: 'ICMP',
          colorCategory: 'icmp',
          info: `Echo (ping) reply    id=0x0401, seq=${seq}/${count}, ttl=${req.finalTtl ?? 64}`,
          osiLayer: 3,
          ttl: 64,
          sizeBytes: size + 28,
          icmp: { type: 0, code: 0, identifier: 0x0401, sequence: seq, message: 'ping-payload' },
        });
        if (rep.delivered) {
          received++;
          const rtt = Number((this.clockMs - start).toFixed(2));
          times.push(rtt);
          lines.push(`${size + 8} bytes from ${resolved.ip}: icmp_seq=${seq} ttl=${req.finalTtl ?? 64} time=${rtt} ms`);
        } else {
          lines.push(`Request timeout for icmp_seq ${seq} (${rep.dropReason ?? 'dropped'})`);
        }
      }
      const loss = (((count - received) / count) * 100).toFixed(0);
      const avg = times.length ? (times.reduce((a, b) => a + b, 0) / times.length).toFixed(2) : '0.00';
      lines.push(`\n--- ${target} ping statistics ---`);
      lines.push(`${count} packets transmitted, ${received} received, ${loss}% packet loss, avg rtt = ${avg} ms`);
      return lines.join('\n');
    }

    if (cmd === 'traceroute' || cmd === 'tracert') {
      const target = args[0];
      if (!target) return 'Usage: traceroute <host|ip>';
      const resolved = resolveTarget(target);
      if (!resolved.device || !resolved.ip) return `traceroute: unknown host ${target}`;
      const path = this.findPath(dev.id, resolved.device.id);
      if (path.length < 2) return `traceroute to ${target}: * * * (no route)`;
      const lines = [`traceroute to ${target} (${resolved.ip}), 30 hops max, 60 byte packets`];
      const srcIp = dev.interfaces[0]?.ip || '192.168.1.10';
      for (let hop = 1; hop < path.length; hop++) {
        const hopDev = this.devices.get(path[hop])!;
        const hopIp = hopDev.interfaces[0]?.ip || '0.0.0.0';
        const t0 = this.clockMs;
        this.transmitMultiHopPacket({
          srcDeviceId: dev.id,
          dstDeviceId: resolved.device.id,
          srcIp,
          dstIp: resolved.ip,
          protocol: 'ICMP',
          colorCategory: 'icmp',
          info: `Traceroute probe TTL=${hop}`,
          osiLayer: 3,
          ttl: hop,
          icmp: { type: 8, code: 0, identifier: 0x0500, sequence: hop, message: 'traceroute' },
        });
        const rtt = (this.clockMs - t0 + 1.2).toFixed(2);
        lines.push(` ${String(hop).padStart(2)}  ${hopDev.name} (${hopIp})  ${rtt} ms  ${(Number(rtt) + 0.4).toFixed(2)} ms  ${(Number(rtt) - 0.2).toFixed(2)} ms`);
      }
      return lines.join('\n');
    }

    if (cmd === 'nslookup' || cmd === 'dig') {
      const domain = args.find((a) => !a.startsWith('-')) || 'example.com';
      const qtype = (args[1]?.toUpperCase() as DnsRecord['type']) || 'A';
      const res = this.resolveDns(dev.id, domain, qtype);
      return [
        `; <<>> DiG / nslookup <<>> ${domain} ${qtype}`,
        `;; Trace:`,
        ...res.trace.map((t) => `;;   ${t}`),
        res.ip ? `${domain}.\t\t300\tIN\t${qtype}\t${res.ip}` : `;; status: NXDOMAIN`,
      ].join('\n');
    }

    if (cmd === 'curl' || cmd === 'wget') {
      const url = args.find((a) => !a.startsWith('-')) || 'http://example.com';
      const verbose = args.includes('-v') || args.includes('-I');
      const cleanHost = url.replace(/^https?:\/\//, '').split('/')[0].split(':')[0];
      const isHttps = url.startsWith('https://');
      const resolved = resolveTarget(cleanHost);
      if (!resolved.device || !resolved.ip) {
        return `curl: (6) Could not resolve host: ${cleanHost}`;
      }
      const port = isHttps ? 443 : 80;
      const srcIp = dev.interfaces[0]?.ip || '192.168.1.10';
      const tcb = this.runTcpTransfer({ clientId: dev.id, serverId: resolved.device.id, serverPort: port, segments: 1 });
      if (tcb.state === 'SYN_SENT') {
        return `curl: (7) Failed to connect to ${cleanHost} port ${port}: Connection timed out / blocked`;
      }
      const reqRes = this.transmitMultiHopPacket({
        srcDeviceId: dev.id,
        dstDeviceId: resolved.device.id,
        srcIp,
        dstIp: resolved.ip,
        protocol: isHttps ? 'TLS' : 'HTTP',
        colorCategory: isHttps ? 'tls' : 'http_req',
        info: isHttps ? 'Application Data (GET /)' : `GET / HTTP/1.1 (Host: ${cleanHost})`,
        osiLayer: 7,
        tcp: {
          srcPort: tcb.localPort,
          dstPort: port,
          seq: 1,
          ack: 1,
          dataOffset: 5,
          flags: { urg: false, ack: true, psh: true, rst: false, syn: false, fin: false },
          window: 65535,
          urgentPointer: 0,
        },
      });
      if (!reqRes.delivered) return `curl: (56) Recv failure: ${reqRes.dropReason}`;
      this.transmitMultiHopPacket({
        srcDeviceId: resolved.device.id,
        dstDeviceId: dev.id,
        srcIp: resolved.ip,
        dstIp: srcIp,
        protocol: isHttps ? 'TLS' : 'HTTP',
        colorCategory: isHttps ? 'tls' : 'http_res',
        info: isHttps ? 'Application Data (200 OK)' : 'HTTP/1.1 200 OK (text/html)',
        osiLayer: 7,
        tcp: {
          srcPort: port,
          dstPort: tcb.localPort,
          seq: 1,
          ack: 120,
          dataOffset: 5,
          flags: { urg: false, ack: true, psh: true, rst: false, syn: false, fin: false },
          window: 65535,
          urgentPointer: 0,
        },
      });
      const body = resolved.device.services.http?.body || `<html><body><h1>Welcome to ${resolved.device.name}</h1></body></html>`;
      if (verbose) {
        return [
          `* Connected to ${cleanHost} (${resolved.ip}) port ${port}`,
          `> GET / HTTP/1.1`,
          `> Host: ${cleanHost}`,
          `< HTTP/1.1 200 OK`,
          `< Content-Type: text/html; charset=UTF-8`,
          `< Content-Length: ${body.length}`,
          ``,
          body,
        ].join('\n');
      }
      return body;
    }

    if (cmd === 'telnet' || cmd === 'nc') {
      const host = args[0];
      const port = Number(args[1]);
      if (!host || !port) return `Usage: ${cmd} <host> <port>`;
      const resolved = resolveTarget(host);
      if (!resolved.device || !resolved.ip) return `${cmd}: unknown host ${host}`;
      const srcIp = dev.interfaces[0]?.ip || '192.168.1.10';
      const probe = this.transmitMultiHopPacket({
        srcDeviceId: dev.id,
        dstDeviceId: resolved.device.id,
        srcIp,
        dstIp: resolved.ip,
        protocol: 'TCP',
        colorCategory: 'tcp',
        info: `54321 -> ${port} [SYN]`,
        osiLayer: 4,
        tcp: {
          srcPort: 54321,
          dstPort: port,
          seq: 0,
          ack: 0,
          dataOffset: 5,
          flags: { urg: false, ack: false, psh: false, rst: false, syn: true, fin: false },
          window: 65535,
          urgentPointer: 0,
        },
      });
      if (!probe.delivered) return `${host} (${resolved.ip}) port ${port}: FILTERED (${probe.dropReason})`;
      const isOpen = resolved.device.openPorts.includes(port);
      return isOpen
        ? `Connected to ${resolved.ip} port ${port} (OPEN).`
        : `${cmd}: connect to address ${resolved.ip} port ${port}: Connection refused (CLOSED/RST)`;
    }

    if (cmd === 'ssh' || cmd === 'ftp') {
      const target = args[0]?.includes('@') ? args[0].split('@')[1] : args[0];
      if (!target) return `Usage: ${cmd} <host>`;
      const port = cmd === 'ssh' ? 22 : 21;
      const resolved = resolveTarget(target);
      if (!resolved.device || !resolved.ip) return `${cmd}: could not resolve ${target}`;
      const isOpen = resolved.device.openPorts.includes(port);
      return isOpen
        ? `${cmd.toUpperCase()} session established to ${resolved.device.name} (${resolved.ip}:${port}) [Encrypted/Control channel ready]`
        : `${cmd}: connect to host ${resolved.ip} port ${port}: Connection refused`;
    }

    if (cmd === 'nmap') {
      const target = args[0];
      if (!target) return 'Usage: nmap <host>';
      const resolved = resolveTarget(target);
      if (!resolved.device || !resolved.ip) return `Failed to resolve "${target}".`;
      const portsToScan = [21, 22, 25, 53, 80, 110, 143, 443, 445, 502, 3389];
      const srcIp = dev.interfaces[0]?.ip || '192.168.1.10';
      const rows: string[] = [
        `Starting Nmap scan report for ${resolved.device.name} (${resolved.ip})`,
        'PORT     STATE     SERVICE',
      ];
      const svcMap: Record<number, string> = {
        21: 'ftp', 22: 'ssh', 25: 'smtp', 53: 'domain', 80: 'http', 110: 'pop3', 143: 'imap', 443: 'https', 445: 'microsoft-ds', 502: 'modbus', 3389: 'ms-wbt-server',
      };
      for (const p of portsToScan) {
        const res = this.transmitMultiHopPacket({
          srcDeviceId: dev.id,
          dstDeviceId: resolved.device.id,
          srcIp,
          dstIp: resolved.ip,
          protocol: 'TCP',
          colorCategory: 'tcp',
          info: `Nmap SYN scan -> port ${p}`,
          osiLayer: 4,
          tcp: {
            srcPort: 49152 + p,
            dstPort: p,
            seq: 0,
            ack: 0,
            dataOffset: 5,
            flags: { urg: false, ack: false, psh: false, rst: false, syn: true, fin: false },
            window: 1024,
            urgentPointer: 0,
          },
        });
        const state = !res.delivered ? 'filtered' : resolved.device.openPorts.includes(p) ? 'open' : 'closed';
        rows.push(`${`${p}/tcp`.padEnd(8)} ${state.padEnd(9)} ${svcMap[p] || 'unknown'}`);
      }
      return rows.join('\n');
    }

    if (cmd === 'tcpdump') {
      const recent = this.packets
        .filter((p) => p.fromDeviceId === dev.id || p.toDeviceId === dev.id)
        .slice(-12);
      if (recent.length === 0) return `tcpdump: listening on ${dev.interfaces[0]?.name || 'eth0'} (no packets captured yet)`;
      return recent
        .map(
          (p) =>
            `${(p.timestampMs / 1000).toFixed(4)} ${p.protocol} ${p.srcIp} > ${p.dstIp}: ${p.info}, length ${p.sizeBytes}`
        )
        .join('\n');
    }

    return `${cmd}: command not found. Type "help" for available commands.`;
  }

  /** Finds a DHCP server the client can reach: on its own LAN, or through a router with ip helper-address. */
  private findDhcpServer(client: SimDevice): { server: SimDevice; giaddr?: string } | null {
    const l2 = new Set(['switch', 'hub', 'access_point']);
    const start = client.id;
    const seen = new Set<string>([start]);
    const queue = [start];
    const edge: SimDevice[] = [];
    while (queue.length) {
      const id = queue.shift()!;
      for (const link of this.getConnectedLinks(id)) {
        if (!link.up) continue;
        const { peerId } = this.getPeerOnLink(link, id);
        const peer = this.devices.get(peerId);
        if (!peer || !peer.poweredOn || seen.has(peerId)) continue;
        seen.add(peerId);
        if (l2.has(peer.role)) queue.push(peerId);
        else edge.push(peer);
      }
    }
    for (const d of edge) {
      if (d.services.dhcp?.enabled) return { server: d };
    }
    for (const d of edge) {
      for (const iface of d.interfaces) {
        if (!iface.helper) continue;
        const server = this.findDeviceByIp(iface.helper);
        if (server?.poweredOn && server.services.dhcp?.enabled && this.findPath(d.id, server.id).length > 1) {
          return { server, giaddr: iface.ip };
        }
      }
    }
    return null;
  }

  /**
   * Runs DHCP Discover → Offer → Request → Ack for a client. On success the client's first interface
   * gets the leased address, mask, gateway and DNS; with no server it falls back to 169.254.x.x.
   */
  public requestDhcp(clientId: string): { ok: boolean; message: string; ip?: string } {
    const client = this.devices.get(clientId);
    if (!client) return { ok: false, message: 'Device not found.' };
    if (!client.poweredOn) return { ok: false, message: `${client.name} is powered off.` };
    const iface = client.interfaces[0];
    if (!iface) return { ok: false, message: `${client.name} has no network interface.` };

    const found = this.findDhcpServer(client);
    const emit = (from: string, to: string, info: string, k: number, srcIp: string, dstIp: string, ports: [number, number], path: string[], drop?: string) =>
      this.enqueueDirectPacket({
        fromId: from,
        toId: to,
        startTimeMs: this.clockMs + k * 6,
        flowPathNodeIds: path.length >= 2 ? path : undefined,
        protocol: 'DHCP',
        colorCategory: 'udp',
        info,
        osiLayer: 7,
        udp: { srcPort: ports[0], dstPort: ports[1] },
        ipv4: { version: 4, ihl: 5, tos: 0, identification: 0xd000 + k, flags: { df: false, mf: false }, fragmentOffset: 0, ttl: 64, protocol: 17, srcIp, dstIp },
        forceDrop: Boolean(drop),
        dropReason: drop,
      });

    if (!found) {
      const path = this.getConnectedLinks(client.id).length ? [client.id, this.getPeerOnLink(this.getConnectedLinks(client.id)[0], client.id).peerId] : [];
      const peer = path[1];
      if (peer) emit(client.id, peer, 'DHCPDISCOVER (Broadcast) — no reply', 0, '0.0.0.0', '255.255.255.255', [68, 67], path, 'No DHCP server answered');
      this.runAll();
      const a = Math.floor(this.rng.next() * 254) + 1;
      const c = Math.floor(this.rng.next() * 254) + 1;
      iface.ip = `169.254.${a}.${c}`;
      iface.mask = '255.255.0.0';
      iface.gateway = undefined;
      client.dhcpEnabled = true;
      this.configDirty = true;
      return { ok: false, message: `DHCP failed: no server answered. Using link-local address ${iface.ip}.`, ip: iface.ip };
    }

    const { server, giaddr } = found;
    const cfg = server.services.dhcp!;
    const serverIp = server.interfaces.find((i) => i.ip)?.ip ?? '0.0.0.0';
    const scope = giaddr ?? serverIp;
    if (!sameSubnet(cfg.poolStart, scope, cfg.mask)) {
      this.runAll();
      return { ok: false, message: `DHCP failed: ${server.name} has no address pool for the ${scope} network.` };
    }

    const leases = this.dhcpLeases.get(server.id) ?? [];
    const mine = leases.find((l) => l.mac === iface.mac);
    const used = new Set<string>();
    for (const d of this.devices.values()) for (const i of d.interfaces) if (i.ip && !(d.id === client.id && i === iface)) used.add(i.ip);
    for (const l of leases) if (l.mac !== iface.mac) used.add(l.ip);
    let offer = mine?.ip;
    if (!offer) {
      for (let n = ipToInt(cfg.poolStart); n <= ipToInt(cfg.poolEnd); n++) {
        const ip = intToIp(n >>> 0);
        if (!used.has(ip)) {
          offer = ip;
          break;
        }
      }
    }

    const path = this.findPath(client.id, server.id);
    const back = [...path].reverse();
    emit(client.id, server.id, 'DHCPDISCOVER (Broadcast)', 0, '0.0.0.0', '255.255.255.255', [68, 67], path);
    if (!offer) {
      emit(server.id, client.id, 'DHCPNAK (address pool exhausted)', 1, serverIp, '255.255.255.255', [67, 68], back);
      this.runAll();
      return { ok: false, message: `DHCP failed: ${server.name} has no free addresses (${cfg.poolStart}–${cfg.poolEnd}).` };
    }
    emit(server.id, client.id, `DHCPOFFER ${offer}`, 1, serverIp, offer, [67, 68], back);
    emit(client.id, server.id, `DHCPREQUEST ${offer}`, 2, '0.0.0.0', '255.255.255.255', [68, 67], path);
    emit(server.id, client.id, `DHCPACK ${offer}/${cidrOf(cfg.mask)}`, 3, serverIp, offer, [67, 68], back);
    this.runAll();

    const lease: DhcpLease = { mac: iface.mac, ip: offer, mask: cfg.mask, gateway: cfg.gateway, dns: cfg.dns, expiresAtMs: this.clockMs + 86_400_000 };
    this.dhcpLeases.set(server.id, [...leases.filter((l) => l.mac !== iface.mac), lease]);
    iface.ip = offer;
    iface.mask = cfg.mask;
    iface.gateway = cfg.gateway;
    client.dnsServer = cfg.dns;
    client.dhcpEnabled = true;
    this.configDirty = true;
    return { ok: true, ip: offer, message: `DHCP lease acquired from ${server.name}${giaddr ? ` via relay ${giaddr}` : ''}: ${offer}/${cidrOf(cfg.mask)}, gateway ${cfg.gateway}, DNS ${cfg.dns}` };
  }

  /** Gives the address back and clears the interface. */
  public releaseDhcp(clientId: string): string {
    const client = this.devices.get(clientId);
    const iface = client?.interfaces[0];
    if (!client || !iface) return 'Device not found.';
    for (const [sid, list] of this.dhcpLeases) this.dhcpLeases.set(sid, list.filter((l) => l.mac !== iface.mac));
    iface.ip = '';
    iface.gateway = undefined;
    client.dhcpEnabled = true;
    this.configDirty = true;
    return 'DHCP lease released. The interface now has no IP address.';
  }

  /**
   * Sends one test packet from `srcId` to `dstId` and records whether it arrived, like Packet Tracer's
   * "Add Simple PDU". ICMP waits for the echo reply; TCP checks the handshake probe reaches an open
   * port (80); UDP only needs the datagram to be delivered.
   */
  public sendPdu(srcId: string, dstId: string, kind: PduKind = 'ICMP'): PduRecord | null {
    const src = this.devices.get(srcId);
    const dst = this.devices.get(dstId);
    if (!src || !dst || src.id === dst.id) return null;
    const srcIp = src.interfaces.find((i) => i.ip)?.ip ?? '';
    const dstIp = dst.interfaces.find((i) => i.ip)?.ip ?? '';
    const before = this.packets.length;
    const startMs = this.clockMs;
    let status: PduRecord['status'] = 'Failed';
    let reason: string | undefined;

    if (!src.poweredOn) reason = `${src.name} is powered off`;
    else if (!srcIp) reason = `${src.name} has no IP address`;
    else if (!dstIp) reason = `${dst.name} has no IP address`;
    else {
      const base = { srcDeviceId: src.id, dstDeviceId: dst.id, srcIp, dstIp } as const;
      if (kind === 'ICMP') {
        const req = this.transmitMultiHopPacket({
          ...base,
          protocol: 'ICMP',
          colorCategory: 'icmp',
          info: 'PDU: Echo (ping) request',
          osiLayer: 3,
          icmp: { type: 8, code: 0, identifier: 0x7001, sequence: this.pduSeq + 1, message: 'pdu' },
        });
        if (!req.delivered) reason = req.dropReason ?? 'Destination unreachable';
        else {
          const rep = this.transmitMultiHopPacket({
            srcDeviceId: dst.id,
            dstDeviceId: src.id,
            srcIp: dstIp,
            dstIp: srcIp,
            protocol: 'ICMP',
            colorCategory: 'icmp',
            info: 'PDU: Echo (ping) reply',
            osiLayer: 3,
            icmp: { type: 0, code: 0, identifier: 0x7001, sequence: this.pduSeq + 1, message: 'pdu' },
          });
          if (rep.delivered) status = 'Successful';
          else reason = `Reply lost: ${rep.dropReason ?? 'dropped on the way back'}`;
        }
      } else if (kind === 'UDP') {
        const res = this.transmitMultiHopPacket({
          ...base,
          protocol: 'UDP',
          colorCategory: 'udp',
          info: 'PDU: UDP datagram',
          osiLayer: 4,
          udp: { srcPort: 49200, dstPort: 5001 },
        });
        if (res.delivered) status = 'Successful';
        else reason = res.dropReason ?? 'Dropped';
      } else {
        const res = this.transmitMultiHopPacket({
          ...base,
          protocol: 'TCP',
          colorCategory: 'tcp',
          info: 'PDU: TCP SYN to port 80',
          osiLayer: 4,
          tcp: {
            srcPort: 49201,
            dstPort: 80,
            seq: 0,
            ack: 0,
            dataOffset: 5,
            flags: { urg: false, ack: false, psh: false, rst: false, syn: true, fin: false },
            window: 65535,
            urgentPointer: 0,
          },
        });
        if (!res.delivered) reason = res.dropReason ?? 'Dropped';
        else if (!dst.openPorts.includes(80)) reason = `Connection refused: ${dst.name} is not listening on port 80`;
        else status = 'Successful';
      }
    }

    this.runAll();
    const first = this.packets[before];
    const last = this.packets[this.packets.length - 1];
    const record: PduRecord = {
      id: ++this.pduSeq,
      kind,
      srcId: src.id,
      dstId: dst.id,
      srcName: src.name,
      dstName: dst.name,
      srcIp,
      dstIp,
      status,
      reason,
      startMs,
      endMs: this.clockMs,
      firstPacketNo: first && this.packets.length > before ? first.no : 0,
      lastPacketNo: first && this.packets.length > before ? last.no : 0,
    };
    this.pdus.push(record);
    return record;
  }

  /**
   * Generates traffic bursts (CBR, ping flood, HTTP load, or iPerf test) between two devices.
   */
  public runTrafficGenerator(
    mode: 'cbr' | 'burst' | 'ping_flood' | 'http_load' | 'iperf',
    srcId: string,
    dstId: string
  ): string {
    const src = this.devices.get(srcId);
    const dst = this.devices.get(dstId);
    if (!src || !dst) return 'Select valid source and destination devices.';
    const srcIp = src.interfaces[0]?.ip || '192.168.1.10';
    const dstIp = dst.interfaces[0]?.ip || '203.0.113.10';

    if (mode === 'iperf') {
      const tcb = this.runTcpTransfer({ clientId: srcId, serverId: dstId, serverPort: 5201, segments: 16 });
      const metrics = this.getMetrics();
      return `iPerf3 completed: ${tcb.cwndHistory.length} RTT rounds, final cwnd=${tcb.cwnd} MSS, throughput=${metrics.throughputKbps} Kbps`;
    }

    const count = mode === 'burst' ? 12 : mode === 'ping_flood' ? 15 : 8;
    for (let i = 1; i <= count; i++) {
      this.transmitMultiHopPacket({
        srcDeviceId: srcId,
        dstDeviceId: dstId,
        srcIp,
        dstIp,
        protocol: mode === 'ping_flood' ? 'ICMP' : mode === 'http_load' ? 'HTTP' : 'UDP',
        colorCategory: mode === 'ping_flood' ? 'icmp' : mode === 'http_load' ? 'http_req' : 'udp',
        info:
          mode === 'ping_flood'
            ? `ICMP Flood Echo seq=${i}`
            : mode === 'http_load'
            ? `GET /api/data?n=${i} HTTP/1.1`
            : `CBR UDP Stream datagram #${i}`,
        osiLayer: mode === 'ping_flood' ? 3 : mode === 'http_load' ? 7 : 4,
        sizeBytes: mode === 'burst' ? 1400 : 256,
        icmp: mode === 'ping_flood' ? { type: 8, code: 0, identifier: 0x9999, sequence: i, message: 'flood' } : undefined,
        udp: mode !== 'http_load' && mode !== 'ping_flood' ? { srcPort: 40000 + i, dstPort: 5001 } : undefined,
        tcp:
          mode === 'http_load'
            ? {
                srcPort: 51000 + i,
                dstPort: 80,
                seq: i * 100,
                ack: 1,
                dataOffset: 5,
                flags: { urg: false, ack: true, psh: true, rst: false, syn: false, fin: false },
                window: 65535,
                urgentPointer: 0,
              }
            : undefined,
      });
    }
    return `${mode.toUpperCase()} sent ${count} packets from ${src.name} to ${dst.name}.`;
  }
}

export function createDefaultInterface(
  id: string,
  name: string,
  ip: string,
  mask = '255.255.255.0',
  gateway?: string,
  macSuffix = '01'
): NetworkInterface {
  return {
    id,
    name,
    mac: `02:42:ac:11:00:${macSuffix}`,
    ip,
    mask,
    gateway,
    vlan: 1,
    up: true,
  };
}

export function nextAvailableIp(baseIp: string, offset: number): string {
  return intToIp((ipToInt(baseIp) + offset) >>> 0);
}
