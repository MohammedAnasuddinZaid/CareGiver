"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { difficultyLevel } from "@/lib/cognition/traits";
import { mulberry32, shuffle } from "@/lib/games/rng";
import type { GameStageProps } from "./faces-game";
import type { TrialOutcome } from "@/hooks/use-game-session";
import { PhrasePlayer } from "@/lib/audio/phrase-player";

/**
 * "Follow the Lights" — a Simon-style attention + working-memory task.
 * A sequence of colored pads lights up with its own tone; the player
 * reproduces it. The rhythmic, musical nature is engaging and the
 * escalating sequence is classic attentional training (also maps onto
 * the drumming/rhythm games already in the library).
 */
const PADS = [
  { bg: "bg-red-400", on: "bg-red-500", freq: 392.0 },
  { bg: "bg-amber-400", on: "bg-amber-500", freq: 523.25 },
  { bg: "bg-emerald-400", on: "bg-emerald-500", freq: 659.25 },
  { bg: "bg-sky-400", on: "bg-sky-500", freq: 783.99 },
];

export function FollowGame({ difficulty, itemKey, startTrial, completeTrial }: GameStageProps) {
  const level = Math.max(0, difficultyLevel(difficulty));
  const seqLen = Math.min(7, 3 + level);

  const playerRef = useRef(new PhrasePlayer());
  const timersRef = useRef<number[]>([]);
  const later = useCallback((fn: () => void, ms: number): void => {
    timersRef.current.push(window.setTimeout(fn, ms));
  }, []);
  const clearTimers = useCallback((): void => {
    for (const t of timersRef.current) window.clearTimeout(t);
    timersRef.current = [];
  }, []);
  useEffect(() => () => clearTimers(), [clearTimers]);

  const sequence = useMemo(() => {
    const rand = mulberry32(itemKey * 48271 + 41);
    return Array.from({ length: seqLen }, () => Math.floor(rand() * PADS.length));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemKey, seqLen]);

  const [phase, setPhase] = useState<"study" | "input">("study");
  const [lit, setLit] = useState<number>(-1);
  const [input, setInput] = useState<number[]>([]);
  const doneRef = useRef(false);

  const flashPad = useCallback((idx: number): void => {
    setLit(idx);
    playerRef.current.tone("tick", 0.12);
    later(() => setLit(-1), 380);
  }, [later]);

  useEffect(() => {
    setPhase("study");
    setInput([]);
    doneRef.current = false;
    let i = 0;
    const step = (): void => {
      if (i >= sequence.length) {
        later(() => {
          setLit(-1);
          setPhase("input");
          startTrial(`follow:${itemKey}`);
        }, 400);
        return;
      }
      flashPad(sequence[i]);
      later(() => {
        later(() => {
          i++;
          step();
        }, 260);
      }, 420);
    };
    later(step, 600);
    return clearTimers;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemKey, sequence]);

  const tap = (idx: number): void => {
    if (phase !== "input" || doneRef.current) return;
    flashPad(idx);
    const next = [...input, idx];
    setInput(next);
    if (next[next.length - 1] !== sequence[next.length - 1]) {
      doneRef.current = true;
      playerRef.current.tone("miss");
      later(() => completeTrial({ correct: false, hintsUsed: 0 } satisfies TrialOutcome), 900);
      return;
    }
    if (next.length === sequence.length) {
      doneRef.current = true;
      playerRef.current.tone("success");
      later(() => completeTrial({ correct: true, hintsUsed: 0 } satisfies TrialOutcome), 700);
    }
  };

  return (
    <div className="flex flex-col items-center gap-5">
      <p className="text-center text-lg font-semibold text-ink-soft">
        {phase === "study" ? "Watch the lights…" : `Repeat the pattern (${input.length}/${seqLen})`}
      </p>
      <div className="grid w-full max-w-xs grid-cols-2 gap-4">
        {PADS.map((pad, idx) => (
          <button
            key={idx}
            onClick={() => tap(idx)}
            disabled={phase === "study"}
            aria-label={`Pad ${idx + 1}`}
            className={
              "aspect-square rounded-3xl border-2 border-line shadow-soft transition-all duration-150 active:scale-[0.95] " +
              (lit === idx ? `${pad.on} scale-105` : pad.bg) +
              (phase === "study" ? " opacity-80" : "")
            }
          />
        ))}
      </div>
    </div>
  );
}
