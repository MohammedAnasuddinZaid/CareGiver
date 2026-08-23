"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  classifyCameraError,
  startCamera,
  stopStream,
  type CameraErrorKind,
} from "@/lib/camera/camera-service";

export type CameraStatus =
  | "idle"
  | "starting"
  | "ready"
  | "denied"
  | "no-device"
  | "in-use"
  | "insecure"
  | "unsupported"
  | "error";

export function useCamera(active: boolean) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<CameraStatus>("idle");
  const [errorKind, setErrorKind] = useState<CameraErrorKind | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!active) {
      stopStream(streamRef.current);
      streamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
      setStatus("idle");
      return;
    }
    let cancelled = false;

    // Camera vanished mid-session (unplugged / revoked): surface a
    // recoverable error instead of silently freezing the frame.
    const onEnded = () => {
      if (cancelled) return;
      stopStream(streamRef.current);
      streamRef.current = null;
      setErrorKind("ended");
      setStatus("error");
    };

    (async () => {
      setStatus("starting");
      setErrorKind(null);
      stopStream(streamRef.current);
      streamRef.current = null;
      const video = videoRef.current;
      if (!video) return;
      const { stream, errorKind: kind } = await startCamera(video, { onEnded });
      if (cancelled) {
        stopStream(stream);
        return;
      }
      if (!stream || kind) {
        setStatus(
          kind === "denied"
            ? "denied"
            : kind === "no-device"
              ? "no-device"
              : kind === "in-use"
                ? "in-use"
                : kind === "insecure"
                  ? "insecure"
                  : kind === "unsupported"
                    ? "unsupported"
                    : "error",
        );
        setErrorKind(kind ?? classifyCameraError(new Error("unknown")));
        if (stream) stopStream(stream);
        return;
      }
      streamRef.current = stream;
      setStatus("ready");
    })();

    return () => {
      cancelled = true;
      stopStream(streamRef.current);
      streamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, [active, attempt]);

  /** Re-runs getUserMedia after a permission/device problem. */
  const retry = useCallback(() => setAttempt((a) => a + 1), []);

  return { videoRef, status, errorKind, retry };
}
