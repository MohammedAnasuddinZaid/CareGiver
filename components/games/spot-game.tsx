"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { difficultyLevel } from "@/lib/cognition/traits";
import { mulberry32, shuffle } from "@/lib/games/rng";
import type { GameStageProps } from "./faces-game";
import type { TrialOutcome } from "@/hooks/use-game-session";
import { PhrasePlayer } from "@/lib/audio/phrase-player";

/**
 * "Spot the Change" — a visual/spatial memory task. The player studies a
 * grid of colored tiles, then the grid is shown again with exactly one tile
 * altered; they tap the changed tile. Trains the same "where did I put it"
 * memory used in everyday object location. Grid grows with difficulty.
 */
const PALETTE = [
  "#ef4444", "#f59e0b", "#10b981", "#3b82f6", "#8b5cf6",
  "#ec4899", "#14b8a6", "#f97316", "#84cc16", "#06b6d4",
  "#eab308", "#a855f7", "#22c55e", "#e11d48", "#0ea5e9",
];

interface Tile {
  color: string;
  shape: number;
}

export function SpotGame({ difficulty, itemKey, startTrial, completeTrial }: GameStageProps) {
  const level = Math.max(0, difficultyLevel(difficulty));
  const size = level >= 3 ? 4 : 3; // 3×3 → 4×4
  const count = size * size;

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

  const { first, second, changedIndex } = useMemo(() => {
    const rand = mulberry32(itemKey * 1103515245 + 23);
    const colors = shuffle(PALETTE, rand).slice(0, count);
    const shapes = Array.from({ length: count }, () => Math.floor(rand() * 3));
    const base: Tile[] = colors.map((c, i) => ({ color: c, shape: shapes[i] }));
    const changeAt = Math.floor(rand() * count);
    let newColor = base[changeAt].color;
    let guard = 0;
    while (newColor === base[changeAt].color && guard++ < 20) {
      newColor = PALETTE[Math.floor(rand() * PALETTE.length)];
    }
    const after = base.map((t, i) =>
      i === changeAt ? { color: newColor, shape: t.shape } : t,
    );
    return { first: base, second: after, changedIndex: changeAt };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemKey, count]);

  const [phase, setPhase] = useState<"study" | "find">("study");
  const [picked, setPicked] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);
  const doneRef = useRef(false);

  useEffect(() => {
    setPhase("study");
    setPicked(null);
    setFeedback(null);
    doneRef.current = false;
    later(() => {
      setPhase("find");
      startTrial(`spot:${itemKey}`);
    }, 2600);
    return clearTimers;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemKey]);

  const renderShape = (shape: number, color: string): React.ReactNode => {
    if (shape === 0) return <div className="h-2/3 w-2/3 rounded-full" style={{ background: color }} />;
    if (shape === 1) return <div className="h-2/3 w-2/3" style={{ background: color, clipPath: "polygon(50% 0,100% 100%,0 100%)" }} />;
    return <div className="h-2/3 w-2/3 rounded-md" style={{ background: color }} />;
  };

  const choose = (i: number): void => {
    if (phase !== "find" || picked || doneRef.current) return;
    setPicked(i);
    const correct = i === changedIndex;
    setFeedback(correct ? "correct" : "wrong");
    doneRef.current = true;
    if (correct) playerRef.current.tone("success");
    else playerRef.current.tone("miss");
    later(() => completeTrial({ correct, hintsUsed: 0 } satisfies TrialOutcome), correct ? 800 : 1200);
  };

  return (
    <div className="flex flex-col items-center gap-5">
      <p className="text-center text-lg font-semibold text-ink-soft">
        {phase === "study" ? "Remember the grid…" : "Which tile changed?"}
      </p>
      <div
        className="grid w-full max-w-sm gap-2"
        style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }}
      >
        {(phase === "study" ? first : second).map((tile, i) => {
          const isChanged = phase === "find" && i === changedIndex;
          return (
            <button
              key={i}
              onClick={() => choose(i)}
              disabled={phase === "study"}
              aria-label={`Tile ${i + 1}`}
              className={
                "flex aspect-square items-center justify-center rounded-2xl border-2 transition-all " +
                (phase === "study"
                  ? "border-line opacity-90"
                  : picked === i
                    ? i === changedIndex
                      ? "border-ok! bg-ok/10!"
                      : "border-danger/60! bg-danger/5!"
                    : isChanged && picked !== null
                      ? "border-ok! bg-ok/10!"
                      : "border-line bg-surface hover:border-accent")
              }
            >
              {renderShape(tile.shape, tile.color)}
            </button>
          );
        })}
      </div>
      {feedback && (
        <div role="status" aria-live="polite" className="animate-fade-in rounded-full bg-accent px-6 py-2 text-lg font-bold text-white">
          {feedback === "correct" ? "Well spotted! ✓" : "Look again next time"}
        </div>
      )}
    </div>
  );
}
