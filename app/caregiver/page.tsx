"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Activity, Heart, Plus, ScanFace, ShieldCheck, Sparkles } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { EmptyState, Skeleton } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { PersonCard } from "@/components/people/person-card";
import { usePeople } from "@/hooks/use-people";
import { greetingForHour } from "@/lib/utils/format";
import { loadDemoPeople } from "@/lib/demo/seed";
import { getRecentSessions } from "@/lib/storage/progress";
import { adherence } from "@/lib/cognition/trends";

export default function CaregiverDashboard() {
  const { people, loading, storageError, refresh } = usePeople();
  const { toast } = useToast();
  const [demoLoading, setDemoLoading] = useState(false);
  const [weekStats, setWeekStats] = useState<{ sessions: number; days: number } | null>(null);
  const greeting = useMemo(() => greetingForHour(new Date().getHours()), []);

  const readyCount = people.filter((p) => p.descriptors.length > 0).length;

  // One-shot glanceable adherence for the summary strip — full trends
  // live in /analytics, this just answers "did they play this week?".
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const sessions = await getRecentSessions(7);
        if (!cancelled) {
          const a = adherence(sessions);
          setWeekStats({ sessions: a.sessionsLast7Days, days: a.activeDaysLast7Days });
        }
      } catch {
        if (!cancelled) setWeekStats(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleLoadDemo() {
    setDemoLoading(true);
    try {
      await loadDemoPeople();
      await refresh();
      toast("Demo people added — clearly labeled, with no recognition data.");
    } catch {
      toast("Couldn’t add demo data in this browser session.", "error");
    } finally {
      setDemoLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 md:px-6 md:py-14">
      <header className="animate-fade-up">
        <p className="text-lg font-semibold text-accent">{greeting}</p>
        <h1 className="mt-1 text-4xl font-extrabold tracking-tight md:text-5xl">
          Caregiver Dashboard
        </h1>
        <p className="mt-3 max-w-xl text-xl text-ink-soft">
          Manage the people who matter most.
        </p>
      </header>

      {/* Summary */}
      <section aria-label="Summary" className="reveal-stagger mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card className="flex items-center gap-4 p-5">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-accent-soft text-accent">
            <Heart className="h-6 w-6" aria-hidden />
          </span>
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-ink-soft">Trusted People</p>
            <AnimatedNumber value={people.length} className="text-3xl font-bold" />
          </div>
        </Card>
        <Card className="flex items-center gap-4 p-5">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
            <ScanFace className="h-6 w-6" aria-hidden />
          </span>
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-ink-soft">Recognition Ready</p>
            <AnimatedNumber value={readyCount} className="text-3xl font-bold" />
          </div>
        </Card>
        <Link
          href="/analytics"
          className="group flex items-center gap-4 rounded-[var(--radius-card,1.5rem)] border border-line bg-surface p-5 shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-lift"
        >
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-teal-50 text-teal-600">
            <Activity className="h-6 w-6" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold uppercase tracking-wide text-ink-soft">This Week</p>
            {weekStats ? (
              <p className="truncate text-lg font-bold leading-tight pt-1 text-ink">
                {weekStats.sessions} sessions · {weekStats.days}/7 days
              </p>
            ) : (
              <p className="text-lg font-bold leading-tight pt-1 text-ink-soft">No play yet</p>
            )}
          </div>
        </Link>
        <Card className="flex items-center gap-4 p-5">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-stone-100 text-stone-500">
            <ShieldCheck className="h-6 w-6" aria-hidden />
          </span>
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-ink-soft">Privacy</p>
            <p className="text-lg font-bold leading-tight pt-1">Local — on this device</p>
          </div>
        </Card>
      </section>

      {storageError && (
        <p role="alert" className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-base font-medium text-amber-900">
          {storageError}
        </p>
      )}

      {/* People */}
      <section aria-label="Your people" className="mt-12">
        <div className="mb-5 flex items-end justify-between gap-4">
          <h2 className="text-2xl font-bold tracking-tight md:text-3xl">Your People</h2>
          {!loading && people.length > 0 && (
            <ButtonLink href="/caregiver/add" size="md">
              <Plus className="h-5 w-5" aria-hidden />
              Add person
            </ButtonLink>
          )}
        </div>

        {loading ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3" aria-label="Loading profiles">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-[340px]" />
            ))}
          </div>
        ) : people.length === 0 ? (
          <EmptyState
            icon={<Heart className="h-8 w-8" aria-hidden />}
            title="Build your trusted circle"
            body="Add the people you want CareGiver to recognize — family, friends and caregivers."
            action={
              <>
                <ButtonLink href="/caregiver/add" size="lg">
                  <Plus className="h-5 w-5" aria-hidden />
                  Add first person
                </ButtonLink>
                <button
                  type="button"
                  onClick={handleLoadDemo}
                  disabled={demoLoading}
                  className="inline-flex min-h-[52px] items-center gap-2 rounded-full border border-line bg-surface px-7 py-3.5 text-lg font-semibold text-ink-soft transition-colors hover:text-ink disabled:opacity-50"
                >
                  <Sparkles className="h-5 w-5" aria-hidden />
                  {demoLoading ? "Adding demo people…" : "Load demo people"}
                </button>
              </>
            }
          />
        ) : (
          <div className="reveal-stagger grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {people.map((person) => (
              <PersonCard key={person.id} person={person} />
            ))}
          </div>
        )}
      </section>

      <p className="mt-10 text-base text-ink-soft">
        New here?{" "}
        <Link href="/about" className="font-semibold text-accent underline-offset-4 hover:underline">
          See how recognition works
        </Link>{" "}
        — everything runs locally in your browser.
      </p>
    </div>
  );
}
