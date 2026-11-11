import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { X } from "lucide-react";
import { getLocal, setLocal } from "../../hooks/useLocal";
import { useModalFocus } from "../../hooks/useModalFocus";
import { loadLetters } from "../documents/letters";
import { JobBody } from "../jobs/components";
import { loadJobStore } from "../jobs/store";
import type { ResumeVersion } from "../resume/model/types";
import { STAGES, type Application } from "./model";

interface Contact { id: string; name: string; relationship: string; company: string; note: string }
const CONTACTS_KEY = "pd:careeros:contacts";

export function ApplicationDrawer({ app, versions, onClose, onChange, onMove }: { app: Application; versions: ResumeVersion[]; onClose: () => void; onChange: (c: Partial<Application>) => void; onMove: (status: string) => void }) {
  const ref = useModalFocus(true, onClose);
  const posting = app.jobId ? loadJobStore().postings[app.jobId] : undefined;
  const letters = loadLetters();
  const [notes, setNotes] = useState(app.notes ?? "");
  const [iv, setIv] = useState({ date: "", kind: "Interview", notes: "" });
  const [rem, setRem] = useState({ date: "", text: "" });
  const [contacts, setContacts] = useState<Contact[]>(() => getLocal<Contact[]>(CONTACTS_KEY, []));
  const [ct, setCt] = useState({ name: "", relationship: "" });
  useEffect(() => setNotes(app.notes ?? ""), [app.id, app.notes]);

  const mine = contacts.filter((c) => c.company.trim().toLowerCase() === app.company.trim().toLowerCase());
  const resume = versions.find((v) => v.id === app.resumeVersionId);
  const letter = letters.find((l) => l.id === app.coverLetterId);
  const history = [...(app.history ?? [])].sort((a, b) => b.at.localeCompare(a.at));

  const addContact = () => {
    if (!ct.name.trim()) return;
    const next = [...contacts, { id: crypto.randomUUID(), name: ct.name.trim(), relationship: ct.relationship.trim(), company: app.company, note: "" }];
    setContacts(next);
    setLocal(CONTACTS_KEY, next);
    setCt({ name: "", relationship: "" });
  };

  return (
    <div className="career-overlay tk-drawer-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <aside ref={ref} className="tk-drawer" role="dialog" aria-modal="true" aria-label={`${app.role} at ${app.company}`} data-testid="application-detail">
        <header className="tk-drawer-head">
          <div><h2>{app.role}</h2><p className="jb-muted">{app.company}{app.location ? ` · ${app.location}` : ""}</p></div>
          <button type="button" className="jb-icon" aria-label="Close details" onClick={onClose}><X size={18} /></button>
        </header>

        <section className="jb-panel">
          <label className="jb-select"><span>Status</span><select value={app.status} onChange={(e) => onMove(e.target.value)} aria-label="Application status" data-testid="detail-status">{STAGES.map((s) => <option key={s}>{s}</option>)}</select></label>
          <div className="jb-two">
            <label className="jb-select"><span>Application date</span><input type="date" className="jb-input" value={app.date} onChange={(e) => onChange({ date: e.target.value })} /></label>
            <label className="jb-select"><span>Follow-up date</span><input type="date" className="jb-input" value={app.followUp ?? ""} onChange={(e) => onChange({ followUp: e.target.value })} /></label>
          </div>
          {app.url && <p className="jb-muted"><a href={app.url} target="_blank" rel="noopener noreferrer">Open posting</a></p>}
        </section>

        <section className="jb-panel" aria-label="Job details">
          <h3>Job details</h3>
          {posting ? <JobBody posting={posting} /> : <p className="jb-muted">No saved posting is linked to this application. Notes and the posting link are all CareerOS has for it.</p>}
          {posting && <Link className="jb-btn" to={`/jobs?select=${encodeURIComponent(posting.id)}`}>Open in Jobs</Link>}
        </section>

        <section className="jb-panel" aria-label="Documents used">
          <h3>Documents used</h3>
          <label className="jb-select"><span>Résumé</span><select value={app.resumeVersionId ?? ""} onChange={(e) => onChange({ resumeVersionId: e.target.value || undefined })} data-testid="detail-resume"><option value="">None selected</option>{versions.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}</select></label>
          <label className="jb-select"><span>Cover letter</span><select value={app.coverLetterId ?? ""} onChange={(e) => onChange({ coverLetterId: e.target.value || undefined })} data-testid="detail-letter"><option value="">None selected</option>{letters.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select></label>
          <p className="jb-muted">{resume ? `Using “${resume.name}”.` : "No résumé recorded."} {letter ? <Link to={`/documents/letters/${letter.id}`}>Open cover letter</Link> : null} <Link to="/documents">Documents</Link></p>
        </section>

        <section className="jb-panel" aria-label="Notes">
          <h3>Notes</h3>
          <textarea className="jb-input tk-notes" rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} onBlur={() => onChange({ notes })} aria-label="Notes" data-testid="detail-notes" />
        </section>

        <section className="jb-panel" aria-label="Interviews">
          <h3>Interviews</h3>
          {(app.interviews ?? []).length === 0 ? <p className="jb-muted">No interviews recorded.</p> : <ul className="tk-events">{(app.interviews ?? []).map((i) => <li key={i.id}><strong>{i.kind}</strong> · {i.date.slice(0, 16).replace("T", " ")}{i.notes && <small>{i.notes}</small>}<button type="button" className="jb-icon" aria-label={`Remove ${i.kind}`} onClick={() => onChange({ interviews: (app.interviews ?? []).filter((x) => x.id !== i.id) })}><X size={13} /></button></li>)}</ul>}
          <form className="jb-form" onSubmit={(e) => { e.preventDefault(); if (!iv.date) return; onChange({ interviews: [...(app.interviews ?? []), { id: crypto.randomUUID(), ...iv }] }); setIv({ date: "", kind: "Interview", notes: "" }); }}>
            <div className="jb-two"><label>When<input type="datetime-local" value={iv.date} onChange={(e) => setIv({ ...iv, date: e.target.value })} data-testid="iv-date" /></label><label>Type<select value={iv.kind} onChange={(e) => setIv({ ...iv, kind: e.target.value })}><option>Phone screen</option><option>Interview</option><option>Technical</option><option>Onsite</option><option>Final</option></select></label></div>
            <label>Notes<input value={iv.notes} onChange={(e) => setIv({ ...iv, notes: e.target.value })} /></label>
            <button className="jb-btn" type="submit" data-testid="iv-add">Add interview</button>
          </form>
        </section>

        <section className="jb-panel" aria-label="Follow-up reminders">
          <h3>Follow-up reminders</h3>
          {(app.reminders ?? []).length === 0 ? <p className="jb-muted">No reminders.</p> : <ul className="tk-events">{(app.reminders ?? []).map((r) => <li key={r.id}><label className="jb-check"><input type="checkbox" checked={r.done} onChange={(e) => onChange({ reminders: (app.reminders ?? []).map((x) => (x.id === r.id ? { ...x, done: e.target.checked } : x)) })} /> <span className={r.done ? "tk-done" : ""}>{r.text || "Follow up"} · {r.date}</span></label></li>)}</ul>}
          <form className="jb-form" onSubmit={(e) => { e.preventDefault(); if (!rem.date) return; onChange({ reminders: [...(app.reminders ?? []), { id: crypto.randomUUID(), date: rem.date, text: rem.text.trim(), done: false }] }); setRem({ date: "", text: "" }); }}>
            <div className="jb-two"><label>Date<input type="date" value={rem.date} onChange={(e) => setRem({ ...rem, date: e.target.value })} data-testid="rem-date" /></label><label>Reminder<input value={rem.text} onChange={(e) => setRem({ ...rem, text: e.target.value })} placeholder="Email the recruiter" /></label></div>
            <button className="jb-btn" type="submit" data-testid="rem-add">Add reminder</button>
          </form>
        </section>

        <section className="jb-panel" aria-label="Contacts">
          <h3>Contacts at {app.company}</h3>
          {mine.length ? <ul className="tk-events">{mine.map((c) => <li key={c.id}><strong>{c.name}</strong>{c.relationship && ` · ${c.relationship}`}</li>)}</ul> : <p className="jb-muted">No contacts saved. CareerOS only lists people you add yourself.</p>}
          <form className="jb-form" onSubmit={(e) => { e.preventDefault(); addContact(); }}>
            <div className="jb-two"><label>Name<input value={ct.name} onChange={(e) => setCt({ ...ct, name: e.target.value })} /></label><label>How you know them<input value={ct.relationship} onChange={(e) => setCt({ ...ct, relationship: e.target.value })} /></label></div>
            <button className="jb-btn" type="submit">Add contact</button>
          </form>
        </section>

        <section className="jb-panel" aria-label="History">
          <h3>Status history</h3>
          {history.length === 0 ? <p className="jb-muted">No changes recorded yet. Changes made from now on are logged here.</p> : <ul className="tk-events" data-testid="detail-history">{history.map((h, i) => <li key={i}>{h.event}<small>{new Date(h.at).toLocaleString()}</small></li>)}</ul>}
        </section>
      </aside>
    </div>
  );
}
