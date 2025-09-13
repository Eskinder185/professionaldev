import { listKeys, getLocal, setLocal, removeLocal } from "../hooks/useLocal";

async function idbOpen() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open("pd:speech", 1);
    req.onupgradeneeded = () => { const db = req.result; if (!db.objectStoreNames.contains("blobs")) db.createObjectStore("blobs"); };
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
  });
}

async function listVideoKeys() {
  const history = getLocal<any[]>("pd:speech:history", []);
  return history.map(h => h.blobKey).filter(Boolean);
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
  a.href = url; a.download = "professionaldev-data.json"; a.click();
  URL.revokeObjectURL(url);
}

async function importData(file: File, onWarn: (msg: string) => void) {
  const text = await file.text();
  const obj = JSON.parse(text);
  const keys = Object.keys(obj).filter(k => k.startsWith("pd:"));
  keys.forEach((k) => setLocal(k, obj[k]));
  const listed = await listVideoKeys();
  const expected: string[] = Array.isArray(obj["pd:videos"]) ? obj["pd:videos"] : [];
  const missing = expected.filter((k) => !listed.includes(k));
  if (missing.length) onWarn(`Warning: ${missing.length} video blobs referenced but not found.`);
}

async function resetAll() {
  for (const k of listKeys("pd:")) removeLocal(k);
  // Clear blobs
  const db = await idbOpen();
  await new Promise<void>((res, rej) => {
    const tx = db.transaction("blobs", "readwrite");
    tx.objectStore("blobs").clear();
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
  db.close();
}

export default function Settings() {
  const reduced = getLocal<boolean>("pd:settings:reducedMotion", false);
  const toggleReduced = () => setLocal("pd:settings:reducedMotion", !reduced);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <header className="surface-muted p-6 fade-up">
        <h1 className="brand-heading text-2xl font-semibold">Settings</h1>
        <p>Control motion, privacy, and data management.</p>
      </header>

      <div className="surface p-4 space-y-4 hover-glow" style={{ ["--glow" as any]: "var(--accent-purple)" }}>
        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium">Reduced Motion</div>
            <div className="text-sm">Disable auto-scroll animations in teleprompter.</div>
          </div>
          <button
            type="button"
            className={`btn ${reduced ? 'btn-anim btn-pink' : ''}`}
            aria-pressed={reduced}
            onClick={toggleReduced}
            onKeyDown={(e)=>{ if(e.key===' '||e.key==='Enter'){ e.preventDefault(); toggleReduced(); } }}
          >
            {reduced ? 'On' : 'Off'}
          </button>
        </div>
        <div className="text-sm">Privacy: data stays in your browser. Videos are stored in IndexedDB.</div>
      </div>

      <div className="surface p-4 space-y-3 hover-glow" style={{ ["--glow" as any]: "var(--accent-blue)" }}>
        <div className="font-medium">Data management</div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn" onClick={exportData}>Export My Data</button>
          <label className="btn cursor-pointer">Import My Data
            <input type="file" accept="application/json" className="hidden" onChange={async (e)=>{ const f=e.target.files?.[0]; if (f) await importData(f, (msg)=>alert(msg)); }} />
          </label>
          <button type="button" className="btn" onClick={async ()=>{ if(confirm('Reset all ProfessionalDev data?')) { await resetAll(); location.reload(); }}}>Reset All</button>
        </div>
      </div>
    </div>
  );
}
