"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Eye,
  Gamepad2,
  Heart,
  Lock,
  ScanFace,
  Shield,
  Sparkles,
  UserPlus,
  WifiOff,
  Download,
} from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { MemoryScene } from "@/components/landing/memory-scene";
import { openInstallPrompt } from "@/components/pwa/install-prompt";
import { HeroVideo } from "@/components/landing/hero-video";
import { ScienceSlides } from "@/components/landing/science-slides";

const ONBOARDING_KEY = "ma.onboarded.v1";

/** Marquee ticker: the cognitive domains every game trains. */
const TICKER_ITEMS: { emoji: string; label: string }[] = [
  { emoji: "🧠", label: "Remembering people & moments" },
  { emoji: "📝", label: "Holding lists in mind" },
  { emoji: "🎯", label: "Paying attention" },
  { emoji: "🗺️", label: "Planning & ordering" },
  { emoji: "🔍", label: "Finding what's placed" },
  { emoji: "🎵", label: "Music & rhythm" },
  { emoji: "💬", label: "Stories worth retelling" },
];

const heroStagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12, delayChildren: 0.1 } },
};

const heroItem = {
  hidden: { opacity: 0, y: 24 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: "spring" as const, stiffness: 120, damping: 20 },
  },
};

/**
 * Landing page (community design, integrated).
 *
 * Rendered INSIDE AppShell's <main id="content"> — so this file must only
 * output sections; landmarks and the footer live in the shell.
 * The hero is pure CSS (layered gradients + woven motif + a slow Ken Burns
 * drift): zero network requests, fully offline, and the global
 * .reduce-motion rule stills it for vestibular accessibility.
 */
