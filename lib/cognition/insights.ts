import { SKILL_DOMAINS, GAME_META } from "@/lib/games/types";
import type { AbilityState, GameId, GameLevel, GameSession, SkillDomain } from "@/lib/games/types";
import { DOMAIN_INFO } from "@/lib/games/config";
import {
  adherence,
  computeAlerts,
  domainTrends,
} from "./trends";
import type { DomainTrend } from "./trends";
import { prescribeDailySession } from "@/lib/games/adaptation";

/**
 * Local, on-device "AI coach".
 *
 * This is deliberately a rule-based reasoning engine (no network, no model
 * download, no API key) that reads the SAME sanitized history the analytics
 * page shows and turns it into plain-language coaching. It is explainable:
 * every suggestion names the evidence it came from, which matters far more
 * than a black-box score for caregivers and clinicians.
 *
 * Everything here is descriptive of engagement — it is NOT a diagnosis.
 */

export type InsightTone = "praise" | "tip" | "warning" | "plan";

export interface Insight {
  id: string;
  tone: InsightTone;
  title: string;
  detail: string;
  /** Games this suggestion points the player toward. */
  gameIds?: GameId[];
  /** Suggested difficulty band for those games. */
  level?: GameLevel;
}

export type ProgressStatus = "getting-started" | "improving" | "steady" | "needs-care";

export interface CoachReport {
  status: ProgressStatus;
  /** One-line headline for the player (warm, encouraging). */
  headline: string;
  /** One-line note aimed at a caregiver, if any. */
  caregiverNote: string;
  insights: Insight[];
  /** Suggested next session (game ids + reason), from the scheduler. */
  nextPlan: { games: GameId[]; reasons: Record<GameId, string> };
  /** Sessions in the last 7 days. */
  sessionsLast7Days: number;
  /** Distinct active days in the last 7 days. */
  activeDaysLast7Days: number;
  /** Per-domain ability, for quick display. */
  abilities: AbilityState[];
  trends: DomainTrend[];
}

function gamesForDomain(domain: SkillDomain): GameId[] {
  return (Object.keys(GAME_META) as GameId[]).filter((g) => GAME_META[g].domain === domain);
}

/** Suggest a starting difficulty from a domain's current ability. */
export function suggestLevel(theta: number | undefined): GameLevel {
  if (theta === undefined || theta < -0.4) return "easy";
  if (theta > 0.8) return "hard";
  return "moderate";
}

/**
 * Builds the full coaching report. Pure function over already-loaded data so
 * it is trivial to test and cheap to recompute on every analytics view.
 */
