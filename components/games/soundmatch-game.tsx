"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Volume2 } from "lucide-react";
import { difficultyLevel } from "@/lib/cognition/traits";
import { mulberry32, shuffle } from "@/lib/games/rng";
import type { GameStageProps } from "./faces-game";

/**
 * "Sound Match" — auditory recognition from the Cognitive Stimulation
 * Therapy (CST) "sound" session (Spector et al., 2003; the only
 * non-pharmacological intervention recommended by NICE for cognition in
 * dementia). Hearing a sound and finding its source trains orientation,
 * attention and semantic memory through a multi-sensory channel that
 * often stays intact longer.
 *
 * All sounds are synthesized locally with WebAudio (no assets, works
 * offline). Errorless scoring: a miss never ends the item — it counts as
 * a hint and the player retries, matching the app-wide outcomeScore.
 */

type SoundId = "bell" | "drum" | "chime" | "whistle" | "rain";

const SOUNDS: Record<
  SoundId,
  { label: string; emoji: string; play: (ctx: AudioContext) => void }
> = {
  bell: {
    label: "Temple bell",
    emoji: "🔔",
    play: (ctx) => ringBell(ctx),
  },
  drum: {
    label: "Drum",
    emoji: "🥁",
    play: (ctx) => thumpDrum(ctx),
  },
  chime: {
    label: "Wind chime",
    emoji: "🎐",
    play: (ctx) => chimeArpeggio(ctx),
  },
  whistle: {
    label: "Whistle",
    emoji: "🎺",
    play: (ctx) => sweepWhistle(ctx),
  },
  rain: {
    label: "Rain",
    emoji: "🌧️",
    play: (ctx) => rainNoise(ctx),
  },
};

const SOUND_IDS = Object.keys(SOUNDS) as SoundId[];

// --- Tiny WebAudio synth voices -------------------------------------------

function envelope(ctx: AudioContext, gain: GainNode, peak: number, dur: number): void {
  const t = ctx.currentTime;
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(peak, t + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
}

function ringBell(ctx: AudioContext): void {
  const g = ctx.createGain();
  g.connect(ctx.destination);
  envelope(ctx, g, 0.22, 1.6);
  for (const f of [660, 990, 1320]) {
    const o = ctx.createOscillator();
    o.frequency.value = f;
    o.connect(g);
    o.start();
    o.stop(ctx.currentTime + 1.7);
  }
}

function thumpDrum(ctx: AudioContext): void {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = "sine";
  const t = ctx.currentTime;
  o.frequency.setValueAtTime(150, t);
  o.frequency.exponentialRampToValueAtTime(52, t + 0.28);
  g.gain.setValueAtTime(0.5, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
  o.connect(g).connect(ctx.destination);
  o.start();
  o.stop(t + 0.45);
}

function chimeArpeggio(ctx: AudioContext): void {
  [523.25, 659.25, 783.99].forEach((f, i) => {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.value = f;
    o.connect(g).connect(ctx.destination);
    const t = ctx.currentTime + i * 0.14;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.18, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
    o.start(t);
    o.stop(t + 1);
  });
}

function sweepWhistle(ctx: AudioContext): void {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = "sine";
  const t = ctx.currentTime;
  o.frequency.setValueAtTime(600, t);
  o.frequency.linearRampToValueAtTime(1500, t + 0.35);
  o.frequency.linearRampToValueAtTime(880, t + 0.75);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.2, t + 0.05);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.85);
  o.connect(g).connect(ctx.destination);
  o.start();
  o.stop(t + 0.9);
}

function rainNoise(ctx: AudioContext): void {
  const dur = 1.6;
  const buffer = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = 2400;
  filter.Q.value = 0.6;
  const g = ctx.createGain();
  const t = ctx.currentTime;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(0.16, t + 0.25);
  g.gain.setValueAtTime(0.16, t + dur - 0.3);
  g.gain.linearRampToValueAtTime(0.0001, t + dur);
  src.connect(filter).connect(g).connect(ctx.destination);
  src.start();
}

