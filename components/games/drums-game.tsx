"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { difficultyLevel } from "@/lib/cognition/traits";
import { PhrasePlayer } from "@/lib/audio/phrase-player";
import type { GameStageProps } from "./faces-game";
import type { TrialOutcome } from "@/hooks/use-game-session";

/**
 * "Festival Drums" — sustained attention + inhibition (Go/No-Go).
 * Tap on the dhol beat, hold still on the kisi (horn). Sound events are
 * synthesized locally with WebAudio; no audio assets required.
 */

type EventKind = "go" | "nogo";

interface BlockPlan {
  events: EventKind[];
  isiMs: number;
  windowMs: number;
}

function planBlock(seed: number, level: number): BlockPlan {
  // Deterministic plan per item so retries of the same seed behave alike.
  let s = seed >>> 0;
  const rand = (): number => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
  const count = 8;
  const nogoRatio = Math.min(0.4, 0.2 + level * 0.05);
  const events: EventKind[] = [];
  for (let i = 0; i < count; i++) {
    events.push(rand() < nogoRatio ? "nogo" : "go");
  }
  if (!events.includes("nogo")) events[2] = "nogo"; // guarantee at least one
  return {
    events,
    isiMs: Math.max(750, 1500 - level * 150),
    windowMs: Math.max(650, 950 - level * 60),
  };
}

export function DrumsGame({
  difficulty,
  itemKey,
  startTrial,
  completeTrial,
}: GameStageProps) {
  const level = Math.max(0, difficultyLevel(difficulty));
  const [running, setRunning] = useState(false);
  const [pulseGo, setPulseGo] = useState(false);
  const [pulseNogo, setPulseNogo] = useState(false);
  const [progress, setProgress] = useState(0);
  const [feedback, setFeedback] = useState<"hit" | "error" | null>(null);

  const playerRef = useRef(new PhrasePlayer());
  const timersRef = useRef<number[]>([]);
  const errorsRef = useRef(0);
  const hitsRef = useRef(0);
  const inWindowRef = useRef<{ kind: EventKind | null }>({ kind: null });
  const respondedRef = useRef(false);

  const clearTimers = useCallback((): void => {
    for (const t of timersRef.current) window.clearTimeout(t);
    timersRef.current = [];
  }, []);

  useEffect(() => () => clearTimers(), [clearTimers]);

  useEffect(() => {
    setRunning(false);
    setProgress(0);
    errorsRef.current = 0;
    hitsRef.current = 0;
    startTrial(`drums:${itemKey}`);
    return () => clearTimers();
  }, [itemKey, startTrial, clearTimers]);

  const finishItem = useCallback((): void => {
    clearTimers();
    setRunning(false);
    const allowedErrors = [3, 2, 2, 1, 1][Math.min(level, 4)];
    const outcome: TrialOutcome = {
      correct: errorsRef.current <= allowedErrors,
      hintsUsed: Math.min(errorsRef.current, 9),
    };
    playerRef.current.tone(outcome.correct ? "success" : "miss");
    window.setTimeout(() => completeTrial(outcome), 600);
  }, [clearTimers, completeTrial, level]);

  const scheduleBlock = useCallback((): void => {
    const plan = planBlock(itemKey * 2654435761 + level, level);
    let t = 900;
    plan.events.forEach((kind, idx) => {
      // Cue onset.
      timersRef.current.push(
        window.setTimeout(() => {
          inWindowRef.current.kind = kind;
          respondedRef.current = false;
          if (kind === "go") {
            playerRef.current.tone("tick", 0.28);
            setPulseGo(true);
            window.setTimeout(() => setPulseGo(false), plan.windowMs);
          } else {
            playerRef.current.speak("hold", "en");
            setPulseNogo(true);
            window.setTimeout(() => setPulseNogo(false), plan.windowMs);
          }
        }, t),
      );
      // Window close → missed go counts as an error.
      timersRef.current.push(
        window.setTimeout(() => {
          if (
            inWindowRef.current.kind === "go" &&
            !respondedRef.current
          ) {
            errorsRef.current += 1;
            setFeedback("error");
            window.setTimeout(() => setFeedback(null), 350);
          }
          inWindowRef.current.kind = null;
          respondedRef.current = false;
          setProgress(idx + 1);
          if (idx === plan.events.length - 1) {
            timersRef.current.push(window.setTimeout(finishItem, plan.isiMs));
          }
        }, t + plan.windowMs),
      );
      t += plan.windowMs + plan.isiMs;
    });
  }, [finishItem, itemKey, level]);

  const begin = (): void => {
    if (running) return;
    setRunning(true);
    scheduleBlock();
  };

  const onTap = (): void => {
    if (!running) return;
    const kind = inWindowRef.current.kind;
    if (kind === "go" && !respondedRef.current) {
      respondedRef.current = true;
      hitsRef.current += 1;
      setFeedback("hit");
      window.setTimeout(() => setFeedback(null), 300);
    } else if (kind !== null && !respondedRef.current) {
      respondedRef.current = true;
      errorsRef.current += 1;
      setFeedback("error");
      window.setTimeout(() => setFeedback(null), 350);
    } else if (kind === null) {
      errorsRef.current += 0.5; // impulsive tap outside any window
      setFeedback("error");
      window.setTimeout(() => setFeedback(null), 350);
    }
  };

  return (
    <div className="flex flex-col items-center gap-8">
      <p className="text-center text-lg font-semibold text-ink">
        🥁 Tap on the drum · 📣 Hold on the horn
      </p>

      <button
        onClick={onTap}
        aria-label="Tap pad"
        className={clsx(
          "flex h-52 w-52 items-center justify-center rounded-full border-4 text-6xl shadow-lift transition-all duration-100 active:scale-[0.96]",
          pulseGo && "scale-105 border-accent! bg-accent/15!",
          pulseNogo && "border-warn! bg-warn/15!",
          !running && "opacity-50",
          feedback === "hit" && "border-ok! bg-ok/20!",
          feedback === "error" && "border-danger! bg-danger/15!",
        )}
      >
        <span>{pulseNogo ? "📣" : "🥁"}</span>
      </button>

      {/* Event progress */}
      <div className="flex w-full max-w-xs items-center gap-1.5">
        {Array.from({ length: 8 }, (_, i) => (
          <span
            key={i}
            className={clsx(
              "h-2 flex-1 rounded-full",
              i < progress ? "bg-accent" : "bg-line",
            )}
          />
        ))}
      </div>

      {!running ? (
        <button
          onClick={begin}
          className="min-h-[56px] rounded-full bg-accent px-10 py-3 text-lg font-bold text-white shadow-soft transition-transform active:scale-[0.98]"
        >
          Start
        </button>
      ) : (
        <p className="text-sm text-ink-soft">
          Errors so far: {Math.floor(errorsRef.current)}
        </p>
      )}
    </div>
  );
}
