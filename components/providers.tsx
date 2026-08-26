"use client";

import { MotionConfig } from "framer-motion";
import { SettingsProvider, useSettings } from "@/hooks/use-settings";
import { ToastProvider } from "@/components/ui/toast";
import { OfflineBanner, ServiceWorkerRegistration } from "@/components/pwa/offline-banner";
import { ReminderSchedulerProvider } from "@/components/reminders/reminder-scheduler-provider";

/**
 * The global `.reduce-motion` CSS class kills stylesheet animations, but
 * framer-motion drives JS springs that CSS cannot touch. MotionConfig
 * swaps them for instant opacity changes — honoring both the OS setting
 * (the default until the user chooses) and the in-app toggle.
 */
function MotionGate({ children }: { children: React.ReactNode }) {
  const { settings, ready } = useSettings();
  return (
    <MotionConfig reducedMotion={!ready || settings.reduceMotion ? "always" : "user"}>
      {children}
    </MotionConfig>
  );
}

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <SettingsProvider>
      <MotionGate>
        <ToastProvider>
          <OfflineBanner />
          <ServiceWorkerRegistration />
          {/* One scheduler for the entire app — overlays consume it. */}
          <ReminderSchedulerProvider>{children}</ReminderSchedulerProvider>
        </ToastProvider>
      </MotionGate>
    </SettingsProvider>
  );
}
