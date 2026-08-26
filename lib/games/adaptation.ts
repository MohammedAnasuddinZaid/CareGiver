import { gamesConfig } from "@/lib/games/config";
import { GAME_IDS, GAME_META, SKILL_DOMAINS, type GameId, type SkillDomain } from "./types";

export interface AbilityStateLike {
  domain: SkillDomain;
  theta: number;
}

/**
 * Daily session prescriber.
 *
 * Picks the next games to play using three signals:
 *   1. WEAKNESS — domains with lower θ are trained more often.
 *   2. RECENCY  — domains/games not played recently get a boost.
 *   3. COOLDOWN — the same game is not repeated inside the cooldown window.
 *
 * Deterministic given inputs — no hidden randomness — so caregivers and
 * tests can always explain why today's plan looks the way it does.
 */

export interface SessionSummaryLike {
  game: GameId;
  startedAt: string;
}

/** Hours since `fromISO` (negative if in future). Safe on bad dates. */
export function hoursSince(fromISO: string, nowMs: number): number {
  const t = Date.parse(fromISO);
  if (!Number.isFinite(t)) return Number.POSITIVE_INFINITY;
  return (nowMs - t) / 3_600_000;
}

function thetaOf(
  abilities: AbilityStateLike[],
  domain: SkillDomain,
): number | null {
  const found = abilities.find((a) => a.domain === domain);
  return found ? found.theta : null;
}

export interface Prescription {
  games: GameId[];
  /** Human-explainable reasons per picked game (for caregiver transparency). */
  reasons: Record<GameId, string>;
}

/**
 * Prescribes today's session.
 * `nowMs` injectable for tests; defaults to real time.
 */
export function prescribeDailySession(
  abilities: AbilityStateLike[],
  recentSessions: SessionSummaryLike[],
  nowMs: number = Date.now(),
): Prescription {
  const { gamesPerDay, sameGameCooldownHours, weakestDomainBoost, recencyWeightDays } =
    gamesConfig.scheduler;

  // Mean θ across known domains → relative weakness per domain.
  const known = SKILL_DOMAINS.map((d) => thetaOf(abilities, d)).filter(
    (t): t is number => t !== null,
  );
  const meanTheta = known.length ? known.reduce((s, x) => s + x, 0) / known.length : 0;

  const lastPlayedAt = new Map<GameId, string>();
  for (const s of recentSessions) {
    const prev = lastPlayedAt.get(s.game);
    if (!prev || prev < s.startedAt) lastPlayedAt.set(s.game, s.startedAt);
  }

  const scoreGame = (
    id: GameId,
    picked: GameId[],
  ): { score: number; reason: string } => {
    const meta = GAME_META[id];
    let score = 0;
    const reasons: string[] = [];

    // Weakness of primary domain relative to player's average.
    const theta = thetaOf(abilities, meta.domain) ?? meanTheta;
    const weakness = meanTheta - theta; // positive when below average
    score += Math.max(-1, weakness) * weakestDomainBoost;
    if (weakness > 0.15) {
      reasons.push("trains your current focus area");
    }

    // Recency across primary + secondary domains.
    const daysIdle = lastPlayedAt.has(id)
      ? Math.max(0, hoursSince(lastPlayedAt.get(id)!, nowMs) / 24)
      : 7;
    score += Math.min(recencyWeightDays, daysIdle) / recencyWeightDays;
    if (!lastPlayedAt.has(id)) reasons.push("new for you");

    // Cooldown penalty when recently played. Future timestamps (clock
    // skew, imported data) are clamped so they can't produce a huge
    // negative-hours bonus/penalty.
    const hours = lastPlayedAt.has(id)
      ? Math.max(0, hoursSince(lastPlayedAt.get(id)!, nowMs))
      : Infinity;
    if (hours < sameGameCooldownHours) {
      score -= (1 - hours / sameGameCooldownHours) * 2.5;
      if (picked.length && picked.includes(id)) score -= 10;
    }

    // Mild rotating preference keeps plans stable WITHIN a day yet
    // guarantees every game in the library gets its turn across days
    // (the tiebreak index shifts one position per day). Uses the LOCAL
    // calendar day — a UTC-epoch day flips at e.g. 5:30 AM for IST
    // users, visibly reshuffling the plan mid-morning.
    const nowDate = new Date(nowMs);
    const dayNumber =
      Date.UTC(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate()) /
      86_400_000;
    const rotated =
      (GAME_IDS_STABLE.indexOf(id) + dayNumber) % GAME_IDS_STABLE.length;
    const stability = rotated * 0.01;
    score -= stability;

    if (reasons.length === 0) reasons.push("keeps skills balanced");
    return { score, reason: reasons[0] };
  };

  const picked: GameId[] = [];
  const reasons = {} as Record<GameId, string>;
  const pool = GAME_META_ORDER.slice();

  while (picked.length < Math.min(gamesPerDay, pool.length)) {
    let best: GameId | null = null;
    let bestScore = -Infinity;
    let bestReason = "";
    for (const id of pool) {
      if (picked.includes(id)) continue;
      const { score, reason } = scoreGame(id, picked);
      if (score > bestScore) {
        bestScore = score;
        best = id;
        bestReason = reason;
      }
    }
    if (!best) break;
    picked.push(best);
    reasons[best] = bestReason;
  }

  return { games: picked, reasons };
}

// Stable iteration orders (never depend on object key order).
const GAME_IDS_STABLE: readonly GameId[] = GAME_IDS;
const GAME_META_ORDER: readonly GameId[] = GAME_IDS;
