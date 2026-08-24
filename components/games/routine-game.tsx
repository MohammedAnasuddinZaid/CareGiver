"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { difficultyLevel } from "@/lib/cognition/traits";
import { mulberry32, shuffle } from "@/lib/games/rng";
import type { GameStageProps } from "./faces-game";
import type { TrialOutcome } from "@/hooks/use-game-session";

/**
 * "Morning Routine" — daily-routine recall (explicit PS requirement).
 * Players tap picture cards in the order they happen. Sequences are
 * slices of a culturally familiar morning: wake → bathe → prayer → tea…
 */

interface Step {
  id: string;
  emoji: string;
  label: string;
}

const ROUTINE: readonly Step[] = [
  { id: "wake", emoji: "☀️", label: "Wake up" },
  { id: "bathe", emoji: "🚿", label: "Bathe" },
  { id: "prayer", emoji: "🪔", label: "Prayer" },
  { id: "tea", emoji: "🍵", label: "Tea" },
  { id: "work", emoji: "🧺", label: "Work / market" },
  { id: "lunch", emoji: "🍚", label: "Lunch" },
];

export function RoutineGame({
  difficulty,
  itemKey,
  startTrial,
  completeTrial,
}: GameStageProps) {
  const level = Math.max(0, difficultyLevel(difficulty));
  const seqLen = Math.min(ROUTINE.length, 3 + Math.floor(level / 1.2));

  const item = useMemo(() => {
    const rand = mulberry32(itemKey * 15485863 + 97);
    // Random consecutive slice of the canonical routine keeps orders natural.
    const maxStart = ROUTINE.length - seqLen;
    const start = randIntClamp(rand, 0, maxStart);
    const correctOrder = ROUTINE.slice(start, start + seqLen);
    return { correctOrder, display: shuffle(correctOrder, rand) };
  }, [itemKey, seqLen]);

  const [placedIds, setPlacedIds] = useState<string[]>([]);
  const [mistakeAt, setMistakeAt] = useState<string | null>(null);
  const mistakesRef = useRef(0);
  const finishedRef = useRef(false);

  useEffect(() => {
    setPlacedIds([]);
    setMistakeAt(null);
    mistakesRef.current = 0;
    finishedRef.current = false;
    startTrial(`routine:${itemKey}`);
  }, [itemKey, startTrial]);

  const tapCard = (stepId: string): void => {
    if (finishedRef.current || placedIds.includes(stepId)) return;
    const expected = item.correctOrder[placedIds.length];
    if (stepId === expected.id) {
      const next = [...placedIds, stepId];
      setPlacedIds(next);
      setMistakeAt(null);
      if (next.length === item.correctOrder.length) {
        finishedRef.current = true;
        const outcome: TrialOutcome = {
          correct: mistakesRef.current === 0,
          hintsUsed: Math.min(mistakesRef.current, 9),
        };
        window.setTimeout(() => completeTrial(outcome), 500);
      }
    } else {
      mistakesRef.current += 1;
      setMistakeAt(stepId);
      window.setTimeout(() => setMistakeAt(null), 650);
    }
  };

  const remaining = item.correctOrder.slice(placedIds.length);

  return (
    <div className="flex flex-col items-center gap-6">
      {/* Placed so far */}
      <div className="flex w-full flex-wrap items-center justify-center gap-2">
        {item.correctOrder.map((s, i) => (
          <span key={s.id}>
            <span
              className={
                "flex h-14 w-14 items-center justify-center rounded-2xl border-2 text-2xl shadow-soft " +
                (i < placedIds.length
                  ? "border-ok! bg-ok/10!"
                  : "border-dashed border-line bg-transparent opacity-40")
              }
            >
              {i < placedIds.length ? s.emoji : "?"}
            </span>
            {i < item.correctOrder.length - 1 && (
              <span className="mx-0.5 text-ink-soft">→</span>
            )}
          </span>
        ))}
      </div>

      {/* Cards to pick from */}
      <div className="grid w-full max-w-xl grid-cols-3 gap-3">
        {item.display.map((s) => {
          const used = placedIds.includes(s.id);
          return (
            <button
              key={s.id}
              onClick={() => tapCard(s.id)}
              disabled={used}
              className={
                "flex min-h-[96px] flex-col items-center justify-center gap-1 rounded-3xl border-2 px-2 py-3 transition-all active:scale-[0.97] disabled:opacity-35 " +
                (mistakeAt === s.id
                  ? "border-danger/70! bg-danger/5! shake"
                  : used
                    ? "border-ok/60! bg-ok/5!"
                    : "border-line bg-surface hover:border-accent")
              }
            >
              <span className="text-4xl">{s.emoji}</span>
              <span className="text-sm font-semibold text-ink">{s.label}</span>
            </button>
          );
        })}
      </div>

      {/* Gentle hint after repeated misses — errorless learning */}
      {mistakesRef.current >= 2 && remaining.length > 0 && (
        <p className="animate-fade-in text-base font-semibold text-ink-soft">
          Start with “{remaining[0].label}”
        </p>
      )}
      <style>{`@keyframes shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}} .shake{animation:shake .45s ease-in-out}`}</style>
    </div>
  );
}

function randIntClamp(rand: () => number, min: number, max: number): number {
  if (max <= min) return min;
  return min + Math.floor(rand() * (max - min + 1));
}
