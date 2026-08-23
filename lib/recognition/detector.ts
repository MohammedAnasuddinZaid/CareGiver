import { recognitionConfig } from "./config";
import type { DetectedFace } from "./types";
import type { FaceApiModule } from "./model-manager";

function options(faceapi: FaceApiModule) {
  return new faceapi.TinyFaceDetectorOptions({
    inputSize: recognitionConfig.detectionInputSize,
    scoreThreshold: recognitionConfig.detectionScoreThreshold,
  });
}

/** Live detection + descriptors for every face in the frame. */
export async function detectFacesInVideo(
  faceapi: FaceApiModule,
  video: HTMLVideoElement,
): Promise<DetectedFace[]> {
  const results = await faceapi
    .detectAllFaces(video, options(faceapi))
    .withFaceLandmarks()
    .withFaceDescriptors();
  return results.map((r) => ({
    box: {
      x: r.detection.box.x,
      y: r.detection.box.y,
      width: r.detection.box.width,
      height: r.detection.box.height,
    },
    descriptor: Array.from(r.descriptor),
  }));
}

export interface SinglePhotoAnalysis {
  faces: DetectedFace[];
}

/**
 * Detection over a still photo (enrollment path).
 * Runs on the downscaled canvas produced by prepareUpload().
 */
export async function analyzePhotoCanvas(
  faceapi: FaceApiModule,
  canvas: HTMLCanvasElement,
): Promise<SinglePhotoAnalysis> {
  const results = await faceapi
    .detectAllFaces(canvas, new faceapi.TinyFaceDetectorOptions({
      inputSize: 512,
      scoreThreshold: recognitionConfig.detectionScoreThreshold,
    }))
    .withFaceLandmarks()
    .withFaceDescriptors();
  return {
    faces: results.map((r) => ({
      box: {
        x: r.detection.box.x,
        y: r.detection.box.y,
        width: r.detection.box.width,
        height: r.detection.box.height,
      },
      descriptor: Array.from(r.descriptor),
    })),
  };
}
