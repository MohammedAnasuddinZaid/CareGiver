import { describe, expect, it } from "vitest";
import {
  assessPhotoQuality,
  laplacianVariance,
  meanLuminance,
  yawProxy,
} from "@/lib/recognition/photo-quality";
import { recognitionConfig } from "@/lib/recognition/config";

const cfg = recognitionConfig;

function buffer(
  width: number,
  height: number,
  pixel: (x: number, y: number) => [number, number, number],
) {
  const data: number[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [r, g, b] = pixel(x, y);
      data.push(r, g, b, 255);
    }
  }
  return { data, width, height };
}

describe("Laplacian variance — blur detection", () => {
  it("a perfectly flat image has ~zero edge energy and is rejected as blurry", () => {
    const flat = buffer(64, 64, () => [128, 128, 128]);
    expect(laplacianVariance(flat)).toBeCloseTo(0, 6);
    const report = assessPhotoQuality(flat, null, cfg);
    expect(report.verdict).toBe("reject");
    expect(report.warnings.some((w) => /blurry/i.test(w))).toBe(true);
  });

  it("a sharp checkerboard has high edge energy and passes the blur gate", () => {
    const sharp = buffer(64, 64, (x, y) =>
      ((x >> 2) + (y >> 2)) % 2 === 0 ? [230, 230, 230] : [20, 20, 20],
    );
    expect(laplacianVariance(sharp)).toBeGreaterThan(cfg.quality.blurWarnVariance);
    const report = assessPhotoQuality(sharp, null, cfg);
    expect(["good", "warn"]).toContain(report.verdict);
    expect(report.sharpness).toBeGreaterThan(0);
  });
});

describe("mean luminance — lighting checks", () => {
  it("flags dark photos", () => {
    const dark = buffer(32, 32, () => [10, 10, 12]);
    expect(meanLuminance(dark)).toBeLessThan(cfg.quality.darkMeanBelow);
    expect(assessPhotoQuality(dark, null, cfg).warnings.some((w) => /dark/i.test(w))).toBe(true);
  });

  it("flags overexposed photos", () => {
    const bright = buffer(32, 32, () => [250, 250, 252]);
    expect(meanLuminance(bright)).toBeGreaterThan(cfg.quality.brightMeanAbove);
    expect(assessPhotoQuality(bright, null, cfg).warnings.some((w) => /overexposed/i.test(w))).toBe(true);
  });

  it("well-lit textured photos produce no warnings at all", () => {
    // Mid-gray tones (good light) with block texture (sharp edges).
    const ok = buffer(64, 64, (x, y) =>
      ((x >> 2) + (y >> 2)) % 2 === 0 ? [150, 150, 150] : [130, 130, 130],
    );
    const report = assessPhotoQuality(ok, null, cfg);
    expect(report.warnings).toHaveLength(0);
    expect(report.verdict).toBe("good");
  });
});

describe("yaw proxy — head-turn estimation from landmarks", () => {
  const frontal = {
    leftEyeOuter: { x: 100, y: 100 },
    rightEyeOuter: { x: 200, y: 100 },
    noseTip: { x: 150, y: 160 },
  };

  it("a frontal face sits near zero", () => {
    expect(yawProxy(frontal)).toBeCloseTo(0.5 - 0.5, 10);
    expect(Math.abs(yawProxy(frontal)!)).toBeLessThan(0.05);
  });

  it("a turned face shifts the nose away from center", () => {
    const turned = { ...frontal, noseTip: { x: 120, y: 160 } };
    const yaw = yawProxy(turned)!;
    expect(yaw).toBeLessThan(-cfg.quality.yawWarn);
  });

  it("degenerate geometry returns null instead of exploding", () => {
    const degenerate = {
      leftEyeOuter: { x: 150, y: 100 },
      rightEyeOuter: { x: 150.0001, y: 100 },
      noseTip: { x: 150, y: 160 },
    };
    expect(yawProxy(degenerate)).toBeNull();
  });

  it("an extreme turn rejects enrollment (near-profile photos poison matching)", () => {
    const turnedSharp = buffer(
      64,
      64,
      (x, y) => (((x * 7 + y * 13) % 16 < 8 ? [220, 220, 220] : [40, 40, 40]) as [number, number, number]),
    );
    const report = assessPhotoQuality(turnedSharp, { leftEyeOuter: { x: 100, y: 0 }, rightEyeOuter: { x: 200, y: 0 }, noseTip: { x: 60, y: 50 } }, cfg);
    // Turned far to one side → reject verdict with an explanatory warning.
    expect(report.warnings.some((w) => /turned/i.test(w))).toBe(true);
    expect(report.verdict).toBe("reject");
  });

  it("a mild turn only warns and still allows enrollment", () => {
    const sharp = buffer(
      64,
      64,
      (x, y) => (((x * 7 + y * 13) % 16 < 8 ? [220, 220, 220] : [40, 40, 40]) as [number, number, number]),
    );
    // Eyes at x=100/200 (span 100): nose at x=175 ⇒
    // yaw = (175−100)/100 − 0.5 = +0.25 — inside [yawWarn, yawReject).
    const mild = {
      leftEyeOuter: { x: 100, y: 0 },
      rightEyeOuter: { x: 200, y: 0 },
      noseTip: { x: 175, y: 50 },
    };
    const report = assessPhotoQuality(sharp, mild, cfg);
    expect(Math.abs(report.yaw!)).toBeGreaterThanOrEqual(cfg.quality.yawWarn);
    expect(Math.abs(report.yaw!)).toBeLessThan(cfg.quality.yawReject);
    expect(report.verdict).toBe("warn");
  });
});
