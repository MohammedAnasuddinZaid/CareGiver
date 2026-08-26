"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import clsx from "clsx";
import { Home, PartyPopper, X } from "lucide-react";
import { useLocale } from "@/hooks/use-locale";
import type { SessionSummary } from "@/hooks/use-game-session";

/**
 * Shared chrome for every cognitive game: calm instruction banner,
 * progress rail, quit affordance and the celebration summary.
 * Games render only their stage inside.
 */

export interface GameChromeProps {
  title: string;
  instruction: string;
  current: number;
  total: number;
  onQuit: () => void;
  children: React.ReactNode;
}

export function GameChrome({
  title,
  instruction,
  current,
  total,
  onQuit,
  children,
}: GameChromeProps) {
  const { n } = useLocale();
  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-3xl flex-col px-4 pb-16 pt-6 md:pt-10">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight text-ink">{title}</h1>
        <button
          onClick={onQuit}
          aria-label="Leave game"
          className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-line text-ink-soft transition-colors hover:bg-surface-muted hover:text-ink"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <p className="mt-2 rounded-2xl bg-accent-soft px-4 py-3 text-lg font-medium leading-snug text-ink">
        {instruction}
      </p>

      {/* Progress rail */}
      <div
        className="mt-4 flex items-center gap-1.5"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={current}
        aria-label={`${n(current)} / ${n(total)}`}
      >
        {Array.from({ length: total }, (_, i) => (
          <span
            key={i}
            className={clsx(
              "h-2 flex-1 rounded-full transition-colors",
              i < current ? "bg-accent" : i === current ? "bg-accent/45" : "bg-line",
            )}
          />
        ))}
      </div>
      <p className="mt-1.5 text-sm text-ink-soft">
        {n(Math.min(current + 1, total))} / {n(total)}
      </p>

      <div className="mt-5 flex-1">{children}</div>
    </div>
  );
}

export function BigChoice({
  label,
  emoji,
  selected,
  state,
  onClick,
}: {
  label: string;
  emoji?: string;
  selected?: boolean;
  state?: "correct" | "wrong" | null;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        "flex min-h-[88px] select-none flex-col items-center justify-center gap-1 rounded-3xl border-2 bg-surface px-4 py-4 shadow-soft transition-all active:scale-[0.97]",
        selected ? "border-accent ring-4 ring-accent/15" : "border-line",
        state === "correct" && "border-ok! bg-ok/10!",
        state === "wrong" && "border-danger/60 bg-danger/5 opacity-60",
      )}
    >
      {emoji && <span className="text-4xl leading-none">{emoji}</span>}
      <span className="text-lg font-semibold leading-tight text-ink">{label}</span>
    </button>
  );
}

/** Full-screen gentle feedback flash after each answer. */
export function FeedbackFlash({ kind }: { kind: "correct" | "wrong" | null }) {
  if (!kind) return null;
  return (
    <div
      role="status"
      className={clsx(
        "pointer-events-none fixed inset-x-0 top-20 z-40 mx-auto w-fit rounded-full px-6 py-2.5 text-xl font-bold shadow-lift animate-fade-in",
        kind === "correct" ? "bg-ok/95 text-white" : "bg-warn/95 text-white",
      )}
    >
      {kind === "correct" ? "✓ Well done!" : "✗ Try again"}
    </div>
  );
}

export interface SummaryViewProps {
  summary: SessionSummary;
  isLast?: boolean;
}

export function SummaryView({ summary }: SummaryViewProps) {
  const { t, n } = useLocale();
  const pct = Math.round(summary.accuracy * 100);
  return (
    <div className="mx-auto flex min-h-[80vh] w-full max-w-md flex-col items-center justify-center gap-6 px-6 text-center animate-fade-up">
      <div className="flex h-24 w-24 items-center justify-center rounded-full bg-accent-soft">
        <PartyPopper className="h-12 w-12 text-accent" />
      </div>
      <h1 className="text-3xl font-bold text-ink">{t("sessionComplete")}</h1>
      <div className="w-full rounded-3xl border border-line bg-surface p-6 shadow-soft">
        <p className="text-lg font-semibold text-ink">{t("scoreOf")}</p>
        <p className="mt-1 text-6xl font-extrabold tabular-nums text-accent">
          {n(pct)}%
        </p>
        <p className="mt-2 text-base text-ink-soft">
          {n(summary.correctCount)} / {n(summary.totalTrials)}
        </p>
      </div>
      <div className="flex w-full flex-col gap-3">
        <Link
          href="/play"
          className="inline-flex min-h-[56px] items-center justify-center rounded-full bg-accent px-8 py-3.5 text-lg font-bold text-white shadow-soft transition-all hover:bg-accent-strong active:scale-[0.98]"
        >
          {t("todaysPlan")}
        </Link>
        <Link
          href="/"
          className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-full border border-line px-8 py-3 text-lg font-semibold text-ink transition-colors hover:bg-surface-muted"
        >
          <Home className="h-5 w-5" />
          MemoryAssist
        </Link>
      </div>
      <p className="max-w-xs text-sm leading-relaxed text-ink-soft">
        {summary.endedEarly
          ? "You did wonderfully today — rest is part of the exercise."
          : "Every session keeps your mind active."}
      </p>
    </div>
  );
}

/** Two-step quit confirm that never interrupts flow accidentally. */
export function QuitDialog({
  open,
  onStay,
  onLeave,
}: {
  open: boolean;
  onStay: () => void;
  onLeave: () => void;
}) {
  const { t } = useLocale();
  const panelRef = useRef<HTMLDivElement>(null);

  // True modal behavior: move focus in, cycle Tab inside, restore on
  // close — keyboard/Switch-access players must never tab into the game
  // behind this dialog.
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    panel?.querySelector<HTMLElement>("button")?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onStay();
        return;
      }
      if (e.key === "Tab" && panel) {
        const focusables = Array.from(
          panel.querySelectorAll<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
          ),
        ).filter((el) => !el.hasAttribute("disabled"));
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previous?.focus?.();
    };
  }, [open, onStay]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/35 p-4 sm:items-center">
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={t("quitConfirm")}
        className="w-full max-w-sm rounded-3xl border border-line bg-canvas p-6 shadow-lift animate-scale-in"
      >
        <p className="text-xl font-bold text-ink">{t("quitConfirm")}</p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button
            onClick={onStay}
            autoFocus
            className="min-h-[52px] rounded-2xl bg-accent px-4 py-3 text-lg font-bold text-white transition-transform active:scale-[0.97]"
          >
            {t("stay")}
          </button>
          <button
            onClick={onLeave}
            className="min-h-[52px] rounded-2xl border border-line px-4 py-3 text-lg font-semibold text-ink hover:bg-surface-muted"
          >
            {t("leave")}
          </button>
        </div>
      </div>
    </div>
  );
}
