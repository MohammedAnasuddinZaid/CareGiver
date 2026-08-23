import { DESCRIPTOR_LENGTH } from "./config";
import type { MatchOutcome, ProfileLike } from "./types";

export function isValidDescriptor(value: unknown): value is number[] {
  return (
    Array.isArray(value) &&
    value.length === DESCRIPTOR_LENGTH &&
    value.every((n) => typeof n === "number" && Number.isFinite(n))
  );
}

/** Euclidean distance between two face descriptors (face-api.js convention). */
export function euclideanDistance(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  return Math.sqrt(sum);
}

/**
 * Best distance between a query descriptor and a profile.
 * A person may have several enrollment photos — the closest one wins,
 * which makes recognition robust to angles/lighting changes.
 */
export function compareDescriptorToProfile(
  query: number[],
  profile: ProfileLike,
): { personId: string; distance: number } {
  let best = Infinity;
  for (const candidate of profile.descriptors ?? []) {
    if (!isValidDescriptor(candidate)) continue;
    const d = euclideanDistance(query, candidate);
    if (d < best) best = d;
  }
  return { personId: profile.id, distance: best };
}

/**
 * Identify a live descriptor against locally enrolled profiles.
 * IMPORTANT SAFETY BEHAVIOR: if the best match is above `threshold`, the
 * result is "unknown" — we never hand back "the least-distant stranger".
 */
export function identifyFace(
  query: number[],
  profiles: ProfileLike[],
  threshold: number,
): MatchOutcome {
  let bestPersonId: string | null = null;
  let bestDistance = Infinity;
  for (const profile of profiles) {
    const { distance } = compareDescriptorToProfile(query, profile);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestPersonId = profile.id;
    }
  }
  if (bestPersonId !== null && bestDistance <= threshold) {
    return { status: "recognized", personId: bestPersonId, distance: bestDistance };
  }
  return { status: "unknown", personId: null, distance: null };
}

/** Primary face selection: recognized beats larger, larger beats more central. */
export function selectPrimaryFace<T extends { box: { width: number; height: number }; matched?: boolean }>(
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
