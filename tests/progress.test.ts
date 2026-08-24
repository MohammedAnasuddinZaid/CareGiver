import { describe, expect, it } from "vitest";
import { adherence, computeAlerts, domainTrends } from "@/lib/cognition/trends";
import type { GameSession } from "@/lib/games/types";

const NOW = Date.now();

function session(
  daysAgo: number,
  theta = 0.5,
  completion = 1,
): GameSession {
  const startedAt = new Date(NOW - daysAgo * 86_400_000).toISOString();
  return {
    id: `s-${daysAgo}-${theta}`,
    game: "faces",
    startedAt,
    endedAt: startedAt,
    trials: [],
    thetaAfter: { memory: theta },
    completion,
    endedEarly: false,
  };
}

describe("domain trends", () => {
  it("detects a rising trend", () => {
    const sessions = [
      session(14, -0.5),
      session(7, 0.0),
      session(0, 0.5),
    ];
    const trends = domainTrends(sessions);
    const memory = trends.find((t) => t.domain === "memory")!;
    expect(memory.slopePerWeek).not.toBeNull();
    expect(memory.slopePerWeek!).toBeGreaterThan(0);
  });

  it("returns null slope when there is no data", () => {
    const trends = domainTrends([]);
    for (const t of trends) {
      expect(t.slopePerWeek).toBeNull();
      expect(t.points).toHaveLength(0);
    }
  });

  it("buckets multiple same-day sessions into one daily mean", () => {
    const trends = domainTrends([session(0, 0.2), session(0, 0.6)]);
    const memory = trends.find((t) => t.domain === "memory")!;
    expect(memory.points).toHaveLength(1);
    expect(memory.points[0].y).toBeCloseTo(0.4);
  });
});

describe("adherence + alerts", () => {
  it("counts sessions and active days in the last week only", () => {
    const sessions = [
      session(0),
      session(1),
      session(1),
      session(30), // outside the window
    ];
    const a = adherence(sessions);
    expect(a.sessionsLast7Days).toBe(3);
    expect(a.activeDaysLast7Days).toBe(2);
  });

  it("raises an inactivity alert after three quiet days", () => {
    const alerts = computeAlerts([session(10)], 0);
    expect(alerts.some((a) => a.kind === "inactivity")).toBe(true);
  });

  it("stays calm with healthy recent activity and stable trends", () => {
    const sessions = Array.from({ length: 8 }, (_, i) => session(i, 0.5));
    const alerts = computeAlerts(sessions, 0);
    // No decline (flat), no abandonment, active — nothing serious expected.
    expect(alerts.filter((a) => a.severity !== "info")).toHaveLength(0);
  });

  it("flags sustained decline as urgent when slope is steeply negative", () => {
    const sessions = Array.from({ length: 12 }, (_, i) =>
      session(11 - i, 0.5 - i * 0.09),
    );
    const alerts = computeAlerts(sessions, 0);
    const decline = alerts.find((a) => a.kind === "decline");
    expect(decline).toBeDefined();
  });

  it("flags consecutive abandoned sessions", () => {
    const sessions = [session(2, 0, 0.2), session(1, 0, 0.3)];
    const alerts = computeAlerts(sessions, 0);
    expect(alerts.some((a) => a.kind === "abandon")).toBe(true);
  });
});
