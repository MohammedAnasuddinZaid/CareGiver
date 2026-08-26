"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { difficultyLevel } from "@/lib/cognition/traits";
import { mulberry32, randInt, shuffle } from "@/lib/games/rng";
import type { GameStageProps } from "./faces-game";
import type { TrialOutcome } from "@/hooks/use-game-session";

/**
 * "Pattern Loom" — procedural pattern-completion matrices inspired by
 * NER textile borders (Mekhela Chador stripes, Naga shawl geometry).
 * Rules scale with difficulty: alternation → rotation of three →
 * rotation with a shift. Infinitely generated, cleanly parameterized.
 */

type MotifId = 0 | 1 | 2 | 3;

const MOTIF_GLYPHS = ["◆", "●", "▲", "■"] as const;
const MOTIF_COLORS = [
  "text-accent",
  "text-ok",
  "text-warn",
  "text-danger",
] as const;

interface LoomItem {
  visible: MotifId[];
  answer: MotifId;
  options: MotifId[];
}

/**
 * Builds a strip of 6 cells following a repeating rule, then asks for
 * the 7th. Levels 0–1 alternate two motifs; 2–3 rotate three; 4+ rotates
 * four with an extra per-period shift, so the rule stays discoverable.
 */
function generateItem(seed: number, level: number): LoomItem {
  const rand = mulberry32(seed * 32452843 + 11);
  const base: MotifId[] =
    level <= 1 ? [0, 1] : level <= 3 ? [0, 1, 2] : [0, 1, 2, 3];
  const p = base.length;
  const shift = level >= 4 ? randInt(rand, 1, 2) : 0;

  const cellAt = (i: number): MotifId => {
    if (level <= 3) return base[i % p];
    const cycle = Math.floor(i / p);
    return base[(i % p + cycle * shift) % p];
  };

  const visible: MotifId[] = [];
  for (let i = 0; i < 6; i++) visible.push(cellAt(i));
  const answer = cellAt(6);

  const wrongPool = shuffle(
    base.filter((m) => m !== answer),
    rand,
  );
  // Pad distractors when the rule uses only two motifs.
  while (wrongPool.length < 3) {
    const filler = ((wrongPool.length + 1) % 4) as MotifId;
    if (!wrongPool.includes(filler) && filler !== answer) wrongPool.push(filler);
    else break;
  }
  const options = shuffle([answer, ...wrongPool.slice(0, 3)], rand);
  return { visible, answer, options };
}

export function LoomGame({
  difficulty,
  itemKey,
  startTrial,
  completeTrial,
}: GameStageProps) {
  const level = Math.max(0, difficultyLevel(difficulty));
  const item = useMemo(() => generateItem(itemKey, level), [itemKey, level]);
  const [picked, setPicked] = useState<MotifId | null>(null);

  const timersRef = useRef<number[]>([]);
  const later = useCallback((fn: () => void, ms: number): void => {
    timersRef.current.push(window.setTimeout(fn, ms));
  }, []);
  useEffect(() => {
    setPicked(null);
    return () => {
      for (const t of timersRef.current) window.clearTimeout(t);
      timersRef.current = [];
    };
  }, [itemKey]);

  useEffect(() => {
    setPicked(null);
    startTrial(`loom:${itemKey}`);
  }, [itemKey, startTrial]);

  const pick = (m: MotifId): void => {
    if (picked !== null) return;
    setPicked(m);
    const outcome: TrialOutcome = { correct: m === item.answer };
    later(() => completeTrial(outcome), 700);
  };

  return (
    <div className="flex flex-col items-center gap-8">
      {/* The woven strip */}
      <div className="flex w-full max-w-xl items-center justify-center gap-2 overflow-x-auto rounded-3xl border-4 border-line bg-surface p-4 shadow-soft">
        {item.visible.map((m, i) => (
          <span
            key={i}
            className={
              "flex h-16 w-14 shrink-0 items-center justify-center rounded-xl bg-surface-muted text-3xl font-black " +
              MOTIF_COLORS[m]
            }
          >
            {MOTIF_GLYPHS[m]}
          </span>
        ))}
        <span className="flex h-16 w-14 shrink-0 items-center justify-center rounded-xl border-2 border-dashed border-accent/60 bg-accent-soft text-3xl font-black text-accent">
          ?
        </span>
      </div>

      {/* Options */}
      <div className="grid w-full max-w-md grid-cols-4 gap-3">
        {item.options.map((m) => (
          <button
            key={m}
            onClick={() => pick(m)}
            disabled={picked !== null}
            className={
              "flex h-20 items-center justify-center rounded-3xl border-2 bg-surface shadow-soft transition-all active:scale-[0.95] disabled:opacity-60 " +
              (picked === m
                ? m === item.answer
                  ? "border-ok! bg-ok/10!"
                  : "border-danger/60! bg-danger/5!"
                : picked !== null && m === item.answer
                  ? "border-ok! bg-ok/10!"
                  : "border-line hover:border-accent")
            }
          >
            <span className={"text-4xl font-black " + MOTIF_COLORS[m]}>
              {MOTIF_GLYPHS[m]}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
