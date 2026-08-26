import { recognitionConfig } from "./config";
import { confidenceFromDistance, isFiniteVector, l2Normalize, normalizedEuclidean } from "./metrics";
import type { FaceBox, ProfileLike } from "./types";

export interface MatchOptions {
  threshold: number;
  ambiguityMargin?: number;
  uncertaintyBand?: readonly [number, number];
  confidenceSlope?: number;
}

export interface DetailedMatch {
  /** "recognized" | "unknown" — unknown wins over wrong identity. */
  status: "recognized" | "unknown";
  personId: string | null;
  /** Best distance in L2-normalized descriptor space (null when no data). */
  distance: number | null;
  /** Logistic-calibrated confidence in [0,1] (0 when unknown). */
  confidence: number;
  /** Gap to the runner-up person; small gaps inside the band are ambiguous. */
  margin: number | null;
  rejectedBy: "threshold" | "ambiguity" | "no-profiles" | null;
}

/**
 * Pre-normalized per-person descriptor index.
 *
 * Hot-path optimization: normalization is idempotent, yet the naive path
 * re-normalized EVERY enrolled descriptor on EVERY frame (twice — once in
 * l2Normalize, again inside cosineSimilarity). For P people × D photos at
 * ~4 fps that is pure wasted math. The index normalizes once when the
 * people list changes; identification then reduces to dot products.
 */
export interface ProfileIndex {
  entries: { personId: string; vectors: number[][] }[];
  size: number;
}

export function buildProfileIndex(profiles: ProfileLike[]): ProfileIndex {
  const entries: ProfileIndex["entries"] = [];
  let size = 0;
  for (const profile of profiles) {
    const vectors: number[][] = [];
    for (const candidate of profile.descriptors ?? []) {
      if (!isFiniteVector(candidate)) continue;
      const normalized = l2Normalize(candidate);
      if (normalized) {
        vectors.push(normalized);
        size++;
      }
    }
    if (vectors.length > 0) entries.push({ personId: profile.id, vectors });
  }
  return { entries, size };
}

/** Squared distance from an ALREADY-normalized query to a unit vector:
 *  ‖a−b‖² = 2 − 2·cosθ. Monotonic in the true distance, so comparisons
 *  are exact while skipping every sqrt on the hot path. */
function squaredUnitDistance(a: readonly number[], b: readonly number[]): number {
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return Math.max(0, 2 - 2 * Math.min(1, Math.max(-1, dot)));
}

/**
 * Distance between a live descriptor and one profile.
 * A person may hold several enrollment descriptors — the minimum
 * (nearest angular neighbor) represents them, which keeps recognition
 * robust across angles and lighting while remaining conservative.
 */
export function compareDescriptorToProfile(
  query: number[],
  profile: ProfileLike,
): { personId: string; distance: number } {
  const nq = l2Normalize(query);
  let best = Infinity;
  if (nq) {
    for (const candidate of profile.descriptors ?? []) {
      if (!isFiniteVector(candidate)) continue;
      const d = normalizedEuclidean(nq, candidate);
      if (d < best) best = d;
    }
  }
  return { personId: profile.id, distance: best };
}

/**
 * Open-set identification with three safety layers:
 *
 * 1. THRESHOLD — the best candidate must sit within the configured
 *    distance threshold, else the result is unknown.
 * 2. AMBIGUITY — when the best distance lies inside the uncertainty band,
 *    a runner-up closer than `ambiguityMargin` forces unknown too.
 *    ("Is it Mom or Dad?" must never be answered by a coin flip.)
 * 3. CONFIDENCE — a logistic calibration used downstream to weight
 *    temporal evidence; weak matches accumulate votes slowly.
 */
export function identifyFaceDetailed(
  query: number[],
  profiles: ProfileLike[],
  options: MatchOptions,
): DetailedMatch {
  return identifyFaceIndexedDetailed(l2Normalize(query), buildProfileIndex(profiles), options);
}