export function buildCoachReport(
  sessions: GameSession[],
  abilities: AbilityState[],
): CoachReport {
  const trends = domainTrends(sessions);
  const adh = adherence(sessions);
  const alerts = computeAlerts(sessions, 0);
  const abilityByDomain = new Map<SkillDomain, AbilityState>(
    abilities.map((a) => [a.domain as SkillDomain, a]),
  );

  const insights: Insight[] = [];

  // --- Getting started ---
  const hasHistory = sessions.length > 0;
  if (!hasHistory) {
    insights.push({
      id: "start",
      tone: "plan",
      title: "Let's begin gently",
      detail:
        "Pick one game a day to start. Short, calm sessions matter more than long ones — even three minutes helps the mind stay active.",
      gameIds: ["faces", "pairs", "routine"],
      level: "easy",
    });
    return {
      status: "getting-started",
      headline: "Every small step keeps the mind active.",
      caregiverNote: "No sessions yet — invite them to try one game together today.",
      insights,
      nextPlan: prescribeDailySession(abilities, sessions),
      sessionsLast7Days: 0,
      activeDaysLast7Days: 0,
      abilities,
      trends,
    };
  }

  // --- Consistency praise ---
  if (adh.sessionsLast7Days >= 4) {
    insights.push({
      id: "consistency",
      tone: "praise",
      title: "Wonderful routine",
      detail: `${adh.sessionsLast7Days} sessions in the last week across ${adh.activeDaysLast7Days} days. Regular practice is the single biggest predictor of benefit.`,
    });
  } else if (adh.sessionsLast7Days === 0) {
    insights.push({
      id: "reengage",
      tone: "tip",
      title: "A little today goes a long way",
      detail:
        "It's been a few days. Choose one familiar game — something already enjoyed — and play just one round together.",
      gameIds: ["pairs", "melody"],
      level: "easy",
    });
  }

  // --- Per-domain analysis ---
  const improving: SkillDomain[] = [];
  const declining: SkillDomain[] = [];
  for (const trend of trends) {
    const hasEnough =
      trend.points.length >= 2 &&
      trend.points[trend.points.length - 1].x - trend.points[0].x >= 5;
    if (!hasEnough || trend.slopePerWeek === null) continue;
    if (trend.slopePerWeek > 0.04) improving.push(trend.domain);
    else if (trend.slopePerWeek < -0.12) declining.push(trend.domain);
  }

  for (const domain of improving) {
    insights.push({
      id: `praise-${domain}`,
      tone: "praise",
      title: `${DOMAIN_INFO[domain].label} is getting stronger`,
      detail: `Over the last three weeks this skill has trended upward. Keep including it a couple of times a week to hold the gain.`,
      gameIds: gamesForDomain(domain),
      level: suggestLevel(abilityByDomain.get(domain)?.theta),
    });
  }

  for (const domain of declining) {
    const games = gamesForDomain(domain);
    insights.push({
      id: `decline-${domain}`,
      tone: "warning",
      title: `${DOMAIN_INFO[domain].label} needs a little more care`,
      detail: `This skill has dipped recently. Try it at the Easy level and keep sessions short — a calm, successful round rebuilds confidence better than a hard one.`,
      gameIds: games,
      level: "easy",
    });
  }

  // --- Weakest domain focus ---
  let weakest: SkillDomain | null = null;
  let lowest = Infinity;
  for (const d of SKILL_DOMAINS) {
    const theta = abilityByDomain.get(d)?.theta ?? 0;
    if (theta < lowest) {
      lowest = theta;
      weakest = d;
    }
  }
  if (weakest && !declining.includes(weakest) && lowest < 0.4) {
    insights.push({
      id: "focus-weak",
      tone: "tip",
      title: `Gentle focus: ${DOMAIN_INFO[weakest].label}`,
      detail: `This is currently the domain with the most room to grow. Sprinkle one of these games into the week at an easy pace.`,
      gameIds: gamesForDomain(weakest),
      level: "easy",
    });
  }

  // --- Alert-driven caregiver tips ---
  for (const alert of alerts) {
    insights.push({
      id: `alert-${alert.kind}`,
      tone: alert.severity === "urgent" ? "warning" : "tip",
      title: alert.message,
      detail:
        alert.kind === "abandon"
          ? "Ending early is normal some days. Try a shorter session or a favourite game next time."
          : alert.kind === "inactivity"
            ? "A gentle nudge or playing together can help restart the habit."
            : "Worth a quiet note to the care team if it continues.",
    });
  }

  // --- Status + headline ---
  let status: ProgressStatus = "steady";
  if (declining.length > 0) status = "needs-care";
  else if (improving.length > 0) status = "improving";

  let headline = "Steady progress — keep the rhythm going.";
  if (status === "improving") headline = "Things are moving in a good direction. 🌱";
  else if (status === "needs-care")
    headline = "Some skills need a little extra kindness this week.";

  const caregiverNote =
    alerts.length > 0
      ? alerts[0].message
      : status === "improving"
        ? "Engagement is up — encourage the activities they enjoy most."
        : "No concerns flagged. Keep the routine light and consistent.";

  return {
    status,
      headline,
    caregiverNote,
    insights,
    nextPlan: prescribeDailySession(abilities, sessions),
    sessionsLast7Days: adh.sessionsLast7Days,
    activeDaysLast7Days: adh.activeDaysLast7Days,
    abilities,
    trends,
  };
}
