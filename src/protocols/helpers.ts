import { createDefaultInterface, SimulationEngine } from '../engine/simulator';
import type { SimDevice, SimLink } from '../engine/types';
import type {
  PacketTemplate,
  ProtocolLinkDef,
  ProtocolNodeDef,
  ProtocolStepDef,
  ScenarioOptions,
  ScenarioResult,
} from './types';

export function buildEngineFromNodes(
  nodes: ProtocolNodeDef[],
  links: ProtocolLinkDef[],
  opts: ScenarioOptions = {}
): SimulationEngine {
  const devices: SimDevice[] = nodes.map((n, idx) => {
    const macSuffix = (idx + 10).toString(16).padStart(2, '0');
    const isIpv6 = n.ip.includes(':');
    const iface = createDefaultInterface('eth0', 'eth0', isIpv6 ? '192.168.1.10' : n.ip, '255.255.255.0', undefined, macSuffix);
    if (isIpv6) iface.ipv6 = n.ip;
    return {
      id: n.id,
      name: n.label,
      role: n.role,
      x: n.x,
      y: n.y,
      poweredOn: !(opts.serverDown && idx === nodes.length - 1),
      interfaces: [iface],
      routingTable: [],
      arpCache: [],
      macTable: [],
      natTable: [],
      firewallRules: [],
      asn: n.asn,
      services: {},
      openPorts: n.openPorts ?? [80, 443],
      cpuLoad: 8,
    };
  });

  const simLinks: SimLink[] = links.map((l) => ({
    id: l.id,
    sourceId: l.sourceId,
    sourceIface: 'eth0',
    targetId: l.targetId,
    targetIface: 'eth0',
    medium: 'ethernet',
    bandwidthMbps: l.bandwidthMbps ?? 100,
    delayMs: l.delayMs ?? 12,
    jitterMs: 0,
    lossPercent: 0,
    mtu: opts.smallMtu ? 576 : l.mtu ?? 1500,
    duplex: 'full',
    up: true,
  }));

  return new SimulationEngine({
    seed: opts.seed ?? 42,
    devices,
    links: simLinks,
  });
}

