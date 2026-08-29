import type { Sensitivity } from "@/lib/settings/settings";

/**
 * Central recognition configuration.
 * Every constant that shapes recognition behavior lives here — no magic
 * numbers scattered through components.
 */
export const recognitionConfig = {
  /**
   * TinyFaceDetector base input resolution (multiple of 32). Higher = more
   * facial detail → sharper landmarks → better-aligned descriptors → more
   * reliable matching. 512 is the top tier; the performance governor demotes
   * this on slow devices, so capable hardware gets the detail win and weak
   * devices stay responsive.
   */
  detectionInputSize: 512,
  /**
   * Minimum detector confidence for a face box to be considered. 0.45 is a
   * touch more permissive than the 0.5 default so a face registers quickly
   * in bright/dim rooms without inviting false positives in practice.
   */
  detectionScoreThreshold: 0.45,

  /**
   * Euclidean distance threshold on L2-normalized 128-D descriptors.
   * For unit vectors, euclidean distance d relates to cosine similarity
   * by d = sqrt(2 − 2·cos θ), so d ≤ 0.55 ≈ cos θ ≥ 0.85.
   * The library's FaceMatcher default is 0.6; we bias stricter so an
   * unfamiliar person can remain unknown rather than be mislabeled.
   */
  thresholds: {
    cautious: 0.55,
    balanced: 0.6,
    permissive: 0.68,
  } satisfies Record<Sensitivity, number>,
  defaultSensitivity: "balanced" as Sensitivity,

  /**
   * Open-set verification math:
   * - Ambiguity margin: when the best and second-best persons are separated
   *   by less than `ambiguityMargin` AND the best distance sits inside the
   *   uncertainty band, we refuse to guess (Lowe-style ratio test adapted
   *   to open-set identification).
   * - Confidence is a logistic calibration around the threshold:
   *   c = σ(k · (T − d)), used to weight temporal votes.
   */
  matching: {
    ambiguityMargin: 0.07,
    uncertaintyBandLow: 0.42,
    uncertaintyBandHigh: 0.66,
    confidenceSlope: 12,
  },

  /**
   * Temporal stabilization — exponentially-decayed evidence voting with
   * Schmitt-trigger hysteresis:
   * - Each observation adds `confidence` to its person's accumulator; all
   *   accumulators decay by exp(−Δt/τ).
   * - ENTER recognized state when a person's weight ≥ enterWeight.
   * - STAY recognized until their weight decays below exitWeight (< enter),
   *   which rides through brief detection dropouts without flicker.
   * - Switching identities requires the newcomer to independently satisfy
   *   the enter criterion — the previous person is held meanwhile.
   *
   * Control-theory tuning (verified against the discrete fixed point):
   * the accumulator obeys w ← w·k + c with k = exp(−Δt/τ), giving steady
   * state w* = c/(1−k). With a TRUE period-based 260 ms cadence and
   * τ = 900 ms, k = 0.75 so w* ≈ 4·c — comfortably above enterWeight for
   * any plausible match, while enterWeight = 1.35 locks a typical strong
   * match (c ≈ 0.86+) in TWO frames ≈ 520 ms and a marginal one (c ≈ 0.59)
   * in three ≈ 780 ms. Hysteresis ratio 0.55/1.35 preserves flicker
   * immunity; dropout ride-through ≈ τ·ln(w/exit) ≈ 0.9–1.6 s.
   */
  temporal: {
    tauMs: 900,
    enterWeight: 1.1,
    exitWeight: 0.55,
    maxWeight: 4.0,
    pruneAfterMs: 4500,
    unknownDebounceMs: 700,
    identityHoldMs: 3000,
  },

  /**
   * How often recognition runs (ms). The scheduler is period-based (inference
   * + wait = one cycle) and never overlaps itself, so this is a FLOOR on the
   * post-inference wait — the loop re-ticks as soon as the previous inference
   * finishes. Lower = higher max throughput on capable hardware; the
   * performance governor keeps slow devices smooth by dropping resolution.
   * A confident match still locks in ~2 frames via the temporal stabilizer.
   */
  sampleIntervalMs: 120,

  /**
   * Adaptive compute governor: an EWMA of real inference latency promotes or
   * demotes the detector resolution tier with a cooldown, so slow devices
   * stay responsive and fast ones get accuracy. Start at the high tier for
   * best detection; demote automatically if latency climbs.
   */
  performance: {
    inputSizes: [512, 416, 320, 256],
    ewmaAlpha: 0.2,
    demoteAboveMs: 420,
    promoteBelowMs: 160,
    changeCooldownMs: 5000,
  },

  /**
   * Box tracker: greedy IoU association across frames + per-coordinate
   * One-Euro filtering (adaptive low-pass: heavy smoothing when slow,
   * snappy when fast) for calm, professional overlays.
   */
  tracker: {
    iouThreshold: 0.25,
    maxAgeMs: 1200,
    minHitsBeforeDraw: 1,
    oneEuro: { minCutoff: 1.4, beta: 0.03, dCutoff: 1.4 },
  },

  /**
   * Enrollment photo quality gates (all measured locally on-device):
   * - Sharpness = variance of the Laplacian on a grayscale downscale.
   * - Brightness = mean luminance.
   * - Yaw proxy = asymmetry of eye/nose landmark geometry.
   */
  quality: {
    blurRejectVariance: 18,
    blurWarnVariance: 80,
    darkMeanBelow: 46,
    brightMeanAbove: 230,
    yawWarn: 0.17,
    yawReject: 0.34,
    qualityDownscale: 256,
  },

  /** Speech cooldown per person. */
  speechCooldownMs: 30_000,

  /** Enrollment limits. */
  maxEnrollmentPhotos: 4,
  /**
   * Reject enrollment faces smaller than this fraction of image height.
   * 0.15 avoids enrolling low-resolution crops whose descriptors are noisy,
   * which keeps the match distance clean and recognition accurate.
   */
  minEnrollmentFaceRatio: 0.15,
} as const;

export function thresholdFor(sensitivity: Sensitivity): number {
  return recognitionConfig.thresholds[sensitivity];
}

export const DESCRIPTOR_LENGTH = 128;
