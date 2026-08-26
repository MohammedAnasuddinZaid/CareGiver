"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { UserRound } from "lucide-react";
import { getPeople } from "@/lib/storage/profiles";
import type { PersonProfile } from "@/lib/types/person";
import { mulberry32, shuffle } from "@/lib/games/rng";
import { difficultyLevel } from "@/lib/cognition/traits";
import type { GameStageProps } from "./faces-game";

/**
 * "Remembering Names" — Spaced Retrieval Training with Errorless Learning.
 *
 * Evidence base (why this game exists):
 * - Camp (1989); Brush & Camp (1998): performance-adjusted, EXPANDING
 *   intervals between recall attempts let people with dementia learn and
 *   retain name–face associations reliably.
 * - Haslam et al. (2011): spaced retrieval beat both trial-and-error
 *   learning (r = .76) and plain errorless learning (r = .54) for
 *   name–face recall in Alzheimer's.
 * - Errorless principle: a wrong attempt is NEVER left standing — the
 *   correct pair is immediately re-shown and the interval is NOT expanded,
 *   so errors don't consolidate into implicit memory.
 *
 * Flow per item: STUDY (face + name spoken) → silent HOLD (expanding
 * interval, visualised as a shrinking ribbon) → RECALL (pick the name).
 * A miss re-teaches and retries at the same interval; successes stretch it.
 */

interface CastMember {
  id: string;
  name: string;
  relationship: string;
  /** Emoji avatar used when no real photo is available. */
  emoji: string;
  photoThumb?: string;
}

/** Friendly demo cast so the game trains from minute one, no setup needed. */
const DEMO_CAST: readonly CastMember[] = [
  { id: "d-amma", name: "Amma", relationship: "Your Mother", emoji: "🌸" },
  { id: "d-appa", name: "Appa", relationship: "Your Father", emoji: "🌞" },
  { id: "d-ravi", name: "Ravi", relationship: "Your Grandson", emoji: "⭐" },
  { id: "d-meena", name: "Meena", relationship: "Your Granddaughter", emoji: "🌼" },
  { id: "d-rao", name: "Dr. Rao", relationship: "Your Doctor", emoji: "🩺" },
  { id: "d-lakshmi", name: "Lakshmi", relationship: "Your Neighbour", emoji: "🏡" },
];

type Phase = "loading" | "study" | "hold" | "recall" | "reteach";

