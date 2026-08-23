"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getPeople } from "@/lib/storage/profiles";
import type { PersonProfile } from "@/lib/types/person";
import { recognitionConfig, thresholdFor } from "@/lib/recognition/config";
import { detectFacesInVideo } from "@/lib/recognition/detector";
import {
  ensureModelsLoaded,
  getModelError,
  getModelStatus,
  onModelStatus,
  type ModelStatus,
} from "@/lib/recognition/model-manager";
import { identifyFace, selectPrimaryFace } from "@/lib/recognition/matching";
import { IdentityStabilizer } from "@/lib/recognition/stabilizer";
import { SpeechGuide } from "@/lib/speech/speech-service";
import { spokenIdentityPhrase } from "@/lib/utils/format";
import { useCamera, type CameraStatus } from "./use-camera";
import { useSettings } from "./use-settings";

export type StableKind = "recognized" | "unknown" | "identifying";

export interface DebugStats {
  latencyMs: number;
  samplesPerSecond: number;
  faceCount: number;
  distance: number | null;
  threshold: number;
}

interface RecognitionArgs {
  active: boolean;
}

/**
 * Central Companion Mode controller:
 *
 * camera frame → face detection → descriptors → local matching
 *   → threshold rejection ("unknown" wins over wrong identity)
 *   → temporal stabilization (no flicker) → UI state + voice
 *
 * Inference runs on a scheduler (~4/sec), never overlapping itself, and
 * pauses while the tab is hidden. All processing stays on this device.
 */
