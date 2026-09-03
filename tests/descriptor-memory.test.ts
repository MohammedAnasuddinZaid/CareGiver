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
    expect(out.descriptor).not.toBe(d);
    expect(out.descriptor).toEqual(d);
    expect(out.swap).toBe(false);
  });

  it("blends subsequent frames with the configured EMA weight", () => {
    const mem = new DescriptorMemory();
    const a = unit(2);
    const b = unit(3);
    mem.update("t1", a, 0);
    const blendedRes = mem.update("t1", b, 10)!;
    const blended = blendedRes.descriptor!;
    expect(blendedRes.swap).toBe(false);
    // One EMA step toward b: distance to b must shrink vs distance a↔b.
    expect(normalizedEuclidean(blended, b)).toBeLessThan(normalizedEuclidean(a, b));
    for (let i = 0; i < 30; i++) mem.update("t1", b, 20 + i * 10);
    const converged = mem.update("t1", b, 400)!.descriptor!;
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
      smoothed = mem.update("face", noisy(i + 10), i * 260).descriptor;
    }
    const singleFrameDistance = normalizedEuclidean(noisy(99), truth);
    const averagedDistance = normalizedEuclidean(smoothed!, truth);
    expect(averagedDistance).toBeLessThan(singleFrameDistance);
    // And decisively inside any reasonable threshold after blending.
    expect(averagedDistance).toBeLessThan(0.35);
  });

  it("rejects corrupt vectors without poisoning memory", () => {
    const mem = new DescriptorMemory();
    expect(mem.update("t1", [0.5, NaN], 0).descriptor).toBeNull();
    expect(mem.update("t1", [], 0).descriptor).toBeNull();
    expect(mem.framesFor("t1")).toBe(0);
  });

  it("flags a swap and resets when a different physical face follows the same id", () => {
    const mem = new DescriptorMemory();
    const faceA = unit(1);
    const faceB = unit(50);
    // Bootstrap on face A (likened to an enrolled, recognized head).
    for (let i = 0; i < 5; i++) mem.update("t1", faceA, i * 260);
    expect(mem.framesFor("t1")).toBe(5);

    // faceB is a genuinely different face (far apart in descriptor space) —
    // the tracker just reassigned id "t1" to a new physical head.
    const res = mem.update("t1", faceB, 6 * 260);
    expect(res.swap).toBe(true);
    // Memory must be reset to the new face's own descriptor (no hybrid),
    // so a subsequent match runs against the stranger's own identity.
    const after = mem.update("t1", faceB, 7 * 260).descriptor!;
    expect(normalizedEuclidean(after, faceB)).toBeLessThan(0.02);
    expect(mem.framesFor("t1")).toBeGreaterThanOrEqual(1);
  });

  it("does NOT flag a swap for same-person pose noise", () => {
    const mem = new DescriptorMemory();
    const truth = unit(7);
    const pose = (seed: number): number[] => {
      const noise = unit(seed);
      const mixed = truth.map((x, i) => x * 0.94 + noise[i] * 0.12);
      return l2Normalize(mixed)!;
    };
    mem.update("t1", truth, 0);
    let swap = false;
    for (let i = 1; i <= 5; i++) {
      swap = swap || mem.update("t1", pose(i), i * 260).swap;
    }
    expect(swap).toBe(false);
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
