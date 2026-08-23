import clsx from "clsx";

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border-2 border-dashed border-line bg-surface/60 px-8 py-14 text-center">
      {icon && (
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-accent-soft text-accent">
          {icon}
        </div>
      )}
      <h3 className="text-2xl font-bold tracking-tight">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-lg leading-relaxed text-ink-soft">{body}</p>
      {action && <div className="mt-7 flex flex-wrap justify-center gap-3">{action}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={clsx("shimmer rounded-3xl", className)}
    />
  );
}

export function Spinner({ className, label }: { className?: string; label?: string }) {
  return (
    <span role="status" aria-label={label ?? "Loading"} className="inline-flex items-center">
      <span
        className={clsx(
          "h-6 w-6 animate-spin rounded-full border-[3px] border-current border-t-transparent",
          className,
        )}
      />
      <span className="sr-only">{label ?? "Loading"}</span>
    </span>
  );
}
