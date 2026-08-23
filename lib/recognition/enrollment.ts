import { recognitionConfig } from "./config";
import { analyzePhotoCanvas } from "./detector";
import { ensureModelsLoaded } from "./model-manager";
import type { PhotoQualityReport } from "./photo-quality";

export type EnrollmentOutcome =
  | {
      ok: true;
      descriptor: number[];
      canvas: HTMLCanvasElement;
      blob: Blob;
      quality: PhotoQualityReport;
    }
  | { ok: false; reason: "no-face" | "multiple-faces" | "face-too-small" | "unreadable" };

/**
 * Full local enrollment pipeline for one uploaded/captured photo:
 * downscale → detect → validate → quality-gate → 128-D descriptor.
 * The image never leaves the device.
 */
export async function enrollFromUpload(file: File | Blob): Promise<EnrollmentOutcome> {
  const { prepareUpload } = await import("@/lib/utils/image");
  const prepared = await prepareUpload(file);
  return enrollFromCanvas(prepared.canvas, prepared.blob, prepared.height);
}

export async function enrollFromBlob(blob: Blob): Promise<{ descriptor: number[] }> {
  const { prepareUpload } = await import("@/lib/utils/image");
  const prepared = await prepareUpload(blob);
  const outcome = await enrollFromCanvas(prepared.canvas, prepared.blob, prepared.height);
  if (!outcome.ok) throw new Error("Stored photo is no longer usable for recognition");
  return { descriptor: outcome.descriptor };
}

async function enrollFromCanvas(
  canvas: HTMLCanvasElement,
  blob: Blob,
  sourceHeight: number,
): Promise<EnrollmentOutcome> {
  const faceapi = await ensureModelsLoaded();
  const analysis = await analyzePhotoCanvas(faceapi, canvas);

  if (analysis.faces.length === 0) {
    return { ok: false, reason: "no-face" };
  }
  if (analysis.faces.length > 1) {
    return { ok: false, reason: "multiple-faces" };
  }
  const face = analysis.faces[0];
  if (face.box.height / sourceHeight < recognitionConfig.minEnrollmentFaceRatio) {
    return { ok: false, reason: "face-too-small" };
  }

  // Quality gate — computed locally on the downscaled pixels.
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  let quality: PhotoQualityReport;
  try {
    const { assessPhotoQuality } = await import("./photo-quality");
    if (!ctx) throw new Error("no-2d");
    const scale =
      recognitionConfig.quality.qualityDownscale / Math.max(canvas.width, canvas.height);
    const w = Math.max(8, Math.round(canvas.width * Math.min(1, scale)));
    const h = Math.max(8, Math.round(canvas.height * Math.min(1, scale)));
    const small = document.createElement("canvas");
    small.width = w;
    small.height = h;
    small.getContext("2d")?.drawImage(canvas, 0, 0, w, h);
    const sctx = small.getContext("2d", { willReadFrequently: true });
    if (!sctx) throw new Error("no-2d");
    const imageData = sctx.getImageData(0, 0, w, h);
    quality = assessPhotoQuality(
      { data: imageData.data, width: w, height: h },
      face.landmarks,
      recognitionConfig,
    );
  } catch {
    // Quality analysis is advisory; never block enrollment on it.
    quality = { sharpness: NaN, brightness: NaN, yaw: null, verdict: "good", warnings: [] };
  }

  if (quality.verdict === "reject") {
    return { ok: false, reason: "unreadable" };
  }

  return { ok: true, descriptor: face.descriptor, canvas, blob, quality };
}
