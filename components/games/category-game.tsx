"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { difficultyLevel } from "@/lib/cognition/traits";
import { mulberry32, randInt, shuffle } from "@/lib/games/rng";
import type { GameStageProps } from "./faces-game";
import type { TrialOutcome } from "@/hooks/use-game-session";
import { PhrasePlayer } from "@/lib/audio/phrase-player";

/**
 * "Category Sort" — a semantic sorting task for executive function and
 * categorical reasoning. The player places each object into the right group
 * (fruits vs animals, eat vs drink, big vs small). Categorisation is a core
 * cognitive skill and a gentle proxy for semantic memory; grouping also
 * features in Montessori-style dementia activities.
 *
 * One trial = one object. Difficulty shifts the contrasts from obvious
 * (fruit/animal) to finer (eat/drink, big/small).
 */
interface CatItem {
  emoji: string;
  label: string;
  bin: 0 | 1;
}
interface CatSet {
  bins: [string, string];
  items: CatItem[];
}
const SETS: CatSet[] = [
  {
    bins: ["Fruits", "Animals"],
    items: [
      { emoji: "🍎", label: "Apple", bin: 0 },
      { emoji: "🐶", label: "Dog", bin: 1 },
      { emoji: "🍌", label: "Banana", bin: 0 },
      { emoji: "🐱", label: "Cat", bin: 1 },
      { emoji: "🍓", label: "Strawberry", bin: 0 },
      { emoji: "🐦", label: "Bird", bin: 1 },
    ],
  },
  {
    bins: ["Food", "Clothes"],
    items: [
      { emoji: "🍞", label: "Bread", bin: 0 },
      { emoji: "👕", label: "Shirt", bin: 1 },
      { emoji: "🥚", label: "Egg", bin: 0 },
      { emoji: "🧦", label: "Socks", bin: 1 },
      { emoji: "🍚", label: "Rice", bin: 0 },
      { emoji: "🧢", label: "Cap", bin: 1 },
    ],
  },
  {
    bins: ["Eat", "Drink"],
    items: [
      { emoji: "🍎", label: "Apple", bin: 0 },
      { emoji: "💧", label: "Water", bin: 1 },
      { emoji: "🍌", label: "Banana", bin: 0 },
      { emoji: "🥛", label: "Milk", bin: 1 },
      { emoji: "🍞", label: "Bread", bin: 0 },
      { emoji: "🧃", label: "Juice", bin: 1 },
    ],
  },
  {
    bins: ["Indoor", "Outdoor"],
    items: [
      { emoji: "🛏️", label: "Bed", bin: 0 },
      { emoji: "🌳", label: "Tree", bin: 1 },
      { emoji: "🪑", label: "Chair", bin: 0 },
      { emoji: "🌞", label: "Sun", bin: 1 },
      { emoji: "📺", label: "TV", bin: 0 },
      { emoji: "⚽", label: "Ball", bin: 1 },
    ],
  },
  {
    bins: ["Big", "Small"],
    items: [
      { emoji: "🐘", label: "Elephant", bin: 0 },
      { emoji: "🐜", label: "Ant", bin: 1 },
      { emoji: "🐳", label: "Whale", bin: 0 },
      { emoji: "🐭", label: "Mouse", bin: 1 },
      { emoji: "🏠", label: "House", bin: 0 },
      { emoji: "🔑", label: "Key", bin: 1 },
    ],
  },
];

export function CategoryGame({ difficulty, itemKey, startTrial, completeTrial }: GameStageProps) {
  const level = Math.max(0, difficultyLevel(difficulty));
  const playerRef = useRefPhrasePlayer();
  const timers = useRef<number[]>([]);
  const [item, setItem] = useState<CatItem | null>(null);
  const [bins, setBins] = useState<[number, number]>([0, 1]);
  const [picked, setPicked] = useState<number | null>(null);
  const doneRef = useRef(false);

  const set = useMemo<CatSet>(() => {
    const rand = mulberry32(itemKey * 433 + 3);
    let pool: number[];
    if (level <= 1) pool = [0, 1];
    else if (level <= 3) pool = [2, 3];
    else pool = [4];
    const idx = pool[randInt(rand, 0, pool.length - 1)];
    return SETS[idx];
  }, [itemKey, level]);

  const clearTimers = useCallback(() => {
    for (const t of timers.current) window.clearTimeout(t);
    timers.current = [];
  }, []);

  useEffect(() => {
    const rand = mulberry32(itemKey * 193 + 11);
    const it = set.items[randInt(rand, 0, set.items.length - 1)];
    // Shuffle which side each bin appears on.
    const order = shuffle([0, 1], rand) as [number, number];
    setItem(it);
    setBins(order);
    setPicked(null);
    doneRef.current = false;
    startTrial(`category:${itemKey}`);
    return clearTimers;
  }, [set, itemKey, startTrial, clearTimers]);

  const finish = useCallback(
    (correct: boolean) => {
      if (doneRef.current) return;
      doneRef.current = true;
      clearTimers();
      window.setTimeout(() => completeTrial({ correct, hintsUsed: correct ? 0 : 1 }), 800);
    },
    [clearTimers, completeTrial],
  );

  const choose = (side: number) => {
    if (doneRef.current || picked !== null || !item) return;
    setPicked(side);
    const correctBin = item.bin;
    const chosenBin = bins[side];
    const correct = chosenBin === correctBin;
    if (correct) {
      playerRef.current.tone("success");
      playerRef.current.speak(item.label, "");
    } else {
      playerRef.current.tone("miss");
    }
    finish(correct);
  };

  if (!item) {
    return <div className="animate-pulse-soft rounded-3xl bg-surface-muted p-10" />;
  }

  return (
    <div className="flex flex-col items-center gap-7">
      <p className="text-lg font-semibold text-ink-soft">Where does this belong?</p>
      <div className="flex h-28 w-28 items-center justify-center rounded-[2rem] border-4 border-line bg-surface text-6xl shadow-lift">
        {item.emoji}
      </div>
      <p className="text-2xl font-extrabold text-ink">{item.label}</p>

      <div className="grid w-full max-w-md grid-cols-2 gap-4">
        {bins.map((binIndex, side) => (
          <button
            key={side}
            onClick={() => choose(side)}
            disabled={picked !== null}
            className={
              "flex min-h-[96px] flex-col items-center justify-center gap-1 rounded-3xl border-2 px-3 py-4 text-center shadow-soft transition-all active:scale-[0.97] disabled:opacity-70 " +
              (picked === side
                ? bins[side] === item.bin
                  ? "border-ok! bg-ok/10!"
                  : "border-danger/60! bg-danger/5!"
                : picked !== null
                  ? bins[side] === item.bin
                    ? "border-ok/60 bg-ok/5"
                    : "border-line opacity-50"
                  : "border-line hover:border-accent")
            }
          >
            <span className="text-xl font-extrabold text-ink">{set.bins[binIndex]}</span>
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
