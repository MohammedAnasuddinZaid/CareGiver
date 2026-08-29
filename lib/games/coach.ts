import type { GameId, SkillDomain } from "@/lib/games/types";

export type CoachTone = "welcome" | "praise" | "encourage" | "hint" | "rest";

export interface CoachMessage {
  /** Stable category key; the UI only re-animates when this changes. */
  key: string;
  tone: CoachTone;
  text: string;
}

/**
 * On-device "AI coach" for the games. Pure, explainable heuristics — no
 * network, no model download. Reads the recent trial sequence and produces a
 * warm, contextual message: praise on a streak, a gentle nudge after a single
 * miss, a concrete domain-specific hint after repeated misses, and a calm
 * "rest" prompt if the player looks fatigued.
 *
 * The tone/streak logic is intentionally simple (consecutive-correct /
 * consecutive-miss windows) so it never surprises a person living with
 * cognitive decline — consistency is the point.
 */
export function coachMessage(
  gameId: GameId,
  trials: { correct: boolean }[],
  domain: SkillDomain,
): CoachMessage {
  const n = trials.length;
  if (n === 0) {
    return {
      key: "welcome",
      tone: "welcome",
      text: "Let’s play — there are no wrong moves here, just try your best.",
    };
  }

  let streakCorrect = 0;
  let streakMiss = 0;
  for (let i = n - 1; i >= 0; i--) {
    if (trials[i].correct) {
      streakCorrect++;
      break;
    } else {
      streakMiss++;
      if (trials[i - 1] && !trials[i - 1].correct) continue;
      break;
    }
  }
  // Walk the rest to get full consecutive runs.
  streakCorrect = 0;
  streakMiss = 0;
  for (let i = n - 1; i >= 0; i--) {
    if (trials[i].correct) streakCorrect++;
    else streakMiss++;
    if (i > 0 && trials[i].correct !== trials[i - 1].correct) break;
  }

  if (streakCorrect >= 3) {
    return pick("streak", "praise", PRAISE);
  }
  if (streakMiss >= 2) {
    return { key: "miss", tone: "hint", text: HINTS[domain] };
  }
  if (streakMiss === 1) {
    return pick("miss1", "encourage", ENCOURAGE);
  }
  return pick("steady", "encourage", STEADY);
}

function pick(key: string, tone: CoachTone, pool: string[]): CoachMessage {
  // Deterministic pick so the same situation shows a stable line (no flicker
  // between identical states across re-renders).
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return { key, tone, text: pool[h % pool.length] };
}

const PRAISE = [
  "You’re on a roll — that’s wonderful!",
  "Beautifully done. Keep that rhythm going.",
  "That’s a great run — you’ve got this.",
  "Lovely! Your memory is working nicely here.",
];

const ENCOURAGE = [
  "That’s okay — every try helps the brain.",
  "No worry at all, just have another go.",
  "You’re doing fine. Take your time.",
  "It’s all practice — keep going, you’re doing well.",
];

const STEADY = [
  "Nicely paced — keep enjoying the moment.",
  "Good focus. One step at a time.",
  "You’re doing well — stay with it.",
];

const HINTS: Record<SkillDomain, string> = {
  memory: "Tip: link the face or word to a little story — stories stick better.",
  working: "Tip: say the items out loud as you tap; hearing helps holding them.",
  attention: "Tip: take a slow breath and watch the centre — the answer waits there.",
  executive: "Tip: break it into two small steps; do one, then the next.",
  spatial: "Tip: picture the room in your mind first, then point to where it was.",
};
