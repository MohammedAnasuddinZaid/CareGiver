"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Brain, CheckCircle2 } from "lucide-react";
import { prescribeDailySession } from "@/lib/games/adaptation";
import { gamesConfig } from "@/lib/games/config";
import {
  GAME_META,
  SKILL_DOMAINS,
  type GameId,
} from "@/lib/games/types";
import { getAbilities, getRecentSessions } from "@/lib/storage/progress";
import type { AbilityState, GameSession } from "@/lib/games/types";
import { useLocale } from "@/hooks/use-locale";
import {
  GAME_CATEGORIES,
  GAME_ICONS,
  GAME_ROUTES,
  GAME_TITLES,
} from "@/components/games/game-meta";

/**
 * Play hub — the AI-prescribed daily plan up top, then the complete game
 * library organized by cognitive category. Every prescribed game is
 * badged so the player can see how today's picks relate to the library.
 */
export default function PlayPage() {
  const { t } = useLocale();
  const [abilities, setAbilities] = useState<AbilityState[]>([]);
  const [sessions, setSessions] = useState<GameSession[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [a, s] = await Promise.all([getAbilities(), getRecentSessions(30)]);
      if (!cancelled) {
        setAbilities(a);
        setSessions(s);
        setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const prescription = useMemo(
    () => prescribeDailySession(abilities, sessions),
    // Recompute only when data changes — never mid-session.
    [abilities, sessions],
  );

  // Progress comes from REAL sessions played since local midnight — never
  // from click order, so tapping item 3 never checks off items 1–2 and a
  // finished game can't appear as "up next" again.
  const playedToday = useMemo(() => {
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    const t0 = dayStart.getTime();
    return new Set(
      sessions
        .filter((s) => Number.isFinite(Date.parse(s.startedAt)) && Date.parse(s.startedAt) >= t0)
        .map((s) => s.game),
    );
  }, [sessions]);

  if (!loaded) {
    return (
      <div className="mx-auto max-w-3xl px-4 pt-10">
        <div className="animate-pulse-soft rounded-3xl bg-surface-muted p-16" />
      </div>
    );
  }

  const remaining = prescription.games.filter((id) => !playedToday.has(id));
  const plannedSet = new Set(prescription.games);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-24 pt-8 md:pt-12">
      <div className="flex items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-soft">
          <Brain className="h-8 w-8 text-accent" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-ink">
            {t("playTitle")}
          </h1>
          <p className="text-base text-ink-soft">{t("playSubtitle")}</p>
        </div>
      </div>

      {/* ---- Today's plan ---- */}
      {remaining.length === 0 && (
        <div className="mt-8 flex flex-col items-center gap-4 rounded-3xl border border-line bg-surface p-8 text-center shadow-soft">
          <CheckCircle2 className="h-14 w-14 text-ok" />
          <h2 className="text-2xl font-bold text-ink">{t("sessionComplete")}</h2>
          <p className="max-w-sm text-base leading-relaxed text-ink-soft">
            Today&apos;s plan is complete. You can still play any game below —
            or come back tomorrow for a fresh plan.
          </p>
        </div>
      )}

      {remaining.length > 0 ? (
        <>
          {/* Next up — primary action */}
          <NextGameCard
            gameId={remaining[0]}
            reason={prescription.reasons[remaining[0]] ?? ""}
          />
        </>
      ) : null}

      <h2 className="mb-3 mt-8 text-lg font-bold uppercase tracking-wide text-ink-soft">
        {t("todaysPlan")}
      </h2>
      <ol className="space-y-2.5">
        {prescription.games.map((id) => {
          const Icon = GAME_ICONS[id];
          const meta = GAME_META[id];
          const done = playedToday.has(id);
          return (
            <li key={id}>
              <Link
                href={GAME_ROUTES[id]}
                aria-label={
                  done
                    ? `${GAME_TITLES[id]} — completed today. Play again`
                    : GAME_TITLES[id]
                }
                className={
                  "flex items-center gap-4 rounded-2xl border bg-surface p-4 transition-all hover:shadow-soft " +
                  (done ? "border-ok/50" : "border-line")
                }
              >
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
                  <Icon className="h-6 w-6" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-lg font-bold text-ink">
                    {GAME_TITLES[id]}
                  </span>
                  <span className="block text-sm text-ink-soft">
                    {meta.domain} · ~{gamesConfig.sessions.itemsPerSession}{" "}
                    items · {prescription.reasons[id]}
                  </span>
                </span>
                {done && (
                  <>
                    <CheckCircle2 className="h-6 w-6 shrink-0 text-ok" />
                    <span className="sr-only">Completed today</span>
                  </>
                )}
              </Link>
            </li>
          );
        })}
      </ol>

      {/* ---- Full library by category ---- */}
      <h2 className="mb-1 mt-12 text-2xl font-bold tracking-tight text-ink">
        All games
      </h2>
      <p className="mb-6 text-base text-ink-soft">
        Twelve gentle exercises across four skills. Badged games are in
        today&apos;s plan.
      </p>

      {GAME_CATEGORIES.map((category) => {
        const games = (Object.keys(GAME_META) as GameId[]).filter(
          (id) => GAME_META[id].category === category.id,
        );
        return (
          <section key={category.id} className="mt-7" aria-label={category.titleKey}>
            <div className="mb-3 flex items-baseline justify-between gap-3">
              <h3 className="text-lg font-bold text-ink">
                {t(category.titleKey)}
              </h3>
              <p className="text-sm text-ink-soft">{category.blurb}</p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {games.map((id) => (
                <LibraryCard
                  key={id}
                  gameId={id}
                  planned={plannedSet.has(id)}
                />
              ))}
            </div>
          </section>
        );
      })}

      <p className="mt-10 text-center text-sm leading-relaxed text-ink-soft">
        Short daily sessions work best — twice a day if you enjoy them.
        Everything runs on this device.
      </p>
    </div>
  );
}

function LibraryCard({
  gameId,
  planned,
}: {
  gameId: GameId;
  planned: boolean;
}) {
  const Icon = GAME_ICONS[gameId];
  const meta = GAME_META[gameId];
  return (
    <Link
      href={GAME_ROUTES[gameId]}
      className={
        "group relative flex flex-col gap-2 rounded-2xl border-2 bg-surface p-4 shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-lift active:scale-[0.98] " +
        (planned ? "border-accent/70" : "border-line")
      }
    >
      {planned && (
        <span className="absolute -top-2.5 right-3 rounded-full bg-accent px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white shadow-soft">
          Today
        </span>
      )}
      <span
        className={
          "flex h-11 w-11 items-center justify-center rounded-xl transition-colors " +
          (planned ? "bg-accent text-white" : "bg-accent-soft text-accent")
        }
      >
        <Icon className="h-6 w-6" />
      </span>
      <span className="text-base font-bold leading-tight text-ink">
        {GAME_TITLES[gameId]}
      </span>
      <span className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
        {meta.domain}
        {meta.secondaryDomains.length > 0 && ` + ${meta.secondaryDomains.join(", ")}`}
      </span>
    </Link>
  );
}

function NextGameCard({
  gameId,
  reason,
}: {
  gameId: GameId;
  reason: string;
}) {
  const { t } = useLocale();
  const Icon = GAME_ICONS[gameId];
  return (
    <Link
      href={GAME_ROUTES[gameId]}
      className="group mt-8 block overflow-hidden rounded-[2rem] border border-line bg-surface shadow-lift transition-transform active:scale-[0.99]"
    >
      <div className="flex items-center gap-5 p-6 md:p-7">
        <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-3xl bg-accent text-white shadow-soft transition-transform group-hover:scale-105">
          <Icon className="h-10 w-10" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-bold uppercase tracking-widest text-accent">
            Up next · why: {reason}
          </span>
          <span className="mt-1 block truncate text-2xl font-extrabold text-ink">
            {GAME_TITLES[gameId]}
          </span>
          <span className="mt-1 block text-base text-ink-soft">
            ~{Math.round(gamesConfig.sessions.itemsPerSession * 0.7)} {t("minutes")}
          </span>
        </span>
      </div>
      <div className="bg-accent px-6 py-4 text-center text-lg font-bold text-white transition-colors group-hover:bg-accent-strong">
        {t("startSession")}
      </div>
    </Link>
  );
}
