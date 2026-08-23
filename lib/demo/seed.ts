import { createPerson } from "@/lib/storage/profiles";

export interface DemoSeed {
  name: string;
  relationship: string;
  age?: number;
  description: string;
}

export const DEMO_PEOPLE: DemoSeed[] = [
  {
    name: "Fatima",
    relationship: "Mother",
    age: 52,
    description: "Your mother. She enjoys gardening.",
  },
  {
    name: "Ahmed",
    relationship: "Father",
    age: 57,
    description: "Your father. He likes reading the newspaper.",
  },
  {
    name: "Sara",
    relationship: "Sister",
    age: 24,
    description: "Your sister. She calls every Sunday evening.",
  },
];

/**
 * Loads clearly-labeled demo people so judges can explore the UI without
 * uploading real photos. Demo profiles contain NO recognition descriptors —
 * they are never used by the recognition engine until real photos are added.
 */
export async function loadDemoPeople(): Promise<number> {
  for (const seed of DEMO_PEOPLE) {
    await createPerson({
      name: seed.name,
      age: seed.age,
      relationship: seed.relationship,
      description: seed.description,
      enrollmentPhotos: [],
      descriptors: [],
      isDemo: true,
    });
  }
  return DEMO_PEOPLE.length;
}
