/**
 * Deterministic Mulberry32 PRNG for reproducible discrete-event simulations.
 */
export class SeededRNG {
  private state: number;
  public readonly seed: number;

  constructor(seed: number = 42) {
    this.seed = seed >>> 0;
    this.state = this.seed || 1;
  }

  /** Returns float in [0, 1) */
  next(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Returns integer in [min, max] inclusive */
  intRange(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  /** Normal-ish jitter around 0 in [-1, 1] */
  jitterFactor(): number {
    return (this.next() + this.next() - 1);
  }
}
