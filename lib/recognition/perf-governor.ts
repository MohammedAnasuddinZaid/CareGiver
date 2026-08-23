import type { recognitionConfig } from "./config";

type Config = typeof recognitionConfig;

/**
 * Adaptive compute governor.
 *
 * Tracks inference latency as an EWMA and moves the detector between
 * resolution tiers (320 → 256 → 224) with a cooldown, so:
 * - modest laptops keep Companion Mode responsive under load,
 * - capable machines stay at maximum accuracy,
 * - changes never thrash back and forth frame-to-frame.
 */
export class PerfGovernor {
  private tierIndex = 0;
  private ewma: number | null = null;
  private lastChange = Number.NEGATIVE_INFINITY;

  constructor(private readonly cfg: Config["performance"]) {}

  record(latencyMs: number, now: number): void {
    if (!Number.isFinite(latencyMs) || latencyMs < 0) return;
    this.ewma =
      this.ewma === null ? latencyMs : this.cfg.ewmaAlpha * latencyMs + (1 - this.cfg.ewmaAlpha) * this.ewma;

    if (now - this.lastChange < this.cfg.changeCooldownMs) return;
    const maxTier = this.cfg.inputSizes.length - 1;

    if (this.ewma > this.cfg.demoteAboveMs && this.tierIndex < maxTier) {
      this.tierIndex += 1;
      this.lastChange = now;
    } else if (this.ewma < this.cfg.promoteBelowMs && this.tierIndex > 0) {
      this.tierIndex -= 1;
      this.lastChange = now;
    }
  }

  get inputSize(): number {
    return this.cfg.inputSizes[this.tierIndex];
  }

  get stats(): { tier: number; ewmaLatencyMs: number | null } {
    return { tier: this.tierIndex, ewmaLatencyMs: this.ewma === null ? null : Math.round(this.ewma) };
  }
}
