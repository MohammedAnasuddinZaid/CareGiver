"use client";

import { useEffect, useRef } from "react";

/**
 * Ambient hero video — plays muted, loops, and never steals focus.
 *
 * Guards:
 * - autoplay+muted+playsInline so every browser allows it silently
 * - prefers-reduced-motion: shows the first frame instead of playing
 * - pauses when the tab is hidden (saves battery on kiosk tablets)
 * - sits UNDER the brand-tint gradients, so even a failed load leaves
 *   the CSS-only hero fully intact
 */
export function HeroVideo({ src }: { src: string }) {
  const ref = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      // Static frame: load just enough for one picture, never play.
      video.pause();
      const onData = () => video.pause();
      video.addEventListener("loadeddata", onData, { once: true });
      return () => video.removeEventListener("loadeddata", onData);
    }

    // Some browsers need an explicit kick after mount.
    void video.play().catch(() => undefined);

    const onVisibility = (): void => {
      if (document.hidden) video.pause();
      else void video.play().catch(() => undefined);
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  return (
    <video
      ref={ref}
      className="absolute inset-0 h-full w-full object-cover"
      src={src}
      autoPlay
      muted
      loop
      playsInline
      preload="metadata"
      disablePictureInPicture
      aria-hidden
      tabIndex={-1}
    />
  );
}
