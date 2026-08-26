import { gamesConfig } from "@/lib/games/config";
import { SKILL_DOMAINS } from "@/lib/games/types";
import type { GameSession, SkillDomain } from "@/lib/games/types";
import { olsSlope, type TrendPoint } from "./traits";

/**
 * Caregiver analytics: per-domain trends, adherence and alert rules.
 * All pure functions over already-sanitized records — node-testable.
 */

export interface DomainTrend {
  domain: SkillDomain;
  /** OLS slope in logits per week over the window. */
  slopePerWeek: number | null;
  /** θ at window start vs end (nulls when too little data). */
  startTheta: number | null;
  endTheta: number | null;
  points: TrendPoint[];
}

const MS_PER_DAY = 86_400_000;

/** Per-domain θ trajectory sampled once per day (mean of that day's sessions). */
export function domainTrends(
  sessions: GameSession[],
  windowDays = 21,
): DomainTrend[] {
  const cutoff = Date.now() - windowDays * MS_PER_DAY;
  const perDomain = new Map<SkillDomain, TrendPoint[]>();

  for (const session of sessions) {
    const t = Date.parse(session.startedAt);
    if (!Number.isFinite(t) || t < cutoff) continue;
    for (const [domainRaw, theta] of Object.entries(session.thetaAfter)) {
      if (!theta || typeof theta !== "number") continue;
      const domain = domainRaw as SkillDomain;
      const list = perDomain.get(domain) ?? [];
      list.push({ x: (t - cutoff) / MS_PER_DAY, y: theta });
      perDomain.set(domain, list);
    }
  }

  return SKILL_DOMAINS.map((domain) => {
    const raw = perDomain.get(domain) ?? [];
    // Bucket by integer day → daily mean keeps OLS stable vs bursty play.
    const byDay = new Map<number, number[]>();
    for (const p of raw) {
      const key = Math.round(p.x);
      const list = byDay.get(key) ?? [];
      list.push(p.y);
      byDay.set(key, list);
    }
    const points: TrendPoint[] = [...byDay.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([day, ys]) => ({ x: day, y: ys.reduce((s, y) => s + y, 0) / ys.length }));

    const slopePerWeek =
      points.length >= 2 ? olsSlope(points.map((p) => ({ x: p.x / 7, y: p.y }))) : null;

    return {
      domain,
      slopePerWeek,
      startTheta: points.length ? points[0].y : null,
      endTheta: points.length ? points[points.length - 1].y : null,
      points,
    };
  });
}

export type AlertKind = "decline" | "abandon" | "missed-reminders" | "inactivity";

export interface CareAlert {
  kind: AlertKind;
  severity: "info" | "watch" | "urgent";
  message: string;
  at: string;
}

export interface AdherenceSummary {
  sessionsLast7Days: number;
  activeDaysLast7Days: number;
  abandonStreak: number;
  lastSessionAt: string | null;
}

/** Local-calendar-day key ("YYYY-MM-DD") — `slice(0,10)` on ISO strings
 * reads the UTC date, so sessions before e.g. 05:30 IST counted as the
 * previous day and skewed "active days" for the exact audience (elderly,
 * early risers) this metric exists for. */
export function localDayKey(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

export function adherence(sessions: GameSession[]): AdherenceSummary {
  const weekAgo = Date.now() - 7 * MS_PER_DAY;
  const recent = sessions.filter((s) => Date.parse(s.startedAt) >= weekAgo);
  const days = new Set(
    recent.map((s) => localDayKey(s.startedAt)).filter((k) => k !== ""),
  );

  let abandonStreak = 0;
  for (let i = sessions.length - 1; i >= 0; i--) {
    if (sessions[i].completion < 0.4) abandonStreak++;
    else break;
  }

  const last = sessions.length ? sessions[sessions.length - 1] : null;
  return {
    sessionsLast7Days: recent.length,
    activeDaysLast7Days: days.size,
    abandonStreak,
    lastSessionAt: last ? last.startedAt : null,
  };
}

export function computeAlerts(
  sessions: GameSession[],
  missedReminderCount: number,
): CareAlert[] {
  const alerts: CareAlert[] = [];
  const nowISO = new Date().toISOString();
  const cfg = gamesConfig.alerts;

  const trends = domainTrends(sessions);
  for (const trend of trends) {
    const hasHistory = trend.points.length * 1 >= 1 && trend.points[trend.points.length - 1].x - trend.points[0].x >= cfg.minHistoryDays;
    if (!hasHistory || trend.slopePerWeek === null) continue;
    if (trend.slopePerWeek <= cfg.declineSlopePerWeek) {
      alerts.push({
        kind: "decline",
        severity: trend.slopePerWeek <= cfg.declineSlopePerWeek * 2 ? "urgent" : "watch",
        message: `Declining trend in ${trend.domain} skills over the last two weeks.`,
        at: nowISO,
      });
    }
  }

  const adh = adherence(sessions);
  if (adh.abandonStreak >= gamesConfig.alerts.abandonStreakAlert) {
    alerts.push({
      kind: "abandon",
      severity: "watch",
      message: `${adh.abandonStreak} game sessions ended early in a row — check comfort, timing or lighting.`,
      at: nowISO,
    });
  }
  if (missedReminderCount >= gamesConfig.alerts.missedStreakAlert) {
    alerts.push({
      kind: "missed-reminders",
      severity: "watch",
      message: `${missedReminderCount} reminders were not confirmed recently.`,
      at: nowISO,
    });
  }
  if (
    adh.lastSessionAt &&
    Date.now() - Date.parse(adh.lastSessionAt) > 3 * MS_PER_DAY
  ) {
    alerts.push({
      kind: "inactivity",
      severity: "info",
      message: "No game sessions in the last three days.",
      at: nowISO,
    });
  }
  if (!adh.lastSessionAt && sessions.length === 0) {
    alerts.push({
      kind: "inactivity",
      severity: "info",
      message: "No game history yet — play a first session to unlock trends.",
      at: nowISO,
    });
  }

  return alerts;
}
