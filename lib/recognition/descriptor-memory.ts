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
  /**
   * Angular-distance threshold (on L2-normalized descriptors) above which
   * the memory is RESET instead of blended.  A value of 0.7 corresponds
   * roughly to cosine similarity 0.51 — well below any legitimate
   * same-person variation (~0.1–0.3) but above typical cross-person
   * distances (~0.7–1.4).  This catches IoU track swaps where the new
   * face is a completely different person.
   */
  private static readonly RESET_THRESHOLD = 0.7;

  reset(): void {
    this.entries.clear();
  }

  /**
   * Feeds one raw descriptor for `key` (a tracker id) and returns the
   * smoothed descriptor to match against. Invalid vectors are ignored
   * (returns null) so a corrupt frame can never poison the average.
   *
   * Track-swap detection: when the angular distance between the current
   * EMA and the new descriptor exceeds `RESET_THRESHOLD`, the track has
   * likely been reassigned to a different physical face (IoU swap when
   * two people cross). Instead of blending — which would create a hybrid
   * descriptor matching NEITHER person — the memory is reset so the new
   * face gets a clean start.
   *
   * The returned `swap` flag lets callers know a physical-head change was
   * just detected on this track, so they can reset the track's own temporal
   * identity gate in the same tick. Without that, the stale gate would keep
   * emitting the OLD identity for several more frames (Schmitt ride-through)
   * even though the memory already switched to a new face.
   */
  update(
    key: string,
    descriptor: number[],
    now: number,
  ): { descriptor: number[] | null; swap: boolean } {
    if (!isFiniteVector(descriptor, DESCRIPTOR_LENGTH)) {
      return { descriptor: null, swap: false };
    }
    const existing = this.entries.get(key);
    if (!existing || now - existing.last > DescriptorMemory.TTL_MS) {
      const copy = descriptor.slice();
      this.entries.set(key, { d: copy, n: 1, last: now });
      return { descriptor: copy, swap: false };
    }

    // Track-swap guard: cosine distance between EMA and new descriptor.
    // High distance means the tracker likely reassigned this ID to a
    // different face — reset instead of blending.
    const target = existing.d;
    let dot = 0;
    let normE = 0;
    let normD = 0;
    for (let i = 0; i < target.length; i++) {
      dot += target[i] * descriptor[i];
      normE += target[i] * target[i];
      normD += descriptor[i] * descriptor[i];
    }
    const denom = Math.sqrt(normE * normD);
    if (denom > 1e-12) {
      const cosSim = Math.min(1, Math.max(-1, dot / denom));
      const angularDist = Math.sqrt(Math.max(0, 2 - 2 * cosSim));
      if (angularDist > DescriptorMemory.RESET_THRESHOLD) {
        const copy = descriptor.slice();
        existing.d = copy;
        existing.n = 1;
        existing.last = now;
        return { descriptor: copy, swap: true };
      }
    }

    for (let i = 0; i < target.length; i++) {
      target[i] += DESCRIPTOR_EMA_ALPHA * (descriptor[i] - target[i]);
    }
    existing.n += 1;
    existing.last = now;
    return { descriptor: target, swap: false };
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
  // cycleMs → 0 ⇒ k → 1 ⇒ geometric sum diverges; report the divergence
  // instead of returning Infinity/NaN to callers.
  if (k >= 1 - 1e-9) return Number.POSITIVE_INFINITY;
  return confidence / (1 - k);
}
