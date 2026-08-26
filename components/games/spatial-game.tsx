"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { difficultyLevel } from "@/lib/cognition/traits";
import { mulberry32, randInt, shuffle } from "@/lib/games/rng";
import type { GameStageProps } from "./faces-game";
import type { TrialOutcome } from "@/hooks/use-game-session";

/**
 * "Where Did I Keep It?" — spatial memory with ecological validity
 * (keys, spectacles, cup…). Objects are shown being placed into drawers,
 * then one must be found. Delay and drawer count scale with difficulty.
 */

interface SpatialObject {
  id: string;
  emoji: string;
  name: string;
}

const OBJECTS: readonly SpatialObject[] = [
  { id: "key", emoji: "🔑", name: "Key" },
  { id: "glasses", emoji: "👓", name: "Glasses" },
  { id: "cup", emoji: "🍵", name: "Cup" },
  { id: "book", emoji: "📕", name: "Book" },
  { id: "flower", emoji: "🌺", name: "Flower" },
  { id: "ball", emoji: "⚽", name: "Ball" },
];

export function SpatialGame({
  difficulty,
  itemKey,
  startTrial,
  completeTrial,
}: GameStageProps) {
  const level = Math.max(0, difficultyLevel(difficulty));
  const gridCols = level <= 1 ? 2 : level <= 3 ? 3 : 4;
  const gridRows = 3;
  const drawers = gridCols * gridRows;
  const hiddenCount = Math.min(3, 1 + Math.floor(level / 2));

  const [phase, setPhase] = useState<"place" | "recall">("place");
  const [openDrawer, setOpenDrawer] = useState<number | null>(null);
  const [wrongPicks, setWrongPicks] = useState<number[]>([]);
  const mistakesRef = useRef(0);
  const finishedRef = useRef(false);

  const timersRef = useRef<number[]>([]);
  const later = useCallback((fn: () => void, ms: number): void => {
    timersRef.current.push(window.setTimeout(fn, ms));
  }, []);
  const clearTimers = useCallback((): void => {
    for (const t of timersRef.current) window.clearTimeout(t);
    timersRef.current = [];
  }, []);

  const item = useMemo(() => {
    const rand = mulberry32(itemKey * 6700417 + 29);
    const spots = shuffle(
      Array.from({ length: drawers }, (_, i) => i),
      rand,
    ).slice(0, hiddenCount);
    const objs = shuffle(OBJECTS, rand).slice(0, hiddenCount);
    const placements = new Map<number, SpatialObject>();
    spots.forEach((spot, i) => placements.set(spot, objs[i]));
    // Ask about a random placed object.
    const askSpot = spots[randInt(rand, 0, spots.length - 1)];
    return { placements, target: placements.get(askSpot)!, askSpot };
  }, [itemKey, drawers, hiddenCount]);

  useEffect(() => {
    setPhase("place");
    setOpenDrawer(null);
    setWrongPicks([]);
    mistakesRef.current = 0;
    finishedRef.current = false;
    startTrial(`spatial:${itemKey}`);
    const holdMs = 2600 + hiddenCount * 1200 - level * 150;
    const timer = window.setTimeout(() => setPhase("recall"), Math.max(1800, holdMs));
    return () => {
      window.clearTimeout(timer);
      clearTimers();
    };
  }, [itemKey, hiddenCount, level, startTrial, clearTimers]);

  const openSpot = (spot: number): void => {
    if (phase !== "recall" || finishedRef.current) return;
    if (spot === item.askSpot) {
      setOpenDrawer(spot);
      finishedRef.current = true;
      later(
        () =>
          completeTrial({
            correct: mistakesRef.current === 0,
            hintsUsed: Math.min(mistakesRef.current, 9),
          }),
        800,
      );
    } else {
      mistakesRef.current += 1;
      setWrongPicks((w) => [...w, spot]);
      if (mistakesRef.current >= 3) {
        finishedRef.current = true;
        setOpenDrawer(item.askSpot); // errorless reveal
        later(() => completeTrial({ correct: false, hintsUsed: 3 }), 1100);
      }
    }
  };

  return (
    <div className="flex flex-col items-center gap-6">
      <p className="text-lg font-bold text-ink">
        {phase === "place" ? (
          "👀"
        ) : (
          <>
            <span className="mr-2 text-2xl">{item.target.emoji}</span>
            Where is the {item.target.name}?
          </>
        )}
      </p>

      <div
        className="grid w-full max-w-lg gap-2.5"
        style={{ gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: drawers }, (_, i) => {
          const contents = item.placements.get(i);
          const revealed =
            phase === "place" || openDrawer === i || wrongPicks.includes(i);
          return (
            <button
              key={i}
              onClick={() => phase === "recall" && openSpot(i)}
              aria-label={`Drawer ${i + 1}`}
              className={
                "flex aspect-[5/4] items-center justify-center rounded-2xl border-2 text-4xl shadow-soft transition-all active:scale-[0.97] " +
                (revealed
                  ? "border-accent/60 bg-accent-soft"
                  : "border-line bg-surface hover:border-accent") +
                (wrongPicks.includes(i) ? " border-danger/50! bg-danger/5!" : "")
              }
            >
              {contents && revealed ? contents.emoji : ""}
              {!revealed && (
                <span className="text-lg font-black text-line">•••</span>
              )}
            </button>
          );
        })}
      </div>

      {phase === "place" && (
        <p className="text-sm text-ink-soft animate-pulse-soft">
          Remember where each thing goes…
        </p>
      )}
    </div>
  );
}
