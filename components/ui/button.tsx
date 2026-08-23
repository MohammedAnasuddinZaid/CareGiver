import { forwardRef } from "react";
import clsx from "clsx";
import Link from "next/link";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "onDark";
type Size = "md" | "lg" | "xl";

const base =
  "inline-flex items-center justify-center gap-2 font-semibold rounded-full transition-all duration-200 select-none focus-visible:outline-none disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98]";

const variants: Record<Variant, string> = {
  primary: "btn-sheen bg-accent text-white hover:bg-accent-strong shadow-soft hover:shadow-lift",
  secondary:
    "bg-surface text-ink border border-line hover:border-accent hover:text-accent shadow-soft",
  ghost: "text-ink-soft hover:text-ink hover:bg-surface-muted",
  danger: "bg-danger text-white hover:brightness-110 shadow-soft",
  onDark: "bg-white/10 text-white border border-white/20 hover:bg-white/20 backdrop-blur",
};

const sizes: Record<Size, string> = {
  md: "px-5 py-2.5 text-base min-h-[44px]",
  lg: "px-7 py-3.5 text-lg min-h-[52px]",
  xl: "px-8 py-4 text-xl min-h-[60px]",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", className, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      className={clsx(base, variants[variant], sizes[size], className)}
      {...props}
    />
  );
});

export interface ButtonLinkProps extends React.ComponentProps<typeof Link> {
  variant?: Variant;
  size?: Size;
}

export function ButtonLink({ variant = "primary", size = "md", className, ...props }: ButtonLinkProps) {
  return <Link className={clsx(base, variants[variant], sizes[size], className)} {...props} />;
}
