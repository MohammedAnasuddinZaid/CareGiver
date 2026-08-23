import { RELATIONSHIPS } from "@/lib/types/person";

export function greetingForHour(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function capitalize(value: string): string {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/**
 * Natural relationship display for the Companion user.
 * "Mother" -> "Your Mother". Custom text the caregiver typed is used as-is
 * unless it clearly needs the possessive prefix.
 */
export function relationshipPhrase(relationship: string): string {
  const trimmed = (relationship || "").trim();
  if (!trimmed) return "";
  const lower = trimmed.toLowerCase();
  if (
    lower.startsWith("your ") ||
    lower.startsWith("my ") ||
    lower.startsWith("our ")
  ) {
    return capitalize(trimmed);
  }
  if (RELATIONSHIPS.includes(trimmed as (typeof RELATIONSHIPS)[number])) {
    return `Your ${trimmed}`;
  }
  return `Your ${capitalize(trimmed)}`;
}

/** Phrase spoken by voice guidance. */
export function spokenIdentityPhrase(name: string, relationship: string): string {
  const phrase = relationshipPhrase(relationship);
  if (!phrase) return `${name}.`;
  return `${name}. ${phrase}.`;
}

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

const AVATAR_TONES = [
  "bg-teal-700",
  "bg-indigo-700",
  "bg-rose-700",
  "bg-amber-600",
  "bg-emerald-700",
  "bg-violet-700",
] as const;

export function avatarTone(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_TONES[hash % AVATAR_TONES.length];
}
