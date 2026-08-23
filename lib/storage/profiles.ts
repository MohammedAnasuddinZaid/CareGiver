import { isFiniteVector } from "@/lib/recognition/metrics";
import { DESCRIPTOR_LENGTH } from "@/lib/recognition/config";
import {
  dbClear,
  dbCount,
  dbDelete,
  dbGet,
  dbGetAll,
  dbPut,
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
  await deleteAssetsForPerson(id);
  await dbDelete(STORE_PROFILES, id);
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

export async function getAsset(id: string): Promise<StoredAsset | undefined> {
  return dbGet<StoredAsset>(STORE_ASSETS, id);
}

export async function deleteAsset(id: string): Promise<void> {
  await dbDelete(STORE_ASSETS, id);
}

export async function getAllAssets(): Promise<StoredAsset[]> {
  return dbGetAll<StoredAsset>(STORE_ASSETS);
}

/** Removes a specific enrollment photo + its descriptor + its stored blob. */
export async function removeEnrollmentPhoto(personId: string, photoId: string): Promise<PersonProfile> {
  const person = await getPerson(personId);
  if (!person) throw new Error("Person not found");
  const index = person.enrollmentPhotos.findIndex((p) => p.id === photoId);
  if (index === -1) return person;
  const enrollmentPhotos = person.enrollmentPhotos.slice();
  const descriptors = person.descriptors.slice();
  enrollmentPhotos.splice(index, 1);
  if (index < descriptors.length) descriptors.splice(index, 1);
  await deleteAsset(photoId);
  return updatePerson(personId, { enrollmentPhotos, descriptors });
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
