"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { difficultyLevel } from "@/lib/cognition/traits";
import { mulberry32, randInt, shuffle } from "@/lib/games/rng";
import type { GameStageProps } from "./faces-game";
import type { TrialOutcome } from "@/hooks/use-game-session";

/**
 * "Color Trap" — an elderly-friendly Stroop task (attention + inhibition).
 * A color WORD is printed in a conflicting INK; the player must tap the
 * INK, ignoring what the word says. Incongruence probability and option
 * count scale with difficulty. No time pressure — accuracy first.
 */

interface ColorDef {
  id: string;
  label: string;
  css: string;
}

const COLORS: readonly ColorDef[] = [
  { id: "red", label: "RED", css: "#dc2626" },
  { id: "green", label: "GREEN", css: "#16a34a" },
  { id: "blue", label: "BLUE", css: "#2563eb" },
  { id: "yellow", label: "YELLOW", css: "#ca8a04" },
];

function makeItem(seed: number, level: number): {
  word: ColorDef;
  ink: ColorDef;
  options: ColorDef[];
} {
  const rand = mulberry32(seed * 15487767 + 5);
  const pool = COLORS.slice(0, Math.min(4, 2 + level));
  const word = pool[randInt(rand, 0, pool.length - 1)];
  // Incongruent ink becomes more likely with level (easy: often matches).
  const congruent = rand() > Math.min(0.85, 0.25 + level * 0.18);
  let ink = word;
  if (!congruent) {
    const others = pool.filter((c) => c.id !== word.id);
    if (others.length > 0) ink = others[randInt(rand, 0, others.length - 1)];
  }
  const distractors = shuffle(
    pool.filter((c) => c.id !== ink.id),
    rand,
  ).slice(0, Math.min(pool.length - 1, 2));
  return { word, ink, options: shuffle([ink, ...distractors], rand) };
}

export function StroopGame({
  difficulty,
  itemKey,
  startTrial,
  completeTrial,
}: GameStageProps) {
  const level = Math.max(0, difficultyLevel(difficulty));
  const item = useMemo(() => makeItem(itemKey, level), [itemKey, level]);
  const [picked, setPicked] = useState<string | null>(null);

  const timersRef = useRef<number[]>([]);
  const later = useCallback((fn: () => void, ms: number): void => {
    timersRef.current.push(window.setTimeout(fn, ms));
  }, []);
  useEffect(() => {
    setPicked(null);
    return () => {
      for (const t of timersRef.current) window.clearTimeout(t);
      timersRef.current = [];
    };
  }, [itemKey]);

  useEffect(() => {
    setPicked(null);
    startTrial(`stroop:${itemKey}`);
  }, [itemKey, startTrial]);

  const pick = (colorId: string): void => {
    if (picked !== null) return;
    setPicked(colorId);
    const outcome: TrialOutcome = { correct: colorId === item.ink.id };
    later(() => completeTrial(outcome), 600);
  };

  return (
    <div className="flex flex-col items-center gap-9">
      {/* The trap: word printed in a different ink */}
      <div className="flex h-32 w-full max-w-md items-center justify-center rounded-3xl border-4 border-line bg-white shadow-soft">
        <span
          className="text-6xl font-black tracking-wide md:text-7xl"
          style={{ color: item.ink.css }}
        >
          {item.word.label}
        </span>
      </div>

      <p className="text-center text-lg font-bold text-ink">
        Tap the <span className="text-accent">INK</span> color — ignore the
        word!
      </p>

      <div
        className="grid w-full max-w-sm gap-3"
        style={{ gridTemplateColumns: `repeat(${Math.min(3, item.options.length)}, minmax(0, 1fr))` }}
      >
        {item.options.map((c) => (
          <button
            key={c.id}
            onClick={() => pick(c.id)}
            disabled={picked !== null}
            aria-label={c.label}
            className={
              "flex min-h-[76px] items-center justify-center rounded-3xl border-4 shadow-soft transition-all active:scale-[0.95] disabled:opacity-60 " +
              (picked === c.id
                ? c.id === item.ink.id
                  ? "border-ok!"
                  : "border-danger!"
                : picked !== null && c.id === item.ink.id
                  ? "border-ok!"
                  : "border-line")
            }
          >
            <span
              className="h-9 w-16 rounded-xl"
              style={{ backgroundColor: c.css }}
            />
          </button>
        ))}
      </div>
    </div>
  );
}
