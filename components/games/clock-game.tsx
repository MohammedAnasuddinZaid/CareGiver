"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { difficultyLevel } from "@/lib/cognition/traits";
import { mulberry32, shuffle } from "@/lib/games/rng";
import type { GameStageProps } from "./faces-game";
import type { TrialOutcome } from "@/hooks/use-game-session";
import { PhrasePlayer } from "@/lib/audio/phrase-player";

/**
 * "Telling the Time" — an executive / spatial-orientation task. An analog
 * clock shows a time; the player picks the matching digital label. Reading
 * clocks is a daily-living skill that declines early in cognitive impairment,
 * so it is a meaningful, familiar exercise (also used in CST).
 */
function polar(cx: number, cy: number, r: number, deg: number): [number, number] {
  const rad = ((deg - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
}

export function ClockGame({ difficulty, itemKey, startTrial, completeTrial }: GameStageProps) {
  const level = Math.max(0, difficultyLevel(difficulty));
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

  // Minute granularity widens with difficulty: :00/:30 → +:15/:45 → 5-min.
  const minuteSteps = level >= 2 ? 5 : level === 1 ? 15 : 30;
  const maxMin = 60 / minuteSteps;

  const item = useMemo(() => {
    const rand = mulberry32(itemKey * 40503 + 17);
    const hour = 1 + Math.floor(rand() * 12);
    const minIdx = Math.floor(rand() * maxMin);
    const minute = minIdx * minuteSteps;
    const answer = `${hour}:${String(minute).padStart(2, "0")}`;

    const options = new Set<string>([answer]);
    let guard = 0;
    while (options.size < 3 && guard++ < 40) {
      const h = 1 + Math.floor(rand() * 12);
      const m = Math.floor(rand() * maxMin) * minuteSteps;
      options.add(`${h}:${String(m).padStart(2, "0")}`);
    }
    return { hour, minute, answer, options: shuffle([...options], rand) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemKey, maxMin]);

  useEffect(() => {
    setPicked(null);
    setFeedback(null);
    startTrial(`clock:${itemKey}`);
  }, [item, itemKey, startTrial]);

  // Hand angles for the SVG.
  const minuteAngle = (item.minute / 60) * 360;
  const hourAngle = ((item.hour % 12) / 12) * 360 + (item.minute / 60) * 30;

  const answer = (i: number): void => {
    if (picked) return;
    const chosen = item.options[i];
    setPicked(i);
    const correct = chosen === item.answer;
    setFeedback(correct ? "correct" : "wrong");
    if (correct) {
      playerRef.current.speak(`The time is ${item.answer}.`, "en");
      playerRef.current.tone("success");
    } else {
      playerRef.current.tone("miss");
    }
    later(() => completeTrial({ correct, hintsUsed: 0 } satisfies TrialOutcome), correct ? 800 : 1200);
  };

  const R = 90;
  const cx = 100;
  const cy = 100;
  const [hx, hy] = polar(cx, cy, 52, hourAngle);
  const [mx, my] = polar(cx, cy, 74, minuteAngle);

  return (
    <div className="flex flex-col items-center gap-6">
      <svg viewBox="0 0 200 200" className="h-56 w-56 rounded-full border-4 border-line bg-surface shadow-lift" role="img" aria-label={`Clock showing ${item.answer}`}>
        <circle cx={cx} cy={cy} r={R} fill="rgb(var(--ma-surface))" stroke="rgb(var(--ma-line))" strokeWidth={3} />
        {Array.from({ length: 12 }, (_, i) => {
          const [tx, ty] = polar(cx, cy, R - 8, i * 30);
          return <circle key={i} cx={tx} cy={ty} r={3} fill="rgb(var(--ma-ink))" />;
        })}
        <line x1={cx} y1={cy} x2={hx} y2={hy} stroke="rgb(var(--ma-accent-strong))" strokeWidth={7} strokeLinecap="round" />
        <line x1={cx} y1={cy} x2={mx} y2={my} stroke="rgb(var(--ma-ink))" strokeWidth={4} strokeLinecap="round" />
        <circle cx={cx} cy={cy} r={6} fill="rgb(var(--ma-accent))" />
      </svg>

      <div className="grid w-full max-w-sm grid-cols-3 gap-3">
        {item.options.map((opt, i) => (
          <button
            key={opt}
            onClick={() => answer(i)}
            disabled={!!picked}
            className={
              "min-h-[64px] rounded-2xl border-2 bg-surface px-2 py-3 text-center text-2xl font-bold shadow-soft transition-all active:scale-[0.97] disabled:opacity-70 " +
              (picked === i
                ? opt === item.answer
                  ? "border-ok! bg-ok/10!"
                  : "border-danger/60! bg-danger/5!"
                : picked !== null && opt === item.answer
                  ? "border-ok! bg-ok/10!"
                  : picked !== null
                    ? "border-line opacity-50"
                    : "border-line hover:border-accent")
            }
          >
            {opt}
          </button>
        ))}
      </div>

      {feedback && (
        <div role="status" aria-live="polite" className="animate-fade-in rounded-full bg-accent px-6 py-2 text-lg font-bold text-white">
          {feedback === "correct" ? `${item.answer} ✓` : `It was ${item.answer}`}
        </div>
      )}
    </div>
  );
}