export default function LandingPage() {
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [slide, setSlide] = useState(0);

  useEffect(() => {
    try {
      if (!window.localStorage.getItem(ONBOARDING_KEY)) setOnboardingOpen(true);
    } catch {
      // storage blocked — skip onboarding
    }
  }, []);

  const closeOnboarding = () => {
    setOnboardingOpen(false);
    try {
      window.localStorage.setItem(ONBOARDING_KEY, "1");
    } catch {}
  };

  return (
    <div className="overflow-x-hidden">
      {/* Hero Section */}
      <section className="relative flex min-h-[580px] items-center overflow-hidden md:min-h-[640px] lg:min-h-[82vh]">
        {/* Cinematic backdrop — ambient video at the base, then brand-tint
            duotone, constellation, weave and scrims stacked above it so the
            headline stays perfectly legible even if the video fails. */}
        <div aria-hidden className="absolute inset-0 z-0 overflow-hidden">
          <div className="ken-burns absolute inset-[-4%]">
            <HeroVideo src="/hero-memory.mp4" />
          </div>
          {/* Brand tint + legibility scrims */}
          <div className="video-duotone absolute inset-0" />
          <div className="absolute inset-0 bg-[radial-gradient(120%_90%_at_15%_10%,rgba(19,78,74,0.55)_0%,rgba(11,61,58,0.35)_38%,rgba(10,46,51,0.5)_62%,rgba(12,26,36,0.72)_100%)]" />
          <div className="video-vignette absolute inset-0" />
          <div className="film-grain absolute inset-0" />
          {/* WebGL memory constellation — lazy three.js chunk, static under
              reduced motion, silent fallback to this gradient if no WebGL */}
          <MemoryScene />
          {/* Handloom-inspired weave over the gradient */}
          <div className="woven-motif absolute inset-0 opacity-30" />
          <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-canvas via-canvas/70 to-transparent" />
        </div>

        {/* Hero Content */}
        <motion.div
          variants={heroStagger}
          initial="hidden"
          animate="show"
          className="relative z-20 mx-auto w-full max-w-7xl px-1 py-16 md:px-6"
        >
          {/* Pill Badge */}
          <motion.div
            variants={heroItem}
            className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 shadow-sm backdrop-blur-md"
          >
            <span className="h-2.5 w-2.5 rounded-full bg-secondary-fixed shadow-[0_0_8px_#b0f0d6]" />
            <span className="text-label-lg font-semibold tracking-wide text-surface-bright">
              Privacy-first assistive technology
            </span>
          </motion.div>

          {/* Headline */}
          <motion.h1
            variants={heroItem}
            className="text-hero-gradient mb-6 max-w-3xl text-balance text-5xl font-extrabold leading-[1.05] tracking-tight drop-shadow-md md:text-7xl"
          >
            Helping familiar faces stay&nbsp;familiar.
          </motion.h1>

          {/* Description */}
          <motion.p
            variants={heroItem}
            className="mb-10 max-w-2xl text-xl leading-relaxed text-surface-container-highest opacity-95 drop-shadow-sm md:text-2xl"
          >
            A private, gentle assistant that helps recognize the people who
            matter most — using the camera you already have and nothing but
            this device.
          </motion.p>

          {/* Action Buttons */}
          <motion.div variants={heroItem} className="flex w-full flex-col gap-4 sm:w-auto sm:flex-row">
            <Link
              href="/recognition"
              className="btn-sheen flex min-h-[52px] items-center justify-center gap-2.5 rounded-full bg-primary-container px-8 py-3.5 text-button-text font-bold text-on-primary brightness-110 shadow-lift transition-all duration-300 hover:scale-[1.02] hover:bg-primary hover:shadow-[0_0_24px_rgba(16,185,129,0.35)]"
            >
              <Eye className="h-5 w-5" aria-hidden />
              Open Companion Mode
            </Link>
            <Link
              href="/caregiver"
              className="flex min-h-[52px] items-center justify-center rounded-full border-2 border-secondary-fixed px-8 py-3.5 text-button-text font-bold text-surface-bright transition-all duration-300 hover:scale-[1.02] hover:bg-secondary-fixed/15"
            >
              Caregiver Dashboard
            </Link>
              <Link
                href="/play"
                className="flex min-h-[52px] items-center justify-center rounded-full border-2 border-secondary-fixed px-8 py-3.5 text-button-text font-bold text-surface-bright transition-all duration-300 hover:scale-[1.02] hover:bg-secondary-fixed/15"
              >
                Mind Games
              </Link>
              <button
                type="button"
                onClick={() => openInstallPrompt()}
                className="flex min-h-[52px] items-center justify-center gap-2 rounded-full border-2 border-white/40 px-8 py-3.5 text-button-text font-bold text-surface-bright transition-all duration-300 hover:scale-[1.02] hover:bg-white/10"
              >
                <Download className="h-5 w-5" aria-hidden />
                Install app
              </button>
            </motion.div>
        </motion.div>
      </section>

      {/* Domain ticker — endless marquee of what the games train */}
      <div aria-hidden className="relative z-30 border-y border-line/60 bg-surface/70 py-3.5 backdrop-blur">
        <div className="marquee">
          <div className="marquee-track">
            {[0, 1].map((copy) => (
              <div key={copy} className="flex shrink-0 items-center gap-12">
                {TICKER_ITEMS.map((item) => (
                  <span
                    key={item.label}
                    className="flex items-center gap-3 whitespace-nowrap text-base font-bold uppercase tracking-widest text-ink-soft"
                  >
                    <span className="text-xl">{item.emoji}</span>
                    {item.label}
                    <Sparkles className="h-4 w-4 text-accent/60" />
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Feature Grid */}
      <section aria-label="Features" className="relative z-30 mx-auto max-w-7xl px-4 py-16 md:px-6 md:py-24">
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4"
        >
          {FEATURE_CARDS.map((card) => (
            <FeatureCard key={card.title} {...card} />
          ))}
        </motion.div>
      </section>

      {/* Research slides — evidence behind every game */}
      <ScienceSlides />

      {/* How it works */}
      <section
        aria-label="How MemoryAssist works"
        className="mx-auto max-w-7xl px-4 pb-20 md:px-6"
      >
        <motion.div
          initial={{ opacity: 0, y: 32 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
          className="glass-panel rounded-[2.5rem] p-8 shadow-soft md:p-14"
        >
            <h2 className="text-center text-3xl font-bold tracking-tight text-on-surface md:text-4xl">
              Two gentle modes
            </h2>
            <div className="mt-10 grid gap-8 md:grid-cols-2">
              <div className="rounded-3xl border border-line/60 bg-surface-container-low p-7">
                <span className="text-sm font-bold uppercase tracking-widest text-primary">
                  For caregivers
                </span>
                <h3 className="mt-3 text-2xl font-bold text-on-surface">
                  Add familiar people
                </h3>
                <ol className="mt-4 space-y-3 text-lg leading-relaxed text-on-surface-variant">
                  <li className="flex gap-3">
                    <UserPlus className="mt-1 h-5 w-5 shrink-0 text-primary" aria-hidden />
                    <span>Add a photo, name, relationship and one kind sentence.</span>
                  </li>
                  <li className="flex gap-3">
                    <Sparkles className="mt-1 h-5 w-5 shrink-0 text-primary" aria-hidden />
                    <span>A private face profile is created locally in seconds.</span>
                  </li>
                  <li className="flex gap-3">
                    <Heart className="mt-1 h-5 w-5 shrink-0 text-primary" aria-hidden />
                    <span>Everything stays under your family&apos;s control.</span>
                  </li>
                </ol>
                <Link
                  href="/caregiver/add"
                  className="mt-6 inline-flex min-h-[48px] items-center justify-center rounded-full border border-line bg-surface px-6 py-2.5 text-base font-semibold text-primary transition-colors hover:bg-surface-container-high"
                >
                  Add someone familiar
                </Link>
              </div>

              <div className="rounded-3xl bg-night p-7 text-white shadow-lift">
                <span className="text-sm font-bold uppercase tracking-widest text-secondary-fixed">
                  For your loved one
                </span>
                <h3 className="mt-3 text-2xl font-bold">Companion Mode</h3>
                <div className="mt-5 rounded-2xl bg-white/10 p-5 backdrop-blur">
                  <p className="identity-name font-bold leading-tight">Sam</p>
                  <p className="identity-relation mt-1 text-secondary-fixed">
                    Your Mother
                  </p>
                  <p className="identity-description mt-3 text-white/80">
                    She enjoys gardening.
                  </p>
                </div>
                <p className="mt-4 text-lg leading-relaxed text-white/70">
                  Look toward someone familiar and their name appears — calmly,
                  with an optional soft voice to match.
                </p>
                <Link
                  href="/recognition"
                  className="mt-6 inline-flex min-h-[48px] items-center gap-2 rounded-full bg-secondary-fixed px-6 py-2.5 text-base font-bold text-on-secondary-fixed shadow-soft transition-all hover:bg-secondary-fixed-dim"
                >
                  Try Companion Mode
                  <ArrowRight className="h-5 w-5" aria-hidden />
                </Link>
              </div>
            </div>
          </motion.div>
        </section>

      {/* Onboarding Modal — first-run welcome */}
      <Modal
        open={onboardingOpen}
        onClose={closeOnboarding}
        title="Welcome to MemoryAssist"
      >
        {slide === 0 && (
          <div className="animate-fade-in">
            <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-accent-soft text-accent">
              <Heart className="h-12 w-12" aria-hidden />
            </div>
            <p className="text-lg leading-relaxed text-ink-soft">
              MemoryAssist helps people with memory impairment recognize
              familiar people — gently, privately, and right on the device they
              already use.
            </p>
          </div>
        )}
        {slide === 1 && (
          <div className="animate-fade-in">
            <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <Lock className="h-12 w-12" aria-hidden />
            </div>
            <p className="text-lg leading-relaxed text-ink-soft">
              Your information stays on this device. Photos and recognition data
              are processed locally and are never uploaded to any server.
            </p>
          </div>
        )}
        {slide === 2 && (
          <div className="animate-fade-in">
            <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-teal-50 text-teal-600">
              <ScanFace className="h-12 w-12" aria-hidden />
            </div>
            <p className="text-lg leading-relaxed text-ink-soft">
              Caregivers add familiar people. Companion Mode then uses the camera
              to help recognize them — showing a name, a relationship, and a
              few kind words.
            </p>
          </div>
        )}
        <div className="mt-8 flex items-center justify-between">
          <div className="flex gap-2" aria-hidden>
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className={`h-2 rounded-full transition-all duration-300 ${
                  i === slide ? "w-6 bg-accent" : "w-2 bg-line"
                }`}
              />
            ))}
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={closeOnboarding}
              className="min-h-[44px] rounded-full px-5 py-2.5 text-base font-semibold text-ink-soft transition-colors hover:bg-surface-muted"
            >
              Skip
            </button>
            {slide < 2 ? (
              <button
                type="button"
                onClick={() => setSlide((s) => s + 1)}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-accent px-6 py-2.5 text-base font-semibold text-white shadow-soft transition-colors hover:bg-accent-strong"
              >
                Next
                <ArrowRight className="h-4 w-4" aria-hidden />
              </button>
            ) : (
              <button
                type="button"
                onClick={closeOnboarding}
                className="inline-flex min-h-[44px] items-center rounded-full bg-accent px-6 py-2.5 text-base font-semibold text-white shadow-soft transition-colors hover:bg-accent-strong"
              >
                Let&apos;s get started
              </button>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}

const FEATURE_CARDS: {
  href?: string;
  icon: React.ComponentType<{ className?: string }>;
  tint: string;
  title: string;
  body: string;
}[] = [  {
    href: "/play",
    icon: Gamepad2,
    tint: "bg-primary-container text-on-primary-container",
    title: "Mind Games that adapt to you",
    body: "Engage with family photos, daily morning routines, and gentle progress tracking designed for cognitive support.",
  },
  {
    icon: Shield,
    tint: "bg-secondary-container text-on-secondary-container",
    title: "Private by design",
    body: "Fully on-device processing. No video or personal data ever leaves your browser, ensuring complete dignity.",
  },
  {
    icon: Sparkles,
    tint: "bg-tertiary-container text-on-tertiary-container",
    title: "Built for clarity",
    body: "Large clear names, gentle reassuring wording, and optional voice guidance for accessibility.",
  },
  {
    icon: WifiOff,
    tint: "bg-surface-variant text-on-surface-variant",
    title: "Works offline",
    body: "Consistent support everywhere. Facial recognition and core features keep working without an internet connection.",
  },
];

function FeatureCard({
  href,
  icon: Icon,
  tint,
  title,
  body,
}: (typeof FEATURE_CARDS)[number]) {
  const inner = (
    <>
      <div
        className={`mb-2 flex h-12 w-12 items-center justify-center rounded-full shadow-sm transition-transform group-hover:scale-110 ${tint}`}
      >
        <Icon className="h-6 w-6" aria-hidden />
      </div>
      <h2 className="text-lg font-bold leading-snug text-on-surface">{title}</h2>
      <p className="leading-relaxed text-on-surface-variant">{body}</p>
      <div aria-hidden className="woven-motif absolute bottom-0 right-0 h-24 w-24 opacity-15" />
    </>
  );
  const cls =
    "card-hairline glass-panel group relative flex h-full flex-col gap-3 overflow-hidden rounded-3xl border border-line/70 p-6 transition-all duration-300 hover:-translate-y-1 hover:border-accent hover:shadow-[0_0_24px_rgba(16,185,129,0.18)]";
  return href ? (
    <Link href={href} className={cls}>
      {inner}
    </Link>
  ) : (
    <div className={cls}>{inner}</div>
  );
}
