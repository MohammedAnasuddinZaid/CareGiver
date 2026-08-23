"use client";

import Link from "next/link";
import { ArrowRight, ScanFace, ShieldCheck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Avatar } from "./avatar";
import { readinessOf, type PersonProfile } from "@/lib/types/person";

export function PersonCard({ person }: { person: PersonProfile }) {
  const ready = readinessOf(person) === "ready";
  return (
    <Card className="group overflow-hidden">
      <div className="relative">
        <div className="flex h-40 items-center justify-center bg-gradient-to-br from-teal-50 to-stone-100">
          {person.photoThumb ? (
            <img
              src={person.photoThumb}
              alt={`Photo of ${person.name}`}
              className="h-40 w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
            />
          ) : (
            <Avatar name={person.name} id={person.id} size="xl" />
          )}
        </div>
        <span className="absolute right-4 top-4 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-accent shadow-soft backdrop-blur">
          Stored locally
        </span>
      </div>
      <div className="p-6">
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
            <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden />
          </Link>
        </div>
      </div>
    </Card>
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
