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
import { identifyFaceDetailed, selectPrimaryFace } from "@/lib/recognition/matching";
import { IdentityStabilizer } from "@/lib/recognition/stabilizer";
import { BoxTracker } from "@/lib/recognition/tracker";
import { PerfGovernor } from "@/lib/recognition/perf-governor";
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
  confidence: number;
  margin: number | null;
  rejectedBy: string;
  threshold: number;
  perfTier: number;
}

interface RecognitionArgs {
  active: boolean;
}

/**
 * Central Companion Mode controller:
 *
 * camera frame → adaptive-resolution face detection → descriptors
 *   → L2-normalized open-set matching (threshold + ambiguity margin)
 *   → IoU tracking with One-Euro-filtered boxes
 *   → decayed-evidence temporal stabilization with hysteresis
 *   → UI state + voice
 *
 * Inference runs on a scheduler (~4/sec), never overlaps itself, pauses
 * while the tab is hidden, and adapts its resolution tier to measured
 * latency. All processing stays on this device.
 */
export function useRecognition({ active }: RecognitionArgs) {
  const { settings } = useSettings();
  const { videoRef, status: cameraStatus, errorKind, retry: retryCamera } = useCamera(active);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stabilizerRef = useRef<IdentityStabilizer>(new IdentityStabilizer(recognitionConfig));
  const trackerRef = useRef<BoxTracker>(new BoxTracker(recognitionConfig.tracker));
  const governorRef = useRef<PerfGovernor>(new PerfGovernor(recognitionConfig.performance));
  const speechRef = useRef<SpeechGuide>(new SpeechGuide());
  const busyRef = useRef(false);
  const stopRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastDrawRef = useRef<{ videoW: number; videoH: number }>({ videoW: 0, videoH: 0 });
  const lastUiKeyRef = useRef<string>("");
  const latencyEwmaRef = useRef<number | null>(null);
  const samplesRef = useRef<number[]>([]);
  const lastDebugPushRef = useRef(0);

  const [modelStatus, setModelStatus] = useState<ModelStatus>("idle");
  const [modelAttempt, setModelAttempt] = useState(0);
  const [stableKind, setStableKind] = useState<StableKind>("identifying");
  const [person, setPerson] = useState<PersonProfile | null>(null);
  const [faceCount, setFaceCount] = useState(0);
  const [people, setPeople] = useState<PersonProfile[]>([]);
  const [debug, setDebug] = useState<DebugStats | null>(null);

  const threshold = thresholdFor(settings.sensitivity);

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

  const peopleById = useMemo(() => new Map(people.map((p) => [p.id, p])), [people]);

  // Voice configuration follows settings live.
  useEffect(() => {
    speechRef.current.configure(settings.voiceEnabled, settings.speechRate);
  }, [settings.voiceEnabled, settings.speechRate]);

  // Model status subscription + loading trigger.
  useEffect(() => {
    setModelStatus(getModelStatus());
    const off = onModelStatus(setModelStatus);
    if (!active)
      return () => {
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

    const drawTrackedBoxes = (
      boxes: { box: { x: number; y: number; width: number; height: number }; matched: boolean }[],
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
      const lw = Math.max(3, Math.round(vw / 300));
      for (const { box, matched } of boxes) {
        drawCornerBrackets(ctx, box.x, box.y, box.width, box.height, lw, matched);
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
        const faces = await detectFacesInVideo(faceapi, video, governorRef.current.inputSize);
        const latency = performance.now() - t0;
        latencyEwmaRef.current =
          latencyEwmaRef.current === null
            ? latency
            : recognitionConfig.performance.ewmaAlpha * latency +
              (1 - recognitionConfig.performance.ewmaAlpha) * latencyEwmaRef.current;
        governorRef.current.record(latency, t0);

        // Track across frames FIRST so boxes are smoothed and stable IDs exist.
        const tracked = trackerRef.current.update(
          faces.map((f) => f.box),
          t0,
        );

        // Match each detection independently, then re-attach by position:
        // the primary selection uses the smoothed tracked boxes.
        const identified = faces.map((face) => {
          const match = identifyFaceDetailed(face.descriptor, people, { threshold });
          return { box: face.box, matched: match.status === "recognized", personId: match.personId, confidence: match.confidence, distance: match.distance, margin: match.margin, rejectedBy: match.rejectedBy };
        });

        // Associate each smoothed track with its nearest detection's identity.
        const enriched = tracked.map((t) => {
          let bestIdx = -1;
          let bestDist = Infinity;
          for (let i = 0; i < faces.length; i++) {
            const d = Math.hypot(
              t.box.x + t.box.width / 2 - (faces[i].box.x + faces[i].box.width / 2),
              t.box.y + t.box.height / 2 - (faces[i].box.y + faces[i].box.height / 2),
            );
            if (d < bestDist) {
              bestDist = d;
              bestIdx = i;
            }
          }
          const m = bestIdx >= 0 ? identified[bestIdx] : null;
          return {
            box: t.box,
            hits: t.hits,
            matched: m?.matched ?? false,
            personId: m?.personId ?? null,
            confidence: m?.confidence ?? 0,
            distance: m?.distance ?? null,
            margin: m?.margin ?? null,
            rejectedBy: m?.rejectedBy ?? null,
          };
        });

        drawTrackedBoxes(enriched);

        const now = performance.now();
        let nextKind: StableKind;
        let nextPersonId: string | null = null;
        let bestObservation: { distance: number | null; confidence: number; margin: number | null; rejectedBy: string } = {
          distance: null,
          confidence: 0,
          margin: null,
          rejectedBy: "no-profiles",
        };

        if (faces.length === 0) {
          const s = stabilizerRef.current.observeNoFace(now);
          nextKind = s.kind;
          nextPersonId = s.personId;
        } else {
          const primaryIndex = selectPrimaryFace(enriched);
          const primary = enriched[primaryIndex];
          const observation =
            primary.matched && primary.personId
              ? { personId: primary.personId, confidence: primary.confidence }
              : { personId: null, confidence: 0 };
          const s = stabilizerRef.current.observe(observation, now);
          nextKind = s.kind;
          nextPersonId = s.personId;
          bestObservation = {
            distance: primary.distance,
            confidence: primary.confidence,
            margin: primary.margin,
            rejectedBy: primary.rejectedBy ?? "no-profiles",
          };
        }

        // Resolve profile + speak ONLY on stable transitions.
        const uiKey = `${nextKind}:${nextPersonId ?? ""}`;
        const nextPerson = nextPersonId ? peopleById.get(nextPersonId) ?? null : null;
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
          samplesRef.current.push(ts);
          samplesRef.current = samplesRef.current.filter((t) => ts - t <= 4000);
          const g = governorRef.current.stats;
          setDebug({
            latencyMs: Math.round(latencyEwmaRef.current ?? latency),
            samplesPerSecond: samplesRef.current.length / 4,
            faceCount: faces.length,
            distance: bestObservation.distance,
            confidence: bestObservation.confidence,
            margin: bestObservation.margin,
            rejectedBy: bestObservation.rejectedBy,
            threshold,
            perfTier: g.tier,
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
      trackerRef.current.reset();
      speechRef.current.reset();
      lastUiKeyRef.current = "";
      const canvas = canvasRef.current;
      canvas?.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
    };
  }, [active, cameraStatus, people, peopleById, threshold, settings.soundCues, settings.recognitionEnabled]);

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

/**
 * Corner-bracket overlay: calmer and friendlier than full surveillance-style
 * rectangles. Matched faces get a soft teal glow.
 */
function drawCornerBrackets(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  lw: number,
  matched: boolean,
): void {
  const len = Math.min(w, h) * 0.22;
  const r = Math.max(lw * 2, 8);
  ctx.lineWidth = lw;
  ctx.lineCap = "round";
  ctx.strokeStyle = matched ? "rgba(94, 234, 212, 0.95)" : "rgba(226, 232, 240, 0.55)";
  ctx.shadowColor = matched ? "rgba(45, 212, 191, 0.65)" : "transparent";
  ctx.shadowBlur = matched ? lw * 4 : 0;

  const corners: [number, number, number, number][] = [
    [x, y + len, x, y], // top-left vertical
    [x, y, x + len, y], // top-left horizontal
    [x + w - len, y, x + w, y], // top-right horizontal
    [x + w, y, x + w, y + len], // top-right vertical
    [x + w, y + h - len, x + w, y + h], // bottom-right vertical
    [x + w, y + h, x + w - len, y + h], // bottom-right horizontal
    [x + len, y + h, x, y + h], // bottom-left horizontal
    [x, y + h, x, y + h - len], // bottom-left vertical
  ];
  ctx.beginPath();
  for (const [x1, y1, x2, y2] of corners) {
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
  }
  ctx.stroke();
  ctx.shadowBlur = 0;
}
