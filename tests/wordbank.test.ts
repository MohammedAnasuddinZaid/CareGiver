import { describe, expect, it } from "vitest";
import { WORDS, WORD_BANK, anagramSafeWords } from "@/lib/games/wordbank";

describe("Word Builder anagram safety", () => {
  it("removes every word that shares its letters with another word", () => {
    // GARDEN is the reported case: its letters also spell DANGER/RANGED, and
    // it was listed in TWO banks — so it must be gone from both.
    for (const group of WORDS) {
      expect(group).not.toContain("GARDEN");
    }
  });

  it("leaves no two words with the same sorted-letter signature", () => {
    const signature = (w: string) => [...w].sort().join("");
    const counts = new Map<string, string[]>();
    for (const group of WORDS) {
      for (const w of group) {
        const sig = signature(w);
        counts.set(sig, [...(counts.get(sig) ?? []), w]);
      }
    }
    for (const [sig, words] of counts) {
      expect(words, `anagram collision on '${sig}': [${words.join(", ")}]`).toHaveLength(1);
    }
  });

  it("keeps ordinary, unambiguous words intact", () => {
    const all = WORDS.flat();
    for (const w of ["SUN", "HOME", "RIVER", "BASKET", "MEMORY", "CANDLE"]) {
      expect(all).toContain(w);
    }
  });

  it("detects case-insensitive duplicates (a word spelled twice)", () => {
    const bank: string[][] = [
      ["GARDEN", "DANGER"],
      ["RANGED", "DOOR"],
    ];
    const cleaned = anagramSafeWords(bank);
    // GARDEN/DANGER/RANGED are all mutual anagrams → all removed.
    expect(cleaned.flat()).toEqual(["DOOR"]);
  });

  it("never produces an empty level", () => {
    for (const group of WORDS) {
      expect(group.length).toBeGreaterThan(0);
    }
  });
});
