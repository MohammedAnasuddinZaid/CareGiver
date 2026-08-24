"use client";

import clsx from "clsx";
import {
  Droplets,
  Pill,
  Sparkles,
  Stethoscope,
} from "lucide-react";
import { useReminderScheduler } from "@/hooks/use-reminder-scheduler";
import type { ReminderKind } from "@/lib/games/types";
import { useLocale } from "@/hooks/use-locale";

const KIND_ICON: Record<ReminderKind, React.ComponentType<{ className?: string }>> = {
  medicine: Pill,
  hydration: Droplets,
  activity: Sparkles,
  appointment: Stethoscope,
};

/**
 * Full-width calm alert shown on any screen when a reminder comes due.
 * Requires explicit confirmation ("Done") so adherence is measurable;
 * snooze re-fires after five minutes without logging completion.
 */
export function ReminderAlertOverlay() {
  const { active, markDone, snooze } = useReminderScheduler();
  const { t } = useLocale();
  if (!active) return null;
  const Icon = KIND_ICON[active.kind];

  return (
    <div
      role="alert"
      className="fixed inset-x-0 bottom-20 z-[70] mx-auto w-[min(94vw,30rem)] animate-scale-in md:bottom-8"
    >
      <div
        className={clsx(
          "rounded-3xl border-2 bg-canvas p-5 shadow-lift",
          active.kind === "medicine" ? "border-danger/50" : "border-accent/60",
        )}
      >
        <div className="flex items-start gap-4">
          <span
            className={clsx(
              "flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl",
              active.kind === "medicine"
                ? "bg-danger/10 text-danger"
                : "bg-accent-soft text-accent",
            )}
          >
            <Icon className="h-7 w-7" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-widest text-accent">
              {t("dueNow")}
            </p>
            <p className="mt-0.5 truncate text-xl font-extrabold text-ink">
              {active.title}
            </p>
            {active.note && (
              <p className="mt-0.5 truncate text-sm text-ink-soft">{active.note}</p>
            )}
          </div>
        </div>
        <div className="mt-4 grid grid-cols-[2fr_1fr] gap-2.5">
          <button
            onClick={() => void markDone()}
            className="min-h-[52px] rounded-full bg-accent px-6 py-3 text-lg font-bold text-white shadow-soft transition-transform active:scale-[0.98]"
          >
            ✓ {t("markDone")}
          </button>
          <button
            onClick={snooze}
            aria-label="Snooze five minutes"
            className="min-h-[52px] rounded-full border border-line px-4 py-3 font-semibold text-ink hover:bg-surface-muted"
          >
            5 min
          </button>
        </div>
      </div>
    </div>
  );
}
