"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { difficultyLevel } from "@/lib/cognition/traits";
import { mulberry32, randInt } from "@/lib/games/rng";
import type { GameStageProps } from "./faces-game";
import type { TrialOutcome } from "@/hooks/use-game-session";

/**
 * "Repeat the Tune" — Simon-style serial pattern learning (auditory
 * working memory). A pentatonic sequence plays on glowing pads; the player
 * repeats it. Serial recall engages the auditory-verbal loop, a distinct
 * channel from visual games — good for varied daily sessions.
 */

const PADS = [
  { freq: 261.63, css: "bg-teal-500", label: "Sa" }, // C4
  { freq: 293.66, css: "bg-emerald-500", label: "Re" },
  { freq: 329.63, css: "bg-amber-500", label: "Ga" },
  { freq: 392.0, css: "bg-orange-500", label: "Ma" },
  { freq: 440.0, css: "bg-rose-500", label: "Pa" },
] as const;

export function MelodyGame({
  difficulty,
  itemKey,
  startTrial,
  completeTrial,
}: GameStageProps) {
  const level = Math.max(0, difficultyLevel(difficulty));
  const seqLen = Math.min(6, 2 + level);

  const [phase, setPhase] = useState<"ready" | "listen" | "repeat">("ready");
  const [litPad, setLitPad] = useState<number | null>(null);
  const [inputIdx, setInputIdx] = useState(0);
  const [wrongFlash, setWrongFlash] = useState(false);

  const audioRef = useRef<AudioContext | null>(null);
  const timersRef = useRef<number[]>([]);
  const doneRef = useRef(false);
  const sequenceRef = useRef<number[]>([]);

  const sequence = useMemo(() => {
    const rand = mulberry32(itemKey * 32452843 + 41);
    return Array.from({ length: seqLen }, () => randInt(rand, 0, PADS.length - 1));
  }, [itemKey, seqLen]);
  sequenceRef.current = sequence;

  const clearTimers = useCallback((): void => {
    for (const t of timersRef.current) window.clearTimeout(t);
    timersRef.current = [];
  }, []);

  useEffect(() => () => clearTimers(), [clearTimers]);

  // Release the audio device when the game unmounts entirely.
  useEffect(
    () => () => {
      void audioRef.current?.close().catch(() => undefined);
      audioRef.current = null;
    },
    [],
  );

  useEffect(() => {
    setPhase("ready");
    setInputIdx(0);
    setLitPad(null);
    doneRef.current = false;
    startTrial(`melody:${itemKey}`);
    return () => clearTimers();
  }, [itemKey, startTrial, clearTimers]);

  const playTone = useCallback((padIndex: number, durationMs = 320): void => {
    try {
      audioRef.current ??= new AudioContext();
      const ctx = audioRef.current;
      if (ctx.state === "suspended") void ctx.resume();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = PADS[padIndex].freq;
      gain.gain.setValueAtTime(0.22, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + durationMs / 1000);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + durationMs / 1000 + 0.02);
    } catch {
      // Audio blocked — pads still light up so the game stays playable.
    }
  }, []);

  const beginPlayback = useCallback((): void => {
    clearTimers();
    setPhase("listen");
    const stepMs = Math.max(420, 700 - level * 40);
    sequence.forEach((pad, i) => {
      timersRef.current.push(
        window.setTimeout(() => {
          setLitPad(pad);
          playTone(pad);
          timersRef.current.push(
            window.setTimeout(() => {
              setLitPad(null);
              if (i === sequence.length - 1) {
                timersRef.current.push(
                  window.setTimeout(() => {
                    setInputIdx(0);
                    setPhase("repeat");
                  }, 250),
                );
              }
            }, stepMs * 0.55),
          );
        }, i * stepMs),
      );
    });
  }, [clearTimers, level, playTone, sequence]);

  const finish = useCallback(
    (correct: boolean): void => {
      if (doneRef.current) return;
      doneRef.current = true;
      timersRef.current.push(window.setTimeout(() => completeTrial({ correct }), 600));
    },
    [completeTrial],
  );

  const tapPad = (padIndex: number): void => {
    // Locked out during the wrong-flash pause: stray taps would otherwise
    // desync inputIdx against the sequence about to be replayed.
    if (phase !== "repeat" || wrongFlash || doneRef.current) return;
    playTone(padIndex, 220);
    setLitPad(padIndex);
    timersRef.current.push(window.setTimeout(() => setLitPad(null), 180));

    if (sequenceRef.current[inputIdx] === padIndex) {
      const next = inputIdx + 1;
      if (next >= seqLen) finish(true);
      else setInputIdx(next);
    } else {
      // One gentle retry (errorless learning), then resolve as incorrect.
      if (!wrongFlash) {
        setWrongFlash(true);
        setInputIdx(0);
        timersRef.current.push(
          window.setTimeout(() => {
            setWrongFlash(false);
            beginPlayback();
          }, 900),
        );
        return;
      }
      finish(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-7">
      <p className="text-center text-lg font-bold text-ink">
        {phase === "ready" && "Press listen, watch and hear the tune"}
        {phase === "listen" && "Listen carefully… 🎵"}
        {phase === "repeat" && (wrongFlash ? "Almost! One more try…" : "Now tap the same tune")}
      </p>

      <div className="grid w-full max-w-sm grid-cols-3 gap-3">
        {PADS.map((pad, i) => (
          <button
            key={pad.label}
            onClick={() => tapPad(i)}
            disabled={phase !== "repeat" || wrongFlash}
            aria-label={`Note ${pad.label}`}
            className={clsx(
              "flex aspect-[4/3] items-end justify-start rounded-3xl p-3 text-lg font-black text-white/95 shadow-lift transition-all duration-100 active:scale-[0.96]",
              pad.css,
              litPad === i ? "brightness-150 ring-4 ring-white/70 scale-[1.04]" : "brightness-75",
              phase !== "repeat" && litPad !== i && "opacity-60",
              i === 0 && "col-span-2",
            )}
          >
            {pad.label}
          </button>
        ))}
      </div>

      {/* Progress dots */}
      <div className="flex items-center gap-1.5">
        {Array.from({ length: seqLen }, (_, i) => (
          <span
            key={i}
            className={clsx(
              "h-2.5 w-2.5 rounded-full transition-colors",
              phase === "repeat" && i < inputIdx ? "bg-accent" : "bg-line",
            )}
          />
        ))}
      </div>

      {phase === "ready" && (
        <button
          onClick={beginPlayback}
          className="min-h-[56px] rounded-full bg-accent px-10 py-3 text-lg font-bold text-white shadow-soft transition-transform active:scale-[0.98]"
        >
          Listen
        </button>
      )}
    </div>
  );
}
