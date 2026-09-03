"use client";

/**
 * Long-term memory for the AI Companion — the thing that lets it genuinely
 * "remember" the person it talks to across sessions.
 *
 * Unlike the lightweight `AIProfile` (a finite set of counters in
 * localStorage), this keeps free-text facts the person has shared — their
 * name, their family, what they enjoy — plus the actual chat history, in
 * IndexedDB. Nothing ever leaves the device.
 *
 * The name / facts are then recalled when the companion replies, so a person
 * can say "I am Anas" once and be greeted as Anas from then on, forever. It
 * also reads old conversations back so the companion keeps context across
 * visits instead of starting from a blank page every time.
 */

const MEMORY_DB = "memoryassist-ai";
const MEMORY_DB_VERSION = 1;

/** Free-text things the person shared, keyed by category. */
export interface MemoryFact {
  /** Stable category, e.g. "name", "family", "interest", "origin", "birthday". */
  key: string;
  /** The remembered value, e.g. "Anas" or "My daughter is Sara". */
  value: string;
  /** When it was first/remembered. */
  ts: number;
}

/** One line of the stored conversation. */
export interface ChatLine {
  id: number;
  role: "user" | "ai";
  text: string;
  ts: number;
  tone?: string;
}

export interface AIMemory {
  facts: MemoryFact[];
  /** Recent chat history, oldest → newest, already capped. */
  chats: ChatLine[];
}

/** A single extracted, storable fact: category + normalized value. */
export interface ExtractedFact {
  key: string;
  value: string;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openMemoryDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB is not available in this browser"));
  }
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(MEMORY_DB, MEMORY_DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("facts")) {
        const facts = db.createObjectStore("facts", { keyPath: "key" });
        facts.createIndex("ts", "ts");
      }
      if (!db.objectStoreNames.contains("chats")) {
        const chats = db.createObjectStore("chats", { keyPath: "id", autoIncrement: true });
        chats.createIndex("ts", "ts");
      }
    };
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => db.close();
      resolve(db);
    };
    request.onerror = () => {
      dbPromise = null;
      reject(request.error ?? new Error("Could not open the assistant memory database"));
    };
    request.onblocked = () => {
      dbPromise = null;
      reject(new Error("Assistant memory database is blocked by another tab"));
    };
  });
  return dbPromise;
}

async function withMemStore<T>(
  name: string,
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T> | void,
): Promise<T | undefined> {
  const db = await openMemoryDb();
  return new Promise<T | undefined>((resolve, reject) => {
    let tx: IDBTransaction;
    try {
      tx = db.transaction(name, mode);
    } catch (error) {
      reject(error);
      return;
    }
    tx.oncomplete = () => resolve(result);
    tx.onabort = () => reject(tx.error ?? new Error("Memory transaction aborted"));
    tx.onerror = () => reject(tx.error ?? new Error("Memory transaction error"));
    const store = tx.objectStore(name);
    let result: T | undefined;
    try {
      const request = fn(store);
      if (request instanceof IDBRequest) {
        request.onsuccess = () => {
          result = request.result as T;
        };
        request.onerror = () => {
          try {
            tx.abort();
          } catch {}
        };
      }
    } catch (error) {
      reject(error);
    }
  });
}

// --- Observable cap for stored chat ---
/** Never keep more than this many chat lines; prunes the oldest first. */
export const MAX_CHAT_LINES = 400;

/**
 * Turns free text into storable facts. Conservative on purpose: we only
 * remember something when the person clearly and explicitly shared it, so
 * the companion never fabricates a memory. Returns an empty list for
 * messages it isn't sure about.
 */
