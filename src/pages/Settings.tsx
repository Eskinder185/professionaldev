import { listKeys, getLocal, setLocal, removeLocal } from "../hooks/useLocal";
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
  const history = getLocal<any[]>("pd:speech:history", []);
  return history.map((h) => h.blobKey).filter(Boolean);
}

async function exportData() {
  const keys = listKeys("pd:");
  const data: Record<string, unknown> = {};
  for (const k of keys) {
    data[k] = getLocal(k, null);
  }
  data["pd:videos"] = await listVideoKeys();
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
  const obj = JSON.parse(text);
  const keys = Object.keys(obj).filter((k) => k.startsWith("pd:"));
  keys.forEach((k) => setLocal(k, obj[k]));
  const listed = await listVideoKeys();
  const expected: string[] = Array.isArray(obj["pd:videos"]) ? obj["pd:videos"] : [];
  const missing = expected.filter((k) => !listed.includes(k));
  if (missing.length) onWarn(`Warning: ${missing.length} video blobs referenced but not found.`);
}

async function resetAll() {
  for (const k of listKeys("pd:")) removeLocal(k);
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
  const reduced = getLocal<boolean>("pd:settings:reducedMotion", false);
  const toggleReduced = () => setLocal("pd:settings:reducedMotion", !reduced);

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
            onKeyDown={(e) => {
              if (e.key === " " || e.key === "Enter") {
                e.preventDefault();
                toggleReduced();
              }
            }}
          >
            {reduced ? "On" : "Off"}
          </button>
        </div>
        <p className="mt-6 text-sm text-ink-muted">Privacy: data stays in your browser. Videos are stored in IndexedDB.</p>
      </section>

      <section className={block}>
        <h2 className="font-semibold text-ink dark:text-white">Data management</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" className="btn min-h-10 px-4" onClick={exportData}>
            Export my data
          </button>
          <label className="btn min-h-10 cursor-pointer px-4">
            Import my data
            <input
              type="file"
              accept="application/json"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (f) await importData(f, (msg) => alert(msg));
              }}
            />
          </label>
          <button
            type="button"
            className="btn min-h-10 px-4"
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
