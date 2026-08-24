import { describe, expect, it } from "vitest";
import { GAME_IDS, GAME_META, SKILL_DOMAINS, type GameId } from "@/lib/games/types";
import { prescribeDailySession } from "@/lib/games/adaptation";
import {
  GAME_CATEGORIES,
  GAME_ICONS,
  GAME_ROUTES,
  GAME_TITLES,
} from "@/components/games/game-meta";

/**
 * The play hub, scheduler and host route all derive from the same
 * GameId union — these tests keep the three registries in lockstep.
 */
describe("game registry consistency", () => {
  it("every game id has meta, icon, route and title", () => {
    for (const id of GAME_IDS) {
      expect(GAME_META[id], `meta missing for ${id}`).toBeDefined();
      expect(GAME_ICONS[id], `icon missing for ${id}`).toBeDefined();
      expect(GAME_ROUTES[id], `route missing for ${id}`).toBe(`/play/${id}`);
      expect(GAME_TITLES[id]?.length ?? 0, `title missing for ${id}`).toBeGreaterThan(3);
    }
  });

  it("every game's primary domain is a valid skill domain", () => {
    for (const id of GAME_IDS) {
      expect(SKILL_DOMAINS).toContain(GAME_META[id].domain);
      for (const s of GAME_META[id].secondaryDomains) {
        expect(SKILL_DOMAINS).toContain(s);
        expect(s).not.toBe(GAME_META[id].domain); // secondary ≠ primary
      }
    }
  });

  it("every game belongs to exactly one hub category that exists", () => {
    const validIds = new Set(GAME_CATEGORIES.map((c) => c.id));
    for (const id of GAME_IDS) {
      expect(validIds.has(GAME_META[id].category), `${id} has unknown category`).toBe(true);
    }
    // And every category hosts at least one game.
    const used = new Set(Object.values(GAME_META).map((m) => m.category));
    expect(used.size).toBe(GAME_CATEGORIES.length);
  });

  it("the daily prescriber can draw from the FULL library (≥10 games)", () => {
    // Regression: adding games without extending the scheduler pool made
    // new titles unprescribable. Over 40 simulated days the rotating
    // fairness tiebreak must surface nearly the whole library even with
    // zero ability data.
    const seen = new Set<GameId>();
    for (let i = 0; i < 40; i++) {
      for (const g of prescribeDailySession([], [], 1_787_000_000_000 + i * 86_400_000).games) {
        seen.add(g);
      }
    }
    expect(seen.size).toBeGreaterThanOrEqual(10);
  });
});
