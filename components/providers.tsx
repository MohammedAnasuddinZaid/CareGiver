"use client";

import { SettingsProvider } from "@/hooks/use-settings";
import { ToastProvider } from "@/components/ui/toast";
import { OfflineBanner, ServiceWorkerRegistration } from "@/components/pwa/offline-banner";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <SettingsProvider>
      <ToastProvider>
        <OfflineBanner />
        <ServiceWorkerRegistration />
        {children}
      </ToastProvider>
    </SettingsProvider>
  );
}
