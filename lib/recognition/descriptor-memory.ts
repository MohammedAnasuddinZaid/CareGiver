import { recognitionConfig } from "./config";
import { isFiniteVector } from "./metrics";
import { DESCRIPTOR_LENGTH } from "./config";

/**
 * Per-track temporal descriptor memory.
 *
 * A single frame's 128-D descriptor carries angular noise from lighting,
 * pose and sensor jitter — borderline true matches land near the decision
 * threshold and get rejected. Averaging descriptors across frames of the
 * SAME tracked face reduces that noise roughly by √N (correlated components
 * average slower, so gains are conservative but real): distances for true
 * matches fall decisively below threshold while impostor distances stay
 * near √2. This is the cheapest possible accuracy upgrade — it reuses
 * computation already paid for.
 *
 * The blend is exponential (EMA) with the newest frame weighted at
 * DESCRIPTOR_EMA_ALPHA: convergence in ~4 frames at 4 fps ≈ 0.5 s, which
 * pairs with the stabilizer's two-frame lock for sub-second recognition.
 */

export const DESCRIPTOR_EMA_ALPHA = 0.45;

interface MemoryEntry {
  d: number[];
  n: number;
  last: number;
}

export class DescriptorMemory {
  private entries = new Map<string, MemoryEntry>();
  /** Stale entries are dropped after this long without updates. */
  private static readonly TTL_MS = 2000;

  reset(): void {
    this.entries.clear();
  }

  /**
   * Feeds one raw descriptor for `key` (a tracker id) and returns the
   * smoothed descriptor to match against. Invalid vectors are ignored
   * (returns null) so a corrupt frame can never poison the average.
   */
  update(key: string, descriptor: number[], now: number): number[] | null {
    if (!isFiniteVector(descriptor, DESCRIPTOR_LENGTH)) return null;
    const existing = this.entries.get(key);
    if (!existing || now - existing.last > DescriptorMemory.TTL_MS) {
      const copy = descriptor.slice();
      this.entries.set(key, { d: copy, n: 1, last: now });
      return copy;
    }
    const target = existing.d;
    for (let i = 0; i < target.length; i++) {
      target[i] += DESCRIPTOR_EMA_ALPHA * (descriptor[i] - target[i]);
    }
    existing.n += 1;
    existing.last = now;
    return target;
  }

  /** Drops memories for tracks that no longer exist (keeps the map tiny). */
  retain(activeKeys: Iterable<string>): void {
    const keep = new Set(activeKeys);
    for (const key of [...this.entries.keys()]) {
      if (!keep.has(key)) this.entries.delete(key);
    }
  }

  /** Number of frames blended into a key's average (diagnostics). */
  framesFor(key: string): number {
    return this.entries.get(key)?.n ?? 0;
  }
}

/** Fixed-point sanity helper exported for tests. */
export function steadyStateWeight(confidence: number, cycleMs: number, tauMs: number): number {
  const k = Math.exp(-cycleMs / tauMs);
  return confidence / (1 - k);
}
