"use client";

import { useEffect, useMemo, useState } from "react";
import { difficultyLevel } from "@/lib/cognition/traits";
import { mulberry32, shuffle } from "@/lib/games/rng";
import type { GameStageProps } from "./faces-game";
import type { TrialOutcome } from "@/hooks/use-game-session";

/**
 * "Odd One Out" — semantic categorization + visual discrimination
 * (executive). Categories use familiar everyday sets; at higher levels the
 * intruder comes from a semantically CLOSE category (fruit among
 * vegetables), which is exactly the discrimination CST trains.
 */

interface Category {
  id: string;
  members: string[];
  /** Semantically adjacent category used for hard intruders. */
  near?: string;
}

const CATEGORIES: readonly Category[] = [
  { id: "fruit", members: ["🍎", "🍌", "🍇", "🍊", "🥭"], near: "vegetable" },
  {
    id: "vegetable",
    members: ["🥔", "🥕", "🥬", "🌽", "🫑"],
    near: "fruit",
  },
  { id: "animal", members: ["🐘", "🐐", "🐔", "🐕", "🐈"], near: "bird" },
  { id: "bird", members: ["🦜", "🦚", "🦆", "🐔", "🕊️"], near: "animal" },
  { id: "vehicle", members: ["🚌", "🚂", "✈️", "🛵", "🚲"], near: "household" },
  { id: "household", members: ["☕", "🪔", "🧺", "🕯️", "🔑"], near: "vehicle" },
];

function makeItem(seed: number, level: number): {
  cells: string[];
  oddIndex: number;
} {
  const rand = mulberry32(seed * 92821 + 17);
  const main = CATEGORIES[Math.floor(rand() * CATEGORIES.length)];
  const nearCat =
    level >= 2 && main.near
      ? CATEGORIES.find((c) => c.id === main.near) ?? null
      : null;

  const size = Math.min(9, 4 + level); // grid grows with difficulty
  const fillers = shuffle(main.members, rand);
  const cells: string[] = [];
  for (let i = 0; i < size - 1; i++) {
    cells.push(fillers[i % fillers.length]);
  }
  // Intruder: from a NEAR category (hard) or any other category (easy).
  const intruderPool = nearCat
    ? nearCat.members.filter((m) => !main.members.includes(m))
    : CATEGORIES.filter((c) => c.id !== main.id)
        .flatMap((c) => c.members)
        .filter((m) => !main.members.includes(m));
  const intruder = intruderPool[Math.floor(rand() * intruderPool.length)];
  cells.push(intruder);

  const shuffled = shuffle(cells, rand);
  const oddIndex = shuffled.indexOf(intruder);
  return { cells: shuffled, oddIndex };
}

export function OddOneGame({
  difficulty,
  itemKey,
  startTrial,
  completeTrial,
}: GameStageProps) {
  const level = Math.max(0, difficultyLevel(difficulty));
  const item = useMemo(() => makeItem(itemKey, level), [itemKey, level]);
  const [picked, setPicked] = useState<number | null>(null);

  useEffect(() => {
    setPicked(null);
    startTrial(`oddone:${itemKey}`);
  }, [itemKey, startTrial]);

  const pick = (index: number): void => {
    if (picked !== null) return;
    setPicked(index);
    const outcome: TrialOutcome = { correct: index === item.oddIndex };
    window.setTimeout(() => completeTrial(outcome), 650);
  };

  const cols = item.cells.length <= 4 ? 2 : item.cells.length <= 6 ? 3 : 3;

  return (
    <div className="flex flex-col items-center gap-6">
      <div
        className="grid w-full max-w-md gap-2.5"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {item.cells.map((emoji, i) => (
          <button
            key={i}
            onClick={() => pick(i)}
            disabled={picked !== null}
            className={
              "flex aspect-square items-center justify-center rounded-3xl border-2 text-5xl shadow-soft transition-all active:scale-[0.95] disabled:opacity-70 " +
              (picked === i
                ? i === item.oddIndex
                  ? "border-ok! bg-ok/10!"
                  : "border-danger/60! bg-danger/5!"
                : picked !== null && i === item.oddIndex
                  ? "border-ok! bg-ok/10!"
                  : "border-line bg-surface hover:border-accent")
            }
          >
            {emoji}
          </button>
        ))}
      </div>
      <p className="text-base font-semibold text-ink-soft">
        One of these is not like the others — tap it.
      </p>
    </div>
  );
}
