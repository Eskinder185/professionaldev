/** Portable, versioned backup of CareerOS browser data. No credential values are exported. */
export const BACKUP_FORMAT = "careeros-backup-v3";
export const STORAGE_SCHEMA_VERSION = 3;

const DATABASES = [
  { name: "pd:speech", store: "blobs", version: 1 },
  { name: "pd-careeros-interviews", store: "recordings", version: 1 },
  { name: "pd-careeros", store: "records", version: 1 },
] as const;

export const isCareerKey = (key: string) =>
  key.startsWith("pd:") || key.startsWith("pd_") || key.startsWith("appTracker:") ||
  key.startsWith("starBuilder:") || key.startsWith("interviewSim:") || key === "pd-theme" || key === "pd-theme-pref";

export type StoredRow = { key: IDBValidKey; value: unknown };
export type BackupPayload = {
  format: typeof BACKUP_FORMAT;
  schemaVersion: number;
  createdAt: string;
  entries: Record<string, string>;
  media: Record<string, StoredRow[]>;
};
export type VerifiedBackup = BackupPayload & { sha256: string };

function requestValue<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed."));
  });
}

async function withStore<T>(name: string, storeName: string, version: number, mode: IDBTransactionMode, fn: (store: IDBObjectStore) => Promise<T> | T): Promise<T> {
  if (typeof indexedDB === "undefined") throw new Error("IndexedDB is unavailable.");
  const opening = indexedDB.open(name, version);
  opening.onupgradeneeded = () => {
    const db = opening.result;
    if (!db.objectStoreNames.contains(storeName)) {
      const store = db.createObjectStore(storeName, name === "pd-careeros-interviews" ? { keyPath: "id" } : undefined);
      if (name === "pd-careeros-interviews") store.createIndex("sessionId", "sessionId");
    }
  };
  const db = await requestValue(opening);
  try {
    if (!db.objectStoreNames.contains(storeName)) throw new Error(`${name} is missing ${storeName}.`);
    const tx = db.transaction(storeName, mode);
    const done = new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("IndexedDB transaction failed."));
      tx.onabort = () => reject(tx.error ?? new Error("IndexedDB transaction aborted."));
    });
    const result = await fn(tx.objectStore(storeName));
    await done;
    return result;
  } finally {
    db.close();
  }
}

async function readRows(name: string, store: string, version: number): Promise<StoredRow[]> {
  return withStore(name, store, version, "readonly", async (objectStore) => {
    const [keys, values] = await Promise.all([requestValue(objectStore.getAllKeys()), requestValue(objectStore.getAll())]);
    return keys.map((key, i) => ({ key, value: values[i] }));
  });
}

async function writeRows(name: string, store: string, version: number, rows: StoredRow[], replace: boolean): Promise<void> {
  await withStore(name, store, version, "readwrite", (objectStore) => {
    if (replace) objectStore.clear();
    for (const row of rows) {
      if (objectStore.keyPath === null) objectStore.put(row.value, row.key);
      else objectStore.put(row.value);
    }
  });
}

function bytesToBase64(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i += 0x8000) out += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(out);
}
function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

async function encodeValue(value: unknown): Promise<unknown> {
  if (value instanceof Blob) return { __careerBlob: true, type: value.type, base64: bytesToBase64(new Uint8Array(await value.arrayBuffer())) };
  if (Array.isArray(value)) return Promise.all(value.map(encodeValue));
  if (value && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) result[key] = await encodeValue(item);
    return result;
  }
  return value;
}
function decodeValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(decodeValue);
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (record.__careerBlob === true && typeof record.base64 === "string" && typeof record.type === "string") {
      return new Blob([base64ToBytes(record.base64) as BlobPart], { type: record.type });
    }
    return Object.fromEntries(Object.entries(record).map(([key, item]) => [key, decodeValue(item)]));
  }
  return value;
}

async function digest(payload: BackupPayload): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function createBackup(): Promise<VerifiedBackup> {
  const entries: Record<string, string> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && isCareerKey(key)) {
      const value = localStorage.getItem(key);
      if (value !== null) entries[key] = value;
    }
  }
  const media: Record<string, StoredRow[]> = {};
  for (const { name, store, version } of DATABASES) {
    media[name] = await Promise.all((await readRows(name, store, version)).map(async (row) => ({ key: row.key, value: await encodeValue(row.value) })));
  }
  const payload: BackupPayload = { format: BACKUP_FORMAT, schemaVersion: STORAGE_SCHEMA_VERSION, createdAt: new Date().toISOString(), entries, media };
  return { ...payload, sha256: await digest(payload) };
}

