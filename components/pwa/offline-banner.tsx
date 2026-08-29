"use client";

import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

/** Subtle, honest offline indicator — recognition is local, so everything keeps working. */
export function OfflineBanner() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  if (!offline) return null;

  return (
    <div
      role="status"
      className="fixed inset-x-0 top-0 z-[70] flex items-center justify-center gap-2 bg-night/95 px-4 py-2 text-sm font-medium text-teal-200 backdrop-blur animate-fade-in"
    >
      <WifiOff className="h-4 w-4 shrink-0" />
      Offline — CareGiver is still available. Recognition runs on this device.
    </div>
  );
}

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    };
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });

    // Warm the recognition models while the user reads the landing page,
    // so Companion Mode opens ready instead of downloading ~6.8 MB.
    void import("@/lib/perf/prefetch").then((m) => m.scheduleModelPrefetch());
  }, []);
  return null;
}
