import { describe, expect, it } from "vitest";
import {
  deduplicateFrameMatches,
  findLookalikeProfiles,
  identifyFace,
  identifyFaceDetailed,
  selectPrimaryFace,
} from "@/lib/recognition/matching";
import { l2Normalize } from "@/lib/recognition/metrics";
import { recognitionConfig } from "@/lib/recognition/config";

const THRESHOLD = 0.55;
const STRICT = recognitionConfig.thresholds.balanced;

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

  it("LAYER 2 — STRICT — a close runner-up forces unknown even for a low-distance match", () => {
    // Two enrolled people whose stored faces land nearly equidistant from
    // this probe (margin below ambiguityMargin). Even though the best
    // distance is small, guessing between them risks a wrong-name swap when
    // a head tilts, so we refuse to label: unknown, never the wrong name.
    const probe = atDistance(momBase, 0.2, 304);
    const result = identifyFaceDetailed(
      probe,
      [
        { id: "mom", descriptors: [atDistance(momBase, 0.2, 305)] }, // same point
        { id: "dad", descriptors: [atDistance(momBase, 0.26, 306)] },
      ],
      { threshold: THRESHOLD },
    );
    expect(result.status).toBe("unknown");
    expect(result.personId).toBeNull();
    expect(result.rejectedBy).toBe("ambiguity");
  });

  it("LAYER 2 clears when the runner-up is far (unambiguous match is trusted)", () => {
    // Best match is very close, second person is clearly far → decisive,
    // so the face IS recognized (a normal single-person or well-separated
    // scenario must still work).
    const probe = atDistance(momBase, 0.25, 310);
    const result = identifyFaceDetailed(
      probe,
      [
        { id: "mom", descriptors: [atDistance(momBase, 0.22, 311)] },
        { id: "dad", descriptors: [atDistance(momBase, 0.85, 312)] },
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

describe("strict single-person recognition (the 'no stranger wears a saved name' rule)", () => {
  it("recognizes only the enrolled person, and leaves a stranger unknown", () => {
    // One saved person; a stranger lands at a distance a stranger can
    // plausibly reach (e.g. 0.48) — below the OLD loose 0.55 gate where it
    // used to be mislabeled, but above the strict default 0.40 gate.
    const enrolled = unit(1001);
    const stranger = atDistance(enrolled, 0.48, 1002);
    const trueProbe = atDistance(enrolled, 0.25, 1003);

    const strictResult = identifyFaceDetailed(
      stranger,
      [{ id: "anas", descriptors: [enrolled] }],
      { threshold: STRICT },
    );
    expect(strictResult.status).toBe("unknown");
    expect(strictResult.personId).toBeNull();
    expect(strictResult.rejectedBy).toBe("threshold");

    // The real enrolled person is still recognized at the strict gate.
    const trueResult = identifyFaceDetailed(
      trueProbe,
      [{ id: "anas", descriptors: [enrolled] }],
      { threshold: STRICT },
    );
    expect(trueResult.status).toBe("recognized");
    expect(trueResult.personId).toBe("anas");
  });

  it("stays strict even at the most permissive setting a stranger can still hit", () => {
    // Even the loosest built-in setting (0.46) must reject a clear stranger
    // mid-band (0.50) while accepting the enrolled person (0.28).
    const enrolled = unit(2001);
    const stranger = atDistance(enrolled, 0.5, 2002);
    const trueProbe = atDistance(enrolled, 0.28, 2003);

    const s = identifyFaceDetailed(
      stranger,
      [{ id: "anas", descriptors: [enrolled] }],
      { threshold: recognitionConfig.thresholds.permissive },
    );
    expect(s.status).toBe("unknown");

    const t = identifyFaceDetailed(
      trueProbe,
      [{ id: "anas", descriptors: [enrolled] }],
      { threshold: recognitionConfig.thresholds.permissive },
    );
    expect(t.status).toBe("recognized");
    expect(t.personId).toBe("anas");
  });

  it("saved + unsaved person together → the unsaved head never wears the saved name", () => {
    // Two faces in one frame: the real saved person matches closely (0.28),
    // and an unsaved stranger ALSO passes the strict gate (0.38) because the
    // frame averaged it close to the saved descriptor. Even though both pass
    // matching, cross-face dedup must give the name ONLY to the best match —
    // the unsaved head stays unknown, never "anas".
    const enrolled = unit(3001);
    const edges: {
      matched: boolean; personId: string | null; distance: number | null;
    }[] = [
      { matched: true, personId: "anas", distance: 0.28 }, // saved person, closest
      { matched: true, personId: "anas", distance: 0.38 }, // unsaved stranger, passes gate
    ];
    const deduped = deduplicateFrameMatches(edges);
    const named = deduped.filter((m) => m.matched && m.personId === "anas");
    expect(named).toHaveLength(1);
    expect(named[0].distance).toBeCloseTo(0.28);
    expect(deduped[1].matched).toBe(false);
    expect(deduped[1].personId).toBeNull();
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

describe("deduplicateFrameMatches", () => {
  it("demotes the worse match when two faces claim the same person", () => {
    const matches = [
      { matched: true, personId: "mom", distance: 0.30 },
      { matched: true, personId: "mom", distance: 0.45 },
    ];
    const result = deduplicateFrameMatches(matches);
    expect(result[0].matched).toBe(true);
    expect(result[0].personId).toBe("mom");
    expect(result[1].matched).toBe(false);
    expect(result[1].personId).toBeNull();
  });

  it("demotes the second even when distances are nearly equal (never two heads, one name)", () => {
    // An unsaved stranger next to a saved person can both land just inside a
    // saved profile's gate with a tiny gap. OLD behavior kept both as the
    // same name; new strict behavior keeps ONLY the closest — the other face
    // shows unknown, never the saved person's name.
    const matches = [
      { matched: true, personId: "mom", distance: 0.30 },
      { matched: true, personId: "mom", distance: 0.33 },
    ];
    const result = deduplicateFrameMatches(matches);
    expect(result[0].matched).toBe(true);
    expect(result[0].personId).toBe("mom");
    expect(result[1].matched).toBe(false);
    expect(result[1].personId).toBeNull();
  });

  it("does not touch faces matching different people", () => {
    const matches = [
      { matched: true, personId: "mom", distance: 0.30 },
      { matched: true, personId: "dad", distance: 0.35 },
    ];
    const result = deduplicateFrameMatches(matches);
    expect(result[0].matched).toBe(true);
    expect(result[0].personId).toBe("mom");
    expect(result[1].matched).toBe(true);
    expect(result[1].personId).toBe("dad");
  });

  it("does not touch unknown faces", () => {
    const matches = [
      { matched: true, personId: "mom", distance: 0.30 },
      { matched: false, personId: null, distance: null },
    ];
    const result = deduplicateFrameMatches(matches);
    expect(result[0].matched).toBe(true);
    expect(result[1].matched).toBe(false);
  });

  it("keeps only the closest of three faces claiming the same person", () => {
    const matches = [
      { matched: true, personId: "mom", distance: 0.40 },
      { matched: true, personId: "mom", distance: 0.30 },
      { matched: true, personId: "mom", distance: 0.48 },
    ];
    const result = deduplicateFrameMatches(matches);
    expect(result.filter((m) => m.matched && m.personId === "mom").length).toBe(1);
    // The best match (distance 0.30, index 1) is kept
    expect(result[1].matched).toBe(true);
    expect(result[1].personId).toBe("mom");
  });
});

describe("findLookalikeProfiles — enrollment-time duplicate detection", () => {
  const momBase = unit(101);
  const dadBase = unit(202);

  it("flags a new set that clearly matches someone already enrolled", () => {
    const newAngles = [0.18, 0.2, 0.22, 0.24].map((d, i) =>
      atDistance(momBase, d, 900 + i),
    );
    const result = findLookalikeProfiles(
      newAngles,
      [
        { id: "mom", descriptors: [momBase] },
        { id: "dad", descriptors: [dadBase] },
      ],
      THRESHOLD,
    );
    expect(result).not.toBeNull();
    expect(result!.personId).toBe("mom");
    expect(result!.votes).toBe(newAngles.length);
  });

  it("returns null when the new set is a stranger (above threshold)", () => {
    // Random probes land ~sqrt(2) from everyone — well past the threshold.
    const strangers = [0, 1, 2, 3].map((i) => unit(7000 + i));
    const result = findLookalikeProfiles(
      strangers,
      [{ id: "mom", descriptors: [momBase] }],
      THRESHOLD,
    );
    expect(result).toBeNull();
  });

  it("needs a majority — a lone noisy capture can never force a merge", () => {
    // Three new descriptors: two are clearly a stranger, one is mom-adjacent.
    const set = [
      unit(51),
      unit(52),
      atDistance(momBase, 0.2, 53),
    ];
    const result = findLookalikeProfiles(
      set,
      [
        { id: "mom", descriptors: [momBase] },
        { id: "dad", descriptors: [dadBase] },
      ],
      THRESHOLD,
    );
    // 1 of 3 votes < half → the old single-photo fix never suggests a merge.
    expect(result).toBeNull();
  });

  it("tolerates mixed captures when the majority agrees on one person", () => {
    // Four of six descriptors are mom at clean distances; two are noise.
    const set = [
      atDistance(momBase, 0.2, 61),
      atDistance(momBase, 0.24, 62),
      atDistance(momBase, 0.21, 63),
      atDistance(momBase, 0.26, 64),
      unit(71),
      unit(72),
    ];
    const result = findLookalikeProfiles(
      set,
      [
        { id: "mom", descriptors: [momBase] },
        { id: "dad", descriptors: [dadBase] },
      ],
      THRESHOLD,
    );
    expect(result).not.toBeNull();
    expect(result!.personId).toBe("mom");
    expect(result!.votes).toBe(4);
  });

  it("returns null for an empty or unenrolled set", () => {
    expect(
      findLookalikeProfiles([], [{ id: "mom", descriptors: [momBase] }], THRESHOLD),
    ).toBeNull();
    expect(
      findLookalikeProfiles(
        [atDistance(momBase, 0.2, 81)],
        [],
        THRESHOLD,
      ),
    ).toBeNull();
  });
});
