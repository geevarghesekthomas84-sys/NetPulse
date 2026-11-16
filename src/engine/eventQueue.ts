import type { SimEvent } from './types';

/**
 * Binary min-heap priority queue ordered by (timeMs, seq).
 */
export class EventQueue {
  private heap: SimEvent[] = [];

  get size(): number {
    return this.heap.length;
  }

  clear(): void {
    this.heap = [];
  }

  push(event: SimEvent): void {
    this.heap.push(event);
    this.bubbleUp(this.heap.length - 1);
  }

  pop(): SimEvent | undefined {
    if (this.heap.length === 0) return undefined;
    const min = this.heap[0];
    const last = this.heap.pop()!;
    if (this.heap.length > 0) {
      this.heap[0] = last;
      this.sinkDown(0);
    }
    return min;
  }

  peek(): SimEvent | undefined {
    return this.heap[0];
  }

  toArray(): SimEvent[] {
    return [...this.heap].sort((a, b) => (a.timeMs !== b.timeMs ? a.timeMs - b.timeMs : a.seq - b.seq));
  }

  private compare(a: SimEvent, b: SimEvent): number {
    if (a.timeMs !== b.timeMs) return a.timeMs - b.timeMs;
    return a.seq - b.seq;
  }

  private bubbleUp(idx: number): void {
    while (idx > 0) {
      const parent = Math.floor((idx - 1) / 2);
      if (this.compare(this.heap[idx], this.heap[parent]) >= 0) break;
      [this.heap[idx], this.heap[parent]] = [this.heap[parent], this.heap[idx]];
      idx = parent;
    }
  }

  private sinkDown(idx: number): void {
    const len = this.heap.length;
    while (true) {
      const left = 2 * idx + 1;
      const right = 2 * idx + 2;
      let smallest = idx;
      if (left < len && this.compare(this.heap[left], this.heap[smallest]) < 0) {
        smallest = left;
      }
      if (right < len && this.compare(this.heap[right], this.heap[smallest]) < 0) {
        smallest = right;
      }
      if (smallest === idx) break;
      [this.heap[idx], this.heap[smallest]] = [this.heap[smallest], this.heap[idx]];
      idx = smallest;
    }
  }
}
