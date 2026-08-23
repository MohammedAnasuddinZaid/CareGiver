import clsx from "clsx";

export function Card({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={clsx(
        "rounded-3xl bg-surface border border-line shadow-soft transition-shadow duration-300",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function CardHover({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={clsx("transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lift", className)}>
      {children}
    </div>
  );
}

export function SectionTitle({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-4 mb-5">
      <div>
        <h2 className="text-2xl md:text-3xl font-bold tracking-tight">{title}</h2>
        {subtitle && <p className="mt-1 text-base text-ink-soft">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
