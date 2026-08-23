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
  const {
    threshold,
    ambiguityMargin = recognitionConfig.matching.ambiguityMargin,
    uncertaintyBand = [
      recognitionConfig.matching.uncertaintyBandLow,
      recognitionConfig.matching.uncertaintyBandHigh,
    ] as const,
    confidenceSlope = recognitionConfig.matching.confidenceSlope,
  } = options;

  if (profiles.length === 0 || !isFiniteVector(query)) {
    return {
      status: "unknown",
      personId: null,
      distance: null,
      confidence: 0,
      margin: null,
      rejectedBy: profiles.length === 0 ? "no-profiles" : "threshold",
    };
  }

  let bestPersonId: string | null = null;
  let bestDistance = Infinity;
  let secondDistance = Infinity;

  for (const profile of profiles) {
    const { personId, distance } = compareDescriptorToProfile(query, profile);
    if (!Number.isFinite(distance)) continue;
    if (distance < bestDistance) {
      secondDistance = bestDistance;
      bestDistance = distance;
      bestPersonId = personId;
    } else if (distance < secondDistance) {
      secondDistance = distance;
    }
  }

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
