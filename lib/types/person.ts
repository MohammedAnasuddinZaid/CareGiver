export const RELATIONSHIPS = [
  "Mother",
  "Father",
  "Grandmother",
  "Grandfather",
  "Brother",
  "Sister",
  "Son",
  "Daughter",
  "Spouse",
  "Friend",
  "Caregiver",
  "Other",
] as const;

export type Relationship = (typeof RELATIONSHIPS)[number];

export interface EnrollmentPhoto {
  id: string;
  addedAt: string;
}

export interface PersonProfile {
  id: string;
  name: string;
  age?: number;
  relationship: string;
  description?: string;
  photoAssetId?: string;
  photoThumb?: string;
  enrollmentPhotos: EnrollmentPhoto[];
  descriptors: number[][];
  isDemo?: boolean;
  createdAt: string;
  updatedAt: string;
}

export type RecognitionReadiness = "not-enrolled" | "processing" | "ready";

export function readinessOf(profile: PersonProfile): RecognitionReadiness {
  if (profile.descriptors.length > 0) return "ready";
  return "not-enrolled";
}
