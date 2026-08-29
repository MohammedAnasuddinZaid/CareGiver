import { recognitionConfig } from "./config";
import type { DetectedFace, FaceBox } from "./types";
import type { FaceApiModule } from "./model-manager";
import type { LandmarkTrio } from "./photo-quality";

function videoOptions(faceapi: FaceApiModule, inputSize: number) {
  return new faceapi.TinyFaceDetectorOptions({
    inputSize,
    scoreThreshold: recognitionConfig.detectionScoreThreshold,
  });
}

/** Pre-processing applied to a frame before detection (brightness/contrast/
 * saturation lift + downscale). Lifting contrast before inference is what lets
 * the model find faces in dim, backlit, or noisy webcam frames. `grayscale`
 * desaturates the buffer so the stored/descriptor pipeline becomes colour-
 * invariant — heavy chroma (red/purple webcam) noise no longer shifts the
 * embedding, which is the single biggest win for matching in bad lighting. */
export interface DetectEnhance {
  brightness?: number;
  contrast?: number;
  saturate?: number;
  grayscale?: boolean;
  /** Cap the working width; downscaling averages out sensor noise. */
  maxWidth?: number;
}

let scratchCanvas: HTMLCanvasElement | null = null;
function getScratch(w: number, h: number): HTMLCanvasElement {
  if (!scratchCanvas) scratchCanvas = document.createElement("canvas");
  if (scratchCanvas.width !== w || scratchCanvas.height !== h) {
    scratchCanvas.width = w;
    scratchCanvas.height = h;
  }
  return scratchCanvas;
}

/**
 * Draws `video` into an enhanced, downscaled scratch buffer and returns it
 * plus the scale factors to map detection boxes back into video-pixel space.
 * When no enhancement is requested (or dims are unavailable) the video itself
 * is used and scales are 1.
 */
function toEnhancedInput(
  video: HTMLVideoElement,
  enhance: DetectEnhance | undefined,
): { input: HTMLVideoElement | HTMLCanvasElement; sx: number; sy: number } {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!enhance || !vw || !vh || typeof HTMLCanvasElement === "undefined") {
    return { input: video, sx: 1, sy: 1 };
  }
  const maxW = enhance.maxWidth ?? 640;
  const s = Math.min(1, maxW / vw);
  const cw = Math.max(64, Math.round(vw * s));
  const ch = Math.max(64, Math.round(vh * s));
  const c = getScratch(cw, ch);
  const ctx = c.getContext("2d");
  if (!ctx) return { input: video, sx: 1, sy: 1 };
  const parts: string[] = [];
  if (enhance.grayscale) parts.push("grayscale(1)");
  parts.push(`brightness(${enhance.brightness ?? 1})`);
  parts.push(`contrast(${enhance.contrast ?? 1.05})`);
  // Saturate is meaningless after grayscale; skip it so we don't waste a
  // compositing stage.
  if (!enhance.grayscale) parts.push(`saturate(${enhance.saturate ?? 1.06})`);
  ctx.filter = parts.join(" ");
  ctx.drawImage(video, 0, 0, cw, ch);
  ctx.filter = "none";
  return { input: c, sx: vw / cw, sy: vh / ch };
}

/** Live detection + descriptors for every face in the frame. */
export async function detectFacesInVideo(
  faceapi: FaceApiModule,
  video: HTMLVideoElement,
  inputSize: number = recognitionConfig.detectionInputSize,
  enhance?: DetectEnhance,
): Promise<DetectedFace[]> {
  const { input, sx, sy } = toEnhancedInput(video, enhance);
  const results = await faceapi
    .detectAllFaces(input, videoOptions(faceapi, inputSize))
    .withFaceLandmarks()
    .withFaceDescriptors();
  return results.map((r) => ({
    box: {
      x: r.detection.box.x * sx,
      y: r.detection.box.y * sy,
      width: r.detection.box.width * sx,
      height: r.detection.box.height * sy,
    },
    descriptor: Array.from(r.descriptor),
  }));
}

export interface DetectedFaceLite {
  box: FaceBox;
  landmarks: LandmarkTrio | null;
}

/**
 * Cheap live detection used only for *presence + framing* (enrollment guide,
 * companion overlay). Skips the recognition-net descriptor pass — that is the
 * dominant cost per frame — so a face is reported in a few milliseconds instead
 * of the full match latency. Matching still happens separately on the full
 * descriptor path.
 */
export async function detectFacesInVideoLite(
  faceapi: FaceApiModule,
  video: HTMLVideoElement,
  inputSize: number = 256,
  enhance?: DetectEnhance,
): Promise<DetectedFaceLite[]> {
  const { input, sx, sy } = toEnhancedInput(video, enhance);
  const results = await faceapi
    .detectAllFaces(input, videoOptions(faceapi, inputSize))
    .withFaceLandmarks();
  return results.map((r) => ({
    box: {
      x: r.detection.box.x * sx,
      y: r.detection.box.y * sy,
      width: r.detection.box.width * sx,
      height: r.detection.box.height * sy,
    } satisfies FaceBox,
    landmarks: extractLandmarks(r),
  }));
}

export interface PhotoFace extends DetectedFace {
  landmarks: LandmarkTrio | null;
}

function extractLandmarks(r: {
  landmarks: { positions: { x: number; y: number }[] };
}): LandmarkTrio | null {
  try {
    const positions = r.landmarks.positions;
    if (positions.length < 46) return null;
    return {
      leftEyeOuter: { x: positions[36].x, y: positions[36].y },
      rightEyeOuter: { x: positions[45].x, y: positions[45].y },
      noseTip: { x: positions[30].x, y: positions[30].y },
    };
  } catch {
    return null;
  }
}

/**
 * Detection over a still photo (enrollment path).
 * Runs at higher resolution than live video and also extracts the
 * landmark geometry used by quality assessment.
 *
 * The buffer is desaturated + contrast-lifted first so the enrolled
 * descriptor lives in the SAME colour/lighting-invariant space as the live
 * companion descriptors — that is what lets a photo taken in daylight match a
 * face recognised at night under a different lamp.
 */
export async function analyzePhotoCanvas(
  faceapi: FaceApiModule,
  canvas: HTMLCanvasElement,
): Promise<{ faces: PhotoFace[] }> {
  let source: HTMLCanvasElement | HTMLImageElement = canvas;
  if (typeof HTMLCanvasElement !== "undefined") {
    const gray = document.createElement("canvas");
    gray.width = canvas.width;
    gray.height = canvas.height;
    const gctx = gray.getContext("2d");
    if (gctx) {
      gctx.filter = "grayscale(1) contrast(1.08) brightness(1.02)";
      gctx.drawImage(canvas, 0, 0);
      gctx.filter = "none";
      source = gray;
    }
  }
  const results = await faceapi
    .detectAllFaces(
      source,
      new faceapi.TinyFaceDetectorOptions({
        inputSize: 512,
        scoreThreshold: recognitionConfig.detectionScoreThreshold,
      }),
    )
    .withFaceLandmarks()
    .withFaceDescriptors();

  const faces: PhotoFace[] = results.map((r) => ({
    box: {
      x: r.detection.box.x,
      y: r.detection.box.y,
      width: r.detection.box.width,
      height: r.detection.box.height,
    } satisfies FaceBox,
    descriptor: Array.from(r.descriptor),
    landmarks: extractLandmarks(r),
  }));
  return { faces };
}
