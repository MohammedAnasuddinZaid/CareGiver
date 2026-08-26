import { generateId } from "./profiles";
import {
  dbClear,
  dbDelete,
  dbGetAll,
  dbGetAllByIndex,
  dbGet,
  dbPut,
  dbPutIfAbsent,
  dbTransactionalWrite,
  STORE_REMINDERS,
  STORE_REMINDER_LOG,
} from "./db";
import { REMINDER_KINDS } from "@/lib/games/types";
import type { Reminder, ReminderEvent, ReminderKind } from "@/lib/games/types";

/**
 * Reminders persistence + scheduling math.
 * Pure functions (`nextDueAt`, `isDueOnDay`) are node-testable; the hook
 * layer consumes them on a 15 s tick while any page is open.
 *
 * Delivery model: an event stays "fired" (needing attention) until the
 * user confirms Done or the grace window expires — then it flips to
 * "missed" for analytics. Alerts therefore REAPPEAR after a reload or a
 * navigation instead of being silently lost for the day.
 */

const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function sanitizeReminder(raw: unknown): Reminder | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = typeof r.id === "string" ? r.id.slice(0, 160) : null;
  const title = typeof r.title === "string" && r.title.trim() ? r.title.trim().slice(0, 120) : null;
  const kind = typeof r.kind === "string" && (REMINDER_KINDS as readonly string[]).includes(r.kind)
    ? (r.kind as ReminderKind)
    : null;
  if (!id || !title || !kind) return null;
  const time = typeof r.time === "string" && HHMM.test(r.time) ? r.time : null;
  if (!time && typeof r.onceOn !== "string") return null;

  const days = Array.isArray(r.days)
    ? (r.days.filter((d): d is number => typeof d === "number" && Number.isInteger(d) && d >= 0 && d <= 6) as number[])
        .slice(0, 7)
    : [];
  return {
    id,
    kind,
    title,
    time: time ?? "09:00",
    days: days.length ? Array.from(new Set(days)).sort() : [0, 1, 2, 3, 4, 5, 6],
    onceOn:
      typeof r.onceOn === "string" && /^\d{4}-\d{2}-\d{2}$/.test(r.onceOn)
        ? r.onceOn
        : undefined,
    note: typeof r.note === "string" ? r.note.slice(0, 300) : undefined,
    enabled: r.enabled !== false,
    leadMinutes:
      typeof r.leadMinutes === "number" &&
      Number.isInteger(r.leadMinutes) &&
      r.leadMinutes >= 0 &&
      r.leadMinutes <= 720
        ? r.leadMinutes
        : undefined,
    createdAt: typeof r.createdAt === "string" ? r.createdAt.slice(0, 40) : new Date().toISOString(),
    updatedAt: typeof r.updatedAt === "string" ? r.updatedAt.slice(0, 40) : new Date().toISOString(),
  };
}

function sanitizeEvent(raw: unknown): ReminderEvent | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = typeof r.id === "string" ? r.id.slice(0, 200) : null;
  const reminderId = typeof r.reminderId === "string" ? r.reminderId.slice(0, 160) : null;
  const dueAt = typeof r.dueAt === "string" ? r.dueAt.slice(0, 40) : null;
  if (!id || !reminderId || !dueAt) return null;
  const status = r.status === "done" || r.status === "missed" || r.status === "fired" ? r.status : "fired";
  return {
    id,
    reminderId,
    dueAt,
    status,
    resolvedAt: typeof r.resolvedAt === "string" ? r.resolvedAt.slice(0, 40) : undefined,
    snoozedUntil:
      typeof r.snoozedUntil === "string" ? r.snoozedUntil.slice(0, 40) : undefined,
  };
}

export async function getReminders(): Promise<Reminder[]> {
  const raw = await dbGetAll<unknown>(STORE_REMINDERS);
  return raw
    .map(sanitizeReminder)
    .filter((r): r is Reminder => r !== null)
    .sort((a, b) => a.time.localeCompare(b.time));
}

export async function getReminder(id: string): Promise<Reminder | undefined> {
  const raw = await dbGet<unknown>(STORE_REMINDERS, id);
  return raw ? sanitizeReminder(raw) ?? undefined : undefined;
}

