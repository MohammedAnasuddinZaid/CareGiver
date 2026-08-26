"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { UserRound } from "lucide-react";
import { getPeople } from "@/lib/storage/profiles";
import type { PersonProfile } from "@/lib/types/person";
import { mulberry32, randInt, shuffle } from "@/lib/games/rng";
import { difficultyLevel } from "@/lib/cognition/traits";
import { PhrasePlayer } from "@/lib/audio/phrase-player";
import { useSettings } from "@/hooks/use-settings";
import type { TrialOutcome } from "@/hooks/use-game-session";

export interface GameStageProps {
  /** Current item difficulty (logit scale, higher = harder). */
  difficulty: number;
  /** Increments every new item — regenerate content when it changes. */
  itemKey: number;
  startTrial: (itemId: string) => void;
  completeTrial: (outcome: TrialOutcome) => void;
}

/**
 * "Who Is In The Photo?" — reminiscence-based name–face recall over the
 * caregiver's own enrolled photos. This is spaced-retrieval training on
 * personally meaningful material, the intervention with the strongest
 * evidence base for dementia cognition.
 */
export function FacesGame({
  difficulty,
  itemKey,
  startTrial,
  completeTrial,
}: GameStageProps) {
  const [people, setPeople] = useState<PersonProfile[] | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);
  const playerRef = useRefPhrasePlayer();
  const { settings } = useSettings();

  const timersRef = useRef<number[]>([]);
  const later = useCallback((fn: () => void, ms: number): void => {
    timersRef.current.push(window.setTimeout(fn, ms));
  }, []);
  // Unmount cancels the per-answer feedback timer so a mid-answer exit
  // never records a trial for an item the player abandoned.
  useEffect(() => () => {
    for (const t of timersRef.current) window.clearTimeout(t);
    timersRef.current = [];
  }, []);

  useEffect(() => {
    let cancelled = false;
    void getPeople().then((all) => {
      if (cancelled) return;
      setPeople(all.filter((p) => !p.isDemo && p.photoThumb));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const choiceCount = Math.min(5, 2 + Math.max(0, difficultyLevel(difficulty)));

  const item = useMemo(() => {
    if (!people || people.length < 2) return null;
    const rand = mulberry32(itemKey * 7919 + 13);
    const order = shuffle(people, rand);
    const target = order[0];
    const distractors = order.slice(1, choiceCount);
    return { target, options: shuffle([target, ...distractors], rand) };
  }, [people, itemKey, choiceCount]);

  useEffect(() => {
    setPicked(null);
    setFeedback(null);
    if (item) startTrial(`faces:${item.target.id}`);
  }, [item, startTrial]);

  if (people !== null && people.length < 2) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-3xl border border-line bg-surface p-8 text-center">
        <UserRound className="h-10 w-10 text-ink-soft" />
        <p className="text-lg font-semibold text-ink">
          Add two or more people with photos to play this game.
        </p>
        <a
          href="/caregiver"
          className="rounded-full bg-accent px-6 py-3 text-base font-bold text-white"
        >
          Add people
        </a>
      </div>
    );
  }

  if (!item) {
    return <div className="animate-pulse-soft rounded-3xl bg-surface-muted p-10" />;
  }

  const answer = (personId: string): void => {
    if (picked) return;
    setPicked(personId);
    const correct = personId === item.target.id;
    setFeedback(correct ? "correct" : "wrong");
    if (correct) {
      playerRef.current.speak(
        `${item.target.name}. ${item.target.relationship}.`,
        settings.locale,
      );
      playerRef.current.tone("success");
    } else {
      playerRef.current.tone("miss");
    }
    later(() => completeTrial({ correct }), correct ? 900 : 1300);
  };

  return (
    <div className="flex flex-col items-center gap-6">
      {/* Target photo */}
      <div className="relative h-56 w-56 overflow-hidden rounded-[2rem] border-4 border-line bg-surface shadow-lift md:h-64 md:w-64">
        {item.target.photoThumb ? (
          // Local data URL from IndexedDB — no network, no external origin.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.target.photoThumb}
            alt=""
            className="h-full w-full object-cover"
            draggable={false}
          />
        ) : null}
      </div>

      <div className="grid w-full max-w-xl grid-cols-2 gap-3 sm:grid-cols-3">
        {item.options.map((option) => (
          <button
            key={option.id}
            onClick={() => answer(option.id)}
            disabled={!!picked}
            className={
              "min-h-[72px] rounded-3xl border-2 bg-surface px-3 py-3 text-center shadow-soft transition-all active:scale-[0.97] disabled:opacity-70 " +
              (picked === option.id
                ? option.id === item.target.id
                  ? "border-ok! bg-ok/10!"
                  : "border-danger/60! bg-danger/5!"
                : picked
                  ? option.id === item.target.id
                    ? "border-ok! bg-ok/10!"
                    : "border-line opacity-50"
                  : "border-line hover:border-accent")
            }
          >
            <span className="text-xl font-bold leading-tight text-ink">
              {option.name}
            </span>
            <span className="mt-0.5 block text-sm font-medium text-ink-soft">
              {option.relationship}
            </span>
          </button>
        ))}
      </div>

      {feedback && (
        <div
          role="status"
          aria-live="polite"
          className="animate-fade-in rounded-full bg-accent px-6 py-2 text-lg font-bold text-white"
        >
          {feedback === "correct"
            ? `${item.target.name} ✓`
            : `${item.target.name}`}
        </div>
      )}
    </div>
  );
}

/** Lazily creates one shared PhrasePlayer instance per component tree. */
function useRefPhrasePlayer() {
  const [ref] = useState(() => ({ current: new PhrasePlayer() }));
  useEffect(() => () => ref.current.reset(), [ref]);
  return ref;
}

// Re-export keeps game files free of duplicate RNG imports in tests.
export { randInt };
