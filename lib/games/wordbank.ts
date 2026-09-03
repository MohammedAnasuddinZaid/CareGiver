/**
 * Word Builder — the spelling word bank, kept anagram-free.
 *
 * A Word Builder puzzle shows scrambled letter tiles that the player must
 * re-arrange to spell the target word. If the target's letter multiset could
 * also spell ANOTHER word, the puzzle is ambiguous — GARDEN was a real case
 * (its letters G,A,R,D,E,N also spell DANGER and RANGED, and GARDEN was even
 * listed twice). `anagramSafeWords` strips any word that shares its sorted
 * letter signature with another word in the combined bank, guaranteeing the
 * only valid arrangement of a puzzle's tiles is the intended target.
 */

export const WORD_BANK: string[][] = [
  ["SUN", "KEY", "TEA", "CAT", "OWL", "BEE"],
  ["HOME", "CARE", "LOVE", "TREE", "SONG", "STAR", "FISH", "DOOR", "BELL", "MILK"],
  ["PLANT", "RIVER", "MUSIC", "HEART", "BREAD", "SMILE", "LIGHT", "CHAIR", "WATER"],
  ["FLOWER", "BASKET", "MARKET", "WINDOW", "KITCHEN", "FAMILY", "SPRING"],
  ["MEMORY", "LETTER", "BOTTLE", "ORANGE", "CANDLE", "PENCIL", "TEMPLE"],
];

const signatureLower = (w: string): string => [...w.toLowerCase()].sort().join("");

/**
 * Returns a copy of `bank` with any word removed whose letters could also
 * spell another word present anywhere in the bank. Comparison is
 * case-insensitive so a duplicated word spelled differently is still caught.
 */
export function anagramSafeWords(
  bank: readonly (readonly string[])[] = WORD_BANK,
): string[][] {
  const counts = new Map<string, number>();
  for (const group of bank)
    for (const w of group) {
      const sig = signatureLower(w);
      counts.set(sig, (counts.get(sig) ?? 0) + 1);
    }
  return bank.map((group) =>
    group.filter((w) => (counts.get(signatureLower(w)) ?? 0) === 1),
  );
}

/** Anagram-free word groups used by the Word Builder game. */
export const WORDS: string[][] = anagramSafeWords();
