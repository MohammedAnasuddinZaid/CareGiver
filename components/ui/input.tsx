import { forwardRef, useId } from "react";
import clsx from "clsx";

export function Field({
  label,
  hint,
  error,
  htmlFor,
  children,
}: {
  label: string;
  hint?: string;
  error?: string | null;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="block text-base font-semibold text-ink mb-2"
      >
        {label}
      </label>
      {children}
      {hint && !error && <p className="mt-2 text-sm text-ink-soft">{hint}</p>}
      {error && (
        <p role="alert" className="mt-2 text-sm font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

const controlClasses =
  "w-full rounded-2xl border bg-surface px-4 py-3 text-lg text-ink placeholder:text-ink-soft/60 border-line focus:border-accent focus:ring-2 focus:ring-accent/25 outline-none transition-colors min-h-[52px]";

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return <input ref={ref} className={clsx(controlClasses, className)} {...props} />;
  },
);

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...props }, ref) {
  return <textarea ref={ref} rows={3} className={clsx(controlClasses, "resize-none", className)} {...props} />;
});

export const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, children, ...props }, ref) {
    return (
      <select ref={ref} className={clsx(controlClasses, "appearance-none pr-10", className)} {...props}>
        {children}
      </select>
    );
  },
);

/** Accessible switch (role="switch"). */
export function Switch({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  description?: string;
}) {
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-6 py-4">
      <div className="min-w-0">
        <label htmlFor={id} className="text-lg font-semibold cursor-pointer">
          {label}
        </label>
        {description && <p className="text-base text-ink-soft mt-0.5">{description}</p>}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={clsx(
          "relative inline-flex h-9 w-16 shrink-0 items-center rounded-full transition-colors duration-300 focus-visible:outline-none",
          checked ? "bg-accent" : "bg-line",
        )}
      >
        <span
          aria-hidden
          className={clsx(
            "inline-block h-7 w-7 transform rounded-full bg-white shadow transition-transform duration-300",
            checked ? "translate-x-8" : "translate-x-1",
          )}
        />
      </button>
    </div>
  );
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (next: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-full bg-surface-muted p-1.5">
      {options.map((opt) => {
        const selected = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(opt.value)}
            className={clsx(
              "rounded-full px-5 py-2.5 text-base font-semibold transition-all duration-200 min-h-[44px]",
              selected ? "bg-surface text-accent shadow-soft" : "text-ink-soft hover:text-ink",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
