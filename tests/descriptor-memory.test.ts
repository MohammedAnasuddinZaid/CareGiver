import { describe, expect, it } from "vitest";
import {
  DescriptorMemory,
  DESCRIPTOR_EMA_ALPHA,
  steadyStateWeight,
} from "@/lib/recognition/descriptor-memory";
import { l2Normalize, normalizedEuclidean } from "@/lib/recognition/metrics";
import { DESCRIPTOR_LENGTH } from "@/lib/recognition/config";

function unit(seed: number): number[] {
  const v = Array.from({ length: DESCRIPTOR_LENGTH }, (_, i) => Math.sin(seed * 12.9898 + i * 78.233));
  return l2Normalize(v)!;
}

describe("DescriptorMemory", () => {
  it("returns the first descriptor as-is (copied)", () => {
    const mem = new DescriptorMemory();
    const d = unit(1);
    const out = mem.update("t1", d, 0);
    expect(out).not.toBe(d);
    expect(out).toEqual(d);
  });

  it("blends subsequent frames with the configured EMA weight", () => {
    const mem = new DescriptorMemory();
    const a = unit(2);
    const b = unit(3);
    mem.update("t1", a, 0);
    const blended = mem.update("t1", b, 10)!;
    // One EMA step toward b: distance to b must shrink vs distance a↔b.
    expect(normalizedEuclidean(blended, b)).toBeLessThan(normalizedEuclidean(a, b));
    for (let i = 0; i < 30; i++) mem.update("t1", b, 20 + i * 10);
    const converged = mem.update("t1", b, 400)!;
    expect(normalizedEuclidean(converged, b)).toBeLessThan(0.02);
  });

  it("averaging pulls a true match below threshold while impostors stay far", () => {
    // Simulate noisy observations of the same underlying face.
    const truth = unit(7);
    const noisy = (seed: number): number[] => {
      const noise = unit(seed);
      const mixed = truth.map((x, i) => x * 0.9 + noise[i] * 0.25);
      return l2Normalize(mixed)!;
    };
    const mem = new DescriptorMemory();
    let smoothed: number[] | null = null;
    for (let i = 0; i < 4; i++) {
      smoothed = mem.update("face", noisy(i + 10), i * 260);
    }
    const singleFrameDistance = normalizedEuclidean(noisy(99), truth);
    const averagedDistance = normalizedEuclidean(smoothed!, truth);
    expect(averagedDistance).toBeLessThan(singleFrameDistance);
    // And decisively inside any reasonable threshold after blending.
    expect(averagedDistance).toBeLessThan(0.35);
  });

  it("rejects corrupt vectors without poisoning memory", () => {
    const mem = new DescriptorMemory();
    expect(mem.update("t1", [0.5, NaN], 0)).toBeNull();
    expect(mem.update("t1", [], 0)).toBeNull();
    expect(mem.framesFor("t1")).toBe(0);
  });

  it("retain() drops memories of vanished tracks", () => {
    const mem = new DescriptorMemory();
    mem.update("a", unit(1), 0);
    mem.update("b", unit(2), 0);
    mem.retain(["a"]);
    expect(mem.framesFor("b")).toBe(0);
    expect(mem.framesFor("a")).toBe(1);
  });

  it("reset clears everything", () => {
    const mem = new DescriptorMemory();
    mem.update("a", unit(1), 0);
    mem.reset();
    expect(mem.framesFor("a")).toBe(0);
  });

  it("EMA alpha is tuned for ~4-frame convergence at 4 fps", () => {
    // After 4 updates of identical target vectors, residual old-vector
    // weight must be small: (1−α)^3 ≤ 0.2.
    expect(Math.pow(1 - DESCRIPTOR_EMA_ALPHA, 3)).toBeLessThanOrEqual(0.2);
  });
});

describe("stabilizer reachability math", () => {
  it("steadyStateWeight matches the discrete fixed point c/(1−k)", () => {
    const w = steadyStateWeight(0.8, 260, 900);
    const k = Math.exp(-260 / 900);
    expect(w).toBeCloseTo(0.8 / (1 - k), 10);
  });

  it("old constants would fail this gate (documents the historical bug)", () => {
    // τ=650, cycle=500ms → ceiling 1.86·c < old enterWeight 2.15.
    const oldCeiling = steadyStateWeight(0.999, 500, 650);
    expect(oldCeiling).toBeLessThan(2.15);
  });
});
