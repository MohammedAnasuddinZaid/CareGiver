"use client";

import clsx from "clsx";
import {
  Droplets,
  Pill,
  Sparkles,
  Stethoscope,
} from "lucide-react";
import { useReminderSchedulerOnce } from "@/components/reminders/reminder-scheduler-provider";
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
 *
 * A `preview` override renders the exact same card without touching the
 * scheduler or log — caregivers can verify how an alert looks/feels at
 * setup time instead of waiting for the real thing.
 */
export interface ReminderPreview {
  kind: ReminderKind;
  title: string;
  note?: string;
}

export function ReminderAlertOverlay({
  preview = null,
  onPreviewDone,
}: {
  preview?: ReminderPreview | null;
  onPreviewDone?: () => void;
} = {}) {
  // Preview renders standalone and must NOT spin up (or depend on) the
  // single shared scheduler instance.
  if (preview) {
    return (
      <AlertCard
        kind={preview.kind}
        title={preview.title}
        note={preview.note}
        doneLabel={undefined}
        onDone={onPreviewDone}
      />
    );
  }
  return <LiveOverlay />;
}

function LiveOverlay() {
  const scheduler = useReminderSchedulerOnce();
  const active = scheduler?.active ?? null;
  if (!scheduler || !active) return null;
  return (
    <AlertCard
      kind={active.kind}
      title={active.title}
      note={active.note}
      onDone={() => void scheduler.markDone()}
      snoozeLabel="5 min"
      onSnooze={() => void scheduler.snooze()}
    />
  );
}

function AlertCard({
  kind,
  title,
  note,
  doneLabel,
  onDone,
  snoozeLabel,
  onSnooze,
}: {
  kind: ReminderKind;
  title: string;
  note?: string;
  /** Undefined ⇒ localized "✓ Done" default. */
  doneLabel?: undefined;
  onDone?: () => void;
  snoozeLabel?: string;
  onSnooze?: () => void;
}) {
  const { t } = useLocale();
  const Icon = KIND_ICON[kind];

  return (
    <div
      role="alert"
      className="fixed inset-x-0 bottom-20 z-[70] mx-auto w-[min(94vw,30rem)] animate-scale-in md:bottom-8"
    >
      <div
        className={clsx(
          "rounded-3xl border-2 bg-canvas p-5 shadow-lift",
          kind === "medicine" ? "border-danger/50" : "border-accent/60",
        )}
      >
        <div className="flex items-start gap-4">
          <span
            className={clsx(
              "flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl",
              kind === "medicine"
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
            {/* Never truncate: dosage details in the title/note are the
                whole point of the alert. Two lines max for layout safety. */}
            <p className="mt-0.5 line-clamp-2 text-xl font-extrabold leading-snug text-ink">
              {title}
            </p>
            {note && (
              <p className="mt-1 whitespace-pre-line break-words text-sm leading-snug text-ink-soft">
                {note}
              </p>
            )}
          </div>
        </div>
        <div className={clsx("mt-4 grid gap-2.5", onSnooze ? "grid-cols-[2fr_1fr]" : "grid-cols-1")}>
          <button
            onClick={onDone}
            className="min-h-[52px] rounded-full bg-accent px-6 py-3 text-lg font-bold text-white shadow-soft transition-transform active:scale-[0.98]"
          >
            ✓ {doneLabel ?? t("markDone")}
          </button>
          {onSnooze && (
            <button
              onClick={onSnooze}
              aria-label={`Snooze five minutes — ${title}`}
              className="min-h-[52px] rounded-full border border-line px-4 py-3 font-semibold text-ink hover:bg-surface-muted"
            >
              {snoozeLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
