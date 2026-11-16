import { describe, expect, it } from 'vitest';
import { onesComplementChecksum } from '../../lib/checksum';
import { COMPARE_PAIRS, fuzzySearchProtocols, getProtocolById, PROTOCOLS } from '../../protocols';

describe('Protocols Deep Integration (All 39 Protocols & What-If Scenarios)', () => {
  it('verifies all 39 protocols have valid metadata, RFC links, steps, quizzes, and packet wire integrity', () => {
    expect(PROTOCOLS.length).toBe(39);

    for (const proto of PROTOCOLS) {
      expect(getProtocolById(proto.id).id).toBe(proto.id);
      expect(proto.nodes.length).toBeGreaterThanOrEqual(2);
      expect(proto.steps.length).toBeGreaterThan(0);
      expect(proto.quiz.length).toBeGreaterThan(0);

      for (const q of proto.quiz) {
        expect(q.options.length).toBeGreaterThanOrEqual(2);
        expect(q.correctIndex).toBeGreaterThanOrEqual(0);
        expect(q.correctIndex).toBeLessThan(q.options.length);
      }

      // Default scenario + every What-If scenario toggle
      const optionSets: Array<Record<string, boolean>> = [
        {},
        ...proto.whatIfOptions.map((w) => ({ [w.id]: true })),
      ];

      for (const opts of optionSets) {
        const res = proto.scenario({ seed: 42, ...opts });
        expect(res.packets.length).toBeGreaterThan(0);
        expect(res.nodes.length).toBeGreaterThanOrEqual(2);
        expect(res.steps.length).toBeGreaterThan(0);

        for (const pkt of res.packets) {
          expect(pkt.rawBytes.length).toBeGreaterThanOrEqual(60);
          expect(pkt.sizeBytes).toBeGreaterThan(0);
          if (pkt.stepIndex !== undefined) {
            expect(pkt.stepIndex).toBeGreaterThanOrEqual(0);
            expect(pkt.stepIndex).toBeLessThan(res.steps.length);
          }

          for (const range of pkt.fieldRanges) {
            expect(range.startByte).toBeGreaterThanOrEqual(0);
            expect(range.endByte).toBeGreaterThanOrEqual(range.startByte);
            expect(range.endByte).toBeLessThan(pkt.rawBytes.length);
          }

          // Verify embedded IPv4 header checksums verify to zero
          if (pkt.layers.ipv4) {
            const ethHeaderBytes = pkt.layers.ethernet.vlanId !== undefined ? 18 : 14;
            const ipHdr = pkt.rawBytes.slice(ethHeaderBytes, ethHeaderBytes + 20);
            expect(onesComplementChecksum(ipHdr)).toBe(0);
          }
        }
      }
    }
  });

  it('verifies fuzzySearchProtocols ranking and COMPARE_PAIRS integrity', () => {
    const httpHits = fuzzySearchProtocols('http');
    expect(httpHits[0].protocol.id).toBe('http');

    const portHits = fuzzySearchProtocols('443');
    expect(portHits.some((h) => h.protocol.id === 'https')).toBe(true);

    const subseqHits = fuzzySearchProtocols('wgrd');
    expect(subseqHits.some((h) => h.protocol.id === 'wireguard')).toBe(true);

    expect(COMPARE_PAIRS.length).toBeGreaterThanOrEqual(5);
    for (const pair of COMPARE_PAIRS) {
      expect(getProtocolById(pair.leftId).id).toBe(pair.leftId);
      expect(getProtocolById(pair.rightId).id).toBe(pair.rightId);
      expect(pair.highlights.length).toBeGreaterThan(0);
    }
  });
});
