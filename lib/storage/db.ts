/**
 * Local-first IndexedDB layer.
 *
 * Design notes:
 * - Profiles and photo assets live in IndexedDB because they can be large
 *   (blobs, descriptors); small non-sensitive app settings use localStorage.
 * - Nothing here ever leaves the device. There is no network code in this
 *   entire module.
 * - The schema is versioned; future upgrades migrate in `upgradeDatabase`
 *   instead of deleting data.
 */

const DB_NAME = "memoryassist-db";
export const DB_VERSION = 2;

export const STORE_PROFILES = "profiles";
export const STORE_ASSETS = "assets";
export const STORE_META = "meta";

// --- v2: cognitive platform stores ---
export const STORE_SESSIONS = "sessions";
export const STORE_ABILITY = "ability-states";
export const STORE_REMINDERS = "reminders";
export const STORE_REMINDER_LOG = "reminder-log";
export const STORE_OUTBOX = "outbox";

/** Friendly error for the "disk full" family of failures. */
export class StorageQuotaError extends Error {
  constructor() {
    super("This device is out of local storage space.");
    this.name = "StorageQuotaError";
  }
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB is not available in this browser"));
  }
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.open(DB_NAME, DB_VERSION);
    } catch (error) {
      dbPromise = null;
      reject(error instanceof Error ? error : new Error("Could not open local database"));
      return;
    }
    request.onupgradeneeded = (event) => {
      const versionEvent = event as IDBVersionChangeEvent;
      upgradeDatabase(request.result, request.transaction, versionEvent.oldVersion);
    };
    request.onsuccess = () => {
      const db = request.result;
      // Release our handle when another tab needs to upgrade the schema,
      // otherwise future upgrades block forever in multi-tab use.
      db.onversionchange = () => db.close();
      // If this open already lost a race (promise rejected via onblocked/
      // onerror), nobody owns the handle — close it instead of leaking.
      void dbPromise?.then(undefined, () => db.close());
      resolve(db);
    };
    request.onerror = () => {
      dbPromise = null;
      reject(request.error ?? new Error("Could not open local database"));
    };
    request.onblocked = () => {
      dbPromise = null;
      reject(new Error("Local database is blocked by another tab"));
    };
  });
  return dbPromise;
}

/**
 * Versioned migrations. Each case falls through so a user jumping several
 * versions at once still gets every upgrade applied in order.
 */
function upgradeDatabase(db: IDBDatabase, _tx: IDBTransaction | null, oldVersion: number): void {
  if (oldVersion < 1) {
    const profiles = db.createObjectStore(STORE_PROFILES, { keyPath: "id" });
    profiles.createIndex("updatedAt", "updatedAt");
    const assets = db.createObjectStore(STORE_ASSETS, { keyPath: "id" });
    assets.createIndex("personId", "personId");
    db.createObjectStore(STORE_META, { keyPath: "key" });
  }
  if (oldVersion < 2) {
    // Cognitive platform: game sessions, ability estimates, reminders,
    // reminder history and the offline sync outbox. All local-only.
    const sessions = db.createObjectStore(STORE_SESSIONS, { keyPath: "id" });
    sessions.createIndex("startedAt", "startedAt");
    sessions.createIndex("game", "game");
    db.createObjectStore(STORE_ABILITY, { keyPath: "domain" });

    const reminders = db.createObjectStore(STORE_REMINDERS, { keyPath: "id" });
    reminders.createIndex("time", "time");

    const reminderLog = db.createObjectStore(STORE_REMINDER_LOG, { keyPath: "id" });
    reminderLog.createIndex("dueAt", "dueAt");
    reminderLog.createIndex("reminderId", "reminderId");

    const outbox = db.createObjectStore(STORE_OUTBOX, { keyPath: "id" });
    outbox.createIndex("queuedAt", "queuedAt");
  }
}

function mapStorageError(error: unknown): unknown {
  if (error instanceof DOMException || (error && typeof error === "object")) {
    const name = (error as { name?: string }).name;
    if (name === "QuotaExceededError") return new StorageQuotaError();
  }
  return error;
}

async function withStore<T>(
  name: string,
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T> | void,
): Promise<T | undefined> {
  const db = await openDatabase();
  return new Promise<T | undefined>((resolve, reject) => {
    let tx: IDBTransaction;
    try {
      tx = db.transaction(name, mode);
    } catch (error) {
      reject(mapStorageError(error));
      return;
    }
    tx.oncomplete = () => resolve(result);
    tx.onabort = () => reject(mapStorageError(tx.error ?? new Error("Transaction aborted")));
    tx.onerror = () => reject(mapStorageError(tx.error ?? new Error("Transaction error")));
    const store = tx.objectStore(name);
    let result: T | undefined;
    try {
      const request = fn(store);
      if (request instanceof IDBRequest) {
        request.onsuccess = () => {
          result = request.result as T;
        };
        // A failed read should abort with a meaningful error.
        request.onerror = () => {
          try {
            tx.abort();
          } catch {}
        };
      }
    } catch (error) {
      reject(mapStorageError(error));
    }
  });
}

