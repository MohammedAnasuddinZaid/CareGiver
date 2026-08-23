"use client";

import Link from "next/link";
import { ArrowRight, ScanFace, ShieldCheck } from "lucide-react";
import { SpotlightCard } from "@/components/ui/spotlight-card";
import { TiltCard } from "@/components/ui/tilt-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Avatar } from "./avatar";
import { readinessOf, type PersonProfile } from "@/lib/types/person";

export function PersonCard({ person }: { person: PersonProfile }) {
  const ready = readinessOf(person) === "ready";
  return (
    <TiltCard className="group h-full">
      <SpotlightCard className="h-full rounded-3xl bg-surface border border-line shadow-soft transition-shadow duration-300 group-hover:shadow-lift">
        <div className="relative overflow-hidden rounded-t-3xl" style={{ transform: "translateZ(28px)" }}>
          <div className="flex h-40 items-center justify-center bg-gradient-to-br from-teal-50 to-stone-100 overflow-hidden">
            {person.photoThumb ? (
              <img
                src={person.photoThumb}
                alt={`Photo of ${person.name}`}
                className="h-40 w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.06]"
              />
            ) : (
              <Avatar name={person.name} id={person.id} size="xl" />
            )}
          </div>
          <span
            className="absolute right-4 top-4 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-accent shadow-soft backdrop-blur"
            style={{ transform: "translateZ(40px)" }}
          >
            Stored locally
          </span>
          {person.isDemo && (
            <span className="absolute left-4 top-4 rounded-full bg-amber-100/95 px-3 py-1 text-xs font-bold uppercase tracking-wide text-amber-800 shadow-soft">
              Demo · no recognition
            </span>
          )}
        </div>
        <div className="p-6" style={{ transform: "translateZ(18px)" }}>
          <h3 className="truncate text-2xl font-bold tracking-tight">{person.name}</h3>
          <p className="mt-0.5 text-lg text-ink-soft">
            Your {person.relationship}
            {typeof person.age === "number" ? ` · ${person.age}` : ""}
          </p>
          <div className="mt-4 flex items-center justify-between gap-3">
            <StatusBadge tone={ready ? "ok" : "muted"} pulse={false}>
              <span className="inline-flex items-center gap-1.5">
                <ScanFace className="h-4 w-4" aria-hidden />
                {ready ? "Recognition ready" : "Not enrolled"}
              </span>
            </StatusBadge>
            <Link
              href={`/caregiver/person/${person.id}`}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full px-4 py-2 text-base font-semibold text-accent transition-colors hover:bg-accent-soft"
            >
              View profile
              <ArrowRight
                className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1"
                aria-hidden
              />
            </Link>
          </div>
        </div>
      </SpotlightCard>
    </TiltCard>
  );
}

export function LocalDataNote() {
  return (
    <p className="inline-flex items-center gap-2 text-base text-ink-soft">
      <ShieldCheck className="h-5 w-5 text-accent" aria-hidden />
      Profiles are stored only on this device.
    </p>
  );
}
