import Link from "next/link";

/**
 * Site-wide footer, rendered once by AppShell below every page.
 * Extracted from the landing redesign (#1) so no page needs to render its
 * own landmarks; the license route lives at /license.
 */
export function SiteFooter() {
  return (
    <footer className="border-t border-line/70 bg-surface-container-low text-on-surface-variant">
      <div className="mx-auto max-w-7xl px-4 pb-24 pt-12 md:px-6 md:pb-10 md:pt-14">
        <div className="mb-10 grid grid-cols-1 gap-10 md:grid-cols-2 lg:grid-cols-5 lg:gap-8">
          {/* Brand */}
          <div className="space-y-4 lg:col-span-2">
            <span className="inline-block text-2xl font-bold tracking-tight text-primary">
              CareGiver
            </span>
            <p className="max-w-sm text-base leading-relaxed">
              Gentle, privacy-first assistive memory care designed with dignity
              and heritage in mind.
            </p>
          </div>

          {/* Features */}
          <nav aria-label="Features">
            <h3 className="mb-4 text-sm font-bold uppercase tracking-wider text-on-surface">
              Features
            </h3>
            <ul className="space-y-2.5 text-base">
              {[
                ["/recognition", "Companion Mode"],
                ["/caregiver", "Caregiver Dashboard"],
                ["/play", "Mind Games"],
                ["/reminders", "Reminders"],
              ].map(([href, label]) => (
                <li key={href}>
                  <Link href={href} className="transition-colors hover:text-primary">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Resources */}
          <nav aria-label="Resources">
            <h3 className="mb-4 text-sm font-bold uppercase tracking-wider text-on-surface">
              Resources
            </h3>
            <ul className="space-y-2.5 text-base">
              <li>
                <Link href="/settings" className="transition-colors hover:text-primary">
                  Settings
                </Link>
              </li>
              <li>
                <Link href="/about" className="transition-colors hover:text-primary">
                  About
                </Link>
              </li>
              <li>
                <Link href="/references" className="transition-colors hover:text-primary">
                  References & Science
                </Link>
              </li>
              <li>
                <Link href="/analytics" className="transition-colors hover:text-primary">
                  Progress
                </Link>
              </li>
            </ul>
          </nav>

          {/* Legal */}
          <nav aria-label="Legal">
            <h3 className="mb-4 text-sm font-bold uppercase tracking-wider text-on-surface">
              Legal
            </h3>
            <ul className="space-y-2.5 text-base">
              <li>
                <Link href="/privacy" className="transition-colors hover:text-primary">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/license" className="transition-colors hover:text-primary">
                  License
                </Link>
              </li>
            </ul>
          </nav>
        </div>

        {/* Bottom Bar */}
        <p className="mb-6 text-center text-sm leading-relaxed md:text-left">
          CareGiver is a prototype assistive technology and is not a medical
          device. Designed with privacy first — profiles and recognition stay on
          this device.
        </p>
        <div className="flex flex-col items-center justify-between gap-4 border-t border-line/70 pt-8 text-sm sm:flex-row">
          <p>© 2026 CareGiver · MIT License</p>
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="inline-flex items-center rounded-full border border-accent/30 bg-accent-soft px-3 py-1 text-xs font-semibold text-accent">
              100% On-Device AI
            </span>
            <span className="inline-flex items-center rounded-full border border-line bg-surface px-3 py-1 text-xs font-semibold text-ink-soft">
              Works Offline (PWA)
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
