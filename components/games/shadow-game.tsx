"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { difficultyLevel } from "@/lib/cognition/traits";
import { mulberry32, shuffle } from "@/lib/games/rng";
import type { GameStageProps } from "./faces-game";
import type { TrialOutcome } from "@/hooks/use-game-session";
import { PhrasePlayer } from "@/lib/audio/phrase-player";

/**
 * "Shadow Match" — a visual discrimination task. A target shape+color is
 * shown; the player finds the single candidate that matches it exactly
 * (same form AND same color). Trains focused visual search and is gentle
 * for low-vision days via large, high-contrast tiles.
 */
type Shape = "circle" | "square" | "triangle" | "diamond" | "star";
const SHAPES: Shape[] = ["circle", "square", "triangle", "diamond", "star"];
const COLORS = ["#ef4444", "#f59e0b", "#10b981", "#3b82f6", "#8b5cf6", "#ec4899"];

function ShapeSvg({ shape, color, size = 56 }: { shape: Shape; color: string; size?: number }) {
  const common = { fill: color, stroke: "rgba(0,0,0,0.15)", strokeWidth: 2 } as const;
  if (shape === "circle") return <circle cx={size / 2} cy={size / 2} r={size / 2 - 6} {...common} />;
  if (shape === "square") return <rect x={6} y={6} width={size - 12} height={size - 12} rx={6} {...common} />;
  if (shape === "triangle") return <polygon points={`${size / 2},6 ${size - 6},${size - 6} 6,${size - 6}`} {...common} />;
  if (shape === "diamond") return <polygon points={`${size / 2},6 ${size - 6},${size / 2} ${size / 2},${size - 6} 6,${size / 2}`} {...common} />;
  // star
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? size / 2 - 6 : size / 4;
    const a = (Math.PI / 5) * i - Math.PI / 2;
    pts.push(`${size / 2 + r * Math.cos(a)},${size / 2 + r * Math.sin(a)}`);
  }
  return <polygon points={pts.join(" ")} {...common} />;
}

export function ShadowGame({ difficulty, itemKey, startTrial, completeTrial }: GameStageProps) {
  const level = Math.max(0, difficultyLevel(difficulty));
  const optionCount = Math.min(6, 3 + level);

  const playerRef = useRef(new PhrasePlayer());
  const [picked, setPicked] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);

  const timersRef = useRef<number[]>([]);
  const later = useCallback((fn: () => void, ms: number): void => {
    timersRef.current.push(window.setTimeout(fn, ms));
  }, []);
  useEffect(() => () => {
    for (const t of timersRef.current) window.clearTimeout(t);
  }, []);

  const item = useMemo(() => {
    const rand = mulberry32(itemKey * 9301 + 49);
    const targetShape = SHAPES[Math.floor(rand() * SHAPES.length)];
    const targetColor = COLORS[Math.floor(rand() * COLORS.length)];
    const target = { shape: targetShape, color: targetColor };

    const distractors: { shape: Shape; color: string }[] = [];
    const ensure = (pred: (c: { shape: Shape; color: string }) => boolean): void => {
      let guard = 0;
      while (distractors.length < optionCount - 1 && guard++ < 60) {
        const s = SHAPES[Math.floor(rand() * SHAPES.length)];
        const c = COLORS[Math.floor(rand() * COLORS.length)];
        if (s === targetShape && c === targetColor) continue; // no duplicate of target
        if (distractors.some((d) => d.shape === s && d.color === c)) continue;
        if (!pred({ shape: s, color: c })) continue;
        distractors.push({ shape: s, color: c });
      }
    };
    // Half differ by shape, half by color — exercises both discriminations.
    ensure((c) => c.shape !== targetShape);
    ensure((c) => c.color !== targetColor);
    while (distractors.length < optionCount - 1) {
      const s = SHAPES[Math.floor(rand() * SHAPES.length)];
      const c = COLORS[Math.floor(rand() * COLORS.length)];
      if (s === targetShape && c === targetColor) continue;
      if (distractors.some((d) => d.shape === s && d.color === c)) continue;
      distractors.push({ shape: s, color: c });
    }
    return { target, options: shuffle([target, ...distractors], rand), answerIndex: 0 };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemKey, optionCount]);

  useEffect(() => {
    setPicked(null);
    setFeedback(null);
    startTrial(`shadow:${itemKey}`);
  }, [item, itemKey, startTrial]);

  const answer = (i: number): void => {
    if (picked) return;
    setPicked(i);
    const correct = i === item.answerIndex;
    setFeedback(correct ? "correct" : "wrong");
    if (correct) playerRef.current.tone("success");
    else playerRef.current.tone("miss");
    later(() => completeTrial({ correct, hintsUsed: 0 } satisfies TrialOutcome), correct ? 800 : 1200);
  };

  return (
    <div className="flex w-full max-w-md flex-col items-center gap-6">
      <div className="flex flex-col items-center gap-2">
        <p className="text-sm font-semibold uppercase tracking-wide text-ink-soft">Find the match</p>
        <div className="flex h-28 w-28 items-center justify-center rounded-3xl border-4 border-line bg-surface shadow-soft">
          <ShapeSvg shape={item.target.shape} color={item.target.color} size={64} />
        </div>
      </div>

      <div className="grid w-full grid-cols-3 gap-3">
        {item.options.map((opt, i) => (
          <button
            key={i}
            onClick={() => answer(i)}
            disabled={!!picked}
            aria-label={`Option ${i + 1}`}
            className={
              "flex aspect-square items-center justify-center rounded-2xl border-2 bg-surface shadow-soft transition-all active:scale-[0.95] disabled:opacity-70 " +
              (picked === i
                ? i === item.answerIndex
                  ? "border-ok! bg-ok/10!"
                  : "border-danger/60! bg-danger/5!"
                : picked !== null && i === item.answerIndex
                  ? "border-ok! bg-ok/10!"
                  : picked !== null
                    ? "border-line opacity-50"
                    : "border-line hover:border-accent/50")
            }
          >
            <ShapeSvg shape={opt.shape} color={opt.color} size={56} />
          </button>
        ))}
      </div>

      {feedback && (
        <div role="status" aria-live="polite" className="animate-fade-in rounded-full bg-accent px-6 py-2 text-lg font-bold text-white">
          {feedback === "correct" ? "Matched! ✓" : "Close — try again"}
        </div>
      )}
    </div>
  );
}
