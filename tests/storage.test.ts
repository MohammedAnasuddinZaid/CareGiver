import { beforeEach, describe, expect, it } from "vitest";
import {
  clearAllData,
  createPerson,
  deletePerson,
  getAsset,
  getPeople,
  getPerson,
  putAsset,
  removeEnrollmentPhoto,
  updatePerson,
} from "@/lib/storage/profiles";
import { dbPut as dbPutRaw, STORE_PROFILES } from "@/lib/storage/db";

function descriptor(seed = 1): number[] {
  return Array.from({ length: 128 }, (_, i) => Math.sin(seed + i) / 10);
}

beforeEach(async () => {
  // The module keeps a single DB connection; wipe stores between tests.
  await clearAllData();
});

describe("local profile service (IndexedDB)", () => {
  it("creates and retrieves people", async () => {
    const created = await createPerson({
      name: "Sam",
      relationship: "Mother",
      description: "She enjoys gardening.",
      enrollmentPhotos: [],
      descriptors: [],
    });
    const all = await getPeople();
    expect(all).toHaveLength(1);
    expect(all[0].name).toBe("Sam");
    expect((await getPerson(created.id))?.id).toBe(created.id);
  });

  it("updates profiles without losing data", async () => {
    const created = await createPerson({
      name: "Tom",
      relationship: "Father",
      enrollmentPhotos: [],
      descriptors: [],
    });
    await updatePerson(created.id, { age: 57 });
    const updated = await getPerson(created.id);
    expect(updated).toBeDefined();
    expect(updated?.age).toBe(57);
    expect(updated?.name).toBe("Tom");
    expect(updated!.updatedAt >= created.createdAt).toBe(true);
  });

  it("stores photo blobs locally", async () => {
    const person = await createPerson({
      name: "Emma",
      relationship: "Sister",
      enrollmentPhotos: [],
      descriptors: [],
    });
    const blob = new Blob([new Uint8Array([1, 2, 3])], { type: "image/jpeg" });
    await putAsset({
      id: "asset-1",
      personId: person.id,
      role: "enrollment",
      blob,
      createdAt: new Date().toISOString(),
    });
    const loaded = await getAsset("asset-1");
    expect(loaded?.blob.size).toBe(3);
    expect(loaded?.personId).toBe(person.id);
  });

  it("removes an enrollment photo AND its aligned descriptor", async () => {
    const person = await createPerson({
      name: "Test",
      relationship: "Friend",
      enrollmentPhotos: [
        { id: "a", addedAt: "t1" },
        { id: "b", addedAt: "t2" },
        { id: "c", addedAt: "t3" },
      ],
      descriptors: [descriptor(1), descriptor(2), descriptor(3)],
    });
    const blob = new Blob(["x"]);
    await putAsset({ id: "b", personId: person.id, role: "enrollment", blob, createdAt: "t2" });

    const updated = await removeEnrollmentPhoto(person.id, "b");
    expect(updated.enrollmentPhotos.map((p) => p.id)).toEqual(["a", "c"]);
    expect(updated.descriptors).toHaveLength(2);
    expect(await getAsset("b")).toBeUndefined();
  });

  it("deletes a person and every associated asset", async () => {
    const person = await createPerson({
      name: "Temp",
      relationship: "Caregiver",
      enrollmentPhotos: [{ id: "z", addedAt: "t" }],
      descriptors: [descriptor(5)],
    });
    await putAsset({ id: "z", personId: person.id, role: "enrollment", blob: new Blob(["y"]), createdAt: "t" });

    await deletePerson(person.id);
    expect(await getPerson(person.id)).toBeUndefined();
    expect(await getAsset("z")).toBeUndefined();
    expect(await getPeople()).toHaveLength(0);
  });

  it("clearAllData wipes everything", async () => {
    await createPerson({
      name: "A",
      relationship: "Mother",
      enrollmentPhotos: [],
      descriptors: [descriptor(9)],
    });
    await createPerson({
      name: "B",
      relationship: "Father",
      enrollmentPhotos: [],
      descriptors: [],
    });
    await clearAllData();
    expect(await getPeople()).toHaveLength(0);
  });

  it("keeps recognition readiness honest", async () => {
    const empty = await createPerson({
      name: "No photos",
      relationship: "Friend",
      enrollmentPhotos: [],
      descriptors: [],
    });
    expect(empty.descriptors.length).toBe(0);

    const enrolled = await createPerson({
      name: "Enrolled",
      relationship: "Mother",
      enrollmentPhotos: [{ id: "e1", addedAt: "t" }],
      descriptors: [descriptor(11)],
    });
    expect(enrolled.descriptors.length).toBeGreaterThan(0);
  });

  it("sanitizes corrupted records from storage instead of crashing", async () => {
    // A record with recoverable garbage: kept, but coerced to a safe shape.
    await dbPutRaw(STORE_PROFILES, {
      id: "broken-but-kept",
      name: "Broken",
      relationship: null,
      descriptors: ["garbage", { nope: true }],
      enrollmentPhotos: "not-an-array",
      age: 9999,
    });
    // A record missing the keyPath property violates storage integrity and
    // is rejected by IndexedDB itself — even before sanitization matters.
    await expect(
      dbPutRaw(STORE_PROFILES, { name: "no id here" }),
    ).rejects.toThrow();

    const people = await getPeople();
    const broken = people.find((p) => p.id === "broken-but-kept");
    expect(broken).toBeDefined();
    expect(broken!.relationship).toBe("");
    expect(broken!.age).toBeUndefined();
    expect(Array.isArray(broken!.enrollmentPhotos)).toBe(true);
    expect(broken!.enrollmentPhotos).toHaveLength(0);
    expect(broken!.descriptors).toHaveLength(0);

    expect(people.some((p) => p.name === "no id here")).toBe(false);
  });
});
