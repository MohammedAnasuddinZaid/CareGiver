"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";
import { GAME_IDS } from "@/lib/games/types";
import type { GameId } from "@/lib/games/types";
import { useGameSession } from "@/hooks/use-game-session";
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

const INSTRUCTIONS: Record<GameId, string> = {
  faces: "Look at the photo — who is this person?",
  names: "Remember each face and name — they will ask you after a while.",
  memorylane: "Travel back in time — remember the old, happy days.",
  market: "First remember the basket. Then find every item on the shelf.",
  routine: "Tap the cards in the order they happen in your morning.",
  loom: "The strip follows a pattern. Choose what comes next.",
  drums: "Tap when you hear the drum 🥁 — stay still for the horn 📣",
  soundmatch: "Listen to the sound, then tap what made it.",
  spatial: "Watch where things are placed, then find the one asked for.",
  pairs: "Flip two cards at a time and find every matching pair.",
  bazaar: "Add the prices, then choose the correct change.",
  oddone: "One picture does not belong with the rest — tap it.",
  sortit: "Send each item to its right basket.",
  stroop: "Tap the COLOR of the text, not what the word says.",
  trail: "Tap the numbers in order: 1, 2, 3…",
  melody: "Listen to the tune, then tap the same notes back.",
};

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
};

const TITLES: Record<GameId, string> = {
  faces: "Who Is In The Photo?",
  names: "Remembering Names",
  memorylane: "Memory Lane",
  market: "Market Basket",
  pairs: "Card Pairs",
  melody: "Repeat the Tune",
  drums: "Festival Drums",
  soundmatch: "Sound Match",
  stroop: "Color Trap",
  trail: "Number Trail",
  routine: "Morning Routine",
  loom: "Pattern Loom",
  oddone: "Odd One Out",
  sortit: "Sorting Station",
  bazaar: "Bazaar Maths",
  spatial: "Where Did I Keep It?",
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

  return <GameHost gameId={slug as GameId} />;
}

function GameHost({ gameId }: { gameId: GameId }) {
  const session = useGameSession({ game: gameId });
  const [confirmQuit, setConfirmQuit] = useState(false);
  const Stage = GAME_COMPONENTS[gameId];

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
        title={TITLES[gameId]}
        instruction={INSTRUCTIONS[gameId]}
        current={session.itemIndex}
        total={session.totalItems}
        onQuit={() => setConfirmQuit(true)}
      >
        <Stage
          difficulty={session.difficulty}
          itemKey={session.itemIndex + 1}
          startTrial={session.startTrial}
          completeTrial={session.completeTrial}
        />
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
