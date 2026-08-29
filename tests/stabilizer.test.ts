import { describe, expect, it } from "vitest";
import { IdentityStabilizer } from "@/lib/recognition/stabilizer";
import { recognitionConfig } from "@/lib/recognition/config";
import { steadyStateWeight } from "@/lib/recognition/descriptor-memory";

const cfg = recognitionConfig;
const T = cfg.temporal;
const STEP = recognitionConfig.sampleIntervalMs; // true period, inference included

/** Feed observations at a fixed cadence; return all outputs. */
function feed(
  s: IdentityStabilizer,
  obs: ({ id: string } | "unknown" | null)[],
  start = 1000,
) {
  const out: { kind: string; personId: string | null }[] = [];
  let t = start;
  for (const o of obs) {
    const input =
      o === "unknown" || o === null
        ? { personId: null, confidence: 0 }
        : { personId: o.id, confidence: 0.95 };
    const r = s.observe(input, t);
    out.push(r);
    t += STEP;
  }
  return { out, end: t };
}

describe("IdentityStabilizer — reachability (regression guard)", () => {
  it("evidence ceiling EXCEEDS the enter threshold even on slow devices", () => {
    // Regression: the original constants (enter 2.15, tau 650) had a
    // discrete-time ceiling of c/(1−e^(−Δt/τ)) that sat BELOW the enter
    // threshold for any realistic cycle ≥ ~350 ms — the engine could never
    // recognize anyone. This test pins reachability at a pessimistic
    // 500 ms full-cycle cadence (weak laptop / CPU backend).
    const cycle = Math.max(recognitionConfig.sampleIntervalMs, 500);
    const ceiling = steadyStateWeight(0.999, cycle, T.tauMs);
    expect(ceiling).toBeGreaterThan(T.enterWeight);
  });

  it("a typical strong match locks within two frames (~520 ms)", () => {
    const s = new IdentityStabilizer(cfg);
    let t = 1000;
    const r1 = s.observe({ personId: "mom", confidence: 0.86 }, t);
    const r2 = s.observe({ personId: "mom", confidence: 0.86 }, t + STEP);
    expect(r1.kind).toBe("identifying");
    expect(r2.kind).toBe("recognized");
    expect(r2.personId).toBe("mom");
  });
});

