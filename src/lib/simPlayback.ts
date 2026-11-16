import type { CapturedPacket, PacketCurvedPath, SimDevice, SimLink } from '../engine/types';

export const SIM_PLAYBACK_SPEEDS = [0.25, 0.5, 1, 2, 5, 10] as const;

export type SimShortcutAction =
  | 'toggle_play'
  | 'step_forward'
  | 'step_back'
  | 'rewind'
  | 'jump_end'
  | 'reset'
  | 'toggle_mode'
  | 'speed_up'
  | 'speed_down'
  | 'toggle_shortcuts_help';

export interface SimShortcutContext {
  key: string;
  code?: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  playbackMode: 'live' | 'step';
  targetTagName?: string | null;
  isContentEditable?: boolean;
  modalOpen?: boolean;
}

/**
 * Maps a keyboard event context to a simulator playback action, guarding text inputs and modals.
 */
export function resolveSimShortcutAction(ctx: SimShortcutContext): SimShortcutAction | null {
  if (ctx.modalOpen) return null;
  if (ctx.ctrlKey || ctx.metaKey || ctx.altKey) return null;
  if (ctx.isContentEditable) return null;

  const tag = (ctx.targetTagName ?? '').toUpperCase();
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return null;

  if (ctx.code === 'Space' || ctx.key === ' ') return 'toggle_play';
  if (ctx.key === 'ArrowRight') return 'step_forward';
  if (ctx.key === 'ArrowLeft') return ctx.playbackMode === 'step' ? 'step_back' : null;
  if (ctx.key === 'Home') return ctx.playbackMode === 'step' ? 'rewind' : null;
  if (ctx.key === 'End') return ctx.playbackMode === 'step' ? 'jump_end' : null;

  const lower = ctx.key.toLowerCase();
  if (lower === 'r') return 'reset';
  if (lower === 'm') return 'toggle_mode';
  if (ctx.key === '+' || ctx.key === '=') return 'speed_up';
  if (ctx.key === '-' || ctx.key === '_') return 'speed_down';
  if (ctx.key === '?') return 'toggle_shortcuts_help';

  return null;
}

export interface ProtocolStateSnapshot {
  phase: string;
  transition: string;
  detail: string;
  tone: 'info' | 'success' | 'warning' | 'danger';
}

/**
 * Derives a clear human-readable protocol state change description for a single packet delivery event.
 */
