"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useReminderScheduler } from "@/hooks/use-reminder-scheduler";

type SchedulerValue = ReturnType<typeof useReminderScheduler>;

const SchedulerContext = createContext<SchedulerValue | null>(null);

/**
 * Mounts exactly ONE reminder scheduler for the whole app.
 *
 * The overlay used to call the hook itself, so any page that also rendered
 * a second overlay (e.g. /reminders preview) ran two polling loops —
 * stacked alert cards, double voice/notification output and interleaved
 * log writes. The provider guarantees a single instance at the root.
 */
export function ReminderSchedulerProvider({ children }: { children: ReactNode }) {
  const value = useReminderScheduler();
  return <SchedulerContext.Provider value={value}>{children}</SchedulerContext.Provider>;
}

export function useReminderSchedulerOnce(): SchedulerValue | null {
  return useContext(SchedulerContext);
}
