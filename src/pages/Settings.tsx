import { getLocal, useLocal } from "../hooks/useLocal";
import PageHeader from "../components/ui/PageHeader";

async function idbOpen() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open("pd:speech", 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("blobs")) db.createObjectStore("blobs");
    };
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
  });
}

async function listVideoKeys() {
  const history = getLocal<unknown[]>("pd:speech:history", []);
  return history.flatMap((item) => {
    if (typeof item !== "object" || item === null || !("blobKey" in item)) return [];
    return typeof item.blobKey === "string" ? [item.blobKey] : [];
  });
}

const projectKey = (key: string) => key.startsWith("pd:") || key.startsWith("pd_") || key.startsWith("appTracker:") || key.startsWith("starBuilder:") || key.startsWith("interviewSim:") || key === "pd-theme";
const projectKeys = () => Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index)).filter((key): key is string => Boolean(key && projectKey(key))).sort();

async function exportData() {
  const entries = Object.fromEntries(projectKeys().map((key) => [key, localStorage.getItem(key)]));
  const data = { format: "professionaldev-local-storage-v2", entries, videoBlobKeys: await listVideoKeys() };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "professionaldev-data.json";
  a.click();
  URL.revokeObjectURL(url);
}

async function importData(file: File, onWarn: (msg: string) => void) {
  const text = await file.text();
  const obj: unknown = JSON.parse(text);
  if (!obj || typeof obj !== "object") throw new Error("This file does not contain a data object.");
  const record = obj as Record<string, unknown>;
  const current = record.format === "professionaldev-local-storage-v2";
  const entries = current ? record.entries : record;
  if (!entries || typeof entries !== "object" || Array.isArray(entries)) throw new Error("This file has no valid data entries.");
  const imported = Object.entries(entries).filter(([key]) => projectKey(key));
  if (!imported.length) throw new Error("No ProfessionalDev data was found in this file.");
  if (current && imported.some(([, value]) => typeof value !== "string")) throw new Error("The backup contains an invalid entry.");
  if (!confirm(`Import ${imported.length} data entries? Existing entries with the same names will be replaced.`)) return;
  imported.forEach(([key, value]) => localStorage.setItem(key, current ? value as string : JSON.stringify(value)));
  const expected: string[] = Array.isArray(record.videoBlobKeys) ? record.videoBlobKeys : Array.isArray(record["pd:videos"]) ? record["pd:videos"] : [];
  if (expected.length) onWarn(`This backup references ${expected.length} video recording(s), but does not contain their video files.`);
  location.reload();
}

async function resetAll() {
  for (const key of projectKeys()) localStorage.removeItem(key);
  const db = await idbOpen();
  await new Promise<void>((res, rej) => {
    const tx = db.transaction("blobs", "readwrite");
    tx.objectStore("blobs").clear();
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
  db.close();
}

const block = "border-t border-black/[0.07] py-10 dark:border-white/[0.09] sm:py-12";

export default function Settings() {
  const [reduced, setReduced] = useLocal<boolean>("pd:settings:reducedMotion", false);
  const toggleReduced = () => setReduced((value) => !value);

  return (
    <div className="mx-auto max-w-4xl space-y-0 pb-16">
      <PageHeader title="Settings" sub="Control motion, privacy, and data management." />

      <section className={block}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold text-ink dark:text-white">Reduced motion</h2>
            <p className="mt-1 text-sm text-ink-muted">Disable auto-scroll animations in teleprompter.</p>
          </div>
          <button
            type="button"
            className={`btn min-h-11 px-5 ${reduced ? "btn-primary" : ""}`}
            aria-pressed={reduced}
            onClick={toggleReduced}
          >
            {reduced ? "On" : "Off"}
          </button>
        </div>
        <p className="mt-6 text-sm text-ink-muted">Privacy: data stays in your browser. Videos are stored in IndexedDB.</p>
      </section>

      <section className={block}>
        <h2 className="font-semibold text-ink dark:text-white">Data management</h2>
        <p className="mt-2 text-sm text-ink-muted">JSON backup includes browser records and application history. Video files stored in IndexedDB are not included.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" className="btn min-h-11 px-4" onClick={exportData}>
            Export my data
          </button>
          <label className="btn career-file-upload min-h-11 cursor-pointer px-4">
            Import my data
            <input
              type="file"
              accept="application/json"
              className="sr-only"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (f) try { await importData(f, (msg) => alert(msg)); } catch (cause) { alert(cause instanceof Error ? cause.message : "Could not import this backup."); }
              }}
            />
          </label>
          <button
            type="button"
            className="btn min-h-11 px-4"
            onClick={async () => {
              if (confirm("Reset all ProfessionalDev data?")) {
                await resetAll();
                location.reload();
              }
            }}
          >
            Reset all
          </button>
        </div>
      </section>
    </div>
  );
}
