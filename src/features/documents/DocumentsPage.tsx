import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Copy, Download, FileText, Grid2x2, List, MoreHorizontal, Pencil, Plus, Star, Trash2, Upload } from "lucide-react";
import { getLocal, setLocal } from "../../hooks/useLocal";
import { useModalFocus } from "../../hooks/useModalFocus";
import ResumeDocument from "../resume/document/ResumeDocument";
import { exportDocx } from "../resume/document/exportDocx";
import { exportPdf } from "../resume/document/exportPdf";
import { PAPER, newVersion } from "../resume/model/defaults";
import { RESUME_DOCS_KEY, loadVersions } from "../resume/model/storage";
import type { ResumeVersion } from "../resume/model/types";
import { parseResumeText } from "../resume/parse/parseResume";
import { type CoverLetter, LETTERS_EVENT, loadLetters, letterToPdf, newLetter, saveLetters } from "./letters";
import "../../styles/jobs.css";
import "../../styles/documents.css";

type Tab = "resumes" | "letters";
type View = "grid" | "list";

function download(name: string, content: BlobPart, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const safe = (s: string) => s.replace(/[^\w.-]+/g, "_").slice(0, 80) || "document";
const when = (iso: string) => new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });

function Thumb({ v }: { v: ResumeVersion }) {
  const widthPx = PAPER[v.settings.paper ?? "letter"].widthIn * 96;
  return (
    <div className="dc-thumb" aria-hidden="true">
      <div className="dc-thumb-inner" style={{ width: widthPx }}>
        <ResumeDocument resume={v.resume} settings={v.settings} zoom={Math.min(0.32, 200 / widthPx)} />
      </div>
    </div>
  );
}

