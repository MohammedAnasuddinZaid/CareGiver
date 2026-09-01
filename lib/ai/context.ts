"use client";

/**
 * On-device context gatherer for the AI Companion.
 *
 * The companion answers real questions about the person's actual data —
 * how many people are enrolled, what reminders exist, which games they've
 * played — by reading the same local stores the rest of the app uses.
 * Everything stays on this device (IndexedDB + localStorage); nothing here
 * ever reaches a server. Failures are swallowed so the companion always
 * works even when a store is unavailable.
 */

import { getPeople } from "@/lib/storage/profiles";
import { getAllSessions, getRecentSessions } from "@/lib/storage/progress";
import { getReminders } from "@/lib/storage/reminders";
import { loadSettings } from "@/lib/settings/settings";
import { GAME_TITLES } from "@/components/games/game-meta";
import { GAME_META, SKILL_DOMAINS, type GameId, type SkillDomain } from "@/lib/games/types";

export interface DeviceContext {
  /** True when local storage/data was reachable at gather time. */
  ready: boolean;
  people: {
    total: number;
    recognized: number;
    names: string[];
  };
  reminders: {
    total: number;
    enabled: number;
    titles: string[];
    nextFew: { title: string; time: string }[];
  };
  progress: {
    gamesPlayed: number;
    uniqueGames: number;
    totalSessions: number;
    recentGames: string[];
    totalTrials: number;
    /** Up to 3 games worth trying next (weakest / least-played areas). */
    suggestedGameIds: GameId[];
    /** The domain with the most practice so far (null before any play). */
    strengthDomain: SkillDomain | null;
    /** Per-game tally for richer reports. */
    byGame: { id: GameId; title: string; sessions: number; lastPlayedAt: number }[];
    /** Fraction of all recorded turns answered correctly (null before any play). */
    accuracy: number | null;
    /** Per-domain accuracy + trend powering "am I improving?" answers. */
    domains: {
      domain: SkillDomain;
      /** Distinct sessions that touched this domain. */
      sessions: number;
      trials: number;
      accuracy: number | null;
      trend: "improving" | "steady" | "declining" | "early";
    }[];
  };
  settings: {
    voiceEnabled: boolean;
    sensitivity: string;
    theme: string;
    recognitionEnabled: boolean;
    gameCoach: boolean;
  };
}

const EMPTY: DeviceContext = {
  ready: false,
  people: { total: 0, recognized: 0, names: [] },
  reminders: { total: 0, enabled: 0, titles: [], nextFew: [] },
  progress: {
    gamesPlayed: 0,
    uniqueGames: 0,
    totalSessions: 0,
    recentGames: [],
    totalTrials: 0,
    suggestedGameIds: [],
    strengthDomain: null,
    byGame: [],
    accuracy: null,
    domains: [],
  },
  settings: {
    voiceEnabled: true,
    sensitivity: "balanced",
    theme: "light",
    recognitionEnabled: true,
    gameCoach: true,
  },
};

/**
 * Reads all relevant on-device state. Safe to call on every send — reads are
 * cheap and the data is small. Returns an EMPTY-shaped object on any failure
 * so callers never need to branch on errors.
 */
