import { beforeEach, describe, expect, it } from "vitest";
import {
  GRACE_WINDOW_MS,
  collectDueReminders,
  eventIdFor,
  getRecentEvents,
  markReminderEventDone,
  saveReminder,
  snoozeReminderEvent,
} from "@/lib/storage/reminders";
import type { Reminder } from "@/lib/games/types";
import { dbGet, dbPut, STORE_REMINDER_LOG } from "@/lib/storage/db";

function makeReminder(patch: Partial<Reminder> = {}): Reminder {
  return {
    id: "r-test",
    kind: "medicine",
    title: "Morning tablet",
    time: "09:00",
    days: [0, 1, 2, 3, 4, 5, 6],
    enabled: true,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...patch,
  };
}

// Local-time helpers keep the test DST/timezone independent.
const at = (day: number, h: number, m: number): number =>
  new Date(2026, 7, day, h, m, 0, 0).getTime();

beforeEach(async () => {
  await saveReminder(makeReminder({ id: `r-${Math.random().toString(36).slice(2, 8)}` }));
});

describe("reminder delivery engine", () => {
  it("delivers a due reminder and RE-DELIVERS it while unresolved", async () => {
    // Replace beforeEach's random-id reminder with a deterministic one.
    const r = makeReminder({ id: "r-main" });
    await saveReminder(r);
    const t = at(26, 9, 5);

    const first = await collectDueReminders(t);
    expect(first.map((d) => d.reminder.id)).toContain("r-main");
    const eventId = first.find((d) => d.reminder.id === "r-main")!.eventId;
    expect(eventId).toBe(eventIdFor(r, at(26, 9, 0)));

    // The critical reliability property: an alert that was logged but not
    // confirmed comes back on the very next tick instead of being lost.
    const second = await collectDueReminders(t);
    expect(second.some((d) => d.eventId === eventId)).toBe(true);
  });

  it("stops delivering once the slot is marked Done", async () => {
    const r = makeReminder({ id: "r-done" });
    await saveReminder(r);
    const t = at(26, 9, 5);
    const [alert] = await collectDueReminders(t);
    await markReminderEventDone(alert.eventId);
    const after = await collectDueReminders(t);
    expect(after.some((d) => d.eventId === alert.eventId)).toBe(false);
  });

  it("persists snoozes across collector ticks and resumes after the deadline", async () => {
    const r = makeReminder({ id: "r-snooze" });
    await saveReminder(r);
    const t0 = at(26, 9, 5);
    const [alert] = await collectDueReminders(t0);

    // Snooze deadline derives from the SAME clock the collector ticks on.
    await snoozeReminderEvent(alert.eventId, 5 * 60_000, t0);

    // Still inside the snooze window → hidden.
    const duringSnooze = await collectDueReminders(at(26, 9, 7));
    expect(duringSnooze.some((d) => d.eventId === alert.eventId)).toBe(false);

    // Deadline passed → delivered again (same slot id).
    const afterSnooze = await collectDueReminders(at(26, 9, 11));
    expect(afterSnooze.some((d) => d.eventId === alert.eventId)).toBe(true);
  });

  it("flips unresolved slots past the grace window to 'missed'", async () => {
    const r = makeReminder({ id: "r-missed" });
    await saveReminder(r);
    const due = at(26, 9, 0);
    const justFired = due + 1000;
    const [alert] = await collectDueReminders(justFired);
    expect(alert.eventId).toBeDefined();

    // Well past the 2 h grace without confirmation → settled as missed.
    await collectDueReminders(due + GRACE_WINDOW_MS + 60_000);

    const stored = sanitize(await dbGet<unknown>(STORE_REMINDER_LOG, alert.eventId));
    expect(stored?.status).toBe("missed");

    const events = await getRecentEvents(7);
    const match = events.find((e) => e.id === alert.eventId);
    expect(match?.status).toBe("missed");
  });

  it("prunes log rows older than the retention window", async () => {
    const ancient = {
      id: "ancient:slot",
      reminderId: "r-gone",
      dueAt: new Date(at(26, 9, 0) - 40 * 86_400_000).toISOString(),
      status: "done" as const,
      resolvedAt: new Date().toISOString(),
    };
    await dbPut(STORE_REMINDER_LOG, ancient);

    await collectDueReminders(at(26, 9, 5));

    expect(await dbGet(STORE_REMINDER_LOG, "ancient:slot")).toBeUndefined();
  });
});

function sanitize(raw: unknown): { status?: string } | null {
  if (!raw || typeof raw !== "object") return null;
  return raw as { status?: string };
}
