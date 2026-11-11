import { useEffect, useState } from "react";
import { useLocal } from "../hooks/useLocal";
import PageHeader from "../components/ui/PageHeader";
import AppearanceControl from "../components/AppearanceControl";
import { AIConnectionsSection } from "../features/ai/AIConnectionsSection";
import { clearCareerData, createBackup, parseBackup, previewRestore, restoreBackup, verifyBackup, type VerifiedBackup } from "../features/storage/backup";
import "../features/resume/resume-studio.css";

type FolderPickerWindow = Window & { showDirectoryPicker?: (options?: { mode: "readwrite" }) => Promise<FileSystemDirectoryHandle> };
const block = "border-t border-black/[0.07] py-10 dark:border-white/[0.09] sm:py-12";
const folders = ["Profiles", "Resumes", "Cover-Letters", "Applications", "Interviews", "Transcripts", "Agent-History", "Backups"];

function downloadBackup(data: VerifiedBackup) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `CareerOS-backup-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export default function Settings() {
  const [reduced, setReduced] = useLocal<boolean>("pd:settings:reducedMotion", false);
  const [folder, setFolder] = useState<FileSystemDirectoryHandle | null>(null);
  const [backup, setBackup] = useState<VerifiedBackup | null>(null);
  const [message, setMessage] = useState("");
  const [usage, setUsage] = useState("Checking…");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!navigator.storage?.estimate) { setUsage("Unavailable in this browser"); return; }
    navigator.storage.estimate().then(({ usage: used, quota }) => {
      setUsage(`${((used ?? 0) / 1048576).toFixed(1)} MB used of ${((quota ?? 0) / 1048576).toFixed(0)} MB estimated quota`);
    }).catch(() => setUsage("Unavailable in this browser"));
  }, [message]);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setMessage("");
    try { await action(); } catch (error) { setMessage(error instanceof Error ? error.message : "Storage operation failed."); }
    finally { setBusy(false); }
  }

  async function chooseFolder() {
    const picker = (window as FolderPickerWindow).showDirectoryPicker;
    if (!picker) { setMessage("Folder access is unavailable. Browser storage and downloadable backups still work."); return; }
    try {
      const selected = await picker({ mode: "readwrite" });
      const workspace = await selected.getDirectoryHandle("CareerOS", { create: true });
      for (const name of folders) await workspace.getDirectoryHandle(name, { create: true });
      setFolder(workspace);
      setMessage(`CareerOS workspace created in ${selected.name}. Folder permission lasts for this page session.`);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setMessage(error instanceof Error ? error.message : "Folder access failed.");
    }
  }

  async function exportAll() {
    const data = await createBackup();
    await verifyBackup(data);
    downloadBackup(data);
    if (folder) {
      const backups = await folder.getDirectoryHandle("Backups", { create: true });
      const file = await backups.getFileHandle(`CareerOS-backup-${Date.now()}.json`, { create: true });
      const writer = await file.createWritable();
      try { await writer.write(JSON.stringify(data)); await writer.close(); }
      catch (error) { await writer.abort(); throw error; }
    }
    setMessage("Backup verified and downloaded." + (folder ? " A copy was saved in the selected workspace." : ""));
  }

  async function readBackup(file: File) {
    const parsed: unknown = JSON.parse(await file.text());
    const result = await parseBackup(parsed);
    setBackup(result.backup);
    setMessage(result.warning ?? "Backup verified. Review the restore preview below before applying it.");
  }

  const preview = backup ? previewRestore(backup) : null;
  return (
    <div className="mx-auto max-w-4xl space-y-0 pb-16">
      <PageHeader title="Settings" sub="Control AI connections, motion, privacy, and data management." />
      <section className={block}><AIConnectionsSection /></section>
      <section className={block} aria-labelledby="appearance-heading">
        <h2 id="appearance-heading" className="font-semibold text-ink dark:text-white">Appearance</h2>
        <p className="mb-4 mt-1 text-sm text-ink-muted">Choose how CareerOS looks. Your choice is remembered on this device.</p>
        <AppearanceControl />
      </section>
      <section className={block}>
        <h2 className="font-semibold text-ink dark:text-white">Reduced motion</h2>
        <p className="mt-1 text-sm text-ink-muted">Disable auto-scroll animations in teleprompter.</p>
        <button type="button" className={`btn mt-4 min-h-11 px-5 ${reduced ? "btn-primary" : ""}`} aria-pressed={reduced} onClick={() => setReduced((value) => !value)}>{reduced ? "On" : "Off"}</button>
      </section>
      <section className={block} aria-labelledby="storage-heading">
        <h2 id="storage-heading" className="font-semibold text-ink dark:text-white">Storage &amp; Privacy</h2>
        <p className="mt-2 text-sm text-ink-muted">CareerOS works without a cloud account. Career records currently live in this browser’s storage. Saved interview recordings live in IndexedDB. Clearing site data or using another browser removes access to them unless you have a backup.</p>
        <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
          <div><dt className="font-medium">Browser storage</dt><dd>{typeof indexedDB === "undefined" ? "IndexedDB unavailable" : "IndexedDB available"}</dd></div>
          <div><dt className="font-medium">Usage</dt><dd>{usage}</dd></div>
          <div><dt className="font-medium">Workspace folder</dt><dd>{folder?.name ?? "None selected"}</dd></div>
          <div><dt className="font-medium">Folder access</dt><dd>{(window as FolderPickerWindow).showDirectoryPicker ? "Supported; permission required" : "Unavailable in this browser"}</dd></div>
        </dl>
        <p className="mt-3 text-sm text-ink-muted">The selected folder receives a CareerOS workspace and backup copies when you export. Active records remain in browser storage. Folder access must be granted again after reopening the page.</p>
        <div className="mt-5 flex flex-wrap gap-2">
          <button type="button" className="btn min-h-11 px-4" disabled={busy} onClick={chooseFolder}>Choose local folder</button>
          <button type="button" className="btn min-h-11 px-4" disabled={busy} onClick={() => run(exportAll)}>Export all data</button>
          <label className="btn career-file-upload min-h-11 cursor-pointer px-4">Verify / import backup
            <input type="file" accept="application/json,.json" className="sr-only" disabled={busy} onChange={(event) => { const file = event.target.files?.[0]; if (file) void run(() => readBackup(file)); event.target.value = ""; }} />
          </label>
        </div>
        {preview && <div className="mt-5 rounded-xl border border-black/10 p-4 text-sm dark:border-white/10">
          <h3 className="font-semibold">Restore preview</h3>
          <p className="mt-1">Created {new Date(backup!.createdAt).toLocaleString()}. {preview.entries} browser records, {preview.media} media records; {preview.replacing} browser records have the same keys and will be replaced. Other data remains.</p>
          <button type="button" className="btn mt-3 min-h-11 px-4" disabled={busy} onClick={() => run(async () => { await restoreBackup(backup!); setBackup(null); setMessage("Backup restored. Reloading…"); window.location.reload(); })}>Restore verified backup</button>
        </div>}
        <div className="mt-8 border-t border-black/10 pt-5 dark:border-white/10">
          <h3 className="font-medium">Clear user data</h3>
          <p className="mt-1 text-sm text-ink-muted">Deletes CareerOS browser records and saved recordings on this device. Export a backup first if you may need them.</p>
          <button type="button" className="btn mt-3 min-h-11 px-4" disabled={busy} onClick={() => { if (window.confirm("Delete all CareerOS browser data and saved recordings on this device?")) void run(async () => { await clearCareerData(); window.location.reload(); }); }}>Clear user data</button>
        </div>
        {message && <p role="status" className="mt-4 text-sm">{message}</p>}
      </section>
    </div>
  );
}
