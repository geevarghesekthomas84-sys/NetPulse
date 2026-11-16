import { ipToInt, maskToPrefix, matchesCidr, sameSubnet } from '../lib/ipUtils';
import type {
  CapturedPacket,
  FirewallRule,
  NatTranslation,
  RouteEntry,
  SimDevice,
  SimLink,
} from './types';

/**
 * Longest-Prefix Match (LPM) routing lookup.
 * Returns the route entry with the longest matching subnet mask (tie-broken by lowest metric).
 */
export function lookupRouteLpm(routingTable: RouteEntry[], dstIp: string): RouteEntry | undefined {
  let best: RouteEntry | undefined;
  let bestPrefix = -1;
  let bestMetric = Infinity;

  for (const route of routingTable) {
    if (matchesCidr(dstIp, route.network, route.mask)) {
      const prefix = maskToPrefix(route.mask);
      if (prefix > bestPrefix || (prefix === bestPrefix && route.metric < bestMetric)) {
        best = route;
        bestPrefix = prefix;
        bestMetric = route.metric;
      }
    }
  }
  return best;
}

/**
 * Learns source MAC on a switch port + VLAN and returns egress port(s) for destination MAC.
 */
export function switchForward(
  sw: SimDevice,
  inIfaceId: string,
  srcMac: string,
  dstMac: string,
  vlan: number,
  nowMs: number,
  links: SimLink[]
): { outIfaceIds: string[]; flooded: boolean } {
  // Learn source MAC
  if (srcMac && srcMac !== 'ff:ff:ff:ff:ff:ff') {
    const existing = sw.macTable.find((e) => e.mac.toLowerCase() === srcMac.toLowerCase() && e.vlan === vlan);
    if (existing) {
      existing.portIfaceId = inIfaceId;
      existing.learnedAtMs = nowMs;
    } else {
      sw.macTable.push({
        mac: srcMac,
        portIfaceId: inIfaceId,
        vlan,
        learnedAtMs: nowMs,
      });
    }
  }

  // Age old MAC entries (> 300s)
  sw.macTable = sw.macTable.filter((e) => nowMs - e.learnedAtMs < 300_000);

  const connectedIfaceIds = sw.interfaces
    .filter((iface) => {
      if (!iface.up || iface.id === inIfaceId) return false;
      const hasUpLink = links.some(
        (l) =>
          l.up &&
          ((l.sourceId === sw.id && l.sourceIface === iface.id) ||
            (l.targetId === sw.id && l.targetIface === iface.id))
      );
      if (!hasUpLink) return false;
      if (iface.isTrunk) {
        return !iface.trunkVlans || iface.trunkVlans.includes(vlan);
      }
      return (iface.vlan ?? 1) === vlan;
    })
    .map((i) => i.id);

  // Broadcast / Multicast -> flood
  if (dstMac.toLowerCase() === 'ff:ff:ff:ff:ff:ff' || dstMac.startsWith('01:00:5e') || dstMac.startsWith('33:33')) {
    return { outIfaceIds: connectedIfaceIds, flooded: true };
  }

  // Unicast lookup
  const targetEntry = sw.macTable.find((e) => e.mac.toLowerCase() === dstMac.toLowerCase() && e.vlan === vlan);
  if (targetEntry && connectedIfaceIds.includes(targetEntry.portIfaceId)) {
    return { outIfaceIds: [targetEntry.portIfaceId], flooded: false };
  }

  // Unknown unicast -> flood
  return { outIfaceIds: connectedIfaceIds, flooded: true };
}

/**
 * Evaluates Firewall ACL rules against a packet.
 * Stateful firewall remembers outbound established flows.
 */