export function SoundMatchGame({
  difficulty,
  itemKey,
  startTrial,
  completeTrial,
}: GameStageProps) {
  const level = Math.max(0, difficultyLevel(difficulty));
  const choiceCount = Math.min(4, 3 + Math.floor(level / 3));

  const ctxRef = useRef<AudioContext | null>(null);
  const getCtx = (): AudioContext | null => {
    try {
      if (!ctxRef.current) ctxRef.current = new AudioContext();
      if (ctxRef.current.state === "suspended") void ctxRef.current.resume();
      return ctxRef.current;
    } catch {
      return null;
    }
  };
  useEffect(
    () => () => {
      void ctxRef.current?.close().catch(() => undefined);
      ctxRef.current = null;
    },
    [],
  );

  const doneRef = useRef(false);
  const correctionsRef = useRef(0);
  const [wrongIds, setWrongIds] = useState<SoundId[]>([]);
  const [playedOnce, setPlayedOnce] = useState(false);

  const item = useMemo(() => {
    const rand = mulberry32(itemKey * 7723 + 31);
    const order = shuffle(SOUND_IDS, rand);
    const target = order[0];
    return { target, options: order.slice(0, choiceCount) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemKey, choiceCount]);

  useEffect(() => {
    doneRef.current = false;
    correctionsRef.current = 0;
    setWrongIds([]);
    setPlayedOnce(false);
    startTrial(`soundmatch:${itemKey}:${item.target}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemKey]);

  const playSound = useCallback((): void => {
    const ctx = getCtx();
    if (!ctx) return;
    SOUNDS[item.target].play(ctx);
    setPlayedOnce(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.target]);

  // Auto-play once per item; browsers allow this because entering the game
  // was itself a user gesture. If blocked, the big Play button remains.
  useEffect(() => {
    const t = window.setTimeout(() => playSound(), 450);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemKey]);

  const finish = useCallback(
    (correct: boolean): void => {
      if (doneRef.current) return;
      doneRef.current = true;
      completeTrial({
        correct,
        hintsUsed: correct ? Math.min(correctionsRef.current, 9) : 9,
      });
    },
    [completeTrial],
  );

  const pick = (id: SoundId): void => {
    if (doneRef.current || !playedOnce) return;
    if (id === item.target) {
      const ctx = getCtx();
      if (ctx) chimeArpeggio(ctx);
      finish(true);
    } else {
      correctionsRef.current += 1;
      setWrongIds((w) => [...w, id]);
      const ctx = getCtx();
      if (ctx) thumpDrum(ctx);
    }
  };

  return (
    <div className="flex flex-col items-center gap-7">
      <button
        onClick={playSound}
        aria-label={`Play the mystery sound — ${SOUNDS[item.target].label} hidden`}
        className={
          "group flex h-28 w-28 items-center justify-center rounded-full border-4 shadow-lift transition-all active:scale-95 " +
          (playedOnce
            ? "border-accent/60 bg-accent-soft text-accent"
            : "animate-pulse-soft border-accent bg-accent text-white")
        }
      >
        <Volume2 className="h-12 w-12" aria-hidden />
      </button>
      <p className="text-lg font-bold text-ink">
        {playedOnce ? "What made that sound?" : "Press to hear the sound"}
      </p>

      <div className="grid w-full max-w-xl grid-cols-2 gap-3 sm:grid-cols-4">
        {item.options.map((id) => (
          <button
            key={id}
            onClick={() => pick(id)}
            disabled={!playedOnce || wrongIds.includes(id)}
            aria-label={SOUNDS[id].label}
            className={
              "flex min-h-[110px] flex-col items-center justify-center gap-1 rounded-3xl border-2 bg-surface px-2 py-4 shadow-soft transition-all active:scale-[0.97] disabled:opacity-45 " +
              (wrongIds.includes(id)
                ? "border-danger/60! bg-danger/5!"
                : "border-line hover:border-accent")
            }
          >
            <span className="text-5xl">{SOUNDS[id].emoji}</span>
            <span className="text-sm font-bold text-ink">{SOUNDS[id].label}</span>
          </button>
        ))}
      </div>

      {!playedOnce && (
        <p className="text-base font-semibold text-ink-soft">
          Listen closely — you can play it again anytime 🔊
        </p>
      )}
    </div>
  );
}
