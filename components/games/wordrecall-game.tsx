"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { difficultyLevel } from "@/lib/cognition/traits";
import { mulberry32, shuffle } from "@/lib/games/rng";
import type { GameStageProps } from "./faces-game";
import type { TrialOutcome } from "@/hooks/use-game-session";
import { PhrasePlayer } from "@/lib/audio/phrase-player";

/**
 * "Word Recall" — a free/recognition recall exercise drawn from spaced-
 * retrieval and CST literature. The player studies a small set of common
 * words, then picks them out of a larger mixed list. Exact selection (no
 * misses, no omissions) counts as a clean success.
 */
const WORDS = [
  "flower", "river", "bread", "school", "music", "garden", "teacup", "mango",
  "tiger", "lamp", "cloud", "bell", "chair", "fish", "sun", "book", "rain",
  "horse", "sugar", "window", "stone", "bird", "milk", "road",
];

export function WordRecallGame({ difficulty, itemKey, startTrial, completeTrial }: GameStageProps) {
  const level = Math.max(0, difficultyLevel(difficulty));
  const studyCount = Math.min(8, 4 + Math.floor(level / 1.5));
  const distractorCount = Math.min(8, 4 + level);

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

  const { target, choices } = useMemo(() => {
    const rand = mulberry32(itemKey * 16807 + 31);
    const pool = shuffle(WORDS, rand);
    const tgt = pool.slice(0, studyCount);
    const distract = pool.slice(studyCount, studyCount + distractorCount);
    return { target: tgt, choices: shuffle([...tgt, ...distract], rand) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemKey, studyCount, distractorCount]);

  const [phase, setPhase] = useState<"study" | "pick">("study");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const doneRef = useRef(false);

  useEffect(() => {
    setPhase("study");
    setSelected(new Set());
    doneRef.current = false;
    later(() => {
      setPhase("pick");
      startTrial(`wordrecall:${itemKey}`);
    }, 2600 + studyCount * 220);
    return clearTimers;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemKey, studyCount]);

  const toggle = (w: string): void => {
    if (phase !== "pick" || doneRef.current) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(w)) next.delete(w);
      else next.add(w);
      return next;
    });
  };

  const finish = (): void => {
    if (doneRef.current) return;
    doneRef.current = true;
    let correct = selected.size === target.length;
    let wrong = 0;
    if (correct) {
      for (const w of selected) if (!target.includes(w)) correct = false;
    }
    for (const w of selected) if (!target.includes(w)) wrong++;
    if (correct) playerRef.current.tone("success");
    else playerRef.current.tone("miss");
    later(() => completeTrial({ correct, hintsUsed: Math.min(wrong, 9) } satisfies TrialOutcome), correct ? 700 : 1000);
  };

  return (
    <div className="flex w-full max-w-xl flex-col items-center gap-5">
      {phase === "study" ? (
        <>
          <p className="text-center text-lg font-semibold text-ink-soft">Remember these words…</p>
          <div className="grid w-full grid-cols-2 gap-3 sm:grid-cols-3">
            {target.map((w) => (
              <div key={w} className="rounded-2xl border-2 border-accent/40 bg-accent-soft px-4 py-4 text-center text-xl font-bold text-ink">
                {w}
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
          <p className="text-center text-lg font-semibold text-ink-soft">
            Tap the words you saw ({selected.size} selected)
          </p>
          <div className="grid w-full grid-cols-2 gap-3 sm:grid-cols-3">
            {choices.map((w) => {
              const on = selected.has(w);
              return (
                <button
                  key={w}
                  onClick={() => toggle(w)}
                  className={
                    "min-h-[60px] rounded-2xl border-2 px-4 py-4 text-center text-xl font-bold shadow-soft transition-all active:scale-[0.97] " +
                    (on ? "border-accent bg-accent text-white" : "border-line bg-surface hover:border-accent/50")
                  }
                >
                  {w}
                </button>
              );
            })}
          </div>
          <button
            onClick={finish}
            className="mt-2 inline-flex min-h-[56px] items-center justify-center rounded-full bg-accent px-10 py-3 text-lg font-bold text-white shadow-soft transition-all hover:bg-accent-strong active:scale-[0.98]"
          >
            Check my answers
          </button>
        </>
      )}
    </div>
  );
}
