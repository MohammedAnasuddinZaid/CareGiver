"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, RefreshCcw, ScanFace, TriangleAlert, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { ENROLLMENT_REASONS, type EnrollmentFailureReason } from "@/lib/recognition/enrollment-reasons";
import { enrollFromUpload } from "@/lib/recognition/enrollment";
import type { PendingPhoto } from "./photo-dropzone";

type CaptureStatus = "closed" | "starting" | "ready" | "denied" | "no-device" | "in-use" | "error";

const STATUS_MESSAGES: Record<Exclude<CaptureStatus, "closed" | "ready">, { title: string; body: string }> = {
  starting: { title: "Preparing your camera…", body: "Allow access when your browser asks." },
  denied: {
    title: "Camera access is needed to take a photo.",
    body: "Allow camera permission in your browser settings, then try again.",
  },
  "no-device": { title: "We couldn’t find a camera.", body: "Connect a camera and try again." },
  "in-use": { title: "The camera is busy right now.", body: "Close other apps using it, then try again." },
  error: { title: "Something interrupted the camera.", body: "Give it another moment, then try again." },
};

/**
 * Live camera capture for recognition enrollment.
 * Frames are drawn to a local canvas and analyzed on-device — nothing is
 * uploaded, exactly like the file-upload path.
 */
export function CameraCapture({
  onPhoto,
  disabled = false,
}: {
  onPhoto: (photo: PendingPhoto) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<CaptureStatus>("starting");
  const [analyzing, setAnalyzing] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const { toast } = useToast();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) track.stop();
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const startCamera = useCallback(async () => {
    setStatus("starting");
    setFailure(null);
    stopCamera();
    const video = videoRef.current;
    if (!video || !navigator.mediaDevices?.getUserMedia) {
      setStatus("error");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      video.srcObject = stream;
      video.muted = true;
      video.playsInline = true;
      await video.play().catch(() => undefined);
      setStatus("ready");
    } catch (error) {
      streamRef.current = null;
      const name = error instanceof DOMException ? error.name : "";
      if (name === "NotAllowedError" || name === "SecurityError") setStatus("denied");
      else if (name === "NotFoundError" || name === "OverconstrainedError") setStatus("no-device");
      else if (name === "NotReadableError" || name === "TrackStartError") setStatus("in-use");
      else setStatus("error");
    }
  }, [stopCamera]);

  // Start when the dialog opens; always stop tracks on close or unmount.
  useEffect(() => {
    if (!open) return;
    void startCamera();
    return () => stopCamera();
  }, [open, startCamera, stopCamera]);

  async function capture() {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0 || analyzing) return;
    setAnalyzing(true);
    setFailure(null);
    try {
      const scale = Math.min(1, 1024 / Math.max(video.videoWidth, video.videoHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);
      canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("encode failed"))), "image/jpeg", 0.85),
      );
      const file = new File([blob], "camera-capture.jpg", { type: "image/jpeg" });
      const result = await enrollFromUpload(file);
      if (!result.ok) {
        const reason = ENROLLMENT_REASONS[result.reason as EnrollmentFailureReason];
        setFailure(`${reason.title} — ${reason.body}`);
        return;
      }
      const { makeThumb } = await import("@/lib/utils/image");
      const thumb = await makeThumb(canvas, 512).catch(() => "");
      onPhoto({
        id: `cam-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
        blob: result.blob,
        thumb,
        descriptor: result.descriptor,
      });
      // Advisory quality hints — the photo is already accepted.
      if (result.quality.warnings[0]) toast(result.quality.warnings[0], "info");
      setOpen(false);
    } catch (error) {
      setFailure(
        error instanceof Error && /model/i.test(error.message)
          ? "Recognition tools haven’t loaded yet. Check your connection once so they can be cached."
          : "This photo couldn’t be processed. Try again.",
      );
    } finally {
      setAnalyzing(false);
    }
  }

  const statusMessage = STATUS_MESSAGES[status as Exclude<CaptureStatus, "closed" | "ready">];

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          setFailure(null);
          setOpen(true);
        }}
        className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-full border border-line bg-surface px-6 py-3 text-lg font-semibold text-ink shadow-soft transition-all hover:border-accent hover:text-accent disabled:pointer-events-none disabled:opacity-50"
      >
        <Camera className="h-5 w-5" aria-hidden />
        Take a photo now
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Take a recognition photo"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              <X className="h-5 w-5" aria-hidden />
              Cancel
            </Button>
            <Button size="lg" onClick={() => void capture()} disabled={status !== "ready" || analyzing}>
              <ScanFace className="h-5 w-5" aria-hidden />
              {analyzing ? "Checking photo…" : "Capture"}
            </Button>
          </>
        }
      >
        <div className="relative overflow-hidden rounded-2xl bg-black">
          <video
            ref={videoRef}
            className={`aspect-video w-full object-cover ${status === "ready" ? "" : "invisible"}`}
            playsInline
            muted
            autoPlay
          />
          {status !== "ready" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
              {status === "starting" ? (
                <>
                  <Spinner className="text-teal-300" label="Starting camera" />
                  <p className="text-lg font-medium text-slate-200">{statusMessage.title}</p>
                </>
              ) : (
                <>
                  <TriangleAlert className="h-8 w-8 text-slate-300" aria-hidden />
                  <p className="text-lg font-semibold leading-snug text-white">{statusMessage.title}</p>
                  <p className="max-w-sm text-base text-slate-400">{statusMessage.body}</p>
                  <Button variant="onDark" onClick={() => void startCamera()}>
                    <RefreshCcw className="h-4 w-4" aria-hidden />
                    Try again
                  </Button>
                </>
              )}
            </div>
          )}
          {status === "ready" && !analyzing && (
            <span className="pointer-events-none absolute inset-x-8 top-1/2 h-[55%] -translate-y-1/2 rounded-[50%] border-2 border-dashed border-teal-300/50" aria-hidden />
          )}
          {analyzing && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/55 backdrop-blur-sm">
              <Spinner className="text-teal-200" label="Analyzing photo" />
            </div>
          )}
        </div>

        {failure && (
          <p role="alert" className="mt-4 flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-base font-medium text-amber-900">
            <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" aria-hidden />
            {failure}
          </p>
        )}

        <p className="mt-4 flex items-center gap-2 text-base text-ink-soft">
          <ScanFace className="h-4 w-4 text-accent" aria-hidden />
          Center one face in the oval, hold still, then press Capture.
          <span className="ml-auto inline-flex items-center gap-1 text-sm">
            Frames never leave this device.
          </span>
        </p>
      </Modal>
    </>
  );
}
