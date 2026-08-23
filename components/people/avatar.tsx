"use client";

import clsx from "clsx";
import { initialsOf, avatarTone } from "@/lib/utils/format";

export function Avatar({
  name,
  id,
  src,
  size = "md",
  className,
}: {
  name: string;
  id: string;
  src?: string | null;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}) {
  const sizes = {
    sm: "h-12 w-12 text-base rounded-xl",
    md: "h-14 w-14 text-lg rounded-2xl",
    lg: "h-24 w-24 text-3xl rounded-3xl",
    xl: "h-40 w-40 text-6xl rounded-[2rem]",
  } as const;

  if (src) {
    return (
      // User-uploaded images are rendered as plain img sources only —
      // never injected as HTML.
      <img
        src={src}
        alt={`Photo of ${name}`}
        className={clsx("object-cover shadow-soft", sizes[size], className)}
      />
    );
  }
  return (
    <span
      aria-hidden
      className={clsx(
        "inline-flex select-none items-center justify-center font-bold text-white",
        sizes[size],
        avatarTone(id),
        className,
      )}
    >
      {initialsOf(name)}
    </span>
  );
}
