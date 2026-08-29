import type { GameId, SkillDomain } from "./types";

/**
 * Central adaptation + cognition configuration.
 * Every constant that shapes difficulty and analytics lives here, mirroring
 * the role recognitionConfig plays for the vision pipeline.
 */
export const gamesConfig = {
  /**
   * Logistic (1-parameter IRT) success model: p = σ(θ − b).
   * θ = patient ability, b = item difficulty, both on the logit scale.
   */
  irt: {
    /** Starting ability for a brand-new player (slightly below easy). */
    initialTheta: -0.4,
    /** Base learning rate; decays as evidence accumulates. */
    kBase: 0.32,
    /** Trials after which K has decayed to ~half. */
    kHalfLifeTrials: 60,
    /** Hard clamps so a bad streak can never produce absurd estimates. */
    thetaMin: -2.5,
    thetaMax: 2.8,
    /** Target success probability when selecting item difficulty.
     * 0.70 sits in the "optimal challenge" band for elderly players —
     * hard enough to train, soft enough to avoid frustration. */
    targetSuccess: 0.7,
  },

  /** Within-session staircase (errorless-learning friendly). */
  staircase: {
    /** Consecutive failures before dropping a difficulty step. */
    failuresToDrop: 2,
    /** Consecutive successes before raising a difficulty step. */
    successesToRaise: 3,
    /** Step size on the logit scale per raise/drop. */
    step: 0.18,
    /** Session start offset relative to stored θ (start slightly easy). */
    startOffset: -0.25,
    maxOffsetFromTheta: 1.1,
  },

  sessions: {
    /** Planned items per game session (~6–9 minutes at elderly pace). */
    itemsPerSession: 10,
    /** Median-RT growth over baseline that triggers early, kind endings. */
    fatigueRtGrowth: 0.45,
    /**
     * Robust response-time scatter (MAD) growth over baseline that ALSO
     * triggers a kind ending. Fatigue often appears as erratic timing
     * before it slows overall speed — this catches it earlier.
     */
    fatigueScatterGrowth: 1.5,
    minimumItemsBeforeFatigueEnd: 4,
    /** Accuracy credit multiplier when hints were needed. */
    hintPenalty: 0.35,
  },

  /**
   * Player-chosen difficulty bands. Each seeds the adaptive staircase with a
   * different starting offset (logits) relative to stored ability θ:
   *   easy     → well below ability (lots of wins, confidence-building)
   *   moderate → the calibrated default
   *   hard     → above ability (stretch)
   * The staircase still adapts within the session, so these are starting
   * points, not fixed ceilings.
   */
  levels: {
    easy: { startOffset: -1.1, itemsPerSession: 8, label: "Easy" },
    moderate: { startOffset: -0.25, itemsPerSession: 10, label: "Moderate" },
    hard: { startOffset: 0.6, itemsPerSession: 12, label: "Hard" },
  },

  scheduler: {
    /** How many games make up one prescribed daily session. */
    gamesPerDay: 3,
    /** Weight of days-since-last-play in domain rotation. */
    recencyWeightDays: 3,
    /** Domains with lowest θ get up-weighted by this factor. */
    weakestDomainBoost: 1.6,
    /** Cooldown: don't repeat the same game within N hours unless forced. */
    sameGameCooldownHours: 20,
  },

  alerts: {
    /** Weekly OLS slope (logits/week) more negative than this flags decline. */
    declineSlopePerWeek: -0.12,
    /** Minimum days of history before any trend alert is raised. */
    minHistoryDays: 7,
    /** Consecutive missed reminders that raise an adherence alert. */
    missedStreakAlert: 3,
    /** Sessions abandoned (<40% completion) in a row that raise an alert. */
    abandonStreakAlert: 2,
  },
} as const;

/** Difficulty ladder shown to caregivers as plain-language levels. */
export const DIFFICULTY_LABELS: readonly string[] = [
  "Gentle",
  "Easy",
  "Everyday",
  "Steady",
  "Challenging",
];

/** Maps a logit difficulty to an index into DIFFICULTY_LABELS. */
export function difficultyLabel(b: number): string {
  const idx = Math.min(
    DIFFICULTY_LABELS.length - 1,
    Math.max(0, Math.round((b + 1.2) / 0.6)),
  );
  return DIFFICULTY_LABELS[idx];
}

export interface DomainInfo {
  id: SkillDomain;
  label: string;
  description: string;
}

export const DOMAIN_INFO: Record<SkillDomain, DomainInfo> = {
  memory: {
    id: "memory",
    label: "Remembering people & moments",
    description: "Faces, names and personal memories",
  },
  working: {
    id: "working",
    label: "Holding things in mind",
    description: "Keeping small lists in mind while busy",
  },
  attention: {
    id: "attention",
    label: "Paying attention",
    description: "Staying focused and responding quickly",
  },
  executive: {
    id: "executive",
    label: "Thinking & planning",
    description: "Ordering routines, spotting patterns",
  },
  spatial: {
    id: "spatial",
    label: "Finding things",
    description: "Remembering where objects are placed",
  },
};

export function domainOfGame(game: GameId): SkillDomain {
  return GAME_META_DOMAIN[game];
}

// Kept as a flat map for cheap lookups without importing the full meta.
const GAME_META_DOMAIN: Record<GameId, SkillDomain> = {
  faces: "memory",
  names: "memory",
  memorylane: "memory",
  market: "working",
  pairs: "working",
  melody: "working",
  routine: "executive",
  loom: "executive",
  oddone: "executive",
  sortit: "executive",
  bazaar: "executive",
  drums: "attention",
  soundmatch: "attention",
  stroop: "attention",
  trail: "attention",
  spatial: "spatial",
  sequence: "working",
  clock: "executive",
  spot: "spatial",
  wordrecall: "memory",
  follow: "attention",
  shadow: "spatial",
  reaction: "attention",
  wordbuilder: "executive",
  category: "executive",
  emotion: "working",
  target: "attention",
  order: "executive",
};
