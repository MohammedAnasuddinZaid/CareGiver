"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { difficultyLevel } from "@/lib/cognition/traits";
import { mulberry32, shuffle } from "@/lib/games/rng";
import type { GameStageProps } from "./faces-game";

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

const CARDS: readonly MemoryCard[] = [
  {
    id: "radio",
    scene: "📻",
    tint: "from-amber-100 via-orange-50 to-rose-100",
    title: "Evenings around the radio",
    question: "When the family radio played in the evening, what did everyone do?",
    correct: "Sat together and listened",
    distractors: ["Went to bed early", "Switched it off", "Ran outside to play"],
    story:
      "The whole room grew quiet — one story at a time, carried into every home by a small wooden box.",
    ask: "Ask your family: which radio show did they love most?",
  },
  {
    id: "diya",
    scene: "🪔",
    tint: "from-orange-100 via-amber-50 to-yellow-100",
    title: "Lamps at dusk",
    question: "At dusk, what was lit first at the doorstep?",
    correct: "A little lamp",
    distractors: ["The television", "A torch", "The streetlight"],
    story:
      "One small flame at the doorway meant the day was closing — and tomorrow would be welcomed the same way.",
    ask: "Ask your family: who lit the lamp at home each evening?",
  },
  {
    id: "tea",
    scene: "🫖",
    tint: "from-stone-100 via-amber-50 to-orange-100",
    title: "Tea time",
    question: "In the evening, what did visitors almost always get first?",
    correct: "A cup of tea",
    distractors: ["Cold water", "A letter", "An umbrella"],
    story:
      "The kettle knew before anyone did — guests were coming, and the talk could begin.",
    ask: "Ask your family: who made the best tea in the house?",
  },
  {
    id: "cycle",
    scene: "🚲",
    tint: "from-sky-100 via-cyan-50 to-teal-100",
    title: "The first bicycle",
    question: "Learning to ride a bicycle, who usually ran alongside holding the seat?",
    correct: "An elder brother or father",
    distractors: ["Nobody at all", "The postman", "A neighbour's dog"],
    story:
      "Somewhere between wobbles and laughter came that sudden magic — riding alone, wind in the face.",
    ask: "Ask your family: who taught them to ride a bicycle?",
  },
  {
    id: "monsoon",
    scene: "🌧️",
    tint: "from-slate-100 via-sky-50 to-indigo-100",
    title: "Monsoon mornings",
    question: "After the first rain, what did children race to sail in the water?",
    correct: "Paper boats",
    distractors: ["Wooden elephants", "Kites", "Clay lamps"],
    story:
      "Newspaper folded just so, puddles turned into oceans — and rain became the best toy of all.",
    ask: "Ask your family: what did they do on rainy afternoons?",
  },
  {
    id: "storytime",
    scene: "🌙",
    tint: "from-indigo-100 via-violet-50 to-purple-100",
    title: "Bedtime stories",
    question: "At night, who told the stories that ended with 'and they lived happily'?",
    correct: "Grandmother",
    distractors: ["The milkman", "The school teacher", "Nobody"],
    story:
      "Demons, kings and clever sparrows — every night promised one more story, and one more reason to sleep fast.",
    ask: "Ask your family: which story do they still remember?",
  },
  {
    id: "wedding",
    scene: "💃",
    tint: "from-rose-100 via-pink-50 to-fuchsia-100",
    title: "Wedding songs",
    question: "At family weddings, what filled the courtyard all night?",
    correct: "Songs and dancing",
    distractors: ["Silence", "Homework", "Rain"],
    story:
      "Drums in the corner, aunties leading the line — weddings were measured in songs, not hours.",
    ask: "Ask your family: which wedding song gets them dancing even now?",
  },
  {
    id: "village",
    scene: "🥭",
    tint: "from-lime-100 via-green-50 to-emerald-100",
    title: "Summer holidays",
    question: "School summer holidays were most often spent…",
    correct: "At grandparents' village",
    distractors: ["In the classroom", "At the office", "Alone at home"],
    story:
      "Mangoes straight off the tree, cousins by the dozen, and two months that felt like years.",
    ask: "Ask your family: where did they spend summer as children?",
  },
  {
    id: "market",
    scene: "🧺",
    tint: "from-yellow-100 via-amber-50 to-lime-100",
    title: "Market mornings",
    question: "What did grandmother carry to the vegetable market?",
    correct: "A cloth basket",
    distractors: ["A suitcase", "A bucket", "An umbrella stand"],
    story:
      "Bargaining was an art, fresh coriander came free with goodwill, and the basket came home heavy.",
    ask: "Ask your family: what was always bought fresh, never stored?",
  },
  {
    id: "festival",
    scene: "🎆",
    tint: "from-purple-100 via-fuchsia-50 to-rose-100",
    title: "Festival nights",
    question: "During festivals, what did the whole sky wear?",
    correct: "Sparkling lights",
    distractors: ["Grey clouds", "Snow", "Rainbow flags"],
    story:
      "New clothes, sweets passed hand to hand, and lights bright enough to make the whole lane glow.",
    ask: "Ask your family: which festival do they remember most fondly?",
  },
  {
    id: "letters",
    scene: "✉️",
    tint: "from-teal-100 via-emerald-50 to-cyan-100",
    title: "Letters from far away",
    question: "Before telephones were common, how did families share good news?",
    correct: "By post — a letter",
    distractors: ["By video call", "By text message", "By email"],
    story:
      "The postman's bicycle was the internet of its day — one envelope could make the whole street celebrate.",
    ask: "Ask your family: do they remember waiting for a letter?",
  },
  {
    id: "swing",
    scene: "🌳",
    tint: "from-green-100 via-teal-50 to-emerald-100",
    title: "Under the old tree",
    question: "In the afternoon heat, where did elders gather to talk?",
    correct: "Under the shady tree",
    distractors: ["On the rooftop in the sun", "Inside the fridge", "At the bus stop"],
    story:
      "One big tree, a few cots, endless tea — the neighbourhood's parliament, open all afternoon.",
    ask: "Ask your family: where did neighbours gather in their street?",
  },
];

