"use client";

import { useMemo } from "react";
import { dictionaryFor, localizeNumber, LOCALES, type Dictionary, type Locale } from "@/lib/i18n/locales";
import { useSettings } from "./use-settings";

export interface LocaleContextValue {
  locale: Locale;
  t: (key: keyof Dictionary) => string;
  n: (value: number | string) => string;
  dict: Dictionary;
}

/**
 * Locale accessor backed by persisted settings. Falls back to English for
 * unknown values so a corrupted settings record can never blank the UI.
 */
export function useLocale(): LocaleContextValue {
  const { settings } = useSettings();
  return useMemo(() => {
    const raw = settings.locale as Locale;
    const locale: Locale = (LOCALES as readonly string[]).includes(raw) ? raw : "en";
    const dict = dictionaryFor(locale);
    return {
      locale,
      dict,
      t: (key) => dict[key],
      n: (value) => localizeNumber(value, locale),
    };
  }, [settings.locale]);
}
