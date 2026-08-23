import type { Sensitivity } from "@/lib/settings/settings";

/**
 * Central recognition configuration.
 * No magic numbers are scattered through components — everything tunes here.
 */
export const recognitionConfig = {
  /** TinyFaceDetector input resolution (multiple of 32). 320 is fast and adequate. */
  detectionInputSize: 320,
  /** Minimum detector confidence for a face box to be considered. */
  detectionScoreThreshold: 0.5,

  /**
   * Euclidean distance threshold on face-api.js 128-D descriptors.
   * The library's own FaceMatcher default is 0.6; we bias stricter so that
   * an unfamiliar person can remain unknown rather than be mislabeled.
   */
  thresholds: {
    cautious: 0.5,
    balanced: 0.55,
    permissive: 0.62,
  } satisfies Record<Sensitivity, number>,

  defaultSensitivity: "balanced" as Sensitivity,

  /**
   * Temporal stabilization:
   * - We keep a rolling buffer of recent observations (one per inference).
   * - An identity becomes stable when it wins `stableVotes` of the last
   *   `bufferLength` observations.
   */
  bufferLength: 8,
  stableVotes: 5,

  /** How often recognition runs (ms). ~4 inferences/sec keeps laptops cool. */
  sampleIntervalMs: 260,

  /**
   * Once recognized, the identity card holds for this long without fresh
   * confirmations before clearing — prevents flicker when detection drops
   * for a few frames.
   */
  identityHoldMs: 3000,

  /** Debounce before showing "I don't recognize this person yet". */
  unknownDebounceMs: 700,

  /** Minimum time between voice announcements for the same person. */
  speechCooldownMs: 30_000,

  /** Enrollment limits. */
  maxEnrollmentPhotos: 4,
  /** Reject enrollment faces smaller than this fraction of image height. */
  minEnrollmentFaceRatio: 0.12,
} as const;

export function thresholdFor(sensitivity: Sensitivity): number {
  return recognitionConfig.thresholds[sensitivity];
}

export const DESCRIPTOR_LENGTH = 128;
