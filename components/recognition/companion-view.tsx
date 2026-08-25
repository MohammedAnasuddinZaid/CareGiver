"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import clsx from "clsx";
import {
  ArrowLeft,
  CameraOff,
  Lock,
  RefreshCcw,
  ScanFace,
  ShieldAlert,
  Volume2,
  VolumeX,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/empty-state";
import { useRecognition, type StableKind } from "@/hooks/use-recognition";
import { useSettings } from "@/hooks/use-settings";

const CAMERA_MESSAGES = {
  denied: {
    title: "Camera access is needed for Companion Mode.",
    body: "Allow camera access in your browser settings, then try again.",
  },
  "no-device": {
    title: "We couldn’t find a camera.",
    body: "Connect a camera and try again.",
  },
  "in-use": {
    title: "The camera is busy right now.",
    body: "Close other apps using it, then try again.",
  },
  ended: {
    title: "The camera stopped unexpectedly.",
    body: "It may have been unplugged or used by another app. Try again when you're ready.",
  },
  insecure: {
    title: "Camera needs a secure connection.",
    body: "Open MemoryAssist over HTTPS or on localhost.",
  },
  unsupported: {
    title: "Camera recognition isn’t supported in this browser.",
    body: "Try a recent version of Chrome, Edge, or Firefox.",
  },
  error: {
    title: "Something interrupted the camera.",
    body: "Give it another moment, then try again.",
  },
} as const;

export function CompanionView() {
  const {
    videoRef,
    canvasRef,
    modelStatus,
    modelError,
    retryModels,
    cameraStatus,
    retryCamera,
    stableKind,
    person,
    faceCount,
    peopleCount,
    debug,
  } = useRecognition({ active: true });
  const { settings, update } = useSettings();

  // Keep the screen calm & awake during companion use where supported.
  useEffect(() => {
    let lock: WakeLockSentinel | null = null;
    const nav = navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<WakeLockSentinel> } };
    if (!nav.wakeLock) return;
    nav.wakeLock
      .request("screen")
      .then((l) => (lock = l))
      .catch(() => undefined);
    return () => {
      void lock?.release().catch(() => undefined);
    };
  }, []);

  return (
    <div className="relative mx-auto flex h-[100dvh] max-w-4xl flex-col px-4 pb-6 pt-4">
      {/* Top bar */}
      <header className="flex items-center justify-between gap-3 text-white">
        <Link
          href="/"
          className="inline-flex min-h-[48px] items-center gap-2 rounded-full bg-white/10 px-5 py-2.5 text-base font-semibold backdrop-blur transition-colors hover:bg-white/20"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden />
          Exit
        </Link>
        <p className="text-lg font-bold tracking-tight">
          Memory<span className="text-teal-300">Assist</span>
        </p>
        <button
          type="button"
          onClick={() => update({ voiceEnabled: !settings.voiceEnabled })}
          aria-pressed={settings.voiceEnabled}
          aria-label={settings.voiceEnabled ? "Mute voice guidance" : "Unmute voice guidance"}
          className="inline-flex min-h-[48px] min-w-[48px] items-center justify-center rounded-full bg-white/10 p-3 backdrop-blur transition-colors hover:bg-white/20"
        >
          {settings.voiceEnabled ? (
            <Volume2 className="h-5 w-5 text-teal-300" aria-hidden />
          ) : (
            <VolumeX className="h-5 w-5 opacity-70" aria-hidden />
          )}
        </button>
      </header>

      {/* Camera stage */}
      <div className="relative mt-4 flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-[2rem] border border-white/10 bg-black shadow-lift">
        <video
          ref={videoRef}
          className={clsx(
            "h-full w-full object-cover",
            cameraStatus !== "ready" && "invisible",
          )}
          playsInline
          muted
          autoPlay
        />
        {/* object-cover on BOTH layers guarantees box coordinates map 1:1
            even when the stage's aspect ratio differs from the camera's —
            without it, portrait screens stretched the overlay and misaligned
            every bracket and label. */}
        <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full object-cover" />

        {/* Scanning sweep while identifying */}
        {cameraStatus === "ready" && modelStatus === "ready" && stableKind === "identifying" && (
          <div aria-hidden className="scan-sweep" />
        )}

        {/* Privacy chip */}
        <span className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-full bg-black/45 px-3.5 py-1.5 text-sm font-medium text-teal-200 backdrop-blur">
          <Lock className="h-3.5 w-3.5" aria-hidden />
          Processing stays on this device
        </span>

        {/* Overlays for non-ready states */}
        {cameraStatus !== "ready" && <CameraOverlay status={cameraStatus} onRetry={retryCamera} />}
        {cameraStatus === "ready" && modelStatus !== "ready" && (
          <ModelOverlay status={modelStatus} error={modelError} onRetry={retryModels} />
        )}
      </div>

      {/* Identity area */}
      <div className="mt-5 flex min-h-[190px] items-center justify-center rounded-[2rem] border border-white/10 bg-night-card/90 p-6 text-center backdrop-blur md:min-h-[210px]">
        {cameraStatus === "ready" && modelStatus === "ready" ? (
          <IdentityArea kind={stableKind} personName={person?.name ?? null} personRelationship={person?.relationship ?? null} description={person?.description ?? null} />
        ) : (
          <p className="text-xl font-medium text-slate-300">Preparing your camera…</p>
        )}
      </div>

      {/* Footer hints */}
      <footer className="mt-3 flex items-center justify-between text-sm text-slate-400">
        <span>
          {peopleCount === 0
            ? "No familiar people enrolled yet — ask your caregiver to add someone."
            : `${peopleCount} familiar ${peopleCount === 1 ? "person" : "people"} on this device`}
        </span>
        {settings.developerMode && debug && (
          <DebugStats data={debug} faceCount={faceCount} />
        )}
      </footer>
    </div>
  );
}

