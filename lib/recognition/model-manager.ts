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
