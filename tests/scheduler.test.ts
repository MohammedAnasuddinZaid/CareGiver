import { describe, expect, it } from "vitest";
import { prescribeDailySession, hoursSince } from "@/lib/games/adaptation";
import type { AbilityStateLike } from "@/lib/games/adaptation";
import { GAME_META } from "@/lib/games/types";

const NOW = Date.parse("2026-08-24T10:00:00Z");

function iso(hoursAgo: number): string {
  return new Date(NOW - hoursAgo * 3_600_000).toISOString();
}

describe("daily session prescriber", () => {
  it("returns the configured number of games with reasons", () => {
    const p = prescribeDailySession([], [], NOW);
    expect(p.games.length).toBeGreaterThanOrEqual(3);
    for (const g of p.games) {
      expect(p.reasons[g]).toBeTruthy();
    }
  });

  it("never repeats a game in one plan", () => {
    const p = prescribeDailySession([], [], NOW);
    expect(new Set(p.games).size).toBe(p.games.length);
  });

  it("avoids games played inside the cooldown window", () => {
    const recent = ["faces", "market", "routine"].map((game) => ({
      game: game as keyof typeof GAME_META,
      startedAt: iso(2), // played 2h ago — well inside 20h cooldown
    }));
    const p = prescribeDailySession([], recent, NOW);
    expect(p.games).not.toContain("faces");
    expect(p.games).not.toContain("market");
  });

  it("prefers domains where ability is below average", () => {
    const abilities: AbilityStateLike[] = [
      { domain: "attention", theta: -1.8 }, // clearly weakest
      { domain: "memory", theta: 1.5 },
      { domain: "executive", theta: 1.4 },
      { domain: "working", theta: 1.3 },
      { domain: "spatial", theta: 1.2 },
    ];
    const p = prescribeDailySession(abilities, [], NOW);
    // The top pick must train the weakest domain (attention). Several
    // attention-primary games exist, so assert the domain — not one title.
    expect(GAME_META[p.games[0]].domain).toBe("attention");
  });

  it("is deterministic for identical inputs", () => {
    const a = prescribeDailySession(
      [{ domain: "memory", theta: -0.5 }],
      [{ game: "drums" as const, startedAt: iso(30) }],
      NOW,
    );
    const b = prescribeDailySession(
      [{ domain: "memory", theta: -0.5 }],
      [{ game: "drums" as const, startedAt: iso(30) }],
      NOW,
    );
    expect(a.games).toEqual(b.games);
  });

  it("treats never-played games as fresh (7-day idle)", () => {
    const played = (["faces", "market", "routine", "loom"] as const).map((game) => ({
      game,
      startedAt: iso(25),
    }));
    const p = prescribeDailySession([], played, NOW);
    // Never-played games carry a 7-day recency bonus, so with a library
    // this size today's plan should contain none of the stale titles.
    for (const g of p.games) {
      expect(played.map((x) => x.game)).not.toContain(g);
    }
  });
});

describe("hoursSince", () => {
  it("computes positive hours into the past", () => {
    expect(hoursSince(iso(5), NOW)).toBeCloseTo(5);
  });
  it("returns +Infinity on corrupt dates instead of NaN-poisoning scores", () => {
    expect(hoursSince("not-a-date", NOW)).toBe(Number.POSITIVE_INFINITY);
  });
});
