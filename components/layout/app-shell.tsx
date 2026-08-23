"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import {
  Heart,
  House,
  ScanFace,
  Settings as SettingsIcon,
  ShieldCheck,
} from "lucide-react";
import { Wordmark } from "@/components/logo";

const NAV = [
  { href: "/", label: "Home", icon: House },
  { href: "/caregiver", label: "People", icon: Heart },
  { href: "/recognition", label: "Companion", icon: ScanFace },
  { href: "/settings", label: "Settings", icon: SettingsIcon },
  { href: "/privacy", label: "Privacy", icon: ShieldCheck },
] as const;

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isCompanion = pathname.startsWith("/recognition");

  if (isCompanion) {
    return <main className="min-h-screen bg-night">{children}</main>;
  }

  const onPrivacyOrAbout =
    pathname.startsWith("/privacy") || pathname.startsWith("/about");

  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-accent focus:px-4 focus:py-2 focus:text-white"
      >
        Skip to content
      </a>
      <header className="sticky top-0 z-50 border-b border-line/70 bg-canvas/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 md:px-6">
          <Link href="/" aria-label="MemoryAssist home" className="rounded-xl">
            <Wordmark />
          </Link>
          <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
            {NAV.slice(1).map(({ href, label }) => {
              const active = isActive(pathname, href);
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={clsx(
                    "rounded-full px-4 py-2 text-base font-semibold transition-colors min-h-[44px] inline-flex items-center",
                    active ? "bg-accent-soft text-accent" : "text-ink-soft hover:text-ink hover:bg-surface-muted",
                  )}
                >
                  {label}
                </Link>
              );
            })}
            <Link
              href="/about"
              aria-current={onPrivacyOrAbout && pathname.startsWith("/about") ? "page" : undefined}
              className={clsx(
                "rounded-full px-4 py-2 text-base font-semibold transition-colors min-h-[44px] inline-flex items-center",
                pathname.startsWith("/about")
                  ? "bg-accent-soft text-accent"
                  : "text-ink-soft hover:text-ink hover:bg-surface-muted",
              )}
            >
              About
            </Link>
          </nav>
          <Link
            href="/recognition"
            className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-base font-semibold text-white shadow-soft transition-all hover:bg-accent-strong hover:shadow-lift active:scale-[0.98]"
          >
            <ScanFace className="h-5 w-5" />
            <span className="hidden sm:inline">Companion</span>
          </Link>
        </div>
      </header>

      <main id="content" className="flex-1 pb-28 md:pb-10">
        {children}
      </main>

      <footer className="hidden border-t border-line/70 py-8 md:block">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-2 px-6 text-center">
          <p className="text-base text-ink-soft">
            MemoryAssist is a prototype assistive technology and is not a medical device.
          </p>
          <p className="text-sm text-ink-soft/80">
            Designed with privacy first — profiles and recognition stay on this device.
          </p>
        </div>
      </footer>

      {/* Mobile bottom navigation */}
      <nav
        aria-label="Primary mobile"
        className="fixed inset-x-0 bottom-0 z-50 border-t border-line/70 bg-canvas/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
      >
        <div className="grid grid-cols-5">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = isActive(pathname, href);
            const companion = href === "/recognition";
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
