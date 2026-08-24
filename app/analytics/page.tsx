"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import {
  Activity,
  AlertTriangle,
  BellRing,
  CalendarCheck2,
  Info,
  LineChart,
} from "lucide-react";
import { DOMAIN_INFO } from "@/lib/games/config";
import { SKILL_DOMAINS } from "@/lib/games/types";
import type { AbilityState } from "@/lib/games/types";
import { getAbilities, getRecentSessions } from "@/lib/storage/progress";
import { getRecentEvents } from "@/lib/storage/reminders";
import {
  adherence,
  computeAlerts,
  domainTrends,
  type CareAlert,
  type DomainTrend,
} from "@/lib/cognition/trends";
import { useLocale } from "@/hooks/use-locale";

/**
 * Caregiver analytics: cognitive trends per domain (OLS weekly slope over
 * daily-mean θ), adherence stats and rule-based care signals.
 * Everything is computed locally from the on-device session history.
 */
export default function AnalyticsPage() {
  const { t, n } = useLocale();
  const [abilities, setAbilities] = useState<AbilityState[]>([]);
  const [trends, setTrends] = useState<DomainTrend[]>([]);
  const [alerts, setAlerts] = useState<CareAlert[]>([]);
  const [stats, setStats] = useState({ sessions: 0, activeDays: 0 });
  const [reminderStats, setReminderStats] = useState({
    fired: 0,
    done: 0,
    missedStreakMax: 0,
  });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [a, sessions] = await Promise.all([
        getAbilities(),
        getRecentSessions(30),
      ]);
      const events = await getRecentEvents(14);
      if (cancelled) return;

      // Reminder compliance summary.
      let done = 0;
      let fired = 0;
      const perReminder = new Map<string, number>();
      for (const e of events) {
        if (e.status === "fired") {
          fired++;
          perReminder.set(e.reminderId, (perReminder.get(e.reminderId) ?? 0) + 1);
        }
        if (e.status === "done") done++;
      }

      if (!cancelled) {
        setAbilities(a);
        setTrends(domainTrends(sessions));
        setAlerts(computeAlerts(sessions, Math.max(0, ...perReminder.values()) >= 3 ? Math.max(...perReminder.values()) : 0));
        setStats({
          sessions: adherence(sessions).sessionsLast7Days,
          activeDays: adherence(sessions).activeDaysLast7Days,
        });
        setReminderStats({
          fired,
          done,
          missedStreakMax: Math.max(0, fired - done),
        });
        setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!loaded) {
    return (
      <div className="mx-auto max-w-4xl px-4 pt-10">
        <div className="animate-pulse-soft rounded-3xl bg-surface-muted p-16" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-4 pb-24 pt-8 md:pt-12">
      <div className="flex items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-soft">
          <LineChart className="h-8 w-8 text-accent" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-ink">
            {t("analyticsTitle")}
          </h1>
          <p className="text-base text-ink-soft">{t("analyticsSubtitle")}</p>
        </div>
      </div>

      {/* Adherence strip */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label={t("sessionsWeek")} value={n(stats.sessions)} />
        <StatCard label={t("activeDays")} value={`${n(stats.activeDays)}/7`} />
        <StatCard
          label="Reminders done"
          value={
            reminderStats.fired > 0
              ? `${Math.round((reminderStats.done / reminderStats.fired) * 100)}%`
              : "—"
          }
        />
        <StatCard label="Domains tracked" value={n(SKILL_DOMAINS.length)} />
      </div>

      {/* Care signals */}
      <section className="mt-10">
        <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-ink">
          <BellRing className="h-5 w-5 text-accent" />
          {t("alertsTitle")}
        </h2>
        {alerts.length === 0 ? (
          <p className="rounded-2xl border border-ok/30 bg-ok/5 px-5 py-4 text-base font-medium text-ink">
            ✓ {t("noAlerts")}
          </p>
        ) : (
          <ul className="space-y-2.5">
            {alerts.map((alert, i) => (
              <li
                key={i}
                className={clsx(
                  "flex items-start gap-3 rounded-2xl border px-5 py-4",
                  alert.severity === "urgent"
                    ? "border-danger/40 bg-danger/5"
                    : alert.severity === "watch"
                      ? "border-warn/40 bg-warn/5"
                      : "border-line bg-surface",
                )}
              >
                {alert.severity === "urgent" ? (
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-danger" />
                ) : (
                  <Info className="mt-0.5 h-5 w-5 shrink-0 text-warn" />
                )}
                <span className="text-base font-medium leading-relaxed text-ink">
                  {alert.message}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Domain trends */}
      <section className="mt-10">
        <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-ink">
          <Activity className="h-5 w-5 text-accent" />
          Skill trends · last 3 weeks
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {trends.map((trend) => (
            <TrendCard
              key={trend.domain}
              trend={trend}
              theta={abilities.find((a) => a.domain === trend.domain)?.theta}
              labels={{
                improving: t("trendImproving"),
                steady: t("trendSteady"),
                declining: t("trendDeclining"),
                noData: t("notEnoughData"),
              }}
            />
          ))}
        </div>
      </section>

      <div className="mt-10 rounded-2xl border border-line bg-surface-muted p-5 text-sm leading-relaxed text-ink-soft">
        Trends use an ordinary-least-squares slope of daily ability estimates.
        They describe engagement with the exercises — they are not a medical
        assessment and do not diagnose anything.
      </div>

      <Link
        href="/reminders"
        className="mt-6 inline-flex items-center gap-2 rounded-full border border-line px-6 py-3 font-semibold text-ink hover:bg-surface-muted"
      >
        <CalendarCheck2 className="h-5 w-5" />
        Manage reminders
      </Link>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4 shadow-soft">
      <p className="text-2xl font-extrabold tabular-nums text-ink">{value}</p>
      <p className="mt-0.5 text-sm font-medium text-ink-soft">{label}</p>
    </div>
  );
}

function TrendCard({
  trend,
  theta,
  labels,
}: {
  trend: DomainTrend;
  theta?: number;
  labels: { improving: string; steady: string; declining: string; noData: string };
}) {
  const info = DOMAIN_INFO[trend.domain];
  const status =
    trend.slopePerWeek === null
      ? null
      : trend.slopePerWeek > 0.02
        ? "improving"
        : trend.slopePerWeek < -0.12
          ? "declining"
          : "steady";

  return (
    <div className="rounded-2xl border border-line bg-surface p-5 shadow-soft">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-base font-bold text-ink">{info.label}</p>
          <p className="text-sm text-ink-soft">{info.description}</p>
        </div>
        {status && (
          <span
            className={clsx(
              "rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide",
              status === "improving"
                ? "bg-ok/15 text-ok"
                : status === "declining"
                  ? "bg-danger/15 text-danger"
                  : "bg-surface-muted text-ink-soft",
            )}
          >
            {labels[status]}
          </span>
        )}
      </div>
      <Sparkline points={trend.points.map((p) => p.y)} />
      {theta !== undefined ? (
        <p className="text-sm font-semibold tabular-nums text-ink-soft">
          Level {(theta + 1.2).toFixed(1)}
        </p>
      ) : (
        <p className="text-sm text-ink-soft">{labels.noData}</p>
      )}
    </div>
  );
}

/** Minimal dependency-free SVG sparkline with area fill. */
function Sparkline({ points }: { points: number[] }) {
  const path = useMemo(() => {
    if (points.length < 2) return null;
    const min = Math.min(...points);
    const max = Math.max(...points);
    const span = max - min || 1;
    const w = 200;
    const h = 48;
    const coords = points.map((v, i) => ({
      x: (i / (points.length - 1)) * w,
      y: h - ((v - min) / span) * h,
    }));
    const d = coords
      .map((c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(1)},${c.y.toFixed(1)}`)
      .join(" ");
    const area = `${d} L${w},${h} L0,${h} Z`;
    return { d, area };
  }, [points]);

  if (!path) {
    return <div className="my-3 h-12 rounded-xl bg-surface-muted/60" />;
  }
  return (
    <svg viewBox="0 0 200 48" className="my-3 h-12 w-full" aria-hidden>
      <path d={path.area} fill="rgb(var(--ma-accent) / 0.12)" />
      <path
        d={path.d}
        fill="none"
        stroke="rgb(var(--ma-accent))"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
