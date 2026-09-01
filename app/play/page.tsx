"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Brain, CheckCircle2, Lightbulb, Sparkles } from "lucide-react";
import { prescribeDailySession } from "@/lib/games/adaptation";
import { gamesConfig } from "@/lib/games/config";
import {
  GAME_META,
  GAME_IDS,
  SKILL_DOMAINS,
  type GameId,
  type GameLevel,
  type SkillDomain,
} from "@/lib/games/types";
import { getAbilities, getRecentSessions, getAllSessions } from "@/lib/storage/progress";
import type { AbilityState, GameSession } from "@/lib/games/types";
import { useLocale } from "@/hooks/use-locale";
import { gameTitle } from "@/lib/i18n/games";
import { buildCoachReport } from "@/lib/cognition/insights";
import {
  GAME_CATEGORIES,
  GAME_ICONS,
  GAME_ROUTES,
} from "@/components/games/game-meta";

type GameLevelKey = `level${Capitalize<GameLevel>}`;
type DomainKey = `domain${Capitalize<SkillDomain>}`;

/** Builds a game route carrying the selected difficulty band. */
function gameHref(id: GameId, level: GameLevel): string {
  return `${GAME_ROUTES[id]}?level=${level}`;
}

/**
 * Play hub — the AI-prescribed daily plan up top, then the complete game
 * library organized by cognitive category. Every prescribed game is
 * badged so the player can see how today's picks relate to the library.
 */
export default function PlayPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-3xl px-4 pt-10">
          <div className="animate-pulse-soft rounded-3xl bg-surface-muted p-16" />
        </div>
      }
    >
      <PlayHub />
    </Suspense>
  );
}

