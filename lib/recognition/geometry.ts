import type { FaceBox } from "./types";

export function clamp01(x: number): number {
  return Math.min(1, Math.max(0, x));
}

/** Intersection-over-Union between two boxes. */
export function iou(a: FaceBox, b: FaceBox): number {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.width, b.x + b.width);
  const y2 = Math.min(a.y + a.height, b.y + b.height);
  const iw = x2 - x1;
  const ih = y2 - y1;
  if (iw <= 0 || ih <= 0) return 0;
  const inter = iw * ih;
  const union = a.width * a.height + b.width * b.height - inter;
  return union > 0 ? clamp01(inter / union) : 0;
}

export function boxCenterDistance(a: FaceBox, b: FaceBox): number {
  return Math.hypot(
    a.x + a.width / 2 - (b.x + b.width / 2),
    a.y + a.height / 2 - (b.y + b.height / 2),
  );
}

/**
 * Greedy one-to-one association by IoU score (higher pairs first).
 * Returns pairs [detectionIndex, trackIndex] and the leftovers.
 */
export function associateByIou<T extends FaceBox, U extends FaceBox>(
  detections: T[],
  tracks: U[],
  threshold: number,
): { pairs: [number, number][]; unmatchedDetections: number[]; unmatchedTracks: number[] } {
  type Cand = { di: number; ti: number; score: number };
  const candidates: Cand[] = [];
  for (let di = 0; di < detections.length; di++) {
    for (let ti = 0; ti < tracks.length; ti++) {
      const score = iou(detections[di], tracks[ti]);
      if (score >= threshold) candidates.push({ di, ti, score });
    }
  }
  candidates.sort((a, b) => b.score - a.score);

  const usedD = new Set<number>();
  const usedT = new Set<number>();
  const pairs: [number, number][] = [];
  for (const c of candidates) {
    if (usedD.has(c.di) || usedT.has(c.ti)) continue;
    usedD.add(c.di);
    usedT.add(c.ti);
    pairs.push([c.di, c.ti]);
  }
  const unmatchedDetections: number[] = [];
  for (let di = 0; di < detections.length; di++) if (!usedD.has(di)) unmatchedDetections.push(di);
  const unmatchedTracks: number[] = [];
  for (let ti = 0; ti < tracks.length; ti++) if (!usedT.has(ti)) unmatchedTracks.push(ti);
  return { pairs, unmatchedDetections, unmatchedTracks };
}