function IdentityArea({
  kind,
  personName,
  personRelationship,
  description,
}: {
  kind: StableKind;
  personName: string | null;
  personRelationship: string | null;
  description: string | null;
}) {
  const key =
    kind === "recognized" && personName ? `recognized:${personName}` : kind;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={key}
        initial={{ opacity: 0, y: 18, scale: 0.96, filter: "blur(6px)" }}
        animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
        exit={{ opacity: 0, y: -12, scale: 0.98, filter: "blur(4px)" }}
        transition={
          kind === "recognized"
            ? { type: "spring", stiffness: 260, damping: 24, mass: 0.9 }
            : { duration: 0.28, ease: [0.22, 1, 0.36, 1] }
        }
        className="text-center"
      >
        {kind === "recognized" && personName ? (
          <>
            <p className="identity-name text-gradient font-bold leading-tight tracking-tight">{personName}</p>
            <p className="identity-relation mt-1 font-semibold text-teal-300">{relationshipLine(personRelationship)}</p>
            {description && (
              <p className="identity-description mt-3 leading-snug text-slate-300">“{description}”</p>
            )}
            <motion.p
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.18, type: "spring", stiffness: 300, damping: 20 }}
              className="ping-ring mt-4 inline-flex items-center gap-2 rounded-full bg-emerald-500/15 px-4 py-1.5 text-base font-semibold text-emerald-300"
            >
              <span className="h-2 w-2 rounded-full bg-emerald-400" aria-hidden />
              Recognized
            </motion.p>
          </>
        ) : kind === "unknown" ? (
          <>
            <p className="text-2xl font-semibold leading-relaxed text-slate-200 md:text-3xl">
              I don’t recognize this person yet.
            </p>
            <p className="mt-2 text-lg text-slate-400">A caregiver can add them to your trusted circle.</p>
          </>
        ) : (
          <>
            <p className="text-2xl font-semibold text-slate-200 md:text-3xl">Looking for someone familiar…</p>
            <p className="mt-2 text-lg text-slate-400">Move into view when you’re ready.</p>
          </>
        )}
      </motion.div>
    </AnimatePresence>
  );
}

