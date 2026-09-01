import { describe, expect, it } from "vitest";
import { emptyProfile } from "@/lib/ai/store";
import { respond, routeTip } from "@/lib/ai/model";
import { bestDoc } from "@/lib/ai/knowledge";
import { GAME_TITLES } from "@/components/games/game-meta";
import { type DeviceContext } from "@/lib/ai/context";

function ctx(overrides: Partial<DeviceContext> = {}): DeviceContext {
  return {
    ready: true,
    people: { total: 0, recognized: 0, names: [] },
    reminders: { total: 0, enabled: 0, titles: [], nextFew: [] },
    progress: {
      gamesPlayed: 0,
      uniqueGames: 0,
      totalSessions: 0,
      recentGames: [],
      totalTrials: 0,
      suggestedGameIds: [],
      strengthDomain: null,
      byGame: [],
      accuracy: null,
      domains: [],
    },
    settings: {
      voiceEnabled: true,
      sensitivity: "balanced",
      theme: "light",
      recognitionEnabled: true,
      gameCoach: true,
    },
    ...overrides,
  };
}

const c = ctx({
  people: { total: 2, recognized: 2, names: ["Ama", "Ravi"] },
  reminders: {
    total: 2,
    enabled: 2,
    titles: ["Morning pills", "Walk"],
    nextFew: [
      { title: "Morning pills", time: "09:00" },
      { title: "Walk", time: "17:30" },
    ],
  },
  progress: {
    gamesPlayed: 3,
    uniqueGames: 2,
    totalSessions: 3,
    recentGames: ["Memory", "Same Face"],
    totalTrials: 12,
    suggestedGameIds: ["faces", "pairs"],
    strengthDomain: "memory",
    byGame: [
      { id: "faces", title: "Memory", sessions: 2, lastPlayedAt: 10 },
      { id: "pairs", title: "Same Face", sessions: 1, lastPlayedAt: 5 },
    ],
    accuracy: 0.75,
    domains: [
      { domain: "memory", sessions: 2, trials: 8, accuracy: 0.75, trend: "improving" },
      { domain: "working", sessions: 1, trials: 4, accuracy: 0.75, trend: "early" },
    ],
  },
});

describe("CareGiver assistant on /assistant", () => {
  it("plans the day from live reminders and suggestions", () => {
    const { reply } = respond({ message: "Plan my day", route: "/assistant" }, emptyProfile(), c);
    expect(reply.text).toContain("Morning pills at 09:00");
    expect(reply.text).toContain("Walk at 17:30");
    expect(reply.text.toLowerCase()).toContain("easy");
    expect(reply.suggestGame).toBe("faces");
    expect(reply.quick).toHaveLength(3);
  });

  it("reads reports with per-game tally and strongest area", () => {
    const { reply } = respond({ message: "Read my reports", route: "/assistant" }, emptyProfile(), c);
    expect(reply.text).toContain("3 completed sessions");
    expect(reply.text).toContain("Memory (2×)");
    expect(reply.text).toContain("Remembering people & moments");
    expect(reply.tone).toBe("coach");
  });

  it("answers am-I-improving with a supportive real analysis", () => {
    const { reply } = respond({ message: "Am I improving?", route: "/assistant" }, emptyProfile(), c);
    expect(reply.text).toContain("75%");
    expect(reply.text).toContain("Remembering people & moments");
    expect(reply.text).toContain("clearly improving");
    expect(reply.suggestGame).toBe("faces");
  });

  it("suggests a game based on least-practiced areas", () => {
    const { reply } = respond({ message: "Suggest a game for me", route: "/assistant" }, emptyProfile(), c);
    expect(reply.text).toContain(GAME_TITLES.faces);
    expect(reply.text).toContain(GAME_TITLES.pairs);
    expect(reply.suggestGame).toBe("faces");
  });

  it("answers people questions from live data", () => {
    const { reply } = respond({ message: "Who do I know?", route: "/assistant" }, emptyProfile(), c);
    expect(reply.text).toContain("Ama");
    expect(reply.text).toContain("Ravi");
    expect(reply.suggestGame).toBe("faces");
  });

  it("falls back gently when there is no data yet", () => {
    const { reply } = respond({ message: "Read my reports", route: "/assistant" }, emptyProfile(), ctx());
    expect(reply.text).toContain("no completed sessions");
  });

  it("welcomes with the assistant home tip", () => {
    expect(routeTip("/assistant", emptyProfile()).text).toContain("plan your day");
  });
});

describe("knowledge base personal intents", () => {
  it("classifies plan questions", () => {
    expect(bestDoc("today's plan")?.personal).toBe("plan");
  });
  it("classifies report questions", () => {
    expect(bestDoc("can you read my report?")?.personal).toBe("reports");
  });
  it("classifies game-suggestion questions", () => {
    expect(bestDoc("suggest a game for me")?.id).toBe("suggest-game");
  });
  it("classifies improving questions", () => {
    expect(bestDoc("am i improving?")?.personal).toBe("improving");
  });
});

describe("extended knowledge base", () => {
  it("points to the right games for an area", () => {
    expect(bestDoc("which game helps memory")?.id).toBe("area-guide");
  });
  it("advises on session length", () => {
    expect(bestDoc("how long should i play?")?.id).toBe("how-much-play");
  });
  it("holds the line on medical claims", () => {
    expect(bestDoc("does it cure dementia?")?.id).toBe("medical-disclaimer");
  });
  it("recommends a doctor for new symptoms", () => {
    expect(bestDoc("when to see a doctor?")?.id).toBe("see-doctor");
  });
  it("reassures that no account is needed", () => {
    expect(bestDoc("do i need an account?")?.id).toBe("no-account");
  });
  it("explains the condition gently", () => {
    expect(bestDoc("what is dementia?")?.id).toBe("what-is-dementia");
  });
});