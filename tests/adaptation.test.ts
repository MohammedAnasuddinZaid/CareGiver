import { describe, expect, it } from "vitest";
import {
  advanceStaircase,
  applyTrial,
  detectFatigue,
  difficultyLevel,
  itemDifficultyForTarget,
  learningRate,
  newAbilityState,
  newStaircase,
  olsSlope,
  outcomeScore,
  predictedSuccess,
  sigmoid,
  staircaseDifficulty,
} from "@/lib/cognition/traits";
import { gamesConfig } from "@/lib/games/config";

describe("IRT core", () => {
  it("sigmoid is the standard logistic curve", () => {
    expect(sigmoid(0)).toBeCloseTo(0.5);
    expect(sigmoid(4)).toBeGreaterThan(0.98);
    expect(sigmoid(-4)).toBeLessThan(0.02);
  });

  it("predicted success equals σ(θ − b)", () => {
    expect(predictedSuccess(1.0, 1.0)).toBeCloseTo(0.5);
    expect(predictedSuccess(2.0, 0.0)).toBeCloseTo(sigmoid(2));
  });

  it("item difficulty for target success inverts the model", () => {
    const theta = 0.7;
    const b = itemDifficultyForTarget(theta);
    expect(predictedSuccess(theta, b)).toBeCloseTo(
      gamesConfig.irt.targetSuccess,
      5,
    );
  });

  it("learning rate decays with evidence but stays positive", () => {
    expect(learningRate(0)).toBe(gamesConfig.irt.kBase);
    expect(learningRate(1000)).toBeLessThan(learningRate(10));
    expect(learningRate(100000)).toBeGreaterThan(0);
  });

  it("correct answers raise theta; failures lower it", () => {
    let state = newAbilityState("memory", "2026-01-01T00:00:00Z");
    const before = state.theta;
    state = applyTrial(state, { difficulty: 0, correct: true, rtMs: 2000, hintsUsed: 0 }, "t");
    expect(state.theta).toBeGreaterThan(before);
    expect(state.trialsSeen).toBe(1);
    const afterSuccess = state.theta;
    state = applyTrial(state, { difficulty: 0, correct: false, rtMs: 3000, hintsUsed: 0 }, "t");
    expect(state.theta).toBeLessThan(afterSuccess);
    const lowered = applyTrial(newAbilityState("memory", "t"), { difficulty: 0, correct: false, rtMs: 1000, hintsUsed: 0 }, "t");
    expect(lowered.theta).toBeLessThan(gamesConfig.irt.initialTheta);
  });

  it("theta never escapes configured clamps even after extreme streaks", () => {
    let state = newAbilityState("memory", "t");
    for (let i = 0; i < 500; i++) {
      state = applyTrial(state, { difficulty: -3, correct: true, rtMs: 500, hintsUsed: 0 }, "t");
    }
    expect(state.theta).toBeLessThanOrEqual(gamesConfig.irt.thetaMax + 1e-9);
    for (let i = 0; i < 500; i++) {
      state = applyTrial(state, { difficulty: 6, correct: false, rtMs: 500, hintsUsed: 0 }, "t");
    }
    expect(state.theta).toBeGreaterThanOrEqual(gamesConfig.irt.thetaMin - 1e-9);
  });

  it("hints reduce credit but a correct answer still teaches (errorless)", () => {
    expect(outcomeScore(true, 0)).toBe(1);
    expect(outcomeScore(true, 3)).toBeGreaterThanOrEqual(0.3);
    expect(outcomeScore(false, 0)).toBe(0);
  });

  it("EWMA of response time seeds from first observation then smooths", () => {
    let s = newAbilityState("attention", "t");
    s = applyTrial(s, { difficulty: 0, correct: true, rtMs: 1000, hintsUsed: 0 }, "t");
    expect(s.ewmaRtMs).toBe(1000);
    s = applyTrial(s, { difficulty: 0, correct: true, rtMs: 3000, hintsUsed: 0 }, "t");
    expect(s.ewmaRtMs).toBeGreaterThan(1000);
    expect(s.ewmaRtMs).toBeLessThan(3000);
  });
});

describe("within-session staircase", () => {
  it("drops difficulty immediately after two consecutive misses", () => {
    const sc = newStaircase();
    const theta = gamesConfig.irt.initialTheta;
    const start = staircaseDifficulty(sc, theta);
    advanceStaircase(sc, false);
    expect(staircaseDifficulty(sc, theta)).toBeCloseTo(start);
    advanceStaircase(sc, false);
    expect(staircaseDifficulty(sc, theta)).toBeCloseTo(start - gamesConfig.staircase.step);
  });

  it("raises after three consecutive successes", () => {
    const sc = newStaircase();
    const theta = 0;
    advanceStaircase(sc, true);
    advanceStaircase(sc, true);
    const before = staircaseDifficulty(sc, theta);
    advanceStaircase(sc, true);
    expect(staircaseDifficulty(sc, theta)).toBeCloseTo(before + gamesConfig.staircase.step);
  });

  it("a success resets the failure counter and vice versa", () => {
    const sc = newStaircase();
    advanceStaircase(sc, false);
    advanceStaircase(sc, true);
    advanceStaircase(sc, false);
    // Only one consecutive failure now → must not have dropped.
    const theta = 0;
    expect(staircaseDifficulty(sc, theta)).toBeCloseTo(theta + gamesConfig.staircase.startOffset);
  });

  it("offset is clamped to the max band around stored θ", () => {
    const sc = newStaircase();
    for (let i = 0; i < 50; i++) advanceStaircase(sc, true);
    expect(Math.abs(sc.offset)).toBeLessThanOrEqual(
      gamesConfig.staircase.maxOffsetFromTheta + 1e-9,
    );
  });
});

describe("analytics math", () => {
  it("OLS slope recovers an exact linear trend", () => {
    const slope = olsSlope([
      { x: 0, y: 1 },
      { x: 1, y: 3 },
      { x: 2, y: 5 },
    ]);
    expect(slope).toBeCloseTo(2);
  });

  it("OLS returns null on degenerate input instead of dividing by zero", () => {
    expect(olsSlope([])).toBeNull();
    expect(olsSlope([{ x: 1, y: 1 }])).toBeNull();
    expect(olsSlope([{ x: 2, y: 5 }, { x: 2, y: 7 }])).toBeNull();
  });

  it("fatigue fires when recent median RT outgrows baseline", () => {
    const baseline = [2000, 2100, 2200, 2300];
    const tired = [3400, 3600, 3800, 4000];
    const calm = [2100, 2200, 2000, 2150];
    expect(detectFatigue(tired, baseline)).toBe(true);
    expect(detectFatigue(calm, baseline)).toBe(false);
    expect(detectFatigue([100], [200])).toBe(false); // too few samples
  });

  it("difficulty level maps logits to five plain-language bands", () => {
    expect(difficultyLevel(-2)).toBe(0);
    expect(difficultyLevel(0)).toBe(2);
    expect(difficultyLevel(3)).toBe(4);
  });
});
