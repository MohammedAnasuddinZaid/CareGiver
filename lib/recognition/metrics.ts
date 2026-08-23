import { DESCRIPTOR_LENGTH } from "./config";

/**
 * Numerical core of the recognition engine.
 * All functions are pure, NaN-safe and unit-tested.
 */

export const EPSILON = 1e-12;

export function isFiniteVector(value: unknown, length = DESCRIPTOR_LENGTH): value is number[] {
  return (
    Array.isArray(value) &&
    value.length === length &&
    value.every((n) => typeof n === "number" && Number.isFinite(n))
  );
}

/**
 * L2-normalize a descriptor to unit length.
 * Normalization makes Euclidean distance magnitude-invariant — two
 * descriptors then compare purely by direction (angular) similarity.
 * Zero vectors are rejected: they carry no directional information.
 */
export function l2Normalize(vector: number[]): number[] | null {
  if (!isFiniteVector(vector)) return null;
  let sum = 0;
  for (const v of vector) sum += v * v;
  const norm = Math.sqrt(sum);
  if (!(norm > EPSILON)) return null;
  let out = new Array<number>(vector.length);
  for (let i = 0; i < vector.length; i++) out[i] = vector[i] / norm;
  return out;
}

/** Cosine similarity in [-1, 1]. Inputs are normalized defensively. */
export function cosineSimilarity(a: number[], b: number[]): number {
  const na = l2Normalize(a);
  const nb = l2Normalize(b);
  if (!na || !nb) return 0;
  let dot = 0;
  for (let i = 0; i < na.length; i++) dot += na[i] * nb[i];
  if (!Number.isFinite(dot)) return 0;
  return Math.min(1, Math.max(-1, dot));
}

/**
 * Euclidean distance between L2-normalized descriptors.
 * For unit vectors: d² = ‖a−b‖² = 2 − 2·cos θ, so this is a monotonic
 * map of angular distance with the familiar face-api threshold scale.
 */
export function normalizedEuclidean(a: number[], b: number[]): number {
  const cos = cosineSimilarity(a, b);
  return Math.sqrt(Math.max(0, 2 - 2 * cos));
}

export function sigmoid(x: number): number {
  if (x >= 0) {
    const z = Math.exp(-x);
    return 1 / (1 + z);
  }
  const z = Math.exp(x);
  return z / (1 + z);
}

/**
 * Logistic calibration of a distance into [0,1] confidence around the
 * decision threshold: d = T → 0.5, comfortably below → →1, above → →0.
 */
export function confidenceFromDistance(
  distance: number,
  threshold: number,
  slope: number,
): number {
  if (!Number.isFinite(distance)) return 0;
  return Math.min(1, Math.max(0, sigmoid(slope * (threshold - distance))));
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
