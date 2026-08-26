"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  collectDueReminders,
  markReminderEventDone,
  snoozeReminderEvent,
} from "@/lib/storage/reminders";
import type { Reminder } from "@/lib/games/types";
import { useSettings } from "./use-settings";
import { LOCALE_META } from "@/lib/i18n/locales";

export interface ActiveAlert extends Reminder {
  /** Stable id of the due-slot — keys voice cooldown + persistence. */
  dueKey: string;
}

/**
 * Reminder delivery engine.
 *
 * Polls local scheduling math every 15 s while the app is open (the PWA is
 * used docked/kiosk-style by caregivers), announces via voice + optional
 * Notification API, and requires an explicit "Done" so missed doses are
 * observable in analytics.
 *
 * Reliability model (medication-grade): the collector re-delivers any
 * unresolved slot every tick and snoozes are PERSISTED to IndexedDB, so a
 * reload or navigation can never permanently silence an unconfirmed alert;
 * after the 2 h grace window the slot flips to "missed" for caregivers.
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
          if (prev && due.some((d) => d.eventId === prev.dueKey)) return prev;
          if (due.length === 0) return null;
          const { reminder, eventId } = due[0];
          return { ...reminder, dueKey: eventId };
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

  // Voice announcement with per-slot cooldown.
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
    await markReminderEventDone(active.dueKey);
    setActive(null);
  }, [active]);

  const snooze = useCallback(async (): Promise<void> => {
    if (!active) return;
    // Persisted: the collector hides this slot until the deadline passes,
    // even across reloads — no fragile in-page timers involved.
    await snoozeReminderEvent(active.dueKey);
    setActive(null);
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
