import { describe, expect, it } from "vitest";
import {
  confidenceFromDistance,
  cosineSimilarity,
  l2Normalize,
  normalizedEuclidean,
  sigmoid,
} from "@/lib/recognition/metrics";

function vec(seed: number, magnitude = 1): number[] {
  return Array.from({ length: 128 }, (_, i) => {
    const v = Math.sin(seed * 12.9898 + i * 78.233) * 43758.5453;
    return ((v - Math.floor(v)) * 2 - 1) * magnitude;
  });
}

describe("L2 normalization", () => {
  it("produces unit-length vectors", () => {
    const n = l2Normalize(vec(3, 7));
    expect(n).not.toBeNull();
    const norm = Math.sqrt(n!.reduce((s, x) => s + x * x, 0));
    expect(norm).toBeCloseTo(1, 10);
  });

  it("preserves direction (cosine with original ≈ 1)", () => {
    const v = vec(4);
    const n = l2Normalize(v)!;
    expect(cosineSimilarity(v, n)).toBeCloseTo(1, 8);
  });

  it("rejects zero and non-finite vectors — no directional information", () => {
    expect(l2Normalize(new Array(128).fill(0))).toBeNull();
    const nanVec = vec(5);
    nanVec[0] = NaN;
    expect(l2Normalize(nanVec)).toBeNull();
    expect(l2Normalize([1, 2, 3])).toBeNull();
  });
});

describe("cosine similarity & normalized distance", () => {
  it("is +1 for identical vectors, -1 for opposite, ~0 for orthogonal-ish", () => {
    const a = vec(11);
    expect(cosineSimilarity(a, a)).toBeCloseTo(1, 10);
    expect(cosineSimilarity(a, a.map((x) => -x))).toBeCloseTo(-1, 10);
    // Two independent random 128-d vectors are near-orthogonal.
    expect(Math.abs(cosineSimilarity(vec(12), vec(13)))).toBeLessThan(0.25);
  });

  it("obeys d² = 2 − 2·cos θ on the unit sphere", () => {
    const a = vec(14);
    const b = vec(15);
    const d = normalizedEuclidean(a, b);
    const cos = cosineSimilarity(a, b);
    expect(d).toBeCloseTo(Math.sqrt(Math.max(0, 2 - 2 * cos)), 10);
    // Random high-dimensional pairs are far apart — well above any sane threshold.
    expect(d).toBeGreaterThan(1.3);
  });

  it("identical descriptors sit at distance zero regardless of magnitude", () => {
    const a = vec(16, 0.001);
    expect(normalizedEuclidean(a, a)).toBeCloseTo(0, 12);
  });
});

describe("logistic confidence calibration", () => {
  it("maps the decision threshold to exactly 0.5", () => {
    expect(confidenceFromDistance(0.55, 0.55, 12)).toBeCloseTo(0.5, 12);
    expect(sigmoid(0)).toBe(0.5);
  });

  it("is monotonic: closer ⇒ more confident, bounded in [0,1]", () => {
    let prev = -Infinity;
    for (const d of [0.8, 0.7, 0.6, 0.5, 0.4, 0.3]) {
      const c = confidenceFromDistance(d, 0.55, 12);
      expect(c).toBeGreaterThan(prev);
      expect(c).toBeGreaterThan(0);
      expect(c).toBeLessThan(1);
      prev = c;
    }
    expect(confidenceFromDistance(0.05, 0.55, 12)).toBeGreaterThan(0.99);
    expect(confidenceFromDistance(1.2, 0.55, 12)).toBeLessThan(0.01);
  });
});
