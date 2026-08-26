import { describe, expect, it } from "vitest";
import {
  detectFatigue,
  itemDifficultyForTarget,
  itemInformation,
  medianAbsoluteDeviation,
  predictedSuccess,
  thetaStandardError,
} from "@/lib/cognition/traits";

describe("Fisher-information measurement precision", () => {
  it("item information peaks when difficulty matches ability", () => {
    const theta = 0.8;
    const atMatch = itemInformation(theta, 0.8);
    const tooEasy = itemInformation(theta, -3);
    const tooHard = itemInformation(theta, 4);
    expect(atMatch).toBeGreaterThan(tooEasy);
    expect(atMatch).toBeGreaterThan(tooHard);
    expect(atMatch).toBeCloseTo(0.25, 10); // max of p(1−p) at p=0.5
    expect(itemInformation(theta, 99)).toBeCloseTo(0, 10);
  });

  it("standard error shrinks as evidence accumulates", () => {
    // Items targeted near θ (what the scheduler aims for) carry ~max info.
    const target = itemDifficultyForTarget(0.5); // ≈ θ − logit(0.7)
    const one = thetaStandardError(0.5, [target]);
    const five = thetaStandardError(0.5, [target, target, target, target, target]);
    expect(one).not.toBeNull();
    expect(five).not.toBeNull();
    expect(five!).toBeCloseTo(one! / Math.sqrt(5), 10); // SE ∝ 1/√n
  });

  it("returns null instead of fake precision with no informative items", () => {
    expect(thetaStandardError(0, [])).toBeNull();
    // Perfectly-easy items carry zero information at high θ.
    expect(thetaStandardError(6, [99, 99])).toBeNull();
  });

  it("predicted success follows the logistic model", () => {
    expect(predictedSuccess(0, 0)).toBeCloseTo(0.5, 12);
    expect(predictedSuccess(2, -2)).toBeGreaterThan(0.9);
    expect(predictedSuccess(-2, 2)).toBeLessThan(0.1);
  });
});

describe("robust statistics + fatigue scatter signal", () => {
  it("MAD resists outliers", () => {
    const steady = [2000, 2010, 1990, 2005];
    const withOutlier = [...steady, 90_000];
    expect(medianAbsoluteDeviation(withOutlier)).toBeLessThan(
      medianAbsoluteDeviation(steady) * 20,
    );
  });

  it("fatigue fires on erratic timing even when speed holds", () => {
    const baseline = [1900, 2000, 2100, 2200]; // median 2050, MAD 100
    // Same median (~2100) but wildly unstable responses.
    const erratic = [1500, 2700, 1600, 2600];
    expect(detectFatigue(erratic, baseline)).toBe(true);
  });

  it("healthy variability never triggers fatigue", () => {
    const baseline = [1900, 2000, 2100, 2200];
    const calm = [2050, 2150, 1950, 2250];
    expect(detectFatigue(calm, baseline)).toBe(false);
  });
});
