/**
 * Cognitive game domain model.
 *
 * Every game reports the same trial shape so a single adaptation engine
 * can estimate per-domain ability across all activities. Nothing here is
 * UI-specific; everything must be serializable into IndexedDB and safe
 * to export in a backup.
 */

/** The five cognitive domains trained, aligned with CST/SR literature. */
export const SKILL_DOMAINS = [
  "memory",
  "working",
  "attention",
  "executive",
  "spatial",
] as const;

export type SkillDomain = (typeof SKILL_DOMAINS)[number];

export const GAME_IDS = [
  "faces",
  "market",
  "routine",
  "loom",
  "drums",
  "spatial",
  "pairs",
  "bazaar",
  "oddone",
  "stroop",
  "trail",
  "melody",
] as const;

export type GameId = (typeof GAME_IDS)[number];

export interface GameMeta {
  id: GameId;
  /** Primary domain exercised — used by the scheduler for balanced rotation. */
  domain: SkillDomain;
  /** Secondary domains that also receive partial ability credit. */
  secondaryDomains: SkillDomain[];
  /** Hub category grouping. */
  category: "remember" | "focus" | "think" | "find";
}

export const GAME_META: Record<GameId, GameMeta> = {
  faces: { id: "faces", domain: "memory", secondaryDomains: [], category: "remember" },
  market: { id: "market", domain: "working", secondaryDomains: ["memory"], category: "remember" },
  pairs: { id: "pairs", domain: "working", secondaryDomains: [], category: "remember" },
  melody: { id: "melody", domain: "working", secondaryDomains: ["memory"], category: "remember" },
  drums: { id: "drums", domain: "attention", secondaryDomains: [], category: "focus" },
  stroop: { id: "stroop", domain: "attention", secondaryDomains: ["executive"], category: "focus" },
  trail: { id: "trail", domain: "attention", secondaryDomains: ["executive"], category: "focus" },
  routine: { id: "routine", domain: "executive", secondaryDomains: ["memory"], category: "think" },
  loom: { id: "loom", domain: "executive", secondaryDomains: ["attention"], category: "think" },
  oddone: { id: "oddone", domain: "executive", secondaryDomains: ["attention"], category: "think" },
  bazaar: { id: "bazaar", domain: "executive", secondaryDomains: ["working"], category: "think" },
  spatial: { id: "spatial", domain: "spatial", secondaryDomains: ["memory"], category: "find" },
};

/** One answered item inside a game session. */
export interface TrialRecord {
  /** Stable identifier of the item inside its game's bank. */
  itemId: string;
  game: GameId;
  /** Primary skill domain this trial measured. */
  domain: SkillDomain;
  /** Item difficulty on the IRT logit scale (higher = harder). */
  difficulty: number;
  correct: boolean;
  /** Response latency in ms (used for fatigue detection + speed credit). */
  rtMs: number;
  /** How many hints/corrections were needed before success. */
  hintsUsed: number;
  at: string;
}

/** A complete play-through of one game. */
export interface GameSession {
  id: string;
  game: GameId;
  startedAt: string;
  endedAt: string;
  trials: TrialRecord[];
  /** Ability estimate after this session's updates, per touched domain. */
  thetaAfter: Partial<Record<SkillDomain, number>>;
  /** 0..1 engagement proxy: completed items / planned items. */
  completion: number;
  /** True when the session ended early due to fatigue heuristics. */
  endedEarly: boolean;
}

/** Persisted ability state for one cognitive domain. */
export interface AbilityState {
  domain: SkillDomain;
  /** Current IRT-style ability estimate (logit scale). */
  theta: number;
  /** Total informative trials folded into theta. */
  trialsSeen: number;
  /** Exponentially-weighted mean response time, ms. */
  ewmaRtMs: number;
  updatedAt: string;
}

export type ReminderKind = "medicine" | "hydration" | "activity" | "appointment";

export const REMINDER_KINDS: readonly ReminderKind[] = [
  "medicine",
  "hydration",
  "activity",
  "appointment",
];

export interface Reminder {
  id: string;
  kind: ReminderKind;
  title: string;
  /** Local time-of-day "HH:MM" for daily reminders. */
  time: string;
  /** Days of week 0=Sun…6=Sat the reminder fires on. */
  days: number[];
  /** ISO date for one-shot reminders (appointments). */
  onceOn?: string;
  note?: string;
  enabled: boolean;
  /** Pre-alert lead minutes before `time` (appointments mainly). */
  leadMinutes?: number;
  createdAt: string;
  updatedAt: string;
}

export interface ReminderEvent {
  id: string;
  reminderId: string;
  /** When the reminder was due (ISO). */
  dueAt: string;
  /** "fired" | "done" | "missed" */
  status: "fired" | "done" | "missed";
  resolvedAt?: string;
}
