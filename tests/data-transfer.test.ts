import { describe, expect, it } from "vitest";
import { EXPORT_SCHEMA_VERSION, validateAndParseImport } from "@/lib/storage/data-transfer";

const PHOTO = "data:image/jpeg;base64,/9j/4AAQSkZJRg==";

function descriptor(seed = 1): number[] {
  return Array.from({ length: 128 }, (_, i) => Math.sin(seed + i) / 10);
}

function validBundle(): Record<string, unknown> {
  return {
    app: "MemoryAssist",
    schemaVersion: EXPORT_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    profiles: [
      {
        id: "p1",
        name: "Sam",
        age: 52,
        relationship: "Mother",
        description: "She enjoys gardening.",
        descriptors: [descriptor(1)],
        enrollmentPhotos: [{ id: "ph1", addedAt: new Date().toISOString() }],
        photos: { ph1: PHOTO, profile: PHOTO },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ] as unknown[],
  };
}

function firstProfile(bundle: Record<string, unknown>): Record<string, unknown> {
  return (bundle.profiles as Record<string, unknown>[])[0];
}

describe("backup import validation", () => {
  it("accepts a well-formed backup", () => {
    const result = validateAndParseImport(validBundle());
    expect(result.skipped).toHaveLength(0);
    expect(result.profiles).toHaveLength(1);
    const p = result.profiles[0];
    expect(p.name).toBe("Sam");
    expect(p.descriptors[0]).toHaveLength(128);
    // photo ids are regenerated; arrays stay aligned
    expect(p.enrollmentPhotos).toHaveLength(1);
    expect(p.enrollmentPhotos[0].id).not.toBe("ph1");
    expect(result.assets.filter((a) => a.role === "enrollment")).toHaveLength(1);
    expect(result.assets.some((a) => a.role === "profile")).toBe(true);
  });

  it("rejects foreign files", () => {
    expect(validateAndParseImport(null).skipped.length).toBeGreaterThan(0);
    expect(validateAndParseImport({ hello: 1 }).skipped.length).toBeGreaterThan(0);
    expect(
      validateAndParseImport({ ...validBundle(), app: "OtherApp" }).skipped.length,
    ).toBeGreaterThan(0);
  });

  it("rejects newer schema versions", () => {
    const bundle = validBundle();
    bundle.schemaVersion = EXPORT_SCHEMA_VERSION + 3;
    const result = validateAndParseImport(bundle);
    expect(result.profiles).toHaveLength(0);
  });

  it("skips profiles with invalid names or ages but keeps the rest", () => {
    const bundle = validBundle();
    (bundle.profiles as unknown[]).unshift({
      id: "bad",
      name: "",
      relationship: "Friend",
      descriptors: [],
      enrollmentPhotos: [],
      photos: {},
    });
    (bundle.profiles as unknown[]).push({
      id: "bad2",
      name: "Tom",
      age: 999,
      relationship: "Father",
      descriptors: [],
      enrollmentPhotos: [],
      photos: {},
    });
    const result = validateAndParseImport(bundle);
    expect(result.profiles.map((p) => p.name)).toEqual(["Sam"]);
    expect(result.skipped.length).toBeGreaterThanOrEqual(2);
  });

  it("drops corrupted descriptors and stays aligned with photos", () => {
    const bundle = validBundle();
    (firstProfile(bundle).descriptors as number[][]).push(Array(10).fill(0.5));
    (firstProfile(bundle).enrollmentPhotos as unknown[]).push({ id: "ph2", addedAt: "x" });
    const result = validateAndParseImport(bundle);
    expect(result.profiles[0].descriptors).toHaveLength(1);
    expect(result.profiles[0].enrollmentPhotos).toHaveLength(1);
  });

  it("a corrupt FIRST descriptor never shifts later descriptors onto the wrong photos", () => {
    const bundle = validBundle();
    // photo ph1 ↔ descriptor(1) [corrupt], photo ph2 ↔ descriptor(2) [good].
    const profile = firstProfile(bundle);
    profile.descriptors = [
      Array.from({ length: 128 }, (_, i) => NaN), // corrupt slot 0
      descriptor(2), // belongs to ph2
    ];
    profile.enrollmentPhotos = [
      { id: "ph1", addedAt: "x" },
      { id: "ph2", addedAt: "y" },
    ];
    const result = validateAndParseImport(bundle);
    const p = result.profiles[0];
    expect(p.enrollmentPhotos).toHaveLength(0); // ph1 dropped WITH its bad vector
    expect(p.descriptors).toEqual([]); // alignment preserved — nothing mispaired
  });

  it("keeps the surviving pair when only the first descriptor is valid but its photo is missing", () => {
    const bundle = validBundle();
    const profile = firstProfile(bundle);
    profile.descriptors = [descriptor(1)];
    profile.enrollmentPhotos = [{ id: "ph-missing-image", addedAt: "x" }];
    delete (profile.photos as Record<string, unknown>)["ph-missing-image"];
    (profile.photos as Record<string, unknown>).ph9 = PHOTO;
    (profile.enrollmentPhotos as unknown[]).push({ id: "ph9", addedAt: "z" });
    (profile.descriptors as number[][]).push(descriptor(9));
    // Order: [ph-missing-image ↔ d1], [ph9 ↔ d9] — pairwise walking keeps
    // d9 attached to ph9 even though the first pair fails decode.
    const result = validateAndParseImport(bundle);
    expect(result.profiles[0].descriptors).toHaveLength(1);
    expect(result.profiles[0].descriptors[0][0]).toBeCloseTo(descriptor(9)[0], 12);
  });

  it("restores a profile without recognition when photos are absent", () => {
    const bundle = validBundle();
    delete (firstProfile(bundle).photos as Record<string, unknown>).ph1;
    const result = validateAndParseImport(bundle);
    const p = result.profiles[0];
    expect(p.descriptors).toHaveLength(0);
    expect(p.enrollmentPhotos).toHaveLength(0);
  });

  it("never imports executable content — photos must be image data URLs", () => {
    const bundle = validBundle();
    (firstProfile(bundle).photos as Record<string, unknown>).ph1 =
      "data:text/html;base64,PHNjcmlwdD4=";
    const result = validateAndParseImport(bundle);
    expect(result.profiles[0].enrollmentPhotos).toHaveLength(0);
    expect(result.profiles[0].descriptors).toHaveLength(0);
  });

  it("is immune to prototype-pollution and injected fields", () => {
    const hostile = JSON.parse(
      JSON.stringify({
        app: "MemoryAssist",
        schemaVersion: EXPORT_SCHEMA_VERSION,
        profiles: [
          {
            name: "Evil",
            relationship: "Other",
            descriptors: [],
            enrollmentPhotos: [],
            photos: {},
            __proto__: { isAdmin: true },
            isAdmin: true,
            id: "../../etc/passwd",
          },
        ],
      }),
    );
    const result = validateAndParseImport(hostile);
    expect(result.profiles).toHaveLength(1);
    const p = JSON.parse(JSON.stringify(result.profiles[0]));
    expect(p.isAdmin).toBeUndefined();
    expect(Object.getPrototypeOf(p)).toBe(Object.prototype);
    // IDs are regenerated, never taken from the file.
    expect(result.profiles[0].id).not.toBe("../../etc/passwd");
  });

  it("rejects oversized backups before touching storage", () => {
    const bundle = validBundle();
    bundle.profiles = Array.from({ length: 501 }, (_, i) => ({
      name: `P${i}`,
      relationship: "Friend",
      descriptors: [],
      enrollmentPhotos: [],
      photos: {},
    }));
    const result = validateAndParseImport(bundle);
    expect(result.profiles).toHaveLength(0);
    expect(result.skipped[0]).toMatch(/too large/i);
  });
});