export async function dbPut<T>(store: string, value: T): Promise<void> {
  await withStore(store, "readwrite", (s) => s.put(value as unknown as never));
}

export async function dbGet<T>(store: string, key: string): Promise<T | undefined> {
  return withStore<T>(store, "readonly", (s) => s.get(key) as IDBRequest<T>) as Promise<
    T | undefined
  >;
}

export async function dbDelete(store: string, key: string): Promise<void> {
  await withStore(store, "readwrite", (s) => {
    s.delete(key);
  });
}

export async function dbGetAll<T>(store: string): Promise<T[]> {
  return (await withStore<T[]>(store, "readonly", (s) => s.getAll() as IDBRequest<T[]>)) ?? [];
}

export async function dbClear(store: string): Promise<void> {
  await withStore(store, "readwrite", (s) => {
    s.clear();
  });
}

export async function dbCount(store: string): Promise<number> {
  return (await withStore<number>(store, "readonly", (s) => s.count())) ?? 0;
}

/**
 * Writes several records across stores in ONE transaction — either all
 * succeed or none do. Used to keep a profile and its photos consistent.
 */
export async function dbTransactionalWrite(
  operations: { store: string; type: "put" | "delete"; value?: unknown; key?: string }[],
): Promise<void> {
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    let tx: IDBTransaction;
    try {
      tx = db.transaction(
        [...new Set(operations.map((op) => op.store))],
        "readwrite",
      );
    } catch (error) {
      reject(mapStorageError(error));
      return;
    }
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(mapStorageError(tx.error ?? new Error("Transaction aborted")));
    tx.onerror = () => reject(mapStorageError(tx.error ?? new Error("Transaction error")));
    try {
      for (const op of operations) {
        const store = tx.objectStore(op.store);
        if (op.type === "put") store.put(op.value as never);
        else if (op.key !== undefined) store.delete(op.key);
      }
    } catch (error) {
      reject(mapStorageError(error));
    }
  });
}

/**
 * Deletes every asset belonging to a person in one transaction.
 * With `alsoDeleteProfile`, the profile row goes in the SAME transaction
 * so a person and their photos can never end up half-deleted.
 */
export async function deleteAssetsForPerson(
  personId: string,
  alsoDeleteProfile = false,
): Promise<void> {
  const db = await openDatabase();
  const stores = alsoDeleteProfile ? [STORE_ASSETS, STORE_PROFILES] : [STORE_ASSETS];
  await new Promise<void>((resolve, reject) => {
    let tx: IDBTransaction;
    try {
      tx = db.transaction(stores, "readwrite");
    } catch (error) {
      reject(mapStorageError(error));
      return;
    }
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(mapStorageError(tx.error ?? new Error("Transaction aborted")));
    tx.onerror = () => reject(mapStorageError(tx.error ?? new Error("Transaction error")));
    try {
      if (alsoDeleteProfile) {
        tx.objectStore(STORE_PROFILES).delete(personId);
      }
      const index = tx.objectStore(STORE_ASSETS).index("personId");
      const cursorRequest = index.openCursor(IDBKeyRange.only(personId));
      cursorRequest.onsuccess = () => {
        const cursor = cursorRequest.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        }
      };
      cursorRequest.onerror = () => {
        try {
          tx.abort();
        } catch {}
      };
    } catch (error) {
      reject(mapStorageError(error));
    }
  });
}

/**
 * Reads every record whose value for `indexName` falls inside `range`.
 * Lets hot paths query (e.g. reminder events by `reminderId`) instead of
 * scanning and filtering the whole store in JS.
 */
export async function dbGetAllByIndex<T>(
  store: string,
  indexName: string,
  range: IDBValidKey | IDBKeyRange,
): Promise<T[]> {
  return (
    (await withStore<T[]>(
      store,
      "readonly",
      (s) => s.index(indexName).getAll(range) as IDBRequest<T[]>,
    )) ?? []
  );
}

/**
 * Atomic "insert only if the key is new" — `add()` fails inside the same
 * transaction that would have written it, so two tabs racing to log the
 * same reminder event can never both win. Returns whether THIS call won.
 */
export async function dbPutIfAbsent<T>(store: string, value: T): Promise<boolean> {
  if (typeof indexedDB === "undefined") return false;
  const db = await openDatabase();
  return new Promise<boolean>((resolve, reject) => {
    let tx: IDBTransaction;
    try {
      tx = db.transaction(store, "readwrite");
    } catch (error) {
      reject(mapStorageError(error));
      return;
    }
    let added = false;
    tx.oncomplete = () => resolve(added);
    tx.onabort = () => reject(mapStorageError(tx.error ?? new Error("Transaction aborted")));
    tx.onerror = () => reject(mapStorageError(tx.error ?? new Error("Transaction error")));
    try {
      const request = tx.objectStore(store).add(value as never);
      request.onsuccess = () => {
        added = true;
      };
      // Key already exists → expected outcome, not an error. Swallow it so
      // the transaction still completes cleanly with added === false.
      request.onerror = (e) => {
        e.preventDefault();
        e.stopPropagation();
      };
    } catch (error) {
      reject(mapStorageError(error));
    }
  });
}