function PlayHub() {
  const { t, locale } = useLocale();
  const domainLabel = (d: SkillDomain) =>
    t(`domain${d.charAt(0).toUpperCase()}${d.slice(1)}` as DomainKey);
  const searchParams = useSearchParams();
  const rawLevel = searchParams.get("level");
  const level: GameLevel = rawLevel === "easy" || rawLevel === "hard" ? rawLevel : "moderate";
  const [abilities, setAbilities] = useState<AbilityState[]>([]);
  const [sessions, setSessions] = useState<GameSession[]>([]);
  const [allSessions, setAllSessions] = useState<GameSession[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [a, s, all] = await Promise.all([
        getAbilities(),
        getRecentSessions(30),
        getAllSessions(),
      ]);
      if (!cancelled) {
        setAbilities(a);
        setSessions(s);
        setAllSessions(all);
        setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const coach = useMemo(
    () => buildCoachReport(allSessions, abilities),
    [allSessions, abilities],
  );

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

      {/* Difficulty band selector */}
      <div className="mt-5 flex flex-wrap items-center gap-2" role="group" aria-label={t("levelModerate")}>
        <span className="text-sm font-semibold text-ink-soft">{t("level")}:</span>
        {(["easy", "moderate", "hard"] as GameLevel[]).map((lv) => {
          const active = lv === level;
          return (
            <Link
              key={lv}
              href={`/play?level=${lv}`}
              aria-pressed={active}
              className={
                "rounded-full px-4 py-2 text-base font-semibold transition-all min-h-[44px] inline-flex items-center " +
                (active
                  ? "bg-accent text-white shadow-soft"
                  : "border border-line text-ink-soft hover:text-ink hover:border-accent/50")
              }
            >
              {t(`level${lv.charAt(0).toUpperCase()}${lv.slice(1)}` as GameLevelKey)}
            </Link>
          );
        })}
        <span className="ml-1 text-sm text-ink-soft">
          {level === "easy"
            ? t("easyHint")
            : level === "hard"
            ? t("hardHint")
            : t("moderateHint")}
        </span>
      </div>

      {/* ---- AI coach strip ---- */}
      {loaded && coach.insights.length > 0 && (
        <div className="mt-6 rounded-3xl border border-accent/25 bg-gradient-to-br from-accent-soft to-surface p-5 shadow-soft">
          <div className="flex items-center gap-2 text-accent">
            <Sparkles className="h-5 w-5" />
            <span className="text-sm font-bold uppercase tracking-wide">{t("aiCoach")}</span>
          </div>
          <p className="mt-2 text-lg font-semibold leading-snug text-ink">
            {coach.headline}
          </p>
          <ul className="mt-3 space-y-2">
            {coach.insights.slice(0, 2).map((ins) => (
              <li key={ins.id} className="flex items-start gap-2 text-sm text-ink-soft">
                <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                <span>{ins.detail}</span>
              </li>
            ))}
          </ul>
          {coach.insights[0]?.gameIds && coach.insights[0].gameIds!.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {coach.insights[0].gameIds!.slice(0, 3).map((g) => (
                <Link
                  key={g}
                  href={`${GAME_ROUTES[g]}?level=${coach.insights[0].level ?? "moderate"}`}
                  className="rounded-full bg-accent px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-accent-strong"
                >
                  {gameTitle(g, locale)}
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ---- Today's plan ---- */}
      {remaining.length === 0 && (
        <div className="mt-8 flex flex-col items-center gap-4 rounded-3xl border border-line bg-surface p-8 text-center shadow-soft">
          <CheckCircle2 className="h-14 w-14 text-ok" />
          <h2 className="text-2xl font-bold text-ink">{t("sessionComplete")}</h2>
          <p className="max-w-sm text-base leading-relaxed text-ink-soft">
            {t("planComplete")}
          </p>
        </div>
      )}

      {remaining.length > 0 ? (
        <>
          {/* Next up — primary action */}
          <NextGameCard
            gameId={remaining[0]}
            reason={prescription.reasons[remaining[0]] ?? ""}
            level={level}
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
                href={gameHref(id, level)}
                aria-label={
                  done
                    ? `${gameTitle(id, locale)} — ${t("completedToday")}. ${t("playAgain")}`
                    : gameTitle(id, locale)
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
                    {gameTitle(id, locale)}
                  </span>
                  <span className="block text-sm text-ink-soft">
                    {domainLabel(meta.domain)} · ~{gamesConfig.sessions.itemsPerSession}{" "}
                    {t("itemsWord")} · {prescription.reasons[id]}
                  </span>
                </span>
                {done && (
                  <>
                    <CheckCircle2 className="h-6 w-6 shrink-0 text-ok" />
                    <span className="sr-only">{t("completedToday")}</span>
                  </>
                )}
              </Link>
            </li>
          );
        })}
      </ol>

      {/* ---- Full library by category ---- */}
      <h2 className="mb-1 mt-12 text-2xl font-bold tracking-tight text-ink">
        {t("allGames")}
      </h2>
      <p className="mb-6 text-base text-ink-soft">
        {GAME_IDS.length} {t("libraryExercises")} across {SKILL_DOMAINS.length}{" "}
        {t("librarySkills")}. {t("libraryBadged")}.
      </p>

      {GAME_CATEGORIES.map((category) => {
        const games = (Object.keys(GAME_META) as GameId[]).filter(
          (id) => GAME_META[id].category === category.id,
        );
        return (
          <section key={category.id} className="mt-7" aria-label={t(category.titleKey)}>
            <div className="mb-3 flex items-baseline justify-between gap-3">
              <h3 className="text-lg font-bold text-ink">
                {t(category.titleKey)}
              </h3>
              <p className="text-sm text-ink-soft">{t(category.blurbKey)}</p>
            </div>
            <div className="reveal-stagger grid grid-cols-2 gap-3 sm:grid-cols-3">
              {games.map((id) => (
                <LibraryCard
                  key={id}
                  gameId={id}
                  planned={plannedSet.has(id)}
                  level={level}
                />
              ))}
            </div>
          </section>
        );
      })}

      <p className="mt-10 text-center text-sm leading-relaxed text-ink-soft">
        {t("footnote")}
      </p>
    </div>
  );
}

function LibraryCard({
  gameId,
  planned,
  level,
}: {
  gameId: GameId;
  planned: boolean;
  level: GameLevel;
}) {
  const { t, locale } = useLocale();
  const Icon = GAME_ICONS[gameId];
  const meta = GAME_META[gameId];
  const domainLabel = (d: SkillDomain) =>
    t(`domain${d.charAt(0).toUpperCase()}${d.slice(1)}` as DomainKey);
  return (
    <Link
      href={gameHref(gameId, level)}
      className={
        "gradient-ring group relative flex flex-col gap-2 rounded-2xl border-2 bg-surface p-4 shadow-soft transition-all hover:-translate-y-1 hover:shadow-lift active:scale-[0.98] " +
        (planned ? "border-accent/70" : "border-line")
      }
    >
      {planned && (
        <span className="glow-pulse absolute -top-2.5 right-3 rounded-full bg-accent px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white shadow-soft">
          {t("todayBadge")}
        </span>
      )}
      <span
        className={
          "flex h-11 w-11 items-center justify-center rounded-xl transition-all duration-300 group-hover:scale-110 group-hover:rotate-3 " +
          (planned ? "bg-accent text-white" : "bg-accent-soft text-accent")
        }
      >
        <Icon className="h-6 w-6" />
      </span>
      <span className="text-base font-bold leading-tight text-ink">
        {gameTitle(gameId, locale)}
      </span>
      <span className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
        {domainLabel(meta.domain)}
        {meta.secondaryDomains.length > 0 &&
          ` + ${meta.secondaryDomains.map(domainLabel).join(", ")}`}
      </span>
    </Link>
  );
}

function NextGameCard({
  gameId,
  reason,
  level,
}: {
  gameId: GameId;
  reason: string;
  level: GameLevel;
}) {
  const { t, locale } = useLocale();
  const Icon = GAME_ICONS[gameId];
  return (
    <Link
      href={gameHref(gameId, level)}
      className="btn-sheen group relative mt-8 block overflow-hidden rounded-[2rem] border border-accent/30 bg-surface shadow-lift transition-transform active:scale-[0.99]"
    >
      {/* Drifting aurora glow behind the card content */}
      <div aria-hidden className="absolute inset-0 opacity-70">
        <div className="aurora-blob aurora-blob-a -left-16 top-6 h-44 w-44 bg-accent/20" />
        <div className="aurora-blob aurora-blob-b -right-10 bottom-0 h-40 w-40 bg-secondary-fixed/30" />
      </div>
      <div className="relative flex items-center gap-5 p-6 md:p-7">
        <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-3xl bg-accent text-white shadow-soft transition-all duration-300 group-hover:scale-110 group-hover:rotate-3">
          <Icon className="h-10 w-10" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-bold uppercase tracking-widest text-accent">
            {t("upNext")} · {t("why")}: {reason}
          </span>
          <span className="mt-1 block truncate text-2xl font-extrabold text-ink">
            {gameTitle(gameId, locale)}
          </span>
          <span className="mt-1 block text-base text-ink-soft">
            ~{Math.round(gamesConfig.sessions.itemsPerSession * 0.7)} {t("minutes")}
          </span>
        </span>
      </div>
      <div className="bg-accent relative px-6 py-4 text-center text-lg font-bold text-white transition-colors group-hover:bg-accent-strong">
        {t("startSession")}
      </div>
    </Link>
  );
}