describe("IdentityStabilizer — decayed evidence + hysteresis", () => {
  it("does NOT lock on the first agreeing frame alone", () => {
    const s = new IdentityStabilizer(cfg);
    const { out } = feed(s, [{ id: "mom" }, { id: "mom" }, { id: "mom" }, { id: "mom" }]);
    expect(out[0].kind).toBe("identifying");
    expect(out[out.length - 1].kind).toBe("recognized");
    expect(out[out.length - 1].personId).toBe("mom");
  });

  it("rides through brief unmatched frames while weight is inside the hysteresis band", () => {
    const s = new IdentityStabilizer(cfg);
    const { out, end } = feed(s, [
      { id: "mom" },
      { id: "mom" },
      { id: "mom" },
      { id: "mom" },
      { id: "mom" },
    ]);
    expect(out[out.length - 1].kind).toBe("recognized");

    // Two consecutive unknowns — evidence decays but stays above exitWeight.
    const r1 = s.observe({ personId: null, confidence: 0 }, end);
    const r2 = s.observe({ personId: null, confidence: 0 }, end + STEP);
    expect(r1.kind).toBe("recognized");
    expect(r2.kind).toBe("recognized");
  });

  it("releases the identity once evidence decays below exitWeight", () => {
    const s = new IdentityStabilizer(cfg);
    const { end } = feed(s, [{ id: "mom" }, { id: "mom" }, { id: "mom" }, { id: "mom" }]);
    let t = end;
    let r = s.observe({ personId: null, confidence: 0 }, t);
    let guard = 0;
    while (r.kind === "recognized" && guard++ < 20) {
      t += STEP;
      r = s.observe({ personId: null, confidence: 0 }, t);
    }
    expect(r.kind === "unknown" || r.kind === "identifying").toBe(true);
    // And unknown is debounced, not instant.
    expect(r.kind).toBe("identifying");
  });

  it("weak-confidence matches accumulate slowly (borderline faces stay unidentified longer)", () => {
    const strong = new IdentityStabilizer(cfg);
    const weak = new IdentityStabilizer(cfg);
    let ts = 1000;
    for (let i = 0; i < 3; i++) {
      strong.observe({ personId: "mom", confidence: 0.95 }, ts);
      weak.observe({ personId: "mom", confidence: 0.30 }, ts);
      ts += STEP;
    }
    const rs = strong.observe({ personId: "mom", confidence: 0.95 }, ts);
    // Strong evidence should already have crossed enterWeight or be very close,
    // weak evidence (0.30) must not be stable yet with enterWeight = 1.1.
    const rw = weak.observe({ personId: "mom", confidence: 0.30 }, ts);
    expect(rs.kind === "recognized" || rs.kind === "identifying").toBe(true);
    expect(rw.kind).toBe("identifying");
  });

  it("requires a NEW person to independently satisfy the enter criterion before switching", () => {
    const s = new IdentityStabilizer(cfg);
    const { end } = feed(s, [
      { id: "mom" },
      { id: "mom" },
      { id: "mom" },
      { id: "mom" },
      { id: "mom" },
    ]);
    // Dad appears far later than any hold window.
    const { out } = feed(s, [
      { id: "dad" },
      { id: "dad" },
      { id: "dad" },
      { id: "dad" },
      { id: "dad" },
    ], end + 10_000);
    const dadFrame = out.findIndex((r) => r.kind === "recognized" && r.personId === "dad");
    expect(dadFrame).toBeGreaterThanOrEqual(1); // needs his own evidence, never instant
    for (const r of out.slice(0, dadFrame)) {
      expect(r.personId).not.toBe("dad");
    }
    expect(out[out.length - 1]).toEqual({ kind: "recognized", personId: "dad" });
  });

  it("holds a recognized identity through no-face gaps up to identityHoldMs", () => {
    const s = new IdentityStabilizer(cfg);
    const { end } = feed(s, [{ id: "mom" }, { id: "mom" }, { id: "mom" }, { id: "mom" }]);
    const duringHold = s.observeNoFace(end + T.identityHoldMs - STEP);
    expect(duringHold).toEqual({ kind: "recognized", personId: "mom" });
    const afterHold = s.observeNoFace(end + T.identityHoldMs + 50);
    expect(afterHold.kind).toBe("identifying");
  });

  it("debounces unknown so one bad frame never offends anyone", () => {
    const s = new IdentityStabilizer(cfg);
    let r = s.observe({ personId: null, confidence: 0 }, 0);
    expect(r.kind).toBe("identifying");
    for (let t = STEP; t <= T.unknownDebounceMs + 200; t += STEP) {
      r = s.observe({ personId: null, confidence: 0 }, t);
    }
    expect(r.kind).toBe("unknown");
  });

  it("reset clears everything", () => {
    const s = new IdentityStabilizer(cfg);
    feed(s, [{ id: "mom" }, { id: "mom" }, { id: "mom" }, { id: "mom" }]);
    s.reset();
    expect(s.observeNoFace(999_999)).toEqual({ kind: "identifying", personId: null });
    expect(s.snapshot(999_999)).toHaveLength(0);
  });

  it("snapshot exposes decayed weights for diagnostics", () => {
    const s = new IdentityStabilizer(cfg);
    feed(s, [{ id: "mom" }, { id: "mom" }]);
    const snap = s.snapshot(1000 + 2 * STEP);
    expect(snap).toHaveLength(1);
    expect(snap[0].personId).toBe("mom");
    expect(snap[0].weight).toBeGreaterThan(0);
  });
});
