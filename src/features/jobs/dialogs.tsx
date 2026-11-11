import { useState } from "react";
import { RefreshCw, Trash2 } from "lucide-react";
import { useModalFocus } from "../../hooks/useModalFocus";
import { BOARD_KINDS, TOKEN_RE, parseBoardInput } from "./connectors";
import { emptyPrefs, toArrangement, toEmployment, type JobPosting, type MatchPrefs, type WorkArrangement } from "./schema";
import { addPosting, connectBoard, refreshBoard, removeBoard } from "./store";
import { extractSalary } from "./text";
import type { JobWorkspace } from "./useJobWorkspace";

function Dialog({ title, onClose, children, testId }: { title: string; onClose: () => void; children: React.ReactNode; testId: string }) {
  const ref = useModalFocus(true, onClose);
  return (
    <div className="career-overlay career-form-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={ref} className="career-form-dialog jb-dialog" role="dialog" aria-modal="true" aria-label={title} data-testid={testId}>
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  );
}

const ARR_LABEL: Record<string, string> = { remote: "Remote", hybrid: "Hybrid", onsite: "On-site", unspecified: "Not specified" };
const TYPE_LABEL: Record<string, string> = { "full-time": "Full-time", "part-time": "Part-time", contract: "Contract", internship: "Internship", temporary: "Not specified", unspecified: "Not specified" };

export function AddJobDialog({ ws, onClose, onAdded, editing }: { ws: JobWorkspace; onClose: () => void; onAdded: (id: string) => void; editing?: JobPosting }) {
  const [d, setD] = useState({ title: editing?.title ?? "", company: editing?.company ?? "", location: editing?.location ?? "", arrangement: editing ? ARR_LABEL[editing.workArrangement] : "Not specified", type: editing ? TYPE_LABEL[editing.employmentType] : "Not specified", url: editing?.url ?? "", description: editing?.description ?? "", skills: editing?.skills.join(", ") ?? "" });
  const [error, setError] = useState("");
  const submit = () => {
    if (!d.title.trim() || !d.company.trim()) return setError("Add a job title and company.");
    if (d.url && !/^https?:\/\//i.test(d.url)) return setError("Use a complete http or https link.");
    const now = new Date().toISOString();
    const post: JobPosting = {
      ...(editing ?? {}),
      id: editing?.id ?? crypto.randomUUID(), source: "manual", boardId: null, externalId: null, title: d.title.trim(), company: d.company.trim(),
      location: d.location.trim(), workArrangement: toArrangement(d.arrangement), employmentType: toEmployment(d.type), category: "",
      salary: extractSalary(d.description), postedAt: null, verifiedSource: false, url: d.url.trim(), applyUrl: d.url.trim(),
      description: d.description.trim(), about: editing?.about ?? "", responsibilities: editing?.responsibilities ?? [], requirements: editing?.requirements ?? [], benefits: editing?.benefits ?? [], skills: d.skills.split(",").map((x) => x.trim()).filter(Boolean), addedAt: editing?.addedAt ?? now,
    };
    ws.update((s) => addPosting(s, post, !editing));
    onAdded(post.id);
    onClose();
  };
  return (
    <Dialog title={editing ? "Edit saved job" : "Save a job posting"} onClose={onClose} testId="dialog-add-job">
      <form className="jb-form" onSubmit={(e) => { e.preventDefault(); submit(); }}>
        {error && <p className="career-form-error" role="alert">{error}</p>}
        <label>Job title<input autoFocus value={d.title} onChange={(e) => setD({ ...d, title: e.target.value })} data-testid="add-title" /></label>
        <label>Company<input value={d.company} onChange={(e) => setD({ ...d, company: e.target.value })} data-testid="add-company" /></label>
        <label>Location<input value={d.location} onChange={(e) => setD({ ...d, location: e.target.value })} /></label>
        <div className="jb-two">
          <label>Work arrangement<select value={d.arrangement} onChange={(e) => setD({ ...d, arrangement: e.target.value })}><option>Not specified</option><option>Remote</option><option>Hybrid</option><option>On-site</option></select></label>
          <label>Employment type<select value={d.type} onChange={(e) => setD({ ...d, type: e.target.value })}><option>Not specified</option><option>Full-time</option><option>Part-time</option><option>Contract</option><option>Internship</option></select></label>
        </div>
        <label>Posting link<input value={d.url} onChange={(e) => setD({ ...d, url: e.target.value })} placeholder="https://" /></label>
        <label>Relevant skills, comma separated<input value={d.skills} onChange={(e) => setD({ ...d, skills: e.target.value })} /></label>
        <label>Posting text<textarea rows={7} value={d.description} onChange={(e) => setD({ ...d, description: e.target.value })} placeholder="Paste the job description. It is used only on this device." data-testid="add-description" /></label>
        <div className="jb-actions"><button className="jb-btn jb-btn-primary" type="submit" data-testid="add-submit">{editing ? "Save changes" : "Save posting"}</button><button className="jb-btn" type="button" onClick={onClose}>Cancel</button></div>
      </form>
    </Dialog>
  );
}

export function BoardsDialog({ ws, onClose }: { ws: JobWorkspace; onClose: () => void }) {
  const [kind, setKind] = useState<(typeof BOARD_KINDS)[number]["kind"]>("greenhouse");
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  const connect = async () => {
    setError("");
    const parsed = parseBoardInput(value);
    const k = parsed?.kind ?? kind;
    const token = (parsed?.token ?? value.trim()).replace(/^\/+|\/+$/g, "");
    if (!TOKEN_RE.test(token)) return setError("Enter the employer's job-board URL or its token (letters, numbers, - and _).");
    setBusy("connect");
    try {
      const next = await connectBoard(ws.state, k, token);
      ws.update(() => next);
      setValue("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not connect to that board.");
    } finally {
      setBusy(null);
    }
  };
  const refresh = async (id: string) => {
    setBusy(id);
    const next = await refreshBoard(ws.state, id);
    ws.update(() => next);
    setBusy(null);
  };
  return (
    <Dialog title="Employer job boards" onClose={onClose} testId="dialog-boards">
      <p className="jb-muted">CareerOS reads employers’ own public job boards (Greenhouse, Lever, Ashby) straight from your browser. No account, no scraping, no backend. Only boards you add are fetched.</p>
      <form className="jb-form" onSubmit={(e) => { e.preventDefault(); void connect(); }}>
        <div className="jb-two">
          <label>Board type<select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)} data-testid="board-kind">{BOARD_KINDS.map((b) => <option key={b.kind} value={b.kind}>{b.label}</option>)}</select></label>
          <label>Board URL or token<input value={value} onChange={(e) => setValue(e.target.value)} placeholder={BOARD_KINDS.find((b) => b.kind === kind)?.hint} data-testid="board-token" /></label>
        </div>
        {error && <p className="career-form-error" role="alert" data-testid="board-error">{error}</p>}
        <div className="jb-actions"><button className="jb-btn jb-btn-primary" type="submit" disabled={busy === "connect" || !value.trim()} data-testid="board-connect">{busy === "connect" ? "Connecting…" : "Connect board"}</button></div>
      </form>
      <h3>Connected boards</h3>
      {ws.state.boards.length === 0 ? <p className="jb-muted">None yet.</p> : (
        <ul className="jb-boards" data-testid="board-list">
          {ws.state.boards.map((b) => (
            <li key={b.id}>
              <span><strong>{b.companyName}</strong> <small>{b.kind} · {b.count} listings{b.lastFetchedAt ? ` · updated ${new Date(b.lastFetchedAt).toLocaleString()}` : ""}</small>{b.lastError && <small className="jb-error" role="alert">{b.lastError}</small>}</span>
              <button type="button" className="jb-icon" aria-label={`Refresh ${b.companyName}`} onClick={() => void refresh(b.id)} disabled={busy === b.id}><RefreshCw size={15} className={busy === b.id ? "jb-spin" : ""} /></button>
              <button type="button" className="jb-icon" aria-label={`Remove ${b.companyName}`} onClick={() => { if (window.confirm(`Remove ${b.companyName}? Jobs you saved or tracked are kept.`)) ws.update((s) => removeBoard(s, b.id)); }}><Trash2 size={15} /></button>
            </li>
          ))}
        </ul>
      )}
      <div className="jb-actions"><button className="jb-btn" type="button" onClick={onClose}>Done</button></div>
    </Dialog>
  );
}

