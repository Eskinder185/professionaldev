/**
 * Recordings are kept only when the user turns on "Save recordings", and only
 * in this browser's IndexedDB. Each record has an expiry; expired recordings
 * are deleted when Interview Studio opens.
 */

const DB = "pd-careeros-interviews";
const STORE = "recordings";

type RecordingRow = { id: string; sessionId: string; blob: Blob; type: string; createdAt: number; expiresAt: number };

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") return reject(new Error("Local storage for recordings is unavailable in this browser."));
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () => {
      const store = request.result.createObjectStore(STORE, { keyPath: "id" });
      store.createIndex("sessionId", "sessionId");
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open recording storage."));
  });
}

async function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, mode);
    const request = run(transaction.objectStore(STORE));
    transaction.oncomplete = () => {
      db.close();
      resolve(request ? request.result : undefined);
    };
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function saveRecording(id: string, sessionId: string, blob: Blob, retentionDays: number) {
  const now = Date.now();
  await tx("readwrite", (store) => store.put({ id, sessionId, blob, type: blob.type, createdAt: now, expiresAt: now + retentionDays * 86_400_000 } satisfies RecordingRow));
}

export async function loadRecording(id: string): Promise<Blob | null> {
  const row = (await tx<RecordingRow>("readonly", (store) => store.get(id))) as RecordingRow | undefined;
  return row && row.expiresAt > Date.now() ? row.blob : null;
}

export const deleteRecording = (id: string) => tx("readwrite", (store) => store.delete(id));

export async function deleteSessionRecordings(sessionId: string) {
  await tx("readwrite", (store) => {
    const cursor = store.index("sessionId").openCursor(IDBKeyRange.only(sessionId));
    cursor.onsuccess = () => {
      const current = cursor.result;
      if (current) {
        current.delete();
        current.continue();
      }
    };
  });
}

export async function purgeExpired(): Promise<number> {
  let removed = 0;
  await tx("readwrite", (store) => {
    const cursor = store.openCursor();
    cursor.onsuccess = () => {
      const current = cursor.result;
      if (!current) return;
      if ((current.value as RecordingRow).expiresAt <= Date.now()) {
        current.delete();
        removed++;
      }
      current.continue();
    };
  });
  return removed;
}
