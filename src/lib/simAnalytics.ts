import type { CapturedPacket, PacketColorCategory, SimDevice, SimLink } from '../engine/types';

export interface ThroughputBucket {
  index: number;
  label: string;
  startMs: number;
  endMs: number;
  throughputKbps: number;
  goodputKbps: number;
  packetCount: number;
  droppedCount: number;
  bytes: number;
}

export interface ProtocolMixItem {
  protocol: string;
  colorCategory: PacketColorCategory;
  count: number;
  bytes: number;
  percent: number;
  bytePercent: number;
}

export interface LinkUtilizationItem {
  linkId: string;
  label: string;
  medium: SimLink['medium'];
  bandwidthMbps: number;
  up: boolean;
  bytes: number;
  packets: number;
  utilizationPercent: number;
}

export interface SimulationAnalytics {
  sentCount: number;
  deliveredCount: number;
  droppedCount: number;
  dropRatePercent: number;
  retransmissions: number;
  totalBytes: number;
  minLatencyMs: number;
  maxLatencyMs: number;
  avgLatencyMs: number;
  jitterMs: number;
  throughputKbps: number;
  goodputKbps: number;
  elapsedMs: number;
  buckets: ThroughputBucket[];
  protocolStats: ProtocolMixItem[];
  linkStats: LinkUtilizationItem[];
  cwndSeries: Array<{ timeMs: number; cwnd: number; ssthresh: number }>;
}

/**
 * Aggregates live throughput time-series buckets, protocol distribution, latency,
 * and per-link utilization strictly from the currently visible packets (up to active cursor).
 */
