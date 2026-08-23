import { describe, expect, it } from "vitest";
import {
  compareDescriptorToProfile,
  euclideanDistance,
  identifyFace,
  isValidDescriptor,
  selectPrimaryFace,
} from "@/lib/recognition/matching";

const THRESHOLD = 0.55;

function desc(seed: number, magnitude = 1): number[] {
  return Array.from({ length: 128 }, (_, i) => {
    // Deterministic pseudo-random values in [-magnitude, magnitude]
    const v = Math.sin(seed * 12.9898 + i * 78.233) * 43758.5453;
    return (((v - Math.floor(v)) * 2 - 1) * magnitude) / 10;
  });
}

describe("descriptor validation", () => {
  it("accepts 128 finite numbers", () => {
    expect(isValidDescriptor(desc(1))).toBe(true);
  });
  it("rejects wrong lengths and NaN", () => {
    expect(isValidDescriptor([0.1, 0.2])).toBe(false);
    const bad = desc(2);
    bad[3] = NaN;
    expect(isValidDescriptor(bad)).toBe(false);
    expect(isValidDescriptor("nope")).toBe(false);
  });
});

describe("euclidean distance", () => {
  it("is zero for identical descriptors", () => {
    const d = desc(7);
    expect(euclideanDistance(d, d)).toBeCloseTo(0, 12);
  });
});

describe("identifyFace — unknown rejection", () => {
  const mom = { id: "mom", descriptors: [desc(11)] };
  const dad = { id: "dad", descriptors: [desc(22)] };

  it("recognizes an enrolled person below threshold", () => {
    const result = identifyFace(desc(11), [mom, dad], THRESHOLD);
    expect(result.status).toBe("recognized");
    expect(result.personId).toBe("mom");
  });

  it("returns UNKNOWN — not nearest neighbor — for a stranger", () => {
    const stranger = desc(99, 6); // deliberately far from everyone
    const result = identifyFace(stranger, [mom, dad], THRESHOLD);
    expect(result.status).toBe("unknown");
    expect(result.personId).toBe(null);
  });

  it("never identifies when there are no profiles", () => {
    expect(identifyFace(desc(11), [], THRESHOLD).status).toBe("unknown");
  });
});

describe("multi-descriptor profiles", () => {
  it("uses the minimum distance across stored descriptors", () => {
    const profile = {
      id: "fatima",
      descriptors: [desc(31), desc(32), desc(33)],
    };
    const { distance } = compareDescriptorToProfile(desc(32), profile);
    expect(distance).toBeLessThan(THRESHOLD);
    expect(identifyFace(desc(33), [profile], THRESHOLD).status).toBe("recognized");
  });

  it("ignores corrupted descriptors instead of crashing", () => {
    const profile = {
      id: "x",
      descriptors: ["bad", null, desc(41)],
    };
    expect(identifyFace(desc(41), [profile], THRESHOLD).status).toBe("recognized");
  });
});

describe("selectPrimaryFace", () => {
  const box = (w: number, h: number) => ({ width: w, height: h });

  it("prefers a recognized face over a larger unknown face", () => {
    const faces = [
      { box: box(300, 300), matched: false },
      { box: box(100, 100), matched: true },
    ];
    expect(selectPrimaryFace(faces)).toBe(1);
  });

  it("falls back to the largest face when none are recognized", () => {
    const faces = [
      { box: box(120, 120), matched: false },
      { box: box(260, 260), matched: false },
    ];
    expect(selectPrimaryFace(faces)).toBe(1);
  });
});