function relationshipLine(relationship: string | null): string {
  if (!relationship) return "";
  const t = relationship.trim();
  const lower = t.toLowerCase();
  if (lower.startsWith("your ") || lower.startsWith("my ") || lower.startsWith("our ")) {
    return t.charAt(0).toUpperCase() + t.slice(1);
  }
  return `Your ${t.charAt(0).toUpperCase()}${t.slice(1)}`;
}

function CameraOverlay({
  status,
  onRetry,
}: {
  status: string;
  onRetry: () => void;
}) {
  if (status === "starting") {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-center">
        <Spinner className="text-teal-300" label="Starting camera" />
        <p className="text-xl font-medium text-slate-200">Preparing your camera…</p>
      </div>
    );
  }
  const msg =
    CAMERA_MESSAGES[status as keyof typeof CAMERA_MESSAGES] ?? CAMERA_MESSAGES.error;
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-8 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/10">
        <CameraOff className="h-8 w-8 text-slate-300" aria-hidden />
      </span>
      <p className="max-w-md text-2xl font-semibold leading-snug text-white">{msg.title}</p>
      <p className="max-w-md text-lg text-slate-400">{msg.body}</p>
      <Button variant="onDark" size="lg" className="mt-3" onClick={onRetry}>
        <RefreshCcw className="h-5 w-5" aria-hidden />
        Try again
      </Button>
    </div>
  );
}

function ModelOverlay({
  status,
  error,
  onRetry,
}: {
  status: string;
  error: string | null;
  onRetry: () => void;
}) {
  if (status === "error") {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-8 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-rose-500/20">
          <ShieldAlert className="h-8 w-8 text-rose-300" aria-hidden />
        </span>
        <p className="text-2xl font-semibold text-white">Recognition couldn’t be started.</p>
        <p className="max-w-md text-lg text-slate-400">
          Check that the required recognition files are available and try again.
        </p>
        <div className="mt-2 flex gap-3">
          <Button variant="onDark" size="lg" onClick={onRetry}>
            <RefreshCcw className="h-5 w-5" aria-hidden />
            Try again
          </Button>
          <Link
            href="/"
            className="inline-flex min-h-[52px] items-center rounded-full border border-white/20 px-7 py-3.5 text-lg font-semibold text-slate-300 hover:bg-white/10"
          >
            Return home
          </Link>
        </div>
        {error && <p className="mt-2 max-w-md text-xs text-slate-500">{error}</p>}
      </div>
    );
  }
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-center">
      <ScanFace className="h-12 w-12 animate-pulse-soft text-teal-300" aria-hidden />
      <p className="text-xl font-medium text-slate-200">Preparing recognition…</p>
      <p className="text-base text-slate-400">Loading local tools — this may take a moment.</p>
    </div>
  );
}

/** Developer-only diagnostics; hidden unless developerMode is enabled in Settings. */
function DebugStats({ data, faceCount }: { data: NonNullable<ReturnType<typeof useRecognition>["debug"]>; faceCount: number }) {
  return (
    <span className="hidden gap-3 font-mono text-xs sm:inline-flex" aria-hidden>
      <span>{Math.round(data.latencyMs)}ms</span>
      <span>{data.samplesPerSecond.toFixed(1)}/s</span>
      <span>tier:{data.perfTier}</span>
      <span>faces:{faceCount}</span>
      <span>c:{data.confidence.toFixed(2)}</span>
      <span>
        d:{data.distance != null ? data.distance.toFixed(3) : "—"} / θ{data.threshold.toFixed(2)}
      </span>
      {data.margin != null && <span>Δ{data.margin.toFixed(3)}</span>}
      {data.rejectedBy !== "threshold" && data.rejectedBy !== "ambiguity" && (
        <span className="text-amber-400">{data.rejectedBy}</span>
      )}
    </span>
  );
}