export async function gatherContext(): Promise<DeviceContext> {
  const ctx: DeviceContext = { ...structuredCloneSafe(EMPTY) };
  try {
    const [people, sessions, reminders, settings] = await Promise.all([
      getPeople(),
      getAllSessions(),
      getReminders(),
      Promise.resolve(loadSettings()),
    ]);

    ctx.ready = true;

    ctx.people.total = people.length;
    ctx.people.recognized = people.filter((p) => (p.descriptors?.length ?? 0) > 0).length;
    ctx.people.names = people
      .filter((p) => typeof p.name === "string" && p.name.trim())
      .map((p) => p.name.trim())
      .slice(0, 12);

    ctx.reminders.total = reminders.length;
    ctx.reminders.enabled = reminders.filter((r) => r.enabled).length;
    ctx.reminders.titles = reminders
      .filter((r) => r.title)
      .map((r) => r.title)
      .slice(0, 12);
    ctx.reminders.nextFew = reminders
      .filter((r) => r.enabled)
      .slice(0, 5)
      .map((r) => ({ title: r.title, time: r.onceOn ? `${r.onceOn} ${r.time}` : r.time }));

    const gameCount = new Map<string, number>();
    const lastByGame = new Map<string, number>();
    let totalTrials = 0;
    for (const s of sessions) {
      gameCount.set(s.game, (gameCount.get(s.game) ?? 0) + 1);
      totalTrials += s.trials.length;
      const t = s.startedAt ? new Date(s.startedAt).getTime() : 0;
      if (Number.isFinite(t) && t > (lastByGame.get(s.game) ?? -Infinity)) {
        lastByGame.set(s.game, t);
      }
    }
    ctx.progress.totalSessions = sessions.length;
    ctx.progress.uniqueGames = gameCount.size;
    ctx.progress.gamesPlayed = sessions.filter((s) => s.trials.length > 0).length;
    ctx.progress.totalTrials = totalTrials;
    ctx.progress.recentGames = [...gameCount.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id]) => GAME_TITLES[id as keyof typeof GAME_TITLES] ?? id);

    // Per-game tally (for richer "read my reports" answers).
    ctx.progress.byGame = [...gameCount.entries()]
      .map(([id, n]) => ({
        id: id as GameId,
        title: GAME_TITLES[id as keyof typeof GAME_TITLES] ?? id,
        sessions: n,
        lastPlayedAt: lastByGame.get(id) ?? 0,
      }))
      .sort((a, b) => b.sessions - a.sessions)
      .slice(0, 8);

    // Per-domain accuracy and trend — compare earlier turns against recent
    // turns (in play order) so "am I improving?" has a real answer to lean on.
    const domainTrack: Record<string, { sessionIds: Set<string>; correct: boolean[] }> = {};
    let correctTotal = 0;
    let trialsTotal = 0;
    for (const s of sessions) {
      for (const t of s.trials) {
        const d = domainTrack[t.domain] ?? { sessionIds: new Set<string>(), correct: [] };
        d.sessionIds.add(s.id);
        d.correct.push(t.correct === true);
        domainTrack[t.domain] = d;
      }
    }
    const domains: NonNullable<(typeof ctx.progress)["domains"]> = [];
    for (const dom of SKILL_DOMAINS) {
      const d = domainTrack[dom];
      if (!d || d.correct.length === 0) continue;
      const n = d.correct.length;
      const good = d.correct.filter(Boolean).length;
      correctTotal += good;
      trialsTotal += n;
      let trend: "improving" | "steady" | "declining" | "early" = "early";
      if (n >= 8 && d.sessionIds.size >= 2) {
        const k = Math.ceil(n * 0.4);
        const early = d.correct.slice(0, k).filter(Boolean).length / k;
        const lateArr = d.correct.slice(Math.max(k, n - k));
        const late = lateArr.length > 0 ? lateArr.filter(Boolean).length / lateArr.length : early;
        const delta = late - early;
        trend = delta >= 0.08 ? "improving" : delta <= -0.08 ? "declining" : "steady";
      }
      domains.push({
        domain: dom,
        sessions: d.sessionIds.size,
        trials: n,
        accuracy: Math.round((good / n) * 100) / 100,
        trend,
      });
    }
    domains.sort(
      (a, b) => b.sessions - a.sessions || (b.accuracy ?? 0) - (a.accuracy ?? 0),
    );
    ctx.progress.accuracy = trialsTotal > 0 ? correctTotal / trialsTotal : null;
    ctx.progress.domains = domains;

    // Which skill area has had the least practice → suggest from there.
    const domainSessions = new Map<SkillDomain, number>();
    for (const [id] of gameCount) {
      const meta = GAME_META[id as GameId];
      if (!meta) continue;
      domainSessions.set(meta.domain, (domainSessions.get(meta.domain) ?? 0) + 1);
    }
    const playedSet = new Set(gameCount.keys());
    const domainRank = (id: GameId): number => domainSessions.get(GAME_META[id].domain) ?? 0;
    const unplayed = (Object.keys(GAME_META) as GameId[])
      .filter((id) => !playedSet.has(id))
      .sort((a, b) => domainRank(a) - domainRank(b) || a.localeCompare(b));
    const played = (Object.keys(GAME_META) as GameId[])
      .filter((id) => playedSet.has(id))
      .map((id) => ({ id, last: lastByGame.get(id) ?? 0 }))
      .sort((a, b) => a.last - b.last)
      .map((x) => x.id);
    ctx.progress.suggestedGameIds = [...unplayed, ...played].slice(0, 3);

    let strengthDomain: SkillDomain | null = null;
    let strengthN = -1;
    for (const [domain, n] of domainSessions) {
      if (n > strengthN) {
        strengthN = n;
        strengthDomain = domain;
      }
    }
    ctx.progress.strengthDomain = strengthDomain;

    ctx.settings = {
      voiceEnabled: settings.voiceEnabled,
      sensitivity: settings.sensitivity,
      theme: settings.theme,
      recognitionEnabled: settings.recognitionEnabled,
      gameCoach: settings.gameCoach,
    };
  } catch {
    // Any storage hiccup → return the (possibly partial) default shape.
  }
  return ctx;
}

/** structuredClone isn't available in every target; fall back to JSON. */
function structuredCloneSafe<T>(value: T): T {
  try {
    return structuredClone(value);
  } catch {
    return JSON.parse(JSON.stringify(value)) as T;
  }
}