export function NamesGame({
  difficulty,
  itemKey,
  startTrial,
  completeTrial,
}: GameStageProps) {
  const level = Math.max(0, difficultyLevel(difficulty));
  const choiceCount = Math.min(4, 2 + Math.floor(level / 1.5));

  const [cast, setCast] = useState<CastMember[] | null>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const [picked, setPicked] = useState<string | null>(null);
  const [corrections, setCorrections] = useState(0);
  const doneRef = useRef(false);

  // Expanding-interval state lives for the whole session (SR schedule).
  const intervalRef = useRef(2500);
  const timersRef = useRef<number[]>([]);
  const later = useCallback((fn: () => void, ms: number): void => {
    timersRef.current.push(window.setTimeout(fn, ms));
  }, []);
  const clearTimers = useCallback((): void => {
    for (const t of timersRef.current) window.clearTimeout(t);
    timersRef.current = [];
  }, []);

  useEffect(() => () => clearTimers(), [clearTimers]);

  // Real family first; demo cast guarantees playability before enrollment.
  useEffect(() => {
    let cancelled = false;
    void getPeople().then((all) => {
      if (cancelled) return;
      const real = all
        .filter((p) => !p.isDemo)
        .map<CastMember>((p) => ({
          id: p.id,
          name: p.name,
          relationship: p.relationship || "Someone special",
          emoji: "🙂",
          photoThumb: p.photoThumb,
        }));
      setCast(real.length >= 2 ? real.slice(0, 8) : [...DEMO_CAST]);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const item = useMemo(() => {
    if (!cast) return null;
    const rand = mulberry32(itemKey * 104729 + 7);
    const order = shuffle(cast, rand);
    const target = order[0];
    const distractors = order.slice(1, choiceCount);
    return {
      target,
      options: shuffle([target, ...distractors], rand),
      holdMs: Math.min(
        12_000,
        intervalRef.current,
      ),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cast, itemKey, choiceCount]);

  // Phase lifecycle per item.
  useEffect(() => {
    if (!item) return;
    doneRef.current = false;
    setPicked(null);
    setCorrections(0);
    setPhase("study");
    startTrial(`names:${itemKey}:${item.target.id}`);
    later(() => setPhase("hold"), 3200);
    later(() => setPhase("recall"), 3200 + item.holdMs);
    return clearTimers;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item]);

  const finish = useCallback(
    (successfulRecall: boolean, usedHints: number): void => {
      if (doneRef.current) return;
      doneRef.current = true;
      // Successful eventual recall earns full/partial credit through the
      // standard hint penalty — errorless to the end.
      completeTrial({
        correct: successfulRecall,
        hintsUsed: successfulRecall ? Math.min(usedHints, 9) : 9,
      });
    },
    [completeTrial],
  );

  const answer = (memberId: string): void => {
    if (phase !== "recall" || picked || !item) return;
    if (memberId === item.target.id) {
      setPicked(memberId);
      // Success stretches the NEXT item's silent interval (spacing effect).
      intervalRef.current = Math.min(12_000, Math.round(intervalRef.current * 1.45) + 500);
      finish(true, corrections);
    } else {
      // ERRORLESS CORRECTION: never leave a wrong answer standing.
      const next = corrections + 1;
      setCorrections(next);
      setPicked(memberId);
      intervalRef.current = Math.max(2200, Math.round(intervalRef.current * 0.75));
      setPhase("reteach");
      later(() => {
        setPicked(null);
        setCorrections(next);
        setPhase("recall");
      }, 2600);
      if (next >= 3) {
        // Three corrections: gently close the item with the pair re-shown.
        later(() => finish(true, next), 5200);
      }
    }
  };

  if (!cast || !item) {
    return <div className="animate-pulse-soft rounded-3xl bg-surface-muted p-10" />;
  }

  const holdProgress =
    phase === "hold" || phase === "study"
      ? undefined
      : undefined;

  void holdProgress;

  return (
    <div className="flex flex-col items-center gap-6">
      {/* Face card — present in every phase so position memory stays stable */}
      <div className="relative h-52 w-52 overflow-hidden rounded-[2rem] border-4 border-accent/40 bg-surface shadow-lift md:h-60 md:w-60">
        {item.target.photoThumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.target.photoThumb}
            alt=""
            className="h-full w-full object-cover"
            draggable={false}
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center bg-accent-soft text-8xl">
            {item.target.emoji}
          </span>
        )}
        {(phase === "study" || phase === "reteach") && (
          <div className="animate-scale-in absolute inset-x-2 bottom-2 rounded-2xl bg-night/85 px-3 py-2 text-center backdrop-blur">
            <p className="text-xl font-extrabold leading-tight text-white">
              {item.target.name}
            </p>
            <p className="text-sm font-semibold text-secondary-fixed">
              {item.target.relationship}
            </p>
          </div>
        )}
      </div>

      <p
        role="status"
        aria-live="polite"
        className="min-h-[32px] text-center text-lg font-bold text-ink"
      >
        {phase === "study" && `Remember: this is ${item.target.name}`}
        {phase === "hold" && "Wait for it…"}
        {phase === "recall" && "Who is this?"}
        {phase === "reteach" && `It's ${item.target.name} — try again!`}
      </p>

      {/* Name choices */}
      <div className="grid w-full max-w-xl grid-cols-2 gap-3 sm:grid-cols-3">
        {item.options.map((option) => (
          <button
            key={option.id}
            onClick={() => answer(option.id)}
            disabled={phase !== "recall" || picked !== null}
            aria-label={option.name}
            className={
              "min-h-[72px] rounded-3xl border-2 bg-surface px-3 py-3 text-center shadow-soft transition-all active:scale-[0.97] disabled:opacity-70 " +
              (picked === option.id
                ? option.id === item.target.id
                  ? "border-ok! bg-ok/10!"
                  : "border-danger/60! bg-danger/5!"
                : picked && option.id === item.target.id
                  ? "border-ok! bg-ok/10!"
                  : "border-line hover:border-accent")
            }
          >
            <span className="block text-xl font-bold leading-tight text-ink">
              {option.name}
            </span>
            <span className="mt-0.5 block text-sm font-medium text-ink-soft">
              {option.relationship}
            </span>
          </button>
        ))}
      </div>

      {/* Shrinking hold ribbon */}
      {(phase === "study" || phase === "hold") && (
        <div aria-hidden className="h-2 w-48 overflow-hidden rounded-full bg-line">
          <div
            className="h-full rounded-full bg-accent"
            style={{
              animation: `shrink-hold ${
                phase === "study" ? 3200 : item.holdMs
              }ms linear forwards`,
            }}
          />
        </div>
      )}
      <style>{`@keyframes shrink-hold{from{width:100%}to{width:0%}}`}</style>
    </div>
  );
}
