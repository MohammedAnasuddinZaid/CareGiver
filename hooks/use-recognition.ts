"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
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
import {
  buildProfileIndex,
  identifyFaceIndexedDetailed,
  selectPrimaryFace,
} from "@/lib/recognition/matching";
import { l2Normalize } from "@/lib/recognition/metrics";
import { IdentityStabilizer } from "@/lib/recognition/stabilizer";
import { BoxTracker } from "@/lib/recognition/tracker";
import { DescriptorMemory } from "@/lib/recognition/descriptor-memory";
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
  const descriptorMemoryRef = useRef<DescriptorMemory>(new DescriptorMemory());
  const governorRef = useRef<PerfGovernor>(new PerfGovernor(recognitionConfig.performance));
  // Adaptive exposure for dim/backlit rooms (cosmetic preview + baked into
  // the detection buffer so the model sees a lift too).
  const exposureRef = useRef(1);
  const sampleCanvasRef = useRef<HTMLCanvasElement | null>(null);
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

  // Signature of the people list (id + updatedAt + descriptor count).
  // Window-focus refreshes re-read IndexedDB, but the pipeline must only
  // RESTART when data actually changed — otherwise every alt-tab reset
  // stabilization, tracking and descriptor memory mid-recognition.
  const peopleSignatureRef = useRef<string | null>(null);

  const refreshPeople = useCallback(async () => {
    try {
      const list = await getPeople();
      const signature = list
        .map((p) => `${p.id}:${p.updatedAt}:${p.descriptors.length}`)
        .join("|");
      if (signature === peopleSignatureRef.current) return;
      peopleSignatureRef.current = signature;
      setPeople(list);
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
  // Normalized-once descriptor index — rebuilt only when people change,
  // turning per-frame matching into pure dot products.
  const profileIndex = useMemo(() => buildProfileIndex(people), [people]);

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

    /**
     * Iron-Man-style HUD: a floating chip above EVERY recognized face in
     * the frame — name on line one, relationship/description below. Runs
     * per inference tick on the overlay canvas, so coordinates map 1:1 to
     * the video regardless of screen size (canvas uses object-cover).
     */
    const drawFaceLabels = (
      boxes: {
        box: { x: number; y: number; width: number; height: number };
        matched: boolean;
        personId: string | null;
      }[],
    ) => {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      if (!canvas || !video) return;
      const vw = canvas.width;
      const vh = canvas.height;
      if (!vw || !vh) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const s = Math.max(18, Math.min(34, Math.round(vw / 38)));
      const padX = Math.round(s * 0.6);
      const padY = Math.round(s * 0.45);
      const radius = Math.round(s * 0.55);
      const lineGap = Math.round(s * 0.3);
      const margin = 4;

      for (const item of boxes) {
        if (!item.matched || !item.personId) continue;
        const p = peopleById.get(item.personId);
        if (!p) continue;

        // Compose label text.
        const subParts: string[] = [];
        if (p.relationship?.trim()) subParts.push(p.relationship.trim());
        if (p.description?.trim()) subParts.push(p.description.trim());
        let sub = subParts.join(" · ");
        if (sub.length > 64) sub = `${sub.slice(0, 63).trimEnd()}…`;

        // Measure both lines with their respective fonts.
        ctx.textBaseline = "top";
        ctx.font = `700 ${s}px Inter, system-ui, sans-serif`;
        const nameW = ctx.measureText(p.name).width;
        const nameH = Math.round(s * 1.1);
        const subSize = Math.max(11, Math.round(s * 0.72));
        const subH = sub ? Math.round(subSize * 1.15) : 0;
        let subW = 0;
        if (sub) {
          ctx.font = `500 ${subSize}px Inter, system-ui, sans-serif`;
          subW = ctx.measureText(sub).width;
        }

        const chipW = Math.ceil(Math.max(nameW, subW) + padX * 2);
        const chipH = padY * 2 + nameH + (sub ? lineGap + subH : 0);

        // Position: centered above the box, clamped into frame; drop below
        // the box when there is no room at the top.
        let cx = item.box.x + item.box.width / 2 - chipW / 2;
        cx = Math.max(margin, Math.min(vw - chipW - margin, cx));
        let cy =
          item.box.y - chipH - Math.round(s * 0.4);
        if (cy < margin) {
          cy = item.box.y + item.box.height + Math.round(s * 0.4);
        }
        cy = Math.max(margin, Math.min(vh - chipH - margin, cy));

        // Chip background + teal border.
        ctx.beginPath();
        if (typeof ctx.roundRect === "function") {
          ctx.roundRect(cx, cy, chipW, chipH, radius);
        } else {
          const r = Math.min(radius, chipW / 2, chipH / 2);
          ctx.moveTo(cx + r, cy);
          ctx.arcTo(cx + chipW, cy, cx + chipW, cy + chipH, r);
          ctx.arcTo(cx + chipW, cy + chipH, cx, cy + chipH, r);
          ctx.arcTo(cx, cy + chipH, cx, cy, r);
          ctx.arcTo(cx, cy, cx + chipW, cy, r);
          ctx.closePath();
        }
        ctx.fillStyle = "rgba(7, 15, 20, 0.78)";
        ctx.fill();
        ctx.lineWidth = Math.max(1.5, s * 0.07);
        ctx.strokeStyle = "rgba(94, 234, 212, 0.85)";
        ctx.stroke();

        // Text.
        ctx.fillStyle = "rgba(255, 255, 255, 0.97)";
        ctx.font = `700 ${s}px Inter, system-ui, sans-serif`;
        ctx.fillText(p.name, cx + padX, cy + padY);
        if (sub) {
          ctx.fillStyle = "rgba(153, 246, 228, 0.92)";
          ctx.font = `500 ${subSize}px Inter, system-ui, sans-serif`;
          ctx.fillText(sub, cx + padX, cy + padY + nameH + lineGap);
        }
      }
    };

    const tick = async () => {
      if (stopRef.current) return;
      // Period-based cadence: the sample interval covers the WHOLE cycle
      // (inference + wait). The old code slept the full interval AFTER
      // inference, so the real period was interval + inference — which
      // pushed the stabilizer's evidence ceiling below its enter threshold
      // and made recognition mathematically unreachable. See config.temporal.
      const startedAt = performance.now();
      if (document.hidden || busyRef.current) {
        scheduleNext(document.hidden ? recognitionConfig.sampleIntervalMs : 80);
        return;
      }
      const video = videoRef.current;
      if (!video || video.readyState < 2 || video.videoWidth === 0) {
        scheduleNext(80);
        return;
      }
      busyRef.current = true;
      try {
        const faceapi = await ensureModelsLoaded();
        if (stopRef.current) return;

        // Adaptive exposure: estimate frame brightness, lift dim/backlit
        // frames, brighten the preview, and hand the same lift to detection
        // (toEnhancedInput bakes it into the pixels — CSS filters alone never
        // reach the model).
        let enhance:
          | { brightness: number; contrast: number; saturate: number; grayscale: boolean; maxWidth: number }
          | undefined;
        if (!sampleCanvasRef.current) {
          const sc = document.createElement("canvas");
          sc.width = 80;
          sc.height = 60;
          sampleCanvasRef.current = sc;
        }
        const sctx = sampleCanvasRef.current.getContext("2d", { willReadFrequently: true });
        if (sctx) {
          sctx.drawImage(video, 0, 0, 80, 60);
          const sd = sctx.getImageData(0, 0, 80, 60).data;
          let sum = 0;
          for (let i = 0; i < sd.length; i += 4) sum += (sd[i] + sd[i + 1] + sd[i + 2]) / 3;
          const avg = sum / (sd.length / 4) / 255;
          const desired = clamp(0.5 / (avg || 0.001), 0.8, 1.6);
          exposureRef.current =
            exposureRef.current === 1 ? desired : 0.82 * exposureRef.current + 0.18 * desired;
          video.style.filter = `brightness(${exposureRef.current.toFixed(3)}) contrast(1.08) saturate(1.06)`;
          enhance = {
            brightness: exposureRef.current,
            contrast: 1.08,
            saturate: 1.06,
            grayscale: true,
            maxWidth: 640,
          };
        }

        const t0 = performance.now();
        const faces = await detectFacesInVideo(
          faceapi,
          video,
          governorRef.current.inputSize,
          enhance,
        );
        // Inference can outlive an unmount (user left Companion Mode).
        // Stop BEFORE touching React state or speaking — otherwise a name
        // is announced into empty air and setState fires on dead components.
        if (stopRef.current) return;
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

        // Associate each smoothed track with its nearest detection BEFORE
        // matching, so descriptor memory blends frames of the same physical
        // face. Averaging cuts angular noise (~√N): true matches fall well
        // below threshold, impostors stay near √2.
        const detectionForTrack = tracked.map((t) => {
          let bestIdx = -1;
          let bestDist2 = Infinity;
          const tcx = t.box.x + t.box.width / 2;
          const tcy = t.box.y + t.box.height / 2;
          for (let i = 0; i < faces.length; i++) {
            // Squared-distance compare: ordering identical to hypot,
            // no sqrt per (track × detection) pair.
            const dx = tcx - (faces[i].box.x + faces[i].box.width / 2);
            const dy = tcy - (faces[i].box.y + faces[i].box.height / 2);
            const d2 = dx * dx + dy * dy;
            if (d2 < bestDist2) {
              bestDist2 = d2;
              bestIdx = i;
            }
          }
          return bestIdx;
        });

        const enriched = tracked.map((t, ti) => {
          const detIdx = detectionForTrack[ti];
          const face = detIdx >= 0 ? faces[detIdx] : null;
          let match: ReturnType<typeof identifyFaceIndexedDetailed> | null = null;
          if (face) {
            const smoothed = descriptorMemoryRef.current.update(
              String(t.trackId),
              face.descriptor,
              t0,
            );
            const normalized = smoothed ? l2Normalize(smoothed) : null;
            if (normalized) {
              match = identifyFaceIndexedDetailed(normalized, profileIndex, { threshold });
            }
          }
          return {
            box: t.box,
            hits: t.hits,
            matched: match?.status === "recognized",
            personId: match?.personId ?? null,
            confidence: match?.confidence ?? 0,
            distance: match?.distance ?? null,
            margin: match?.margin ?? null,
            rejectedBy: match?.rejectedBy ?? "no-face",
          };
        });
        descriptorMemoryRef.current.retain(tracked.map((t) => String(t.trackId)));

        drawTrackedBoxes(enriched);
        drawFaceLabels(enriched);

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
          setFaceCount(faces.length);
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
        const elapsed = performance.now() - startedAt;
        scheduleNext(
          Math.max(30, recognitionConfig.sampleIntervalMs - elapsed),
        );
      }
    };

    function scheduleNext(delayMs: number) {
      if (stopRef.current) return;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(tick, delayMs);
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
      if (videoRef.current) videoRef.current.style.filter = "";
      stabilizerRef.current.reset();
      trackerRef.current.reset();
      descriptorMemoryRef.current.reset();
      speechRef.current.reset();
      lastUiKeyRef.current = "";
      const canvas = canvasRef.current;
      canvas?.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
    };
  }, [active, cameraStatus, people, peopleById, profileIndex, threshold, settings.soundCues, settings.recognitionEnabled]);

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
