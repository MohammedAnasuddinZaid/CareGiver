"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import {
  CalendarClock,
  Check,
  Droplets,
  Pill,
  Plus,
  Sparkles,
  Stethoscope,
  Trash2,
} from "lucide-react";
import {
  deleteReminder,
  getReminders,
  saveReminder,
} from "@/lib/storage/reminders";
import { REMINDER_KINDS } from "@/lib/games/types";
import type { Reminder, ReminderKind } from "@/lib/games/types";
import { useLocale } from "@/hooks/use-locale";
import {
  Modal,
} from "@/components/ui/modal";
import {
  ReminderAlertOverlay,
} from "@/components/reminders/reminder-alert-overlay";

const KIND_ICON: Record<ReminderKind, React.ComponentType<{ className?: string }>> = {
  medicine: Pill,
  hydration: Droplets,
  activity: Sparkles,
  appointment: Stethoscope,
};

const KIND_TINT: Record<ReminderKind, string> = {
  medicine: "bg-danger/10 text-danger",
  hydration: "bg-accent/10 text-accent",
  activity: "bg-ok/10 text-ok",
  appointment: "bg-warn/10 text-warn",
};

export default function RemindersPage() {
  const { t } = useLocale();
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [editing, setEditing] = useState<Partial<Reminder> | null>(null);
  const [preview, setPreview] = useState<{ kind: ReminderKind; title: string } | null>(null);
  const [permission, setPermission] = useState<NotificationPermission>("default");

  useEffect(() => {
    if (typeof Notification !== "undefined") setPermission(Notification.permission);
  }, []);

  const enableNotifications = useCallback(async (): Promise<void> => {
    if (typeof Notification === "undefined") return;
    try {
      setPermission(await Notification.requestPermission());
    } catch {
      // Denied — in-app alerts still work.
    }
  }, []);

  const reload = useCallback(async (): Promise<void> => {
    setReminders(await getReminders());
    setLoaded(true);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const kindLabel = useCallback(
    (kind: ReminderKind): string => {
      switch (kind) {
        case "medicine":
          return t("reminderMedicine");
        case "hydration":
          return t("reminderHydration");
        case "activity":
          return t("reminderActivity");
        default:
          return t("reminderAppointment");
      }
    },
    [t],
  );

  const remove = async (id: string): Promise<void> => {
    await deleteReminder(id);
    await reload();
  };

  if (!loaded) {
    return (
      <div className="mx-auto max-w-3xl px-4 pt-10">
        <div className="animate-pulse-soft rounded-3xl bg-surface-muted p-16" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-24 pt-8 md:pt-12">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-soft">
            <CalendarClock className="h-8 w-8 text-accent" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-ink">
              {t("remindersTitle")}
            </h1>
            <p className="text-base text-ink-soft">Medicine · Water · Activities · Appointments</p>
          </div>
        </div>
      </div>

      <button
        onClick={() => setEditing({ kind: "medicine", days: [0,1,2,3,4,5,6], time: "09:00", enabled: true })}
        className="mt-6 inline-flex min-h-[52px] items-center gap-2 rounded-full bg-accent px-6 py-3 text-lg font-bold text-white shadow-soft transition-all hover:bg-accent-strong active:scale-[0.98]"
      >
        <Plus className="h-5 w-5" />
        {t("addReminder")}
      </button>

      {reminders.length === 0 ? (
        <div className="mt-8 rounded-3xl border border-dashed border-line bg-surface p-10 text-center">
          <CalendarClock className="mx-auto h-10 w-10 text-ink-soft" />
          <p className="mt-3 text-lg font-semibold text-ink">{t("noReminders")}</p>
          <p className="mt-1 text-base text-ink-soft">
            Caregivers can add medicine times, water breaks and appointments.
          </p>
        </div>
      ) : (
        <ul className="mt-6 space-y-2.5">          {reminders.map((r) => {
            const Icon = KIND_ICON[r.kind];
            return (
              <li
                key={r.id}
                className="flex items-center gap-4 rounded-2xl border border-line bg-surface p-4 shadow-soft"
              >
                <span
                  className={clsx(
                    "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl",
                    KIND_TINT[r.kind],
                  )}
                >
                  <Icon className="h-6 w-6" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-lg font-bold text-ink">{r.title}</p>
                  <p className="text-sm text-ink-soft">
                    {kindLabel(r.kind)} ·{" "}
                    {r.onceOn ?? (r.days.length === 7 ? t("everyDay") : r.days.map((d) => ["Su","Mo","Tu","We","Th","Fr","Sa"][d]).join(" "))}{" "}
                    · {r.time}
                    {!r.enabled && " · paused"}
                  </p>
                </div>
                <button
                  onClick={() => setEditing(r)}
                  aria-label="Edit reminder"
                  className="min-h-[44px] rounded-full px-4 py-2 font-semibold text-accent hover:bg-surface-muted"
                >
                  Edit
                </button>
                <button
                  onClick={() => void remove(r.id)}
                  aria-label="Delete reminder"
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full text-ink-soft hover:bg-danger/10 hover:text-danger"
                >
                  <Trash2 className="h-5 w-5" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {/* Setup confidence: show the real alert card without waiting. */}
      <div className="mt-8 flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-line bg-surface-muted p-5">
        <div>
          <p className="text-base font-bold text-ink">Check how alerts appear</p>
          <p className="text-sm text-ink-soft">
            Preview the exact reminder your loved one will see — no waiting needed.
          </p>
        </div>
        <button
          onClick={() =>
            setPreview({ kind: "medicine", title: "Blood pressure tablet" })
          }
          className="min-h-[48px] rounded-full border border-accent/50 bg-accent-soft px-5 py-2.5 text-base font-bold text-accent transition-colors hover:bg-accent hover:text-white"
        >
          Preview alert
        </button>
      </div>

      {/* Rendered ONLY while previewing — the live alert already renders
          once via the shared scheduler; a second instance would stack. */}
      {preview && (
        <ReminderAlertOverlay
          preview={preview}
          onPreviewDone={() => setPreview(null)}
        />
      )}

      {editing && (
        <ReminderEditor
          draft={editing}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await reload();
          }}
        />
      )}

      {permission === "default" && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-line bg-surface p-5">
          <div>
            <p className="text-base font-bold text-ink">System notifications</p>
            <p className="text-sm text-ink-soft">
              Let the browser raise an alert even when this tab is in the background.
            </p>
          </div>
          <button
            onClick={() => void enableNotifications()}
            className="min-h-[48px] rounded-full border border-line bg-surface px-5 py-2.5 text-base font-bold text-ink transition-colors hover:border-accent hover:text-accent"
          >
            Enable
          </button>
        </div>
      )}
    </div>
  );
}

function ReminderEditor({
  draft,
  onClose,
  onSaved,
}: {
  draft: Partial<Reminder>;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const { t } = useLocale();
  const [title, setTitle] = useState(draft.title ?? "");
  const [kind, setKind] = useState<ReminderKind>(draft.kind ?? "medicine");
  const [time, setTime] = useState(draft.time ?? "09:00");
  const [onceOn, setOnceOn] = useState(draft.onceOn ?? "");
  const [everyDay, setEveryDay] = useState(!draft.onceOn);
  const [note, setNote] = useState(draft.note ?? "");

  const canSave = title.trim().length > 0 && /^\d{2}:\d{2}$/.test(time);

  return (
    <Modal open onClose={onClose} title={draft.id ? "Edit reminder" : t("addReminder")}>
      <div className="space-y-5">
        {/* Kind selector */}
        <div className="grid grid-cols-4 gap-2">
          {REMINDER_KINDS.map((k) => {
            const Icon = KIND_ICON[k];
            return (
              <button
                key={k}
                onClick={() => setKind(k)}
                className={clsx(
                  "flex min-h-[64px] flex-col items-center justify-center gap-1 rounded-2xl border-2 p-2 text-xs font-bold transition-colors",
                  kind === k
                    ? "border-accent! bg-accent-soft! text-accent"
                    : "border-line text-ink-soft hover:bg-surface-muted",
                )}
              >
                <Icon className="h-5 w-5" />
                {k === "medicine" && t("reminderMedicine")}
                {k === "hydration" && t("reminderHydration")}
                {k === "activity" && t("reminderActivity")}
                {k === "appointment" && t("reminderAppointment")}
              </button>
            );
          })}
        </div>

        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-ink-soft">What</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={120}
            placeholder={
              kind === "medicine"
                ? "Blood pressure tablet"
                : kind === "hydration"
                  ? "Glass of water"
                  : kind === "appointment"
                    ? "Dr. Sharma visit"
                    : "Evening walk"
            }
            className="w-full rounded-2xl border border-line bg-surface px-4 py-3 text-lg font-medium text-ink outline-none focus:border-accent focus:ring-4 focus:ring-accent/10"
          />
        </label>

        <div className="grid grid-cols-2 gap-4">
          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-ink-soft">Time</span>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-full rounded-2xl border border-line bg-surface px-4 py-3 text-lg text-ink outline-none focus:border-accent"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-ink-soft">
              {t("onceLabel")} (optional)
            </span>
            <input
              type="date"
              value={onceOn}
              onChange={(e) => {
                setOnceOn(e.target.value);
                setEveryDay(!e.target.value);
              }}
              disabled={!everyDay && !onceOn}
              className="w-full rounded-2xl border border-line bg-surface px-4 py-3 text-lg text-ink outline-none focus:border-accent disabled:opacity-40"
            />
          </label>
        </div>

        <label className="flex items-center justify-between rounded-2xl border border-line px-4 py-3">
          <span className="text-base font-semibold text-ink">{t("everyDay")}</span>
          <input
            type="checkbox"
            checked={everyDay}
            onChange={(e) => {
              setEveryDay(e.target.checked);
              if (e.target.checked) setOnceOn("");
            }}
            className="h-6 w-6 accent-[rgb(var(--ma-accent))]"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-ink-soft">{t("reminderNote")}</span>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={300}
            className="w-full rounded-2xl border border-line bg-surface px-4 py-3 text-base text-ink outline-none focus:border-accent"
          />
        </label>

        <div className="grid grid-cols-[1fr_auto] gap-3 pt-1">
          <button
            disabled={!canSave}
            onClick={async () => {
              await saveReminder({
                id: draft.id,
                kind,
                title: title.trim(),
                time,
                days: everyDay || onceOn ? [0,1,2,3,4,5,6] : draft.days ?? [0,1,2,3,4,5,6],
                onceOn: onceOn || undefined,
                note: note.trim() || undefined,
                enabled: true,
              });
              await onSaved();
            }}
            className={clsx(
              "inline-flex min-h-[56px] items-center justify-center gap-2 rounded-full px-8 py-3 text-lg font-bold text-white transition-all",
              canSave
                ? "bg-accent hover:bg-accent-strong active:scale-[0.98]"
                : "cursor-not-allowed bg-ink-soft/30",
            )}
          >
            <Check className="h-5 w-5" />
            {t("saveReminder")}
          </button>
          <button
            onClick={onClose}
            className="rounded-full border border-line px-6 py-3 text-lg font-semibold text-ink hover:bg-surface-muted"
          >
            ✕
          </button>
        </div>
      </div>
    </Modal>
  );
}
