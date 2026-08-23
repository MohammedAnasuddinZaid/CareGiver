/**
 * On-device enrollment photo quality analysis.
 * All metrics are computed from plain pixel buffers so the math is
 * unit-testable without a DOM:
 *
 * - Sharpness: variance of the Laplacian response (high = crisp edges,
 *   low = blurry). A classic focus measure from CV literature.
 * - Brightness: mean luminance (Rec. 601 luma weights).
 * - Yaw proxy: asymmetry of eye/nose landmark geometry — a face turned
 *   away produces a nose tip far from the midpoint between the outer
 *   eye corners.
 */

export interface Point2D {
  x: number;
  y: number;
}

export interface LandmarkTrio {
  leftEyeOuter: Point2D;
  rightEyeOuter: Point2D;
  noseTip: Point2D;
}

export interface PixelBuffer {
  data: ArrayLike<number>;
  width: number;
  height: number;
}

export function toGrayscale(buffer: PixelBuffer): { gray: Float32Array; width: number; height: number } {
  const { data, width, height } = buffer;
  const gray = new Float32Array(width * height);
  for (let i = 0, p = 0; p < gray.length; i += 4, p++) {
    gray[p] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }
  return { gray, width, height };
}

/** Variance of the 4-neighbor Laplacian response over a grayscale image. */
export function laplacianVariance(buffer: PixelBuffer): number {
  const { gray, width, height } = toGrayscale(buffer);
  if (width < 3 || height < 3) return 0;
  let sum = 0;
  let sumSq = 0;
  let count = 0;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      const response =
        4 * gray[i] - gray[i - 1] - gray[i + 1] - gray[i - width] - gray[i + width];
      sum += response;
      sumSq += response * response;
      count++;
    }
  }
  if (count === 0) return 0;
  const mean = sum / count;
  return sumSq / count - mean * mean;
}

export function meanLuminance(buffer: PixelBuffer): number {
  const { gray } = toGrayscale(buffer);
  if (gray.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < gray.length; i++) sum += gray[i];
  return sum / gray.length;
}

/**
 * Yaw proxy in [-0.5, +0.5]: horizontal offset of the nose tip from the
 * midpoint between the outer eye corners, normalized by the eye span.
 * ~0 = frontal; large |value| = head turned.
 */
export function yawProxy(lm: LandmarkTrio): number | null {
  const span = lm.rightEyeOuter.x - lm.leftEyeOuter.x;
  if (!Number.isFinite(span) || Math.abs(span) < 1e-3) return null;
  const t = (lm.noseTip.x - lm.leftEyeOuter.x) / span;
  if (!Number.isFinite(t)) return null;
  return Math.min(0.5, Math.max(-0.5, t - 0.5));
}

export type QualityVerdict = "good" | "warn" | "reject";

const VERDICT_RANK: Record<QualityVerdict, number> = { good: 0, warn: 1, reject: 2 };

function worstOf(a: QualityVerdict, b: QualityVerdict): QualityVerdict {
  return VERDICT_RANK[b] > VERDICT_RANK[a] ? b : a;
}

export interface PhotoQualityReport {
  sharpness: number;
  brightness: number;
  yaw: number | null;
  verdict: QualityVerdict;
  warnings: string[];
}

type Config = typeof import("./config").recognitionConfig;

export function assessPhotoQuality(
  buffer: PixelBuffer,
  landmarks: LandmarkTrio | null,
  cfg: Config,
): PhotoQualityReport {
  const sharpness = laplacianVariance(buffer);
  const brightness = meanLuminance(buffer);
  const yaw = landmarks ? yawProxy(landmarks) : null;

  const warnings: string[] = [];
  let verdict: QualityVerdict = "good";

  if (sharpness < cfg.quality.blurRejectVariance) {
    verdict = worstOf(verdict, "reject");
    warnings.push("The photo is too blurry to read reliably.");
  } else if (sharpness < cfg.quality.blurWarnVariance) {
    verdict = worstOf(verdict, "warn");
    warnings.push("A slightly sharper photo would help recognition.");
  }
  if (brightness < cfg.quality.darkMeanBelow) {
    verdict = worstOf(verdict, "warn");
    warnings.push("The photo looks dark — try better lighting next time.");
  } else if (brightness > cfg.quality.brightMeanAbove) {
    verdict = worstOf(verdict, "warn");
    warnings.push("The photo looks overexposed — softer light helps.");
  }
  if (yaw !== null && Math.abs(yaw) >= cfg.quality.yawReject) {
    verdict = worstOf(verdict, "warn");
    warnings.push("The face is turned quite far to the side — a frontal photo works best.");
  }

  return { sharpness, brightness, yaw, verdict, warnings };
}