export function describePacketStateChange(
  pkt: CapturedPacket,
  fromName: string,
  toName: string
): ProtocolStateSnapshot {
  if (pkt.dropped) {
    return {
      phase: 'Packet Dropped',
      transition: `DROP at ${toName}`,
      detail: `${fromName} → ${toName}: ${pkt.dropReason ?? 'Transmission failure'}`,
      tone: 'danger',
    };
  }

  const { arp, tcp, tls, dns, icmp, udp, app } = pkt.layers;

  if (arp) {
    if (arp.opcode === 1) {
      return {
        phase: 'L2 ARP Discovery',
        transition: `ARP Request (${arp.targetIp})`,
        detail: `${fromName} broadcasts "Who has ${arp.targetIp}?" to resolve MAC address`,
        tone: 'warning',
      };
    }
    return {
      phase: 'L2 ARP Cache Update',
      transition: `ARP Reply (${arp.senderIp} → ${arp.senderMac})`,
      detail: `${toName} learns MAC ${arp.senderMac} for ${arp.senderIp}`,
      tone: 'success',
    };
  }

  if (tcp) {
    const f = tcp.flags;
    if (f.rst) {
      return {
        phase: 'TCP Reset',
        transition: 'ANY → CLOSED (RST)',
        detail: `${fromName} → ${toName}: Connection aborted/refused on port ${tcp.dstPort}`,
        tone: 'danger',
      };
    }
    if (f.syn && !f.ack) {
      return {
        phase: 'TCP 3-Way Handshake',
        transition: 'CLOSED → SYN_SENT',
        detail: `${fromName} initiates TCP connection to ${toName}:${tcp.dstPort} (Seq=${tcp.seq})`,
        tone: 'info',
      };
    }
    if (f.syn && f.ack) {
      return {
        phase: 'TCP 3-Way Handshake',
        transition: 'LISTEN → SYN_RCVD',
        detail: `${fromName} acknowledges SYN (Ack=${tcp.ack}) and sends SYN to ${toName}`,
        tone: 'info',
      };
    }
    if (f.fin) {
      return {
        phase: 'TCP Teardown',
        transition: 'ESTABLISHED → FIN_WAIT / CLOSE_WAIT',
        detail: `${fromName} signals end-of-stream (FIN, Seq=${tcp.seq}) to ${toName}`,
        tone: 'warning',
      };
    }
    if (tls) {
      return {
        phase: 'TLS Security Handshake',
        transition: `${tls.version} · ${tls.handshakeType ?? tls.recordType}`,
        detail: `${fromName} → ${toName}: ${pkt.info}`,
        tone: 'success',
      };
    }
    if (app) {
      return {
        phase: `${app.protocolName} Exchange`,
        transition: `ESTABLISHED · ${app.protocolName}`,
        detail: `${fromName} → ${toName}: ${app.summary}`,
        tone: 'success',
      };
    }
    if (f.psh && f.ack) {
      return {
        phase: 'TCP Data Delivery',
        transition: `ESTABLISHED · DATA (${pkt.sizeBytes}B)`,
        detail: `${fromName} → ${toName}: Seq=${tcp.seq}, Ack=${tcp.ack}`,
        tone: 'info',
      };
    }
    return {
      phase: 'TCP State Confirmation',
      transition: 'SYN_SENT / SYN_RCVD → ESTABLISHED',
      detail: `${fromName} → ${toName}: ACK confirmed (Seq=${tcp.seq}, Ack=${tcp.ack})`,
      tone: 'success',
    };
  }

  if (dns) {
    if (dns.isResponse) {
      const firstAns = dns.answers[0];
      return {
        phase: 'DNS Cache & Resolution',
        transition: firstAns ? `Resolved ${firstAns.name} → ${firstAns.value}` : 'DNS Response Delivered',
        detail: firstAns
          ? `${fromName} → ${toName}: TTL ${firstAns.ttl}s (${firstAns.type} record cached)`
          : `${fromName} → ${toName}: ${pkt.info}`,
        tone: 'success',
      };
    }
    const q = dns.questions[0];
    return {
      phase: 'DNS Query',
      transition: q ? `Lookup ${q.type} ${q.name}` : 'DNS Query Sent',
      detail: `${fromName} queries resolver ${toName} (TxID 0x${dns.transactionId.toString(16)})`,
      tone: 'info',
    };
  }

  if (icmp) {
    if (icmp.type === 8) {
      return {
        phase: 'ICMP Echo Probe',
        transition: `Echo Request (seq=${icmp.sequence})`,
        detail: `${fromName} → ${toName}: TTL=${pkt.layers.ipv4?.ttl ?? 64}`,
        tone: 'info',
      };
    }
    if (icmp.type === 0) {
      return {
        phase: 'ICMP Echo Reply',
        transition: `Echo Reply (seq=${icmp.sequence})`,
        detail: `${fromName} → ${toName}: Reachability confirmed (${(pkt.arrivalMs - pkt.timestampMs).toFixed(1)}ms)`,
        tone: 'success',
      };
    }
    return {
      phase: 'ICMP Control Notice',
      transition: `ICMP Type ${icmp.type}/${icmp.code}`,
      detail: `${fromName} → ${toName}: ${icmp.message || pkt.info}`,
      tone: 'warning',
    };
  }

  if (udp) {
    return {
      phase: 'UDP Datagram Delivery',
      transition: `${udp.srcPort} → ${udp.dstPort} (${pkt.protocol})`,
      detail: `${fromName} → ${toName}: ${pkt.info}`,
      tone: 'info',
    };
  }

  return {
    phase: `${pkt.protocol} Delivery`,
    transition: `${fromName} → ${toName}`,
    detail: pkt.info,
    tone: 'info',
  };
}

export interface PacketPoint {
  x: number;
  y: number;
}

/**
 * Computes interpolated (x, y) coordinates along a straight, curved Bezier, or self-loop link path.
 */
