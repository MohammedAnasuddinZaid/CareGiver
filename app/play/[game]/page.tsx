"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { GAME_IDS, GAME_META } from "@/lib/games/types";
import type { GameId } from "@/lib/games/types";
import { useSettings } from "@/hooks/use-settings";
import { useGameSession } from "@/hooks/use-game-session";
import { gamesConfig } from "@/lib/games/config";
import {
  GameChrome,
  QuitDialog,
  SummaryView,
} from "@/components/games/game-shell";
import { FacesGame } from "@/components/games/faces-game";
import { NamesGame } from "@/components/games/names-game";
import { MemoryLaneGame } from "@/components/games/memorylane-game";
import { MarketGame } from "@/components/games/market-game";
import { RoutineGame } from "@/components/games/routine-game";
import { LoomGame } from "@/components/games/loom-game";
import { DrumsGame } from "@/components/games/drums-game";
import { SoundMatchGame } from "@/components/games/soundmatch-game";
import { SpatialGame } from "@/components/games/spatial-game";
import { PairsGame } from "@/components/games/pairs-game";
import { BazaarGame } from "@/components/games/bazaar-game";
import { OddOneGame } from "@/components/games/oddone-game";
import { SortItGame } from "@/components/games/sortit-game";
import { StroopGame } from "@/components/games/stroop-game";
import { TrailGame } from "@/components/games/trail-game";
import { MelodyGame } from "@/components/games/melody-game";
import { SequenceGame } from "@/components/games/sequence-game";
import { ClockGame } from "@/components/games/clock-game";
import { SpotGame } from "@/components/games/spot-game";
import { WordRecallGame } from "@/components/games/wordrecall-game";
import { FollowGame } from "@/components/games/follow-game";
import { ShadowGame } from "@/components/games/shadow-game";
import { ReactionGame } from "@/components/games/reaction-game";
import { WordBuilderGame } from "@/components/games/wordbuilder-game";
import { CategoryGame } from "@/components/games/category-game";
import { EmotionGame } from "@/components/games/emotion-game";
import { TargetGame } from "@/components/games/target-game";
import { OrderGame } from "@/components/games/order-game";
import { GameCoach } from "@/components/games/game-coach";
import { useLocale } from "@/hooks/use-locale";
import { gameInstruction, gameTitle } from "@/lib/i18n/games";

const GAME_COMPONENTS: Record<
  GameId,
  React.ComponentType<import("@/components/games/faces-game").GameStageProps>
> = {
  faces: FacesGame,
  names: NamesGame,
  memorylane: MemoryLaneGame,
  market: MarketGame,
  routine: RoutineGame,
  loom: LoomGame,
  drums: DrumsGame,
  soundmatch: SoundMatchGame,
  spatial: SpatialGame,
  pairs: PairsGame,
  bazaar: BazaarGame,
  oddone: OddOneGame,
  sortit: SortItGame,
  stroop: StroopGame,
  trail: TrailGame,
  melody: MelodyGame,
  sequence: SequenceGame,
  clock: ClockGame,
  spot: SpotGame,
  wordrecall: WordRecallGame,
  follow: FollowGame,
  shadow: ShadowGame,
  reaction: ReactionGame,
  wordbuilder: WordBuilderGame,
  category: CategoryGame,
  emotion: EmotionGame,
  target: TargetGame,
  order: OrderGame,
};

/**
 * Single dynamic host route for all six games. Keeps one session runner
 * and one shell; games only supply their stage component.
 */
export default function PlayGamePage() {
  const params = useParams<{ game: string }>();
  const slug = typeof params.game === "string" ? params.game : "";

  if (!(GAME_IDS as readonly string[]).includes(slug)) {
    return (
      <div className="mx-auto max-w-md px-4 pt-20 text-center">
        <h1 className="text-2xl font-bold text-ink">Game not found</h1>
        <Link href="/play" className="mt-4 inline-block rounded-full bg-accent px-6 py-3 font-bold text-white">
          Back to Mind Games
        </Link>
      </div>
    );
  }

  return (
    <Suspense fallback={<div className="mx-auto max-w-3xl px-4 pt-10"><div className="animate-pulse-soft rounded-3xl bg-surface-muted p-16" /></div>}>
      <GameHost gameId={slug as GameId} />
    </Suspense>
  );
}

function GameHost({ gameId }: { gameId: GameId }) {
  const searchParams = useSearchParams();
  const rawLevel = searchParams.get("level");
  const level = rawLevel === "easy" || rawLevel === "hard" ? rawLevel : "moderate";
  const session = useGameSession({ game: gameId, level });
  const { settings } = useSettings();
  const { locale } = useLocale();
  const [confirmQuit, setConfirmQuit] = useState(false);
  const [coachTrials, setCoachTrials] = useState<{ correct: boolean }[]>([]);
  const Stage = GAME_COMPONENTS[gameId];
  const domain = GAME_META[gameId].domain;

  // Fresh coach slate each time a session round (re)starts.
  useEffect(() => {
    if (session.status === "summary") setCoachTrials([]);
  }, [session.status]);

  const completeTrial = useCallback(
    (o: { correct: boolean; hintsUsed?: number }) => {
      setCoachTrials((t) => [...t, { correct: o.correct }]);
      session.completeTrial(o);
    },
    [session],
  );

  // Leave-guard: finishing mid-game routes through finish() so θ updates persist.
  useEffect(() => {
    if (session.status !== "active") return;
    const onBeforeUnload = (e: BeforeUnloadEvent): void => {
      // Chrome needs preventDefault(); Safari/older Chrome need returnValue.
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [session.status]);

  if (session.status === "loading" || session.status === undefined) {
    return (
      <div className="mx-auto max-w-3xl px-4 pt-10">
        <div className="animate-pulse-soft rounded-3xl bg-surface-muted p-16" />
      </div>
    );
  }

  if (session.status === "summary" && session.summary) {
    return <SummaryView summary={session.summary} />;
  }

  return (
    <>
      <GameChrome
        title={gameTitle(gameId, locale)}
        instruction={gameInstruction(gameId, locale)}
        badge={gamesConfig.levels[level].label}
        current={session.itemIndex}
        total={session.totalItems}
        onQuit={() => setConfirmQuit(true)}
      >
        <Stage
          difficulty={session.difficulty}
          itemKey={session.itemIndex + 1}
          startTrial={session.startTrial}
          completeTrial={completeTrial}
        />
        {settings.gameCoach && (
          <GameCoach gameId={gameId} trials={coachTrials} domain={domain} />
        )}
      </GameChrome>
      <QuitDialog
        open={confirmQuit}
        onStay={() => setConfirmQuit(false)}
        onLeave={() => {
          setConfirmQuit(false);
          session.quit();
        }}
      />
    </>
  );
}
