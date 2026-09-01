/*
 * CareGiver service worker.
 *
 * Strategy:
 *  - /models/*        → cache-first forever (large ML weights, immutable)
 *  - /_next/static/*  → cache-first (content-hashed)
 *  - icons & manifest → cache-first
 *  - navigations      → network-first, fall back to cached shell
 *
 * The goal: after the first visit (and one model download), recognition and
 * profiles work fully offline. Nothing user-specific is ever cached here —
 * profiles live in IndexedDB.
 */

const VERSION = "memoryassist-v1";
const SHELL = [
  "/",
  "/caregiver",
  "/caregiver/add",
  "/play",
  "/reminders",
  "/analytics",
  "/assistant",
  "/recognition",
  "/settings",
  "/privacy",
  "/about",
  "/manifest.webmanifest",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      .then((cache) =>
        Promise.allSettled(SHELL.map((url) => cache.add(url))),
      )
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Immutable assets: models + hashed static + icons.
  const isModel = url.pathname.startsWith("/models/");
  const isStatic = url.pathname.startsWith("/_next/static/");
  const isIcon =
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/manifest.webmanifest";

  if (isModel || isStatic || isIcon) {
    event.respondWith(
      caches.open(VERSION).then(async (cache) => {
        const hit = await cache.match(request);
        if (hit) return hit;
        try {
          const response = await fetch(request);
          if (response.ok) cache.put(request, response.clone());
          return response;
        } catch (err) {
          return new Response("", { status: 504, statusText: "Offline" });
        }
      }),
    );
    return;
  }

  // Pages: network first with cached fallback so updates arrive promptly
  // but the app still opens offline.
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request);
          const cache = await caches.open(VERSION);
          cache.put(request, response.clone());
          return response;
        } catch {
          const cache = await caches.open(VERSION);
          const hit =
            (await cache.match(request)) ||
            (await cache.match("/")) ||
            (await cache.match("/recognition"));
          if (hit) return hit;
          return new Response(
            "<!doctype html><meta charset=utf-8><title>CareGiver</title><p style=\"font-family:sans-serif;padding:2rem\">You are offline. Reopen CareGiver once while online to finish setup.</p>",
            { headers: { "Content-Type": "text/html" } },
          );
        }
      })(),
    );
  }
});
