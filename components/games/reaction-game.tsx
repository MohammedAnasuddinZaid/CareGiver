"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { difficultyLevel } from "@/lib/cognition/traits";
import { mulberry32, randInt } from "@/lib/games/rng";
import type { GameStageProps } from "./faces-game";
import type { TrialOutcome } from "@/hooks/use-game-session";
import { PhrasePlayer } from "@/lib/audio/phrase-player";

/**
 * "Quick Tap" — a reaction-time exercise for sustained attention.
 * Widely used in cognitive batteries (e.g. the simple reaction-time task in
 * CANTAB/NSA). Difficulty tightens the response window and shortens the
 * fore-period, demanding faster, more focused responding.
 *
 * One trial = one go/no-go style round. Tapping before the cue is a "false
 * start"; missing the window is a slow miss — both teach a gentle lesson
 * without frustration.
 */
type Phase = "wait" | "go" | "result";

export function ReactionGame({ difficulty, itemKey, startTrial, completeTrial }: GameStageProps) {
  const level = Math.max(0, difficultyLevel(difficulty));
  const playerRef = useRefPhrasePlayer();
  const timers = useRef<number[]>([]);
  const goAtRef = useRef(0);
  const [phase, setPhase] = useState<Phase>("wait");
  const [result, setResult] = useState<"hit" | "early" | "slow" | null>(null);

  const timing = useMemo(() => {
    const waitMin = [1100, 1000, 900, 800, 700][Math.min(level, 4)];
    const waitMax = [2800, 2500, 2200, 2000, 1800][Math.min(level, 4)];
    const window = [2200, 1900, 1600, 1300, 1100][Math.min(level, 4)];
    return { waitMin, waitMax, window };
  }, [level]);

  const clearTimers = useCallback(() => {
    for (const t of timers.current) window.clearTimeout(t);
    timers.current = [];
  }, []);

  const finish = useCallback(
    (outcome: TrialOutcome) => {
      clearTimers();
      setPhase("result");
      window.setTimeout(() => completeTrial(outcome), 850);
    },
    [clearTimers, completeTrial],
  );

  useEffect(() => {
    clearTimers();
    setPhase("wait");
    setResult(null);
    startTrial(`reaction:${itemKey}`);
    const rand = mulberry32(itemKey * 2654435761 + 17);
    const delay = randInt(rand, timing.waitMin, timing.waitMax);
    const goTimer = window.setTimeout(() => {
      goAtRef.current = performance.now();
      setPhase("go");
      playerRef.current.tone("tick");
      // Auto-miss if they don't react in time.
      const missTimer = window.setTimeout(() => {
        setResult("slow");
        playerRef.current.tone("miss");
        finish({ correct: false, hintsUsed: 1 });
      }, timing.window);
      timers.current.push(missTimer);
    }, delay);
    timers.current.push(goTimer);
    return clearTimers;
  }, [itemKey, timing, startTrial, clearTimers, finish, playerRef]);

  const tap = () => {
    if (phase === "wait") {
      playerRef.current.tone("miss");
      setResult("early");
      finish({ correct: false, hintsUsed: 1 });
    } else if (phase === "go") {
      const rt = Math.round(performance.now() - goAtRef.current);
      playerRef.current.tone("success");
      setResult("hit");
      finish({ correct: true, hintsUsed: 0 });
      void rt;
    }
  };

  const bg =
    phase === "go"
      ? "bg-ok"
      : phase === "wait"
        ? "bg-night"
        : result === "hit"
          ? "bg-ok"
          : "bg-danger";

  const label =
    phase === "wait"
      ? "Wait for green…"
      : phase === "go"
        ? "TAP NOW!"
        : result === "hit"
          ? "Nice and quick! ✓"
          : result === "early"
            ? "A bit early — wait for green"
            : "Too slow — try again";

  return (
    <div className="flex flex-col items-center gap-5">
      <button
        onClick={tap}
        disabled={phase === "result"}
        className={`flex h-72 w-72 touch-none select-none items-center justify-center rounded-[2.5rem] px-6 text-center text-2xl font-extrabold text-white shadow-lift transition-colors duration-150 ${bg} ${
          phase === "go" ? "animate-pulse-soft" : ""
        }`}
        aria-label={label}
      >
        {label}
      </button>
      <p className="text-sm font-semibold text-ink-soft">
        Tap the moment it turns green. Hold still until then.
      </p>
    </div>
  );
}

function useRefPhrasePlayer() {
  const [ref] = useState(() => ({ current: new PhrasePlayer() }));
  useEffect(() => () => ref.current.reset(), [ref]);
  return ref;
}
