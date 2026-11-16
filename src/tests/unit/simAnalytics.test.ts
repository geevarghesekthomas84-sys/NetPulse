import { describe, expect, it } from 'vitest';
import { SimulationEngine } from '../../engine/simulator';
import { computeSimulationAnalytics } from '../../lib/simAnalytics';
import { PRESET_LABS } from '../../simulator/labs';
import { STARTER_TEMPLATES } from '../../simulator/templates';

describe('Live Simulation Analytics, Multi-Hop Flow Tracking & Starter Templates', () => {
  it('computes zeroed analytics safely when no packets have been emitted yet', () => {
    const lab = PRESET_LABS[0];
    const analytics = computeSimulationAnalytics([], lab.links, lab.devices);

    expect(analytics.sentCount).toBe(0);
    expect(analytics.deliveredCount).toBe(0);
    expect(analytics.droppedCount).toBe(0);
    expect(analytics.throughputKbps).toBe(0);
    expect(analytics.goodputKbps).toBe(0);
    expect(analytics.buckets).toEqual([]);
    expect(analytics.protocolStats).toEqual([]);
    expect(analytics.linkStats.length).toBe(lab.links.length);
    expect(analytics.linkStats.every((l) => l.utilizationPercent === 0)).toBe(true);
  });

  it('tracks progressive cursor-synced throughput, protocol distribution, and drops across slices', () => {
    const lab = PRESET_LABS[0];
    const eng = new SimulationEngine({ seed: 42, devices: lab.devices, links: lab.links });
    eng.execCommand('pc', 'curl http://203.0.113.10');
    expect(eng.packets.length).toBeGreaterThan(4);

    // Slice after 2 packets vs full capture
    const partial = computeSimulationAnalytics(eng.packets.slice(0, 2), lab.links, lab.devices);
    const full = computeSimulationAnalytics(eng.packets, lab.links, lab.devices);

    expect(partial.sentCount).toBe(2);
    expect(full.sentCount).toBe(eng.packets.length);
    expect(full.totalBytes).toBeGreaterThan(partial.totalBytes);
    expect(full.buckets.length).toBeGreaterThanOrEqual(4);
    expect(full.protocolStats.reduce((acc, p) => acc + p.count, 0)).toBe(full.sentCount);

    // Inject a dropped packet and confirm goodput < throughput + non-zero drop rate
    const withDrop = [
      ...eng.packets.slice(0, 3),
      { ...eng.packets[3], id: 'pkt-drop-test', dropped: true, dropReason: 'Firewall ACL' },
    ];
    const dropStats = computeSimulationAnalytics(withDrop, lab.links, lab.devices);
    expect(dropStats.droppedCount).toBe(1);
    expect(dropStats.dropRatePercent).toBe(25);
    expect(dropStats.goodputKbps).toBeLessThan(dropStats.throughputKbps);
  });

  it('populates full end-to-end flowPathNodeIds and flowLinkIds on multi-hop packets', () => {
    const lab = PRESET_LABS[0];
    const eng = new SimulationEngine({ seed: 7, devices: lab.devices, links: lab.links });
    eng.execCommand('pc', 'ping 203.0.113.10 -c 1');

    const icmpPkt = eng.packets.find((p) => p.protocol === 'ICMP');
    expect(icmpPkt).toBeDefined();
    expect(icmpPkt?.flowPathNodeIds).toEqual(['pc', 'homerouter', 'isp', 'web']);
    expect(icmpPkt?.flowLinkIds).toEqual(['l1', 'l2', 'l3']);
  });

  it('validates all 5 starter templates with zero topology warnings and runnable multi-hop probes', () => {
    expect(STARTER_TEMPLATES.length).toBe(5);
    for (const tpl of STARTER_TEMPLATES) {
      const eng = new SimulationEngine({ seed: 42, devices: tpl.devices, links: tpl.links });
      const warnings = eng.validateTopology();
      expect(warnings, `Template ${tpl.id} produced warnings: ${JSON.stringify(warnings)}`).toEqual([]);

      if (tpl.probe) {
        const out = eng.execCommand(tpl.probe.deviceId, tpl.probe.command);
        expect(out.length).toBeGreaterThan(0);
        expect(eng.packets.length).toBeGreaterThan(0);
        const multiHop = eng.packets.find((p) => (p.flowLinkIds?.length ?? 0) >= 2);
        expect(multiHop, `Template ${tpl.id} expected multi-hop flow packet`).toBeDefined();
      }
    }
  });
});
