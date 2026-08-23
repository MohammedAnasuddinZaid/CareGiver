import { describe, expect, it } from "vitest";
import { PerfGovernor } from "@/lib/recognition/perf-governor";
import { recognitionConfig } from "@/lib/recognition/config";

const cfg = recognitionConfig.performance;

describe("PerfGovernor — adaptive detector resolution", () => {
  it("starts at the highest-accuracy tier", () => {
    const g = new PerfGovernor(cfg);
    expect(g.inputSize).toBe(cfg.inputSizes[0]);
    expect(g.stats.tier).toBe(0);
  });

  it("demotes tiers when latency stays above the budget", () => {
    const g = new PerfGovernor(cfg);
    let t = 0;
    // Sustained slow inference:
    for (let i = 0; i < 10; i++) g.record(600, (t += cfg.changeCooldownMs + 1));
    expect(g.stats.tier).toBe(cfg.inputSizes.length - 1);
    expect(g.inputSize).toBe(cfg.inputSizes[cfg.inputSizes.length - 1]);
  });

  it("promotes back up when the device proves fast again", () => {
    const g = new PerfGovernor(cfg);
    let t = 0;
    for (let i = 0; i < 10; i++) g.record(700, (t += cfg.changeCooldownMs + 1));
    for (let i = 0; i < 20; i++) g.record(60, (t += cfg.changeCooldownMs + 1));
    expect(g.stats.tier).toBe(0);
  });

  it("respects the cooldown — no thrashing frame to frame", () => {
    const g = new PerfGovernor(cfg);
    let t = 0;
    g.record(1000, (t += 1)); // would demote…
    const tierAfterFirst = g.stats.tier;
    g.record(1000, (t += 1)); // …but cooldown blocks an immediate change
    g.record(1000, (t += 1));
    expect(g.stats.tier).toBe(tierAfterFirst);
  });

  it("ignores nonsense latencies", () => {
    const g = new PerfGovernor(cfg);
    g.record(NaN, 1);
    g.record(-5, 2);
    expect(g.stats.ewmaLatencyMs).toBeNull();
  });

  it("EWMA smooths a single spike without changing tier", () => {
    const g = new PerfGovernor(cfg);
    let t = 0;
    for (let i = 0; i < 8; i++) g.record(120, (t += cfg.changeCooldownMs + 1));
    const before = g.stats.tier;
    g.record(900, (t += cfg.changeCooldownMs + 1));
    expect(g.stats.tier).toBe(before);
  });
});
