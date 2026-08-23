import { recognitionConfig } from "@/lib/recognition/config";
import type { SpeechRate } from "@/lib/settings/settings";

const RATE_MAP: Record<SpeechRate, number> = {
  slow: 0.85,
  normal: 1,
  fast: 1.15,
};

export function speechSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

/**
 * Local, browser-native voice guidance (Web Speech API).
 * - Announces only STABLE identities, never per-frame.
 * - Cooldowns prevent nagging; identity changes always announce.
 * - Cancels stale utterances instead of queueing a backlog.
 */
export class SpeechGuide {
  private lastSpokenAt = new Map<string, number>();
  private enabled = true;
  private rate: SpeechRate = "normal";

  constructor(
    private readonly speakFn: ((text: string) => void) | null = null,
    private readonly cancelFn: (() => void) | null = null,
    private nowFn: () => number = () => Date.now(),
  ) {}

  configure(enabled: boolean, rate: SpeechRate): void {
    this.enabled = enabled;
    this.rate = rate;
  }

  reset(): void {
    this.lastSpokenAt.clear();
    this.cancel();
  }

  cancel(): void {
    if (this.cancelFn) {
      this.cancelFn();
      return;
    }
    if (speechSupported()) window.speechSynthesis.cancel();
  }

  /** Returns true when an announcement was actually spoken. */
  announce(personId: string, phrase: string): boolean {
    if (!this.enabled || !phrase) return false;
    const now = this.nowFn();
    const previous = this.lastSpokenAt.get(personId);
    if (previous !== undefined && now - previous < recognitionConfig.speechCooldownMs) {
      return false;
    }
    this.lastSpokenAt.set(personId, now);
    if (this.speakFn) {
      this.speakFn(phrase);
      return true;
    }
    if (!speechSupported()) return false;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(phrase);
    utterance.rate = RATE_MAP[this.rate];
    utterance.pitch = 1;
    utterance.volume = 1;
    window.speechSynthesis.speak(utterance);
    return true;
  }

  /** Subtle confirmation tone via WebAudio — used for optional sound cues. */
  playCue(volume = 0.12): void {
    if (typeof window === "undefined" || !(window.AudioContext)) return;
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(volume, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.36);
      osc.onended = () => void ctx.close();
    } catch {
      // audio blocked — silent fallback
    }
  }
}
