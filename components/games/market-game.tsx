"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { difficultyLevel } from "@/lib/cognition/traits";
import { buildMarketLayout } from "@/lib/games/market-layout";
import type { GameStageProps } from "./faces-game";
import type { TrialOutcome } from "@/hooks/use-game-session";

/**
 * "Market Basket" — working-memory span training with an interference
 * delay, themed on the region's markets (Ima Keithel, weekly haats).
 * Phase 1 shows a basket of K items; phase 2 finds them on a full shelf.
 *
 * The shelf layout comes from an independent permutation
 * (lib/games/market-layout.ts), so memorized items are scattered across
 * the grid instead of sitting at the front in the practiced order.
 */

interface Goods {
  id: string;
  emoji: string;
  name: string;
}

export const MARKET_GOODS: readonly Goods[] = [
  { id: "orange", emoji: "🍊", name: "Orange" },
  { id: "chili", emoji: "🌶️", name: "King chili" },
  { id: "tea", emoji: "🍃", name: "Tea leaves" },
  { id: "banana", emoji: "🍌", name: "Banana" },
  { id: "potato", emoji: "🥔", name: "Potato" },
  { id: "ginger", emoji: "🫚", name: "Ginger" },
  { id: "corn", emoji: "🌽", name: "Corn" },
  { id: "pineapple", emoji: "🍍", name: "Pineapple" },
  { id: "nuts", emoji: "🥜", name: "Ground nuts" },
  { id: "yam", emoji: "🍠", name: "Sweet potato" },
  { id: "cucumber", emoji: "🥒", name: "Cucumber" },
  { id: "coconut", emoji: "🥥", name: "Coconut" },
];

export function MarketGame({
  difficulty,
  itemKey,
  startTrial,
  completeTrial,
}: GameStageProps) {
  const level = Math.max(0, difficultyLevel(difficulty));
  const listSize = Math.min(6, 2 + level);
  const holdMs = 2600 + listSize * 900; // harder lists get a little longer

  const [phase, setPhase] = useState<"memorize" | "find">("memorize");
  const [foundIds, setFoundIds] = useState<string[]>([]);
  const [wrongIds, setWrongIds] = useState<string[]>([]);
  const mistakesRef = useRef(0);
  const doneRef = useRef(false);

  const timersRef = useRef<number[]>([]);
  const later = useCallback((fn: () => void, ms: number): void => {
    timersRef.current.push(window.setTimeout(fn, ms));
  }, []);
  const clearTimers = useCallback((): void => {
    for (const t of timersRef.current) window.clearTimeout(t);
    timersRef.current = [];
  }, []);

  const { basket, shelf } = useMemo(
    () => buildMarketLayout(MARKET_GOODS, itemKey * 104729 + 5, listSize),
    [itemKey, listSize],
  );

  // Phase lifecycle. Leaving the item (new key or unmount) cancels every
  // pending completion timer so no ghost trial is ever recorded.
  useEffect(() => {
    setPhase("memorize");
    setFoundIds([]);
    setWrongIds([]);
    mistakesRef.current = 0;
    doneRef.current = false;
    return clearTimers;
  }, [itemKey, clearTimers]);

  useEffect(() => () => clearTimers(), [clearTimers]);

  useEffect(() => {
    if (phase !== "memorize") return;
    startTrial(`market:${itemKey}`);
    const timer = window.setTimeout(() => setPhase("find"), holdMs);
    return () => window.clearTimeout(timer);
  }, [phase, itemKey, holdMs, startTrial]);

  const finishItem = (mistakes: number): void => {
    if (doneRef.current) return;
    doneRef.current = true;
    completeTrial({ correct: mistakes === 0, hintsUsed: Math.min(mistakes, 9) });
  };

  const pickFromShelf = (goodsId: string): void => {
    if (phase !== "find" || doneRef.current || foundIds.includes(goodsId)) return;
    const inBasket = basket.some((g) => g.id === goodsId);
    if (inBasket) {
      const nextFound = [...foundIds, goodsId];
      setFoundIds(nextFound);
      if (nextFound.length === basket.length) {
        later(() => finishItem(mistakesRef.current), 550);
      }
    } else {
      mistakesRef.current += 1;
      setWrongIds((w) => [...w, goodsId]);
      // Errorless learning: three misses end the item with partial credit.
      if (mistakesRef.current >= 3) {
        later(() => finishItem(mistakesRef.current), 500);
      }
    }
  };

  return (
    <div className="flex flex-col items-center gap-6">
      {phase === "memorize" ? (
        <>
          <p className="text-xl font-bold text-ink">🧺</p>
          <div className="grid w-full max-w-lg grid-cols-3 gap-3">
            {basket.map((g) => (
              <div
                key={g.id}
                className="flex flex-col items-center rounded-3xl border-2 border-accent/50 bg-surface px-2 py-4 shadow-soft animate-scale-in"
              >
                <span className="text-4xl">{g.emoji}</span>
                <span className="mt-1 text-sm font-semibold text-ink">{g.name}</span>
              </div>
            ))}
          </div>
          <div
            aria-hidden
            className="h-2 w-48 overflow-hidden rounded-full bg-line"
          >
            <div
              className="h-full rounded-full bg-accent"
              style={{ animation: `shrink ${holdMs}ms linear forwards` }}
            />
          </div>
        </>
      ) : (
        <>
          <div className="grid w-full max-w-2xl grid-cols-3 gap-3 sm:grid-cols-4">
            {shelf.map((g) => (
              <button
                key={g.id}
                onClick={() => pickFromShelf(g.id)}
                disabled={foundIds.includes(g.id)}
                aria-label={g.name}
                className={
                  "flex min-h-[84px] flex-col items-center justify-center rounded-3xl border-2 px-2 py-3 transition-all active:scale-[0.97] disabled:opacity-45 " +
                  (wrongIds.includes(g.id)
                    ? "border-danger/60! bg-danger/5!"
                    : foundIds.includes(g.id)
                      ? "border-ok! bg-ok/10!"
                      : "border-line bg-surface hover:border-accent")
                }
              >
                <span className="text-4xl">{g.emoji}</span>
              </button>
            ))}
          </div>
          <p className="text-base font-semibold text-ink-soft">
            🧺 {foundIds.length} / {basket.length}
            {wrongIds.length > 0 ? ` · ✗ ${wrongIds.length}` : ""}
          </p>
        </>
      )}
      <style>{`@keyframes shrink{from{width:100%}to{width:0%}}`}</style>
    </div>
  );
}