export default function DocumentsPage() {
  const navigate = useNavigate();
  const [versions, setVersions] = useState<ResumeVersion[]>(loadVersions);
  const [letters, setLetters] = useState<CoverLetter[]>(loadLetters);
  const [tab, setTab] = useState<Tab>(() => getLocal<Tab>("pd:careeros:documents:tab", "resumes"));
  const [view, setView] = useState<View>(() => getLocal<View>("pd:careeros:documents:view", "grid"));
  const [query, setQuery] = useState("");
  const [favOnly, setFavOnly] = useState(false);
  const [menu, setMenu] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [preview, setPreview] = useState<{ kind: Tab; id: string } | null>(null);
  const [confirm, setConfirm] = useState<{ kind: Tab; id: string } | null>(null);
  const [rename, setRename] = useState<{ kind: Tab; id: string; name: string } | null>(null);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const uploadKind = useRef<Tab>("resumes");

  useEffect(() => { setLocal("pd:careeros:documents:tab", tab); }, [tab]);
  useEffect(() => { setLocal("pd:careeros:documents:view", view); }, [view]);
  useEffect(() => {
    const sync = () => setLetters(loadLetters());
    window.addEventListener(LETTERS_EVENT, sync);
    return () => window.removeEventListener(LETTERS_EVENT, sync);
  }, []);
  useEffect(() => {
    const close = () => setMenu(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, []);

  const writeVersions = (next: ResumeVersion[]) => { setVersions(next); setLocal(RESUME_DOCS_KEY, next); };
  const writeLetters = (next: CoverLetter[]) => { setLetters(next); saveLetters(next); };
  const master = versions.find((v) => v.kind === "master");

  const q = query.trim().toLowerCase();
  const shownVersions = useMemo(() => versions.filter((v) => (!favOnly || v.favorite) && (!q || `${v.name} ${v.company ?? ""} ${v.role ?? ""}`.toLowerCase().includes(q))).sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)), [versions, q, favOnly]);
  const shownLetters = useMemo(() => letters.filter((l) => (!favOnly || l.favorite) && (!q || `${l.name} ${l.company} ${l.role} ${l.text}`.toLowerCase().includes(q))).sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)), [letters, q, favOnly]);

  const patchVersion = (id: string, change: Partial<ResumeVersion>) => writeVersions(versions.map((v) => (v.id === id ? { ...v, ...change, updatedAt: new Date().toISOString() } : v)));
  const patchLetter = (id: string, change: Partial<CoverLetter>) => writeLetters(letters.map((l) => (l.id === id ? { ...l, ...change, updatedAt: new Date().toISOString() } : l)));

  const startUpload = (kind: Tab) => { uploadKind.current = kind; setAddOpen(false); fileRef.current?.click(); };
  const onFile = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    setStatus("");
    try {
      const { extractResumeFile } = await import("../resume/parse/extract");
      const out = await extractResumeFile(file);
      if (!out.text.trim()) throw new Error(out.warnings[0] || "No text could be read from that file.");
      const base = file.name.replace(/\.[^.]+$/, "");
      if (uploadKind.current === "resumes") {
        const parsed = parseResumeText(out.text);
        const v = newVersion(base, parsed.resume, { source: { fileName: file.name, kind: out.kind, sizeBytes: file.size, extractedText: out.text, importedAt: new Date().toISOString() }, issues: parsed.issues });
        writeVersions([v, ...versions]);
        setTab("resumes");
        setStatus(`Imported “${base}”. ${parsed.issues.length ? `${parsed.issues.length} item(s) need review in Résumé Studio.` : "No parsing issues found."}`);
      } else {
        const l = newLetter({ name: base, text: out.text, origin: "upload" });
        writeLetters([l, ...letters]);
        setTab("letters");
        setStatus(`Imported “${base}”. Only the text was kept; the original file was not stored.`);
      }
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Could not read that file.");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const newResume = () => {
    const v = newVersion(`New résumé ${versions.length + 1}`);
    writeVersions([v, ...versions]);
    setLocal("pd:careeros:resume-active", v.id);
    navigate("/resume");
  };
  const newCover = () => {
    const l = newLetter();
    writeLetters([l, ...letters]);
    navigate(`/documents/letters/${l.id}`);
  };

  const duplicate = (kind: Tab, id: string) => {
    if (kind === "resumes") {
      const v = versions.find((x) => x.id === id);
      if (!v) return;
      const now = new Date().toISOString();
      // A copy is always a tailored-style version; there is only ever one Master Profile.
      writeVersions([{ ...structuredClone(v), id: crypto.randomUUID(), name: `${v.name} (copy)`, kind: "tailored", masterId: v.kind === "master" ? v.id : v.masterId, isDefault: false, createdAt: now, updatedAt: now }, ...versions]);
    } else {
      const l = letters.find((x) => x.id === id);
      if (l) writeLetters([newLetter({ ...l, id: crypto.randomUUID(), name: `${l.name} (copy)`, isDefault: false }), ...letters]);
    }
    setStatus("Duplicated.");
  };

  const dl = async (kind: Tab, id: string, format: "pdf" | "docx" | "txt") => {
    setStatus("");
    try {
      if (kind === "resumes") {
        const v = versions.find((x) => x.id === id);
        if (!v) return;
        if (format === "docx") download(`${safe(v.name)}.docx`, exportDocx(v.resume, v.settings) as BlobPart, "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
        else {
          const r = await exportPdf(v.resume, v.settings);
          download(`${safe(v.name)}.pdf`, r.bytes, "application/pdf");
        }
      } else {
        const l = letters.find((x) => x.id === id);
        if (!l) return;
        if (format === "pdf") {
          const { jsPDF } = await import("jspdf");
          download(`${safe(l.name)}.pdf`, letterToPdf(l, jsPDF as never), "application/pdf");
        } else download(`${safe(l.name)}.txt`, l.text, "text/plain");
      }
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Download failed.");
    }
  };

  const doDelete = () => {
    if (!confirm) return;
    if (confirm.kind === "resumes") writeVersions(versions.filter((v) => v.id !== confirm.id));
    else writeLetters(letters.filter((l) => l.id !== confirm.id));
    setConfirm(null);
    setStatus("Deleted.");
  };

  const confirmRef = useModalFocus(Boolean(confirm), () => setConfirm(null));
  const renameRef = useModalFocus(Boolean(rename), () => setRename(null));
  const previewRef = useModalFocus(Boolean(preview), () => setPreview(null));
  const addRef = useModalFocus(addOpen, () => setAddOpen(false));

  const meta = (kind: Tab, id: string) => {
    const v = kind === "resumes" ? versions.find((x) => x.id === id) : undefined;
    const l = kind === "letters" ? letters.find((x) => x.id === id) : undefined;
    return { v, l };
  };

  const ActionMenu = ({ kind, id, name, favorite, isDefault, isMaster }: { kind: Tab; id: string; name: string; favorite: boolean; isDefault: boolean; isMaster: boolean }) => (
    <div className="dc-menu-wrap" onClick={(e) => e.stopPropagation()}>
      <button type="button" className="jb-icon" aria-label={`More actions for ${name}`} aria-expanded={menu === id} onClick={() => setMenu(menu === id ? null : id)} data-testid={`menu-${id}`}><MoreHorizontal size={18} /></button>
      {menu === id && (
        <div className="jb-menu dc-menu" role="menu">
          <button role="menuitem" onClick={() => { setPreview({ kind, id }); setMenu(null); }}>Preview</button>
          <button role="menuitem" onClick={() => { if (kind === "resumes") { setLocal("pd:careeros:resume-active", id); navigate("/resume"); } else navigate(`/documents/letters/${id}`); }}>Edit</button>
          <button role="menuitem" onClick={() => { setRename({ kind, id, name }); setMenu(null); }}><Pencil size={13} /> Rename</button>
          <button role="menuitem" onClick={() => { duplicate(kind, id); setMenu(null); }}><Copy size={13} /> Duplicate</button>
          {kind === "resumes" ? (
            <>
              <button role="menuitem" onClick={() => { void dl(kind, id, "pdf"); setMenu(null); }}><Download size={13} /> Download PDF</button>
              <button role="menuitem" onClick={() => { void dl(kind, id, "docx"); setMenu(null); }}><Download size={13} /> Download DOCX</button>
            </>
          ) : (
            <>
              <button role="menuitem" onClick={() => { void dl(kind, id, "pdf"); setMenu(null); }}><Download size={13} /> Download PDF</button>
              <button role="menuitem" onClick={() => { void dl(kind, id, "txt"); setMenu(null); }}><Download size={13} /> Download text</button>
            </>
          )}
          <button role="menuitem" onClick={() => { if (kind === "resumes") writeVersions(versions.map((v) => ({ ...v, isDefault: v.id === id }))); else writeLetters(letters.map((l) => ({ ...l, isDefault: l.id === id }))); setMenu(null); }} disabled={isDefault}>{isDefault ? "Default" : "Set as default"}</button>
          <button role="menuitem" onClick={() => { if (kind === "resumes") patchVersion(id, { favorite: !favorite }); else patchLetter(id, { favorite: !favorite }); setMenu(null); }}>{favorite ? "Remove favorite" : "Favorite"}</button>
          <button role="menuitem" className="dc-danger" disabled={isMaster} title={isMaster ? "The Master Profile can't be deleted" : undefined} onClick={() => { setConfirm({ kind, id }); setMenu(null); }}><Trash2 size={13} /> Delete</button>
        </div>
      )}
    </div>
  );

  const linkedLabel = (company?: string, role?: string) => (company || role ? `For ${[role, company].filter(Boolean).join(" at ")}` : null);
  const empty = tab === "resumes" ? shownVersions.length === 0 : shownLetters.length === 0;

  return (
    <div className="jb-page" data-testid="documents-page">
      <div className="jb-toolbar">
        <div><h1>Documents</h1><p className="jb-muted">Your résumés and cover letters. Stored on this device.</p></div>
        <div className="jb-actions">
          <button type="button" className="jb-btn jb-btn-primary" onClick={() => setAddOpen(true)} data-testid="btn-doc-add"><Plus size={15} aria-hidden="true" /> Add</button>
        </div>
      </div>

      <div className="dc-controls">
        <div className="jb-toggle" role="tablist" aria-label="Document type">
          <button role="tab" aria-selected={tab === "resumes"} aria-pressed={tab === "resumes"} onClick={() => setTab("resumes")} data-testid="tab-resumes">Résumés ({versions.length})</button>
          <button role="tab" aria-selected={tab === "letters"} aria-pressed={tab === "letters"} onClick={() => setTab("letters")} data-testid="tab-letters">Cover letters ({letters.length})</button>
        </div>
        <label className="jb-search"><input type="search" placeholder="Search documents" aria-label="Search documents" value={query} onChange={(e) => setQuery(e.target.value)} data-testid="doc-search" /></label>
        <label className="jb-check"><input type="checkbox" checked={favOnly} onChange={(e) => setFavOnly(e.target.checked)} /> Favorites</label>
        <div className="jb-toggle" role="group" aria-label="View">
          <button aria-pressed={view === "grid"} aria-label="Grid view" onClick={() => setView("grid")}><Grid2x2 size={15} /></button>
          <button aria-pressed={view === "list"} aria-label="List view" onClick={() => setView("list")}><List size={15} /></button>
        </div>
      </div>
      {(status || busy) && <p className="jb-notice" role="status">{busy ? "Reading file…" : status}</p>}

      <div className={`dc-grid ${view === "list" ? "is-list" : ""}`} data-testid="doc-grid">
        <button type="button" className="dc-card dc-new" onClick={() => setAddOpen(true)} data-testid="doc-new-tile" aria-label="Add a new document"><Plus size={30} aria-hidden="true" /><span>New document</span></button>
        {tab === "resumes" && shownVersions.map((v) => (
          <article key={v.id} className="dc-card" data-testid={`doc-${v.id}`}>
            <button type="button" className="dc-open" onClick={() => setPreview({ kind: "resumes", id: v.id })} aria-label={`Preview ${v.name}`}><Thumb v={v} /></button>
            <div className="dc-info">
              <div className="dc-title"><strong title={v.name}>{v.name}</strong>{v.favorite && <Star size={14} fill="currentColor" aria-label="Favorite" />}</div>
              <span className="jb-muted">{v.kind === "master" ? "Master Profile" : "Résumé"}{v.isDefault ? " · Default" : ""} · Edited {when(v.updatedAt)}</span>
              {linkedLabel(v.company, v.role) && <span className="dc-link">{v.jobId ? <Link to={`/jobs?select=${encodeURIComponent(v.jobId)}`}>{linkedLabel(v.company, v.role)}</Link> : linkedLabel(v.company, v.role)}</span>}
            </div>
            <ActionMenu kind="resumes" id={v.id} name={v.name} favorite={Boolean(v.favorite)} isDefault={Boolean(v.isDefault)} isMaster={v.kind === "master" && v.id === master?.id} />
          </article>
        ))}
        {tab === "letters" && shownLetters.map((l) => (
          <article key={l.id} className="dc-card" data-testid={`doc-${l.id}`}>
            <button type="button" className="dc-open" onClick={() => setPreview({ kind: "letters", id: l.id })} aria-label={`Preview ${l.name}`}><div className="dc-thumb dc-thumb-text" aria-hidden="true"><p>{l.text.slice(0, 420) || "Empty letter"}</p></div></button>
            <div className="dc-info">
              <div className="dc-title"><strong title={l.name}>{l.name}</strong>{l.favorite && <Star size={14} fill="currentColor" aria-label="Favorite" />}</div>
              <span className="jb-muted">Cover letter{l.isDefault ? " · Default" : ""} · Edited {when(l.updatedAt)}</span>
              {linkedLabel(l.company, l.role) && <span className="dc-link">{l.jobId ? <Link to={`/jobs?select=${encodeURIComponent(l.jobId)}`}>{linkedLabel(l.company, l.role)}</Link> : linkedLabel(l.company, l.role)}</span>}
            </div>
            <ActionMenu kind="letters" id={l.id} name={l.name} favorite={l.favorite} isDefault={l.isDefault} isMaster={false} />
          </article>
        ))}
      </div>
      {empty && <p className="jb-muted" data-testid="doc-empty">{q || favOnly ? "No documents match your search." : tab === "resumes" ? "No résumés yet." : "No cover letters yet. Use the plus tile to write or upload one."}</p>}

      <input ref={fileRef} type="file" hidden accept=".pdf,.docx,.txt,.md" onChange={(e) => void onFile(e.target.files?.[0])} data-testid="doc-file-input" />

      {addOpen && (
        <div className="career-overlay career-form-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setAddOpen(false); }}>
          <div ref={addRef} className="career-form-dialog jb-dialog" role="dialog" aria-modal="true" aria-label="Add a document" data-testid="dialog-add-doc">
            <h2>Add a document</h2>
            <div className="dc-add-list">
              <button className="jb-btn" onClick={() => { setAddOpen(false); newResume(); }} data-testid="add-new-resume"><FileText size={15} /> New résumé</button>
              <button className="jb-btn" onClick={() => startUpload("resumes")} data-testid="add-upload-resume"><Upload size={15} /> Upload résumé (PDF, DOCX, TXT)</button>
              <button className="jb-btn" onClick={() => { setAddOpen(false); newCover(); }} data-testid="add-new-letter"><FileText size={15} /> New cover letter</button>
              <button className="jb-btn" onClick={() => startUpload("letters")} data-testid="add-upload-letter"><Upload size={15} /> Upload cover letter (PDF, DOCX, TXT)</button>
            </div>
            <div className="jb-actions"><button className="jb-btn" onClick={() => setAddOpen(false)}>Cancel</button></div>
          </div>
        </div>
      )}

      {preview && (() => {
        const { v, l } = meta(preview.kind, preview.id);
        return (
          <div className="career-overlay career-form-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setPreview(null); }}>
            <div ref={previewRef} className="career-form-dialog jb-dialog dc-preview" role="dialog" aria-modal="true" aria-label="Document preview" data-testid="doc-preview">
              <h2>{v?.name ?? l?.name}</h2>
              {v ? <div className="dc-preview-paper"><ResumeDocument resume={v.resume} settings={v.settings} zoom={0.7} /></div> : <pre className="jb-pre dc-letter">{l?.text || "This letter is empty."}</pre>}
              <div className="jb-actions"><button className="jb-btn" onClick={() => setPreview(null)}>Close</button></div>
            </div>
          </div>
        );
      })()}

      {rename && (
        <div className="career-overlay career-form-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setRename(null); }}>
          <div ref={renameRef} className="career-form-dialog jb-dialog" role="dialog" aria-modal="true" aria-label="Rename document" data-testid="dialog-rename">
            <h2>Rename</h2>
            <form className="jb-form" onSubmit={(e) => { e.preventDefault(); const n = rename.name.trim(); if (n) { if (rename.kind === "resumes") patchVersion(rename.id, { name: n }); else patchLetter(rename.id, { name: n }); } setRename(null); }}>
              <label>Name<input value={rename.name} onChange={(e) => setRename({ ...rename, name: e.target.value })} data-testid="rename-input" autoFocus /></label>
              <div className="jb-actions"><button className="jb-btn jb-btn-primary" type="submit" data-testid="rename-save">Save</button><button className="jb-btn" type="button" onClick={() => setRename(null)}>Cancel</button></div>
            </form>
          </div>
        </div>
      )}

      {confirm && (
        <div className="career-overlay career-form-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setConfirm(null); }}>
          <div ref={confirmRef} className="career-form-dialog jb-dialog" role="alertdialog" aria-modal="true" aria-label="Confirm delete" data-testid="dialog-confirm-delete">
            <h2>Delete this document?</h2>
            <p>“{meta(confirm.kind, confirm.id).v?.name ?? meta(confirm.kind, confirm.id).l?.name}” will be removed from this device. This can’t be undone.</p>
            <div className="jb-actions"><button className="jb-btn dc-danger-btn" onClick={doDelete} data-testid="confirm-delete">Delete</button><button className="jb-btn" onClick={() => setConfirm(null)}>Cancel</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
