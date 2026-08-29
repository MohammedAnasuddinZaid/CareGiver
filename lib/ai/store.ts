"use client";

/**
 * On-device memory for the AI Companion. Everything lives in the browser
 * (localStorage) — nothing is ever uploaded. The companion "learns" about the
 * person over time: what they enjoy, what feels hard, their mood — and uses it
 * to personalise help. Privacy-first by construction.
 */

export interface AIProfile {
  /** Preferred name the person asked the companion to use. */
  name: string | null;
  /** Lowercased game id or skill domain -> how often it felt hard. */
  struggles: Record<string, number>;
  /** Lowercased game id or skill domain -> how often it was enjoyed. */
  loves: Record<string, number>;
  /** Rolling mood estimate in [-1, 1]; dips on sadness/anxiety, rises on joy. */
  mood: number;
  /** Free-text things the person shared (capped). */
  notes: string[];
  /** Total conversational turns — used to soften tone for new vs. regular users. */
  turns: number;
  lastSeen: number;
}

const KEY = "ma.ai.profile.v1";

export function emptyProfile(): AIProfile {
  return { name: null, struggles: {}, loves: {}, mood: 0, notes: [], turns: 0, lastSeen: 0 };
}

export function loadProfile(): AIProfile {
  if (typeof window === "undefined") return emptyProfile();
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return emptyProfile();
    const parsed = JSON.parse(raw) as Partial<AIProfile>;
    return { ...emptyProfile(), ...parsed };
  } catch {
    return emptyProfile();
  }
}

export function saveProfile(p: AIProfile): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* storage full / disabled — companion still works for this session */
  }
}

export function resetProfile(): AIProfile {
  const fresh = emptyProfile();
  saveProfile(fresh);
  return fresh;
}

/** Immutable helper: merge a partial learning patch into a profile. */
export function applyPatch(base: AIProfile, patch: Partial<AIProfile>): AIProfile {
  const next: AIProfile = {
    ...base,
    struggles: { ...base.struggles },
    loves: { ...base.loves },
    notes: [...base.notes],
  };
  if (patch.name !== undefined) next.name = patch.name;
  if (patch.mood !== undefined) next.mood = Math.max(-1, Math.min(1, patch.mood));
  if (patch.struggles) {
    for (const [k, v] of Object.entries(patch.struggles)) {
      next.struggles[k] = (next.struggles[k] ?? 0) + v;
    }
  }
  if (patch.loves) {
    for (const [k, v] of Object.entries(patch.loves)) {
      next.loves[k] = (next.loves[k] ?? 0) + v;
    }
  }
  if (patch.notes) {
    next.notes = [...next.notes, ...patch.notes].slice(-12);
  }
  if (patch.turns !== undefined) next.turns = patch.turns;
  next.lastSeen = Date.now();
  return next;
}
