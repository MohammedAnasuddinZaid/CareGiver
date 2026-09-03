import { describe, expect, it, vi } from "vitest";
import { PhrasePlayer } from "@/lib/audio/phrase-player";
import { SpeechGuide } from "@/lib/speech/speech-service";

function makeGuide() {
  const speak = vi.fn();
  const cancel = vi.fn();
  let now = 0;
  const guide = new SpeechGuide(
    speak,
    cancel,
    () => now,
  );
  return { guide, speak, cancel, advance: (ms: number) => (now += ms) };
}

describe("SpeechGuide — calm voice behavior", () => {
  it("speaks once when a person becomes stable", () => {
    const { guide, speak } = makeGuide();
    guide.configure(true, "normal");
    const spoken = guide.announce("mom", "Sam. Your Mother.");
    expect(spoken).toBe(true);
    expect(speak).toHaveBeenCalledTimes(1);
    expect(speak).toHaveBeenCalledWith("Sam. Your Mother.");
  });

  it("does not repeat while the same person stays visible (cooldown)", () => {
    const { guide, speak, advance } = makeGuide();
    guide.configure(true, "normal");
    guide.announce("mom", "Sam. Your Mother.");
    advance(1000);
    guide.announce("mom", "Sam. Your Mother.");
    advance(5000);
    guide.announce("mom", "Sam. Your Mother.");
    expect(speak).toHaveBeenCalledTimes(1);
  });

  it("announces again after the cooldown elapses", () => {
    const { guide, speak, advance } = makeGuide();
    guide.configure(true, "normal");
    guide.announce("mom", "Sam. Your Mother.");
    advance(31_000);
    expect(guide.announce("mom", "Sam. Your Mother.")).toBe(true);
    expect(speak).toHaveBeenCalledTimes(2);
  });

  it("announces immediately on identity change", () => {
    const { guide, speak } = makeGuide();
    guide.configure(true, "normal");
    guide.announce("mom", "Sam. Your Mother.");
    guide.announce("dad", "Tom. Your Father.");
    expect(speak).toHaveBeenCalledTimes(2);
  });

  it("is silent when disabled and cancels stale speech on reset", () => {
    const { guide, speak, cancel } = makeGuide();
    guide.configure(false, "normal");
    expect(guide.announce("mom", "Sam. Your Mother.")).toBe(false);
    expect(speak).not.toHaveBeenCalled();
    guide.reset();
    expect(cancel).toHaveBeenCalled();
  });
});

describe("PhrasePlayer — transition vs teardown speech handling", () => {
  it("dispose() must NOT cancel in-progress speech (item transition)", () => {
    const player = new PhrasePlayer();
    const stopSpeech = vi
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .spyOn(player as any, "stopSpeech")
      .mockImplementation(() => undefined);
    player.dispose();
    expect(stopSpeech).not.toHaveBeenCalled();
  });

  it("reset() DOES cancel speech (true teardown)", () => {
    const player = new PhrasePlayer();
    const stopSpeech = vi
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .spyOn(player as any, "stopSpeech")
      .mockImplementation(() => undefined);
    player.reset();
    expect(stopSpeech).toHaveBeenCalledTimes(1);
  });
});
