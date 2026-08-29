import {
  getAllSessions,
  getAbilities,
  saveAbility,
  saveSession,
  sanitizeSession,
} from "./progress";
import { getReminders, saveReminder, sanitizeReminder } from "./reminders";
import {
  sanitizeAbility,
} from "./progress";
import type { AbilityState, GameSession, Reminder } from "@/lib/games/types";

/**
 * Full activity backup — every cognitive datapoint we track, serialized to a
 * single JSON file the user can keep private on their own device.
 *
 * Nothing here ever touches the network: the file is built locally with
 * `Blob`/`URL.createObjectURL` and restored the same way. No IP address, no
 * server, no account — privacy is the product.
 */

export const PROGRESS_BACKUP_VERSION = 1;

export interface ProgressBackup {
  app: "MemoryAssist";
  schemaVersion: number;
  kind: "progress";
  exportedAt: string;
  abilities: AbilityState[];
  sessions: GameSession[];
  reminders: Reminder[];
}

export function buildProgressBackup(
  abilities: AbilityState[],
  sessions: GameSession[],
  reminders: Reminder[],
): ProgressBackup {
  return {
    app: "MemoryAssist",
    schemaVersion: PROGRESS_BACKUP_VERSION,
    kind: "progress",
    exportedAt: new Date().toISOString(),
    abilities,
    sessions,
    reminders,
  };
}

export function downloadText(filename: string, text: string, mime = "application/json"): void {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export function downloadBackup(backup: ProgressBackup): void {
  downloadText(
    `memoryassist-progress-${backup.exportedAt.slice(0, 10)}.json`,
    JSON.stringify(backup),
  );
}

export interface ImportResult {
  ok: boolean;
  sessions: number;
  abilities: number;
  reminders: number;
  skipped: string[];
}

/**
 * Restores a progress backup. Writes go through the same sanitizing storage
 * layer as live play, so a malformed field can never corrupt the store.
 * Replaces the current progress stores (the backup is a point-in-time copy).
 */
export async function importProgressBackup(raw: unknown): Promise<ImportResult> {
  const result: ImportResult = {
    ok: false,
    sessions: 0,
    abilities: 0,
    reminders: 0,
    skipped: [],
  };

  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    result.skipped.push("File is not a MemoryAssist progress backup.");
    return result;
  }
  const bundle = raw as Record<string, unknown>;
  if (bundle.app !== "MemoryAssist" || bundle.kind !== "progress") {
    result.skipped.push("This file is not a MemoryAssist progress backup.");
    return result;
  }

  const sessions = Array.isArray(bundle.sessions) ? bundle.sessions : [];
  const abilities = Array.isArray(bundle.abilities) ? bundle.abilities : [];
  const reminders = Array.isArray(bundle.reminders) ? bundle.reminders : [];

  // Replace semantics: write the backup wholesale. Sanitizers already guard
  // every field; we just count what survived.
  for (const s of sessions) {
    const clean = sanitizeSession(s);
    if (clean) {
      await saveSession(clean);
      result.sessions++;
    }
  }
  for (const a of abilities) {
    const clean = sanitizeAbility(a);
    if (clean) {
      await saveAbility(clean);
      result.abilities++;
    }
  }
  for (const r of reminders) {
    const clean = sanitizeReminder(r);
    if (clean) {
      // Drop the id so saveReminder assigns a fresh one (avoids clobbering
      // an equally-valid local reminder that happens to share an id).
      const { id: _drop, createdAt: _c, updatedAt: _u, ...rest } = clean;
      void _drop;
      void _c;
      void _u;
      await saveReminder(rest);
      result.reminders++;
    }
  }

  result.ok = result.sessions + result.abilities + result.reminders > 0;
  if (!result.ok && result.skipped.length === 0) {
    result.skipped.push("The backup contained no readable progress records.");
  }
  return result;
}
