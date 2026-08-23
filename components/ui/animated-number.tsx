"use client";

import { useEffect } from "react";
import {
  useMotionValue,
  useSpring,
  useTransform,
  useReducedMotion,
  motion,
} from "framer-motion";

/**
 * AnimatedNumber — spring-driven odometer for dashboard stats.
 * Values tween with a critically-damped spring; reduced-motion users see
 * the number change instantly.
 */
export function AnimatedNumber({
  value,
  className,
}: {
  value: number;
  className?: string;
}) {
  const reduceMotion = useReducedMotion();
  const motionValue = useMotionValue(value);
  const spring = useSpring(motionValue, { stiffness: 90, damping: 20, mass: 0.8 });
  const display = useTransform(spring, (v) => Math.round(v).toString());

  useEffect(() => {
    if (reduceMotion) {
      motionValue.jump(value);
    } else {
      motionValue.set(value);
    }
  }, [value, motionValue, reduceMotion]);

  if (reduceMotion) {
    return <span className={className}>{value}</span>;
  }

  return (
    <span className={className}>
      <motion.span>{display}</motion.span>
    </span>
  );
}
