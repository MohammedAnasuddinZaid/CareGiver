/**
 * Idle-time model prefetch.
 *
 * First Companion Mode visit previously paid the full ~6.8 MB model
 * download while the user stared at "Preparing recognition…". Prefetching
 * during browser idle time right after app load moves that cost to a
 * moment the user isn't waiting — cutting perceived time-to-recognize to
 * near zero for repeat visits and dramatically shortening the first one.
 *
 * Respectful by design: skipped entirely for data-saver users
 * (navigator.connection.saveData) and on metered/slow connections, and it
 * reuses the same service-worker cache as normal usage — never a second
 * download.
 */

export interface ConnectionLike {
  saveData?: boolean;
  effectiveType?: string;
}

const SLOW_TYPES = new Set(["slow-2g", "2g"]);

/** Pure decision so the policy is unit-testable. */
export function shouldPrefetchModels(
  connection: ConnectionLike | null | undefined,
  alreadyCachedOrReady: boolean,
): boolean {
  if (alreadyCachedOrReady) return false;
  if (!connection) return true; // unknown ⇒ assume unmetered desktop
  if (connection.saveData === true) return false;
  if (connection.effectiveType && SLOW_TYPES.has(connection.effectiveType)) {
    return false;
  }
  return true;
}

export function scheduleModelPrefetch(): void {
  if (typeof window === "undefined") return;

  // A failed first attempt (offline first visit, flaky café Wi-Fi) retries
  // with backoff instead of staying dead until a full page reload.
  let attempts = 0;
  const MAX_ATTEMPTS = 3;
  const RETRY_DELAY_MS = 90_000;

  const run = (): void => {
    const nav = navigator as Navigator & {
      connection?: ConnectionLike;
      deviceMemory?: number;
    };
    // Dynamic import keeps the multi-MB face-api chunk out of the idle
    // path until we have actually decided to prefetch.
    void import("@/lib/recognition/model-manager").then((models) => {
      const status = models.getModelStatus();
      if (status !== "idle" && status !== "error") return; // loading or ready elsewhere
      const cached =
        typeof caches !== "undefined"
          ? caches
              .open("memoryassist-v1")
              .then((c) => c.match("/models/face_recognition_model.bin"))
              .then((hit) => hit !== undefined)
              .catch(() => false)
          : Promise.resolve(false);
      void cached.then((isCached) => {
        if (!shouldPrefetchModels(nav.connection ?? null, isCached)) return;
        attempts++;
        // Fire-and-forget: status flips via the normal listener chain and
        // any failure is invisible — prefetch is an optimization.
        void models
          .ensureModelsLoaded()
          .catch(() => undefined)
          .finally(() => {
            if (models.getModelStatus() === "error" && attempts < MAX_ATTEMPTS) {
              window.setTimeout(run, RETRY_DELAY_MS * attempts);
            }
          });
      });
    });
  };

  const ric = (
    window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
    }
  ).requestIdleCallback;
  if (typeof ric === "function") ric(run, { timeout: 8000 });
  else window.setTimeout(run, 2500);
}