export function runPacketTemplates(
  nodes: ProtocolNodeDef[],
  links: ProtocolLinkDef[],
  steps: ProtocolStepDef[],
  templates: PacketTemplate[],
  opts: ScenarioOptions = {}
): ScenarioResult {
  const engine = buildEngineFromNodes(nodes, links, opts);
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  let simClock = 0;
  let handledLoss = false;

  for (let i = 0; i < templates.length; i++) {
    const tpl = templates[i];
    const fromNode = nodeMap.get(tpl.fromId);
    const toNode = nodeMap.get(tpl.toId);
    if (!fromNode || !toNode) continue;

    // Handle "What if?" Server Down
    if (opts.serverDown && tpl.toId === nodes[nodes.length - 1].id) {
      engine.enqueueDirectPacket({
        fromId: tpl.fromId,
        toId: tpl.toId,
        startTimeMs: simClock,
        protocol: tpl.protocol,
        colorCategory: 'error',
        info: `${tpl.info} [TIMEOUT: Server unreachable]`,
        osiLayer: tpl.osiLayer,
        stepIndex: tpl.stepIndex,
        forceDrop: true,
        dropReason: 'Destination Host Down / Unreachable',
        ipv4: {
          version: 4,
          ihl: 5,
          tos: 0,
          identification: 0x2000 + i,
          flags: { df: true, mf: false },
          fragmentOffset: 0,
          ttl: 64,
          protocol: tpl.isUdp ? 17 : 6,
          srcIp: fromNode.ip,
          dstIp: toNode.ip,
        },
        tcp: tpl.tcpFlags
          ? {
              srcPort: tpl.srcPort ?? 52344,
              dstPort: tpl.dstPort ?? 80,
              seq: tpl.seq ?? 0,
              ack: tpl.ack ?? 0,
              dataOffset: 5,
              flags: {
                urg: Boolean(tpl.tcpFlags.urg),
                ack: Boolean(tpl.tcpFlags.ack),
                psh: Boolean(tpl.tcpFlags.psh),
                rst: Boolean(tpl.tcpFlags.rst),
                syn: Boolean(tpl.tcpFlags.syn),
                fin: Boolean(tpl.tcpFlags.fin),
              },
              window: 65535,
              urgentPointer: 0,
            }
          : undefined,
      });
      break;
    }

    // Handle "What if?" Port Closed -> RST
    if (opts.portClosed && tpl.tcpFlags?.syn && !tpl.tcpFlags.ack) {
      engine.enqueueDirectPacket({
        fromId: tpl.fromId,
        toId: tpl.toId,
        startTimeMs: simClock,
        protocol: 'TCP',
        colorCategory: 'tcp',
        info: `${tpl.srcPort ?? 52344} -> ${tpl.dstPort ?? 80} [SYN] Seq=0`,
        osiLayer: 4,
        stepIndex: tpl.stepIndex,
        ipv4: {
          version: 4, ihl: 5, tos: 0, identification: 0x3001, flags: { df: true, mf: false }, fragmentOffset: 0, ttl: 64, protocol: 6, srcIp: fromNode.ip, dstIp: toNode.ip,
        },
        tcp: {
          srcPort: tpl.srcPort ?? 52344, dstPort: tpl.dstPort ?? 80, seq: 0, ack: 0, dataOffset: 5,
          flags: { urg: false, ack: false, psh: false, rst: false, syn: true, fin: false }, window: 65535, urgentPointer: 0,
        },
      });
      simClock += 15;
      engine.enqueueDirectPacket({
        fromId: tpl.toId,
        toId: tpl.fromId,
        startTimeMs: simClock,
        protocol: 'TCP',
        colorCategory: 'error',
        info: `${tpl.dstPort ?? 80} -> ${tpl.srcPort ?? 52344} [RST, ACK] Seq=0 Ack=1 (Port Closed)`,
        osiLayer: 4,
        stepIndex: tpl.stepIndex,
        ipv4: {
          version: 4, ihl: 5, tos: 0, identification: 0x3002, flags: { df: true, mf: false }, fragmentOffset: 0, ttl: 64, protocol: 6, srcIp: toNode.ip, dstIp: fromNode.ip,
        },
        tcp: {
          srcPort: tpl.dstPort ?? 80, dstPort: tpl.srcPort ?? 52344, seq: 0, ack: 1, dataOffset: 5,
          flags: { urg: false, ack: true, psh: false, rst: true, syn: false, fin: false }, window: 0, urgentPointer: 0,
        },
      });
      break;
    }

    // Handle "What if?" TTL Expired
    if (opts.ttlExpired && i === 1) {
      engine.enqueueDirectPacket({
        fromId: tpl.fromId,
        toId: tpl.toId,
        startTimeMs: simClock,
        protocol: tpl.protocol,
        colorCategory: tpl.colorCategory,
        info: `${tpl.info} (TTL=1 -> expired at hop)`,
        osiLayer: 3,
        stepIndex: tpl.stepIndex,
        ipv4: {
          version: 4, ihl: 5, tos: 0, identification: 0x4100, flags: { df: false, mf: false }, fragmentOffset: 0, ttl: 1, protocol: 1, srcIp: fromNode.ip, dstIp: toNode.ip,
        },
      });
      simClock += 14;
      engine.enqueueDirectPacket({
        fromId: tpl.toId,
        toId: tpl.fromId,
        startTimeMs: simClock,
        protocol: 'ICMP',
        colorCategory: 'error',
        info: `Time-to-live exceeded (Type 11, Code 0)`,
        osiLayer: 3,
        stepIndex: tpl.stepIndex,
        ipv4: {
          version: 4, ihl: 5, tos: 0, identification: 0x4101, flags: { df: false, mf: false }, fragmentOffset: 0, ttl: 64, protocol: 1, srcIp: toNode.ip, dstIp: fromNode.ip,
        },
        icmp: { type: 11, code: 0, identifier: 1, sequence: 1, message: 'TTL expired in transit' },
      });
      break;
    }

    // Handle "What if?" Packet Loss on a key data/SYN packet -> drop + retransmit
    if (opts.packetLoss && !handledLoss && i === Math.min(2, templates.length - 1)) {
      handledLoss = true;
      engine.enqueueDirectPacket({
        fromId: tpl.fromId,
        toId: tpl.toId,
        startTimeMs: simClock,
        protocol: tpl.protocol,
        colorCategory: 'error',
        info: `${tpl.info} [PACKET LOST]`,
        osiLayer: tpl.osiLayer,
        stepIndex: tpl.stepIndex,
        forceDrop: true,
        dropReason: 'Simulated link packet loss',
        payloadSizeOverride: tpl.sizeBytes,
        ipv4: !tpl.isArp && !tpl.isIpv6
          ? {
              version: 4, ihl: 5, tos: 0, identification: 0x5000 + i, flags: { df: true, mf: false }, fragmentOffset: 0, ttl: tpl.ttl ?? 64,
              protocol: tpl.isIcmp ? 1 : tpl.isUdp ? 17 : 6, srcIp: fromNode.ip, dstIp: toNode.ip,
            }
          : undefined,
      });
      simClock += 45; // RTO timer wait before retransmit
    }

    const isIpv6 = Boolean(tpl.isIpv6 || fromNode.ip.includes(':') || toNode.ip.includes(':'));
    const l4Proto = tpl.isIcmp ? 1 : tpl.isUdp || tpl.dns ? 17 : 6;

    const emitted = engine.enqueueDirectPacket({
      fromId: tpl.fromId,
      toId: tpl.toId,
      startTimeMs: simClock,
      protocol: tpl.protocol,
      colorCategory: handledLoss && i === Math.min(2, templates.length - 1) ? 'error' : tpl.colorCategory,
      info: handledLoss && i === Math.min(2, templates.length - 1) ? `[Retransmission] ${tpl.info}` : tpl.info,
      osiLayer: tpl.osiLayer,
      stepIndex: tpl.stepIndex,
      note: tpl.note,
      etherType: tpl.etherType,
      vlanId: tpl.vlanId,
      retransmitted: tpl.retransmitted || (handledLoss && i === Math.min(2, templates.length - 1)),
      forceDrop: tpl.forceDrop,
      dropReason: tpl.dropReason,
      payloadSizeOverride: tpl.sizeBytes,
      arp: tpl.isArp
        ? {
            opcode: tpl.isArp.opcode,
            senderMac: fromNode.mac ?? '02:42:ac:11:00:0a',
            senderIp: fromNode.ip,
            targetMac: tpl.isArp.opcode === 1 ? '00:00:00:00:00:00' : toNode.mac ?? '02:42:ac:11:00:0b',
            targetIp: tpl.isArp.targetIp,
          }
        : undefined,
      ipv4:
        !tpl.isArp && !isIpv6
          ? {
              version: 4,
              ihl: 5,
              tos: 0,
              identification: 0x1000 + i,
              flags: { df: !opts.smallMtu, mf: false },
              fragmentOffset: 0,
              ttl: tpl.ttl ?? 64,
              protocol: l4Proto,
              srcIp: fromNode.ip,
              dstIp: toNode.ip,
            }
          : undefined,
      ipv6:
        !tpl.isArp && isIpv6
          ? {
              version: 6,
              trafficClass: 0,
              flowLabel: 0x12345,
              nextHeader: l4Proto,
              hopLimit: tpl.ttl ?? 64,
              srcIp: fromNode.ip,
              dstIp: toNode.ip,
            }
          : undefined,
      icmp: tpl.isIcmp
        ? {
            type: tpl.isIcmp.type,
            code: tpl.isIcmp.code,
            identifier: 0x0401,
            sequence: i + 1,
            message: tpl.isIcmp.message,
          }
        : undefined,
      tcp:
        !tpl.isArp && !tpl.isIcmp && !tpl.isUdp && !tpl.dns
          ? {
              srcPort: tpl.srcPort ?? 52344,
              dstPort: tpl.dstPort ?? 80,
              seq: tpl.seq ?? 1,
              ack: tpl.ack ?? 1,
              dataOffset: tpl.tcpFlags?.syn ? 6 : 5,
              flags: {
                urg: Boolean(tpl.tcpFlags?.urg),
                ack: Boolean(tpl.tcpFlags?.ack),
                psh: Boolean(tpl.tcpFlags?.psh),
                rst: Boolean(tpl.tcpFlags?.rst),
                syn: Boolean(tpl.tcpFlags?.syn),
                fin: Boolean(tpl.tcpFlags?.fin),
              },
              window: 65535,
              urgentPointer: 0,
              mss: tpl.tcpFlags?.syn ? (opts.smallMtu ? 536 : 1460) : undefined,
            }
          : undefined,
      udp:
        tpl.isUdp || tpl.dns
          ? {
              srcPort: tpl.srcPort ?? 53120,
              dstPort: tpl.dstPort ?? 53,
            }
          : undefined,
      tls: tpl.tls,
      dns: tpl.dns
        ? {
            transactionId: tpl.dns.transactionId,
            isResponse: tpl.dns.isResponse,
            opcode: tpl.dns.isResponse ? 'Standard query response' : 'Standard query',
            flags: tpl.dns.isResponse ? ['QR', 'RD', 'RA'] : ['RD'],
            questions: tpl.dns.questions,
            answers: tpl.dns.answers,
          }
        : undefined,
      app: tpl.app,
    });

    simClock = emitted.arrivalMs + (tpl.delayAfterMs ?? 6);
  }

  engine.runAll();
  return {
    packets: engine.packets,
    steps,
    nodes,
    links,
  };
}
