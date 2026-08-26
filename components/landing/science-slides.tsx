"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight, ChevronLeft, ChevronRight, FlaskConical } from "lucide-react";

/**
 * "The Science" — an auto-advancing slide deck that puts the app's
 * dementia-research pedigree front and centre.
 *
 * Accessibility contract:
 * - pauses on hover AND keyboard focus, arrows/dots are real buttons
 * - framer-motion `useReducedMotion` freezes to a static first slide
 * - every slide links straight to a playable game so evidence → action
 */

interface Slide {
  stat: string;
  statLabel: string;
  title: string;
  body: string;
  citation: string;
  games: { label: string; href: string }[];
}

const SLIDES: readonly Slide[] = [
  {
    stat: "NICE",
    statLabel: "recommended",
    title: "Cognitive Stimulation Therapy",
    body: "Group CST — the only non-drug therapy recommended by NICE for cognition in dementia — measurably improves memory and quality of life. Sorting, sounds and odd-one-out sessions inspired half of this library.",
    citation: "Spector et al., 2003 · NICE guideline NG97",
    games: [
      { label: "Sorting Station", href: "/play/sortit" },
      { label: "Odd One Out", href: "/play/oddone" },
      { label: "Sound Match", href: "/play/soundmatch" },
    ],
  },
  {
    stat: "r = .76",
    statLabel: "recall benefit",
    title: "Spaced Retrieval",
    body: "Expanding gaps between recall attempts let name–face memories stick where rote drill fails — beating trial-and-error learning by a wide margin in controlled trials.",
    citation: "Camp, 1989 · Haslam et al., 2011",
    games: [{ label: "Remembering Names", href: "/play/names" }],
  },
  {
    stat: "22 RCTs",
    statLabel: "systematically reviewed",
    title: "Reminiscence Therapy",
    body: "A Cochrane review of randomised trials found reminiscence improves cognition, mood and daily functioning in dementia — remote memories often outlast recent ones, letting players shine.",
    citation: "Woods et al., Cochrane Database, 2018 · Butler, 1963",
    games: [{ label: "Memory Lane", href: "/play/memorylane" }],
  },
  {
    stat: "0 errors",
    statLabel: "left standing",
    title: "Errorless Learning",
    body: "Wrong attempts are never allowed to consolidate into implicit memory. Every miss re-teaches instantly and counts as a gentle hint — never a failure.",
    citation: "Clare & Wilson, 2004 · Wilson et al., 1994",
    games: [{ label: "Who Is In The Photo?", href: "/play/faces" }],
  },
  {
    stat: "~70%",
    statLabel: "target success rate",
    title: "Adaptive Difficulty",
    body: "An item-response engine quietly retunes every game to hold each player at the edge of their ability — the 'optimal challenge' band where training works and frustration never starts.",
    citation: "IRT psychometrics · Csikszentmihalyi flow model",
    games: [{ label: "See today's plan", href: "/play" }],
  },
];

const HOLD_MS = 7000;

export function ScienceSlides() {
  const reduceMotion = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const timerRef = useRef<number>(0);

  const go = useCallback((next: number) => {
    setIndex(((next % SLIDES.length) + SLIDES.length) % SLIDES.length);
  }, []);

  useEffect(() => {
    if (paused || reduceMotion) return;
    timerRef.current = window.setTimeout(
      () => go(index + 1),
      HOLD_MS,
    );
    return () => window.clearTimeout(timerRef.current);
  }, [index, paused, reduceMotion, go]);

  const slide = SLIDES[index];

  return (
    <section
      aria-label="The research behind Mind Games"
      className="relative z-30 mx-auto max-w-7xl px-4 pb-20 md:px-6 md:pb-28"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <div className="mb-8 flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent-soft">
          <FlaskConical className="h-6 w-6 text-accent" aria-hidden />
        </span>
        <div>
          <h2 className="text-shimmer text-3xl font-extrabold tracking-tight md:text-4xl">
            Designed on evidence
          </h2>
          <p className="text-base text-on-surface-variant">
            Every game traces back to published dementia research
          </p>
        </div>
      </div>

      <div
        className="gradient-ring glass-panel relative overflow-hidden rounded-[2.5rem] shadow-lift"
        role="group"
        aria-roledescription="carousel"
        aria-label={`Research highlight ${index + 1} of ${SLIDES.length}`}
      >
        {/* Progress hairline */}
        {!reduceMotion && (
          <div aria-hidden className="absolute inset-x-0 top-0 h-1 bg-line/40">
            <motion.div
              key={index}
              className="h-full bg-gradient-to-r from-accent to-secondary-fixed"
              initial={{ width: "0%" }}
              animate={{ width: paused ? "0%" : "100%" }}
              transition={{ duration: HOLD_MS / 1000, ease: "linear" }}
            />
          </div>
        )}

        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={index}
            initial={reduceMotion ? false : { opacity: 0, x: 64 }}
            animate={{ opacity: 1, x: 0 }}
            exit={reduceMotion ? undefined : { opacity: 0, x: -64 }}
            transition={{ type: "spring", stiffness: 210, damping: 28 }}
            className="grid gap-8 p-8 md:grid-cols-[auto_1fr] md:p-14"
          >
            {/* Giant stat */}
            <div className="flex flex-row items-center gap-5 md:flex-col md:items-start md:gap-1">
              <span className="bg-gradient-to-br from-accent-strong to-primary text-6xl font-black leading-none tracking-tight md:text-7xl">
                {slide.stat}
              </span>
              <span className="text-sm font-bold uppercase tracking-widest text-accent">
                {slide.statLabel}
              </span>
            </div>

            <div className="min-w-0">
              <h3 className="text-2xl font-extrabold tracking-tight text-on-surface md:text-3xl">
                {slide.title}
              </h3>
              <p className="mt-3 max-w-2xl text-lg leading-relaxed text-on-surface-variant">
                {slide.body}
              </p>
              <p className="mt-3 text-sm font-semibold uppercase tracking-wide text-outline">
                {slide.citation}
              </p>

              <div className="mt-5 flex flex-wrap items-center gap-2.5">
                {slide.games.map((g) => (
                  <Link
                    key={g.href + g.label}
                    href={g.href}
                    className="btn-sheen inline-flex min-h-[44px] items-center gap-2 rounded-full border border-accent/40 bg-surface px-5 py-2 text-button-text font-bold text-primary transition-all hover:-translate-y-0.5 hover:border-accent hover:shadow-soft"
                  >
                    Play: {g.label}
                    <ArrowRight className="h-4 w-4" aria-hidden />
                  </Link>
                ))}
              </div>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Controls */}
        <div className="flex items-center justify-between px-8 pb-8 md:px-14 md:pb-10">
          <div className="flex gap-2" role="tablist" aria-label="Choose slide">
            {SLIDES.map((s, i) => (
              <button
                key={s.stat + s.title}
                role="tab"
                aria-selected={i === index}
                aria-label={`Slide ${i + 1}: ${s.title}`}
                onClick={() => go(i)}
                className={`h-2.5 rounded-full transition-all duration-300 ${
                  i === index ? "w-8 bg-accent" : "w-2.5 bg-line hover:bg-outline"
                }`}
              />
            ))}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => go(index - 1)}
              aria-label="Previous slide"
              className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-line bg-surface text-ink transition-all hover:border-accent hover:text-accent active:scale-95"
            >
              <ChevronLeft className="h-5 w-5" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => go(index + 1)}
              aria-label="Next slide"
              className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-line bg-surface text-ink transition-all hover:border-accent hover:text-accent active:scale-95"
            >
              <ChevronRight className="h-5 w-5" aria-hidden />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