type Phase = "back" | "choose" | "story";

export function MemoryLaneGame({
  difficulty,
  itemKey,
  startTrial,
  completeTrial,
}: GameStageProps) {
  const level = Math.max(0, difficultyLevel(difficulty));
  const choiceCount = Math.min(4, 2 + Math.floor(level / 1.5));

  const [phase, setPhase] = useState<Phase>("back");
  const [picked, setPicked] = useState<string | null>(null);
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
    const rand = mulberry32(itemKey * 15485863 + 11);
    const cardIdx = Math.floor(rand() * CARDS.length);
    const card = CARDS[cardIdx];
    return {
      card,
      options: shuffle([card.correct, ...card.distractors.slice(0, choiceCount - 1)], rand),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemKey, choiceCount]);

  // Phase lifecycle per item.
  useEffect(() => {
    doneRef.current = false;
    setPicked(null);
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
    if (phase !== "choose" || picked !== null || doneRef.current) return;
    if (label === item.card.correct) {
      setPicked(label);
      setPhase("story");
      // Reading pace for the story moment, then advance kindly.
      later(() => finish(), 7200);
    } else {
      const next = corrections + 1;
      setCorrections(next);
      setPicked(label);
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
        {phase === "back" && "Take yourself back…"}
        {phase === "choose" && item.card.question}
        {phase === "story" && item.card.story}
      </p>

      {phase === "choose" && (
        <div className="grid w-full max-w-xl grid-cols-1 gap-3 sm:grid-cols-2">
          {item.options.map((option) => (
            <button
              key={option}
              onClick={() => answer(option)}
              disabled={picked !== null}
              aria-label={option}
              className={
                "min-h-[68px] rounded-3xl border-2 bg-surface px-4 py-3 text-center text-lg font-semibold leading-snug shadow-soft transition-all active:scale-[0.97] disabled:cursor-default " +
                (picked === option
                  ? option === item.card.correct
                    ? "border-ok! bg-ok/10!"
                    : "border-danger/60! bg-danger/5! opacity-55"
                  : "border-line hover:border-accent hover:shadow-lift")
              }
            >
              {option}
            </button>
          ))}
        </div>
      )}

      {phase === "story" && (
        <div className="animate-fade-up w-full max-w-xl rounded-3xl border border-accent/30 bg-accent-soft/60 p-5 text-center">
          <p className="text-base font-semibold leading-relaxed text-ink">
            {item.card.ask}
          </p>
          <p className="mt-1 text-sm font-medium text-accent">Talk about it together ♥</p>
        </div>
      )}
    </div>
  );
}
