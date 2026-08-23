import type { recognitionConfig } from "./config";

type Config = typeof recognitionConfig;

export interface ObservationInput {
  /** Matched person id, or null when the face did not clear the gate. */
  personId: string | null;
  /** Logistic-calibrated match confidence in [0,1]; 0 when unmatched. */
  confidence: number;
}

/**
 * Temporal identity stabilizer v2 — exponentially-decayed evidence voting
 * with Schmitt-trigger hysteresis.
 *
 * Why: raw frame-by-frame recognition flickers (Mom → unknown → Dad…), and
 * naive majority voting reacts abruptly at exactly N votes. Instead:
 *
 * - Every observation deposits its calibrated `confidence` into that
 *   person's accumulator; all accumulators decay continuously by
 *   exp(−Δt/τ). Evidence therefore has a soft half-life instead of a
 *   cliff-edge window.
 * - ENTERING "recognized" requires weight ≥ enterWeight (Schmitt upper
 *   threshold) — several agreeing frames.
 * - LEAVING happens only when weight decays below exitWeight (< enter) —
 *   so brief detection dropouts ride through silently (hysteresis band).
 * - SWITCHING to a different person requires them to independently satisfy
 *   the enter criterion; until then the previous identity is held —
 *   never a coin-flip between Mom and Dad.
 * - "unknown" is shown only after faces stay unmatched for
 *   unknownDebounceMs — one bad frame never insults a family member.
 */
export class IdentityStabilizer {
  private weights = new Map<string, { w: number; last: number }>();
  private currentId: string | null = null;
  private lastFaceAt = 0;
  private unknownSince: number | null = null;
  private hasFace = false;

  constructor(private readonly cfg: Config) {}

  reset(): void {
    this.weights.clear();
    this.currentId = null;
    this.lastFaceAt = 0;
    this.unknownSince = null;
    this.hasFace = false;
  }

  /** Current accumulated evidence per person (for diagnostics panels). */
  snapshot(now: number): { personId: string; weight: number }[] {
    return [...this.decayedWeights(now).entries()].map(([personId, w]) => ({
      personId,
      weight: w,
    }));
  }

  /** Called when no face is visible. Holds the identity briefly (grace). */
  observeNoFace(now: number): { kind: "recognized" | "identifying"; personId: string | null } {
    this.unknownSince = null;
    if (!this.hasFace && !this.currentId) {
      return { kind: "identifying", personId: null };
    }
    this.decayAll(now);
    // Time-based grace: the identity card must not flash away because a
    // few frames dropped; evidence resumes when the face reappears.
    const held =
      this.currentId !== null &&
      now - this.lastFaceAt <= this.cfg.temporal.identityHoldMs;
    if (held) return { kind: "recognized", personId: this.currentId };
    this.currentId = null;
    this.hasFace = false;
    return { kind: "identifying", personId: null };
  }

  /** Called once per inference with the primary face's match outcome. */
  observe(observation: ObservationInput, now: number): { kind: "recognized" | "unknown" | "identifying"; personId: string | null } {
    this.hasFace = true;
    this.lastFaceAt = now;
    if (observation.personId) {
      // A confident match resets the unknown debounce; unmatched frames
      // must accumulate continuously before "unknown" may be shown.
      this.unknownSince = null;
    }
    this.decayAll(now);

    if (observation.personId) {
      const entry = this.weights.get(observation.personId);
      if (entry) {
        entry.w = Math.min(this.cfg.temporal.maxWeight, entry.w + observation.confidence);
        entry.last = now;
      } else {
        this.weights.set(observation.personId, { w: observation.confidence, last: now });
      }
    }

    // Hysteresis exit check for the incumbent.
    if (this.currentId !== null) {
      const w = this.currentWeight(now);
      if (w >= this.cfg.temporal.exitWeight) {
        return { kind: "recognized", personId: this.currentId };
      }
      // Fell below the lower Schmitt threshold — release, but allow an
      // immediate re-lock by another candidate in the same tick.
      this.currentId = null;
    }

    // Enter check for any candidate above the upper threshold.
    let bestId: string | null = null;
    let bestW = 0;
    for (const [personId, w] of this.decayedWeights(now)) {
      if (w > bestW) {
        bestId = personId;
        bestW = w;
      }
    }
    if (bestId !== null && bestW >= this.cfg.temporal.enterWeight) {
      this.currentId = bestId;
      return { kind: "recognized", personId: bestId };
    }

    // Unstable zone.
    if (!observation.personId) {
      if (this.unknownSince === null) this.unknownSince = now;
      if (
        now - this.unknownSince >= this.cfg.temporal.unknownDebounceMs &&
        this.cfg.temporal.exitWeight > 0
      ) {
        return { kind: "unknown", personId: null };
      }
    }
    return { kind: "identifying", personId: null };
  }

  private decayedWeights(now: number): Map<string, number> {
    const out = new Map<string, number>();
    for (const [id, entry] of this.weights) {
      if (now - entry.last > this.cfg.temporal.pruneAfterMs) {
        this.weights.delete(id);
        continue;
      }
      out.set(id, Math.max(0, entry.w));
    }
    return out;
  }

  /** Applies exponential decay lazily and prunes stale entries. */
  private decayAll(now: number): void {
    for (const [id, entry] of this.weights) {
      const age = now - entry.last;
      if (age > this.cfg.temporal.pruneAfterMs) {
        this.weights.delete(id);
        continue;
      }
      entry.w = entry.w * Math.exp(-age / this.cfg.temporal.tauMs);
      entry.last = now;
    }
  }

  private currentWeight(now: number): number {
    if (!this.currentId) return 0;
    const entry = this.weights.get(this.currentId);
    if (!entry) return 0;
    const age = now - entry.last;
    if (age > this.cfg.temporal.pruneAfterMs) return 0;
    // Weight as of `now` without mutating (decay applied on observe()).
    return entry.w * Math.exp(-Math.min(age, this.cfg.temporal.pruneAfterMs) / this.cfg.temporal.tauMs);
  }
}
