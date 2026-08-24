/**
 * Singleton loader for face-api.js models.
 * - Models are bundled in /public/models and load over HTTP once, then live
 *   in the service-worker cache (offline after first visit).
 * - Initialization is memoized so React re-renders never reload weights.
 */

export type ModelStatus = "idle" | "loading" | "ready" | "error";

export type FaceApiModule = typeof import("@vladmandic/face-api");

interface TfLike {
  setBackend?: (backend: string) => Promise<boolean>;
  ready?: () => Promise<void>;
}

let statusValue: ModelStatus = "idle";
let errorMessage: string | null = null;
let loadPromise: Promise<FaceApiModule> | null = null;
const listeners = new Set<(status: ModelStatus) => void>();

function setStatus(next: ModelStatus): void {
  statusValue = next;
  listeners.forEach((fn) => fn(next));
}

export const MODEL_BASE_URL = "/models";

export function getModelStatus(): ModelStatus {
  return statusValue;
}

export function getModelError(): string | null {
  return errorMessage;
}

export function onModelStatus(fn: (status: ModelStatus) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

async function importFaceApi(): Promise<FaceApiModule> {
  return import("@vladmandic/face-api");
}

/**
 * Compiles WebGL kernels before the first real camera frame.
 * Without this, the first live inference pays a one-time shader JIT cost
 * of 0.5–2 s — dead time the user experiences as "it's not recognising".
 * Best-effort: any failure here is invisible and harmless.
 */
async function warmUpKernels(faceapi: FaceApiModule): Promise<void> {
  if (typeof document === "undefined") return;
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 160;
    canvas.height = 120;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#1f2430";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await faceapi.detectAllFaces(
      canvas,
      new faceapi.TinyFaceDetectorOptions({ inputSize: 160, scoreThreshold: 0.5 }),
    );
  } catch {
    // Warmup is an optimization, never a requirement.
  }
}

export async function ensureModelsLoaded(): Promise<FaceApiModule> {
  if (statusValue === "ready" && loadPromise) return loadPromise;
  if (!loadPromise) {
    loadPromise = (async () => {
      setStatus("loading");
      try {
        const faceapi = await importFaceApi();
        try {
          // Prefer WebGL; silently fall back to CPU where unavailable.
          const tf = faceapi.tf as unknown as TfLike | undefined;
          await tf?.setBackend?.("webgl");
          await tf?.ready?.();
        } catch {
          const tf = faceapi.tf as unknown as TfLike | undefined;
          try {
            await tf?.setBackend?.("cpu");
            await tf?.ready?.();
          } catch {
            // backend default still works for tiny models
          }
        }
        await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_BASE_URL);
        await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_BASE_URL);
        await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_BASE_URL);
        await warmUpKernels(faceapi);
        setStatus("ready");
        errorMessage = null;
        return faceapi;
      } catch (error) {
        errorMessage =
          error instanceof Error ? error.message : "Unknown model loading failure";
        setStatus("error");
        loadPromise = null;
        throw error;
      }
    })();
  }
  return loadPromise;
}
