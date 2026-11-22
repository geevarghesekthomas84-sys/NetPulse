import { describe, expect, it } from 'vitest';
import { SimulationEngine } from '../../engine/simulator';
import { CHALLENGES, computeScore, starsForScore } from '../../simulator/challenges';

describe('Break-it challenges', () => {
  it.each(CHALLENGES.map((c) => [c.id, c] as const))('%s: fails when broken, passes when fixed', (_id, ch) => {
    const run = (fixed: boolean) => {
      const topo = ch.build(fixed);
      const engine = new SimulationEngine({ seed: 42, devices: topo.devices, links: topo.links });
      return engine.execCommand(ch.test.deviceId, ch.test.cmd);
    };
    expect(run(false)).not.toContain(ch.test.successIncludes);
    expect(run(true)).toContain(ch.test.successIncludes);
  });

  it.each(CHALLENGES.map((c) => [c.id, c] as const))('%s: has exactly one correct option and valid suggestions', (_id, ch) => {
    expect(ch.options.filter((o) => o.correct)).toHaveLength(1);
    expect(ch.options.length).toBe(4);
    const topo = ch.build(false);
    const ids = new Set(topo.devices.map((d) => d.id));
    for (const s of ch.suggested) expect(ids.has(s.deviceId)).toBe(true);
    expect(ids.has(ch.test.deviceId)).toBe(true);
  });

  it('scores with penalties, a floor, and star thresholds', () => {
    expect(computeScore({ tools: 3, wrongGuesses: 0, hints: 0 })).toBe(100);
    expect(computeScore({ tools: 6, wrongGuesses: 1, hints: 1 })).toBe(100 - 6 - 15 - 10);
    expect(computeScore({ tools: 99, wrongGuesses: 9, hints: 2 })).toBe(10);
    expect(starsForScore(95)).toBe(3);
    expect(starsForScore(60)).toBe(2);
    expect(starsForScore(10)).toBe(1);
  });
});
