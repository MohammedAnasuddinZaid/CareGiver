"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { difficultyLevel } from "@/lib/cognition/traits";
import { mulberry32, shuffle } from "@/lib/games/rng";
import type { GameStageProps } from "./faces-game";
import type { TrialOutcome } from "@/hooks/use-game-session";

/**
 * "Number Trail" — a Trail Making Test analog (attention + sequencing).
 * TMT-A is a standard neuropsychological instrument: connect numbers in
 * ascending order. Here the player taps scattered stones 1→N; wrong taps
 * shake gently and count as errors. Processing speed + visual search +
 * order maintenance, all in one ecologically simple task.
 */

interface Stone {
  n: number;
  x: number; // percentage position
  y: number;
}

function makeTrail(seed: number, count: number): Stone[] {
  const rand = mulberry32(seed * 7919 + 101);
  // Scatter on a jittered grid so stones never overlap.
  const cols = 4;
  const rows = Math.ceil(count / cols) + 1;
  const cells = shuffle(
    Array.from({ length: cols * rows }, (_, i) => i),
    rand,
  ).slice(0, count);
  return Array.from({ length: count }, (_, i) => {
    const cell = cells[i];
    const cx = (cell % cols) + 0.5;
    const cy = Math.floor(cell / cols) + 0.5;
    return {
      n: i + 1,
      x: ((cx / cols) * 100),
      y: ((cy / rows) * 100),
    };
  });
}

export function TrailGame({
  difficulty,
  itemKey,
  startTrial,
  completeTrial,
}: GameStageProps) {
  const level = Math.max(0, difficultyLevel(difficulty));
  const count = Math.min(10, 4 + level);

  const item = useMemo(() => makeTrail(itemKey, count), [itemKey, count]);
  const [nextExpected, setNextExpected] = useState(1);
  const [wrongAt, setWrongAt] = useState<number | null>(null);
  const mistakesRef = useRef(0);
  const doneRef = useRef(false);

  useEffect(() => {
    setNextExpected(1);
    setWrongAt(null);
    mistakesRef.current = 0;
    doneRef.current = false;
    startTrial(`trail:${itemKey}`);
  }, [itemKey, startTrial]);

  const tap = (n: number): void => {
    if (doneRef.current) return;
    if (n === nextExpected) {
      const nowNext = nextExpected + 1;
      setNextExpected(nowNext);
      if (nowNext > count) {
        doneRef.current = true;
        window.setTimeout(
          () =>
            completeTrial({
              correct: mistakesRef.current === 0,
              hintsUsed: Math.min(mistakesRef.current, 9),
            }),
          500,
        );
      }
    } else {
      mistakesRef.current += 1;
      setWrongAt(n);
      window.setTimeout(() => setWrongAt(null), 500);
    }
  };

  const progressPct = ((nextExpected - 1) / count) * 100;

  return (
    <div className="flex flex-col items-center gap-5">
      {/* Field */}
      <div className="relative h-[340px] w-full max-w-lg overflow-hidden rounded-3xl border-4 border-line bg-gradient-to-b from-surface to-surface-muted shadow-soft md:h-[400px]">
        {item.map((stone) => {
          const tapped = stone.n < nextExpected;
          return (
            <button
              key={stone.n}
              onClick={() => tap(stone.n)}
              disabled={tapped}
              aria-label={`Stone ${stone.n}`}
              style={{ left: `${stone.x}%`, top: `${stone.y}%` }}
              className={
                "absolute flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 text-xl font-extrabold tabular-nums shadow-soft transition-all active:scale-[0.92] disabled:opacity-25 " +
                (wrongAt === stone.n
                  ? "border-danger! bg-danger/15! text-danger shake"
                  : tapped
                    ? "border-ok/60 bg-ok/10 text-ok"
                    : "border-line bg-surface text-ink hover:border-accent")
              }
            >
              {stone.n}
            </button>
          );
        })}
      </div>

      {/* Progress */}
      <div className="w-full max-w-xs">
        <div className="h-2 overflow-hidden rounded-full bg-line">
          <div
            className="h-full rounded-full bg-accent transition-all duration-200"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <p className="mt-1.5 text-center text-sm font-semibold text-ink-soft">
          Next: {Math.min(nextExpected, count)} · ✗ {mistakesRef.current}
        </p>
      </div>
      <style>{`@keyframes shake{0%,100%{transform:translate(-50%,-50%)}25%{transform:translate(calc(-50% - 6px),-50%)}75%{transform:translate(calc(-50% + 6px),-50%)}} .shake{animation:shake .4s ease-in-out}`}</style>
    </div>
  );
}