export function evaluateFirewall(
  fw: SimDevice,
  pkt: CapturedPacket,
  direction: 'inbound' | 'outbound',
  establishedFlows: Set<string>
): { allowed: boolean; matchedRule?: FirewallRule } {
  const proto: 'TCP' | 'UDP' | 'ICMP' | 'ANY' = pkt.layers.tcp
    ? 'TCP'
    : pkt.layers.udp
    ? 'UDP'
    : pkt.layers.icmp
    ? 'ICMP'
    : 'ANY';

  const srcPort = pkt.layers.tcp?.srcPort ?? pkt.layers.udp?.srcPort ?? 0;
  const dstPort = pkt.layers.tcp?.dstPort ?? pkt.layers.udp?.dstPort ?? 0;

  if (fw.statefulFirewall) {
    const reverseKey = `${proto}:${pkt.dstIp}:${dstPort}->${pkt.srcIp}:${srcPort}`;
    if (establishedFlows.has(reverseKey)) {
      return { allowed: true };
    }
  }

  for (const rule of fw.firewallRules) {
    if (rule.direction !== 'both' && rule.direction !== direction) continue;
    if (rule.protocol !== 'ANY' && rule.protocol !== proto) continue;
    if (rule.srcIp !== 'any' && rule.srcIp !== pkt.srcIp) continue;
    if (rule.dstIp !== 'any' && rule.dstIp !== pkt.dstIp) continue;
    if (rule.dstPort !== 'any' && rule.dstPort !== dstPort) continue;

    rule.hits = (rule.hits ?? 0) + 1;
    if (rule.action === 'allow' && fw.statefulFirewall) {
      const flowKey = `${proto}:${pkt.srcIp}:${srcPort}->${pkt.dstIp}:${dstPort}`;
      establishedFlows.add(flowKey);
    }
    return { allowed: rule.action === 'allow', matchedRule: rule };
  }

  // Implicit allow if no rules exist, else implicit deny when rules are configured
  if (fw.firewallRules.length === 0) {
    return { allowed: true };
  }
  return { allowed: false };
}

/**
 * Performs NAT/PAT outbound translation and inbound reverse lookup.
 */
export function applyNatOutbound(
  natDevice: SimDevice,
  srcIp: string,
  srcPort: number,
  dstIp: string,
  dstPort: number,
  proto: 'TCP' | 'UDP' | 'ICMP',
  publicIp: string,
  nowMs: number
): { translatedIp: string; translatedPort: number; entry: NatTranslation } {
  const existing = natDevice.natTable.find(
    (n) =>
      n.proto === proto &&
      n.insideLocalIp === srcIp &&
      n.insideLocalPort === srcPort &&
      n.outsideIp === dstIp
  );
  if (existing) {
    return {
      translatedIp: existing.insideGlobalIp,
      translatedPort: existing.insideGlobalPort,
      entry: existing,
    };
  }
  const usedPorts = new Set(natDevice.natTable.map((n) => n.insideGlobalPort));
  let mappedPort = 40000 + (srcPort % 20000);
  while (usedPorts.has(mappedPort)) mappedPort++;
  const entry: NatTranslation = {
    id: `nat-${natDevice.natTable.length + 1}`,
    proto,
    insideLocalIp: srcIp,
    insideLocalPort: srcPort,
    insideGlobalIp: publicIp,
    insideGlobalPort: mappedPort,
    outsideIp: dstIp,
    outsidePort: dstPort,
    createdAtMs: nowMs,
  };
  natDevice.natTable.push(entry);
  return { translatedIp: publicIp, translatedPort: mappedPort, entry };
}

export function lookupNatInbound(
  natDevice: SimDevice,
  dstGlobalPort: number,
  proto: 'TCP' | 'UDP' | 'ICMP'
): NatTranslation | undefined {
  return natDevice.natTable.find((n) => n.proto === proto && n.insideGlobalPort === dstGlobalPort);
}

/**
 * Computes IPv4 fragments when packet totalLength exceeds link MTU.
 */
export function fragmentByMtu(totalLength: number, mtu: number): Array<{ offset: number; length: number; mf: boolean }> {
  if (totalLength <= mtu) {
    return [{ offset: 0, length: totalLength, mf: false }];
  }
  const ipHeaderSize = 20;
  const maxPayloadPerFrag = Math.max(8, Math.floor((mtu - ipHeaderSize) / 8) * 8);
  const totalPayload = Math.max(8, totalLength - ipHeaderSize);
  const frags: Array<{ offset: number; length: number; mf: boolean }> = [];
  let offsetBytes = 0;
  while (offsetBytes < totalPayload) {
    const remaining = totalPayload - offsetBytes;
    const chunk = Math.min(maxPayloadPerFrag, remaining);
    const mf = offsetBytes + chunk < totalPayload;
    frags.push({
      offset: offsetBytes / 8,
      length: ipHeaderSize + chunk,
      mf,
    });
    offsetBytes += chunk;
  }
  return frags;
}

/**
 * Checks ARP cache for IP, pruning expired entries.
 */
export function lookupArp(device: SimDevice, ip: string, nowMs: number): string | undefined {
  device.arpCache = device.arpCache.filter((e) => e.static || e.expiresAtMs > nowMs);
  return device.arpCache.find((e) => e.ip === ip)?.mac;
}

