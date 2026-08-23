import { recognitionConfig } from "./config";
import { associateByIou, iou } from "./geometry";
import type { FaceBox } from "./types";

type Config = typeof recognitionConfig;

/**
 * One Euro filter (Casiez et al., CHI 2012) — the adaptive low-pass filter
 * used in AR/VR tracking. Slow hand/face movement is filtered aggressively
 * (calm overlay), while fast movement raises the cutoff dynamically so the
 * box snaps to reality instead of lagging behind.
 */
export class OneEuroFilter {
  private xPrev: number | null = null;
  private dxPrev = 0;
  private tPrev: number | null = null;

  constructor(
    private readonly minCutoff: number,
    private readonly beta: number,
    private readonly dCutoff: number,
  ) {}

  reset(): void {
    this.xPrev = null;
    this.dxPrev = 0;
    this.tPrev = null;
  }

  private static alpha(cutoff: number, dt: number): number {
    const tau = 1 / (2 * Math.PI * cutoff);
    return 1 / (1 + tau / dt);
  }

  filter(value: number, tMs: number): number {
    if (this.xPrev === null || this.tPrev === null) {
      this.xPrev = value;
      this.tPrev = tMs;
      return value;
    }
    const dt = Math.max(1e-3, (tMs - this.tPrev) / 1000);
    if (dt > 1) {
      // Long gap (tab hidden): snap instead of extrapolating.
      this.xPrev = value;
      this.tPrev = tMs;
      this.dxPrev = 0;
      return value;
    }
    const dx = (value - this.xPrev) / dt;
    const aD = OneEuroFilter.alpha(this.dCutoff, dt);
    const dxHat = aD * dx + (1 - aD) * this.dxPrev;

    const cutoff = this.minCutoff + this.beta * Math.abs(dxHat);
    const a = OneEuroFilter.alpha(cutoff, dt);
    const xHat = a * value + (1 - a) * this.xPrev;

    this.xPrev = xHat;
    this.tPrev = tMs;
    this.dxPrev = dxHat;
    return xHat;
  }
}

export interface TrackedBox {
  trackId: number;
  box: FaceBox;
  hits: number;
}

interface Track {
  id: number;
  filters: [OneEuroFilter, OneEuroFilter, OneEuroFilter, OneEuroFilter];
  box: FaceBox;
  lastTs: number;
  hits: number;
}

/**
 * Lightweight face tracker:
 * - Greedy IoU association keeps stable track IDs across frames.
 * - Each coordinate runs through its own One Euro filter, so overlays are
 *   smooth without lagging when someone turns quickly.
 */
export class BoxTracker {
  private tracks: Track[] = [];
  private nextId = 1;

  constructor(private readonly cfg: Config["tracker"]) {}

  reset(): void {
    this.tracks = [];
  }

  update(detections: FaceBox[], now: number): TrackedBox[] {
    const { pairs, unmatchedDetections, unmatchedTracks } = associateByIou(
      detections,
      this.tracks.map((t) => t.box),
      this.cfg.iouThreshold,
    );

    for (const [di, ti] of pairs) {
      const track = this.tracks[ti];
      const det = detections[di];
      const [fx, fy, fw, fh] = track.filters;
      track.box = {
        x: fx.filter(det.x, now),
        y: fy.filter(det.y, now),
        width: fw.filter(det.width, now),
        height: fh.filter(det.height, now),
      };
      track.lastTs = now;
      track.hits += 1;
    }

    for (const di of unmatchedDetections) {
      const det = detections[di];
      const mk = () =>
        new OneEuroFilter(this.cfg.oneEuro.minCutoff, this.cfg.oneEuro.beta, this.cfg.oneEuro.dCutoff);
      this.tracks.push({
        id: this.nextId++,
        filters: [mk(), mk(), mk(), mk()],
        box: { ...det },
        lastTs: now,
        hits: 1,
      });
    }

    // Age out stale tracks.
    for (const ti of [...unmatchedTracks].sort((a, b) => b - a)) {
      const track = this.tracks[ti];
      if (now - track.lastTs > this.cfg.maxAgeMs) this.tracks.splice(ti, 1);
    }

    return this.tracks.map((t) => ({
      trackId: t.id,
      box: t.box,
      hits: t.hits,
    }));
  }

  /** Diagnostics helper. */
  overlapRatio(a: FaceBox, b: FaceBox): number {
    return iou(a, b);
  }
}
