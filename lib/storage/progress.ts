import { generateId } from "./profiles";
import {
  dbClear,
  dbDelete,
  dbGet,
  dbGetAll,
  dbPut,
  dbTransactionalWrite,
  STORE_ABILITY,
  STORE_OUTBOX,
  STORE_SESSIONS,
} from "./db";
import { GAME_IDS, SKILL_DOMAINS } from "@/lib/games/types";
import type {
  AbilityState,
  GameId,
  GameSession,
  SkillDomain,
  TrialRecord,
} from "@/lib/games/types";

/**
 * Local persistence for cognitive-platform data. Every read passes through
 * defensive sanitization — corrupted or hand-edited IndexedDB records must
 * degrade to safe shapes, never crash a session.
 */

function nowISO(): string {
  return new Date().toISOString();
}

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

function sanitizeTrials(raw: unknown): TrialRecord[] {
  if (!Array.isArray(raw)) return [];
  const trials: TrialRecord[] = [];
  for (const t of raw.slice(0, 400)) {
    if (!t || typeof t !== "object") continue;
    const r = t as Record<string, unknown>;
    const itemId = typeof r.itemId === "string" ? r.itemId.slice(0, 160) : null;
    const game = typeof r.game === "string" && (GAME_IDS as readonly string[]).includes(r.game)
      ? (r.game as GameId)
      : null;
    const domain =
      typeof r.domain === "string" && (SKILL_DOMAINS as readonly string[]).includes(r.domain)
        ? (r.domain as SkillDomain)
        : null;
    if (!itemId || !game || !domain) continue;
    trials.push({
      itemId,
      game,
      domain,
      difficulty: typeof r.difficulty === "number" && Number.isFinite(r.difficulty)
        ? Math.min(6, Math.max(-6, r.difficulty))
        : 0,
      correct: r.correct === true,
      rtMs: typeof r.rtMs === "number" && Number.isFinite(r.rtMs) && r.rtMs >= 0
        ? Math.min(600_000, r.rtMs)
        : 0,
      hintsUsed: typeof r.hintsUsed === "number" && Number.isInteger(r.hintsUsed)
        ? Math.min(9, Math.max(0, r.hintsUsed))
        : 0,
      at: typeof r.at === "string" ? r.at.slice(0, 40) : nowISO(),
    });
  }
  return trials;
}

export function sanitizeSession(raw: unknown): GameSession | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = typeof r.id === "string" ? r.id.slice(0, 160) : null;
  const game = typeof r.game === "string" && (GAME_IDS as readonly string[]).includes(r.game)
    ? (r.game as GameId)
    : null;
  if (!id || !game || typeof r.startedAt !== "string" || typeof r.endedAt !== "string") {
    return null;
  }
  const thetaAfter: Partial<Record<SkillDomain, number>> = {};
  if (r.thetaAfter && typeof r.thetaAfter === "object") {
    for (const d of SKILL_DOMAINS) {
      const v = (r.thetaAfter as Record<string, unknown>)[d];
      if (typeof v === "number" && Number.isFinite(v)) thetaAfter[d] = v;
    }
  }
  return {
    id,
    game,
    startedAt: r.startedAt.slice(0, 40),
    endedAt: r.endedAt.slice(0, 40),
    trials: sanitizeTrials(r.trials),
    thetaAfter,
    completion:
      typeof r.completion === "number" && Number.isFinite(r.completion)
        ? Math.min(1, Math.max(0, r.completion))
        : 1,
    endedEarly: r.endedEarly === true,
  };
}

export async function saveSession(session: GameSession): Promise<void> {
  await dbPut(STORE_SESSIONS, session);
  await enqueueOutbox("session", session.id);
}

export async function getSession(id: string): Promise<GameSession | undefined> {
  const raw = await dbGet<unknown>(STORE_SESSIONS, id);
  return raw ? sanitizeSession(raw) ?? undefined : undefined;
}

export async function getAllSessions(): Promise<GameSession[]> {
  const raw = await dbGetAll<unknown>(STORE_SESSIONS);
  return raw
    .map(sanitizeSession)
    .filter((s): s is GameSession => s !== null)
    .sort((a, b) => (a.startedAt < b.startedAt ? -1 : 1));
}

