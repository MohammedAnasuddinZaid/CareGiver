import clsx from "clsx";

export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={clsx(
        "inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-accent text-white shadow-soft",
        className,
      )}
    >
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
        <circle cx="12" cy="8.2" r="3.4" stroke="currentColor" strokeWidth="2" />
        <path
          d="M4.8 19.4c1.1-3.1 3.9-4.9 7.2-4.9s6.1 1.8 7.2 4.9"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path d="M17.6 4.2l.7-1 .7 1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

export function Wordmark({ dark = false }: { dark?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <LogoMark />
      <span
        className={clsx(
          "text-xl font-bold tracking-tight",
          dark ? "text-white" : "text-ink",
        )}
      >
        Memory<span className="text-accent">Assist</span>
      </span>
    </span>
  );
}
