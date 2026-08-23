import { describe, expect, it } from "vitest";
import { BoxTracker, OneEuroFilter } from "@/lib/recognition/tracker";
import { iou } from "@/lib/recognition/geometry";
import { recognitionConfig } from "@/lib/recognition/config";

const cfg = recognitionConfig.tracker;
const box = (x: number, y: number, w = 100, h = 100) => ({ x, y, width: w, height: h });

describe("IoU geometry", () => {
  it("identical boxes score 1, disjoint boxes 0", () => {
    expect(iou(box(0, 0), box(0, 0))).toBe(1);
    expect(iou(box(0, 0), box(500, 500))).toBe(0);
  });

  it("partial overlap computes correctly", () => {
    // Two 100x100 boxes offset by 50 → intersection 5000, union 15000.
    expect(iou(box(0, 0), box(50, 0))).toBeCloseTo(5000 / 15000, 10);
  });
});

describe("BoxTracker — stable identities across frames", () => {
  it("keeps the same track ID for a slowly moving face", () => {
    const t = new BoxTracker(cfg);
    const a = t.update([box(100, 100)], 0);
    const b = t.update([box(108, 104)], 260);
    expect(b).toHaveLength(1);
    expect(b[0].trackId).toBe(a[0].trackId);
    expect(b[0].hits).toBe(2);
  });

  it("assigns distinct IDs to two simultaneous faces", () => {
    const t = new BoxTracker(cfg);
    const first = t.update([box(0, 0), box(600, 300)], 0);
    const second = t.update([box(4, 2), box(604, 302)], 260);
    expect(new Set(first.map((f) => f.trackId)).size).toBe(2);
    // Association preserves identity — sorted by x the ids must match.
    const idAtX = (arr: typeof first) => arr.find((f) => f.box.x < 300)!.trackId;
    expect(idAtX(second)).toBe(idAtX(first));
  });

  it("spawns a new track when a face jumps far away and the old one expires", () => {
    const t = new BoxTracker(cfg);
    const first = t.update([box(0, 0)], 0)[0];
    // Old track goes stale (no detections) beyond maxAgeMs…
    const mid = t.update([], cfg.maxAgeMs + 1);
    expect(mid).toHaveLength(0);
    // …then a face elsewhere is genuinely NEW.
    const next = t.update([box(800, 400)], cfg.maxAgeMs + 270);
    expect(next).toHaveLength(1);
    expect(next[0].trackId).not.toBe(first.trackId);
  });

  it("drops stale tracks while keeping live ones", () => {
    const t = new BoxTracker(cfg);
    t.update([box(0, 0), box(500, 0)], 0);
    // Only the second face reappears; the first goes silent past maxAge.
    const later = t.update([box(504, 4)], cfg.maxAgeMs + 300);
    expect(later).toHaveLength(1);
  });
});

describe("One Euro filter — calm when slow, snappy when fast", () => {
  it("suppresses jitter on small oscillations", () => {
    const f = new OneEuroFilter(cfg.oneEuro.minCutoff, cfg.oneEuro.beta, cfg.oneEuro.dCutoff);
    let t = 0;
    const raw: number[] = [];
    const filtered: number[] = [];
    for (let i = 0; i < 40; i++) {
      const v = 200 + (i % 2 === 0 ? 6 : -6); // ±6px jitter
      raw.push(v);
      filtered.push(f.filter(v, (t += 33)));
    }
    const range = (xs: number[]) => Math.max(...xs.slice(5)) - Math.min(...xs.slice(5));
    expect(range(filtered)).toBeLessThan(range(raw));
  });

  it("follows large fast movements within a bounded lag", () => {
    const f = new OneEuroFilter(cfg.oneEuro.minCutoff, cfg.oneEuro.beta, cfg.oneEuro.dCutoff);
    let t = 0;
    for (let i = 0; i < 10; i++) f.filter(100 + (i % 2 ? 3 : -3), (t += 33));
    // Sudden jump of 300px:
    let v = 0;
    for (let i = 0; i < 12; i++) {
      v = f.filter(400 + (i % 2 ? 3 : -3), (t += 33));
    }
    expect(v).toBeGreaterThan(380); // converged close to the target
  });
});
