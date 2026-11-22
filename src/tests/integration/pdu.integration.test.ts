import { describe, expect, it } from 'vitest';
import { PRESET_LABS } from '../../simulator/labs';
import { SimulationEngine } from '../../engine/simulator';

const lab = () => {
  const l = PRESET_LABS[0];
  return new SimulationEngine({ seed: 42, devices: structuredClone(l.devices), links: structuredClone(l.links) });
};

describe('Simple PDU (Packet Tracer style test packet)', () => {
  it('a ping PDU across the home network succeeds and records its packets', () => {
    const e = lab();
    const pdu = e.sendPdu('pc', 'web', 'ICMP')!;
    expect(pdu.status).toBe('Successful');
    expect(pdu.firstPacketNo).toBeGreaterThan(0);
    const events = e.packets.filter((p) => p.no >= pdu.firstPacketNo && p.no <= pdu.lastPacketNo);
    expect(events.length).toBeGreaterThanOrEqual(2);
    expect(events.some((p) => p.info.includes('Echo (ping) request'))).toBe(true);
    expect(events.some((p) => p.info.includes('Echo (ping) reply'))).toBe(true);
    expect(e.pdus).toHaveLength(1);
  });

  it('fails with a reason when the path is broken, and succeeds again once it is repaired', () => {
    const e = lab();
    const wan = e.getDevice('homerouter')!.interfaces[1];
    e.execCommand('homerouter', 'enable');
    e.execCommand('homerouter', 'configure terminal');
    e.execCommand('homerouter', `interface ${wan.name}`);
    e.execCommand('homerouter', 'shutdown');
    const bad = e.sendPdu('pc', 'web', 'ICMP')!;
    expect(bad.status).toBe('Failed');
    expect(bad.reason).toBeTruthy();
    e.execCommand('homerouter', 'no shutdown');
    expect(e.sendPdu('pc', 'web', 'ICMP')!.status).toBe('Successful');
    expect(e.pdus.map((p) => p.status)).toEqual(['Failed', 'Successful']);
  });

  it('TCP PDU needs an open port 80; UDP only needs delivery', () => {
    const e = lab();
    expect(e.sendPdu('pc', 'web', 'TCP')!.status).toBe('Successful');
    expect(e.sendPdu('pc', 'web', 'UDP')!.status).toBe('Successful');
    e.getDevice('pc')!.openPorts = [];
    const refused = e.sendPdu('web', 'pc', 'TCP')!;
    expect(refused.status).toBe('Failed');
    expect(refused.reason).toContain('port 80');
  });

  it('ignores a PDU to itself and clears on reset', () => {
    const e = lab();
    expect(e.sendPdu('pc', 'pc')).toBeNull();
    e.sendPdu('pc', 'web');
    e.reset();
    expect(e.pdus).toHaveLength(0);
  });
});
