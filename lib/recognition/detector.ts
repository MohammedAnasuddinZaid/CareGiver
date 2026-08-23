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

/** Live detection + descriptors for every face in the frame. */
export async function detectFacesInVideo(
  faceapi: FaceApiModule,
  video: HTMLVideoElement,
  inputSize: number = recognitionConfig.detectionInputSize,
): Promise<DetectedFace[]> {
  const results = await faceapi
    .detectAllFaces(video, videoOptions(faceapi, inputSize))
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
 */
export async function analyzePhotoCanvas(
  faceapi: FaceApiModule,
  canvas: HTMLCanvasElement,
): Promise<{ faces: PhotoFace[] }> {
  const results = await faceapi
    .detectAllFaces(
      canvas,
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
