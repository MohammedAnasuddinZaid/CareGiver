import { describe, expect, it } from "vitest";
import { emptyProfile } from "@/lib/ai/store";
import { respond, routeTip } from "@/lib/ai/model";
import type { MemoryRecall } from "@/lib/ai/model";
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

describe("long-term memory recall in replies", () => {
  const mem: MemoryRecall = {
    facts: [
      { key: "name", value: "Anas", ts: 1 },
      { key: "interest", value: "music", ts: 2 },
    ],
    chats: [{ id: 1, role: "user", text: "i am Anas", ts: 1 }],
  };

  it("greets using the remembered name from memory", () => {
    const { reply } = respond({ message: "hello" }, emptyProfile(), undefined, mem);
    expect(reply.text).toContain("Anas");
  });

  it("uses the remembered name even when localStorage profile has none", () => {
    const { reply } = respond({ message: "i feel sad today" }, emptyProfile(), undefined, mem);
    expect(reply.text).toContain("Anas");
  });

  it("mentions a remembered interest in the fallback", () => {
    const { reply } = respond({ message: "nothing much" }, emptyProfile(), undefined, mem);
    expect(reply.text.toLowerCase()).toContain("music");
  });

  it("lists remembered facts for 'what do you remember about me'", () => {
    const { reply } = respond(
      { message: "what do you remember about me" },
      emptyProfile(),
      undefined,
      mem,
    );
    expect(reply.text).toContain("Anas");
    expect(reply.text).toContain("music");
  });

  it("asks to learn when there are no facts yet", () => {
    const { reply } = respond({ message: "what do you remember" }, emptyProfile(), undefined, {
      facts: [],
      chats: [],
    });
    expect(reply.text.toLowerCase()).toContain("still getting to know");
  });

  it("calls the remembered name on every emotional intent", () => {
    const { reply } = respond({ message: "goodnight" }, emptyProfile(), undefined, mem);
    expect(reply.text).toContain("Anas");
  });

  it("prefers the memory name over a profile name", () => {
    const { reply } = respond(
      { message: "hello" },
      { ...emptyProfile(), name: "Sam" },
      undefined,
      mem,
    );
    expect(reply.text).toContain("Anas");
    expect(reply.text).not.toContain(", Sam");
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

describe("empathetic simple questions", () => {
  it("reassures someone who can't remember", () => {
    const { reply } = respond({ message: "I don't remember things, help me" }, emptyProfile(), ctx());
    expect(reply.tone).toBe("calm");
    expect(reply.text.toLowerCase()).toContain("forgetting");
    expect(reply.suggestGame).toBe("memorylane");
  });

  it("helps when someone just says they are feeling off", () => {
    const { reply } = respond({ message: "I am feeling now help me" }, emptyProfile(), ctx());
    expect(reply.tone).toBe("empathize");
    expect(reply.text.toLowerCase()).toContain("thank you for telling me");
  });

  it("soothes sadness without ever sounding clinical", () => {
    const { reply } = respond({ message: "i feel so sad today" }, emptyProfile(), ctx());
    expect(reply.tone).toBe("empathize");
    expect(reply.text).toContain("not alone");
    expect(reply.suggestGame).toBe("faces");
  });

  it("meets anger with compassion instead of instructions", () => {
    const { reply } = respond({ message: "i am angry right now" }, emptyProfile(), ctx());
    expect(reply.tone).toBe("empathize");
    expect(reply.text.toLowerCase()).toContain("okay");
  });

  it("is warm for a bare feeling with no label", () => {
    const { reply } = respond({ message: "I feel weird today" }, emptyProfile(), ctx());
    expect(reply.tone).toBe("empathize");
    expect(reply.text.toLowerCase()).toContain("right here with you");
  });

  it("cheers someone up on request", () => {
    const { reply } = respond({ message: "cheer me up" }, emptyProfile(), ctx());
    expect(reply.text.toLowerCase()).toContain("braver");
    expect(reply.suggestGame).toBe("faces");
  });

  it("answers who-are-you simply and honestly", () => {
    const { reply } = respond({ message: "are you a robot?" }, emptyProfile(), ctx());
    expect(reply.tone).toBe("greet");
    expect(reply.text.toLowerCase()).toContain("device");
  });

  it("celebrates a win", () => {
    const { reply } = respond({ message: "i won the game!" }, emptyProfile(), ctx());
    expect(reply.tone).toBe("celebrate");
    expect(reply.text.toLowerCase()).toContain("proud");
  });

  it("celebrates when no game is mentioned", () => {
    const { reply } = respond({ message: "i enjoyed talking to you" }, emptyProfile(), ctx());
    expect(reply.tone).toBe("celebrate");
  });

  it("classifies a memory lapse", () => {
    expect(bestDoc("i can't remember where i put my keys")?.id).toBe("memory-lapse");
  });

  it("recognises an unlabelled feeling", () => {
    expect(bestDoc("i am feeling ready to talk")?.id).toBe("i-feel");
  });
});