import { isFiniteVector } from "@/lib/recognition/metrics";
import { DESCRIPTOR_LENGTH } from "@/lib/recognition/config";
import {
  dbClear,
  dbCount,
  dbDelete,
  dbGet,
  dbGetAll,
  dbPut,
  dbTransactionalWrite,
  deleteAssetsForPerson,
  STORE_ASSETS,
  STORE_PROFILES,
} from "./db";
import type { EnrollmentPhoto, PersonProfile } from "@/lib/types/person";

export interface StoredAsset {
  id: string;
  personId: string;
  role: "profile" | "enrollment";
  blob: Blob;
  createdAt: string;
}

function nowISO(): string {
  return new Date().toISOString();
}

function asString(value: unknown, maxLen: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, maxLen);
}

/**
 * Defensive sanitization of records read back from IndexedDB.
 * A corrupted or hand-edited record must never crash the app — it degrades
 * to a safe shape instead (empty recognition data at worst).
 */
export function sanitizeProfile(raw: unknown): PersonProfile | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = asString(r.id, 128);
  const name = asString(r.name, 80);
  if (!id || !name) return null;

  let age: number | undefined;
  if (typeof r.age === "number" && Number.isInteger(r.age) && r.age >= 0 && r.age <= 130) {
    age = r.age;
  }

  const relationship = asString(r.relationship, 60) ?? "";

  const enrollmentPhotos: EnrollmentPhoto[] = Array.isArray(r.enrollmentPhotos)
    ? (r.enrollmentPhotos as unknown[])
        .filter(
          (p): p is EnrollmentPhoto =>
            !!p &&
            typeof p === "object" &&
            typeof (p as EnrollmentPhoto).id === "string" &&
            typeof (p as EnrollmentPhoto).addedAt === "string",
        )
        .slice(0, 20)
    : [];

  // Descriptors are filtered for shape AND aligned count; extra descriptors
  // without photo slots are dropped to keep index-based edits consistent.
  const rawDescriptors = Array.isArray(r.descriptors) ? (r.descriptors as unknown[]) : [];
  const descriptors: number[][] = [];
  for (
    let i = 0;
    i < Math.min(rawDescriptors.length, enrollmentPhotos.length);
    i++
  ) {
    const d = rawDescriptors[i];
    if (isFiniteVector(d)) descriptors.push(d);
    else descriptors.push(new Array<number>(DESCRIPTOR_LENGTH).fill(0));
  }

  return {
    id,
    name,
    age,
    relationship,
    description: asString(r.description, 400),
    photoAssetId: asString(r.photoAssetId, 160),
    photoThumb:
      typeof r.photoThumb === "string" && r.photoThumb.startsWith("data:image/")
        ? (r.photoThumb as string)
        : undefined,
    enrollmentPhotos,
    descriptors,
    isDemo: r.isDemo === true,
    createdAt: asString(r.createdAt, 40) ?? nowISO(),
    updatedAt: asString(r.updatedAt, 40) ?? nowISO(),
  };
}

export async function getPeople(): Promise<PersonProfile[]> {
  const raw = await dbGetAll<unknown>(STORE_PROFILES);
  const people = raw
    .map(sanitizeProfile)
    .filter((p): p is PersonProfile => p !== null)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  return people;
}

export async function getPerson(id: string): Promise<PersonProfile | undefined> {
  const raw = await dbGet<unknown>(STORE_PROFILES, id);
  return raw ? sanitizeProfile(raw) ?? undefined : undefined;
}

export async function createPerson(
  input: Omit<PersonProfile, "id" | "createdAt" | "updatedAt"> & { id?: string },
): Promise<PersonProfile> {
  const profile: PersonProfile = {
    ...input,
    id: input.id ?? generateId(),
    enrollmentPhotos: input.enrollmentPhotos ?? [],
    descriptors: input.descriptors ?? [],
    createdAt: nowISO(),
    updatedAt: nowISO(),
  };
  await dbPut(STORE_PROFILES, profile);
  return profile;
}

export async function updatePerson(
  id: string,
  patch: Partial<Omit<PersonProfile, "id" | "createdAt">>,
): Promise<PersonProfile> {
  const existing = await getPerson(id);
  if (!existing) throw new Error(`Person ${id} not found`);
  const next: PersonProfile = { ...existing, ...patch, id, updatedAt: nowISO() };
  await dbPut(STORE_PROFILES, next);
  return next;
}

export async function deletePerson(id: string): Promise<void> {
  // One transaction for assets + profile: a crash halfway must never
  // leave a profile whose photos are gone (or orphaned blobs).
  await deleteAssetsForPerson(id, true);
}

export async function clearAllData(): Promise<void> {
  await dbClear(STORE_ASSETS);
  await dbClear(STORE_PROFILES);
}

export async function countPeople(): Promise<number> {
  return dbCount(STORE_PROFILES);
}

export async function putAsset(asset: StoredAsset): Promise<void> {
  await dbPut(STORE_ASSETS, asset);
}

/** Writes many assets in ONE all-or-nothing transaction. */
export async function putAssetsBulk(assets: StoredAsset[]): Promise<void> {
  if (assets.length === 0) return;
  await dbTransactionalWrite(
    assets.map((a) => ({ store: STORE_ASSETS, type: "put" as const, value: a })),
  );
}