export function computeSimulationAnalytics(
  packets: CapturedPacket[],
  links: SimLink[],
  devices: SimDevice[],
  cwndSeries: Array<{ timeMs: number; cwnd: number; ssthresh: number }> = [],
  requestedBuckets = 10
): SimulationAnalytics {
  const devMap = new Map(devices.map((d) => [d.id, d]));

  if (packets.length === 0) {
    return {
      sentCount: 0,
      deliveredCount: 0,
      droppedCount: 0,
      dropRatePercent: 0,
      retransmissions: 0,
      totalBytes: 0,
      minLatencyMs: 0,
      maxLatencyMs: 0,
      avgLatencyMs: 0,
      jitterMs: 0,
      throughputKbps: 0,
      goodputKbps: 0,
      elapsedMs: 0,
      buckets: [],
      protocolStats: [],
      linkStats: links.map((l) => {
        const a = devMap.get(l.sourceId)?.name || l.sourceId;
        const b = devMap.get(l.targetId)?.name || l.targetId;
        return {
          linkId: l.id,
          label: `${a}:${l.sourceIface} ↔ ${b}:${l.targetIface}`,
          medium: l.medium,
          bandwidthMbps: l.bandwidthMbps,
          up: l.up,
          bytes: 0,
          packets: 0,
          utilizationPercent: 0,
        };
      }),
      cwndSeries,
    };
  }

  let deliveredCount = 0;
  let droppedCount = 0;
  let retransmissions = 0;
  let totalBytes = 0;
  let deliveredBytes = 0;
  const latencies: number[] = [];

  let minTs = Number.POSITIVE_INFINITY;
  let maxTs = 0;

  const protoMap = new Map<
    string,
    { protocol: string; colorCategory: PacketColorCategory; count: number; bytes: number }
  >();
  const linkByteMap = new Map<string, { bytes: number; packets: number }>();

  for (const pkt of packets) {
    totalBytes += pkt.sizeBytes;
    if (pkt.dropped) {
      droppedCount++;
    } else {
      deliveredCount++;
      deliveredBytes += pkt.sizeBytes;
      const lat = Math.max(0.1, pkt.arrivalMs - pkt.timestampMs);
      latencies.push(lat);
    }
    if (pkt.retransmitted || pkt.info.includes('Retransmission')) {
      retransmissions++;
    }

    if (pkt.timestampMs < minTs) minTs = pkt.timestampMs;
    const endPoint = Math.max(pkt.timestampMs, pkt.arrivalMs);
    if (endPoint > maxTs) maxTs = endPoint;

    const protoKey = pkt.protocol.toUpperCase();
    const existingProto = protoMap.get(protoKey);
    if (existingProto) {
      existingProto.count += 1;
      existingProto.bytes += pkt.sizeBytes;
    } else {
      protoMap.set(protoKey, {
        protocol: pkt.protocol,
        colorCategory: pkt.colorCategory,
        count: 1,
        bytes: pkt.sizeBytes,
      });
    }

    const matchedLinkId =
      pkt.linkId ??
      links.find(
        (l) =>
          (l.sourceId === pkt.fromDeviceId && l.targetId === pkt.toDeviceId) ||
          (l.sourceId === pkt.toDeviceId && l.targetId === pkt.fromDeviceId)
      )?.id;
    if (matchedLinkId) {
      const prev = linkByteMap.get(matchedLinkId) ?? { bytes: 0, packets: 0 };
      prev.bytes += pkt.sizeBytes;
      prev.packets += 1;
      linkByteMap.set(matchedLinkId, prev);
    }
  }

  const sentCount = packets.length;
  const dropRatePercent = Number(((droppedCount / Math.max(1, sentCount)) * 100).toFixed(1));

  const minLatencyMs = latencies.length ? Number(Math.min(...latencies).toFixed(2)) : 0;
  const maxLatencyMs = latencies.length ? Number(Math.max(...latencies).toFixed(2)) : 0;
  const avgLatencyMs = latencies.length
    ? Number((latencies.reduce((a, b) => a + b, 0) / latencies.length).toFixed(2))
    : 0;
  const jitterMs =
    latencies.length > 1
      ? Number(
          (
            latencies.slice(1).reduce((acc, v, i) => acc + Math.abs(v - latencies[i]), 0) /
            (latencies.length - 1)
          ).toFixed(2)
        )
      : 0;

  const rawElapsedMs = Math.max(0, maxTs - (Number.isFinite(minTs) ? minTs : 0));
  const elapsedMs = Number(Math.max(20, rawElapsedMs).toFixed(2));
  const elapsedSec = elapsedMs / 1000;

  const throughputKbps = Number((((totalBytes * 8) / 1000) / elapsedSec).toFixed(1));
  const goodputKbps = Number((((deliveredBytes * 8) / 1000) / elapsedSec).toFixed(1));

  // Build evenly spaced time buckets across [minTs, minTs + elapsedMs]
  const startOrigin = Number.isFinite(minTs) ? minTs : 0;
  const bucketCount = Math.max(4, Math.min(requestedBuckets, Math.max(4, packets.length)));
  const bucketSpanMs = Math.max(5, elapsedMs / bucketCount);

  const buckets: ThroughputBucket[] = Array.from({ length: bucketCount }, (_, idx) => {
    const bStart = startOrigin + idx * bucketSpanMs;
    const bEnd = bStart + bucketSpanMs;
    return {
      index: idx,
      label: `${Math.round(bEnd)}ms`,
      startMs: Number(bStart.toFixed(1)),
      endMs: Number(bEnd.toFixed(1)),
      throughputKbps: 0,
      goodputKbps: 0,
      packetCount: 0,
      droppedCount: 0,
      bytes: 0,
    };
  });

  const bucketGoodBytes = new Array<number>(bucketCount).fill(0);
  for (const pkt of packets) {
    const sampleTs = (pkt.timestampMs + pkt.arrivalMs) / 2;
    const rawIdx = Math.floor((sampleTs - startOrigin) / bucketSpanMs);
    const bIdx = Math.max(0, Math.min(bucketCount - 1, rawIdx));
    const bucket = buckets[bIdx];
    bucket.packetCount += 1;
    bucket.bytes += pkt.sizeBytes;
    if (pkt.dropped) {
      bucket.droppedCount += 1;
    } else {
      bucketGoodBytes[bIdx] += pkt.sizeBytes;
    }
  }

  const bucketSec = bucketSpanMs / 1000;
  for (let i = 0; i < buckets.length; i++) {
    const b = buckets[i];
    b.throughputKbps = Number((((b.bytes * 8) / 1000) / bucketSec).toFixed(1));
    b.goodputKbps = Number((((bucketGoodBytes[i] * 8) / 1000) / bucketSec).toFixed(1));
  }

  const protocolStats: ProtocolMixItem[] = Array.from(protoMap.values())
    .sort((a, b) => b.count - a.count || b.bytes - a.bytes)
    .map((p) => ({
      protocol: p.protocol,
      colorCategory: p.colorCategory,
      count: p.count,
      bytes: p.bytes,
      percent: Number(((p.count / sentCount) * 100).toFixed(1)),
      bytePercent: Number(((p.bytes / Math.max(1, totalBytes)) * 100).toFixed(1)),
    }));

  const linkStats: LinkUtilizationItem[] = links.map((l) => {
    const a = devMap.get(l.sourceId)?.name || l.sourceId;
    const b = devMap.get(l.targetId)?.name || l.targetId;
    const usage = linkByteMap.get(l.id) ?? { bytes: 0, packets: 0 };
    const capBytes = ((Math.max(0.1, l.bandwidthMbps) * 1_000_000) / 8) * elapsedSec;
    const utilizationPercent = Math.min(100, Number(((usage.bytes / Math.max(1, capBytes)) * 100).toFixed(1)));
    return {
      linkId: l.id,
      label: `${a}:${l.sourceIface} ↔ ${b}:${l.targetIface}`,
      medium: l.medium,
      bandwidthMbps: l.bandwidthMbps,
      up: l.up,
      bytes: usage.bytes,
      packets: usage.packets,
      utilizationPercent,
    };
  });

  return {
    sentCount,
    deliveredCount,
    droppedCount,
    dropRatePercent,
    retransmissions,
    totalBytes,
    minLatencyMs,
    maxLatencyMs,
    avgLatencyMs,
    jitterMs,
    throughputKbps,
    goodputKbps,
    elapsedMs,
    buckets,
    protocolStats,
    linkStats,
    cwndSeries,
  };
}