export function computeAnimatedPacketPosition(
  from: PacketPoint,
  to: PacketPoint,
  t: number,
  curveControl?: PacketPoint | null
): PacketPoint {
  const clamped = Math.max(0, Math.min(1, t));

  // Self-loop when source and target coincide
  if (Math.hypot(to.x - from.x, to.y - from.y) < 1) {
    const angle = clamped * Math.PI * 2;
    return {
      x: from.x + Math.cos(angle) * 26,
      y: from.y - 24 + Math.sin(angle) * 14,
    };
  }

  if (curveControl) {
    const inv = 1 - clamped;
    return {
      x: inv * inv * from.x + 2 * inv * clamped * curveControl.x + clamped * clamped * to.x,
      y: inv * inv * from.y + 2 * inv * clamped * curveControl.y + clamped * clamped * to.y,
    };
  }

  return {
    x: from.x + (to.x - from.x) * clamped,
    y: from.y + (to.y - from.y) * clamped,
  };
}

export interface ResolvedPacketCurveGeometry {
  control: PacketPoint | null;
  svgPathD: string;
  isNonDirect: boolean;
}

/**
 * Resolves the SVG connection path and quadratic Bezier control point for a packet,
 * supporting direct physical links (straight or parallel-offset) and curved paths between non-direct nodes.
 */
export function resolvePacketCurveGeometry(
  from: PacketPoint,
  to: PacketPoint,
  matchedLink: SimLink | undefined,
  linkCurveOffset: number,
  devMap: Map<string, SimDevice>,
  engineCurvedPath?: PacketCurvedPath
): ResolvedPacketCurveGeometry {
  // 1. Direct physical link (straight or parallel-link curved)
  if (matchedLink) {
    if (linkCurveOffset !== 0) {
      const la = devMap.get(matchedLink.sourceId);
      const lb = devMap.get(matchedLink.targetId);
      if (la && lb) {
        const ldx = lb.x - la.x;
        const ldy = lb.y - la.y;
        const llen = Math.max(1, Math.hypot(ldx, ldy));
        const control = {
          x: (la.x + lb.x) / 2 + (-ldy / llen) * linkCurveOffset,
          y: (la.y + lb.y) / 2 + (ldx / llen) * linkCurveOffset,
        };
        return {
          control,
          svgPathD: `M ${from.x} ${from.y} Q ${control.x} ${control.y} ${to.x} ${to.y}`,
          isNonDirect: false,
        };
      }
    }
    return {
      control: null,
      svgPathD: `M ${from.x} ${from.y} L ${to.x} ${to.y}`,
      isNonDirect: false,
    };
  }

  // 2. Non-direct nodes: use engine-calculated curvedPath when coordinates match, or adapt if dragged
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dist = Math.hypot(dx, dy);

  if (dist < 1) {
    return {
      control: engineCurvedPath?.control ?? { x: from.x, y: from.y - 48 },
      svgPathD:
        engineCurvedPath?.svgPathD ??
        `M ${from.x} ${from.y} C ${from.x - 36} ${from.y - 44}, ${from.x + 36} ${from.y - 44}, ${to.x} ${to.y}`,
      isNonDirect: true,
    };
  }

  if (engineCurvedPath) {
    const unchanged =
      Math.hypot(from.x - engineCurvedPath.start.x, from.y - engineCurvedPath.start.y) < 0.5 &&
      Math.hypot(to.x - engineCurvedPath.end.x, to.y - engineCurvedPath.end.y) < 0.5;
    if (unchanged) {
      return {
        control: engineCurvedPath.control,
        svgPathD: engineCurvedPath.svgPathD,
        isNonDirect: engineCurvedPath.isNonDirect,
      };
    }
  }

  const mx = (from.x + to.x) / 2;
  const my = (from.y + to.y) / 2;
  const nx = -dy / dist;
  const ny = dx / dist;
  const arcOffset = engineCurvedPath?.arcOffset ?? Math.max(48, Math.min(132, dist * 0.24));
  const control = {
    x: Number((mx + nx * arcOffset).toFixed(2)),
    y: Number((my + ny * arcOffset).toFixed(2)),
  };

  return {
    control,
    svgPathD: `M ${from.x} ${from.y} Q ${control.x} ${control.y} ${to.x} ${to.y}`,
    isNonDirect: true,
  };
}