export async function getAsset(id: string): Promise<StoredAsset | undefined> {
  return dbGet<StoredAsset>(STORE_ASSETS, id);
}

export async function deleteAsset(id: string): Promise<void> {
  await dbDelete(STORE_ASSETS, id);
}

export async function getAllAssets(): Promise<StoredAsset[]> {
  return dbGetAll<StoredAsset>(STORE_ASSETS);
}

/**
 * Adds newly captured enrollment photos to an EXISTING person in one
 * all-or-nothing transaction (asset blobs + descriptor slots + photos).
 * Used by the add-person flow's "this looks like {name} — merge instead"
 * path so extra angles EXTEND a profile instead of spawning a duplicate.
 */
export async function appendEnrollmentPhotos(
  personId: string,
  photos: { id: string; blob: Blob; descriptor: number[] }[],
): Promise<PersonProfile> {
  const person = await getPerson(personId);
  if (!person) throw new Error("Person not found");
  if (photos.length === 0) return person;
  const ts = nowISO();
  const addedAt = ts;
  await dbTransactionalWrite([
    ...photos.map((p) => ({
      store: STORE_ASSETS,
      type: "put" as const,
      value: {
        id: p.id,
        personId,
        role: "enrollment" as const,
        blob: p.blob,
        createdAt: ts,
      } satisfies StoredAsset,
    })),
    {
      store: STORE_PROFILES,
      type: "put" as const,
      value: {
        ...person,
        enrollmentPhotos: [
          ...person.enrollmentPhotos,
          ...photos.map((p) => ({ id: p.id, addedAt })),
        ],
        descriptors: [...person.descriptors, ...photos.map((p) => p.descriptor)],
        updatedAt: ts,
      } satisfies PersonProfile,
    },
  ]);
  return (await getPerson(personId)) as PersonProfile;
}

/**
 * Merges one profile (and ALL its enrollment assets/descriptors) into
 * another, then removes the source profile — atomically. This repairs the
 * "same person enrolled twice" mistake that makes recognition flip between
 * two names depending on head angle: after the merge, the poses live in one
 * profile and the old match behavior is restored.
 */
export async function mergePersonInto(
  sourceId: string,
  targetId: string,
): Promise<PersonProfile> {
  const source = await getPerson(sourceId);
  const target = await getPerson(targetId);
  if (!source || !target) throw new Error("Person not found");
  if (sourceId === targetId) return target;
  const ts = nowISO();
  const assets = (await getAllAssets()).filter(
    (a) => a.personId === sourceId && a.role === "enrollment",
  );
  await dbTransactionalWrite([
    // Re-point every source asset at the target (same keys, one transaction).
    ...assets.map((a) => ({
      store: STORE_ASSETS,
      type: "put" as const,
      value: { ...a, personId: targetId } satisfies StoredAsset,
    })),
    // Fold the source enrollment into the target profile.
    {
      store: STORE_PROFILES,
      type: "put" as const,
      value: {
        ...target,
        enrollmentPhotos: [
          ...target.enrollmentPhotos,
          ...source.enrollmentPhotos,
        ],
        descriptors: [...target.descriptors, ...source.descriptors],
        updatedAt: ts,
      } satisfies PersonProfile,
    },
    // Drop the source profile row.
    { store: STORE_PROFILES, type: "delete" as const, key: sourceId },
  ]);
  return (await getPerson(targetId)) as PersonProfile;
}

/** Removes a specific enrollment photo + its descriptor + its stored blob.
 *  Asset deletion and profile update commit in ONE transaction so a crash
 *  halfway can never leave a profile pointing at a deleted blob. */
export async function removeEnrollmentPhoto(personId: string, photoId: string): Promise<PersonProfile> {
  const person = await getPerson(personId);
  if (!person) throw new Error("Person not found");
  const index = person.enrollmentPhotos.findIndex((p) => p.id === photoId);
  if (index === -1) return person;
  const enrollmentPhotos = person.enrollmentPhotos.slice();
  const descriptors = person.descriptors.slice();
  enrollmentPhotos.splice(index, 1);
  if (index < descriptors.length) descriptors.splice(index, 1);
  const next: PersonProfile = { ...person, enrollmentPhotos, descriptors, updatedAt: nowISO() };
  await dbTransactionalWrite([
    { store: STORE_ASSETS, type: "delete", key: photoId },
    { store: STORE_PROFILES, type: "put", value: next },
  ]);
  return next;
}

/**
 * Rebuilds descriptors from the stored enrollment blobs.
 * The callback receives each blob; failures are reported per-photo so one
 * bad image never destroys the whole profile.
 */
export async function rebuildDescriptors(
  personId: string,
  analyzeBlob: (blob: Blob) => Promise<{ descriptor: number[] }>,
): Promise<{ ok: number; failed: number }> {
  const person = await getPerson(personId);
  if (!person) throw new Error("Person not found");
  let ok = 0;
  let failed = 0;
  const descriptors: number[][] = [];
  for (const photo of person.enrollmentPhotos) {
    try {
      const asset = await getAsset(photo.id);
      if (!asset) throw new Error("Photo missing from local storage");
      const { descriptor } = await analyzeBlob(asset.blob);
      descriptors.push(descriptor);
      ok++;
    } catch {
      failed++;
    }
  }
  await updatePerson(personId, { descriptors });
  return { ok, failed };
}

export function generateId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
