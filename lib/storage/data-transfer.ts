import { DESCRIPTOR_LENGTH } from "@/lib/recognition/config";
import { isFiniteVector } from "@/lib/recognition/metrics";
import type { EnrollmentPhoto, PersonProfile } from "@/lib/types/person";
import { generateId } from "./profiles";

export const EXPORT_SCHEMA_VERSION = 1;

export interface ImportedAsset {
  personId: string;
  assetId: string;
  role: "profile" | "enrollment";
  blob: Blob;
}

export interface ImportResult {
  profiles: PersonProfile[];
  assets: ImportedAsset[];
  skipped: string[];
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function validDataUrl(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^data:image\/(png|jpeg|jpg|webp);base64,/.test(value) &&
    value.length < 12_000_000
  );
}

export function dataUrlToBlob(dataURL: string): Blob {
  const [meta, base64] = dataURL.split(",");
  if (!base64) throw new Error("Invalid data URL");
  const mime = /:(.*?);/.exec(meta)?.[1] ?? "application/octet-stream";
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

/**
 * Strict validation of an untrusted backup file.
 * Malformed entries are skipped with human-readable reasons — one bad record
 * never prevents the rest from being restored, and nothing here executes
 * content from the file.
 *
 * Invariant kept for every restored profile:
 *   descriptors.length === enrollmentPhotos.length
 * so index-based edits stay consistent later.
 */
export function validateAndParseImport(raw: unknown): ImportResult {
  const result: ImportResult = { profiles: [], assets: [], skipped: [] };

  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    result.skipped.push("File is not a MemoryAssist backup.");
    return result;
  }
  const bundle = raw as Record<string, unknown>;
  if (bundle.app !== "MemoryAssist") {
    result.skipped.push("This file was not exported from MemoryAssist.");
    return result;
  }
  if (
    typeof bundle.schemaVersion !== "number" ||
    bundle.schemaVersion > EXPORT_SCHEMA_VERSION ||
    bundle.schemaVersion <= 0
  ) {
    result.skipped.push("Backup schema version isn’t compatible with this app.");
    return result;
  }
  if (!Array.isArray(bundle.profiles)) {
    result.skipped.push("Backup contains no profile list.");
    return result;
  }
  if (bundle.profiles.length > 500) {
    result.skipped.push("Backup is too large to restore safely.");
    return result;
  }

  bundle.profiles.forEach((entry, index) => {
    const label = `Person #${index + 1}`;
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      result.skipped.push(`${label}: invalid structure.`);
      return;
    }
    const p = entry as Record<string, unknown>;

    const name = asString(p.name)?.trim();
    if (!name || name.length > 80) {
      result.skipped.push(`${label}: missing or invalid name.`);
      return;
    }
    const relationship = asString(p.relationship)?.trim();
    if (!relationship || relationship.length > 60) {
      result.skipped.push(`${label} (${name}): missing or invalid relationship.`);
      return;
    }
    let age: number | undefined;
    if (p.age !== undefined && p.age !== null) {
      if (typeof p.age !== "number" || !Number.isInteger(p.age) || p.age < 0 || p.age > 130) {
        result.skipped.push(`${label} (${name}): invalid age.`);
        return;
      }
      age = p.age;
    }
    const description = asString(p.description)?.slice(0, 400);
    if (!Array.isArray(p.descriptors)) {
      result.skipped.push(`${label} (${name}): missing recognition data.`);
      return;
    }
    // NB: wrapped in an arrow — passing isFiniteVector directly would leak
    // the array index into its optional `length` argument.
    const rawDescriptors = p.descriptors.filter((d) => isFiniteVector(d)).map((d) => d.slice());
    const rawPhotoRefs = Array.isArray(p.enrollmentPhotos) ? p.enrollmentPhotos : [];
    if (rawPhotoRefs.length > 20) {
      result.skipped.push(`${label} (${name}): too many recognition photos.`);
      return;
    }
    if (rawDescriptors.length === 0) {
      result.skipped.push(
        `${label} (${name}): no usable recognition data — restored without recognition.`,
      );
    }

    const id = generateId();
    const photosRecord =
      p.photos && typeof p.photos === "object" && !Array.isArray(p.photos)
        ? (p.photos as Record<string, unknown>)
        : {};

    const enrollmentPhotos: EnrollmentPhoto[] = [];
    const descriptors: number[][] = [];

    // Descriptors and photo refs are parallel arrays in exports.
    const count = Math.min(rawDescriptors.length, rawPhotoRefs.length);
    for (let i = 0; i < count; i++) {
      const ref = rawPhotoRefs[i] as Record<string, unknown> | null;
      const dataUrl = ref && typeof ref === "object" ? photosRecord[String(ref.id)] : undefined;
      if (!validDataUrl(dataUrl)) continue;
      try {
        const blob = dataUrlToBlob(dataUrl);
        const photoId = generateId();
        enrollmentPhotos.push({
          id: photoId,
          addedAt: asString((ref as Record<string, unknown>).addedAt) ?? new Date().toISOString(),
        });
        descriptors.push(rawDescriptors[i]);
        result.assets.push({ personId: id, assetId: photoId, role: "enrollment", blob });
      } catch {
        result.skipped.push(`${label} (${name}): a photo couldn’t be decoded.`);
      }
    }

    let photoAssetId: string | undefined;
    let photoThumb: string | undefined;
    const mainPhoto = photosRecord.profile ?? photosRecord[name];
    if (validDataUrl(mainPhoto)) {
      try {
        const assetId = `${id}-profile`;
        result.assets.push({
          personId: id,
          assetId,
          role: "profile",
          blob: dataUrlToBlob(mainPhoto),
        });
        photoAssetId = assetId;
        photoThumb = mainPhoto.length < 400_000 ? mainPhoto : undefined;
      } catch {
        result.skipped.push(`${label} (${name}): profile photo couldn’t be decoded.`);
      }
    }

    result.profiles.push({
      id,
      name,
      age,
      relationship,
      description,
      photoAssetId,
      photoThumb,
      enrollmentPhotos,
      descriptors,
      isDemo: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  });

  return result;
}
