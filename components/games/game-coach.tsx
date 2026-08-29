"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Sparkles, X } from "lucide-react";
import { coachMessage, type CoachMessage, type CoachTone } from "@/lib/games/coach";
import type { GameId, SkillDomain } from "@/lib/games/types";

const TONE_GRADIENT: Record<CoachTone, string> = {
  welcome: "from-teal-400 to-emerald-500",
  praise: "from-emerald-400 to-teal-500",
  encourage: "from-sky-400 to-cyan-500",
  hint: "from-amber-400 to-orange-500",
  rest: "from-violet-400 to-fuchsia-500",
};

const TONE_LABEL: Record<CoachTone, string> = {
  welcome: "Ready",
  praise: "Great work",
  encourage: "You've got this",
  hint: "A little tip",
  rest: "Take a breath",
};

/**
 * In-game coach. Designed to NEVER block gameplay:
 *  - stays a small corner pill by default (no overlap with the play area);
 *  - pops a short card only when the situation changes, then auto-collapses;
 *  - fully dismissible for the session (X), and can be disabled in Settings.
 */
export function GameCoach({
  gameId,
  trials,
  domain,
}: {
  gameId: GameId;
  trials: { correct: boolean }[];
  domain: SkillDomain;
}) {
  const next = coachMessage(gameId, trials, domain);
  const [shown, setShown] = useState<CoachMessage>(next);
  const [open, setOpen] = useState(false);
  const [hidden, setHidden] = useState(false);
  const lastKey = useRef<string>(next.key);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (next.key === lastKey.current) return;
    lastKey.current = next.key;
    setShown(next);
    setOpen(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(false), 4800);
  }, [next]);

  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  if (hidden) return null;

  return (
    <div className="pointer-events-none fixed bottom-28 left-5 z-30 sm:bottom-32 sm:left-8">
      <AnimatePresence>
        {open && (
          <motion.div
            key={shown.key}
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 280, damping: 24 }}
            className={`pointer-events-auto absolute bottom-full mb-2 w-[min(17rem,72vw)] rounded-2xl bg-gradient-to-br p-[1.5px] shadow-lift ${TONE_GRADIENT[shown.tone]}`}
          >
            <div className="rounded-2xl bg-night-card/95 px-4 py-3 backdrop-blur-md">
              <div className="flex items-start justify-between gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-white/60">
                  {TONE_LABEL[shown.tone]}
                </p>
                <button
                  type="button"
                  onClick={() => setHidden(true)}
                  aria-label="Hide coach for this game"
                  className="-mr-1 -mt-1 rounded-full p-1 text-white/50 transition-colors hover:bg-white/10 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <p className="mt-1 text-sm font-semibold leading-snug text-white">
                {shown.text}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Corner pill — always available, never covers the play area */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Hide coach tip" : "Show coach tip"}
        className={`pointer-events-auto flex items-center gap-2 rounded-full bg-night-card/90 px-3 py-2 text-sm font-semibold text-white shadow-lift backdrop-blur-md transition-colors hover:bg-night-card`}
      >
        <span className={`flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br text-white ${TONE_GRADIENT[shown.tone]}`}>
          <Sparkles className="h-3.5 w-3.5" />
        </span>
        Coach
        <span
          role="button"
          tabIndex={-1}
          aria-hidden
          onClick={(e) => {
            e.stopPropagation();
            setHidden(true);
          }}
          className="ml-0.5 rounded-full p-0.5 text-white/40 transition-colors hover:bg-white/10 hover:text-white"
        >
          <X className="h-3.5 w-3.5" />
        </span>
      </button>
    </div>
  );
}
