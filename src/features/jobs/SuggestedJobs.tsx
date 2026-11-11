import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { loadAutoApplyQueue } from "../autoapply/storage";
import { LABEL } from "./schema";
import { queuePostingForAutoApply, trackPosting } from "./pipeline";
import { useJobWorkspace } from "./useJobWorkspace";

/**
 * "Find suitable saved jobs": ranks jobs the user saved by how much of the posting their résumé supports,
 * and sends the ones they pick to the AutoApply queue. Nothing is queued without a click.
 */
export default function SuggestedJobs({ onQueued }: { onQueued: () => void }) {
  const ws = useJobWorkspace();
  const [message, setMessage] = useState("");
  const [queuedIds, setQueuedIds] = useState<string[]>([]);
  const queuedUrls = new Set(loadAutoApplyQueue().flatMap((q) => [q.url, q.normalizedUrl]));

  const ranked = useMemo(
    () =>
      ws.state.saved
        .map((id) => ws.state.postings[id])
        .filter(Boolean)
        .map((p) => ({ p, a: ws.analysisFor(p) }))
        .sort((x, y) => (y.a?.score ?? -1) - (x.a?.score ?? -1))
        .slice(0, 8),
    [ws],
  );

  const prepare = (id: string) => {
    const p = ws.state.postings[id];
    const r = queuePostingForAutoApply(p);
    if (r.error) return setMessage(r.error);
    ws.update((s) => trackPosting(s, p, ws.versionId).state);
    setQueuedIds((q) => [...q, id]);
    setMessage(r.created ? `Added “${p.title}” to the queue.` : `“${p.title}” was already in the queue.`);
    onQueued();
  };

  return (
    <section className="aa-card" data-testid="suggested-jobs">
      <div className="aa-card-header">
        <div>
          <h2>Find suitable saved jobs</h2>
          <p>Your saved jobs, ranked by how much of each posting your résumé supports. This is an estimate from résumé text, not a promise of an interview.</p>
        </div>
      </div>
      {ranked.length === 0 ? (
        <p className="aa-muted">No saved jobs yet. Save jobs from <Link to="/jobs">Jobs</Link> or <Link to="/matches">Matches</Link> and they’ll be ranked here.</p>
      ) : (
        <ul className="aa-list" style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
          {ranked.map(({ p, a }) => {
            const inQueue = queuedIds.includes(p.id) || queuedUrls.has(p.applyUrl) || queuedUrls.has(p.url);
            return (
              <li key={p.id} data-testid={`suggested-${p.id}`} style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                <span><strong>{p.title}</strong> · {p.company}<br /><small>{[p.location, p.workArrangement !== "unspecified" ? LABEL.arrangement[p.workArrangement] : ""].filter(Boolean).join(" · ")} {a ? `· ${a.coverage.supported} of ${a.coverage.total} requirements supported (match ${a.score}/100)` : "· no analysis available"}</small></span>
                <button type="button" className="aa-btn aa-btn-secondary" disabled={inQueue} onClick={() => prepare(p.id)} data-testid={`suggested-prepare-${p.id}`}>{inQueue ? "In queue" : "Prepare application"}</button>
              </li>
            );
          })}
        </ul>
      )}
      {message && <p className="aa-muted" role="status">{message}</p>}
    </section>
  );
}
