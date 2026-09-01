"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import {
  Bot,
  Brain,
  Heart,
  House,
  LineChart,
  CalendarClock,
  ScanFace,
  Settings as SettingsIcon,
  Download,
} from "lucide-react";
import { Wordmark } from "@/components/logo";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { ReminderAlertOverlay } from "@/components/reminders/reminder-alert-overlay";
import { SiteFooter } from "@/components/layout/site-footer";
import { openInstallPrompt } from "@/components/pwa/install-prompt";

const NAV = [
  { href: "/", label: "Home", icon: House },
  { href: "/caregiver", label: "People", icon: Heart },
  { href: "/play", label: "Games", icon: Brain },
  { href: "/assistant", label: "Assistant", icon: Bot },
  { href: "/reminders", label: "Reminders", icon: CalendarClock },
  { href: "/analytics", label: "Progress", icon: LineChart },
  { href: "/settings", label: "Settings", icon: SettingsIcon },
] as const;

const MOBILE_NAV = [
  { href: "/", label: "Home", icon: House },
  { href: "/caregiver", label: "People", icon: Heart },
  { href: "/play", label: "Games", icon: Brain },
  { href: "/recognition", label: "Face Mode", icon: ScanFace, center: true },
  { href: "/assistant", label: "AI", icon: Bot },
  { href: "/reminders", label: "Alerts", icon: CalendarClock },
  { href: "/analytics", label: "Progress", icon: LineChart },
  { href: "/settings", label: "Settings", icon: SettingsIcon },
] as const;

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isCompanion = pathname.startsWith("/recognition");

  if (isCompanion) {
    return (
      <main className="relative min-h-screen bg-night">
        {children}
        <ReminderAlertOverlay />
      </main>
    );
  }

  return (
    <div className="relative flex min-h-screen flex-col">
      {/* Ambient mesh-gradient backdrop — paints above body bg, below content */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="aurora-blob aurora-blob-a left-[6%] top-[10%] h-72 w-72 bg-accent/10" />
        <div className="aurora-blob aurora-blob-b right-[8%] top-[28%] h-80 w-80 bg-accent-soft/40" />
        <div className="aurora-blob aurora-blob-a left-[40%] bottom-[6%] h-72 w-72 bg-accent/5" />
      </div>
      <a
        href="#content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-accent focus:px-4 focus:py-2 focus:text-white"
      >
        Skip to content
      </a>
      <header className="sticky top-0 z-50 border-b border-line/70 bg-canvas/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 md:px-6">
          <Link href="/" aria-label="CareGiver home" className="shrink-0 rounded-xl">
            <Wordmark />
          </Link>
          <nav
            aria-label="Primary"
            className="hidden flex-1 items-center justify-center gap-1 md:flex"
          >
            {NAV.map(({ href, label }) => {
              const active = isActive(pathname, href);
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={clsx(
                    "relative rounded-full px-3.5 py-2 text-[15px] font-semibold transition-colors duration-200 min-h-[44px] inline-flex items-center",
                    active
                      ? "bg-accent-soft text-accent"
                      : "text-ink-soft hover:text-ink hover:bg-surface-muted",
                  )}
                >
                  {label}
                </Link>
              );
            })}
          </nav>
          <div className="flex shrink-0 items-center gap-2 md:gap-3">
            <Link
              href="/recognition"
              className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-base font-semibold text-white shadow-soft transition-all duration-200 hover:bg-accent-strong hover:shadow-lift active:scale-[0.98]"
            >
              <ScanFace className="h-5 w-5" />
              <span className="hidden sm:inline">Companion</span>
            </Link>
            <button
              type="button"
              onClick={() => openInstallPrompt()}
              aria-label="Install app"
              title="Install app"
              className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-line text-ink-soft transition-colors duration-200 hover:bg-surface-muted hover:text-ink"
            >
              <Download className="h-5 w-5" aria-hidden />
            </button>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main id="content" className="flex-1 pb-28 md:pb-10">
        {children}
      </main>
      <ReminderAlertOverlay />

      <SiteFooter />

      {/* Mobile bottom navigation */}
      <nav
        aria-label="Primary mobile"
        className="fixed inset-x-0 bottom-0 z-50 border-t border-line/70 bg-canvas/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
      >
        <div className="grid grid-cols-8">
          {MOBILE_NAV.map(({ href, label, icon: Icon, ...rest }) => {
            const active = isActive(pathname, href);
            const companion = "center" in rest && rest.center === true;
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={clsx(
                  "flex min-h-[64px] flex-col items-center justify-center gap-1 text-xs font-semibold transition-colors",
                  companion &&
                    "-mt-4 h-16 w-16 justify-self-center rounded-full bg-accent text-white shadow-lift",
                  !companion && (active ? "text-accent" : "text-ink-soft"),
                )}
              >
                <Icon className={clsx("h-5 w-5", companion && "h-7 w-7")} />
                {!companion && label}
                {companion && <span className="sr-only">Companion Mode</span>}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
