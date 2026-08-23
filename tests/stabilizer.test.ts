import { describe, expect, it } from "vitest";
import { IdentityStabilizer } from "@/lib/recognition/stabilizer";
import { recognitionConfig } from "@/lib/recognition/config";

const cfg = recognitionConfig;

function run(stabilizer: IdentityStabilizer, observations: (string | "unknown")[], start = 1000) {
  const results = [];
  let t = start;
  for (const o of observations) {
    results.push(stabilizer.observe(o, t));
    t += 200;
  }
  return { results, end: t };
}

describe("IdentityStabilizer — temporal smoothing", () => {
  it("stabilizes after enough agreeing frames", () => {
    const s = new IdentityStabilizer(cfg);
    // stableVotes = 5 of the last bufferLength = 8
    const { results } = run(s, ["mom", "mom", "mom", "mom", "mom"]);
    expect(results[2].kind).toBe("identifying");
    expect(results[3].kind).toBe("identifying");
    expect(results[4]).toEqual({ kind: "recognized", personId: "mom" });
  });

  it("survives an occasional unknown frame once stable", () => {
    const s = new IdentityStabilizer(cfg);
    const { results, end } = run(s, ["mom", "mom", "mom", "mom", "mom"]);
    expect(results[results.length - 1].kind).toBe("recognized");
    const r = s.observe("unknown", end + 200);
    expect(r).toEqual({ kind: "recognized", personId: "mom" });
  });

  it("does NOT stabilize a mixed stream of people", () => {
    const s = new IdentityStabilizer(cfg);
    const { results } = run(s, [
      "mom",
      "dad",
      "mom",
      "dad",
      "unknown",
      "dad",
      "mom",
      "unknown",
    ]);
    for (const r of results) {
      expect(r.kind === "recognized" ? r.personId : null).not.toBe("dad");
      expect(r.kind === "recognized" ? r.personId : null).not.toBe("mom");
    }
  });

  it("requires the new person to win independently before switching", () => {
    const s = new IdentityStabilizer(cfg);
    run(s, ["mom", "mom", "mom", "mom", "mom"]);
    // Dad appears far later than the hold window.
    const { results } = run(s, ["dad", "dad", "dad", "dad", "dad"], 20_000);
    const dadFrame = results.findIndex(
      (r) => r.kind === "recognized" && r.personId === "dad",
    );
    expect(dadFrame).toBeGreaterThanOrEqual(0);
    // Before Dad independently wins, Dad must NEVER be shown —
    // holding the previous identity is safer than flashing a switch.
    for (const r of results.slice(0, dadFrame)) {
      expect(r.personId).not.toBe("dad");
    }
    expect(results[results.length - 1]).toEqual({ kind: "recognized", personId: "dad" });
  });

  it("holds a recognized identity briefly when the face disappears", () => {
    const s = new IdentityStabilizer(cfg);
    const { end } = run(s, ["mom", "mom", "mom", "mom", "mom"]);
    const duringHold = s.observeNoFace(end + 500);
    expect(duringHold).toEqual({ kind: "recognized", personId: "mom" });
    const afterHold = s.observeNoFace(end + cfg.identityHoldMs + 10);
    expect(afterHold.kind).toBe("identifying");
  });

  it("debounces the unknown state so one bad frame never offends anyone", () => {
    const s = new IdentityStabilizer(cfg);
    let result = s.observe("unknown", 0);
    expect(result.kind).toBe("identifying");
    for (let t = 250; t <= 800; t += 250) {
      result = s.observe("unknown", t);
    }
    expect(result.kind).toBe("unknown");
  });

  it("reset clears everything", () => {
    const s = new IdentityStabilizer(cfg);
    run(s, ["mom", "mom", "mom", "mom", "mom"]);
    s.reset();
    expect(s.observeNoFace(99999).kind).toBe("identifying");
  });
});