export function useRecognition({ active }: RecognitionArgs) {
  const { settings } = useSettings();
  const { videoRef, status: cameraStatus, errorKind, retry: retryCamera } = useCamera(active);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stabilizerRef = useRef<IdentityStabilizer>(new IdentityStabilizer(recognitionConfig));
  const speechRef = useRef<SpeechGuide>(new SpeechGuide());
  const busyRef = useRef(false);
  const stopRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastDrawRef = useRef<{ videoW: number; videoH: number }>({ videoW: 0, videoH: 0 });
  const lastUiKeyRef = useRef<string>("");
  const latencyAvgRef = useRef<number | null>(null);
  const lastDebugPushRef = useRef(0);

  const [modelStatus, setModelStatus] = useState<ModelStatus>("idle");
  const [modelAttempt, setModelAttempt] = useState(0);
  const [stableKind, setStableKind] = useState<StableKind>("identifying");
  const [person, setPerson] = useState<PersonProfile | null>(null);
  const [faceCount, setFaceCount] = useState(0);
  const [people, setPeople] = useState<PersonProfile[]>([]);
  const [debug, setDebug] = useState<DebugStats | null>(null);

  const threshold = thresholdFor(settings.sensitivity);
  const peopleByIdRef = useRef<Map<string, PersonProfile>>(new Map());
  peopleByIdRef.current = useMemo(
    () => new Map(people.map((p) => [p.id, p])),
    [people],
  );

  const refreshPeople = useCallback(async () => {
    try {
      setPeople(await getPeople());
    } catch {
      // storage unavailable — companion still runs, everything reads unknown
    }
  }, []);

  // Load + track local profiles.
  useEffect(() => {
    void refreshPeople();
    const onFocus = () => void refreshPeople();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refreshPeople]);

  // Voice configuration follows settings live.
  useEffect(() => {
    speechRef.current.configure(settings.voiceEnabled, settings.speechRate);
  }, [settings.voiceEnabled, settings.speechRate]);

  // Model status subscription + loading trigger.
  useEffect(() => {
    setModelStatus(getModelStatus());
    const off = onModelStatus(setModelStatus);
    if (!active) return () => {
      off();
    };
    ensureModelsLoaded().catch(() => {
      // status already flipped to "error"; UI offers retry
    });
    return () => {
      off();
    };
  }, [active, modelAttempt]);

  // The recognition loop.
  useEffect(() => {
    if (!active || !settings.recognitionEnabled || cameraStatus !== "ready") return;
    stopRef.current = false;
    let samplesWindow: number[] = [];

    const drawBoxes = (
      boxes: { box: DOMRectLike; matched: boolean }[],
    ) => {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      if (!canvas || !video) return;
      const vw = video.videoWidth;
      const vh = video.videoHeight;
      if (!vw || !vh) return;
      if (lastDrawRef.current.videoW !== vw || lastDrawRef.current.videoH !== vh) {
        canvas.width = vw;
        canvas.height = vh;
        lastDrawRef.current = { videoW: vw, videoH: vh };
      }
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, vw, vh);
      const lw = Math.max(3, Math.round(vw / 320));
      for (const { box, matched } of boxes) {
        ctx.lineWidth = lw;
        ctx.strokeStyle = matched ? "rgba(94, 234, 212, 0.9)" : "rgba(226, 232, 240, 0.55)";
        roundRectPath(ctx, box.x, box.y, box.width, box.height, Math.round(lw * 3));
        ctx.stroke();
      }
    };

    const tick = async () => {
      if (stopRef.current) return;
      if (document.hidden || busyRef.current) {
        scheduleNext();
        return;
      }
      const video = videoRef.current;
      if (!video || video.readyState < 2 || video.videoWidth === 0) {
        scheduleNext();
        return;
      }
      busyRef.current = true;
      try {
        const faceapi = await ensureModelsLoaded();
        if (stopRef.current) return;

        const t0 = performance.now();
        const faces = await detectFacesInVideo(faceapi, video);
        const latency = performance.now() - t0;
        latencyAvgRef.current =
          latencyAvgRef.current === null
            ? latency
            : latencyAvgRef.current * 0.8 + latency * 0.2;

        const identified = faces.map((face) => {
          const match = identifyFace(face.descriptor, people, threshold);
          return { box: face.box, matched: match.status === "recognized", personId: match.personId, distance: match.distance };
        });

        drawBoxes(identified);

        const now = performance.now();
        let nextKind: StableKind;
        let nextPersonId: string | null = null;

        if (faces.length === 0) {
          const s = stabilizerRef.current.observeNoFace(now);
          nextKind = s.kind;
          nextPersonId = s.personId;
        } else {
          const primaryIndex = selectPrimaryFace(identified);
          const primary = identified[primaryIndex];
          const observation =
            primary.matched && primary.personId ? primary.personId : ("unknown" as const);
          const s = stabilizerRef.current.observe(observation, now);
          nextKind = s.kind;
          nextPersonId = s.personId;
        }

        // Resolve profile + speak ONLY on stable transitions.
        const uiKey = `${nextKind}:${nextPersonId ?? ""}`;
        const nextPerson = nextPersonId ? peopleByIdRef.current.get(nextPersonId) ?? null : null;
        if (uiKey !== lastUiKeyRef.current) {
          lastUiKeyRef.current = uiKey;
          setStableKind(nextKind);
          setPerson(nextPerson);
          setFaceCount(faces.length);
          if (nextKind === "recognized" && nextPerson) {
            const spoke = speechRef.current.announce(
              nextPerson.id,
              spokenIdentityPhrase(nextPerson.name, nextPerson.relationship),
            );
            if (spoke && settings.soundCues) speechRef.current.playCue();
          }
          if (nextKind !== "recognized") speechRef.current.cancel();
        }

        // Throttled debug push.
        const ts = Date.now();
        if (ts - lastDebugPushRef.current > 500) {
          lastDebugPushRef.current = ts;
          samplesWindow.push(ts);
          samplesWindow = samplesWindow.filter((t) => ts - t <= 4000);
          setDebug({
            latencyMs: Math.round(latencyAvgRef.current ?? latency),
            samplesPerSecond: samplesWindow.length / 4,
            faceCount: faces.length,
            distance: identified.find((f) => f.distance != null)?.distance ?? null,
            threshold,
          });
        }
      } catch {
        // One failed frame must never kill the loop.
      } finally {
        busyRef.current = false;
        scheduleNext();
      }
    };

    function scheduleNext() {
      if (stopRef.current) return;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(tick, recognitionConfig.sampleIntervalMs);
    }

    void tick();

    const onVisibility = () => {
      if (!document.hidden) void tick();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      stopRef.current = true;
      if (timerRef.current) clearTimeout(timerRef.current);
      document.removeEventListener("visibilitychange", onVisibility);
      stabilizerRef.current.reset();
      speechRef.current.reset();
      lastUiKeyRef.current = "";
      const canvas = canvasRef.current;
      canvas?.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
    };
  }, [active, cameraStatus, people, threshold, settings.soundCues, settings.recognitionEnabled]);

  const retryModels = useCallback(() => {
    setModelStatus(getModelStatus());
    setModelAttempt((a) => a + 1);
    ensureModelsLoaded().catch(() => undefined);
  }, []);

  const modelError = modelStatus === "error" ? getModelError() : null;

  return {
    videoRef,
    canvasRef,
    modelStatus,
    modelError,
    retryModels,
    cameraStatus,
    cameraErrorKind: errorKind,
    retryCamera,
    stableKind,
    person,
    faceCount,
    peopleCount: people.filter((p) => p.descriptors.length > 0).length,
    debug,
  };
}

interface DOMRectLike {
  x: number;
  y: number;
  width: number;
  height: number;
}

function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}
