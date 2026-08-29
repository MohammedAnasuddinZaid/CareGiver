"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Download,
  Smartphone,
  X,
  Check,
  Share,
  MonitorSmartphone,
} from "lucide-react";
import { Modal } from "@/components/ui/modal";

/**
 * Install prompt that works on BOTH platforms:
 *
 *  - Android / Chrome / Edge  → captures the native `beforeinstallprompt`
 *    event and calls `prompt()` for a real, one-tap OS install.
 *  - iOS / Safari             → Safari deliberately hides that API, so we
 *    show step-by-step "Add to Home Screen" instructions (Share → Add).
 *
 * The prompt auto-opens once on a returning visit (localStorage-flagged so it
 * never nags) and can also be reopened from the header "Install" button via
 * the `ma:open-install` window event. No data leaves the device.
 */

const DISMISS_KEY = "ma.install.dismissed.v1";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const ios = /iPad|iPhone|iPod/.test(ua);
  // iPadOS 13+ reports as Mac; detect via touch + Safari.
  const iPadOs = /Macintosh/.test(ua) && typeof (navigator as unknown as { maxTouchPoints?: number }).maxTouchPoints === "number" && (navigator as unknown as { maxTouchPoints?: number }).maxTouchPoints! > 1;
  return ios || iPadOs;
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

export function InstallPrompt() {
  const [open, setOpen] = useState(false);
  const [canNativeInstall, setCanNativeInstall] = useState(false);
  const deferred = useRef<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  // Capture the native prompt (Android/Chrome).
  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      deferred.current = e as BeforeInstallPromptEvent;
      setCanNativeInstall(true);
    };
    const onInstalled = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", onPrompt as EventListener);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt as EventListener);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  // Auto-open once for returning visitors who haven't installed/dismissed.
  useEffect(() => {
    if (isStandalone()) return;
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(DISMISS_KEY) === "1";
    } catch {}
    if (dismissed) return;
    // Wait a beat so the landing content settles first.
    const t = window.setTimeout(() => setOpen(true), 1800);
    return () => window.clearTimeout(t);
  }, []);

  // Allow the header button (and any caller) to open this dialog.
  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener("ma:open-install", onOpen);
    return () => window.removeEventListener("ma:open-install", onOpen);
  }, []);

  const dismiss = useCallback(() => {
    setOpen(false);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {}
  }, []);

  const doNativeInstall = useCallback(async () => {
    const evt = deferred.current;
    if (!evt) return;
    await evt.prompt();
    const choice = await evt.userChoice;
    deferred.current = null;
    setCanNativeInstall(false);
    if (choice.outcome === "accepted") dismiss();
    else dismiss();
  }, [dismiss]);

  const ios = isIos();

  return (
    <Modal
      open={open}
      onClose={dismiss}
      title={installed ? "Already installed" : "Install MemoryAssist"}
    >
      <div className="space-y-5">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-accent-soft">
            <Smartphone className="h-7 w-7 text-accent" />
          </div>
          <p className="text-lg leading-relaxed text-ink-soft">
            Add MemoryAssist to your home screen. It opens like a normal app — full
            screen, offline-capable, and your private data stays right here on the
            device.
          </p>
        </div>

        {installed ? (
          <div className="flex items-center gap-3 rounded-2xl border border-ok/30 bg-ok/5 px-5 py-4 text-base font-medium text-ink">
            <Check className="h-5 w-5 text-ok" />
            You&apos;re all set — MemoryAssist is installed.
          </div>
        ) : ios ? (
          <ol className="space-y-3">
            {[
              "Tap the Share icon at the bottom of the screen.",
              "Scroll down and tap “Add to Home Screen”.",
              "Tap Add — MemoryAssist appears on your home screen.",
            ].map((step, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-bold text-white">
                  {i + 1}
                </span>
                <span className="text-base leading-relaxed text-ink">{step}</span>
              </li>
            ))}
            <li className="flex items-center gap-2 rounded-xl bg-surface-muted px-4 py-3 text-sm text-ink-soft">
              <Share className="h-4 w-4 shrink-0" />
              Look for the Share sheet (the square with an arrow).
            </li>
          </ol>
        ) : canNativeInstall ? (
          <button
            onClick={() => void doNativeInstall()}
            className="btn-sheen inline-flex w-full min-h-[56px] items-center justify-center gap-2 rounded-full bg-accent px-8 py-3.5 text-lg font-bold text-white shadow-soft transition-all hover:bg-accent-strong active:scale-[0.98]"
          >
            <Download className="h-5 w-5" />
            Install app
          </button>
        ) : (
          <div className="rounded-2xl border border-line bg-surface-muted px-5 py-4 text-base leading-relaxed text-ink-soft">
            <p className="flex items-center gap-2 font-semibold text-ink">
              <MonitorSmartphone className="h-5 w-5 text-accent" />
              Install from your browser menu
            </p>
            <p className="mt-2">
              Open your browser&apos;s menu (usually ⋮ or ⋯) and choose{" "}
              <span className="font-semibold text-ink">“Install app”</span> or{" "}
              <span className="font-semibold text-ink">“Add to Home Screen”</span>.
            </p>
          </div>
        )}

        <div className="flex items-center justify-between gap-3 pt-1">
          <button
            onClick={dismiss}
            className="min-h-[44px] rounded-full px-5 py-2.5 text-base font-semibold text-ink-soft transition-colors hover:bg-surface-muted"
          >
            Maybe later
          </button>
          {!ios && !canNativeInstall && !installed && (
            <button
              onClick={dismiss}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-accent px-6 py-2.5 text-base font-bold text-white transition-colors hover:bg-accent-strong"
            >
              <Check className="h-4 w-4" />
              Got it
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}

/** Opens the install dialog from anywhere (e.g. a header button). */
export function openInstallPrompt(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("ma:open-install"));
}
