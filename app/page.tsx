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
} from "lucide-react";
import { Modal } from "@/components/ui/modal";

const ONBOARDING_KEY = "ma.onboarded.v1";

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
    <div className="min-h-screen bg-background text-on-background flex flex-col font-body-md overflow-x-hidden -mt-4 md:-mt-6">
      {/* Main Content */}
      <main className="flex-grow">
        {/* Hero Section */}
        <section className="relative w-full min-h-[580px] md:min-h-[640px] lg:h-[85vh] flex items-center overflow-hidden">
          {/* Background Image with Ken Burns Effect */}
          <div className="absolute inset-0 z-0 overflow-hidden">
            <div
              className="w-full h-full bg-cover bg-center ken-burns"
              data-alt="Dignified portrait with soft natural lighting and woven textiles"
              style={{
                backgroundImage:
                  "url('https://lh3.googleusercontent.com/aida-public/AB6AXuAfaLTeqceOh-a0NWcHoZeu0PlPHmZ3HHAfZq7rWxW37VCKwvN8YGzrC7SU8m---gp1p4p27Hp271VO1tawyjD7H5vLiR_H3fuT1rj7IElqfxhGG4pR7QBEX3XqzxFiHT4Zhav8c3uIGV0lpEN2_hAHK0n3SAPoO2anRUlyqqxBGUHNTFjtGSAE6CZjBxh_Q88O2NllgHGrzU-pSiK7LnXK4_o2kdDCLEW2B2oLJx5cfjGhA6ARZjAT')",
              }}
            />
          </div>

          {/* Gradient Overlay */}
          <div className="absolute inset-0 z-10 bg-gradient-to-r from-slate-950/90 via-slate-900/85 to-teal-950/80 backdrop-blur-[2px]" />

          {/* Hero Content */}
          <motion.div
            variants={heroStagger}
            initial="hidden"
            animate="show"
            className="relative z-20 w-full max-w-7xl mx-auto px-container-margin py-16 flex flex-col items-start text-on-primary"
          >
            {/* Pill Badge */}
            <motion.div
              variants={heroItem}
              className="inline-flex items-center gap-2 bg-surface-container/20 backdrop-blur-md border border-outline-variant/30 rounded-full px-4 py-2 mb-6 shadow-sm"
            >
              <span className="w-2.5 h-2.5 rounded-full bg-secondary-fixed shadow-[0_0_8px_#b0f0d6]" />
              <span className="text-label-lg font-label-lg text-surface-bright">
                Privacy-first assistive technology
              </span>
            </motion.div>

            {/* Headline */}
            <motion.h1
              variants={heroItem}
              className="text-headline-lg-mobile md:text-headline-lg font-headline-lg-mobile md:font-headline-lg max-w-3xl mb-6 text-surface-container-lowest drop-shadow-md"
            >
              Helping familiar faces stay familiar.
            </motion.h1>

            {/* Description */}
            <motion.p
              variants={heroItem}
              className="text-body-lg font-body-lg max-w-2xl mb-10 text-surface-container-highest opacity-95 drop-shadow-sm leading-relaxed"
            >
              A private, gentle assistant that helps recognize the people who
              matter most — using the camera you already have and nothing but
              this device.
            </motion.p>

            {/* Action Buttons */}
            <motion.div
              variants={heroItem}
              className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto"
            >
              <Link
                href="/recognition"
                className="bg-primary text-on-primary text-button-text font-button-text px-8 py-3.5 rounded-full min-h-[48px] hover:scale-[1.02] hover:ring-2 hover:ring-secondary-fixed/50 hover:shadow-[0_0_20px_rgba(0,92,85,0.6)] transition-all duration-300 flex items-center justify-center gap-2.5 brightness-110 shadow-lift"
              >
                <Eye className="h-5 w-5" aria-hidden />
                Open Companion Mode
              </Link>
              <Link
                href="/caregiver"
                className="bg-transparent border-2 border-secondary-fixed text-surface-bright text-button-text font-button-text px-8 py-3.5 rounded-full min-h-[48px] hover:scale-[1.02] hover:bg-secondary-fixed/15 transition-all duration-300 flex items-center justify-center"
              >
                Caregiver Dashboard
              </Link>
              <Link
                href="/play"
                className="bg-transparent text-button-text font-button-text px-8 py-3.5 rounded-full min-h-[48px] transition-all duration-300 flex items-center justify-center border-2 border-secondary-fixed text-surface-bright hover:bg-secondary-fixed/15"
              >
                Mind Games
              </Link>
            </motion.div>
          </motion.div>
        </section>

        {/* Feature Grid */}
        <section
          aria-label="Features"
          className="py-16 md:py-24 px-container-margin max-w-7xl mx-auto relative z-30 -mt-12 md:-mt-16"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Card 1 */}
            <Link
              href="/play"
              className="glass-panel rounded-3xl p-6 relative overflow-hidden group hover:-translate-y-1 hover:border-accent hover:shadow-[0_0_24px_rgba(16,185,129,0.18)] transition-all duration-300 border border-outline-variant/30 flex flex-col gap-4 bg-surface/90 dark:bg-surface-dim/90"
            >
              <div className="w-12 h-12 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center mb-2 shadow-sm group-hover:scale-110 transition-transform">
                <Gamepad2 className="h-6 w-6" aria-hidden />
              </div>
              <h2 className="text-body-lg font-body-lg font-bold text-on-surface">
                Mind Games that adapt to you
              </h2>
              <p className="text-body-md font-body-md text-on-surface-variant leading-relaxed">
                Engage with family photos, daily morning routines, and gentle
                progress tracking designed for cognitive support.
              </p>
              <div className="absolute bottom-0 right-0 w-24 h-24 woven-motif opacity-15" />
            </Link>

            {/* Card 2 */}
            <div className="glass-panel rounded-3xl p-6 relative overflow-hidden group hover:-translate-y-1 hover:border-accent hover:shadow-[0_0_24px_rgba(16,185,129,0.18)] transition-all duration-300 border border-outline-variant/30 flex flex-col gap-4 bg-surface/90 dark:bg-surface-dim/90">
              <div className="w-12 h-12 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center mb-2 shadow-sm group-hover:scale-110 transition-transform">
                <Shield className="h-6 w-6" aria-hidden />
              </div>
              <h2 className="text-body-lg font-body-lg font-bold text-on-surface">
                Private by design
              </h2>
              <p className="text-body-md font-body-md text-on-surface-variant leading-relaxed">
                Fully on-device processing. No video or personal data ever leaves
                your browser, ensuring complete dignity.
              </p>
              <div className="absolute bottom-0 right-0 w-24 h-24 woven-motif opacity-15" />
            </div>

            {/* Card 3 */}
            <div className="glass-panel rounded-3xl p-6 relative overflow-hidden group hover:-translate-y-1 hover:border-accent hover:shadow-[0_0_24px_rgba(16,185,129,0.18)] transition-all duration-300 border border-outline-variant/30 flex flex-col gap-4 bg-surface/90 dark:bg-surface-dim/90">
              <div className="w-12 h-12 rounded-full bg-tertiary-container text-on-tertiary-container flex items-center justify-center mb-2 shadow-sm group-hover:scale-110 transition-transform">
                <Sparkles className="h-6 w-6" aria-hidden />
              </div>
              <h2 className="text-body-lg font-body-lg font-bold text-on-surface">
                Built for clarity
              </h2>
              <p className="text-body-md font-body-md text-on-surface-variant leading-relaxed">
                Features large clear names, gentle reassuring wording, and
                optional voice guidance for accessibility.
              </p>
              <div className="absolute bottom-0 right-0 w-24 h-24 woven-motif opacity-15" />
            </div>

            {/* Card 4 */}
            <div className="glass-panel rounded-3xl p-6 relative overflow-hidden group hover:-translate-y-1 hover:border-accent hover:shadow-[0_0_24px_rgba(16,185,129,0.18)] transition-all duration-300 border border-outline-variant/30 flex flex-col gap-4 bg-surface/90 dark:bg-surface-dim/90">
              <div className="w-12 h-12 rounded-full bg-surface-variant text-on-surface-variant flex items-center justify-center mb-2 shadow-sm group-hover:scale-110 transition-transform">
                <WifiOff className="h-6 w-6" aria-hidden />
              </div>
              <h2 className="text-body-lg font-body-lg font-bold text-on-surface">
                Works offline
              </h2>
              <p className="text-body-md font-body-md text-on-surface-variant leading-relaxed">
                Consistent support everywhere. Facial recognition and core
                features keep working without an internet connection.
              </p>
              <div className="absolute bottom-0 right-0 w-24 h-24 woven-motif opacity-15" />
            </div>
          </div>
        </section>

        {/* How it works section */}
        <section
          aria-label="How MemoryAssist works"
          className="pb-20 px-container-margin max-w-7xl mx-auto"
        >
          <div className="rounded-[2.5rem] border border-outline-variant/30 bg-surface/80 dark:bg-surface-dim/80 backdrop-blur-md p-8 shadow-soft md:p-14">
            <h2 className="text-center text-3xl font-bold tracking-tight md:text-4xl text-on-surface">
              Two gentle modes
            </h2>
            <div className="mt-10 grid gap-8 md:grid-cols-2">
              <div className="rounded-3xl bg-surface-container p-7 border border-outline-variant/20">
                <span className="text-sm font-bold uppercase tracking-widest text-primary">
                  For caregivers
                </span>
                <h3 className="mt-3 text-2xl font-bold text-on-surface">
                  Add familiar people
                </h3>
                <ol className="mt-4 space-y-3 text-lg text-on-surface-variant">
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
                    <span>Everything stays under your family’s control.</span>
                  </li>
                </ol>
                <Link
                  href="/caregiver/add"
                  className="mt-6 inline-flex min-h-[44px] items-center justify-center rounded-full bg-surface px-6 py-2.5 text-base font-semibold text-primary border border-outline-variant/40 hover:bg-surface-container-high transition-colors"
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
                <p className="mt-4 text-lg text-white/70">
                  Look toward someone familiar and their name appears — calmly,
                  with an optional soft voice to match.
                </p>
                <Link
                  href="/recognition"
                  className="mt-6 inline-flex min-h-[44px] items-center gap-2 rounded-full bg-secondary-fixed px-6 py-2.5 text-base font-semibold text-on-secondary-fixed shadow-soft hover:bg-secondary-fixed-dim transition-all"
                >
                  Try Companion Mode
                  <ArrowRight className="h-5 w-5" aria-hidden />
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="w-full bg-[#FAF7F2] dark:bg-surface-container-lowest border-t border-emerald-900/10 text-slate-700 dark:text-on-surface-variant mt-auto">
        <div className="max-w-7xl mx-auto px-container-margin py-14">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10 lg:gap-8 mb-12">
            {/* Column 1: Brand */}
            <div className="lg:col-span-2 space-y-4">
              <span className="text-2xl font-bold font-headline-md tracking-tight text-primary dark:text-primary-fixed-dim inline-block">
                MemoryAssist
              </span>
              <p className="text-slate-600 dark:text-on-surface-variant max-w-sm text-base leading-relaxed">
                Gentle, privacy-first assistive memory care designed with
                dignity and heritage in mind.
              </p>
            </div>

            {/* Column 2: Features */}
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-on-surface mb-4">
                Features
              </h3>
              <ul className="space-y-2.5 text-base">
                <li>
                  <Link
                    href="/recognition"
                    className="hover:text-primary dark:hover:text-primary-fixed-dim transition-colors"
                  >
                    Companion Mode
                  </Link>
                </li>
                <li>
                  <Link
                    href="/caregiver"
                    className="hover:text-primary dark:hover:text-primary-fixed-dim transition-colors"
                  >
                    Caregiver Dashboard
                  </Link>
                </li>
                <li>
                  <Link
                    href="/play"
                    className="hover:text-primary dark:hover:text-primary-fixed-dim transition-colors"
                  >
                    Mind Games
                  </Link>
                </li>
                <li>
                  <Link
                    href="/reminders"
                    className="hover:text-primary dark:hover:text-primary-fixed-dim transition-colors"
                  >
                    Reminders
                  </Link>
                </li>
              </ul>
            </div>

            {/* Column 3: Resources */}
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-on-surface mb-4">
                Resources
              </h3>
              <ul className="space-y-2.5 text-base">
                <li>
                  <Link
                    href="/settings"
                    className="hover:text-primary dark:hover:text-primary-fixed-dim transition-colors"
                  >
                    Settings
                  </Link>
                </li>
                <li>
                  <Link
                    href="/about"
                    className="hover:text-primary dark:hover:text-primary-fixed-dim transition-colors"
                  >
                    About
                  </Link>
                </li>
              </ul>
            </div>

            {/* Column 4: Legal */}
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-on-surface mb-4">
                Legal
              </h3>
              <ul className="space-y-2.5 text-base">
                <li>
                  <Link
                    href="/privacy"
                    className="hover:text-primary dark:hover:text-primary-fixed-dim transition-colors"
                  >
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <Link
                    href="/privacy"
                    className="hover:text-primary dark:hover:text-primary-fixed-dim transition-colors"
                  >
                    Terms of Service
                  </Link>
                </li>
                <li>
                  <Link
                    href="/license"
                    className="hover:text-primary dark:hover:text-primary-fixed-dim transition-colors"
                  >
                    License
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="pt-8 border-t border-emerald-900/10 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-slate-600 dark:text-on-surface-variant">
            <p>© 2026 MemoryAssist</p>
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="inline-flex items-center rounded-full bg-primary-container/10 border border-primary-container/20 px-3 py-1 text-xs font-semibold text-primary dark:text-primary-fixed-dim">
                100% On-Device AI
              </span>
              <span className="inline-flex items-center rounded-full bg-secondary-container/30 border border-secondary-container/40 px-3 py-1 text-xs font-semibold text-secondary dark:text-secondary-fixed-dim">
                Works Offline (PWA)
              </span>
            </div>
          </div>
        </div>
      </footer>

      {/* Onboarding Modal - Logic Intact */}
      <Modal
        open={onboardingOpen}
        onClose={closeOnboarding}
        title="Welcome to MemoryAssist"
      >
        {slide === 0 && (
          <div className="animate-fade-in">
            <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-primary-container/20 text-primary">
              <Heart className="h-12 w-12" aria-hidden />
            </div>
            <p className="text-lg leading-relaxed text-on-surface-variant">
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
            <p className="text-lg leading-relaxed text-on-surface-variant">
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
            <p className="text-lg leading-relaxed text-on-surface-variant">
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
                  i === slide ? "w-6 bg-primary" : "w-2 bg-outline-variant"
                }`}
              />
            ))}
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={closeOnboarding}
              className="rounded-full px-5 py-2.5 min-h-[44px] text-base font-semibold text-on-surface-variant hover:bg-surface-container transition-colors"
            >
              Skip
            </button>
            {slide < 2 ? (
              <button
                type="button"
                onClick={() => setSlide((s) => s + 1)}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-base font-semibold text-on-primary shadow-soft hover:bg-primary-container transition-colors"
              >
                Next
                <ArrowRight className="h-4 w-4" aria-hidden />
              </button>
            ) : (
              <button
                type="button"
                onClick={closeOnboarding}
                className="inline-flex min-h-[44px] items-center rounded-full bg-primary px-6 py-2.5 text-base font-semibold text-on-primary shadow-soft hover:bg-primary-container transition-colors"
              >
                Let’s get started
              </button>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}
