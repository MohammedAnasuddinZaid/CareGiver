"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { difficultyLevel } from "@/lib/cognition/traits";
import { mulberry32, randInt, shuffle } from "@/lib/games/rng";
import type { GameStageProps } from "./faces-game";
import type { TrialOutcome } from "@/hooks/use-game-session";
import { PhrasePlayer } from "@/lib/audio/phrase-player";

/**
 * "Put in Order" — a sequencing / planning task for executive function. The
 * player arranges shuffled steps into their natural order (a morning routine,
 * sizes, the day's time). Sequencing everyday activities is a core
 * instrumental activity-of-daily-living skill and a frequent cognitive-training
 * target for planning and prospective memory.
 *
 * One trial = one sequence. Difficulty grows the number of steps.
 */
interface Step {
  emoji: string;
  label: string;
}
const SETS: Step[][] = [
  [
    { emoji: "🌅", label: "Wake up" },
    { emoji: "🪥", label: "Brush teeth" },
    { emoji: "🍳", label: "Eat breakfast" },
    { emoji: "👕", label: "Get dressed" },
    { emoji: "👟", label: "Put on shoes" },
  ],
  [
    { emoji: "☀️", label: "Morning" },
    { emoji: "🕛", label: "Noon" },
    { emoji: "🌇", label: "Evening" },
    { emoji: "🌙", label: "Night" },
  ],
  [
    { emoji: "🐜", label: "Ant" },
    { emoji: "🐱", label: "Cat" },
    { emoji: "🐶", label: "Dog" },
    { emoji: "🐘", label: "Elephant" },
  ],
  [
    { emoji: "1️⃣", label: "One" },
    { emoji: "2️⃣", label: "Two" },
    { emoji: "3️⃣", label: "Three" },
    { emoji: "4️⃣", label: "Four" },
    { emoji: "5️⃣", label: "Five" },
  ],
  [
    { emoji: "🔤", label: "A" },
    { emoji: "🅱️", label: "B" },
    { emoji: "©️", label: "C" },
    { emoji: "🇩", label: "D" },
  ],
];
const STEP_COUNT = [3, 3, 4, 4, 5];
const ALLOWED_MISTAKES = [4, 4, 3, 2, 2];

export function OrderGame({ difficulty, itemKey, startTrial, completeTrial }: GameStageProps) {
  const level = Math.max(0, difficultyLevel(difficulty));
  const playerRef = useRefPhrasePlayer();
  const timers = useRef<number[]>([]);
  const [steps, setSteps] = useState<Step[]>([]);
  const [display, setDisplay] = useState<number[]>([]);
  const [picked, setPicked] = useState<number[]>([]);
  const [mistakes, setMistakes] = useState(0);
  const [flash, setFlash] = useState<"ok" | "wrong" | null>(null);
  const doneRef = useRef(false);

  const clearTimers = useCallback(() => {
    for (const t of timers.current) window.clearTimeout(t);
    timers.current = [];
  }, []);

  const item = useMemo(() => {
    const rand = mulberry32(itemKey * 631 + 7);
    const n = STEP_COUNT[Math.min(level, STEP_COUNT.length - 1)];
    const setIdx = randInt(rand, 0, SETS.length - 1);
    const slice = SETS[setIdx].slice(0, n);
    const order = shuffle(
      slice.map((_, i) => i),
      rand,
    );
    return { steps: slice, order };
  }, [itemKey, level]);

  useEffect(() => {
    setSteps(item.steps);
    setDisplay(item.order);
    setPicked([]);
    setMistakes(0);
    setFlash(null);
    doneRef.current = false;
    startTrial(`order:${itemKey}`);
    return clearTimers;
  }, [item, itemKey, startTrial, clearTimers]);

  const allowed = ALLOWED_MISTAKES[Math.min(level, ALLOWED_MISTAKES.length - 1)];

  const finish = useCallback(
    (correct: boolean) => {
      if (doneRef.current) return;
      doneRef.current = true;
      clearTimers();
      window.setTimeout(() => completeTrial({ correct, hintsUsed: Math.min(9, mistakes) }), 750);
    },
    [clearTimers, completeTrial, mistakes],
  );

  const tap = (displayPos: number) => {
    if (doneRef.current || picked.includes(displayPos)) return;
    const stepIndex = display[displayPos];
    const expected = picked.length; // next needed natural order index
    if (stepIndex === expected) {
      playerRef.current.tone("tick");
      const next = [...picked, displayPos];
      setPicked(next);
      setFlash("ok");
      window.setTimeout(() => setFlash(null), 180);
      if (next.length === steps.length) {
        playerRef.current.tone("success");
        finish(true);
      }
    } else {
      playerRef.current.tone("miss");
      setFlash("wrong");
      window.setTimeout(() => setFlash(null), 300);
      const next = mistakes + 1;
      setMistakes(next);
      if (next > allowed) finish(false);
    }
  };

  const reset = () => {
    if (doneRef.current) return;
    setPicked([]);
    setFlash(null);
  };

  return (
    <div className="flex flex-col items-center gap-5">
      <p className="text-lg font-semibold text-ink-soft">Tap the steps in the right order.</p>

      <div className="flex w-full max-w-md flex-wrap justify-center gap-2">
        {steps.map((s, i) => {
          const placed = picked.findIndex((p) => display[p] === i);
          return (
            <span
              key={i}
              className={
                "flex items-center gap-1.5 rounded-xl border-2 px-3 py-2 text-base font-semibold transition-colors " +
                (placed >= 0
                  ? "border-accent bg-accent-soft text-accent"
                  : "border-line bg-surface text-transparent")
              }
            >
              <span className="text-2xl">{s.emoji}</span>
              {placed >= 0 ? s.label : "·"}
            </span>
          );
        })}
      </div>

      <div
        className={
          "grid w-full max-w-md grid-cols-2 gap-3 transition-colors sm:grid-cols-3 " +
          (flash === "wrong" ? "rounded-2xl bg-danger/10 p-2" : "")
        }
      >
        {display.map((stepIndex, pos) => {
          const placed = picked.includes(pos);
          const isNextCorrect = stepIndex === picked.length;
          return (
            <button
              key={pos}
              onClick={() => tap(pos)}
              disabled={placed || doneRef.current}
              className={
                "flex min-h-[72px] flex-col items-center justify-center gap-1 rounded-2xl border-2 px-2 py-3 text-center shadow-soft transition-all active:scale-[0.97] disabled:opacity-40 " +
                (placed
                  ? "border-accent/50 bg-accent-soft"
                  : isNextCorrect && flash === "ok"
                    ? "border-ok/60 bg-ok/5"
                    : "border-line bg-surface hover:border-accent")
              }
            >
              <span className="text-3xl">{steps[stepIndex].emoji}</span>
              <span className="text-sm font-bold text-ink">{steps[stepIndex].label}</span>
            </button>
          );
        })}
      </div>

      <button
        onClick={reset}
        disabled={doneRef.current}
        className="rounded-full border border-line px-5 py-2.5 text-base font-semibold text-ink-soft transition-colors hover:bg-surface-muted"
      >
        Start over
      </button>
    </div>
  );
}

function useRefPhrasePlayer() {
  const [ref] = useState(() => ({ current: new PhrasePlayer() }));
  useEffect(() => () => ref.current.reset(), [ref]);
  return ref;
}
