export type SpeechRate = "slow" | "normal" | "fast";
export type Sensitivity = "cautious" | "balanced" | "permissive";
export type LocaleSetting = string;

export interface AppSettings {
  recognitionEnabled: boolean;
  voiceEnabled: boolean;
  speechRate: SpeechRate;
  soundCues: boolean;
  largeText: boolean;
  highContrast: boolean;
  reduceMotion: boolean;
  sensitivity: Sensitivity;
  developerMode: boolean;
  /** UI + voice language for games and reminders ("en" default). */
  locale: LocaleSetting;
}

export const DEFAULT_SETTINGS: AppSettings = {
  recognitionEnabled: true,
  voiceEnabled: true,
  speechRate: "normal",
  soundCues: false,
  largeText: false,
  highContrast: false,
  reduceMotion: false,
  sensitivity: "balanced",
  developerMode: false,
  locale: "en",
};

const KEY = "ma.settings.v1";

function sanitize(input: unknown): AppSettings {
  const merged: AppSettings = { ...DEFAULT_SETTINGS };
  if (!input || typeof input !== "object") return merged;
  const raw = input as Record<string, unknown>;
  if (typeof raw.recognitionEnabled === "boolean") merged.recognitionEnabled = raw.recognitionEnabled;
  if (typeof raw.voiceEnabled === "boolean") merged.voiceEnabled = raw.voiceEnabled;
  if (raw.speechRate === "slow" || raw.speechRate === "normal" || raw.speechRate === "fast") {
    merged.speechRate = raw.speechRate;
  }
  if (typeof raw.soundCues === "boolean") merged.soundCues = raw.soundCues;
  if (typeof raw.largeText === "boolean") merged.largeText = raw.largeText;
  if (typeof raw.highContrast === "boolean") merged.highContrast = raw.highContrast;
  if (typeof raw.reduceMotion === "boolean") merged.reduceMotion = raw.reduceMotion;
  if (raw.sensitivity === "cautious" || raw.sensitivity === "balanced" || raw.sensitivity === "permissive") {
    merged.sensitivity = raw.sensitivity;
  }
  if (typeof raw.developerMode === "boolean") merged.developerMode = raw.developerMode;
  if (typeof raw.locale === "string" && /^[a-z]{2,3}(-[A-Za-z]{2,4})?$/.test(raw.locale)) {
    merged.locale = raw.locale.slice(0, 10);
  }
  return merged;
}

export function loadSettings(): AppSettings {
  if (typeof window === "undefined") return { ...DEFAULT_SETTINGS };
  try {
    const stored = window.localStorage.getItem(KEY);
    if (!stored) {
      // Respect the OS preference until the user chooses explicitly.
      const prefersReduced =
        typeof window.matchMedia === "function" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      return { ...DEFAULT_SETTINGS, reduceMotion: prefersReduced };
    }
    return sanitize(JSON.parse(stored));
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: AppSettings): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // storage full or blocked — non-fatal
  }
}

export function applySettingsToDocument(settings: AppSettings): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.toggle("large-text", settings.largeText);
  root.classList.toggle("high-contrast", settings.highContrast);
  root.classList.toggle("reduce-motion", settings.reduceMotion);
}
