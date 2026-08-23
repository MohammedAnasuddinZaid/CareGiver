import { recognitionConfig } from "./config";
import { analyzePhotoCanvas } from "./detector";
import { ensureModelsLoaded } from "./model-manager";

export type EnrollmentOutcome =
  | { ok: true; descriptor: number[]; canvas: HTMLCanvasElement; blob: Blob }
  | { ok: false; reason: "no-face" | "multiple-faces" | "face-too-small" };

/**
 * Full local enrollment pipeline for one uploaded photo:
 * downscale → detect → validate → produce 128-D descriptor.
 * The image never leaves the device.
 */
export async function enrollFromUpload(file: File): Promise<EnrollmentOutcome> {
  const { prepareUpload } = await import("@/lib/utils/image");
  const prepared = await prepareUpload(file);
  const faceapi = await ensureModelsLoaded();
  const analysis = await analyzePhotoCanvas(faceapi, prepared.canvas);

  if (analysis.faces.length === 0) {
    return { ok: false, reason: "no-face" };
  }
  if (analysis.faces.length > 1) {
    return { ok: false, reason: "multiple-faces" };
  }
  const face = analysis.faces[0];
  const ratio = face.box.height / prepared.height;
  if (ratio < recognitionConfig.minEnrollmentFaceRatio) {
    return { ok: false, reason: "face-too-small" };
  }

  return { ok: true, descriptor: face.descriptor, canvas: prepared.canvas, blob: prepared.blob };
}

/** Re-run descriptor generation for an already-stored enrollment photo. */
export async function enrollFromBlob(blob: Blob): Promise<{ descriptor: number[] }> {
  const { prepareUpload } = await import("@/lib/utils/image");
  const prepared = await prepareUpload(blob);
  const faceapi = await ensureModelsLoaded();
  const analysis = await analyzePhotoCanvas(faceapi, prepared.canvas);
  if (analysis.faces.length !== 1) {
    throw new Error("Stored photo is no longer usable for recognition");
  }
  return { descriptor: analysis.faces[0].descriptor };
}
