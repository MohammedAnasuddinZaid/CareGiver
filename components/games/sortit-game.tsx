"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { difficultyLevel } from "@/lib/cognition/traits";
import { mulberry32, shuffle } from "@/lib/games/rng";
import type { GameStageProps } from "./faces-game";

/**
 * "Sorting Station" — semantic categorization, a core Cognitive
 * Stimulation Therapy activity (Spector et al., 2003). Sorting everyday
 * items into familiar groups exercises semantic memory and executive
 * control with zero reading demand: one big item, a few big bins.
 *
 * Difficulty ladder: 2 bins of far-apart categories → 3 bins → visually
 * or semantically confusable sets (fruit vs vegetables).
 * Errorless scoring: wrong bin shakes and counts as a hint; the item
 * stays until sorted correctly.
 */

interface Category {
  id: string;
  label: string;
  emoji: string;
  members: readonly string[];
}

const CATEGORIES: readonly Category[] = [
  {
    id: "fruit",
    label: "Fruits",
    emoji: "🍎",
    members: ["🍎", "🍌", "🍇", "🍊", "🥭", "🍉"],
  },
  {
    id: "vegetable",
    label: "Vegetables",
    emoji: "🥕",
    members: ["🥔", "🥕", "🥬", "🌽", "🫑", "🧅"],
  },
  {
    id: "animal",
    label: "Animals",
    emoji: "🐘",
    members: ["🐘", "🐐", "🐕", "🐈", "🐮", "🐔"],
  },
  {
    id: "vehicle",
    label: "Vehicles",
    emoji: "🚌",
    members: ["🚌", "🚂", "✈️", "🛵", "🚲", "🚢"],
  },
  {
    id: "household",
    label: "Home things",
    emoji: "🏠",
    members: ["☕", "🪔", "🧺", "🕯️", "🔑", "⏰"],
  },
  {
    id: "clothes",
    label: "Clothes",
    emoji: "👕",
    members: ["👕", "👗", "🧣", "👟", "🎒", "👒"],
  },
];

/** Pairs that are easy (far apart) vs hard (confusable) at high levels. */
const EASY_PAIRS: readonly [string, string][] = [
  ["fruit", "vehicle"],
  ["animal", "household"],
  ["clothes", "animal"],
  ["vegetable", "vehicle"],
];
const HARD_PAIRS: readonly [string, string][] = [
  ["fruit", "vegetable"],
  ["animal", "clothes"],
  ["household", "vegetable"],
];
const THIRD_WHEELS: readonly string[] = ["household", "clothes", "animal"];

const EMOJI_NAME: Record<string, string> = {
  "🍎": "Apple", "🍌": "Banana", "🍇": "Grapes", "🍊": "Orange", "🥭": "Mango", "🍉": "Melon",
  "🥔": "Potato", "🥕": "Carrot", "🥬": "Greens", "🌽": "Corn", "🫑": "Capsicum", "🧅": "Onion",
  "🐘": "Elephant", "🐐": "Goat", "🐕": "Dog", "🐈": "Cat", "🐮": "Cow", "🐔": "Hen",
  "🚌": "Bus", "🚂": "Train", "✈️": "Aeroplane", "🛵": "Scooter", "🚲": "Bicycle", "🚢": "Ship",
  "☕": "Cup", "🪔": "Lamp", "🧺": "Basket", "🕯️": "Candle", "🔑": "Key", "⏰": "Clock",
  "👕": "Shirt", "👗": "Dress", "🧣": "Scarf", "👟": "Shoe", "🎒": "Bag", "👒": "Hat",
};

export function SortItGame({
  difficulty,
  itemKey,
  startTrial,
  completeTrial,
}: GameStageProps) {
  const level = Math.max(0, difficultyLevel(difficulty));

  const doneRef = useRef(false);
  const correctionsRef = useRef(0);
  const [wrongBin, setWrongBin] = useState<string | null>(null);

  const item = useMemo(() => {
    const rand = mulberry32(itemKey * 6421 + 97);
    // Choose bin set by difficulty.
    const pair =
      level >= 2 && rand() < 0.6
        ? HARD_PAIRS[Math.floor(rand() * HARD_PAIRS.length)]
        : EASY_PAIRS[Math.floor(rand() * EASY_PAIRS.length)];
    const bins = level >= 3 ? [...pair, THIRD_WHEELS[Math.floor(rand() * THIRD_WHEELS.length)]] : [...pair];
    const shuffledBins = shuffle(
      bins.map((id) => CATEGORIES.find((c) => c.id === id)!),
      rand,
    );
    const targetCategory = shuffledBins[Math.floor(rand() * shuffledBins.length)];
    const emoji =
      targetCategory.members[Math.floor(rand() * targetCategory.members.length)];
    return { bins: shuffledBins, targetCategory, emoji };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemKey, level]);

  useEffect(() => {
    doneRef.current = false;
    correctionsRef.current = 0;
    setWrongBin(null);
    startTrial(`sortit:${itemKey}:${item.targetCategory.id}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item]);

  const finish = useCallback(
    (correct: boolean): void => {
      if (doneRef.current) return;
      doneRef.current = true;
      completeTrial({
        correct,
        hintsUsed: correct ? Math.min(correctionsRef.current, 9) : 9,
      });
    },
    [completeTrial],
  );

  const sortInto = (categoryId: string): void => {
    if (doneRef.current) return;
    if (categoryId === item.targetCategory.id) {
      finish(true);
    } else {
      correctionsRef.current += 1;
      setWrongBin(categoryId);
      window.setTimeout(() => setWrongBin(null), 500);
    }
  };

  return (
    <div className="flex flex-col items-center gap-8">
      {/* The item card */}
      <div className="animate-fade-in flex h-40 w-40 items-center justify-center rounded-[2rem] border-4 border-accent/40 bg-surface shadow-lift" key={String(itemKey)}>
        <span className="text-8xl">{item.emoji}</span>
      </div>
      <p className="-mt-2 text-lg font-bold text-ink">
        {EMOJI_NAME[item.emoji] ?? item.emoji} — where does it go?
      </p>

      {/* Bins */}
      <div
        className="grid w-full max-w-xl gap-3"
        style={{ gridTemplateColumns: `repeat(${Math.min(item.bins.length, 3)}, minmax(0, 1fr))` }}
      >
        {item.bins.map((bin) => (
          <button
            key={bin.id}
            onClick={() => sortInto(bin.id)}
            disabled={doneRef.current}
            aria-label={`${bin.label} basket`}
            className={
              "flex min-h-[120px] flex-col items-center justify-center gap-1 rounded-3xl border-2 bg-surface px-3 py-4 shadow-soft transition-all active:scale-[0.97] " +
              (wrongBin === bin.id
                ? "animate-pulse-soft border-danger/70! bg-danger/5!"
                : "border-line hover:border-accent")
            }
          >
            <span className="text-4xl">{bin.emoji}</span>
            <span className="text-base font-bold text-ink">{bin.label}</span>
          </button>
        ))}
      </div>

      {correctionsRef.current > 0 && !doneRef.current && (
        <p role="status" className="text-base font-semibold text-warn">
          Not that one — look again 👀
        </p>
      )}
    </div>
  );
}
