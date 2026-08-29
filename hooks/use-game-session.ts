"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { gamesConfig } from "@/lib/games/config";
import { GAME_META } from "@/lib/games/types";
import type {
  AbilityState,
  GameId,
  GameSession,
  SkillDomain,
} from "@/lib/games/types";
import {
  advanceStaircase,
  applyTrial,
  detectFatigue,
  newAbilityState,
  newStaircase,
  staircaseDifficulty,
} from "@/lib/cognition/traits";
import {
  clearAbilities,
  getAbilities,
  newSessionId,
  pruneSessions,
  saveAbility,
  saveSession,
} from "@/lib/storage/progress";
import type { GameLevel } from "@/lib/games/types";

export type GameStatus = "loading" | "active" | "summary";

interface UseGameSessionArgs {
  game: GameId;
  /** Player-chosen difficulty band — seeds the adaptive staircase. */
  level?: GameLevel;
}

export interface SessionSummary {
  correctCount: number;
  totalTrials: number;
  accuracy: number;
  endedEarly: boolean;
  thetaBefore: number | null;
  thetaAfter: number | null;
}

/** Outcome a game reports for a single answered item. */
export interface TrialOutcome {
  correct: boolean;
  /** Hints/corrections used before success (0 = clean). */
  hintsUsed?: number;
}

interface UseGameSessionArgs {
  game: GameId;
}

/**
 * Runs one adaptive game session.
 *
 * Owns all psychometrics: pulls the stored ability state, adapts item
 * difficulty within-session via a staircase, folds every trial back into
 * θ, persists the session + updated abilities, and ends kindly when the
 * fatigue heuristic fires. Games only decide *what* to show and report
 * outcomes through completeTrial().
 */
