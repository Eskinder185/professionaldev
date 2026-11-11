import { useEffect, useMemo, useState, type DragEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Archive, BarChart3, BriefcaseBusiness, CalendarDays, Columns3, List as ListIcon, MoreHorizontal, Plus, Search, Star, Trash2 } from "lucide-react";
import { useModalFocus } from "../../hooks/useModalFocus";
import { sendExtensionMessage } from "../autoapply/extensionBridge";
import { CompanyMark } from "../jobs/components";
import { loadResumeVersionsSafe } from "./resumes";
import { ApplicationDrawer } from "./ApplicationDrawer";
import { Charts } from "./Charts";
import {
  COLUMNS, STAGES, type Application, loadApplications, loadReview, moveApplication, nextAction, pendingReviews, saveApplications, saveReview, sourceOf, today, type ReviewState,
} from "./model";
import "../../styles/jobs.css";
import "../../styles/tracker.css";

type View = "board" | "list" | "chart" | "timeline";
type SortKey = "company" | "role" | "location" | "date" | "status" | "resume" | "next";

const blank = { company: "", role: "", status: "Saved", date: "", url: "", notes: "", followUp: "", location: "" };

export default function TrackerPage() {
  const [items, setItemsState] = useState<Application[]>(loadApplications);
  const [params, setParams] = useSearchParams();
  const [view, setView] = useState<View>(() => (localStorage.getItem("pd:careeros:tracker:view") as View) || "board");
  const [scope, setScope] = useState<"active" | "archived">("active");
  const [source, setSource] = useState("all");
  const [query, setQuery] = useState("");
  const [favOnly, setFavOnly] = useState(false);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState(blank);
  const [error, setError] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [menu, setMenu] = useState<string | null>(null);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<string | null>(null);
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "date", dir: -1 });
  const [review, setReviewState] = useState<ReviewState>(loadReview);
  const [reviewOpen, setReviewOpen] = useState(params.get("review") === "1");
  const [notice, setNotice] = useState("");
  const versions = useMemo(() => loadResumeVersionsSafe(), []);

  const setItems = (next: Application[]) => { setItemsState(next); saveApplications(next); };
  const patch = (id: string, change: Partial<Application>) => setItems(items.map((a) => (a.id === id ? { ...a, ...change } : a)));
  const move = (id: string, status: string) => setItems(items.map((a) => (a.id === id ? moveApplication(a, status) : a)));
  const setReview = (r: ReviewState) => { setReviewState(r); saveReview(r); };
  const choose = (v: View) => { setView(v); localStorage.setItem("pd:careeros:tracker:view", v); };

  const closeDialog = () => { setAdding(false); setError(""); if (params.has("new")) setParams((c) => { const n = new URLSearchParams(c); n.delete("new"); return n; }, { replace: true }); };
  const dialogRef = useModalFocus(adding, closeDialog);
  const deleteRef = useModalFocus(Boolean(confirmDelete), () => setConfirmDelete(null));
  useEffect(() => { if (params.has("new")) setAdding(true); }, [params]);
  useEffect(() => {
    const close = () => { setMenu(null); setOptionsOpen(false); };
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, []);

  // Pull records the browser extension reported. Only records with evidence are cached; nothing is inferred.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const { response } = await sendExtensionMessage<object, { queue?: Array<{ id: string; company: string; title: string; url: string; status: string; pageStage?: string; confirmationText?: string; trackerApplicationId?: string; updatedAt: string }> }>("GET_APPLICATION_STATUS", {});
        const queue = response.ok ? response.data?.queue ?? [] : [];
        const found = queue
          .filter((q) => q.status === "Ready for review" || (q.pageStage === "completion_confirmed" && q.confirmationText))
          .map((q) => ({
            queueId: q.id, company: q.company, role: q.title, url: q.url, receivedAt: q.updatedAt, trackerId: q.trackerApplicationId,
            evidence: q.confirmationText ? `The application page showed: “${q.confirmationText.slice(0, 140)}”` : "AutoApply finished filling this application. CareerOS can’t tell whether you submitted it.",
          }));
        if (cancelled || !found.length) return;
        const cur = loadReview();
        const known = new Set(cur.received.map((r) => r.queueId));
        const merged = { ...cur, received: [...cur.received.map((r) => found.find((f) => f.queueId === r.queueId) ?? r), ...found.filter((f) => !known.has(f.queueId))] };
        saveReview(merged);
        setReviewState(merged);
      } catch { /* extension not installed: nothing to review */ }
    })();
    return () => { cancelled = true; };
  }, []);

  const pending = pendingReviews(review, items);

  const q = query.trim().toLowerCase();
  const shown = useMemo(() => items.filter((a) => Boolean(a.archived) === (scope === "archived") && (!favOnly || a.favorite) && (source === "all" || sourceOf(a) === source) && (!q || `${a.company} ${a.role} ${a.location ?? ""} ${a.notes ?? ""}`.toLowerCase().includes(q))), [items, scope, favOnly, source, q]);
  const resumeName = (a: Application) => versions.find((v) => v.id === a.resumeVersionId)?.name ?? "";
  const sorted = useMemo(() => {
    const get = (a: Application): string => ({ company: a.company, role: a.role, location: a.location ?? "", date: a.date, status: String(STAGES.indexOf(a.status as never)).padStart(2, "0"), resume: resumeName(a), next: nextAction(a) })[sort.key].toLowerCase();
    return [...shown].sort((x, y) => (get(x) < get(y) ? -1 : get(x) > get(y) ? 1 : 0) * sort.dir);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown, sort, versions]);

  const add = () => {
    if (!draft.company.trim() || !draft.role.trim()) { setError("Company and role are required."); return; }
    const a: Application = { id: crypto.randomUUID(), company: draft.company.trim(), role: draft.role.trim(), status: draft.status, date: draft.date, url: draft.url.trim() || undefined, notes: draft.notes.trim() || undefined, followUp: draft.followUp || undefined, location: draft.location.trim() || undefined, source: "manual", history: [{ at: new Date().toISOString(), event: `Added as ${draft.status}` }] };
    setItems([a, ...items]);
    closeDialog();
    setDraft(blank);
  };

  const onDrop = (e: DragEvent, col: (typeof COLUMNS)[number]) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain") || dragId;
    setOverCol(null);
    setDragId(null);
    if (!id) return;
    const a = items.find((x) => x.id === id);
    if (a && !col.statuses.includes(a.status)) move(id, col.dropStatus);
  };

  const exportCsv = () => {
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const rows = [["Company", "Position", "Location", "Date", "Status", "Résumé", "Next action", "URL"], ...sorted.map((a) => [a.company, a.role, a.location ?? "", a.date, a.status, resumeName(a), nextAction(a), a.url ?? ""])];
    const url = URL.createObjectURL(new Blob([rows.map((r) => r.map(esc).join(",")).join("\n")], { type: "text/csv" }));
    const link = document.createElement("a");
    link.href = url; link.download = "applications.csv"; document.body.appendChild(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const confirm = (r: ReviewState["received"][number]) => {
    const target = items.find((a) => a.id === r.trackerId || (a.url && a.url === r.url));
    const stamp = { at: new Date().toISOString(), event: "You confirmed this application was submitted" };
    if (target) setItems(items.map((a) => (a.id === target.id ? { ...moveApplication(a, "Applied"), date: today(), history: [...(moveApplication(a, "Applied").history ?? []), stamp] } : a)));
    else setItems([{ id: crypto.randomUUID(), company: r.company, role: r.role, status: "Applied", date: today(), url: r.url, source: "autoapply", history: [stamp] }, ...items]);
    setReview({ ...review, confirmed: [...review.confirmed, r.queueId] });
    setNotice(`Marked “${r.role}” as Applied.`);
  };
  const dismissReview = (id: string) => setReview({ ...review, dismissed: [...review.dismissed, id] });

  const open = items.find((a) => a.id === openId) ?? null;
  const delTarget = items.find((a) => a.id === confirmDelete);

  const renderCard = (a: Application) => (
    <article key={a.id} className={`tk-card ${dragId === a.id ? "is-dragging" : ""}`} draggable onDragStart={(e) => { e.dataTransfer.setData("text/plain", a.id); e.dataTransfer.effectAllowed = "move"; setDragId(a.id); }} onDragEnd={() => { setDragId(null); setOverCol(null); }} data-testid={`card-${a.id}`}>
      <button type="button" className="tk-card-main" onClick={() => setOpenId(a.id)} aria-label={`Open ${a.role} at ${a.company}`}>
        <CompanyMark name={a.company} size={34} />
        <span className="tk-card-text"><strong>{a.role}</strong><span>{a.company}</span>{a.location && <small>{a.location}</small>}<small>{a.date ? `Added ${a.date}` : "Date not set"}</small></span>
      </button>
      <div className="tk-card-foot">
        <select aria-label={`Move ${a.role} at ${a.company}`} value={a.status} onChange={(e) => move(a.id, e.target.value)} className="tk-select">{STAGES.map((s) => <option key={s}>{s}</option>)}</select>
        <button type="button" className={`jb-icon ${a.favorite ? "is-on" : ""}`} aria-pressed={Boolean(a.favorite)} aria-label={`${a.favorite ? "Unfavorite" : "Favorite"} ${a.role}`} onClick={() => patch(a.id, { favorite: !a.favorite })}><Star size={16} fill={a.favorite ? "currentColor" : "none"} /></button>
        <div className="tk-menu-wrap" onClick={(e) => e.stopPropagation()}>
          <button type="button" className="jb-icon" aria-label={`Actions for ${a.role}`} aria-expanded={menu === a.id} onClick={() => setMenu(menu === a.id ? null : a.id)}><MoreHorizontal size={17} /></button>
          {menu === a.id && (
            <div className="jb-menu" role="menu">
              <button role="menuitem" onClick={() => { setOpenId(a.id); setMenu(null); }}>Open details</button>
              {a.url && <a role="menuitem" href={a.url} target="_blank" rel="noopener noreferrer">Open posting</a>}
              <button role="menuitem" onClick={() => { patch(a.id, { archived: !a.archived }); setMenu(null); }}><Archive size={13} /> {a.archived ? "Unarchive" : "Archive"}</button>
              <button role="menuitem" className="dc-danger" onClick={() => { setConfirmDelete(a.id); setMenu(null); }}><Trash2 size={13} /> Delete</button>
            </div>
          )}
        </div>
      </div>
    </article>
  );

  const th = (k: SortKey, children: string) => (
    <th key={k} aria-sort={sort.key === k ? (sort.dir === 1 ? "ascending" : "descending") : "none"}><button type="button" onClick={() => setSort({ key: k, dir: sort.key === k ? ((sort.dir * -1) as 1 | -1) : 1 })}>{children}{sort.key === k ? (sort.dir === 1 ? " ▲" : " ▼") : ""}</button></th>
  );

  return (
    <div className="jb-page" data-testid="tracker-page">
      <div className="jb-toolbar">
        <div><h1>Application tracker</h1><p className="jb-muted">{items.length ? `${shown.length} ${scope} application${shown.length === 1 ? "" : "s"}` : "Organize every opportunity and its next step. Records stay in this browser."}</p></div>
        <div className="jb-actions">
          <button type="button" className="jb-btn jb-btn-primary" onClick={() => setAdding(true)}><Plus size={15} aria-hidden="true" /> New application</button>
          <div className="tk-menu-wrap" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="jb-btn" aria-expanded={optionsOpen} onClick={() => setOptionsOpen(!optionsOpen)} data-testid="btn-options"><MoreHorizontal size={15} aria-hidden="true" /> Options</button>
            {optionsOpen && (
              <div className="jb-menu" role="menu">
                <button role="menuitem" onClick={() => { exportCsv(); setOptionsOpen(false); }}>Export as CSV</button>
                <button role="menuitem" onClick={() => { setItems(items.map((a) => (a.status === "Rejected" || a.status === "Withdrawn" ? { ...a, archived: true } : a))); setOptionsOpen(false); setNotice("Archived rejected and withdrawn applications."); }}>Archive rejected &amp; withdrawn</button>
                <button role="menuitem" onClick={() => { setFavOnly(!favOnly); setOptionsOpen(false); }}>{favOnly ? "Show all" : "Favorites only"}</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {pending.length > 0 && (
        <section className="tk-banner" role="region" aria-label="Applications need review" data-testid="review-banner">
          <div><strong>Applications need review</strong><p>{pending.length} application{pending.length === 1 ? "" : "s"} from AutoApply may have been submitted but {pending.length === 1 ? "isn’t" : "aren’t"} marked Applied. CareerOS never assumes a submission.</p></div>
          <div className="jb-actions"><button type="button" className="jb-btn jb-btn-primary" onClick={() => setReviewOpen(!reviewOpen)} data-testid="btn-review">{reviewOpen ? "Hide" : "Review"}</button><button type="button" className="jb-btn" onClick={() => setReview({ ...review, dismissed: [...review.dismissed, ...pending.map((p) => p.queueId)] })} data-testid="btn-dismiss-all">Dismiss</button></div>
          {reviewOpen && (
            <ul className="tk-review-list" data-testid="review-list">
              {pending.map((r) => (
                <li key={r.queueId}><span><strong>{r.role}</strong> · {r.company}<small>{r.evidence}</small></span><span className="jb-actions"><button type="button" className="jb-btn jb-btn-primary" onClick={() => confirm(r)} data-testid={`confirm-${r.queueId}`}>I submitted it</button><button type="button" className="jb-btn" onClick={() => dismissReview(r.queueId)}>I didn’t</button></span></li>
              ))}
            </ul>
          )}
        </section>
      )}
      {notice && <p className="jb-notice" role="status">{notice}</p>}
      {items.length > 0 && <div className="career-application-summary" aria-label="Application summary"><span><strong>{items.length}</strong> Total</span>{STAGES.map((stage) => { const n = items.filter((a) => a.status === stage).length; return n ? <span key={stage}><strong>{n}</strong> {stage}</span> : null; })}</div>}

      <div className="tk-controls">
        <div className="jb-toggle" role="group" aria-label="Scope">
          <button aria-pressed={scope === "active"} onClick={() => setScope("active")} data-testid="scope-active">Active</button>
          <button aria-pressed={scope === "archived"} onClick={() => setScope("archived")} data-testid="scope-archived">Archived ({items.filter((a) => a.archived).length})</button>
        </div>
        <label className="jb-search"><Search size={15} aria-hidden="true" /><input type="search" placeholder="Search applications" aria-label="Search applications" value={query} onChange={(e) => setQuery(e.target.value)} data-testid="tracker-search" /></label>
        <select className="tk-select" aria-label="Source" value={source} onChange={(e) => setSource(e.target.value)} data-testid="tracker-source"><option value="all">All sources</option><option value="mine">Added by me</option><option value="board">From job boards</option><option value="autoapply">From AutoApply</option></select>
        <div className="jb-toggle" role="group" aria-label="View">
          <button aria-pressed={view === "board"} onClick={() => choose("board")}><Columns3 size={14} aria-hidden="true" /> Board</button>
          <button aria-pressed={view === "list"} onClick={() => choose("list")}><ListIcon size={14} aria-hidden="true" /> List</button>
          <button aria-pressed={view === "chart"} onClick={() => choose("chart")}><BarChart3 size={14} aria-hidden="true" /> Chart</button>
          <button aria-pressed={view === "timeline"} onClick={() => choose("timeline")}><CalendarDays size={14} aria-hidden="true" /> Timeline</button>
        </div>
      </div>

      {items.length === 0 ? (
        <section className="jb-empty" data-testid="tracker-empty"><BriefcaseBusiness size={30} aria-hidden="true" /><h2>Start your application pipeline</h2><p>Add a role you are considering or have already applied to, or save one from <Link to="/jobs">Jobs</Link>.</p><button className="jb-btn jb-btn-primary" onClick={() => setAdding(true)}>Add your first application</button></section>
      ) : view === "board" ? (
        <div className="tk-board" data-testid="board">
          {COLUMNS.map((col) => {
            const cards = shown.filter((a) => col.statuses.includes(a.status));
            return (
              <section key={col.id} className={`tk-col ${overCol === col.id ? "is-over" : ""}`} aria-label={`${col.label} column`} data-testid={`col-${col.id}`} onDragOver={(e) => { e.preventDefault(); setOverCol(col.id); }} onDragLeave={() => setOverCol((c) => (c === col.id ? null : c))} onDrop={(e) => onDrop(e, col)}>
                <h2>{col.label} <span>{cards.length}</span></h2>
                <div className="tk-col-body">{cards.map((a) => renderCard(a))}{cards.length === 0 && <p className="jb-muted tk-col-empty">No applications</p>}</div>
              </section>
            );
          })}
        </div>
      ) : view === "list" ? (
        <div className="tk-table-wrap"><table className="tk-table" data-testid="list">
          <thead><tr>{th("company", "Company")}{th("role", "Position")}{th("location", "Location")}{th("date", "Application date")}{th("status", "Status")}{th("resume", "Résumé version")}{th("next", "Next action")}</tr></thead>
          <tbody>{sorted.map((a) => (
            <tr key={a.id} data-testid={`row-${a.id}`}>
              <td><button type="button" className="tk-link" onClick={() => setOpenId(a.id)}>{a.company}</button></td>
              <td>{a.role}</td><td>{a.location ?? "—"}</td><td>{a.date || "Date not set"}</td>
              <td><select aria-label={`Status for ${a.role}`} value={a.status} onChange={(e) => move(a.id, e.target.value)} className="tk-select">{STAGES.map((s) => <option key={s}>{s}</option>)}</select></td>
              <td>{resumeName(a) || "—"}</td><td>{nextAction(a)}</td>
            </tr>))}</tbody>
        </table></div>
      ) : view === "chart" ? (
        <Charts items={items.filter((a) => !a.archived)} />
      ) : (
        <ol className="tk-timeline" data-testid="timeline">{[...shown].sort((a, b) => (b.date || "").localeCompare(a.date || "")).map((a) => <li key={a.id}><time>{a.date || "Date not set"}</time><button type="button" className="tk-link" onClick={() => setOpenId(a.id)}>{a.role} at {a.company}</button><span className="jb-tag">{a.status}</span></li>)}</ol>
      )}
      {items.length > 0 && shown.length === 0 && <p className="jb-muted" data-testid="tracker-none">No applications match.</p>}

      {open && <ApplicationDrawer app={open} versions={versions} onClose={() => setOpenId(null)} onChange={(c) => patch(open.id, c)} onMove={(s) => move(open.id, s)} />}

      {adding && (
        <div className="career-overlay career-form-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) closeDialog(); }}>
          <div ref={dialogRef} className="career-form-dialog jb-dialog" role="dialog" aria-modal="true" aria-label="New application">
            <h2>New application</h2>
            <form className="jb-form" onSubmit={(e) => { e.preventDefault(); add(); }}>
              {error && <p className="career-form-error" role="alert">{error}</p>}
              <label>Company<input value={draft.company} onChange={(e) => setDraft({ ...draft, company: e.target.value })} /></label>
              <label>Role<input value={draft.role} onChange={(e) => setDraft({ ...draft, role: e.target.value })} /></label>
              <label>Location<input value={draft.location} onChange={(e) => setDraft({ ...draft, location: e.target.value })} /></label>
              <div className="jb-two"><label>Status<select value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value })}>{STAGES.map((s) => <option key={s}>{s}</option>)}</select></label><label>Relevant date (optional)<input type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} /></label></div>
              <label>Posting link<input value={draft.url} onChange={(e) => setDraft({ ...draft, url: e.target.value })} placeholder="https://" /></label>
              <label>Follow-up date<input type="date" value={draft.followUp} onChange={(e) => setDraft({ ...draft, followUp: e.target.value })} /></label>
              <label>Notes<textarea rows={3} value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} /></label>
              <div className="jb-actions"><button className="jb-btn jb-btn-primary" type="submit">Add application</button><button className="jb-btn" type="button" onClick={closeDialog}>Cancel</button></div>
            </form>
          </div>
        </div>
      )}

      {delTarget && (
        <div className="career-overlay career-form-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setConfirmDelete(null); }}>
          <div ref={deleteRef} className="career-form-dialog jb-dialog" role="alertdialog" aria-modal="true" aria-label="Confirm delete" data-testid="tracker-confirm-delete">
            <h2>Delete this application?</h2>
            <p>“{delTarget.role} at {delTarget.company}” and its history will be removed from this device. This can’t be undone. You can archive it instead.</p>
            <div className="jb-actions"><button className="jb-btn dc-danger-btn" onClick={() => { setItems(items.filter((a) => a.id !== delTarget.id)); setConfirmDelete(null); setOpenId(null); }} data-testid="tracker-delete-yes">Delete</button><button className="jb-btn" onClick={() => setConfirmDelete(null)}>Cancel</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