export function upsertArp(device: SimDevice, ip: string, mac: string, nowMs: number, ttlMs = 120_000): void {
  const existing = device.arpCache.find((e) => e.ip === ip);
  if (existing) {
    existing.mac = mac;
    existing.expiresAtMs = nowMs + ttlMs;
  } else {
    device.arpCache.push({ ip, mac, expiresAtMs: nowMs + ttlMs });
  }
}

/**
 * Finds the best connected interface on `device` for reaching `nextHopIp`.
 */
export function findOutInterface(device: SimDevice, nextHopIp: string) {
  return (
    device.interfaces.find((i) => i.up && i.ip && i.mask && sameSubnet(i.ip, nextHopIp, i.mask)) ??
    device.interfaces.find((i) => i.up)
  );
}

/**
 * Simple RIP/OSPF/BGP route propagation across connected routers.
 */
export function convergeRoutingTables(devices: SimDevice[], links: SimLink[]): void {
  const routers = devices.filter((d) => d.poweredOn && (d.role === 'router' || d.role === 'firewall' || d.role === 'nat_gateway'));

  // Populate connected routes first
  for (const r of routers) {
    for (const iface of r.interfaces) {
      if (!iface.up || !iface.ip || !iface.mask) continue;
      const netInt = (ipToInt(iface.ip) & ipToInt(iface.mask)) >>> 0;
      const netStr = [
        (netInt >>> 24) & 0xff,
        (netInt >>> 16) & 0xff,
        (netInt >>> 8) & 0xff,
        netInt & 0xff,
      ].join('.');
      const exists = r.routingTable.some((rt) => rt.network === netStr && rt.mask === iface.mask);
      if (!exists) {
        r.routingTable.push({
          network: netStr,
          mask: iface.mask,
          nextHop: '0.0.0.0',
          iface: iface.id,
          metric: 0,
          protocol: 'connected',
        });
      }
    }
  }

  // Distance-vector / link-state relaxation iterations
  const iterations = Math.max(2, routers.length);
  for (let step = 0; step < iterations; step++) {
    for (const link of links) {
      if (!link.up) continue;
      const a = routers.find((d) => d.id === link.sourceId);
      const b = routers.find((d) => d.id === link.targetId);
      if (!a || !b) continue;
      if (a.routingProtocol === 'none' && b.routingProtocol === 'none') continue;

      const aIface = a.interfaces.find((i) => i.id === link.sourceIface);
      const bIface = b.interfaces.find((i) => i.id === link.targetIface);
      if (!aIface || !bIface || !aIface.ip || !bIface.ip) continue;

      const proto = a.routingProtocol && a.routingProtocol !== 'none' ? a.routingProtocol : b.routingProtocol || 'ospf';
      const linkCost = proto === 'ospf' ? Math.max(1, Math.round(100 / Math.max(1, link.bandwidthMbps))) : 1;

      const share = (from: SimDevice, to: SimDevice, nextHopIp: string, outIfaceId: string) => {
        for (const rt of from.routingTable) {
          if (rt.network === '0.0.0.0') continue;
          const candidateMetric = rt.metric + linkCost;
          if (proto === 'rip' && candidateMetric >= 16) continue;
          const asPath =
            proto === 'bgp' && to.asn && from.asn && to.asn !== from.asn
              ? [to.asn, ...(rt.asPath ?? [from.asn])]
              : rt.asPath;
          if (proto === 'bgp' && to.asn && rt.asPath?.includes(to.asn)) continue; // BGP loop prevention

          const existing = to.routingTable.find((x) => x.network === rt.network && x.mask === rt.mask);
          if (!existing) {
            to.routingTable.push({
              network: rt.network,
              mask: rt.mask,
              nextHop: nextHopIp,
              iface: outIfaceId,
              metric: candidateMetric,
              protocol: proto === 'none' ? 'ospf' : proto,
              asPath,
            });
          } else if (existing.protocol !== 'connected' && existing.protocol !== 'static' && candidateMetric < existing.metric) {
            existing.nextHop = nextHopIp;
            existing.iface = outIfaceId;
            existing.metric = candidateMetric;
            existing.asPath = asPath;
          }
        }
      };

      share(a, b, aIface.ip, bIface.id);
      share(b, a, bIface.ip, aIface.id);
    }
  }
}
