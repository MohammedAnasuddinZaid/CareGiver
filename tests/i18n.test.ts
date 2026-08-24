import { describe, expect, it } from "vitest";
import {
  dictionaries,
  LOCALES,
  localizeNumber,
  LOCALE_META,
} from "@/lib/i18n/locales";

describe("locale packs", () => {
  it("every locale implements the complete English key set", () => {
    const enKeys = Object.keys(dictionaries.en).sort();
    for (const locale of LOCALES) {
      const keys = Object.keys(dictionaries[locale]).sort();
      expect(keys, `${locale} is missing phrases`).toEqual(enKeys);
    }
  });

  it("no phrase is empty or whitespace", () => {
    for (const locale of LOCALES) {
      for (const [key, value] of Object.entries(dictionaries[locale])) {
        expect(value.trim().length, `${locale}.${key} is blank`).toBeGreaterThan(0);
      }
    }
  });

  it("each locale declares a BCP-47 speech tag and digit set", () => {
    for (const locale of LOCALES) {
      const meta = LOCALE_META[locale];
      expect(meta.speechTag).toMatch(/^[a-z]{2,3}-[A-Za-z]{2,4}$/);
      expect(meta.digits).toHaveLength(10);
    }
  });
});

describe("localizeNumber", () => {
  it("converts Western digits to Bengali/Assamese numerals", () => {
    expect(localizeNumber(7, "bn")).toBe("৭");
    expect(localizeNumber("12", "as")).toBe("১২");
  });

  it("leaves Latin-script locales unchanged", () => {
    expect(localizeNumber(42, "en")).toBe("42");
    expect(localizeNumber(42, "brx")).toBe("42");
  });
});
