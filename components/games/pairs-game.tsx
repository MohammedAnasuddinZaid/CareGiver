"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { difficultyLevel } from "@/lib/cognition/traits";
import { mulberry32, shuffle } from "@/lib/games/rng";
import type { GameStageProps } from "./faces-game";
import type { TrialOutcome } from "@/hooks/use-game-session";
import { PhrasePlayer } from "@/lib/audio/phrase-player";

/**
 * "Card Pairs" — the classic concentration game (working memory).
 * Beloved and familiar to elderly players; difficulty scales the board
 * from 2×2 to 4×3. One trial = one full board.
 */

const PAIR_FACES = ["🌸", "🦚", "🐘", "🍊", "🪔", "🐟", "🦋", "🌺", "🍵", "🧺"];

interface Card {
  key: number;
  face: string;
  flipped: boolean;
  matched: boolean;
}

export function PairsGame({
  difficulty,
  itemKey,
  startTrial,
  completeTrial,
}: GameStageProps) {
  const level = Math.max(0, difficultyLevel(difficulty));
  const pairCount = Math.min(6, 2 + level);
  const cols = pairCount <= 2 ? 2 : pairCount <= 4 ? 3 : 4;

  const playerRef = useRef(new PhrasePlayer());
  const [cards, setCards] = useState<Card[]>([]);
  const [pickedKeys, setPickedKeys] = useState<number[]>([]);
  const mistakesRef = useRef(0);
  const lockRef = useRef(false);
  const doneRef = useRef(false);

  const timersRef = useRef<number[]>([]);
  const later = useCallback((fn: () => void, ms: number): void => {
    timersRef.current.push(window.setTimeout(fn, ms));
  }, []);
  const clearTimers = useCallback((): void => {
    for (const t of timersRef.current) window.clearTimeout(t);
    timersRef.current = [];
  }, []);

  const dealt = useMemo(() => {
    const rand = mulberry32(itemKey * 2654435761 + 7);
    const faces = PAIR_FACES.slice(0, pairCount);
    const doubled = shuffle([...faces, ...faces], rand);
    return doubled.map((face, i): Card => ({
      key: i,
      face,
      flipped: false,
      matched: false,
    }));
  }, [itemKey, pairCount]);

  // New board or unmount cancels pending resolve/finish timers so a
  // mid-flip exit can never mutate state or record a ghost trial.
  useEffect(() => {
    setCards(dealt);
    setPickedKeys([]);
    mistakesRef.current = 0;
    lockRef.current = false;
    doneRef.current = false;
    startTrial(`pairs:${itemKey}`);
    return clearTimers;
  }, [dealt, itemKey, startTrial, clearTimers]);

  useEffect(() => () => clearTimers(), [clearTimers]);

  const allowedMisses = [3, 4, 5, 5, 6][Math.min(level, 4)];

  const finish = (): void => {
    if (doneRef.current) return;
    doneRef.current = true;
    const outcome: TrialOutcome = {
      correct: mistakesRef.current <= allowedMisses,
      hintsUsed: Math.min(mistakesRef.current, 9),
    };
    later(() => completeTrial(outcome), 700);
  };

  const flip = (key: number): void => {
    if (lockRef.current || doneRef.current) return;
    const card = cards[key];
    if (!card || card.flipped || card.matched) return;

    const nextCards = cards.slice();
    nextCards[key] = { ...card, flipped: true };
    const picks = [...pickedKeys, key];
    setPickedKeys(picks);
    setCards(nextCards);

    if (picks.length < 2) return;

    const [first, second] = picks;
    if (nextCards[first].face === nextCards[second].face) {
      lockRef.current = true;
      playerRef.current.tone("tick");
      // Board completes when this pair's two cards land on the only
      // unmatched pair still showing. Computed OUTSIDE any state updater
      // so side effects stay out of render-phase functions.
      const completesBoard =
        nextCards.filter((c) => c.matched).length + 2 === nextCards.length;
      later(() => {
        setCards((prev) =>
          prev.map((c) =>
            c.key === first || c.key === second ? { ...c, matched: true } : c,
          ),
        );
        setPickedKeys([]);
        lockRef.current = false;
        if (completesBoard) {
          playerRef.current.tone("success");
          later(finish, 350);
        }
      }, 450);
    } else {
      mistakesRef.current += 1;
      lockRef.current = true;
      playerRef.current.tone("miss");
      later(() => {
        setCards((prev) =>
          prev.map((c) =>
            c.key === first || c.key === second ? { ...c, flipped: false } : c,
          ),
        );
        setPickedKeys([]);
        lockRef.current = false;
      }, 750);
    }
  };

  return (
    <div className="flex flex-col items-center gap-5">
      <div
        className="grid w-full max-w-md gap-2.5"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {cards.map((card) => (
          <button
            key={card.key}
            onClick={() => flip(card.key)}
            aria-label={card.flipped || card.matched ? card.face : "Hidden card"}
            className={
              "flex aspect-square items-center justify-center rounded-2xl border-2 text-4xl shadow-soft transition-all duration-200 active:scale-[0.95] " +
              (card.matched
                ? "border-ok/70! bg-ok/10! opacity-60"
                : card.flipped
                  ? "border-accent! bg-accent-soft!"
                  : "border-line bg-surface hover:border-accent/50")
            }
          >
            {card.flipped || card.matched ? card.face : ""}
          </button>
        ))}
      </div>
      <p className="text-sm font-semibold text-ink-soft">
        ✗ {mistakesRef.current} · pairs found{" "}
        {cards.filter((c) => c.matched).length / 2} / {pairCount}
      </p>
    </div>
  );
}
