"use client";

import { useCallback } from "react";
import clsx from "clsx";

/**
 * Card wrapper with a cursor-tracking radial spotlight.
 * Pure CSS rendering (single ::before gradient) — only two CSS variables
 * are written per mousemove, so it stays cheap even on long lists.
 */
export function SpotlightCard({
  className,
  children,
  as: Tag = "div",
}: {
  className?: string;
  children: React.ReactNode;
  as?: "div" | "article";
}) {
  const onMove = useCallback((e: React.MouseEvent<HTMLElement>) => {
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${((e.clientX - rect.left) / rect.width) * 100}%`);
    el.style.setProperty("--my", `${((e.clientY - rect.top) / rect.height) * 100}%`);
  }, []);

  return (
    <Tag onMouseMove={onMove} className={clsx("spotlight-card", className)}>
      {children}
    </Tag>
  );
}
