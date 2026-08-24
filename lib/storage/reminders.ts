import { generateId } from "./profiles";
import {
  dbClear,
  dbDelete,
  dbGetAll,
  dbGet,
  dbPut,
  STORE_REMINDERS,
  STORE_REMINDER_LOG,
} from "./db";
import { REMINDER_KINDS } from "@/lib/games/types";
import type { Reminder, ReminderEvent, ReminderKind } from "@/lib/games/types";

/**
 * Reminders persistence + scheduling math.
 * Pure functions (`nextDueAt`, `isDueOnDay`) are node-testable; the hook
 * layer consumes them on a 15 s tick while any page is open.
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
    // One-shot stays "due" the whole day so it can still fire if missed earlier.
    const endOfDay = t + 86_400_000;
    if (t <= afterMs && endOfDay > afterMs) return t;
    if (t > afterMs) return t;
    return null;
  }
  for (let addDays = 0; addDays <= 7; addDays++) {
    const day = new Date(afterMs + addDays * 86_400_000);
    day.setHours(0, minutesOfDay(reminder.time), 0, 0);
    if ((reminder.days ?? []).includes(day.getDay())) {
      const t = day.getTime();
      // Still show today's instance within a 2-hour grace window.
      if (t >= afterMs - 7_200_000) return Math.max(t, afterMs - 7_200_000);
    }
  }
  return null;
}

/** Stable event id per reminder+due-slot so firing is idempotent. */
export function eventIdFor(reminder: Reminder, dueMs: number): string {
  return `${reminder.id}:${Math.floor(dueMs / 60_000)}`;
}

async function logFired(event: ReminderEvent): Promise<void> {
  await dbPut(STORE_REMINDER_LOG, event);
}

/**
 * Finds reminders that are currently due and logs each exactly once.
 * Returns those needing an alert right now.
 */
export async function collectDueReminders(nowMs: number = Date.now()): Promise<Reminder[]> {
  const all = await getReminders();
  const due: Reminder[] = [];
  for (const reminder of all) {
    const at = nextDueAt(reminder, nowMs);
    if (at === null) continue;
    if (nowMs < at) continue;
    const id = eventIdFor(reminder, at);
    const already = await dbGet<unknown>(STORE_REMINDER_LOG, id);
    if (already) continue;
    await logFired({ id, reminderId: reminder.id, dueAt: new Date(at).toISOString(), status: "fired" });
    due.push(reminder);
  }
  return due;
}

export async function markReminderDone(reminderId: string): Promise<void> {
  const log = await dbGetAll<unknown>(STORE_REMINDER_LOG);
  const events = log.map(sanitizeEvent).filter((e): e is ReminderEvent => e !== null);
  const latest = events
    .filter((e) => e.reminderId === reminderId && e.status === "fired")
    .sort((a, b) => (a.dueAt < b.dueAt ? 1 : -1))[0];
  if (latest) {
    await dbPut(STORE_REMINDER_LOG, {
      ...latest,
      status: "done",
      resolvedAt: new Date().toISOString(),
    });
  }
}

export async function getRecentEvents(limitDays = 30): Promise<ReminderEvent[]> {
  const raw = await dbGetAll<unknown>(STORE_REMINDER_LOG);
  return raw
    .map(sanitizeEvent)
    .filter((e): e is ReminderEvent => e !== null)
    .filter((e) => {
      const t = Date.parse(e.dueAt);
      return Number.isFinite(t) && t >= Date.now() - limitDays * 86_400_000;
    })
    .sort((a, b) => (a.dueAt < b.dueAt ? -1 : 1));
}

/** Consecutive unresolved (fired-but-never-done) count for alerts. */
export async function missedStreak(reminderId: string): Promise<number> {
  const events = await getRecentEvents(14);
  let streak = 0;
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i];
    if (e.reminderId !== reminderId) continue;
    if (e.status === "done") break;
    if (e.status === "fired") streak++;
  }
  return streak;
}
