"use client";

import { useCallback, useRef } from "react";
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  useReducedMotion,
} from "framer-motion";

/**
 * TiltCard — pointer-driven 3D perspective card.
 *
 * Advanced CSS/animation stack:
 * - `perspective` + `transform-style: preserve-3d` for true depth
 * - rotateX/rotateY driven by raw MotionValues (no React re-renders)
 * - critically-damped springs for buttery settle, glare layer that tracks
 *   the cursor, and a soft lift shadow
 * - automatically disabled under prefers-reduced-motion
 */
export function TiltCard({
  className,
  children,
  maxTilt = 7,
}: {
  className?: string;
  children: React.ReactNode;
  maxTilt?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();

  const px = useMotionValue(0.5); // pointer position, 0..1
  const py = useMotionValue(0.5);

  const rotateX = useSpring(useTransform(py, [0, 1], [maxTilt, -maxTilt]), {
    stiffness: 220,
    damping: 22,
    mass: 0.6,
  });
  const rotateY = useSpring(useTransform(px, [0, 1], [-maxTilt, maxTilt]), {
    stiffness: 220,
    damping: 22,
    mass: 0.6,
  });
  const glareX = useTransform(px, (v) => `${v * 100}%`);
  const glareY = useTransform(py, (v) => `${v * 100}%`);
  const glare = useTransform(
    [glareX, glareY] as never,
    ([x, y]: string[]) =>
      `radial-gradient(420px circle at ${x} ${y}, rgba(255,255,255,0.18), transparent 55%)`,
  );

  const onMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      px.set((e.clientX - rect.left) / rect.width);
      py.set((e.clientY - rect.top) / rect.height);
    },
    [px, py],
  );

  const onLeave = useCallback(() => {
    px.set(0.5);
    py.set(0.5);
  }, [px, py]);

  if (reduceMotion) {
    return <div ref={ref} className={className}>{children}</div>;
  }

  return (
    <div
      ref={ref}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      style={{ perspective: 900 }}
      className={className}
    >
      <motion.div
        style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
        className="relative h-full w-full"
      >
        {children}
        {/* Glare layer */}
        <motion.span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          style={{ background: glare }}
        />
      </motion.div>
    </div>
  );
}
