"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { difficultyLevel } from "@/lib/cognition/traits";
import { mulberry32, shuffle } from "@/lib/games/rng";
import type { GameStageProps } from "./faces-game";
import { useLocale } from "@/hooks/use-locale";
import { memoryCards, memoryLaneTexts } from "@/lib/i18n/games";

/**
 * "Memory Lane" — Reminiscence Therapy, gamified.
 *
 * Evidence base (why this game exists):
 * - Butler (1963): structured life review helps older adults consolidate
 *   identity and resolve unresolved feelings; remote (autobiographical)
 *   memory often outlasts recent memory in dementia, so reminiscence is a
 *   domain where players can genuinely SHINE — vital for dignity and mood.
 * - Woods et al. (2018), Cochrane Database of Systematic Reviews: across
 *   22 RCTs, reminiscence therapy improved cognition, mood and daily
 *   functioning in people with dementia, and reduced caregiver strain.
 * - Spector et al. (2003): CST dedicates full sessions to reminiscence;
 *   CST remains the only non-drug therapy recommended by NICE (2018) for
 *   cognition in dementia.
 * - Design detail that matters: prompts reference SHARED ERA MEMORIES
 *   (radio evenings, monsoon boats, wedding songs), never factual trivia
 *   about the player's own past — so no answer can feel like an exam,
 *   and every card ends in a warm "story moment" plus an "ask your
 *   family" prompt that carries the therapy into real conversation
 *   (the mechanism Cochrane credits for mood gains).
 *
 * Flow per item: TAKE ME BACK (scene fades in) → CHOOSE (gentle question)
 * → STORY MOMENT (reveal + conversation prompt). Errorless: a miss dims
 * the option, counts as a hint, and the item waits — errors never
 * consolidate (Clare et al., 2002).
 */

interface MemoryCard {
  id: string;
  /** Big nostalgic scene emoji. */
  scene: string;
  /** Warm gradient behind the scene (rotates for variety). */
  tint: string;
  title: string;
  question: string;
  correct: string;
  distractors: readonly string[];
  story: string;
  ask: string;
}

type Phase = "back" | "choose" | "story";

export function MemoryLaneGame({
  difficulty,
  itemKey,
  startTrial,
  completeTrial,
}: GameStageProps) {
  const level = Math.max(0, difficultyLevel(difficulty));
  const choiceCount = Math.min(4, 2 + Math.floor(level / 1.5));
  const { locale } = useLocale();

  const [phase, setPhase] = useState<Phase>("back");
  const [picked, setPicked] = useState<string | null>(null);
  const [lost, setLost] = useState<readonly string[]>([]);
  const [corrections, setCorrections] = useState(0);
  const doneRef = useRef(false);
  const timersRef = useRef<number[]>([]);
  const later = useCallback((fn: () => void, ms: number): void => {
    timersRef.current.push(window.setTimeout(fn, ms));
  }, []);
  const clearTimers = useCallback((): void => {
    for (const t of timersRef.current) window.clearTimeout(t);
    timersRef.current = [];
  }, []);
  useEffect(() => () => clearTimers(), [clearTimers]);

  const item = useMemo(() => {
    const cards = memoryCards(locale);
    const rand = mulberry32(itemKey * 15485863 + 11);
    const cardIdx = Math.floor(rand() * cards.length);
    const card = cards[cardIdx];
    return {
      card,
      options: shuffle([card.correct, ...card.distractors.slice(0, choiceCount - 1)], rand),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemKey, choiceCount, locale]);

  const { takeMeBack, talkTogether } = useMemo(() => memoryLaneTexts(locale), [locale]);

  // Phase lifecycle per item.
  useEffect(() => {
    doneRef.current = false;
    setPicked(null);
    setLost([]);
    setCorrections(0);
    setPhase("back");
    startTrial(`memorylane:${itemKey}:${item.card.id}`);
    later(() => setPhase("choose"), 3400);
    return clearTimers;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item]);

  const finish = useCallback(
    (): void => {
      if (doneRef.current) return;
      doneRef.current = true;
      // Errorless to the end: the story moment ALWAYS completes the item
      // positively; needed hints reduce credit via the standard penalty.
      completeTrial({ correct: true, hintsUsed: Math.min(corrections, 9) });
    },
    [completeTrial, corrections],
  );

  const answer = (label: string): void => {
    if (
      phase !== "choose" ||
      picked !== null ||
      lost.includes(label) ||
      doneRef.current
    ) {
      return;
    }
    if (label === item.card.correct) {
      setPicked(label);
      setPhase("story");
      // Reading pace for the story moment, then advance kindly.
      later(() => finish(), 7200);
    } else {
      const next = corrections + 1;
      setCorrections(next);
      // Dim this option but keep the others playable — the player can
      // keep trying the right answer instead of being stuck.
      setLost((prev) => [...prev, label]);
      if (next >= 3) {
        // Three misses: reveal gently instead of letting frustration build.
        later(() => {
          setPicked(item.card.correct);
          setPhase("story");
          later(() => finish(), 7600);
        }, 900);
      }
    }
  };

  return (
    <div className="flex flex-col items-center gap-5">
      {/* Scene card */}
      <div
        key={item.card.id}
        className={
          "relative flex h-56 w-full max-w-md animate-fade-in flex-col items-center justify-center gap-2 overflow-hidden rounded-[2rem] border border-line bg-gradient-to-br shadow-lift md:h-64 " +
          item.card.tint
        }
      >
        <span className="animate-float text-8xl drop-shadow-md md:text-9xl" aria-hidden>
          {item.card.scene}
        </span>
        <p className="px-6 pb-2 text-center text-xl font-extrabold tracking-tight text-stone-700">
          {phase === "back" ? item.card.title : ""}
        </p>
        {phase === "back" && (
          <div aria-hidden className="woven-motif absolute inset-0 opacity-20" />
        )}
      </div>

      <p
        role="status"
        aria-live="polite"
        className="min-h-[56px] px-2 text-center text-lg font-bold leading-snug text-ink md:text-xl"
      >
        {phase === "back" && takeMeBack}
        {phase === "choose" && item.card.question}
        {phase === "story" && item.card.story}
      </p>

      {phase === "choose" && (
        <div className="grid w-full max-w-xl grid-cols-1 gap-3 sm:grid-cols-2">
          {item.options.map((option) => {
            const isLost = lost.includes(option);
            const isCorrectPick = picked === option;
            return (
              <button
                key={option}
                onClick={() => answer(option)}
                disabled={isLost || picked !== null}
                aria-label={option}
                className={
                  "min-h-[68px] rounded-3xl border-2 bg-surface px-4 py-3 text-center text-lg font-semibold leading-snug shadow-soft transition-all active:scale-[0.97] disabled:cursor-default " +
                  (isLost
                    ? "border-danger/60! bg-danger/5! opacity-55"
                    : isCorrectPick
                      ? "border-ok! bg-ok/10!"
                      : "border-line hover:border-accent hover:shadow-lift")
                }
              >
                {option}
              </button>
            );
          })}
        </div>
      )}

      {phase === "story" && (
        <div className="animate-fade-up w-full max-w-xl rounded-3xl border border-accent/30 bg-accent-soft/60 p-5 text-center">
          <p className="text-base font-semibold leading-relaxed text-ink">
            {item.card.ask}
          </p>
          <p className="mt-1 text-sm font-medium text-accent">{talkTogether}</p>
        </div>
      )}
    </div>
  );
}
