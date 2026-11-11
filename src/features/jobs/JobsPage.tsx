import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { ArrowLeft, Plus, Search, SlidersHorizontal, Server } from "lucide-react";
import { useLocal } from "../../hooks/useLocal";
import { AnalysisSidebar, JobBody, JobHeader, JobRow, SkeletonRows } from "./components";
import { AddJobDialog, BoardsDialog } from "./dialogs";
import { activeFilterCount, categoriesOf, filterAndSort } from "./filters";
import { emptyFilters, type JobFilters, type SavedSearch } from "./schema";
import { removePosting } from "./store";
import { useJobWorkspace } from "./useJobWorkspace";
import { useScores } from "./useScores";
import "../../styles/jobs.css";


function useNarrow(): boolean {
  const q = "(max-width: 767px)";
  const [n, setN] = useState(() => typeof window !== "undefined" && window.matchMedia(q).matches);
  useEffect(() => {
    const m = window.matchMedia(q);
    const on = () => setN(m.matches);
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);
  return n;
}

type Stage = "list" | "detail" | "analysis";
const SALARY_STEPS = [50000, 75000, 100000, 125000, 150000, 200000];

export default function JobsPage() {
  const ws = useJobWorkspace();
  const [filters, setFilters] = useLocal<JobFilters>("pd:careeros:jobs:filters", emptyFilters());
  const f: JobFilters = { ...emptyFilters(), ...filters };
  // `?select=<posting id>` is used by Documents / Tracker links back to a job.
  const [selectedId, setSelectedId] = useState<string | null>(() => new URLSearchParams(window.location.search).get("select"));
  const [stage, setStage] = useState<Stage>(() => (new URLSearchParams(window.location.search).get("select") ? "detail" : "list"));
  const [dialog, setDialog] = useState<"add" | "boards" | "edit" | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const narrow = useNarrow();
  // React 18 has no typed `inert`; spread it so off-screen mobile panes are not focusable.
  const inertIf = (cond: boolean): Record<string, string> => (narrow && cond ? { inert: "" } : {});

  const total = Object.keys(ws.state.postings).length;
  const base = useMemo(() => filterAndSort(ws.state, { ...f, sort: "newest" }), [ws.state, f.query, f.location, f.employmentType, f.experience, f.category, f.salaryMin, f.arrangement, f.postedWithinDays, f.savedOnly]); // eslint-disable-line react-hooks/exhaustive-deps
  const { scores, pending } = useScores(f.sort === "relevance" ? base : [], ws);
  const list = useMemo(() => {
    if (f.sort === "newest") return base;
    return [...base].sort((a, b) => (scores.get(b.id) ?? -1) - (scores.get(a.id) ?? -1));
  }, [base, scores, f.sort]);

  const active = list.find((p) => p.id === selectedId) ?? list[0] ?? null;
  const patch = (change: Partial<JobFilters>) => setFilters({ ...f, ...change });
  const clear = () => setFilters(emptyFilters());
  const nFilters = activeFilterCount(f);
  const categories = categoriesOf(ws.state);

  useEffect(() => {
    if (ws.notice) {
      const t = setTimeout(() => ws.setNotice(""), 4000);
      return () => clearTimeout(t);
    }
  }, [ws.notice]); // eslint-disable-line react-hooks/exhaustive-deps

  const move = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key) || !list.length) return;
    e.preventDefault();
    const i = Math.max(0, list.findIndex((p) => p.id === active?.id));
    const n = e.key === "ArrowDown" ? Math.min(list.length - 1, i + 1) : e.key === "ArrowUp" ? Math.max(0, i - 1) : e.key === "Home" ? 0 : list.length - 1;
    setSelectedId(list[n].id);
    requestAnimationFrame(() => listRef.current?.querySelector<HTMLElement>(`[data-job-id="${CSS.escape(list[n].id)}"]`)?.focus());
  };

  const saveSearch = () => {
    const name = window.prompt("Name this search", f.query || "My search")?.trim();
    if (!name) return;
    const s: SavedSearch = { id: crypto.randomUUID(), name, filters: { ...f, savedOnly: false } };
    ws.update((st) => ({ ...st, searches: [s, ...st.searches] }));
  };

  const select = (id: string) => {
    setSelectedId(id);
    setStage("detail");
  };

  return (
    <div className="jb-page" data-testid="jobs-page">
      <div className="jb-toolbar">
        <div>
          <h1>Jobs</h1>
          <p className="jb-muted" data-testid="job-count" aria-live="polite">
            {total === 0 ? "No listings yet" : `${list.length} of ${total} listing${total === 1 ? "" : "s"}${nFilters ? " match your filters" : ""}`}
            {pending && " · ranking…"}
          </p>
        </div>
        <div className="jb-actions">
          <button type="button" className="jb-btn" onClick={() => setDialog("boards")} data-testid="btn-boards"><Server size={15} aria-hidden="true" /> Employer boards{ws.state.boards.length ? ` (${ws.state.boards.length})` : ""}</button>
          <button type="button" className="jb-btn jb-btn-primary" onClick={() => setDialog("add")} data-testid="btn-add-job"><Plus size={15} aria-hidden="true" /> Save a posting</button>
        </div>
      </div>

      <div className="jb-filterbar" role="search">
        <label className="jb-search"><Search size={16} aria-hidden="true" /><input type="search" value={f.query} onChange={(e) => patch({ query: e.target.value })} placeholder="Job title, company or keyword" aria-label="Search jobs" data-testid="filter-query" /></label>
        <input className="jb-input" value={f.location} onChange={(e) => patch({ location: e.target.value })} placeholder="Location" aria-label="Location" data-testid="filter-location" />
        <button type="button" className="jb-btn jb-filter-toggle" aria-expanded={filtersOpen} onClick={() => setFiltersOpen(!filtersOpen)}><SlidersHorizontal size={15} aria-hidden="true" /> Filters{nFilters ? ` (${nFilters})` : ""}</button>
        <div className={`jb-filters ${filtersOpen ? "is-open" : ""}`}>
          <select aria-label="Employment type" value={f.employmentType} onChange={(e) => patch({ employmentType: e.target.value as JobFilters["employmentType"] })} data-testid="filter-type"><option value="any">Any type</option><option value="full-time">Full-time</option><option value="part-time">Part-time</option><option value="contract">Contract</option><option value="internship">Internship</option></select>
          <select aria-label="Experience level" value={f.experience} onChange={(e) => patch({ experience: e.target.value as JobFilters["experience"] })} data-testid="filter-experience"><option value="any">Any level</option><option value="entry">Entry level</option><option value="mid">Mid level</option><option value="senior">Senior</option></select>
          <select aria-label="Category" value={f.category} onChange={(e) => patch({ category: e.target.value })} data-testid="filter-category"><option value="">Any category</option>{categories.map((c) => <option key={c} value={c}>{c}</option>)}</select>
          <select aria-label="Work arrangement" value={f.arrangement} onChange={(e) => patch({ arrangement: e.target.value as JobFilters["arrangement"] })} data-testid="filter-arrangement"><option value="any">Any arrangement</option><option value="remote">Remote</option><option value="hybrid">Hybrid</option><option value="onsite">On-site</option></select>
          <select aria-label="Minimum salary" value={f.salaryMin ?? ""} onChange={(e) => patch({ salaryMin: e.target.value ? Number(e.target.value) : null })} data-testid="filter-salary"><option value="">Any salary</option>{SALARY_STEPS.map((s) => <option key={s} value={s}>{`$${s / 1000}k+ (listed pay only)`}</option>)}</select>
          <select aria-label="Date posted" value={f.postedWithinDays ?? ""} onChange={(e) => patch({ postedWithinDays: e.target.value ? Number(e.target.value) : null })} data-testid="filter-date"><option value="">Any time</option><option value="1">Past 24 hours</option><option value="7">Past week</option><option value="30">Past month</option></select>
          <select aria-label="Sort by" value={f.sort} onChange={(e) => patch({ sort: e.target.value as JobFilters["sort"] })} data-testid="filter-sort"><option value="relevance">Sort: Relevance</option><option value="newest">Sort: Newest</option></select>
          <label className="jb-check"><input type="checkbox" checked={f.savedOnly} onChange={(e) => patch({ savedOnly: e.target.checked })} data-testid="filter-saved" /> Saved only</label>
          <button type="button" className="jb-btn" onClick={clear} disabled={!nFilters} data-testid="filter-clear">Clear filters</button>
          <button type="button" className="jb-btn" onClick={saveSearch} data-testid="search-save">Save search</button>
          {ws.state.searches.length > 0 && (
            <select aria-label="Saved searches" value="" onChange={(e) => { const s = ws.state.searches.find((x) => x.id === e.target.value); if (s) setFilters({ ...emptyFilters(), ...s.filters }); }} data-testid="search-saved-select">
              <option value="">Saved searches ({ws.state.searches.length})</option>
              {ws.state.searches.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          )}
        </div>
      </div>
      {ws.state.searches.length > 0 && (
        <p className="jb-muted jb-searches">
          {ws.state.searches.map((s) => (
            <button key={s.id} type="button" className="jb-chip" onClick={() => setFilters({ ...emptyFilters(), ...s.filters })}>{s.name}<span role="button" tabIndex={0} aria-label={`Delete saved search ${s.name}`} onClick={(e) => { e.stopPropagation(); ws.update((st) => ({ ...st, searches: st.searches.filter((x) => x.id !== s.id) })); }} onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); ws.update((st) => ({ ...st, searches: st.searches.filter((x) => x.id !== s.id) })); } }}> ×</span></button>
          ))}
        </p>
      )}
      <p className="jb-muted">Live job search is not connected. Listings come from employer boards you connect and postings you add.</p>
      {ws.notice && <p className="jb-notice" role="status">{ws.notice}</p>}

      {total === 0 ? (
        <section className="jb-empty" data-testid="jobs-empty">
          <h2>Start with real listings</h2>
          <p><strong>No saved postings yet.</strong></p>
          <p>CareerOS doesn’t ship made-up jobs. Connect an employer’s public job board (Greenhouse, Lever or Ashby) or add a posting you found.</p>
          <div className="jb-actions"><button className="jb-btn jb-btn-primary" onClick={() => setDialog("boards")}>Connect an employer board</button><button className="jb-btn" onClick={() => setDialog("add")}>Add a job</button></div>
        </section>
      ) : (
        <div className={`jb-split stage-${stage}`} data-testid="jobs-split">
          <div className="jb-pane jb-pane-list" {...inertIf(stage !== "list")}>
            <div className="jb-list" ref={listRef} role="listbox" aria-label="Job listings" onKeyDown={move} data-testid="job-list">
              {list.length === 0 && <div className="jb-empty-sm" data-testid="jobs-no-results"><p>No jobs match these filters.</p><button className="jb-btn" onClick={clear}>Clear filters</button></div>}
              {list.map((p) => (
                <JobRow key={p.id} posting={p} selected={p.id === active?.id} saved={ws.state.saved.includes(p.id)} score={scores.get(p.id) ?? null} onSelect={() => select(p.id)} onToggleSave={() => ws.actions.toggleSave(p)} />
              ))}
              {pending && <SkeletonRows count={2} />}
            </div>
          </div>
          <div className="jb-pane jb-pane-detail" {...inertIf(stage !== "detail")}>
            {active ? (
              <div className="jb-detail" data-testid="job-detail" key={active.id}>
                <button type="button" className="jb-btn jb-back" onClick={() => setStage("list")}><ArrowLeft size={15} aria-hidden="true" /> Back to jobs</button>
                <JobHeader posting={active} ws={ws} />
                {active.source === "manual" && (
                  <div className="jb-actions">
                    <button type="button" className="jb-btn" onClick={() => setDialog("edit")}>Edit posting</button>
                    <button type="button" className="jb-btn" onClick={() => { if (window.confirm(`Remove “${active.title}” from your saved jobs? This can’t be undone.`)) { ws.update((s) => removePosting(s, active.id)); setStage("list"); setSelectedId(null); } }}>Remove saved job</button>
                  </div>
                )}
                <button type="button" className="jb-btn jb-to-analysis" onClick={() => setStage("analysis")} data-testid="btn-open-analysis">Match analysis →</button>
                <JobBody posting={active} />
              </div>
            ) : <p className="jb-muted jb-pad">Select a job to read it.</p>}
          </div>
          <div className="jb-pane jb-pane-side" {...inertIf(stage !== "analysis")}>
            {active && (
              <>
                <button type="button" className="jb-btn jb-back jb-back-analysis" onClick={() => setStage("detail")}><ArrowLeft size={15} aria-hidden="true" /> Back to job</button>
                <AnalysisSidebar posting={active} ws={ws} />
              </>
            )}
          </div>
        </div>
      )}

      {dialog === "add" && <AddJobDialog ws={ws} onClose={() => setDialog(null)} onAdded={(id) => { setSelectedId(id); setStage("detail"); }} />}
      {dialog === "edit" && active && <AddJobDialog ws={ws} editing={active} onClose={() => setDialog(null)} onAdded={() => setStage("detail")} />}
      {dialog === "boards" && <BoardsDialog ws={ws} onClose={() => setDialog(null)} />}
    </div>
  );
}
