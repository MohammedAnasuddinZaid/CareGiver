"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { difficultyLevel } from "@/lib/cognition/traits";
import { mulberry32, randInt, shuffle } from "@/lib/games/rng";
import type { GameStageProps } from "./faces-game";
import type { TrialOutcome } from "@/hooks/use-game-session";
import { PhrasePlayer } from "@/lib/audio/phrase-player";

/**
 * "Find the Target" — a visual-search task for selective attention and
 * visuospatial scanning. The player locates one unique item in a grid of
 * distractors. Visual search speed/target-distractor similarity is a classic
 * attention measure (Treisman feature-integration style); harder levels add a
 * second, similar distractor to demand more focused scanning.
 *
 * One trial = one grid. Difficulty scales grid size and distractor variety.
 */
const TARGETS = ["⭐", "🌸", "🍎", "🐱", "🚀", "🟣", "🔔", "🍩"];
const DISTRACTORS = ["🍊", "🍇", "🌼", "🐶", "🟢", "🔶", "🥕", "🐟", "🌿", "🧩", "🍪", "🐘"];

export function TargetGame({ difficulty, itemKey, startTrial, completeTrial }: GameStageProps) {
  const level = Math.max(0, difficultyLevel(difficulty));
  const playerRef = useRefPhrasePlayer();
  const timers = useRef<number[]>([]);
  const [cells, setCells] = useState<{ emoji: string; target: boolean }[]>([]);
  const [cols, setCols] = useState(3);
  const [targetEmoji, setTargetEmoji] = useState("");
  const [picked, setPicked] = useState<number | null>(null);
  const doneRef = useRef(false);

  const clearTimers = useCallback(() => {
    for (const t of timers.current) window.clearTimeout(t);
    timers.current = [];
  }, []);

  const layout = useMemo(() => {
    const size = [3, 3, 4, 4, 5][Math.min(level, 4)];
    const distractorCount = level >= 3 ? 2 : 1;
    return { size, distractorCount };
  }, [level]);

  useEffect(() => {
    const rand = mulberry32(itemKey * 877 + 13);
    const target = TARGETS[randInt(rand, 0, TARGETS.length - 1)];
    const others = DISTRACTORS.filter((d) => d !== target);
    const chosen = shuffle(others, rand).slice(0, layout.distractorCount);
    const total = layout.size * layout.size;
    const targetPos = randInt(rand, 0, total - 1);
    const grid: { emoji: string; target: boolean }[] = [];
    for (let i = 0; i < total; i++) {
      if (i === targetPos) grid.push({ emoji: target, target: true });
      else grid.push({ emoji: chosen[randInt(rand, 0, chosen.length - 1)], target: false });
    }
    setCols(layout.size);
    setTargetEmoji(target);
    setCells(grid);
    setPicked(null);
    doneRef.current = false;
    startTrial(`target:${itemKey}`);
    return clearTimers;
  }, [layout, itemKey, startTrial, clearTimers]);

  const finish = useCallback(
    (correct: boolean) => {
      if (doneRef.current) return;
      doneRef.current = true;
      clearTimers();
      window.setTimeout(() => completeTrial({ correct, hintsUsed: correct ? 0 : 1 }), 800);
    },
    [clearTimers, completeTrial],
  );

  const tap = (pos: number) => {
    if (doneRef.current || picked !== null) return;
    setPicked(pos);
    const correct = cells[pos]?.target === true;
    if (correct) {
      playerRef.current.tone("success");
    } else {
      playerRef.current.tone("miss");
    }
    finish(correct);
  };

  return (
    <div className="flex flex-col items-center gap-5">
      <p className="text-lg font-semibold text-ink-soft">Tap the one that matches:</p>
      <div className="flex h-20 w-20 items-center justify-center rounded-2xl border-4 border-accent bg-accent-soft text-5xl shadow-lift">
        {targetEmoji}
      </div>

      <div
        className="grid w-full max-w-sm gap-2"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {cells.map((cell, i) => (
          <button
            key={i}
            onClick={() => tap(i)}
            disabled={picked !== null}
            className={
              "flex aspect-square items-center justify-center rounded-2xl border-2 text-4xl shadow-soft transition-all active:scale-95 disabled:opacity-70 " +
              (picked === i
                ? cell.target
                  ? "border-ok! bg-ok/10!"
                  : "border-danger/60! bg-danger/5!"
                : picked !== null && cell.target
                  ? "border-ok/60 bg-ok/5"
                  : "border-line bg-surface hover:border-accent")
            }
            aria-label={cell.target ? "The matching item" : "Distractor"}
          >
            {cell.emoji}
          </button>
        ))}
      </div>
    </div>
  );
}

function useRefPhrasePlayer() {
  const [ref] = useState(() => ({ current: new PhrasePlayer() }));
  useEffect(() => () => ref.current.reset(), [ref]);
  return ref;
}
