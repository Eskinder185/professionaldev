import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { MoreHorizontal, Settings2 } from "lucide-react";
import { AnalysisSidebar, JobBody, JobHeader } from "./components";
import { BoardsDialog, PrefsDialog } from "./dialogs";
import { rankPostings } from "./analysis";
import { applyPrefs, filterAndSort } from "./filters";
import { emptyFilters, type JobFilters } from "./schema";
import { useJobWorkspace } from "./useJobWorkspace";
import "../../styles/jobs.css";

type Feed = "for-you" | "saved" | "newest" | "remote";
const FEEDS: Array<{ id: Feed; label: string }> = [
  { id: "for-you", label: "For you" },
  { id: "saved", label: "Saved" },
  { id: "newest", label: "Newest" },
  { id: "remote", label: "Remote" },
];
const CANDIDATES = 150;
const PAGE = 15;

export default function MatchesPage() {
  const ws = useJobWorkspace();
  const [feed, setFeed] = useState<Feed>("for-you");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [dialog, setDialog] = useState<"prefs" | "boards" | null>(null);
  const [shown, setShown] = useState(PAGE);

  const filters: JobFilters = useMemo(
    () => ({ ...emptyFilters(), sort: feed === "for-you" ? "relevance" : "newest", savedOnly: feed === "saved", arrangement: feed === "remote" ? "remote" : "any" }),
    [feed],
  );

  const { rows, hidden, total } = useMemo(() => {
    const all = filterAndSort(ws.state, { ...filters, sort: "newest" });
    const { shown: preferred, hidden } = feed === "for-you" ? applyPrefs(all, ws.state.prefs) : { shown: all, hidden: 0 };
    const candidates = preferred.slice(0, CANDIDATES);
    const ranks = rankPostings(ws.state, candidates, ws.version);
    // Only "For you" is ranked; other feeds are plain, chronological lists.
    const ordered = feed === "for-you" ? [...candidates].sort((a, b) => (ranks.get(b.id)?.score ?? 0) - (ranks.get(a.id)?.score ?? 0)) : candidates;
    return { rows: ordered.map((p) => ({ p, rank: ranks.get(p.id) })), hidden, total: preferred.length };
  }, [ws.state, ws.version, filters, feed]);

  const visible = rows.slice(0, shown);
  const active = rows.find((r) => r.p.id === selectedId)?.p ?? visible[0]?.p ?? null;
  const empty = Object.keys(ws.state.postings).length === 0;

  return (
    <div className="jb-page" data-testid="matches-page">
      <div className="mt-head">
        <div>
          <h1>For you</h1>
          <p className="jb-muted" aria-live="polite">
            {empty ? "No listings yet" : `${total} job${total === 1 ? "" : "s"} ranked by how well your résumé supports their requirements${hidden ? ` · ${hidden} hidden by your preferences` : ""}`}
          </p>
        </div>
        <div className="jb-actions">
          <div className="jb-toggle" role="group" aria-label="Feed">
            {FEEDS.map((f) => <button key={f.id} type="button" aria-pressed={feed === f.id} onClick={() => { setFeed(f.id); setShown(PAGE); }} data-testid={`feed-${f.id}`}>{f.label}</button>)}
          </div>
          <button type="button" className="jb-btn" onClick={() => setDialog("prefs")} data-testid="btn-match-prefs"><Settings2 size={15} aria-hidden="true" /> Match preferences</button>
        </div>
      </div>
      {ws.notice && <p className="jb-notice" role="status">{ws.notice}</p>}

      {empty ? (
        <section className="jb-empty" data-testid="matches-empty">
          <h2>No recommendations yet</h2>
          <p>Recommendations come only from jobs you’ve brought into CareerOS: employer job boards you connect, or postings you add. Nothing is made up.</p>
          <div className="jb-actions"><button className="jb-btn jb-btn-primary" onClick={() => setDialog("boards")}>Connect an employer board</button><Link className="jb-btn" to="/jobs">Go to Jobs</Link></div>
        </section>
      ) : rows.length === 0 ? (
        <section className="jb-empty" data-testid="matches-none">
          <h2>{feed === "saved" ? "No saved jobs yet" : "Nothing matches right now"}</h2>
          <p>{hidden ? "Your match preferences are hiding every listing. Adjust them to see more." : "Try another feed or add more jobs."}</p>
          <button className="jb-btn" onClick={() => setDialog("prefs")}>Match preferences</button>
        </section>
      ) : (
        <div className="mt-layout">
          <div className="mt-feed" data-testid="match-feed">
            {visible.map(({ p, rank }) => {
              const isOpen = open === p.id;
              return (
                <article key={p.id} className={`mt-card ${p.id === active?.id ? "is-selected" : ""}`} data-testid={`match-card-${p.id}`} onClick={() => setSelectedId(p.id)}>
                  <div className="mt-card-head">
                    <div style={{ flex: 1, minWidth: 0 }}><JobHeader posting={p} ws={ws} compact /></div>
                    <details className="jb-more">
                      <summary className="jb-icon" aria-label={`More actions for ${p.title}`}><MoreHorizontal size={18} /></summary>
                      <div className="jb-menu">
                        <button type="button" onClick={() => ws.actions.dismiss(p)} data-testid={`dismiss-${p.id}`}>Not interested</button>
                        {p.url && <a href={p.url} target="_blank" rel="noopener noreferrer">Open original posting</a>}
                      </div>
                    </details>
                  </div>
                  {feed === "for-you" && rank && (
                    <p className="mt-why" data-testid="why-match">
                      {rank.analysis ? <strong>Match {rank.score}/100 · </strong> : null}
                      {rank.reasons.join(" · ")}
                    </p>
                  )}
                  <button type="button" className="jb-btn" aria-expanded={isOpen} onClick={() => { setOpen(isOpen ? null : p.id); setSelectedId(p.id); }} data-testid={`toggle-detail-${p.id}`}>{isOpen ? "Hide details" : "Show details"}</button>
                  {isOpen && <JobBody posting={p} />}
                </article>
              );
            })}
            {rows.length > shown && <button type="button" className="jb-btn" onClick={() => setShown(shown + PAGE)}>Show more ({rows.length - shown} left)</button>}
          </div>
          <div className="mt-side">{active && <AnalysisSidebar posting={active} ws={ws} showFeedback />}</div>
        </div>
      )}

      {dialog === "prefs" && <PrefsDialog ws={ws} onClose={() => setDialog(null)} />}
      {dialog === "boards" && <BoardsDialog ws={ws} onClose={() => setDialog(null)} />}
    </div>
  );
}
