import clsx from "clsx";

type Tone = "ok" | "warn" | "muted" | "accent";

const tones: Record<Tone, { chip: string; dot: string }> = {
  ok: {
    chip: "bg-emerald-50 text-emerald-800 border-emerald-200",
    dot: "bg-emerald-500",
  },
  warn: {
    chip: "bg-amber-50 text-amber-800 border-amber-200",
    dot: "bg-amber-500",
  },
  muted: {
    chip: "bg-surface-muted text-ink-soft border-line",
    dot: "bg-stone-400",
  },
  accent: {
    chip: "bg-teal-50 text-teal-900 border-teal-200",
    dot: "bg-teal-600",
  },
};

export function StatusBadge({
  tone,
  children,
  pulse = false,
}: {
  tone: Tone;
  children: React.ReactNode;
  pulse?: boolean;
}) {
  const t = tones[tone];
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-semibold whitespace-nowrap",
        t.chip,
      )}
    >
      <span aria-hidden className={clsx("h-2 w-2 rounded-full", t.dot, pulse && "animate-pulse")} />
      {children}
    </span>
  );
}
