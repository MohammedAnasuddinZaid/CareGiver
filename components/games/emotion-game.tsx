"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { difficultyLevel } from "@/lib/cognition/traits";
import { mulberry32, randInt, shuffle } from "@/lib/games/rng";
import type { GameStageProps } from "./faces-game";
import type { TrialOutcome } from "@/hooks/use-game-session";
import { PhrasePlayer } from "@/lib/audio/phrase-player";

/**
 * "Feelings Match" — an emotion-recognition task that exercises social
 * cognition and working memory. Matching facial expressions to feeling words
 * is a mainstay of emotion-awareness programmes for older adults and maps
 * onto the same person-perception pathways used in Companion Mode.
 *
 * Difficulty grows the number of feeling choices from two to four.
 */
const EMOTIONS = [
  { emoji: "😊", label: "Happy" },
  { emoji: "😢", label: "Sad" },
  { emoji: "😠", label: "Angry" },
  { emoji: "😨", label: "Scared" },
  { emoji: "😴", label: "Sleepy" },
  { emoji: "🤔", label: "Thoughtful" },
  { emoji: "😲", label: "Surprised" },
  { emoji: "🤒", label: "Unwell" },
];

const OPTION_COUNT = [2, 3, 3, 4, 4];

export function EmotionGame({ difficulty, itemKey, startTrial, completeTrial }: GameStageProps) {
  const level = Math.max(0, difficultyLevel(difficulty));
  const playerRef = useRefPhrasePlayer();
  const timers = useRef<number[]>([]);
  const [target, setTarget] = useState<(typeof EMOTIONS)[number] | null>(null);
  const [options, setOptions] = useState<(typeof EMOTIONS)[number][]>([]);
  const [picked, setPicked] = useState<string | null>(null);
  const doneRef = useRef(false);

  const clearTimers = useCallback(() => {
    for (const t of timers.current) window.clearTimeout(t);
    timers.current = [];
  }, []);

  useEffect(() => {
    const rand = mulberry32(itemKey * 521 + 9);
    const count = OPTION_COUNT[Math.min(level, OPTION_COUNT.length - 1)];
    const targetIdx = randInt(rand, 0, EMOTIONS.length - 1);
    const t = EMOTIONS[targetIdx];
    const others = EMOTIONS.filter((_, i) => i !== targetIdx);
    const distractors = shuffle(others, rand).slice(0, count - 1);
    const opts = shuffle([t, ...distractors], rand);
    setTarget(t);
    setOptions(opts);
    setPicked(null);
    doneRef.current = false;
    startTrial(`emotion:${itemKey}`);
    return clearTimers;
  }, [itemKey, level, startTrial, clearTimers]);

  const finish = useCallback(
    (correct: boolean) => {
      if (doneRef.current) return;
      doneRef.current = true;
      clearTimers();
      window.setTimeout(() => completeTrial({ correct, hintsUsed: correct ? 0 : 1 }), 850);
    },
    [clearTimers, completeTrial],
  );

  const choose = (label: string) => {
    if (doneRef.current || picked !== null || !target) return;
    setPicked(label);
    const correct = label === target.label;
    if (correct) {
      playerRef.current.tone("success");
      playerRef.current.speak(target.label, "");
    } else {
      playerRef.current.tone("miss");
    }
    finish(correct);
  };

  if (!target) {
    return <div className="animate-pulse-soft rounded-3xl bg-surface-muted p-10" />;
  }

  return (
    <div className="flex flex-col items-center gap-7">
      <p className="text-lg font-semibold text-ink-soft">Which feeling is this?</p>
      <div className="flex h-32 w-32 items-center justify-center rounded-[2rem] border-4 border-line bg-surface text-7xl shadow-lift">
        {target.emoji}
      </div>

      <div className="grid w-full max-w-md grid-cols-2 gap-3">
        {options.map((opt) => {
          const isPicked = picked === opt.label;
          const isCorrect = opt.label === target.label;
          return (
            <button
              key={opt.label}
              onClick={() => choose(opt.label)}
              disabled={picked !== null}
              className={
                "flex min-h-[72px] items-center justify-center gap-2 rounded-3xl border-2 px-4 py-3 text-center text-xl font-bold shadow-soft transition-all active:scale-[0.97] disabled:opacity-70 " +
                (isPicked
                  ? isCorrect
                    ? "border-ok! bg-ok/10! text-ok"
                    : "border-danger/60! bg-danger/5! text-danger"
                  : picked !== null && isCorrect
                    ? "border-ok/60 bg-ok/5 text-ok"
                    : "border-line text-ink hover:border-accent")
              }
            >
              <span className="text-3xl">{opt.emoji}</span>
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function useRefPhrasePlayer() {
  const [ref] = useState(() => ({ current: new PhrasePlayer() }));
  // dispose (not reset): never cancel the celebratory word mid-way when the
  // next item mounts — the stage re-mounts every item (GameChrome key).
  useEffect(() => () => ref.current.dispose(), [ref]);
  return ref;
}
