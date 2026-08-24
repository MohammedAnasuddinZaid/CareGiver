import { gamesConfig } from "@/lib/games/config";
import type { AbilityState, SkillDomain, TrialRecord } from "@/lib/games/types";

/**
 * Psychometric ability model — a 1-parameter logistic (Rasch) IRT core with
 * an Elo-style online update rule.
 *
 * Success probability:  p(correct | θ, b) = σ(θ − b) = 1/(1+e^-(θ−b))
 *
 * Online update after each trial:
 *   K   = K₀ · 1/(1 + n/halflife)          (learning rate decays with evidence)
 *   θ'  = clamp(θ + K·(s − p))             (s ∈ [0..1] outcome incl. hint penalty)
 *
 * This is mathematically equivalent to maximum-likelihood Rasch estimation
 * under small steps, but O(1) per trial and stable on-device.
 */

export function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

/** Probability the player succeeds on an item of difficulty `b`. */
export function predictedSuccess(theta: number, b: number): number {
  return sigmoid(theta - b);
}

export function newAbilityState(domain: SkillDomain, nowISO: string): AbilityState {
  return {
    domain,
    theta: gamesConfig.irt.initialTheta,
    trialsSeen: 0,
    ewmaRtMs: 0,
    updatedAt: nowISO,
  };
}

/** Learning rate that decays as evidence accumulates. */
export function learningRate(trialsSeen: number): number {
  const { kBase, kHalfLifeTrials } = gamesConfig.irt;
  return kBase / (1 + trialsSeen / kHalfLifeTrials);
}

export function clampTheta(theta: number): number {
  return Math.min(gamesConfig.irt.thetaMax, Math.max(gamesConfig.irt.thetaMin, theta));
}

/**
 * Outcome score in [0..1]. A correct answer with hints still teaches —
 * it earns partial credit instead of being thrown away (errorless learning).
 */
export function outcomeScore(correct: boolean, hintsUsed: number): number {
  if (!correct) return 0;
  if (hintsUsed <= 0) return 1;
  return Math.max(0.3, 1 - hintsUsed * gamesConfig.sessions.hintPenalty);
}

/**
 * Folds one trial into the ability state and returns the updated copy.
 * Response time updates via EWMA for fatigue detection downstream.
 */
export function applyTrial(
  state: AbilityState,
  trial: Pick<TrialRecord, "difficulty" | "correct" | "rtMs" | "hintsUsed">,
  nowISO: string,
): AbilityState {
  const p = predictedSuccess(state.theta, trial.difficulty);
  const s = outcomeScore(trial.correct, trial.hintsUsed);
  const K = learningRate(state.trialsSeen);
  const nextTheta = clampTheta(state.theta + K * (s - p));

  // EWMA over response time; seeded by the first observation.
  const alpha = state.trialsSeen === 0 ? 1 : 0.25;
  const ewmaRtMs =
    Number.isFinite(trial.rtMs) && trial.rtMs > 0
      ? Math.round(alpha * trial.rtMs + (1 - alpha) * state.ewmaRtMs)
      : state.ewmaRtMs;

  return {
    ...state,
    theta: nextTheta,
    trialsSeen: state.trialsSeen + 1,
    ewmaRtMs,
    updatedAt: nowISO,
  };
}

/**
 * Item difficulty that yields the target success probability:
 * solve σ(θ − b) = t  ⇒  b* = θ − logit(t).
 */
export function itemDifficultyForTarget(theta: number): number {
  const t = Math.min(0.95, Math.max(0.05, gamesConfig.irt.targetSuccess));
  return theta - Math.log(t / (1 - t));
}

/** Plain-language difficulty level 0..4 for UI display. */
export function difficultyLevel(b: number): number {
  return Math.min(4, Math.max(0, Math.round((b + 1.2) / 0.6)));
}

// ---------------------------------------------------------------------------
// Within-session staircase — fast local adaptation between stored θ updates.
// ---------------------------------------------------------------------------

export interface StaircaseState {
  offset: number;
  consecutiveSuccesses: number;
  consecutiveFailures: number;
}

export function newStaircase(): StaircaseState {
  return { offset: gamesConfig.staircase.startOffset, consecutiveSuccesses: 0, consecutiveFailures: 0 };
}

/** Current session-local difficulty given the player's stored ability. */
export function staircaseDifficulty(staircase: StaircaseState, theta: number): number {
  const maxOffset = gamesConfig.staircase.maxOffsetFromTheta;
  const offset = Math.min(maxOffset, Math.max(-maxOffset, staircase.offset));
  return clampTheta(theta + offset);
}

/**
 * Advances the staircase. Two misses drop immediately (errorless principle:
 * never let frustration build); three clean successes raise one step.
 */
export function advanceStaircase(staircase: StaircaseState, correct: boolean): void {
  if (correct) {
    staircase.consecutiveSuccesses += 1;
    staircase.consecutiveFailures = 0;
    if (staircase.consecutiveSuccesses >= gamesConfig.staircase.successesToRaise) {
      staircase.offset = Math.min(
        gamesConfig.staircase.maxOffsetFromTheta,
        staircase.offset + gamesConfig.staircase.step,
      );
      staircase.consecutiveSuccesses = 0;
    }
  } else {
    staircase.consecutiveFailures += 1;
    staircase.consecutiveSuccesses = 0;
    if (staircase.consecutiveFailures >= gamesConfig.staircase.failuresToDrop) {
      staircase.offset = Math.max(
        -gamesConfig.staircase.maxOffsetFromTheta,
        staircase.offset - gamesConfig.staircase.step,
      );
      staircase.consecutiveFailures = 0;
    }
  }
}

// ---------------------------------------------------------------------------
// Trend analysis — ordinary least squares slope for caregiver analytics.
// ---------------------------------------------------------------------------

export interface TrendPoint {
  /** Independent variable (e.g., days since first session). */
  x: number;
  /** Dependent variable (e.g., θ). */
  y: number;
}

/**
 * OLS simple regression. Returns slope per unit x; empty/constant input
 * safely returns null so callers never divide by zero.
 */
export function olsSlope(points: TrendPoint[]): number | null {
  const n = points.length;
  if (n < 2) return null;
  let sx = 0;
  let sy = 0;
  for (const p of points) {
    sx += p.x;
    sy += p.y;
  }
  const mx = sx / n;
  const my = sy / n;
  let num = 0;
  let den = 0;
  for (const p of points) {
    num += (p.x - mx) * (p.y - my);
    den += (p.x - mx) * (p.x - mx);
  }
  if (den === 0) return null;
  return num / den;
}

/**
 * Fatigue heuristic: median RT of the recent window vs the baseline window
 * grows beyond the configured fraction → end the session kindly.
 */
export function detectFatigue(recentRts: number[], baselineRts: number[]): boolean {
  if (
    recentRts.length < gamesConfig.sessions.minimumItemsBeforeFatigueEnd ||
    baselineRts.length < gamesConfig.sessions.minimumItemsBeforeFatigueEnd
  ) {
    return false;
  }
  const median = (xs: number[]): number => {
    const s = xs.slice().sort((a, b) => a - b);
    const mid = s.length >> 1;
    return s.length % 2 === 1 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
  };
  const base = median(baselineRts);
  if (!Number.isFinite(base) || base <= 0) return false;
  return median(recentRts) / base - 1 > gamesConfig.sessions.fatigueRtGrowth;
}
