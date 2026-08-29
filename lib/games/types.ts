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
  "names",
  "memorylane",
  "market",
  "routine",
  "loom",
  "drums",
  "soundmatch",
  "spatial",
  "pairs",
  "bazaar",
  "oddone",
  "sortit",
  "stroop",
  "trail",
  "melody",
  "sequence",
  "clock",
  "spot",
  "wordrecall",
  "follow",
  "shadow",
  "reaction",
  "wordbuilder",
  "category",
  "emotion",
  "target",
  "order",
] as const;

export type GameId = (typeof GAME_IDS)[number];

/** Player-chosen difficulty band — seeds the adaptive staircase. */
export type GameLevel = "easy" | "moderate" | "hard";

export const GAME_LEVELS: readonly GameLevel[] = ["easy", "moderate", "hard"];

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
  // Evidence-based additions (see each component's header for citations):
  names: {
    id: "names",
    domain: "memory",
    secondaryDomains: ["executive"],
    category: "remember",
  },
  // Reminiscence therapy (Butler 1963; Woods et al., Cochrane 2018):
  memorylane: {
    id: "memorylane",
    domain: "memory",
    secondaryDomains: ["executive"],
    category: "remember",
  },
  market: { id: "market", domain: "working", secondaryDomains: ["memory"], category: "remember" },
  pairs: { id: "pairs", domain: "working", secondaryDomains: [], category: "remember" },
  melody: { id: "melody", domain: "working", secondaryDomains: ["memory"], category: "remember" },
  drums: { id: "drums", domain: "attention", secondaryDomains: [], category: "focus" },
  soundmatch: {
    id: "soundmatch",
    domain: "attention",
    secondaryDomains: ["memory"],
    category: "focus",
  },
  stroop: { id: "stroop", domain: "attention", secondaryDomains: ["executive"], category: "focus" },
  trail: { id: "trail", domain: "attention", secondaryDomains: ["executive"], category: "focus" },
  routine: { id: "routine", domain: "executive", secondaryDomains: ["memory"], category: "think" },
  loom: { id: "loom", domain: "executive", secondaryDomains: ["attention"], category: "think" },
  oddone: { id: "oddone", domain: "executive", secondaryDomains: ["attention"], category: "think" },
  sortit: {
    id: "sortit",
    domain: "executive",
    secondaryDomains: ["memory"],
    category: "think",
  },
  bazaar: { id: "bazaar", domain: "executive", secondaryDomains: ["working"], category: "think" },
  spatial: { id: "spatial", domain: "spatial", secondaryDomains: ["memory"], category: "find" },
  // New games (see each component's header for the evidence base):
  sequence: {
    id: "sequence",
    domain: "working",
    secondaryDomains: ["memory"],
    category: "remember",
  },
  clock: {
    id: "clock",
    domain: "executive",
    secondaryDomains: ["spatial"],
    category: "think",
  },
  spot: {
    id: "spot",
    domain: "spatial",
    secondaryDomains: ["attention"],
    category: "find",
  },
  wordrecall: {
    id: "wordrecall",
    domain: "memory",
    secondaryDomains: ["working"],
    category: "remember",
  },
  follow: {
    id: "follow",
    domain: "attention",
    secondaryDomains: ["working"],
    category: "focus",
  },
  shadow: {
    id: "shadow",
    domain: "spatial",
    secondaryDomains: ["attention"],
    category: "find",
  },
  // --- New games (see each component's header for the evidence base) ---
  reaction: {
    id: "reaction",
    domain: "attention",
    secondaryDomains: ["executive"],
    category: "focus",
  },
  wordbuilder: {
    id: "wordbuilder",
    domain: "executive",
    secondaryDomains: ["working"],
    category: "think",
  },
  category: {
    id: "category",
    domain: "executive",
    secondaryDomains: ["attention"],
    category: "think",
  },
  emotion: {
    id: "emotion",
    domain: "working",
    secondaryDomains: ["attention"],
    category: "remember",
  },
  target: {
    id: "target",
    domain: "attention",
    secondaryDomains: ["spatial"],
    category: "focus",
  },
  order: {
    id: "order",
    domain: "executive",
    secondaryDomains: ["memory"],
    category: "think",
  },
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

/**
 * A "player" is the person actually doing the exercises — the one whose
 * progress we track. Identity is generated and stored entirely on-device
 * (a random id in IndexedDB). We deliberately do NOT use the network IP
 * address: IPs leak across networks, are shared on some routers, and expose
 * location. A local profile id is private, stable and impossible to exfiltrate.
 */
export interface PlayerProfile {
  id: string;
  name: string;
  /** Optional accent color (hsl triple) for the avatar chip. */
  color?: string;
  createdAt: string;
}

/** Persisted ability state for one cognitive domain. */
export interface AbilityState {
  /** Composite key `${playerId}::${domain}` — unique per player+domain. */
  abilityKey: string;
  playerId: string;
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
  /** Persisted snooze deadline (ISO) — survives reloads, unlike timers. */
  snoozedUntil?: string;
}