export async function getRecentSessions(limitDays: number): Promise<GameSession[]> {
  const cutoff = Date.now() - limitDays * 86_400_000;
  const all = await getAllSessions();
  return all.filter((s) => {
    const t = Date.parse(s.startedAt);
    return Number.isFinite(t) && t >= cutoff;
  });
}

/** Retention control: keep at most `keep` newest sessions per game. */
export async function pruneSessions(keepPerGame = 120): Promise<number> {
  const all = await getAllSessions();
  const byGame = new Map<GameId, GameSession[]>();
  for (const s of all) {
    const list = byGame.get(s.game) ?? [];
    list.push(s);
    byGame.set(s.game, list);
  }
  const excess: GameSession[] = [];
  for (const [, list] of byGame) {
    if (list.length > keepPerGame) excess.push(...list.slice(0, list.length - keepPerGame));
  }
  if (excess.length === 0) return 0;
  // One atomic transaction instead of N sequential ones — pruning runs
  // right after each session save, so this trims end-of-session latency.
  await dbTransactionalWrite(
    excess.map((s) => ({ store: STORE_SESSIONS, type: "delete" as const, key: s.id })),
  );
  return excess.length;
}

export async function clearSessions(): Promise<void> {
  await dbClear(STORE_SESSIONS);
}

// ---------------------------------------------------------------------------
// Ability states
// ---------------------------------------------------------------------------

export function sanitizeAbility(raw: unknown): AbilityState | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (
    typeof r.domain !== "string" ||
    !(SKILL_DOMAINS as readonly string[]).includes(r.domain)
  ) {
    return null;
  }
  return {
    domain: r.domain as SkillDomain,
    abilityKey:
      typeof r.abilityKey === "string" && r.abilityKey.length > 0
        ? r.abilityKey.slice(0, 80)
        : `local::${r.domain}`,
    playerId: typeof r.playerId === "string" ? r.playerId.slice(0, 80) : "local",
    theta: typeof r.theta === "number" && Number.isFinite(r.theta) ? r.theta : -0.4,
    trialsSeen:
      typeof r.trialsSeen === "number" && Number.isInteger(r.trialsSeen) && r.trialsSeen >= 0
        ? Math.min(1_000_000, r.trialsSeen)
        : 0,
    ewmaRtMs:
      typeof r.ewmaRtMs === "number" && Number.isFinite(r.ewmaRtMs) && r.ewmaRtMs >= 0
        ? r.ewmaRtMs
        : 0,
    updatedAt: typeof r.updatedAt === "string" ? r.updatedAt.slice(0, 40) : nowISO(),
  };
}

export async function getAbilities(): Promise<AbilityState[]> {
  const raw = await dbGetAll<unknown>(STORE_ABILITY);
  return raw.map(sanitizeAbility).filter((a): a is AbilityState => a !== null);
}

export async function saveAbility(state: AbilityState): Promise<void> {
  await dbPut(STORE_ABILITY, state);
}

export async function clearAbilities(): Promise<void> {
  await dbClear(STORE_ABILITY);
}

// ---------------------------------------------------------------------------
// Offline outbox — every meaningful write queues an op so a future sync
 // pass (QR / LAN / cable) can move it to a caregiver device.
// ---------------------------------------------------------------------------

export interface OutboxEntry {
  id: string;
  kind: "session" | "reminder-event";
  refId: string;
  queuedAt: string;
}

async function enqueueOutbox(kind: OutboxEntry["kind"], refId: string): Promise<void> {
  try {
    const entry: OutboxEntry = {
      id: `${kind}:${refId}`,
      kind,
      refId,
      queuedAt: nowISO(),
    };
    await dbPut(STORE_OUTBOX, entry);
  } catch {
    // Outbox is best-effort bookkeeping; never block gameplay on it.
  }
}

export async function drainOutbox(): Promise<OutboxEntry[]> {
  const entries = await dbGetAll<OutboxEntry>(STORE_OUTBOX);
  return entries.sort((a, b) => (a.queuedAt < b.queuedAt ? -1 : 1));
}

export async function markOutboxDelivered(id: string): Promise<void> {
  await dbDelete(STORE_OUTBOX, id);
}

export async function clearAbilityAndProgress(): Promise<void> {
  await dbClear(STORE_SESSIONS);
  await dbClear(STORE_ABILITY);
  await dbClear(STORE_OUTBOX);
}

export function newSessionId(): string {
  return generateId();
}
