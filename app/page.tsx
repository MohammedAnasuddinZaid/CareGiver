"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Heart,
  Lock,
  ScanFace,
  Sparkles,
  UserPlus,
  WifiOff,
} from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardHover } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";

const ONBOARDING_KEY = "ma.onboarded.v1";

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
    <div className="mx-auto max-w-6xl px-4 md:px-6">
      {/* Hero */}
      <section className="flex flex-col items-center py-16 text-center md:py-24 animate-fade-up">
        <span className="inline-flex items-center gap-2 rounded-full border border-teal-200 bg-teal-50 px-4 py-1.5 text-sm font-semibold text-teal-800">
          <Sparkles className="h-4 w-4" aria-hidden />
          Privacy-first assistive technology
        </span>
        <h1 className="mt-6 max-w-3xl text-balance text-5xl font-extrabold leading-[1.05] tracking-tight md:text-7xl">
          Helping familiar faces stay&nbsp;familiar.
        </h1>
        <p className="mt-6 max-w-2xl text-xl leading-relaxed text-ink-soft md:text-2xl">
          MemoryAssist is a private, gentle assistant that helps recognize the
          people who matter most — using the camera you already have and
          nothing but this device.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <ButtonLink href="/recognition" size="xl" className="min-w-[240px]">
            <ScanFace className="h-6 w-6" aria-hidden />
            Open Companion Mode
          </ButtonLink>
          <ButtonLink href="/caregiver" variant="secondary" size="xl" className="min-w-[240px]">
            Caregiver Dashboard
            <ArrowRight className="h-5 w-5" aria-hidden />
          </ButtonLink>
        </div>
        <p className="mt-8 flex items-center gap-2 text-base text-ink-soft">
          <Lock className="h-4 w-4 text-accent" aria-hidden />
          Designed with privacy first. Profiles stay on this device.
        </p>
      </section>

      {/* Feature cards */}
      <section aria-label="What makes MemoryAssist different" className="grid gap-6 pb-16 md:grid-cols-3">
        <CardHover>
          <Card className="h-full p-7">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-soft text-accent">
              <Lock className="h-6 w-6" aria-hidden />
            </span>
            <h2 className="mt-5 text-2xl font-bold tracking-tight">Private by design</h2>
            <p className="mt-3 text-lg leading-relaxed text-ink-soft">
              Faces are analyzed entirely on your device. No video ever leaves
              the browser, and profiles live in local storage — never a cloud.
            </p>
          </Card>
        </CardHover>
        <CardHover>
          <Card className="h-full p-7">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-soft text-accent">
              <Heart className="h-6 w-6" aria-hidden />
            </span>
            <h2 className="mt-5 text-2xl font-bold tracking-tight">Built for clarity</h2>
            <p className="mt-3 text-lg leading-relaxed text-ink-soft">
              Large names, gentle wording, optional voice guidance. When the
              system isn’t sure, it simply says so instead of guessing.
            </p>
          </Card>
        </CardHover>
        <CardHover>
          <Card className="h-full p-7">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-soft text-accent">
              <WifiOff className="h-6 w-6" aria-hidden />
            </span>
            <h2 className="mt-5 text-2xl font-bold tracking-tight">Works offline</h2>
            <p className="mt-3 text-lg leading-relaxed text-ink-soft">
              Install it once and recognition keeps working without internet —
              ready for smart glasses tomorrow, useful today.
            </p>
          </Card>
        </CardHover>
      </section>

      {/* How it works */}
      <section aria-label="How MemoryAssist works" className="pb-20">
        <div className="rounded-[2.5rem] border border-line bg-surface p-8 shadow-soft md:p-14">
          <h2 className="text-center text-3xl font-bold tracking-tight md:text-4xl">
            Two gentle modes
          </h2>
          <div className="mt-10 grid gap-8 md:grid-cols-2">
            <div className="rounded-3xl bg-surface-muted p-7">
              <span className="text-sm font-bold uppercase tracking-widest text-teal-700">
                For caregivers
              </span>
              <h3 className="mt-3 text-2xl font-bold">Add familiar people</h3>
              <ol className="mt-4 space-y-3 text-lg text-ink-soft">
                <li className="flex gap-3"><UserPlus className="mt-1 h-5 w-5 shrink-0 text-accent" aria-hidden /> Add a photo, name, relationship and one kind sentence.</li>
                <li className="flex gap-3"><Sparkles className="mt-1 h-5 w-5 shrink-0 text-accent" aria-hidden /> A private face profile is created locally in seconds.</li>
                <li className="flex gap-3"><Heart className="mt-1 h-5 w-5 shrink-0 text-accent" aria-hidden /> Everything stays under your family’s control.</li>
              </ol>
              <ButtonLink href="/caregiver/add" variant="secondary" className="mt-6">
                Add someone familiar
              </ButtonLink>
            </div>
            <div className="rounded-3xl bg-night p-7 text-white">
              <span className="text-sm font-bold uppercase tracking-widest text-teal-300">
                For your loved one
              </span>
              <h3 className="mt-3 text-2xl font-bold">Companion Mode</h3>
              <div className="mt-5 rounded-2xl bg-white/10 p-5 backdrop-blur">
                <p className="identity-name font-bold leading-tight">Fatima</p>
                <p className="identity-relation mt-1 text-teal-300">Your Mother</p>
                <p className="identity-description mt-3 text-white/80">She enjoys gardening.</p>
              </div>
              <p className="mt-4 text-lg text-white/70">
                Look toward someone familiar and their name appears — calmly,
                with an optional soft voice to match.
              </p>
              <ButtonLink href="/recognition" variant="onDark" className="mt-6">
                Try Companion Mode
                <ArrowRight className="h-5 w-5" aria-hidden />
              </ButtonLink>
            </div>
          </div>
        </div>
      </section>

      {/* Onboarding */}
      <Modal open={onboardingOpen} onClose={closeOnboarding} title="Welcome to MemoryAssist">
        {slide === 0 && (
          <div className="animate-fade-in">
            <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-accent-soft text-accent">
              <Heart className="h-12 w-12" aria-hidden />
            </div>
            <p className="text-lg leading-relaxed text-ink-soft">
              MemoryAssist helps people with memory impairment recognize
              familiar people — gently, privately, and right on the device
              they already use.
            </p>
          </div>
        )}
        {slide === 1 && (
          <div className="animate-fade-in">
            <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <Lock className="h-12 w-12" aria-hidden />
            </div>
            <p className="text-lg leading-relaxed text-ink-soft">
              Your information stays on this device. Photos and recognition
              data are processed locally and are never uploaded to any server.
            </p>
          </div>
        )}
        {slide === 2 && (
          <div className="animate-fade-in">
            <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-teal-50 text-teal-600">
              <ScanFace className="h-12 w-12" aria-hidden />
            </div>
            <p className="text-lg leading-relaxed text-ink-soft">
              Caregivers add familiar people. Companion Mode then uses the
              camera to help recognize them — showing a name, a relationship,
              and a few kind words.
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
              className="rounded-full px-5 py-2.5 min-h-[44px] text-base font-semibold text-ink-soft hover:bg-surface-muted"
            >
              Skip
            </button>
            {slide < 2 ? (
              <button
                type="button"
                onClick={() => setSlide((s) => s + 1)}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-accent px-6 py-2.5 text-base font-semibold text-white shadow-soft hover:bg-accent-strong"
              >
                Next
                <ArrowRight className="h-4 w-4" aria-hidden />
              </button>
            ) : (
              <button
                type="button"
                onClick={closeOnboarding}
                className="inline-flex min-h-[44px] items-center rounded-full bg-accent px-6 py-2.5 text-base font-semibold text-white shadow-soft hover:bg-accent-strong"
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
