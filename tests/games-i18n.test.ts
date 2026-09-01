import { describe, expect, it } from "vitest";
import { GAME_IDS } from "@/lib/games/types";
import { LOCALES } from "@/lib/i18n/locales";
import {
  GAME_STRINGS,
  gameInstruction,
  gameTitle,
  memoryCards,
  memoryLaneTexts,
} from "@/lib/i18n/games";

describe("game strings", () => {
  it("exposes a non-empty title + instruction for every game in English", () => {
    const en = GAME_STRINGS.en;
    expect(en).toBeDefined();
    for (const id of GAME_IDS) {
      const p = en?.[id];
      expect(p, `missing EN phrases for ${id}`).toBeDefined();
      expect(p?.title.trim().length).toBeGreaterThan(0);
      expect(p?.instruction.trim().length).toBeGreaterThan(0);
    }
  });

  it("every shipped locale covers every game, falling back only where allowed", () => {
    for (const locale of ["as", "bn", "hi", "brx"] as const) {
      const pack = GAME_STRINGS[locale];
      expect(pack, `${locale} pack missing`).toBeDefined();
      for (const id of GAME_IDS) {
        const title = gameTitle(id, locale);
        const instruction = gameInstruction(id, locale);
        // Locale pack values are non-empty (never a blank spacer).
        expect(title, `${locale}.${id}.title is blank`).not.toBe("");
        expect(instruction, `${locale}.${id}.instruction is blank`).not.toBe("");
      }
    }
  });

  it("mni falls back to English until the native pack ships", () => {
    for (const id of GAME_IDS) {
      expect(gameTitle(id, "mni")).toBe(GAME_STRINGS.en?.[id]?.title);
      expect(gameInstruction(id, "mni")).toBe(GAME_STRINGS.en?.[id]?.instruction);
    }
  });
});

describe("Memory Lane cards", () => {
  it("every locale yields the same cards in the same order", () => {
    const ids = memoryCards("en").map((c) => c.id);
    expect(ids).toHaveLength(12);
    for (const locale of LOCALES) {
      const cards = memoryCards(locale);
      expect(cards.map((c) => c.id)).toEqual(ids);
    }
  });

  it("English cards carry full playable content", () => {
    for (const card of memoryCards("en")) {
      expect(card.title.trim()).toBeTruthy();
      expect(card.question.trim()).toBeTruthy();
      expect(card.correct.trim()).toBeTruthy();
      expect(card.distractors.length).toBeGreaterThanOrEqual(2);
      expect(card.story.trim()).toBeTruthy();
      expect(card.ask.trim()).toBeTruthy();
    }
  });

  it("hi, bn and as fully localize every game-play field", () => {
    const en = memoryCards("en");
    for (const locale of ["hi", "bn", "as"] as const) {
      const cards = memoryCards(locale);
      cards.forEach((card, i) => {
        const src = en[i];
        expect(card.title, `${locale} title`).not.toBe(src.title);
        expect(card.question, `${locale} question`).not.toBe(src.question);
        expect(card.correct, `${locale} correct`).not.toBe(src.correct);
        expect(card.story, `${locale} story`).not.toBe(src.story);
        expect(card.ask, `${locale} ask`).not.toBe(src.ask);
        expect(card.distractors).toHaveLength(src.distractors.length);
      });
    }
  });

  it("brx localizes the game-play essentials (title/question/correct)", () => {
    const en = memoryCards("en");
    const cards = memoryCards("brx");
    cards.forEach((card, i) => {
      expect(card.title, "brx title").not.toBe(en[i].title);
      expect(card.question, "brx question").not.toBe(en[i].question);
      expect(card.correct, "brx correct").not.toBe(en[i].correct);
    });
  });

  it("UI strings always resolve to real text", () => {
    for (const locale of LOCALES) {
      const t = memoryLaneTexts(locale);
      expect(t.takeMeBack.trim()).toBeTruthy();
      expect(t.talkTogether.trim()).toBeTruthy();
      expect(t.cards.length).toBe(memoryCards("en").length);
    }
  });
});