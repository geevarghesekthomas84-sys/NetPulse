import { describe, expect, it } from 'vitest';
import { SimulationEngine } from '../../engine/simulator';
import { buildPcapFile } from '../../lib/pcapWriter';
import { busiestHosts, MAX_PCAP_PACKETS, parsePcap } from '../../lib/pcapReader';
import { PROTOCOLS } from '../../protocols';
import { PRESET_LABS } from '../../simulator/labs';

const toBuffer = (u: Uint8Array): ArrayBuffer => u.buffer.slice(u.byteOffset, u.byteOffset + u.byteLength) as ArrayBuffer;

describe('PCAP reader', () => {
  it('round-trips every protocol scenario exported by the app', () => {
    for (const proto of PROTOCOLS) {
      const original = proto.scenario({ seed: 42 }).packets;
      const res = parsePcap(toBuffer(buildPcapFile(original)));
      expect(res.ok, proto.id).toBe(true);
      if (!res.ok) continue;
      expect(res.packets.length).toBe(original.length);
      // Wire bytes and the headline fields survive the trip.
      for (let i = 0; i < original.length; i++) {
        expect(res.packets[i].rawBytes).toEqual(original[i].rawBytes);
        // The simulator's own PPPoE frames are synthetic (raw IP under a PPPoE EtherType), so they are skipped here.
        const wireIsPlainIp = !['0x8863', '0x8864'].includes(original[i].layers.ethernet.etherType);
        if (original[i].layers.ipv4 && wireIsPlainIp) {
          expect(res.packets[i].srcIp).toBe(original[i].srcIp);
          expect(res.packets[i].dstIp).toBe(original[i].dstIp);
        }
        if (original[i].layers.tcp && wireIsPlainIp) {
          expect(res.packets[i].layers.tcp?.srcPort).toBe(original[i].layers.tcp?.srcPort);
          expect(res.packets[i].layers.tcp?.flags.syn).toBe(original[i].layers.tcp?.flags.syn);
        }
      }
    }
  });

  it('decodes ICMP echo captured from the simulator', () => {
    const lab = PRESET_LABS[0];
    const engine = new SimulationEngine({ seed: 42, devices: lab.devices, links: lab.links });
    engine.execCommand('pc', 'ping 203.0.113.10 -c 1');
    const res = parsePcap(toBuffer(buildPcapFile(engine.packets)));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.packets.some((p) => p.protocol === 'ICMP' && /Echo request/i.test(p.info))).toBe(true);
    expect(busiestHosts(res.packets).length).toBeGreaterThan(1);
  });

  it('decodes DNS names and answers from the DNS protocol scenario', () => {
    const dns = PROTOCOLS.find((p) => p.id === 'dns')!;
    const res = parsePcap(toBuffer(buildPcapFile(dns.scenario({ seed: 42 }).packets)));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const named = res.packets.filter((p) => p.layers.dns && p.layers.dns.questions.length > 0);
    expect(named.length).toBeGreaterThan(0);
    expect(named.some((p) => /example\.com/.test(p.info))).toBe(true);
  });

  it('reads big-endian and nanosecond files', () => {
    const be = new Uint8Array(24 + 16 + 14);
    const v = new DataView(be.buffer);
    v.setUint32(0, 0xa1b2c3d4, false); // big-endian file
    v.setUint16(4, 2, false);
    v.setUint16(6, 4, false);
    v.setUint32(16, 65535, false);
    v.setUint32(20, 1, false);
    v.setUint32(24, 100, false);
    v.setUint32(28, 500000, false);
    v.setUint32(32, 14, false);
    v.setUint32(36, 14, false);
    be[24 + 16 + 12] = 0x08; // EtherType 0x0800 but no IP body
    const res = parsePcap(be.buffer);
    expect(res.ok).toBe(true);

    const ns = new Uint8Array(be);
    const nv = new DataView(ns.buffer);
    nv.setUint32(0, 0xa1b23c4d, false);
    const r2 = parsePcap(ns.buffer);
    expect(r2.ok).toBe(true);
  });

  it('rejects bad input with specific reasons instead of crashing', () => {
    expect(parsePcap(new ArrayBuffer(5))).toEqual({ ok: false, error: 'too_small' });
    expect(parsePcap(new Uint8Array(40).buffer)).toEqual({ ok: false, error: 'not_pcap' });
    const ng = new Uint8Array(40);
    new DataView(ng.buffer).setUint32(0, 0x0a0d0d0a, true);
    expect(parsePcap(ng.buffer)).toEqual({ ok: false, error: 'pcapng' });
    const hdrOnly = buildPcapFile([]);
    expect(parsePcap(toBuffer(hdrOnly))).toEqual({ ok: false, error: 'empty' });
    const badLink = new Uint8Array(hdrOnly);
    new DataView(badLink.buffer).setUint32(20, 147, true);
    expect(parsePcap(badLink.buffer)).toMatchObject({ ok: false, error: 'link_type', linkType: 147 });
  });

  it('survives truncated and garbage records', () => {
    const tcp = PROTOCOLS.find((p) => p.id === 'tcp')!.scenario({ seed: 42 }).packets;
    const file = buildPcapFile(tcp);
    const cut = parsePcap(toBuffer(file.slice(0, file.length - 7)));
    expect(cut.ok).toBe(true);
    if (cut.ok) expect(cut.truncated).toBe(true);

    // Fuzz: random bytes after a valid header must never throw.
    const rnd = new Uint8Array(24 + 4000);
    rnd.set(file.slice(0, 24));
    for (let i = 24; i < rnd.length; i++) rnd[i] = (i * 2654435761) >>> 24;
    expect(() => parsePcap(rnd.buffer)).not.toThrow();
  });

  it('caps very large captures', () => {
    const one = PROTOCOLS[0].scenario({ seed: 42 }).packets[0];
    const many = Array.from({ length: MAX_PCAP_PACKETS + 50 }, () => one);
    const res = parsePcap(toBuffer(buildPcapFile(many)));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.packets.length).toBe(MAX_PCAP_PACKETS);
    expect(res.totalRecords).toBe(MAX_PCAP_PACKETS + 50);
    expect(res.truncated).toBe(true);
  });
});