/**
 * Indexed variant of {@link identifyFaceDetailed} for live loops.
 * Accepts an optional pre-normalized query (null ⇒ unknown) and a cached
 * {@link ProfileIndex}; mathematically identical, allocation-light.
 */
export function identifyFaceIndexedDetailed(
  normalizedQuery: number[] | null,
  index: ProfileIndex,
  options: MatchOptions,
): DetailedMatch {
  const {
    threshold,
    ambiguityMargin = recognitionConfig.matching.ambiguityMargin,
    uncertaintyBand = [
      recognitionConfig.matching.uncertaintyBandLow,
      recognitionConfig.matching.uncertaintyBandHigh,
    ] as const,
    confidenceSlope = recognitionConfig.matching.confidenceSlope,
  } = options;

  if (index.entries.length === 0 || !normalizedQuery) {
    return {
      status: "unknown",
      personId: null,
      distance: null,
      confidence: 0,
      margin: null,
      rejectedBy:
        index.entries.length === 0 ? "no-profiles" : "threshold",
    };
  }

  let bestPersonId: string | null = null;
  let bestD2 = Infinity;
  let secondD2 = Infinity;

  for (const entry of index.entries) {
    let entryBestD2 = Infinity;
    for (const vector of entry.vectors) {
      // Squared metric for all comparisons — identical ordering to true
      // distance, one sqrt saved per (query × descriptor) pair.
      const d2 = squaredUnitDistance(normalizedQuery, vector);
      if (d2 < entryBestD2) entryBestD2 = d2;
    }
    if (!Number.isFinite(entryBestD2)) continue;
    if (entryBestD2 < bestD2) {
      secondD2 = bestD2;
      bestD2 = entryBestD2;
      bestPersonId = entry.personId;
    } else if (entryBestD2 < secondD2) {
      secondD2 = entryBestD2;
    }
  }

  // Project back to the threshold's distance scale — two sqrts per call.
  const bestDistance = Math.sqrt(bestD2);
  const secondDistance = Math.sqrt(secondD2);

  const base: DetailedMatch = {
    status: "unknown",
    personId: null,
    distance: Number.isFinite(bestDistance) ? bestDistance : null,
    confidence: 0,
    margin:
      Number.isFinite(bestDistance) && Number.isFinite(secondDistance)
        ? secondDistance - bestDistance
        : null,
    rejectedBy: null,
  };

  if (bestPersonId === null) {
    return { ...base, rejectedBy: "no-profiles" };
  }
  if (bestDistance > threshold) {
    return { ...base, rejectedBy: "threshold" };
  }
  const [bandLow, bandHigh] = uncertaintyBand;
  if (
    base.margin !== null &&
    base.margin < ambiguityMargin &&
    bestDistance >= bandLow &&
    bestDistance <= bandHigh
  ) {
    return { ...base, rejectedBy: "ambiguity" };
  }

  return {
    status: "recognized",
    personId: bestPersonId,
    distance: bestDistance,
    confidence: confidenceFromDistance(bestDistance, threshold, confidenceSlope),
    margin: base.margin,
    rejectedBy: null,
  };
}

/** Back-compatible simple matcher built on the detailed pipeline. */
export function identifyFace(
  query: number[],
  profiles: ProfileLike[],
  threshold: number,
): { status: "recognized" | "unknown"; personId: string | null; distance: number | null } {
  const m = identifyFaceDetailed(query, profiles, { threshold });
  return { status: m.status, personId: m.personId, distance: m.distance };
}

/** Primary face selection: recognized beats larger, larger beats more central. */
export function selectPrimaryFace<T extends { box: FaceBox; matched?: boolean }>(
  faces: T[],
): number {
  if (faces.length === 0) return -1;
  let bestIndex = 0;
  let bestScore = -Infinity;
  for (let i = 0; i < faces.length; i++) {
    const area = faces[i].box.width * faces[i].box.height;
    // Recognized faces get a large boost so the card follows them when
    // several people are visible at once.
    const score = (faces[i].matched ? 1e12 : 0) + area;
    if (score > bestScore) {
      bestScore = score;
      bestIndex = i;
    }
  }
  return bestIndex;
}