export function useGameSession({ game, level = "moderate" }: UseGameSessionArgs) {
  const domain: SkillDomain = GAME_META[game].domain;
  const levelConfig = gamesConfig.levels[level];

  const [status, setStatus] = useState<GameStatus>("loading");
  const [theta, setTheta] = useState(0);
  const [itemIndex, setItemIndex] = useState(0);
  const [difficulty, setDifficulty] = useState(0);
  const [summary, setSummary] = useState<SessionSummary | null>(null);

  const abilityRef = useRef<AbilityState | null>(null);
  const staircaseRef = useRef(newStaircase());
  const trialsRef = useRef<
    {
      itemId: string;
      difficulty: number;
      correct: boolean;
      rtMs: number;
      hintsUsed: number;
      at: string;
    }[]
  >([]);
  const startedAtRef = useRef<string>("");
  const itemIdRef = useRef<string>("");
  const t0Ref = useRef<number>(0);
  const endedEarlyRef = useRef(false);
  const finishedRef = useRef(false);

  // Load stored ability for this GAME, seed the session.
  // Keyed on `game`, not `domain`: three games share each domain, so a
  // same-domain navigation must NOT inherit the previous game's trials,
  // staircase or summary state.
  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    void (async () => {
      let ability: AbilityState | undefined = (
        await getAbilities()
      ).find((a) => a.domain === domain);
      ability ??= newAbilityState(domain, new Date().toISOString());

      if (cancelled) return;
      abilityRef.current = ability;
      staircaseRef.current = newStaircase();
      // Seed the staircase at the chosen band's offset (clamped internally).
      staircaseRef.current.offset = Math.min(
        gamesConfig.staircase.maxOffsetFromTheta,
        Math.max(-gamesConfig.staircase.maxOffsetFromTheta, levelConfig.startOffset),
      );
      trialsRef.current = [];
      startedAtRef.current = new Date().toISOString();
      finishedRef.current = false;
      endedEarlyRef.current = false;
      setTheta(ability.theta);
      setDifficulty(staircaseDifficulty(staircaseRef.current, ability.theta));
      setItemIndex(0);
      setSummary(null);
      setStatus("active");
    })();
    return () => {
      cancelled = true;
    };
  }, [game, domain]);

  /** Games call when an item is presented so response timing starts here. */
  const startTrial = useCallback((itemId: string): void => {
    itemIdRef.current = itemId.slice(0, 160);
    t0Ref.current =
      typeof performance !== "undefined" ? performance.now() : Date.now();
  }, []);

  const finish = useCallback(async (): Promise<void> => {
    if (finishedRef.current) return;
    finishedRef.current = true;

    const before = abilityRef.current;
    const nowISO = new Date().toISOString();
    let after = before ?? newAbilityState(domain, nowISO);

    const primary = trialsRef.current.filter((t) => t.difficulty !== undefined).length;
    for (const t of trialsRef.current) {
      after = applyTrial(after, t, nowISO);
    }

    const correctCount = trialsRef.current.filter((t) => t.correct).length;
    const total = Math.max(1, primary);

    const session: GameSession = {
      id: newSessionId(),
      game,
      startedAt: startedAtRef.current,
      endedAt: nowISO,
      trials: trialsRef.current.map((t) => ({
        ...t,
        game,
        domain,
      })),
      thetaAfter: { [domain]: after.theta },
      completion: Math.min(1, trialsRef.current.length / levelConfig.itemsPerSession),
      endedEarly: endedEarlyRef.current,
    };

    try {
      await saveSession(session);
      await saveAbility(after);
      void pruneSessions();
    } catch {
      // Storage hiccup must never trap the player on a broken screen.
    }

    setSummary({
      correctCount,
      totalTrials: trialsRef.current.length,
      accuracy: correctCount / total,
      endedEarly: endedEarlyRef.current,
      thetaBefore: before?.theta ?? null,
      thetaAfter: after.theta,
    });
    setTheta(after.theta);
    setStatus("summary");
  }, [domain, game]);

  /**
   * Records one outcome, advances the staircase and schedules fatigue
   * checks. Returns nothing; re-renders deliver the next difficulty.
   */
  const completeTrial = useCallback(
    (outcome: TrialOutcome): void => {
      if (finishedRef.current || status !== "active") return;
      const nowMs =
        typeof performance !== "undefined" ? performance.now() : Date.now();
      const rtMs = Math.max(
        150,
        Math.min(600_000, Math.round(nowMs - t0Ref.current)),
      );

      trialsRef.current.push({
        itemId: itemIdRef.current || `${game}-item-${itemIndex}`,
        difficulty,
        correct: outcome.correct,
        rtMs,
        hintsUsed: outcome.hintsUsed ?? 0,
        at: new Date().toISOString(),
      });

      advanceStaircase(staircaseRef.current, outcome.correct);

      const planned = levelConfig.itemsPerSession;
      const nextIndex = itemIndex + 1;

      // Fatigue: compare recent median RT vs earlier baseline, kind ending.
      const rts = trialsRef.current.map((t) => t.rtMs);
      const half = Math.floor(rts.length / 2);
      const shouldEndForFatigue =
        nextIndex >= planned ||
        (rts.length >= gamesConfig.sessions.minimumItemsBeforeFatigueEnd * 2 &&
          detectFatigue(rts.slice(half), rts.slice(0, Math.max(half, 3))));

      if (shouldEndForFatigue) {
        endedEarlyRef.current = nextIndex < planned;
        void finish();
        return;
      }

      setItemIndex(nextIndex);
      setDifficulty(staircaseDifficulty(staircaseRef.current, theta));
    },
    [difficulty, finish, game, itemIndex, status, theta],
  );

  const quit = useCallback((): void => {
    if (status === "active") void finish();
  }, [finish, status]);

  const resetAllProgress = useMemo(
    () =>
      async function resetAll(): Promise<void> {
        await clearAbilities();
      },
    [],
  );

  return {
    status,
    domain,
    itemIndex,
    totalItems: levelConfig.itemsPerSession,
    difficulty,
    theta,
    startTrial,
    completeTrial,
    finish,
    quit,
    summary,
    resetAllProgress,
  };
}
