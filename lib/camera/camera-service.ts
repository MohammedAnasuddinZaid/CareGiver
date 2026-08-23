export type CameraErrorKind =
  | "denied"
  | "no-device"
  | "in-use"
  | "insecure"
  | "unsupported"
  | "ended"
  | "unknown";

export function classifyCameraError(error: unknown): CameraErrorKind {
  if (error instanceof DOMException) {
    switch (error.name) {
      case "NotAllowedError":
      case "SecurityError":
        return "denied";
      case "NotFoundError":
      case "OverconstrainedError":
        return "no-device";
      case "NotReadableError":
      case "TrackStartError":
        return "in-use";
      case "AbortError":
        return "unknown";
      default:
        return "unknown";
    }
  }
  if (typeof window !== "undefined" && !window.isSecureContext) return "insecure";
  if (typeof navigator !== "undefined" && !navigator.mediaDevices) return "unsupported";
  return "unknown";
}

export interface CameraStartResult {
  stream: MediaStream | null;
  errorKind: CameraErrorKind | null;
}

/**
 * Starts the local camera. Frames are consumed in-page only — this module
 * contains no upload, streaming, or analytics code by design.
 *
 * `onEnded` fires when the camera disappears mid-session (unplugged,
 * revoked by the OS, killed by another app) so the UI can recover.
 */
export async function startCamera(
  video: HTMLVideoElement,
  hooks: { onEnded?: () => void } = {},
): Promise<CameraStartResult> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    return { stream: null, errorKind: "unsupported" };
  }
  if (!window.isSecureContext) {
    return { stream: null, errorKind: "insecure" };
  }

  const constraints: MediaStreamConstraints = {
    video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
    audio: false,
  };

  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia(constraints);
  } catch (firstError) {
    // Some devices reject ideal constraints — retry once, plainly.
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    } catch (secondError) {
      void firstError;
      return { stream: null, errorKind: classifyCameraError(secondError) };
    }
  }

  const [track] = stream.getVideoTracks();
  if (track && hooks.onEnded) {
    track.onended = () => hooks.onEnded?.();
  }

  video.srcObject = stream;
  video.muted = true;
  video.playsInline = true;
  try {
    await video.play();
  } catch {
    // Autoplay refusal is harmless; user gesture already happened.
  }
  await new Promise<void>((resolve) => {
    if (video.readyState >= 2 && video.videoWidth > 0) return resolve();
    const onReady = () => resolve();
    video.addEventListener("loadeddata", onReady, { once: true });
    setTimeout(resolve, 3000);
  });
  return { stream, errorKind: null };
}

/** Stops every track and detaches handlers — mandatory when leaving camera UIs. */
export function stopStream(stream: MediaStream | null): void {
  if (!stream) return;
  for (const track of stream.getTracks()) {
    track.onended = null;
    track.stop();
  }
}