export function PrefsDialog({ ws, onClose }: { ws: JobWorkspace; onClose: () => void }) {
  const [p, setP] = useState<MatchPrefs>({ ...emptyPrefs(), ...ws.state.prefs });
  const toggle = (a: WorkArrangement) => setP({ ...p, arrangements: p.arrangements.includes(a) ? p.arrangements.filter((x) => x !== a) : [...p.arrangements, a] });
  return (
    <Dialog title="Match preferences" onClose={onClose} testId="dialog-prefs">
      <form className="jb-form" onSubmit={(e) => { e.preventDefault(); ws.update((s) => ({ ...s, prefs: p })); onClose(); }}>
        <fieldset><legend>Work arrangement</legend>
          {(["remote", "hybrid", "onsite"] as WorkArrangement[]).map((a) => <label key={a} className="jb-check"><input type="checkbox" checked={p.arrangements.includes(a)} onChange={() => toggle(a)} /> {a === "onsite" ? "On-site" : a[0].toUpperCase() + a.slice(1)}</label>)}
        </fieldset>
        <label>Experience level<select value={p.experience} onChange={(e) => setP({ ...p, experience: e.target.value as MatchPrefs["experience"] })}><option value="any">Any</option><option value="entry">Entry level</option><option value="mid">Mid level</option><option value="senior">Senior</option></select></label>
        <label>Preferred locations (comma separated)<input value={p.locations} onChange={(e) => setP({ ...p, locations: e.target.value })} data-testid="pref-locations" /></label>
        <label>Minimum salary (USD / year, only applied when a posting lists pay)<input type="number" min={0} step={1000} value={p.minSalary ?? ""} onChange={(e) => setP({ ...p, minSalary: e.target.value ? Number(e.target.value) : null })} /></label>
        <label>Words you want to see<input value={p.include} onChange={(e) => setP({ ...p, include: e.target.value })} placeholder="linux, support" data-testid="pref-include" /></label>
        <label>Words to hide<input value={p.exclude} onChange={(e) => setP({ ...p, exclude: e.target.value })} placeholder="sales, commission" data-testid="pref-exclude" /></label>
        <div className="jb-actions"><button className="jb-btn jb-btn-primary" type="submit" data-testid="pref-save">Save preferences</button><button className="jb-btn" type="button" onClick={onClose}>Cancel</button></div>
      </form>
    </Dialog>
  );
}