export function extractFacts(text: string): ExtractedFact[] {
  const lower = ` ${text.toLowerCase()} `;
  const out: ExtractedFact[] = [];
  const add = (key: string, value: string) => {
    // De-duplicate: a single message may only state a category once.
    if (!out.some((f) => f.key === key)) out.push({ key, value });
  };

  // Name: "my name is X", "call me X", "i am X / I'm X".
  let m = lower.match(/(?:my name is|call me|i'm called|im called|i am called)\s+([a-z][a-z '-]{1,29})/);
  if (m) {
    add("name", capName(m[1]));
  } else {
    m = lower.match(/(?:^|\s)i am\s+([a-z][a-z '-]{1,29})(?:\s|[,.;!?]|$)/);
    // Only trust a bare "I am X" when it's a proper-looking name, not a
    // feeling ("I am sad", "I am tired"), a preposition ("I am from"),
    // or the start of a longer clause.
    if (m && !m[1].match(/^(so|very|just|feeling|a|little|not|still|here|ok|fine|tired|sad|happy|angry|scared|done|ready|back|from|in|at|on|with|looking|trying|having|going)\b/)) {
      add("name", capName(m[1]));
    }
  }

  // Family / relationships: "my <relation> is X" or "i have a <relation> called X".
  const relation = lower.match(/my\s+(wife|husband|daughter|son|mother|father|mom|dad|sister|brother|grand\s*son|grand\s*daughter|grandchild|grand\s*ma|grand\s*pa|ma|pa|aunt|uncle|nephew|niece|cousin)\s+(?:is|named|is called|s name is|s' name is)\s+([a-z][a-z '-]{1,29})/);
  if (relation) {
    add("family", `${cap(relation[1])} is ${capName(relation[2])}`);
  }

  // Interests / hobbies: "i like X", "i love X", "my hobby is X".
  m = lower.match(/my\s+hobby\s+is\s+([a-z][a-z '-]{1,49})/);
  if (m) {
    add("interest", m[1].trim());
  } else {
    m = lower.match(/(?:^|\s)i (?:really )?(?:love|like|enjoy)\s+([a-z][a-z '-]{1,49})(?:\s|[,.;!?]|$)/);
    if (m && !m[1].match(/^(it|this|that|playing|talking|to)\b/)) {
      add("interest", m[1].trim());
    }
  }

  // Origin / home.
  m = lower.match(/i am (?:from|originally from)\s+([a-z][a-z '-]{1,49})/);
  if (m) {
    add("origin", capName(m[1]));
  }

  // Birthday / born — match against original text to preserve capitalization.
  const birthdayMatch = text.match(/my birthday is\s+([a-z0-9 ,-]{1,49})/i);
  if (birthdayMatch) {
    add("birthday", birthdayMatch[1].trim());
  }

  return out;
}

function cap(word: string): string {
  return word[0].toUpperCase() + word.slice(1);
}

function capName(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

/**
 * Reads ALL remembered facts and recent chat history into one object.
 * Returns in-memory defaults (empty) when IndexedDB is unavailable so the
 * companion still works in degraded/private modes.
 */
export async function loadMemory(): Promise<AIMemory> {
  try {
    const [facts, chats] = await Promise.all([
      withMemStore<MemoryFact[]>("facts", "readonly", (s) => s.getAll() as IDBRequest<MemoryFact[]>),
      withMemStore<ChatLine[]>("chats", "readonly", (s) => s.getAll() as IDBRequest<ChatLine[]>),
    ]);
    return { facts: facts ?? [], chats: (chats ?? []).slice(-MAX_CHAT_LINES) };
  } catch {
    return { facts: [], chats: [] };
  }
}

/** Stores a fact, overwriting any previous value for the same category. */
export async function rememberFact(key: string, value: string): Promise<void> {
  try {
    const fact: MemoryFact = { key, value, ts: Date.now() };
    await withMemStore("facts", "readwrite", (s) => s.put(fact as never));
  } catch {
    /* non-fatal */
  }
}

/** Stores every fact extracted from a message. Fast path for rapid text. */
export async function rememberFacts(extracted: ExtractedFact[]): Promise<void> {
  for (const f of extracted) await rememberFact(f.key, f.value);
}

/** Appends a chat line and prunes to the cap. Returns nothing. */
export async function appendChat(entry: { role: "user" | "ai"; text: string; tone?: string }): Promise<void> {
  try {
    const db = await openMemoryDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("chats", "readwrite");
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(tx.error ?? new Error("chat write aborted"));
      tx.onerror = () => reject(tx.error ?? new Error("chat write failed"));
      const store = tx.objectStore("chats");
      store.add({ role: entry.role, text: entry.text, tone: entry.tone, ts: Date.now() } as never);
    });
    await pruneChats();
  } catch {
    /* non-fatal */
  }
}

/** Forgets every fact and all chat history ("Forget me"). */
export async function clearMemory(): Promise<void> {
  try {
    const db = await openMemoryDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(["facts", "chats"], "readwrite");
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(tx.error ?? new Error("clear aborted"));
      tx.onerror = () => reject(tx.error ?? new Error("clear failed"));
      tx.objectStore("facts").clear();
      tx.objectStore("chats").clear();
    });
  } catch {
    /* non-fatal */
  }
}

/**
 * Picks which remembered facts to use right now. The most useful personal
 * hook for almost any reply is the person's name (or a family member). Also
 * surfaces interests so suggestions can feel personal. Never returns more
 * than a couple of facts so replies stay warm and short.
 */
export function recallFacts(facts: MemoryFact[] | null | undefined): MemoryFact[] {
  if (!facts || facts.length === 0) return [];
  const byKey = new Map<string, MemoryFact>();
  for (const f of facts) byKey.set(f.key, f);

  const picked: MemoryFact[] = [];
  const order: string[] = ["name", "family", "interest", "origin", "birthday"];
  for (const key of order) {
    const f = byKey.get(key);
    if (f) {
      picked.push(f);
      if (picked.length >= 2) break;
    }
  }
  return picked;
}

async function pruneChats(): Promise<void> {
  try {
    const chats = await withMemStore<ChatLine[]>("chats", "readonly", (s) =>
      s.getAll() as IDBRequest<ChatLine[]>,
    );
    if (!chats || chats.length <= MAX_CHAT_LINES) return;
    const keep = chats.slice(-MAX_CHAT_LINES);
    const db = await openMemoryDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("chats", "readwrite");
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(tx.error ?? new Error("prune aborted"));
      tx.onerror = () => reject(tx.error ?? new Error("prune failed"));
      const store = tx.objectStore("chats");
      for (const line of chats) {
        if (!keep.some((k) => k.id === line.id)) store.delete(line.id);
      }
    });
  } catch {
    /* non-fatal */
  }
}