export async function verifyBackup(input: unknown): Promise<VerifiedBackup> {
  if (!input || typeof input !== "object") throw new Error("Backup is not an object.");
  const data = input as Record<string, unknown>;
  if (data.format !== BACKUP_FORMAT || data.schemaVersion !== STORAGE_SCHEMA_VERSION) throw new Error("Unsupported backup format or schema version.");
  if (typeof data.createdAt !== "string" || !Number.isFinite(Date.parse(data.createdAt))) throw new Error("Invalid backup date.");
  if (!data.entries || typeof data.entries !== "object" || Array.isArray(data.entries) || !data.media || typeof data.media !== "object" || Array.isArray(data.media)) throw new Error("Backup contents are invalid.");
  const entries = data.entries as Record<string, unknown>;
  if (Object.entries(entries).some(([key, value]) => !isCareerKey(key) || typeof value !== "string")) throw new Error("Backup contains invalid browser records.");
  const media = data.media as Record<string, unknown>;
  if (Object.keys(media).some((name) => !DATABASES.some((db) => db.name === name))) throw new Error("Backup contains an unknown media store.");
  for (const db of DATABASES) {
    const rows = media[db.name];
    if (!Array.isArray(rows) || rows.some((row) => !row || typeof row !== "object" || !("key" in row) || !("value" in row))) throw new Error(`Invalid ${db.name} records.`);
    const keys = rows.map((row) => JSON.stringify(row.key));
    if (new Set(keys).size !== keys.length) throw new Error(`Duplicate records in ${db.name}.`);
    for (const row of rows) decodeValue(row.value);
  }
  const payload: BackupPayload = { format: BACKUP_FORMAT, schemaVersion: STORAGE_SCHEMA_VERSION, createdAt: data.createdAt, entries: entries as Record<string, string>, media: media as Record<string, StoredRow[]> };
  if (typeof data.sha256 !== "string" || data.sha256 !== await digest(payload)) throw new Error("Backup checksum does not match. The file may be incomplete or changed.");
  return { ...payload, sha256: data.sha256 };
}

/** Reads current backups and the Settings export formats used before version 3. */
export async function parseBackup(input: unknown): Promise<{ backup: VerifiedBackup; warning?: string }> {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Backup is not an object.");
  const data = input as Record<string, unknown>;
  if (data.format === BACKUP_FORMAT) return { backup: await verifyBackup(input) };
  if (data.format && data.format !== "professionaldev-local-storage-v2") throw new Error("Unsupported backup format.");
  const raw = data.format ? data.entries : data;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("Legacy backup has no entries.");
  const entries: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!isCareerKey(key)) continue;
    if (data.format && typeof value !== "string") throw new Error("Legacy backup contains an invalid entry.");
    entries[key] = data.format ? value as string : JSON.stringify(value);
  }
  if (Object.keys(entries).length === 0) throw new Error("No CareerOS data was found in this backup.");
  const media = Object.fromEntries(DATABASES.map(({ name }) => [name, []])) as Record<string, StoredRow[]>;
  const payload: BackupPayload = { format: BACKUP_FORMAT, schemaVersion: STORAGE_SCHEMA_VERSION, createdAt: new Date().toISOString(), entries, media };
  return { backup: { ...payload, sha256: await digest(payload) }, warning: "Legacy backup imported. Its original file has no checksum or recording files; only browser records can be restored." };
}

export function previewRestore(backup: VerifiedBackup): { entries: number; media: number; replacing: number } {
  const keys = Object.keys(backup.entries);
  return { entries: keys.length, media: (backup.media["pd:speech"]?.length ?? 0) + (backup.media["pd-careeros-interviews"]?.length ?? 0), replacing: keys.filter((key) => localStorage.getItem(key) !== null).length };
}

/**
 * Restore safety net. Before any record is overwritten, the complete prior state is written to a
 * separate IndexedDB database (kept out of DATABASES, so it is never exported or itself restored).
 * If the tab closes, crashes or loses power mid-restore, the journal is still there and
 * recoverInterruptedRestore() puts the prior records back on the next start.
 */
const JOURNAL = { name: "pd-careeros-recovery", store: "journal", version: 1, key: "restore" } as const;
const RESTORE_LOCK = "careeros-restore";

async function writeJournal(before: VerifiedBackup): Promise<void> {
  await withStore(JOURNAL.name, JOURNAL.store, JOURNAL.version, "readwrite", (store) => {
    store.put(JSON.stringify(before), JOURNAL.key);
  });
}

