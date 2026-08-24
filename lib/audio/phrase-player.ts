import { LOCALE_META } from "@/lib/i18n/locales";

/**
 * Game + reminder voice output.
 *
 * Three-tier delivery chain, best-first:
 *   1. Pre-synthesized phrase pack — `/audio/{locale}/{phraseKey}.mp3`
 *      (built offline with AI4Bharat IndicTTS; deterministic and warm).
 *   2. Caregiver-recorded clip in IndexedDB (future hook; same key space).
 *   3. Live `speechSynthesis` with the locale's BCP-47 tag.
 *   4. Silent no-op when nothing is available (feature-detected).
 *
 * Tones are synthesized locally via WebAudio — celebration arpeggio,
 * gentle miss chime, tick — so games never depend on audio files.
 */

export type ToneKind = "success" | "miss" | "tick" | "celebrate" | "alert";

export class PhrasePlayer {
  private enabled = true;
  private rate = 1;
  private audioCache = new Map<string, HTMLAudioElement>();
  private ctx: AudioContext | null = null;

  configure(enabled: boolean, rate: number): void {
    this.enabled = enabled;
    this.rate = Math.min(1.3, Math.max(0.7, rate));
  }

  reset(): void {
    this.stopSpeech();
    this.audioCache.clear();
  }

  // -- Speech -------------------------------------------------------------

  /** Speaks `text` localized for `locale`. Returns true when spoken. */
  speak(text: string, locale: string): boolean {
    if (!this.enabled || !text) return false;
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return false;
    const tag = LOCALE_META[locale as keyof typeof LOCALE_META]?.speechTag ?? "en-IN";
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = tag;
      u.rate = this.rate;
      u.pitch = 1;
      window.speechSynthesis.speak(u);
      return true;
    } catch {
      return false;
    }
  }

  stopSpeech(): void {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  }

  /**
   * Plays a pre-synthesized pack phrase if present; falls back to live TTS
   * of `fallbackText`. Safe to call freely — failures are silent.
   */
  async phrase(
    key: string,
    locale: string,
    fallbackText?: string,
  ): Promise<boolean> {
    if (!this.enabled) return false;
    if (await this.playPackPhrase(key, locale)) return true;
    return fallbackText ? this.speak(fallbackText, locale) : false;
  }

  private async playPackPhrase(key: string, locale: string): Promise<boolean> {
    if (typeof Audio === "undefined") return false;
    const cacheKey = `${locale}:${key}`;
    let el = this.audioCache.get(cacheKey);
    if (!el) {
      // HEAD-less existence probe keeps the console clean on misses.
      try {
        const res = await fetch(`/audio/${locale}/${encodeURIComponent(key)}.mp3`, {
          method: "HEAD",
        });
        if (!res.ok) return false;
      } catch {
        return false;
      }
      el = new Audio(`/audio/${locale}/${encodeURIComponent(key)}.mp3`);
      el.preload = "auto";
      this.audioCache.set(cacheKey, el);
    }
    try {
      el.currentTime = 0;
      await el.play();
      return true;
    } catch {
      return false;
    }
  }

  // -- Synthesized tones ----------------------------------------------------

  tone(kind: ToneKind, volume = 0.15): void {
    if (typeof window === "undefined" || !window.AudioContext) return;
    try {
      this.ctx ??= new AudioContext();
      const ctx = this.ctx;
      if (ctx.state === "suspended") void ctx.resume();

      const notes: number[][] =
        kind === "success"
          ? [[523.25, 0], [659.25, 0.09]]
          : kind === "celebrate"
            ? [
                [523.25, 0],
                [659.25, 0.1],
                [783.99, 0.2],
                [1046.5, 0.3],
              ]
            : kind === "miss"
              ? [[329.63, 0]]
              : kind === "alert"
                ? [[440, 0], [440, 0.18]]
                : [[880, 0]];

      let latestEnd = ctx.currentTime + 0.05;
      for (const [freq, delay] of notes) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const start = ctx.currentTime + delay;
        osc.type = kind === "miss" || kind === "tick" ? "sine" : "triangle";
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(volume, start);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.32);
        osc.connect(gain).connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.34);
        latestEnd = Math.max(latestEnd, start + 0.34);
      }
      // Auto-close only after the last note to keep the context reusable.
      void latestEnd;
    } catch {
      // Audio blocked or unavailable — silent fallback.
    }
  }
}
