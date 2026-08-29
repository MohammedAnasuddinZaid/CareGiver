"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Camera,
  Cpu,
  Database,
  Languages,
  Lock,
  ScanFace,
  Volume2,
  WifiOff,
} from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";

const PIPELINE = [
  { icon: Camera, title: "Camera frame", body: "Live video, kept on-device." },
  { icon: ScanFace, title: "Face detection", body: "TinyFaceDetector finds faces." },
  { icon: Cpu, title: "Face descriptor", body: "A private 128-number signature." },
  { icon: Database, title: "Local comparison", body: "Compared with enrolled people in IndexedDB." },
  { icon: Lock, title: "Threshold", body: "Unfamiliar stays unknown — never a wrong guess." },
  { icon: Languages, title: "Stabilization", body: "Several agreeing frames before showing a name." },
  { icon: Volume2, title: "Name + voice", body: "Large calm text, optional gentle voice." },
];

export default function AboutPage() {
  const [openStep, setOpenStep] = useState<number | null>(null);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 md:px-6 md:py-14">
      <header className="animate-fade-up text-center">
        <StatusBadge tone="accent">Technology</StatusBadge>
        <h1 className="mt-5 text-4xl font-extrabold tracking-tight md:text-5xl">
          How recognition works
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-xl leading-relaxed text-ink-soft">
          CareGiver runs a full face-recognition pipeline inside your
          browser — no paid AI APIs, no cloud database, no camera uploads.
        </p>
      </header>

      {/* Pipeline */}
      <section aria-label="Recognition pipeline" className="mt-12 space-y-3">
        {PIPELINE.map(({ icon: Icon, title, body }, i) => (
          <button
            key={title}
            type="button"
            onClick={() => setOpenStep(openStep === i ? null : i)}
            aria-expanded={openStep === i}
            className="group flex w-full items-center gap-5 rounded-3xl border border-line bg-surface p-5 text-left shadow-soft transition-all hover:border-accent/40 hover:shadow-lift"
          >
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-accent-soft text-accent">
              <Icon className="h-6 w-6" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-lg font-bold">
                <span className="mr-2 text-accent">{i + 1}.</span>
                {title}
              </span>
              <span className={`block text-base text-ink-soft ${openStep === i ? "" : "line-clamp-1"}`}>
                {body}
              </span>
            </span>
            <ArrowRight
              className={`h-5 w-5 shrink-0 text-ink-soft transition-transform ${openStep === i ? "rotate-90" : "group-hover:translate-x-1"}`}
              aria-hidden
            />
          </button>
        ))}
      </section>

      {/* Architecture */}
      <section className="mt-14 rounded-[2.5rem] bg-night p-8 text-white md:p-12" aria-label="Architecture">
        <h2 className="text-center text-3xl font-bold tracking-tight">Architecture</h2>
        <div className="mt-8 grid items-stretch gap-4 md:grid-cols-2">
          <div className="rounded-3xl bg-white/10 p-6 backdrop-blur">
            <h3 className="font-bold uppercase tracking-widest text-sm text-teal-300">Caregiver</h3>
            <ul className="mt-3 space-y-2 text-lg text-white/85">
              <li>Profiles → IndexedDB</li>
              <li>Enrollment photos → local blobs</li>
              <li>Descriptors generated on-device</li>
            </ul>
          </div>
          <div className="rounded-3xl bg-white/10 p-6 backdrop-blur">
            <h3 className="font-bold uppercase tracking-widest text-sm text-teal-300">Companion</h3>
            <ul className="mt-3 space-y-2 text-lg text-white/85">
              <li>Camera → local detection</li>
              <li>Descriptor → threshold matching</li>
              <li>Temporal smoothing → stable identity</li>
            </ul>
          </div>
        </div>
        <div className="mt-4 rounded-3xl bg-teal-500/20 p-6 text-center backdrop-blur">
          <p className="text-lg font-semibold text-white">
            Local recognition engine — shared by both modes
          </p>
          <p className="mt-1 text-base text-white/70">
            The same result (a name) can one day feed smart glasses instead of the screen.
          </p>
        </div>
      </section>

      {/* Licenses & stack */}
      <section className="mt-12 grid gap-6 md:grid-cols-2">
        <Card className="p-7">
          <h2 className="text-2xl font-bold tracking-tight">Open-source stack</h2>
          <ul className="mt-4 space-y-3 text-lg text-ink-soft">
            <li>• Next.js + React + TypeScript</li>
            <li>• Tailwind CSS design system</li>
            <li>• face-api.js models via TensorFlow.js (WebGL)</li>
            <li>• IndexedDB · Web Speech API · Service Worker</li>
            <li>• Lucide icons</li>
          </ul>
        </Card>
        <Card className="p-7">
          <h2 className="text-2xl font-bold tracking-tight">Licenses</h2>
          <p className="mt-4 text-lg leading-relaxed text-ink-soft">
            All libraries are MIT or Apache-2.0 licensed and free to use.
            Pre-trained model weights are redistributed from the open-source
            face-api.js project for research and assistive prototyping.
          </p>
        </Card>
      </section>

      {/* Demo flow */}
      <section className="mt-12 pb-16">
        <Card className="border-dashed p-7 md:p-9">
          <h2 className="text-2xl font-bold tracking-tight">60-second demo flow</h2>
          <ol className="mt-5 list-decimal space-y-2 pl-6 text-lg text-ink-soft">
            <li>Add “Sam” in the dashboard with one clear photo.</li>
            <li>Watch the face profile build locally — no upload spinner anywhere.</li>
            <li>Open Companion Mode and allow the camera.</li>
            <li>Sam walks in → name appears after a few calm frames.</li>
            <li>A stranger appears → “I don’t recognize this person yet.”</li>
            <li>Turn off Wi-Fi — everything still works.</li>
            <li>Privacy Center shows where every byte lives.</li>
          </ol>
          <div className="mt-7 flex flex-wrap gap-3">
            <ButtonLink href="/caregiver/add">Start adding someone</ButtonLink>
            <ButtonLink href="/recognition" variant="secondary">
              Open Companion Mode
            </ButtonLink>
            <Link
              href="/privacy"
              className="inline-flex min-h-[52px] items-center rounded-full px-6 py-3.5 text-lg font-semibold text-accent hover:bg-accent-soft/60"
            >
              Privacy Center
            </Link>
          </div>
        </Card>

        <p className="mt-8 rounded-2xl bg-surface-muted p-5 text-center text-base text-ink-soft">
          CareGiver is a prototype assistive technology, not a medical device.
          Recognition may be incorrect — confirm identity when it matters.
        </p>
      </section>
    </div>
  );
}
