import type { recognitionConfig } from "./config";
import type { StableState } from "./types";

type Config = typeof recognitionConfig;

export type Observation = string | "unknown" | null;

/**
 * Temporal identity stabilizer.
 *
 * Recognition output flickers frame-to-frame (Mom → unknown → Dad …).
 * This class turns a rolling buffer of raw observations into ONE stable
 * state for the UI, with three rules:
 *
 * 1. STABILITY  — an identity is shown only after it wins `stableVotes`
 *                 within the last `bufferLength` observations.
 * 2. HOLD       — once stable, an identity survives brief detection dropouts
 *                 for `identityHoldMs` instead of flashing away.
 * 3. UNKNOWN    — "unknown" is shown only after faces have been unmatched
 *                 consistently for `unknownDebounceMs`, so a single bad
 *                 frame never insults a family member.
 */
export class IdentityStabilizer {
  private buffer: Observation[] = [];
  private current: string | null = null;
  private lastConfirmedAt = 0;
  private unknownCandidateSince: number | null = null;

  constructor(private readonly cfg: Config) {}

  reset(): void {
    this.buffer = [];
    this.current = null;
    this.lastConfirmedAt = 0;
    this.unknownCandidateSince = null;
  }

  /** Called when no face is visible at all. */
  observeNoFace(now: number): StableState {
    this.unknownCandidateSince = null;
    if (this.current && now - this.lastConfirmedAt <= this.cfg.identityHoldMs) {
      return { kind: "recognized", personId: this.current };
    }
    this.current = null;
    return { kind: "identifying", personId: null };
  }

  /** Called with the primary face's match outcome ("unknown" when unmatched). */
  observe(observation: Exclude<Observation, null>, now: number): StableState {
    this.buffer.push(observation);
    if (this.buffer.length > this.cfg.bufferLength) this.buffer.shift();

    const candidate = this.majorityIdentity();

    if (candidate) {
      this.current = candidate;
      this.lastConfirmedAt = now;
      this.unknownCandidateSince = null;
      return { kind: "recognized", personId: candidate };
    }

    // No majority yet.
    const sawUnknownRecently =
      observation === "unknown" ||
      this.buffer.some((o) => o === "unknown");

    if (this.current && now - this.lastConfirmedAt <= this.cfg.identityHoldMs) {
      // Hold the existing identity while votes reorganize; but if the recent
      // stream clearly says something else, let go early.
      const recentUnknowns = this.countRecent("unknown");
      const total = this.buffer.length;
      if (!(observation === "unknown" && recentUnknowns >= Math.max(2, total - 2))) {
        return { kind: "recognized", personId: this.current };
      }
    }
    this.current = null;

    if (observation === "unknown" || sawUnknownRecently) {
      if (this.unknownCandidateSince === null) this.unknownCandidateSince = now;
      if (now - this.unknownCandidateSince >= this.cfg.unknownDebounceMs) {
        return { kind: "unknown", personId: null };
      }
      return { kind: "identifying", personId: null };
    }
    return { kind: "identifying", personId: null };
  }

  private countRecent(target: Observation): number {
    return this.buffer.filter((o) => o === target).length;
  }

  /**
   * Majority vote over the buffer. Ties resolve to the most recently seen
   * identity so behavior stays deterministic in tests and on camera.
   */
  private majorityIdentity(): string | null {
    const counts = new Map<string, number>();
    const lastSeen = new Map<string, number>();
    this.buffer.forEach((obs, idx) => {
      if (!obs || obs === "unknown") return;
      counts.set(obs, (counts.get(obs) ?? 0) + 1);
      lastSeen.set(obs, idx);
    });
    let best: string | null = null;
    let bestCount = 0;
    let bestIndex = -1;
    for (const [id, count] of counts) {
      const idx = lastSeen.get(id)!;
      if (
        count >= this.cfg.stableVotes &&
        (count > bestCount || (count === bestCount && idx > bestIndex))
      ) {
        best = id;
        bestCount = count;
        bestIndex = idx;
      }
    }
    return best;
  }
}
