"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { difficultyLevel } from "@/lib/cognition/traits";
import { mulberry32, shuffle } from "@/lib/games/rng";
import type { GameStageProps } from "./faces-game";
import type { TrialOutcome } from "@/hooks/use-game-session";

/**
 * "Bazaar Maths" — money-change calculation (executive / daily living).
 * Ecologically valid for the region's markets: pay a note, compute the
 * change. Difficulty grows the amounts and adds multi-item baskets.
 */

interface BazaarItem {
  id: string;
  emoji: string;
  name: string;
}

const GOODS: readonly BazaarItem[] = [
  { id: "tea", emoji: "🍃", name: "Tea" },
  { id: "orange", emoji: "🍊", name: "Oranges" },
  { id: "chili", emoji: "🌶️", name: "Chili" },
  { id: "fish", emoji: "🐟", name: "Fish" },
  { id: "rice", emoji: "🍚", name: "Rice" },
  { id: "eggs", emoji: "🥚", name: "Eggs" },
];

const NOTES = [10, 20, 50, 100] as const;

interface Problem {
  items: BazaarItem[];
  prices: number[];
  paid: number;
  answer: number;
  options: number[];
}

function makeProblem(seed: number, level: number): Problem {
  const rand = mulberry32(seed * 48611 + 3);
  const itemCount = level <= 1 ? 1 : level <= 3 ? randInt(rand, 1, 2) : 2;
  const items = shuffle(GOODS, rand).slice(0, itemCount);
  const base = 5 + level * 5;
  const prices = items.map(() => {
    const step = randInt(rand, 1, 4); // in ₹5 units
    return Math.min(95, base + step * 5);
  });
  const total = prices.reduce((s, p) => s + p, 0);
  const note =
    NOTES.find((n) => n >= total) ??
    NOTES[NOTES.length - 1];
  // Round payment up to the smallest usable note above total.
  const paid = Math.max(note, Math.ceil(total / 10) * 10);
  const answer = paid - total;

  // Exactly three unique non-negative distractors, always — thin candidate
  // pools near small answers previously collapsed the board to 3 options.
  // `total` is included as a "forgot to subtract" lure when it differs.
  const distractors = new Set<number>();
  const candidates = shuffle(
    [answer + 5, answer - 5, answer + 10, answer - 10, answer + 15, total],
    rand,
  );
  for (const c of candidates) {
    if (distractors.size >= 3) break;
    if (c !== answer && c >= 0 && Number.isInteger(c)) distractors.add(c);
  }
  let bump = 20;
  while (distractors.size < 3) {
    const c = answer + bump;
    if (c !== answer && !distractors.has(c)) distractors.add(c);
    bump += 5;
  }

  return {
    items,
    prices,
    paid,
    answer,
    options: shuffle([answer, ...distractors], rand),
  };
}

function randInt(rand: () => number, min: number, max: number): number {
  return min + Math.floor(rand() * (max - min + 1));
}

export function BazaarGame({
  difficulty,
  itemKey,
  startTrial,
  completeTrial,
}: GameStageProps) {
  const level = Math.max(0, difficultyLevel(difficulty));
  const problem = useMemo(() => makeProblem(itemKey, level), [itemKey, level]);
  const [picked, setPicked] = useState<number | null>(null);
  const [hintShown, setHintShown] = useState(false);

  const timersRef = useRef<number[]>([]);
  const later = useCallback((fn: () => void, ms: number): void => {
    timersRef.current.push(window.setTimeout(fn, ms));
  }, []);
  const clearTimers = useCallback((): void => {
    for (const t of timersRef.current) window.clearTimeout(t);
    timersRef.current = [];
  }, []);

  useEffect(() => {
    setPicked(null);
    setHintShown(false);
    startTrial(`bazaar:${itemKey}`);
    // Gentle scaffold at high difficulty: show the sum after 12 s.
    if (level >= 3) {
      const t = window.setTimeout(() => setHintShown(true), 12_000);
      return () => window.clearTimeout(t);
    }
  }, [itemKey, level, startTrial]);

  useEffect(() => {
    setPicked(null);
    setHintShown(false);
    return clearTimers;
  }, [itemKey, clearTimers]);

  useEffect(() => () => clearTimers(), [clearTimers]);

  const total = problem.prices.reduce((s, p) => s + p, 0);

  const pick = (value: number): void => {
    if (picked !== null) return;
    setPicked(value);
    const correct = value === problem.answer;
    later(
      () =>
        completeTrial({
          correct,
          hintsUsed: hintShown ? 1 : 0,
        }),
      650,
    );
  };

  return (
    <div className="flex flex-col items-center gap-7">
      {/* The stall */}
      <div className="flex w-full flex-wrap items-stretch justify-center gap-3">
        {problem.items.map((item, i) => (
          <div
            key={item.id}
            className="flex min-w-[110px] flex-col items-center gap-1 rounded-3xl border-2 border-line bg-surface px-4 py-4 shadow-soft"
          >
            <span className="text-4xl">{item.emoji}</span>
            <span className="text-sm font-semibold text-ink">{item.name}</span>
            <span className="rounded-full bg-accent-soft px-3 py-0.5 text-base font-extrabold tabular-nums text-accent">
              ₹{problem.prices[i]}
            </span>
          </div>
        ))}
        <div className="flex min-w-[110px] flex-col items-center gap-1 rounded-3xl border-2 border-dashed border-accent/50 bg-accent-soft/40 px-4 py-4">
          <span className="text-3xl">💵</span>
          <span className="text-sm font-semibold text-ink">You pay</span>
          <span className="rounded-full bg-accent px-3 py-0.5 text-base font-extrabold tabular-nums text-white">
            ₹{problem.paid}
          </span>
        </div>
      </div>

      <p className="text-xl font-bold text-ink">Change = ?</p>

      {hintShown && (
        <p className="animate-fade-in rounded-full bg-surface-muted px-4 py-1.5 text-base font-semibold text-ink-soft">
          Items add up to ₹{total}
        </p>
      )}

      {/* Options */}
      <div className="grid w-full max-w-md grid-cols-2 gap-3">
        {problem.options.map((value) => (
          <button
            key={value}
            onClick={() => pick(value)}
            disabled={picked !== null}
            className={
              "min-h-[72px] rounded-3xl border-2 bg-surface text-2xl font-extrabold tabular-nums shadow-soft transition-all active:scale-[0.97] disabled:opacity-60 " +
              (picked === value
                ? value === problem.answer
                  ? "border-ok! bg-ok/10! text-ok"
                  : "border-danger/60! bg-danger/5! text-danger"
                : picked !== null && value === problem.answer
                  ? "border-ok! bg-ok/10! text-ok"
                  : "border-line text-ink hover:border-accent")
            }
          >
            ₹{value}
          </button>
        ))}
      </div>
    </div>
  );
}
