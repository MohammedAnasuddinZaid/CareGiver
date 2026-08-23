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
import type { PersonProfile } from "@/lib/types/person";

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

export async function getPeople(): Promise<PersonProfile[]> {
  const people = await dbGetAll<PersonProfile>(STORE_PROFILES);
  return people.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export async function getPerson(id: string): Promise<PersonProfile | undefined> {
  return dbGet<PersonProfile>(STORE_PROFILES, id);
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
 * The callback receives progress updates; failures are reported per-photo so
 * one bad image never destroys the whole profile.
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
