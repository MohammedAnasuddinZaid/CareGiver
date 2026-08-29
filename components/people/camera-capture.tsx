"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, RefreshCcw, ScanFace, TriangleAlert, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { ENROLLMENT_REASONS, type EnrollmentFailureReason } from "@/lib/recognition/enrollment-reasons";
import { enrollFromUpload } from "@/lib/recognition/enrollment";
import { detectFacesInVideoLite } from "@/lib/recognition/detector";
import { ensureModelsLoaded, type FaceApiModule } from "@/lib/recognition/model-manager";
import type { PendingPhoto } from "./photo-dropzone";

type CaptureStatus = "closed" | "starting" | "ready" | "denied" | "no-device" | "in-use" | "error";
type Guide = "searching" | "center" | "closer" | "back" | "steady" | "capturing" | "one";

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

const GUIDE_TEXT: Record<Guide, string> = {
  searching: "Looking for a face…",
  center: "Center your face in the circle",
  closer: "Move a little closer",
  back: "Move back so your whole face fits",
  steady: "Hold still…",
  capturing: "Capturing…",
  one: "Please keep only one face in frame",
};

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * Live camera capture for recognition enrollment.
 * Frames are drawn to a local canvas and analyzed on-device — nothing is
 * uploaded, exactly like the file-upload path. Adds a live alignment guide,
 * adaptive exposure/colour grading for harsh lighting, and automatic capture
 * once the face is framed and steady (so it takes the fewest tries).
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
  const [guide, setGuide] = useState<Guide>("searching");
  const { toast } = useToast();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const faceapiRef = useRef<FaceApiModule | null>(null);
  const analyzingRef = useRef(false);
  const autoRef = useRef(false);
  // Smoothed brightness factor (1 = untouched) applied as a live preview filter
  // and baked into the captured frame so bright/dark scenes still grade well.
  const exposureRef = useRef(1);
  const sampleCanvasRef = useRef<HTMLCanvasElement | null>(null);
  // Generation counter: closing (or restarting) invalidates any in-flight
  // getUserMedia, so a late-resolving permission prompt can never leave a
  // live camera attached to an unmounted <video> (privacy light stays on).
  const generationRef = useRef(0);

  const stopCamera = useCallback(() => {
    generationRef.current++;
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) track.stop();
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
      videoRef.current.style.filter = "";
    }
  }, []);

  const startCamera = useCallback(async () => {
    setStatus("starting");
    setFailure(null);
    setGuide("searching");
    // Invalidate any PREVIOUS attempt FIRST, then claim THIS one. Capturing
    // the generation before stopCamera() would self-cancel: stop bumps the
    // counter, the post-await check would see a mismatch forever and the
    // dialog stayed on "Preparing your camera…" indefinitely.
    stopCamera();
    const generation = ++generationRef.current;
    const video = videoRef.current;
    if (!video || !navigator.mediaDevices?.getUserMedia) {
      setStatus("error");
      return;
    }
    let watchdog: ReturnType<typeof setTimeout> | undefined;
    try {
      // Devices/permission prompts occasionally hang forever — race a
      // watchdog so the user always lands on a recoverable error screen
      // instead of an infinite spinner.
      const stream = await Promise.race([
        navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        }),
        new Promise<never>((_, reject) => {
          watchdog = setTimeout(
            () => reject(new DOMException("Camera start timed out", "TimeoutError")),
            15_000,
          );
        }),
      ]);
      clearTimeout(watchdog);
      if (generation !== generationRef.current) {
        for (const track of stream.getTracks()) track.stop();
        return;
      }
      streamRef.current = stream;
      video.srcObject = stream;
      video.muted = true;
      video.playsInline = true;
      await video.play().catch(() => undefined);
      if (generation !== generationRef.current) {
        for (const track of stream.getTracks()) track.stop();
        if (streamRef.current === stream) streamRef.current = null;
        return;
      }
      setStatus("ready");
    } catch (error) {
      clearTimeout(watchdog);
      if (generation !== generationRef.current) return;
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
    // Warm the recognition models IN PARALLEL with the camera warm-up so
    // the first detection runs instantly instead of waiting on a
    // multi-MB download (single-flight loader — no double fetch).
    void ensureModelsLoaded()
      .then((m) => {
        faceapiRef.current = m;
      })
      .catch(() => undefined);
    return () => stopCamera();
  }, [open, startCamera, stopCamera]);

  const capture = useCallback(async () => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0 || analyzingRef.current) return;
    analyzingRef.current = true;
    setAnalyzing(true);
    setFailure(null);
    try {
      const factor = exposureRef.current;
      const scale = Math.min(1, 1024 / Math.max(video.videoWidth, video.videoHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);
      const ctx = canvas.getContext("2d");
      if (ctx) {
        // Bake the same adaptive exposure/colour grade used for the live
        // preview into the saved frame so bright or dim rooms still produce a
        // usable, balanced photo for enrollment.
        ctx.filter = `brightness(${factor.toFixed(3)}) contrast(1.08) saturate(1.06)`;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        ctx.filter = "none";
      }
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
      analyzingRef.current = false;
      setAnalyzing(false);
    }
  }, [onPhoto, toast]);

  // Live alignment guide + adaptive exposure. Runs only while the camera is
  // ready, and tears down cleanly on close/unmount.
  useEffect(() => {
    if (status !== "ready") return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let steady = 0;
    let last: { x: number; y: number; width: number; height: number } | null = null;
    if (!sampleCanvasRef.current) {
      const c = document.createElement("canvas");
      c.width = 80;
      c.height = 60;
      sampleCanvasRef.current = c;
    }
    const sctx = sampleCanvasRef.current.getContext("2d", { willReadFrequently: true });

    const tick = async () => {
      if (cancelled) return;
      const video = videoRef.current;
      if (video && video.videoWidth > 0) {
        // --- Adaptive exposure / colour grade (cheap, runs every frame) ---
        if (sctx) {
          sctx.drawImage(video, 0, 0, 80, 60);
          const d = sctx.getImageData(0, 0, 80, 60).data;
          let sum = 0;
          for (let i = 0; i < d.length; i += 4) sum += (d[i] + d[i + 1] + d[i + 2]) / 3;
          const avg = sum / (d.length / 4) / 255;
          // Aim for a mid-bright frame; clamp generously so very dark/backlit
          // rooms still get lifted enough for the detector to read the face.
          const target = 0.5;
          const desired = clamp(target / (avg || 0.001), 0.8, 1.6);
          exposureRef.current =
            exposureRef.current === 1 ? desired : 0.82 * exposureRef.current + 0.18 * desired;
          video.style.filter = `brightness(${exposureRef.current.toFixed(3)}) contrast(1.08) saturate(1.06)`;
        }

        // --- Face alignment guide ---
        const faceapi = faceapiRef.current;
        if (faceapi) {
          try {
            // Detect on a downscaled, brightness-lifted buffer so grainy /
            // dim / backlit frames still register — the preview filter alone
            // does NOT reach the model (CSS is cosmetic), so the lift must be
            // baked into the pixels we hand to detection.
            const faces = await detectFacesInVideoLite(faceapi, video, 256, {
              brightness: exposureRef.current,
              contrast: 1.08,
              saturate: 1.06,
              grayscale: true,
              maxWidth: 480,
            });
            if (faces.length === 0) {
              autoRef.current = false;
              setGuide("searching");
            } else if (faces.length > 1) {
              autoRef.current = false;
              setGuide("one");
            } else {
              const f = faces[0].box;
              const cw = video.videoWidth;
              const ch = video.videoHeight;
              const cx = (f.x + f.width / 2) / cw;
              const cy = (f.y + f.height / 2) / ch;
              const fh = f.height / ch;
              const aligned = Math.abs(cx - 0.5) < 0.07 && Math.abs(cy - 0.5) < 0.09;
              const sizeOk = fh > 0.2 && fh < 0.62;
              if (!sizeOk && fh <= 0.2) {
                autoRef.current = false;
                setGuide("closer");
              } else if (!sizeOk) {
                autoRef.current = false;
                setGuide("back");
              } else if (!aligned) {
                autoRef.current = false;
                setGuide("center");
              } else {
                const moved = last
                  ? Math.hypot((f.x - last.x) / cw, (f.y - last.y) / ch)
                  : 1;
                if (moved < 0.02) steady += 1;
                else steady = 0;
                last = f;
                if (steady >= 3) {
                  setGuide("capturing");
                  if (!autoRef.current) {
                    autoRef.current = true;
                    void capture();
                  }
                } else {
                  autoRef.current = false;
                  setGuide("steady");
                }
              }
            }
          } catch {
            autoRef.current = false;
            setGuide("searching");
          }
        }
      }
      if (!cancelled) timer = setTimeout(tick, 180);
    };
    void tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [status, capture]);

  const statusMessage = STATUS_MESSAGES[status as Exclude<CaptureStatus, "closed" | "ready">];
  const guideAligned = guide === "steady" || guide === "capturing";

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
        size="xl"
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

          {/* Large circular framing guide — the face should fill this. */}
          {status === "ready" && (
            <div className="pointer-events-none absolute left-1/2 top-1/2 h-[80%] aspect-square -translate-x-1/2 -translate-y-1/2">
              <div
                className={`h-full w-full rounded-full border-[3px] transition-colors duration-200 ${
                  guideAligned ? "border-teal-300" : "border-white/45"
                }`}
                aria-hidden
              />
            </div>
          )}

          {status === "ready" && !analyzing && (
            <div className="absolute inset-x-0 bottom-3 flex justify-center px-4">
              <span
                className={`pointer-events-none inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold backdrop-blur ${
                  guideAligned ? "bg-teal-400/90 text-night" : "bg-black/55 text-white"
                }`}
                aria-hidden
              >
                <span
                  className={`h-2 w-2 rounded-full ${guideAligned ? "animate-pulse bg-night" : "bg-white/80"}`}
                />
                {GUIDE_TEXT[guide]}
              </span>
            </div>
          )}

          {analyzing && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/55 backdrop-blur-sm">
              <Spinner className="text-teal-200" label="Analyzing photo" />
            </div>
          )}

          {/* Overlays for non-ready states */}
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
        </div>

        {failure && (
          <p role="alert" className="mt-4 flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-base font-medium text-amber-900">
            <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" aria-hidden />
            {failure}
          </p>
        )}

        <p className="mt-4 flex items-center gap-2 text-base text-ink-soft">
          <ScanFace className="h-4 w-4 text-accent" aria-hidden />
          Fill the circle with your face — we capture automatically once it’s framed and steady.
          <span className="ml-auto inline-flex items-center gap-1 text-sm">
            Frames never leave this device.
          </span>
        </p>
      </Modal>
    </>
  );
}
