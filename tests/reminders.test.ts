import { describe, expect, it } from "vitest";
import {
  minutesOfDay,
  nextDueAt,
  sanitizeReminder,
  eventIdFor,
} from "@/lib/storage/reminders";
import type { Reminder } from "@/lib/games/types";

function makeReminder(patch: Partial<Reminder> = {}): Reminder {
  return {
    id: "r1",
    kind: "medicine",
    title: "Morning tablet",
    time: "08:30",
    days: [0, 1, 2, 3, 4, 5, 6],
    enabled: true,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...patch,
  };
}

describe("reminder sanitization", () => {
  it("accepts well-formed reminders", () => {
    const r = sanitizeReminder(makeReminder());
    expect(r).not.toBeNull();
    expect(r!.time).toBe("08:30");
  });

  it("rejects missing id/title/kind and malformed times without a date", () => {
    expect(sanitizeReminder(null)).toBeNull();
    expect(sanitizeReminder({})).toBeNull();
    expect(sanitizeReminder(makeReminder({ title: "  " }))).toBeNull();
    expect(sanitizeReminder(makeReminder({ kind: "nope" as never }))).toBeNull();
    expect(sanitizeReminder(makeReminder({ time: "25:99" }))).toBeNull();
  });

  it("clamps day lists and defaults to all days", () => {
    const r = sanitizeReminder(makeReminder({ days: [9, -1, 3, 3] as never }));
    expect(r!.days).toEqual([3]);
    const r2 = sanitizeReminder(makeReminder({ days: [] }));
    expect(r2!.days).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });
});

describe("scheduling math", () => {
  it("minutesOfDay parses HH:MM", () => {
    expect(minutesOfDay("08:30")).toBe(510);
    expect(minutesOfDay("00:00")).toBe(0);
    expect(minutesOfDay("23:59")).toBe(1439);
    expect(minutesOfDay("bogus")).toBe(540); // safe fallback 09:00
  });

  it("daily reminder is due at its local time each configured day", () => {
    // 2026-08-24 is a Monday.
    const afterMs = new Date(2026, 7, 24, 7, 0, 0).getTime(); // 07:00 local
    const due = nextDueAt(makeReminder({ time: "08:30" }), afterMs);
    expect(due).not.toBeNull();
    const d = new Date(due!);
    expect(d.getHours()).toBe(8);
    expect(d.getMinutes()).toBe(30);
    expect(d.getDate()).toBe(24);
  });

  it("respects day-of-week filters", () => {
    const mondayOnly = makeReminder({ days: [1] }); // Monday only
    const sundayNight = new Date(2026, 7, 23, 20, 0, 0).getTime();
    const due = nextDueAt(mondayOnly, sundayNight);
    const d = new Date(due!);
    expect(d.getDay()).toBe(1);
    expect(d.getDate()).toBe(24);
  });

  it("disabled reminders are never due", () => {
    expect(nextDueAt(makeReminder({ enabled: false }))).toBeNull();
  });

  it("one-shot reminders fire on their date then expire", () => {
    const once = makeReminder({
      onceOn: "2026-09-01",
      time: "10:00",
      days: [0, 1, 2, 3, 4, 5, 6],
    });
    const before = new Date(2026, 7, 31, 12, 0).getTime();
    const onDay = new Date(2026, 8, 1, 9, 0).getTime();
    const late = new Date(2026, 8, 3, 12, 0).getTime();
    expect(nextDueAt(once, before)).not.toBeNull();
    expect(nextDueAt(once, onDay)).not.toBeNull();
    expect(nextDueAt(once, late)).toBeNull();
  });

  it("event ids are unique per minute-slot (idempotent firing)", () => {
    const r = makeReminder();
    const t = Date.parse("2026-08-24T08:30:00Z");
    expect(eventIdFor(r, t)).toBe(eventIdFor(r, t));
    expect(eventIdFor(r, t)).not.toBe(eventIdFor(r, t + 60_000));
  });
});
