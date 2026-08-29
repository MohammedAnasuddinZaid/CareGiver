"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { difficultyLevel } from "@/lib/cognition/traits";
import { mulberry32, shuffle } from "@/lib/games/rng";
import type { GameStageProps } from "./faces-game";
import type { TrialOutcome } from "@/hooks/use-game-session";
import { PhrasePlayer } from "@/lib/audio/phrase-player";

/**
 * "Pattern Sequence" — serial-order working-memory training (a core
 * component of CST and spaced-retrieval protocols). A short sequence of
 * familiar objects is shown one-by-one, then the player reproduces the
 * order. Length scales with difficulty; the staircase adapts further.
 */
const TOKENS = ["🍎", "🌟", "🐱", "🌸", "🚀", "🍊", "🐟", "🪔", "🌈", "🐘", "🍇", "🥥"];

export function SequenceGame({ difficulty, itemKey, startTrial, completeTrial }: GameStageProps) {
  const level = Math.max(0, difficultyLevel(difficulty));
  const seqLen = Math.min(7, 3 + level);
  const poolCount = Math.min(TOKENS.length, Math.max(6, seqLen + 3));

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

  const { pool, target } = useMemo(() => {
    const rand = mulberry32(itemKey * 22695477 + 11);
    const p = shuffle(TOKENS, rand).slice(0, poolCount);
    const t: number[] = [];
    for (let i = 0; i < seqLen; i++) t.push(Math.floor(rand() * p.length));
    return { pool: p, target: t };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemKey, poolCount, seqLen]);

  const [phase, setPhase] = useState<"study" | "input">("study");
  const [flash, setFlash] = useState<number>(-1);
  const [input, setInput] = useState<number[]>([]);
  const doneRef = useRef(false);

  // Study playback: flash each token of the sequence in order.
  useEffect(() => {
    setPhase("study");
    setInput([]);
    setFlash(-1);
    doneRef.current = false;
    let i = 0;
    const step = (): void => {
      if (i >= target.length) {
        later(() => {
          setFlash(-1);
          setPhase("input");
          startTrial(`sequence:${itemKey}:${seqLen}`);
        }, 350);
        return;
      }
      setFlash(target[i]);
      playerRef.current.tone("tick", 0.1);
      later(() => {
        setFlash(-1);
        later(() => {
          i++;
          step();
        }, 220);
      }, 620);
    };
    later(step, 500);
    return clearTimers;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemKey, target, seqLen]);

  const tap = (idx: number): void => {
    if (phase !== "input" || doneRef.current) return;
    const next = [...input, idx];
    setInput(next);
    playerRef.current.tone("tick", 0.1);
    if (next.length < target.length) return;

    const correct = next.every((v, k) => v === target[k]);
    setFlash(idx);
    later(() => setFlash(-1), 200);
    doneRef.current = true;
    if (correct) playerRef.current.tone("success");
    else playerRef.current.tone("miss");
    later(() => completeTrial({ correct, hintsUsed: 0 } satisfies TrialOutcome), correct ? 700 : 1000);
  };

  return (
    <div className="flex flex-col items-center gap-5">
      <p className="text-center text-lg font-semibold text-ink-soft">
        {phase === "study"
          ? "Watch the order…"
          : `Tap the objects in the same order (${input.length}/${seqLen})`}
      </p>

      {/* Answer / object grid */}
      <div
        className="grid w-full max-w-md gap-3"
        style={{ gridTemplateColumns: `repeat(${Math.ceil(Math.sqrt(pool.length))}, minmax(0, 1fr))` }}
      >
        {pool.map((emoji, idx) => {
          const pickedAt = input.indexOf(idx);
          const inSequence = phase === "study" && flash === idx;
          return (
            <button
              key={idx}
              onClick={() => tap(idx)}
              disabled={phase === "study"}
              aria-label={`Object ${idx + 1}`}
              className={
                "flex aspect-square items-center justify-center rounded-2xl border-2 text-4xl shadow-soft transition-all duration-150 active:scale-[0.95] " +
                (inSequence
                  ? "border-accent! bg-accent-soft! scale-105"
                  : pickedAt >= 0
                    ? "border-ok/70 bg-ok/10"
                    : phase === "study"
                      ? "border-line bg-surface opacity-60"
                      : "border-line bg-surface hover:border-accent/50")
              }
            >
              {emoji}
            </button>
          );
        })}
      </div>

      {phase === "input" && input.length > 0 && (
        <div className="flex min-h-[40px] flex-wrap items-center justify-center gap-2">
          {input.map((idx, k) => (
            <span key={k} className="rounded-full bg-accent-soft px-3 py-1 text-xl">
              {pool[idx]}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
