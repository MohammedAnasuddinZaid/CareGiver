"use client";

import { motion, useReducedMotion } from "framer-motion";

/**
 * Route transition wrapper — Next.js re-mounts templates on navigation, so
 * every page change gets one soft rise-and-fade. Respects reduced-motion
 * by rendering children untouched.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  const reduce = useReducedMotion();
  if (reduce) return <>{children}</>;
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
