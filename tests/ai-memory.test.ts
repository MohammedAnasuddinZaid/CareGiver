import { describe, expect, it, beforeEach } from "vitest";
import {
  extractFacts,
  recallFacts,
  rememberFact,
  loadMemory,
  clearMemory,
  appendChat,
  rememberFacts,
  type MemoryFact,
} from "@/lib/ai/memory";

describe("extractFacts", () => {
  it("extracts a name from 'my name is X'", () => {
    const facts = extractFacts("my name is Anas");
    expect(facts).toHaveLength(1);
    expect(facts[0].key).toBe("name");
    expect(facts[0].value).toBe("Anas");
  });

  it("extracts a name from 'call me X'", () => {
    const facts = extractFacts("call me Zaid");
    expect(facts).toHaveLength(1);
    expect(facts[0].value).toBe("Zaid");
  });

  it("extracts a name from 'I am X' (proper name only)", () => {
    const facts = extractFacts("i am Mohammed");
    expect(facts).toHaveLength(1);
    expect(facts[0].key).toBe("name");
    expect(facts[0].value).toBe("Mohammed");
  });

  it("does NOT extract a name from 'I am sad'", () => {
    const facts = extractFacts("i am sad today");
    expect(facts).toHaveLength(0);
  });

  it("extracts a name from the contraction 'I'm X'", () => {
    const facts = extractFacts("im anas");
    expect(facts).toHaveLength(1);
    expect(facts[0]).toEqual({ key: "name", value: "Anas" });
  });

  it("extracts a name from 'i'm anas'", () => {
    const facts = extractFacts("i'm anas");
    expect(facts).toEqual([{ key: "name", value: "Anas" }]);
  });

  it("does NOT extract a name from 'i'm tired'", () => {
    expect(extractFacts("im tired")).toHaveLength(0);
  });

  it("extracts a two-word name from 'my name is'", () => {
    const facts = extractFacts("my name is anasuddin zaid");
    expect(facts).toEqual([{ key: "name", value: "Anasuddin Zaid" }]);
  });

  it("does NOT extract a name from 'I am tired'", () => {
    const facts = extractFacts("i am tired");
    expect(facts).toHaveLength(0);
  });

  it("extracts a family relationship", () => {
    const facts = extractFacts("my daughter is Sara");
    expect(facts).toEqual([{ key: "family", value: "Daughter is Sara" }]);
  });

  it("extracts a hobby", () => {
    const facts = extractFacts("my hobby is gardening");
    expect(facts).toEqual([{ key: "interest", value: "gardening" }]);
  });

  it("extracts an interest from 'i love X'", () => {
    const facts = extractFacts("i love music");
    expect(facts).toEqual([{ key: "interest", value: "music" }]);
  });

  it("extracts an interest from 'i like X'", () => {
    const facts = extractFacts("i like chess");
    expect(facts).toEqual([{ key: "interest", value: "chess" }]);
  });

  it("extracts origin", () => {
    const facts = extractFacts("i am from Hyderabad");
    expect(facts).toEqual([{ key: "origin", value: "Hyderabad" }]);
  });

  it("extracts birthday", () => {
    const facts = extractFacts("my birthday is January 15");
    expect(facts).toEqual([{ key: "birthday", value: "January 15" }]);
  });

  it("returns empty array for unrelated messages", () => {
    expect(extractFacts("hello how are you")).toHaveLength(0);
    expect(extractFacts("plan my day")).toHaveLength(0);
    expect(extractFacts("i feel sad")).toHaveLength(0);
  });

  it("de-duplicates within one message", () => {
    const facts = extractFacts("i am Anas and my name is Anas");
    const names = facts.filter((f) => f.key === "name");
    expect(names).toHaveLength(1);
  });

  it("extracts multiple facts from one message", () => {
    const facts = extractFacts("my name is Anas and i like cricket");
    expect(facts.some((f) => f.key === "name")).toBe(true);
    expect(facts.some((f) => f.key === "interest")).toBe(true);
  });
});

describe("recallFacts", () => {
  it("returns name and interest when available", () => {
    const facts: MemoryFact[] = [
      { key: "name", value: "Anas", ts: 1 },
      { key: "interest", value: "music", ts: 2 },
      { key: "origin", value: "Hyderabad", ts: 3 },
    ];
    const picked = recallFacts(facts);
    expect(picked.map((f) => f.key)).toEqual(["name", "interest"]);
  });

  it("returns only what exists", () => {
    const facts: MemoryFact[] = [{ key: "interest", value: "chess", ts: 1 }];
    const picked = recallFacts(facts);
    expect(picked).toHaveLength(1);
    expect(picked[0].key).toBe("interest");
  });

  it("returns empty for no facts", () => {
    expect(recallFacts([])).toEqual([]);
  });

  it("returns empty for null/undefined", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(recallFacts(null as any)).toEqual([]);
  });

  it("caps at 2 facts", () => {
    const facts: MemoryFact[] = [
      { key: "name", value: "Anas", ts: 1 },
      { key: "family", value: "Daughter is Sara", ts: 2 },
      { key: "interest", value: "music", ts: 3 },
      { key: "origin", value: "Hyderabad", ts: 4 },
    ];
    expect(recallFacts(facts)).toHaveLength(2);
  });
});

describe("IndexedDB memory round-trip", () => {
  beforeEach(async () => {
    await clearMemory();
  });

  it("stores and retrieves a fact", async () => {
    await rememberFact("name", "Anas");
    const mem = await loadMemory();
    expect(mem.facts).toHaveLength(1);
    expect(mem.facts[0].key).toBe("name");
    expect(mem.facts[0].value).toBe("Anas");
  });

  it("overwrites a fact with the same key", async () => {
    await rememberFact("name", "Anas");
    await rememberFact("name", "Zaid");
    const mem = await loadMemory();
    const nameFact = mem.facts.find((f) => f.key === "name");
    expect(nameFact?.value).toBe("Zaid");
  });

  it("stores multiple facts at once", async () => {
    await rememberFacts([
      { key: "name", value: "Anas" },
      { key: "interest", value: "music" },
    ]);
    const mem = await loadMemory();
    expect(mem.facts).toHaveLength(2);
  });

  it("appends chat lines and retrieves them", async () => {
    await appendChat({ role: "user", text: "hello" });
    await appendChat({ role: "ai", text: "hi there" });
    const mem = await loadMemory();
    expect(mem.chats).toHaveLength(2);
    expect(mem.chats[0].role).toBe("user");
    expect(mem.chats[0].text).toBe("hello");
    expect(mem.chats[1].role).toBe("ai");
    expect(mem.chats[1].text).toBe("hi there");
  });

  it("clearMemory removes all data", async () => {
    await rememberFact("name", "Anas");
    await appendChat({ role: "user", text: "hi" });
    await clearMemory();
    const mem = await loadMemory();
    expect(mem.facts).toHaveLength(0);
    expect(mem.chats).toHaveLength(0);
  });

  it("appendChat stores tone", async () => {
    await appendChat({ role: "ai", text: "hello!", tone: "greet" });
    const mem = await loadMemory();
    expect(mem.chats[0].tone).toBe("greet");
  });
});
