"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { difficultyLevel } from "@/lib/cognition/traits";
import { mulberry32, shuffle, randInt } from "@/lib/games/rng";
import { WORDS } from "@/lib/games/wordbank";
import type { GameStageProps } from "./faces-game";
import type { TrialOutcome } from "@/hooks/use-game-session";
import { PhrasePlayer } from "@/lib/audio/phrase-player";

/**
 * "Word Builder" — a spelling / executive-function task. The player taps
 * scrambled letter tiles in order to spell a familiar word. Self-generated
 * (orthographic) retrieval like this exercises working memory and language
 * networks; it is the home-version of spelling/naming drills used in
 * cognitive stimulation therapy.
 *
 * Difficulty scales word length. Mistaps are gentle hints (counted, not
 * punished harshly) so a wrong tile never blocks progress.
 */

const ALLOWED_MISTAKES = [8, 6, 5, 4, 3];

export function WordBuilderGame({ difficulty, itemKey, startTrial, completeTrial }: GameStageProps) {
  const level = Math.max(0, difficultyLevel(difficulty));
  const playerRef = useRefPhrasePlayer();
  const timers = useRef<number[]>([]);
  const [target, setTarget] = useState("");
  const [pool, setPool] = useState<string[]>([]);
  const [used, setUsed] = useState<boolean[]>([]);
  const [typed, setTyped] = useState<string[]>([]);
  const [mistakes, setMistakes] = useState(0);
  const [flash, setFlash] = useState<"ok" | "wrong" | null>(null);
  const doneRef = useRef(false);

  const item = useMemo(() => {
    const rand = mulberry32(itemKey * 911 + 5);
    const bank = WORDS[Math.min(level, WORDS.length - 1)];
    const word = bank[randInt(rand, 0, bank.length - 1)];
    let scrambled = shuffle(word.split(""), rand);
    // Never start already solved.
    let guard = 0;
    while (scrambled.join("") === word && guard++ < 8) scrambled = shuffle(word.split(""), rand);
    return { word, scrambled };
  }, [itemKey, level]);

  const clearTimers = useCallback(() => {
    for (const t of timers.current) window.clearTimeout(t);
    timers.current = [];
  }, []);

  useEffect(() => {
    setTarget(item.word);
    setPool(item.scrambled);
    setUsed(item.scrambled.map(() => false));
    setTyped([]);
    setMistakes(0);
    setFlash(null);
    doneRef.current = false;
    startTrial(`wordbuilder:${itemKey}`);
    return clearTimers;
  }, [item, itemKey, startTrial, clearTimers]);

  const allowed = ALLOWED_MISTAKES[Math.min(level, ALLOWED_MISTAKES.length - 1)];

  const finish = useCallback(
    (correct: boolean) => {
      if (doneRef.current) return;
      doneRef.current = true;
      clearTimers();
      window.setTimeout(() => {
        completeTrial({ correct, hintsUsed: Math.min(9, mistakes) });
      }, 700);
    },
    [clearTimers, completeTrial, mistakes],
  );

  const tapTile = (pos: number) => {
    if (doneRef.current || used[pos]) return;
    const expected = target[typed.length];
    if (pool[pos] === expected) {
      playerRef.current.tone("tick");
      const nextUsed = used.slice();
      nextUsed[pos] = true;
      setUsed(nextUsed);
      const nextTyped = [...typed, pool[pos]];
      setTyped(nextTyped);
      setFlash("ok");
      window.setTimeout(() => setFlash(null), 200);
      if (nextTyped.length === target.length) {
        playerRef.current.tone("success");
        playerRef.current.speak(target, "");
        finish(true);
      }
    } else {
      playerRef.current.tone("miss");
      setFlash("wrong");
      window.setTimeout(() => setFlash(null), 300);
      const next = mistakes + 1;
      setMistakes(next);
      if (next > allowed) finish(false);
    }
  };

  const reset = () => {
    if (doneRef.current) return;
    setTyped([]);
    setUsed(pool.map(() => false));
    setFlash(null);
  };

  return (
    <div className="flex flex-col items-center gap-6">
      <p className="text-lg font-semibold text-ink-soft">Build the word — tap the letters in order.</p>

      {/* Answer slots */}
      <div className="flex flex-wrap justify-center gap-2" aria-label="Your word">
        {target.split("").map((ch, i) => (
          <span
            key={i}
            className={
              "flex h-12 w-12 items-center justify-center rounded-xl border-2 text-2xl font-extrabold uppercase transition-colors " +
              (typed[i] !== undefined
                ? "border-accent bg-accent-soft text-accent"
                : "border-line bg-surface text-transparent")
            }
          >
            {typed[i] ?? ch}
          </span>
        ))}
      </div>

      {/* Letter tiles */}
      <div
        className={
          "grid grid-cols-4 gap-2.5 transition-colors " + (flash === "wrong" ? "rounded-2xl bg-danger/10 p-2" : "")
        }
      >
        {pool.map((ch, i) => (
          <button
            key={i}
            onClick={() => tapTile(i)}
            disabled={used[i] || doneRef.current}
            className={
              "flex h-14 w-14 items-center justify-center rounded-2xl border-2 text-2xl font-extrabold uppercase shadow-soft transition-all active:scale-95 disabled:opacity-30 " +
              (used[i]
                ? "border-accent/50 bg-accent-soft text-accent"
                : "border-line bg-surface hover:border-accent")
            }
            aria-label={`Letter ${ch}`}
          >
            {ch}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-4">
        <button
          onClick={reset}
          disabled={doneRef.current}
          className="rounded-full border border-line px-5 py-2.5 text-base font-semibold text-ink-soft transition-colors hover:bg-surface-muted"
        >
          Clear
        </button>
        <span className="text-sm font-semibold text-ink-soft">
          Mistakes {mistakes} / {allowed}
        </span>
      </div>
    </div>
  );
}

function useRefPhrasePlayer() {
  const [ref] = useState(() => ({ current: new PhrasePlayer() }));
  // dispose (not reset): never cancel the spoken word mid-way when the next
  // item mounts — the stage re-mounts every item (GameChrome key).
  useEffect(() => () => ref.current.dispose(), [ref]);
  return ref;
}