export async function saveReminder(
  input: Omit<Reminder, "id" | "createdAt" | "updatedAt"> & { id?: string },
): Promise<Reminder> {
  const now = new Date().toISOString();
  const existing = input.id ? await getReminder(input.id) : undefined;
  const reminder: Reminder = {
    ...input,
    id: input.id ?? generateId(),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  await dbPut(STORE_REMINDERS, reminder);
  return reminder;
}

export async function deleteReminder(id: string): Promise<void> {
  await dbDelete(STORE_REMINDERS, id);
}

export async function clearReminders(): Promise<void> {
  await dbClear(STORE_REMINDERS);
  await dbClear(STORE_REMINDER_LOG);
}

// ---------------------------------------------------------------------------
// Scheduling math — all local-time based, DST-safe via date arithmetic.
// ---------------------------------------------------------------------------

/** Minutes since local midnight for "HH:MM". */
export function minutesOfDay(time: string): number {
  const m = HHMM.exec(time);
  if (!m) return 9 * 60;
  return Number(m[1]) * 60 + Number(m[2]);
}

/** The next UTC instant this reminder should fire at/after `afterMs`. */
export function nextDueAt(reminder: Reminder, afterMs: number = Date.now()): number | null {
  if (!reminder.enabled) return null;
  if (reminder.onceOn) {
    const parts = reminder.onceOn.split("-").map(Number);
    const [y, mo, d] = parts;
    if (!y || !mo || !d) return null;
    const t = new Date(y, mo - 1, d, 0, minutesOfDay(reminder.time), 0, 0).getTime();
    // One-shot stays "due" the whole local day so it can still fire if
    // missed earlier. Local midnight of the NEXT day handles DST days that
    // are 23 or 25 hours long (t + 86_400_000 would end an hour early/late).
    const nextMidnight = new Date(y, mo - 1, d + 1, 0, 0, 0, 0).getTime();
    if (t <= afterMs && nextMidnight > afterMs) return t;
    if (t > afterMs) return t;
    return null;
  }
  for (let addDays = 0; addDays <= 7; addDays++) {
    const day = new Date(afterMs + addDays * 86_400_000);
    day.setHours(0, minutesOfDay(reminder.time), 0, 0);
    if ((reminder.days ?? []).includes(day.getDay())) {
      const t = day.getTime();
      // Still show today's instance within a 2-hour grace window.
      if (t >= afterMs - GRACE_WINDOW_MS) return Math.max(t, afterMs - GRACE_WINDOW_MS);
    }
  }
  return null;
}

/** How long after its slot a reminder can still be acknowledged. */
export const GRACE_WINDOW_MS = 2 * 3_600_000;
/** Reminder events older than this are pruned to keep the log bounded. */
const LOG_TTL_MS = 35 * 86_400_000;

/** Stable event id per reminder+due-slot so firing is idempotent. */
export function eventIdFor(reminder: Reminder, dueMs: number): string {
  return `${reminder.id}:${Math.floor(dueMs / 60_000)}`;
}

export interface DueAlert {
  reminder: Reminder;
  eventId: string;
  dueMs: number;
}

/**
 * Finds reminders needing an alert right now and logs each exactly once.
 *
 * Unlike a fire-once queue this RE-TURNS events already logged as "fired"
 * while they stay unresolved — so a refresh, navigation or crash mid-alert
 * never silently swallows a medication prompt for the rest of the day.
 * Snoozed events hide until their persisted deadline passes.
 *
 * Housekeeping piggybacks here (single writer per tick): unresolved
 * "fired" events past the grace window flip to "missed", and log rows
 * beyond the TTL are deleted so the store cannot grow without bound.
 */
export async function collectDueReminders(nowMs: number = Date.now()): Promise<DueAlert[]> {
  const all = await getReminders();

  // --- housekeeping over the existing log ---
  const raw = await dbGetAll<unknown>(STORE_REMINDER_LOG);
  const events = raw
    .map(sanitizeEvent)
    .filter((e): e is ReminderEvent => e !== null);

  const stale = events.filter((e) => Date.parse(e.dueAt) < nowMs - LOG_TTL_MS);
  const toMissed = events.filter(
    (e) =>
      e.status === "fired" &&
      !e.snoozedUntil &&
      nowMs - Date.parse(e.dueAt) > GRACE_WINDOW_MS,
  );
  if (stale.length > 0 || toMissed.length > 0) {
    const ops = [
      ...toMissed.map((e) => ({
        store: STORE_REMINDER_LOG,
        type: "put" as const,
        value: { ...e, status: "missed", resolvedAt: new Date(nowMs).toISOString() },
      })),
      ...stale.map((e) => ({
        store: STORE_REMINDER_LOG,
        type: "delete" as const,
        key: e.id,
      })),
    ];
    await dbTransactionalWrite(ops);
    const missedIds = new Set(toMissed.map((e) => e.id));
    for (let i = events.length - 1; i >= 0; i--) {
      if (missedIds.has(events[i].id)) events[i] = { ...events[i], status: "missed" };
    }
  }
  const byId = new Map(events.map((e) => [e.id, e]));

  // --- collection ---
  const alerts: DueAlert[] = [];
  for (const reminder of all) {
    const at = nextDueAt(reminder, nowMs);
    if (at === null) continue;
    if (nowMs < at) continue;
    const eventId = eventIdFor(reminder, at);
    const known = byId.get(eventId);
    if (known) {
      if (known.status !== "fired") continue; // done / missed ⇒ settled
      const snoozedUntil = known.snoozedUntil ? Date.parse(known.snoozedUntil) : 0;
      if (snoozedUntil > nowMs) continue; // still snoozed
      alerts.push({ reminder, eventId, dueMs: at });
      continue;
    }
    const won = await dbPutIfAbsent(STORE_REMINDER_LOG, {
      id: eventId,
      reminderId: reminder.id,
      dueAt: new Date(at).toISOString(),
      status: "fired",
    });
    if (won) alerts.push({ reminder, eventId, dueMs: at });
  }
  return alerts;
}

/** Marks the specific due-slot resolved ("done") — idempotent. */
export async function markReminderEventDone(eventId: string): Promise<void> {
  const e = await dbGet<unknown>(STORE_REMINDER_LOG, eventId);
  const event = sanitizeEvent(e);
  if (!event || event.status !== "fired") return;
  await dbPut(STORE_REMINDER_LOG, {
    ...event,
    status: "done",
    resolvedAt: new Date().toISOString(),
    snoozedUntil: undefined,
  });
}

/**
 * Persists a five-minute snooze on the due-slot. Survives reloads because
 * it lives in the same record the collector reads every tick.
 * `nowMs` is injectable so callers/tests can align with a driven clock.
 */
export async function snoozeReminderEvent(
  eventId: string,
  durationMs = 5 * 60_000,
  nowMs: number = Date.now(),
): Promise<void> {
  const e = await dbGet<unknown>(STORE_REMINDER_LOG, eventId);
  const event = sanitizeEvent(e);
  if (!event || event.status !== "fired") return;
  await dbPut(STORE_REMINDER_LOG, {
    ...event,
    snoozedUntil: new Date(nowMs + durationMs).toISOString(),
  });
}

export async function markReminderDone(reminderId: string): Promise<void> {
  const rows = await dbGetAllByIndex<unknown>(
    STORE_REMINDER_LOG,
    "reminderId",
    reminderId,
  );
  const latest = rows
    .map(sanitizeEvent)
    .filter((e): e is ReminderEvent => e !== null)
    .filter((e) => e.status === "fired")
    .sort((a, b) => (a.dueAt < b.dueAt ? 1 : -1))[0];
  if (latest) await markReminderEventDone(latest.id);
}

export async function getRecentEvents(limitDays = 30): Promise<ReminderEvent[]> {
  const cutoffISO = new Date(Date.now() - limitDays * 86_400_000).toISOString();
  const raw = await dbGetAllByIndex<unknown>(
    STORE_REMINDER_LOG,
    "dueAt",
    IDBKeyRange.lowerBound(cutoffISO),
  );
  return raw
    .map(sanitizeEvent)
    .filter((e): e is ReminderEvent => e !== null)
    .sort((a, b) => (a.dueAt < b.dueAt ? -1 : 1));
}

/** Consecutive unresolved (never confirmed) count for caregiver alerts. */
export async function missedStreak(reminderId: string): Promise<number> {
  const events = await getRecentEvents(14);
  let streak = 0;
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i];
    if (e.reminderId !== reminderId) continue;
    if (e.status === "done") break;
    // Both live "fired" and expired-to-"missed" slots mean nobody confirmed.
    if (e.status === "fired" || e.status === "missed") streak++;
  }
  return streak;
}