async function readJournal(): Promise<unknown | null> {
  const raw = await withStore(JOURNAL.name, JOURNAL.store, JOURNAL.version, "readonly", (store) => requestValue(store.get(JOURNAL.key)));
  return typeof raw === "string" ? JSON.parse(raw) : null;
}

async function clearJournal(): Promise<void> {
  await withStore(JOURNAL.name, JOURNAL.store, JOURNAL.version, "readwrite", (store) => {
    store.delete(JOURNAL.key);
  });
}

/** Puts every CareerOS record back exactly as it is in `state`, removing records that were added since. */
async function rollbackTo(state: VerifiedBackup): Promise<void> {
  for (const db of DATABASES) await writeRows(db.name, db.store, db.version, (state.media[db.name] ?? []).map((row) => ({ key: row.key, value: decodeValue(row.value) })), true);
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const key = localStorage.key(i);
    if (key && isCareerKey(key) && !(key in state.entries)) localStorage.removeItem(key);
  }
  for (const [key, value] of Object.entries(state.entries)) localStorage.setItem(key, value);
}

async function withRestoreLock<T>(fn: () => Promise<T>): Promise<T> {
  const locks = typeof navigator !== "undefined" ? navigator.locks : undefined;
  return locks ? locks.request(RESTORE_LOCK, fn) : fn();
}

export async function restoreBackup(backup: VerifiedBackup): Promise<void> {
  await verifyBackup(backup);
  return withRestoreLock(async () => {
    const before = await createBackup();
    try {
      await writeJournal(before);
    } catch (error) {
      // The message already carries the original reason; the tsconfig target (ES2020) has no Error `cause` option.
      // eslint-disable-next-line preserve-caught-error
      throw new Error(`Could not create a recovery point, so nothing was changed. ${error instanceof Error ? error.message : ""}`.trim());
    }
    try {
      for (const db of DATABASES) await writeRows(db.name, db.store, db.version, backup.media[db.name].map((row) => ({ key: row.key, value: decodeValue(row.value) })), false);
      for (const [key, value] of Object.entries(backup.entries)) localStorage.setItem(key, value);
    } catch (error) {
      await rollbackTo(before);
      await clearJournal();
      throw error;
    }
    await clearJournal();
  });
}

/**
 * Call once at start-up. A journal that still exists while no restore is running means a restore was
 * interrupted, so the records from before it are put back. Never touches data when a restore is live
 * in another tab, and never runs if the journal fails its checksum.
 */
export async function recoverInterruptedRestore(): Promise<{ recovered: boolean; reason?: string }> {
  if (typeof indexedDB === "undefined") return { recovered: false, reason: "IndexedDB is unavailable." };
  const run = async (): Promise<{ recovered: boolean; reason?: string }> => {
    const journal = await readJournal();
    if (!journal) return { recovered: false };
    const state = await verifyBackup(journal);
    await rollbackTo(state);
    await clearJournal();
    try {
      sessionStorage.setItem("pd:restore:recovered", new Date().toISOString());
    } catch {
      /* the recovery itself already succeeded */
    }
    return { recovered: true };
  };
  const locks = typeof navigator !== "undefined" ? navigator.locks : undefined;
  if (!locks) return run();
  return locks.request(RESTORE_LOCK, { ifAvailable: true }, async (lock) => (lock ? run() : { recovered: false, reason: "A restore is running in another tab." }));
}

export async function clearCareerData(): Promise<void> {
  const before = await createBackup();
  try {
    for (const db of DATABASES) await writeRows(db.name, db.store, db.version, [], true);
    for (const key of Object.keys(before.entries)) localStorage.removeItem(key);
  } catch (error) {
    await restoreBackup(before);
    throw error;
  }
}

/** Copy and verify legacy browser records without changing their source of truth. */
export async function mirrorLegacyRecords(): Promise<number> {
  const entries: Array<[string, string]> = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && isCareerKey(key)) {
      const raw = localStorage.getItem(key);
      if (raw !== null) entries.push([key, raw]);
    }
  }
  await withStore("pd-careeros", "records", 1, "readwrite", (store) => {
    for (const [key, raw] of entries) store.put(raw, key);
  });
  const rows = await readRows("pd-careeros", "records", 1);
  const copied = new Map(rows.map((row) => [row.key, row.value]));
  if (entries.some(([key, raw]) => copied.get(key) !== raw)) throw new Error("IndexedDB copy did not verify; original browser records remain untouched.");
  return entries.length;
}
