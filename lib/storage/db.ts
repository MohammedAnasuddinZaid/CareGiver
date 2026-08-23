/**
 * Local-first IndexedDB layer.
 *
 * Design notes:
 * - Profiles and photo assets live in IndexedDB because they can be large
 *   (blobs, descriptors); small non-sensitive app settings use localStorage.
 * - Nothing here ever leaves the device. There is no network code in this
 *   entire module.
 * - The schema is versioned so future upgrades migrate instead of deleting.
 */

const DB_NAME = "memoryassist-db";
const DB_VERSION = 1;

export const STORE_PROFILES = "profiles";
export const STORE_ASSETS = "assets";
export const STORE_META = "meta";

let dbPromise: Promise<IDBDatabase> | null = null;

function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB is not available in this browser"));
  }
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_PROFILES)) {
        const store = db.createObjectStore(STORE_PROFILES, { keyPath: "id" });
        store.createIndex("updatedAt", "updatedAt");
      }
      if (!db.objectStoreNames.contains(STORE_ASSETS)) {
        const store = db.createObjectStore(STORE_ASSETS, { keyPath: "id" });
        store.createIndex("personId", "personId");
      }
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META, { keyPath: "key" });
      }
    };
    request.onsuccess = () => resolve(request.result);
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

function promisify<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Database error"));
  });
}

async function withStore<T>(
  name: string,
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T> | void,
): Promise<T | undefined> {
  const db = await openDatabase();
  return new Promise<T | undefined>((resolve, reject) => {
    const tx = db.transaction(name, mode);
    const store = tx.objectStore(name);
    let result: T | undefined;
    let request = fn(store);
    if (request instanceof IDBRequest) {
      // attach handlers lazily via tx completion below
      request.onsuccess = () => {
        result = request.result as T;
      };
    }
    tx.oncomplete = () => resolve(result);
    tx.onabort = () => reject(tx.error ?? new Error("Transaction aborted"));
    tx.onerror = () => reject(tx.error ?? new Error("Transaction error"));
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

/** Deletes every asset belonging to a person in one transaction. */
export async function deleteAssetsForPerson(personId: string): Promise<void> {
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_ASSETS, "readwrite");
    const index = tx.objectStore(STORE_ASSETS).index("personId");
    const cursorRequest = index.openCursor(IDBKeyRange.only(personId));
    cursorRequest.onsuccess = () => {
      const cursor = cursorRequest.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error ?? new Error("Transaction aborted"));
    tx.onerror = () => reject(tx.error ?? new Error("Transaction error"));
  });
}
