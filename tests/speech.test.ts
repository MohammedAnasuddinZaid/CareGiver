import { describe, expect, it, vi } from "vitest";
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
    const spoken = guide.announce("mom", "Fatima. Your Mother.");
    expect(spoken).toBe(true);
    expect(speak).toHaveBeenCalledTimes(1);
    expect(speak).toHaveBeenCalledWith("Fatima. Your Mother.");
  });

  it("does not repeat while the same person stays visible (cooldown)", () => {
    const { guide, speak, advance } = makeGuide();
    guide.configure(true, "normal");
    guide.announce("mom", "Fatima. Your Mother.");
    advance(1000);
    guide.announce("mom", "Fatima. Your Mother.");
    advance(5000);
    guide.announce("mom", "Fatima. Your Mother.");
    expect(speak).toHaveBeenCalledTimes(1);
  });

  it("announces again after the cooldown elapses", () => {
    const { guide, speak, advance } = makeGuide();
    guide.configure(true, "normal");
    guide.announce("mom", "Fatima. Your Mother.");
    advance(31_000);
    expect(guide.announce("mom", "Fatima. Your Mother.")).toBe(true);
    expect(speak).toHaveBeenCalledTimes(2);
  });

  it("announces immediately on identity change", () => {
    const { guide, speak } = makeGuide();
    guide.configure(true, "normal");
    guide.announce("mom", "Fatima. Your Mother.");
    guide.announce("dad", "Ahmed. Your Father.");
    expect(speak).toHaveBeenCalledTimes(2);
  });

  it("is silent when disabled and cancels stale speech on reset", () => {
    const { guide, speak, cancel } = makeGuide();
    guide.configure(false, "normal");
    expect(guide.announce("mom", "Fatima. Your Mother.")).toBe(false);
    expect(speak).not.toHaveBeenCalled();
    guide.reset();
    expect(cancel).toHaveBeenCalled();
  });
});
