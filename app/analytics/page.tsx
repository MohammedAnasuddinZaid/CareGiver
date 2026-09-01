"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import {
  Activity,
  AlertTriangle,
  BellRing,
  CalendarCheck2,
  Heart,
  Info,
  Lightbulb,
  LineChart,
  ListChecks,
  Printer,
} from "lucide-react";
import { DOMAIN_INFO } from "@/lib/games/config";
import { SKILL_DOMAINS } from "@/lib/games/types";
import type { AbilityState, GameSession } from "@/lib/games/types";
import { GAME_ROUTES } from "@/components/games/game-meta";
import { thetaStandardError } from "@/lib/cognition/traits";
import { getAbilities, getRecentSessions, getAllSessions } from "@/lib/storage/progress";
import { getRecentEvents } from "@/lib/storage/reminders";
import {
  adherence,
  computeAlerts,
  domainTrends,
  type CareAlert,
  type DomainTrend,
} from "@/lib/cognition/trends";
import { buildCoachReport, type Insight } from "@/lib/cognition/insights";
import { buildReportHtml, openReportForPrint } from "@/lib/cognition/report";
import { useLocale } from "@/hooks/use-locale";
import { gameTitle } from "@/lib/i18n/games";

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
  /** Per-domain standard error of θ (Fisher information) — evidence bands. */
  const [standardErrors, setStandardErrors] = useState<
    Partial<Record<(typeof SKILL_DOMAINS)[number], number | null>>
  >({});
  const [stats, setStats] = useState({ sessions: 0, activeDays: 0 });
  const [allSessions, setAllSessions] = useState<GameSession[]>([]);
  const [reminderStats, setReminderStats] = useState({
    fired: 0,
    done: 0,
    missed: 0,
  });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [a, sessions, all] = await Promise.all([
        getAbilities(),
        getRecentSessions(30),
        getAllSessions(),
      ]);
      const events = await getRecentEvents(14);
      if (cancelled) return;

      // Reminder compliance summary.
      let done = 0;
      let fired = 0;
      let missed = 0;
      const perReminder = new Map<string, number>();
      for (const e of events) {
        if (e.status === "fired") {
          fired++;
          perReminder.set(e.reminderId, (perReminder.get(e.reminderId) ?? 0) + 1);
        } else if (e.status === "done") done++;
        else if (e.status === "missed") missed++;
      }
      // Peak misses for one reminder drive the adherence alert.
      const peakMisses = Math.max(0, ...perReminder.values());

      // Fisher-information precision per domain from recent item history.
      const difficultiesByDomain = new Map<string, number[]>();
      for (const s of sessions) {
        for (const trial of s.trials) {
          if (!Number.isFinite(trial.difficulty)) continue;
          const list = difficultiesByDomain.get(trial.domain) ?? [];
          list.push(trial.difficulty);
          difficultiesByDomain.set(trial.domain, list);
        }
      }
      const ses: typeof standardErrors = {};
      for (const d of SKILL_DOMAINS) {
        const ability = a.find((x) => x.domain === d);
        const diffs = difficultiesByDomain.get(d) ?? [];
        ses[d] =
          ability && diffs.length > 0
            ? thetaStandardError(ability.theta, diffs)
            : null;
      }

      if (!cancelled) {
        setAbilities(a);
        setTrends(domainTrends(sessions));
        setAlerts(computeAlerts(sessions, peakMisses >= 3 ? peakMisses : 0));
        setStats({
          sessions: adherence(sessions).sessionsLast7Days,
          activeDays: adherence(sessions).activeDaysLast7Days,
        });
        setStandardErrors(ses);
        setReminderStats({ fired, done, missed });
        setAllSessions(all);
        setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const coach = useMemo(
    () => buildCoachReport(allSessions, abilities),
    [allSessions, abilities],
  );

  const handleGenerateReport = (): void => {
    const html = buildReportHtml({
      coach,
      sessions: allSessions,
      generatedAt: new Date().toISOString(),
    });
    openReportForPrint(html);
  };

  if (!loaded) {
    return (
      <div className="mx-auto max-w-4xl px-4 pt-10">
        <div className="animate-pulse-soft rounded-3xl bg-surface-muted p-16" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-4 pb-24 pt-8 md:pt-12">
      <div className="flex flex-wrap items-center justify-between gap-4">
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
        <button
          onClick={handleGenerateReport}
          className="btn-sheen inline-flex min-h-[48px] items-center gap-2 rounded-full bg-accent px-6 py-3 text-base font-bold text-white shadow-soft transition-all hover:bg-accent-strong active:scale-[0.98]"
        >
          <Printer className="h-5 w-5" />
          Generate progress report
        </button>
      </div>

      {/* Adherence strip */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label={t("sessionsWeek")} value={n(stats.sessions)} />
        <StatCard label={t("activeDays")} value={`${n(stats.activeDays)}/7`} />
        <StatCard
          label="Reminders confirmed"
          value={
            reminderStats.done + reminderStats.missed > 0
              ? `${Math.round(
                  (reminderStats.done / (reminderStats.done + reminderStats.missed)) * 100,
                )}%`
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

      {/* AI Coach */}
      <section className="mt-10">
        <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-ink">
          <Lightbulb className="h-5 w-5 text-accent" />
          AI coach &amp; suggestions
        </h2>
        <p className="mb-4 rounded-2xl border border-line bg-surface-muted px-5 py-3 text-base font-medium text-ink-soft">
          {coach.headline}
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {coach.insights.map((ins) => (
            <InsightCard key={ins.id} insight={ins} />
          ))}
        </div>
        <p className="mt-3 text-sm text-ink-soft">
          Suggestions are generated on this device from the person&apos;s own activity —
          they are supportive guidance, not a medical diagnosis.
        </p>
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
              standardError={standardErrors[trend.domain] ?? null}
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

function InsightCard({ insight }: { insight: Insight }) {
  const { locale } = useLocale();
  const tone = insight.tone;
  const Icon =
    tone === "praise" ? Heart : tone === "warning" ? AlertTriangle : tone === "plan" ? ListChecks : Lightbulb;
  const styles =
    tone === "praise"
      ? "border-ok/30 bg-ok/5"
      : tone === "warning"
        ? "border-danger/30 bg-danger/5"
        : tone === "plan"
          ? "border-accent/30 bg-accent-soft"
          : "border-warn/30 bg-warn/5";
  const iconColor =
    tone === "praise"
      ? "text-ok"
      : tone === "warning"
        ? "text-danger"
        : tone === "plan"
          ? "text-accent"
          : "text-warn";
  return (
    <div className={`rounded-2xl border p-5 shadow-soft ${styles}`}>
      <div className="flex items-start gap-3">
        <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${iconColor}`} />
        <div>
          <p className="text-base font-bold text-ink">{insight.title}</p>
          <p className="mt-1 text-sm leading-relaxed text-ink-soft">{insight.detail}</p>
          {insight.gameIds && insight.gameIds.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {insight.gameIds.slice(0, 3).map((g) => (
                <a
                  key={g}
                  href={`${GAME_ROUTES[g]}?level=${insight.level ?? "moderate"}`}
                  className="rounded-full bg-surface px-3 py-1.5 text-sm font-semibold text-accent shadow-soft transition-colors hover:bg-accent hover:text-white"
                >
                  {gameTitle(g, locale)}
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TrendCard({
  trend,
  theta,
  standardError,
  labels,
}: {
  trend: DomainTrend;
  theta?: number;
  standardError?: number | null;
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
          {standardError != null && Number.isFinite(standardError)
            ? ` ± ${Math.min(9, standardError).toFixed(1)}`
            : ""}
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
