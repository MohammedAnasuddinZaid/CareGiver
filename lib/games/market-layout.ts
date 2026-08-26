import { mulberry32, shuffle } from "./rng";

/**
 * Pure layout builder for the Market Basket game.
 *
 * Regression guard (SIH demo blocker): the shelf must NEVER be a prefix
 * slice of the same permutation used to pick the basket — that placed the
 * memorized items at the top of the shelf in the exact practiced order,
 * reducing a working-memory task to reading practice.
 *
 * Both permutations are drawn from ONE seeded stream so the whole item
 * stays deterministic per (seed, listSize) — reproducible in tests and
 * stable across re-renders — while remaining statistically independent.
 */
export interface MarketLayout<T> {
  /** The K items to memorize, in presentation order. */
  basket: T[];
  /** Full-pool display order for the find phase; scatters the targets. */
  shelf: T[];
}

export function buildMarketLayout<T>(
  pool: readonly T[],
  seed: number,
  listSize: number,
): MarketLayout<T> {
  const rand = mulberry32(seed >>> 0);
  const basketOrder = shuffle(pool, rand);
  // Degenerate pools (0/1 items): a second permutation is identical, so
  // the shelf would BE the basket — the exact regression this module
  // guards against. Reversed order is the strongest available scatter.
  if (pool.length <= 1) {
    const only = pool.slice(0, 1);
    return { basket: only, shelf: [...only].reverse() };
  }
  // Consuming further numbers advances the stream, so this permutation
  // shares no structure with basketOrder's prefix.
  const shelf = shuffle(pool, rand);
  return {
    basket: basketOrder.slice(0, Math.max(1, Math.min(Math.max(1, listSize), pool.length))),
    shelf,
  };
}
