import { describe, expect, it } from "vitest";
import {
  identifyFace,
  identifyFaceDetailed,
  selectPrimaryFace,
} from "@/lib/recognition/matching";
import { l2Normalize } from "@/lib/recognition/metrics";

const THRESHOLD = 0.55;

/** Deterministic pseudo-random unit vector. */
function unit(seed: number): number[] {
  return l2Normalize(
    Array.from({ length: 128 }, (_, i) => {
      const v = Math.sin(seed * 12.9898 + i * 78.233) * 43758.5453;
      return ((v - Math.floor(v)) * 2 - 1) * 43758.5453;
    }),
  )!;
}

function orthonormalPartner(u: number[], seed: number): number[] {
  const r = unit(seed);
  const dot = r.reduce((s, x, i) => s + x * u[i], 0);
  const p = r.map((x, i) => x - dot * u[i]);
  return l2Normalize(p)!;
}

/** A unit vector at EXACT normalized euclidean distance `d` from `u`. */
function atDistance(u: number[], d: number, seed: number): number[] {
  const cos = 1 - (d * d) / 2;
  const sin = Math.sqrt(Math.max(0, 1 - cos * cos));
  const e2 = orthonormalPartner(u, seed);
  return u.map((x, i) => cos * x + sin * e2[i]);
}

describe("open-set identification — safety layers", () => {
  const momBase = unit(101);
  const dadBase = unit(202);

  it("recognizes an enrolled person below threshold with calibrated confidence", () => {
    // Mom's twin at distance 0.25 — clearly inside the threshold.
    const probe = atDistance(momBase, 0.25, 301);
    const result = identifyFaceDetailed(
      probe,
      [
        { id: "mom", descriptors: [momBase] },
        { id: "dad", descriptors: [dadBase] },
      ],
      { threshold: THRESHOLD },
    );
    expect(result.status).toBe("recognized");
    expect(result.personId).toBe("mom");
    expect(result.confidence).toBeGreaterThan(0.9);
    expect(result.margin).toBeGreaterThan(0.07);
    expect(result.rejectedBy).toBeNull();
  });

  it("LAYER 1 — a stranger above threshold stays UNKNOWN (never nearest-neighbor)", () => {
    // Random strangers land ~sqrt(2) away from everyone in 128-D.
    const stranger = unit(999);
    const result = identifyFaceDetailed(
      stranger,
      [
        { id: "mom", descriptors: [momBase] },
        { id: "dad", descriptors: [dadBase] },
      ],
      { threshold: THRESHOLD },
    );
    expect(result.status).toBe("unknown");
    expect(result.rejectedBy).toBe("threshold");
    expect(result.personId).toBeNull();
  });

  it("LAYER 2 — an ambiguous midpoint between two people stays UNKNOWN", () => {
    // Probe sits at 0.50 from Mom; Dad is constructed at 0.555 from the probe:
    // inside the threshold, inside the uncertainty band, gap under the margin.
    const probe = atDistance(momBase, 0.5, 302);
    const dadClose = atDistance(probe, 0.555, 303);
    const result = identifyFaceDetailed(
      probe,
      [
        { id: "mom", descriptors: [momBase] },
        { id: "dad", descriptors: [dadClose] },
      ],
      { threshold: THRESHOLD },
    );
    expect(result.status).toBe("unknown");
    expect(result.personId).toBeNull();
    expect(result.rejectedBy).toBe("ambiguity");
  });

  it("LAYER 2 does not fire outside the uncertainty band", () => {
    // Very close match (0.20): even if two people were oddly similar,
    // decisive matches are trusted.
    const probe = atDistance(momBase, 0.2, 304);
    const result = identifyFaceDetailed(
      probe,
      [
        { id: "mom", descriptors: [atDistance(momBase, 0.2, 305)] }, // same point
        { id: "dad", descriptors: [atDistance(momBase, 0.26, 306)] },
      ],
      { threshold: THRESHOLD },
    );
    expect(result.status).toBe("recognized");
    expect(result.personId).toBe("mom");
  });

  it("multi-descriptor profiles use their nearest stored face", () => {
    const far = atDistance(momBase, 0.7, 307);
    const near = atDistance(dadBase, 0.15, 308);
    const result = identifyFace(atDistance(dadBase, 0.12, 309), [
      { id: "Sam", descriptors: [far] },
      { id: "Tom", descriptors: [near] },
    ], THRESHOLD);
    expect(result.status).toBe("recognized");
    expect(result.personId).toBe("Tom");
  });

  it("corrupted descriptors are ignored instead of crashing", () => {
    const result = identifyFace(unit(400), [
      { id: "x", descriptors: ["bad" as unknown as number[], null as unknown as number[], momBase] },
    ], THRESHOLD);
    // Random query vs mom → far → unknown, but no crash:
    expect(["recognized", "unknown"]).toContain(result.status);
  });

  it("no profiles ⇒ unknown with 'no-profiles' reason", () => {
    const r = identifyFaceDetailed(momBase, [], { threshold: THRESHOLD });
    expect(r.status).toBe("unknown");
    expect(r.rejectedBy).toBe("no-profiles");
  });
});

describe("selectPrimaryFace", () => {
  const box = (x: number, y: number, w: number, h: number) => ({ x, y, width: w, height: h });

  it("prefers a recognized face over a larger unknown face", () => {
    const faces = [
      { box: box(0, 0, 300, 300), matched: false },
      { box: box(10, 10, 100, 100), matched: true },
    ];
    expect(selectPrimaryFace(faces)).toBe(1);
  });

  it("falls back to the largest face when none are recognized", () => {
    const faces = [
      { box: box(0, 0, 120, 120), matched: false },
      { box: box(5, 5, 260, 260), matched: false },
    ];
    expect(selectPrimaryFace(faces)).toBe(1);
  });
});
