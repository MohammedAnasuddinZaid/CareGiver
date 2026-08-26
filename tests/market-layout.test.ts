import { describe, expect, it } from "vitest";
import { MARKET_GOODS } from "@/components/games/market-game";
import { buildMarketLayout } from "@/lib/games/market-layout";

/**
 * Regression tests for the Market Basket layout.
 *
 * The original implementation sliced the basket from the SAME permutation
 * that laid out the shelf, so memorized items always occupied the first
 * grid cells in the exact practiced order — the memory task was trivially
 * bypassed. These tests pin the corrected behavior:
 *
 *   1. Determinism — same seed ⇒ identical basket and shelf.
 *   2. Validity — the shelf contains every good exactly once; the basket
 *      is a subset of the pool with the requested size.
 *   3. Scatter — across many seeds the basket items are distributed over
 *      the whole shelf, never structurally pinned to the leading cells,
 *      and the shelf NEVER begins with the full basket in memorized order.
 */
describe("buildMarketLayout", () => {
  const idsOf = (items: readonly { id: string }[]) => items.map((g) => g.id);

  it("is deterministic for a given seed and list size", () => {
    const a = buildMarketLayout(MARKET_GOODS, 104_734, 3);
    const b = buildMarketLayout(MARKET_GOODS, 104_734, 3);
    expect(idsOf(a.basket)).toEqual(idsOf(b.basket));
    expect(idsOf(a.shelf)).toEqual(idsOf(b.shelf));
  });

  it("produces a full-pool shelf with unique entries", () => {
    for (let seed = 1; seed <= 50; seed++) {
      const { shelf } = buildMarketLayout(MARKET_GOODS, seed, 4);
      expect(shelf).toHaveLength(MARKET_GOODS.length);
      expect(new Set(idsOf(shelf))).toHaveLength(MARKET_GOODS.length);
    }
  });

  it("baskets the requested number of items from the pool", () => {
    for (const listSize of [2, 3, 4, 5, 6]) {
      const { basket } = buildMarketLayout(MARKET_GOODS, 42 + listSize, listSize);
      expect(basket).toHaveLength(listSize);
      const poolIds = new Set(idsOf(MARKET_GOODS));
      for (const id of idsOf(basket)) expect(poolIds.has(id)).toBe(true);
    }
  });

  it("scatters basket items across the shelf instead of prefixing them", () => {
    const seeds = 300;
    const firstPositions = new Set<number>();
    let prefixedSequences = 0;

    for (let seed = 1; seed <= seeds; seed++) {
      const { basket, shelf } = buildMarketLayout(MARKET_GOODS, seed, 4);
      const basketIds = idsOf(basket);
      const shelfIds = idsOf(shelf);

      firstPositions.add(shelfIds.indexOf(basketIds[0]));
      // The fatal old behavior: shelf starts with the ENTIRE memorized
      // sequence. Statistically impossible under independent permutation;
      // structurally guaranteed under the original bug.
      if (shelfIds.slice(0, basketIds.length).join() === basketIds.join()) {
        prefixedSequences++;
      }
    }

    // The first target must not always land at position 0 (the old bug's
    // signature) — variety proves genuine scattering.
    expect(firstPositions.size).toBeGreaterThan(3);
    expect(prefixedSequences).toBe(0);
  });

  it("never repeats an item within one basket", () => {
    for (let seed = 1; seed <= 100; seed++) {
      const { basket } = buildMarketLayout(MARKET_GOODS, seed, 6);
      expect(new Set(idsOf(basket))).toHaveLength(6);
    }
  });
});
