"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  collectDueReminders,
  markReminderDone as persistDone,
} from "@/lib/storage/reminders";
import type { Reminder } from "@/lib/games/types";
import { useSettings } from "./use-settings";
import { LOCALE_META } from "@/lib/i18n/locales";

export interface ActiveAlert extends Reminder {
  dueKey: string;
}

/**
 * Reminder delivery engine.
 *
 * Polls local scheduling math every 15 s while the app is open (the PWA is
 * used docked/kiosk-style by caregivers), announces via voice + optional
 * Notification API, and requires an explicit "Done" so missed doses are
 * observable in analytics.
 */
export function useReminderScheduler() {
  const { settings } = useSettings();
  const [active, setActive] = useState<ActiveAlert | null>(null);
  const [permission, setPermission] =
    useState<NotificationPermission>("default");
  const lastSpokenRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    if (typeof Notification !== "undefined") setPermission(Notification.permission);
  }, []);

  const requestPermission = useCallback(async (): Promise<void> => {
    if (typeof Notification === "undefined") return;
    try {
      setPermission(await Notification.requestPermission());
    } catch {
      // Denials are fine — in-app alerts still work.
    }
  }, []);

  // Polling tick.
  useEffect(() => {
    let cancelled = false;
    const tick = async (): Promise<void> => {
      if (cancelled || document.hidden) return;
      try {
        const due = await collectDueReminders();
        if (cancelled) return;
        setActive((prev) => {
          if (prev) return prev; // one at a time; queue drains on resolve
          if (due.length === 0) return null;
          const r = due[0];
          return { ...r, dueKey: `${r.id}:${r.time}` };
        });
      } catch {
        // Storage hiccup — retry next tick.
      }
    };
    void tick();
    const interval = window.setInterval(() => void tick(), 15_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  // Voice announcement with per-reminder cooldown.
  useEffect(() => {
    if (!active || !settings.voiceEnabled) return;
    const now = Date.now();
    const last = lastSpokenRef.current.get(active.dueKey) ?? 0;
    if (now - last < 60_000) return;
    lastSpokenRef.current.set(active.dueKey, now);

    if (settings.soundCues && typeof Audio !== "undefined") {
      try {
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.value = 660;
        gain.gain.setValueAtTime(0.14, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.5);
        osc.connect(gain).connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.52);
        osc.onended = () => void ctx.close();
      } catch {}
    }

    try {
      if ("speechSynthesis" in window) {
        const u = new SpeechSynthesisUtterance(
          `${active.title}. ${kindPhrase(active.kind)}`,
        );
        u.lang = LOCALE_META[settings.locale as keyof typeof LOCALE_META]?.speechTag ?? "en-IN";
        u.rate = settings.speechRate === "slow" ? 0.85 : 1;
        window.speechSynthesis.speak(u);
      }
    } catch {}

    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      try {
        new Notification(active.title, {
          body: kindPhrase(active.kind),
          tag: active.dueKey,
        });
      } catch {}
    }
  }, [active, settings.voiceEnabled, settings.soundCues, settings.locale, settings.speechRate]);

  const markDone = useCallback(async (): Promise<void> => {
    if (!active) return;
    await persistDone(active.id);
    setActive(null);
  }, [active]);

  const snooze = useCallback((): void => {
    if (!active) return;
    // Re-queue after 5 minutes without logging a "done".
    const id = active.id;
    setActive(null);
    window.setTimeout(
      () =>
        setActive((prev) =>
          prev ? prev : { ...active, dueKey: `${id}:snooze:${Date.now()}` },
        ),
      5 * 60_000,
    );
  }, [active]);

  return { active, markDone, snooze, permission, requestPermission };
}

function kindPhrase(kind: string): string {
  switch (kind) {
    case "medicine":
      return "It is time for medicine.";
    case "hydration":
      return "Please drink a glass of water.";
    case "appointment":
      return "There is an appointment today.";
    default:
      return "Time for your activity.";
  }
}
