import { useState } from "react";
import { Card, Badge, Gauge, type Tone } from "./ui";
import { useModel } from "./lib/context";
import { openUrl, dispatch } from "./lib/bridge";
import { analysisFor, effectiveCounts, GROUP_LABEL, type Override } from "./lib/model";
import type { RequirementAnalysis } from "../../../../packages/careeros-shared/types";

type Filter = "all" | RequirementAnalysis["group"];

const GROUP_TONE: Record<RequirementAnalysis["group"], Tone> = { matched: "success", strengthen: "warning", missing: "danger", review: "info" };
const STATUS_TEXT: Record<RequirementAnalysis["status"], string> = {
  demonstrated: "Demonstrated in experience",
  equivalent: "Related tool found",
  mentioned: "Only listed in skills/summary",
  missing: "Not found",
  insufficient: "Can't be judged automatically",
};

export default function ScoreTab() {
  const m = useModel();
  const { state, app } = m;
  const [filter, setFilter] = useState<Filter>("all");
  const [msg, setMsg] = useState("");
  const shared = state?.sharedProfile;
  const versions = state?.resumeVersions ?? [];
  const selectedId = app?.selectedResumeId || shared?.resumeVersionId || "";
  const analysis = analysisFor(state, app, selectedId);
  const overrides = (app ? m.ui.overrides[app.id] : undefined) ?? {};

  const setOverride = (reqId: string, value: Override | null) => {
    if (!app) return;
    m.updateUi((p) => {
      const forApp = { ...(p.overrides[app.id] ?? {}) };
      if (value) forApp[reqId] = value;
      else delete forApp[reqId];
      return { overrides: { ...p.overrides, [app.id]: forApp } };
    });
  };

  if (!app || !analysis) {
    return (
      <div className="stack">
        <Card id="score-empty" title="Résumé score" testId="score-empty">
          <div className="empty">
            <p className="empty-title">{!app ? "No job in CareerOS for this page" : "No analysis for this résumé yet"}</p>
            <p className="muted">
              {!app
                ? "Résumé scores come from the CareerOS matching engine, which analyzes the job description you've imported. Nothing is estimated here."
                : "CareerOS hasn't analyzed the selected résumé against this job. Open it in CareerOS and press Sync to send the analysis."}
            </p>
            <button type="button" className="btn btn-secondary btn-block" onClick={() => openUrl(app ? `${m.base}/autoapply?focus=${encodeURIComponent(app.id)}` : `${m.base}/autoapply`)}>
              Open CareerOS AutoApply
            </button>
          </div>
        </Card>
      </div>
    );
  }

  const counts = effectiveCounts(analysis.requirements, overrides);
  const visible = analysis.requirements.filter((r) => filter === "all" || r.group === filter);
  const q = analysis.quality;
  const exportReady = q.fitsOnePage && q.passed === q.total;

  const choose = async (versionId: string) => {
    const res = await dispatch("SET_SELECTED_RESUME", { applicationId: app.id, versionId });
    setMsg(res.ok ? "Résumé version changed." : res.error?.message ?? "Could not change version.");
    await m.refresh();
  };

  return (
    <div className="stack">
      <Card id="overview" title="Match overview" testId="score-overview" badge={<Badge tone="info">CareerOS estimate</Badge>}>
        <div className="match-head">
          <Gauge value={analysis.score} label={`Résumé match ${analysis.score} out of 100`} />
          <div>
            <p className="job-title" data-testid="score-value">{analysis.score}/100</p>
            <p className="meta">{analysis.resumeVersionName}</p>
          </div>
        </div>
        <p className="meta">An internal CareerOS estimate based on your résumé text and the requirements found in this job description. It is not an employer ATS score, and company names, locations and salary units aren’t counted as requirements.</p>
        {versions.length > 1 ? (
          <div className="field">
            <label htmlFor="score-resume" className="label">Résumé version</label>
            <select id="score-resume" className="input" value={selectedId} onChange={(e) => choose(e.target.value)}>
              {versions.map((v) => <option key={v.id} value={v.id}>{v.name}{v.kind === "tailored" ? " (tailored)" : ""}</option>)}
            </select>
            {msg ? <p className="meta" role="status">{msg}</p> : null}
          </div>
        ) : null}
        <dl className="facts">
          <div><dt>Required</dt><dd data-testid="score-required">{analysis.requiredCoverage.met} of {analysis.requiredCoverage.total} met</dd></div>
          <div><dt>Preferred</dt><dd data-testid="score-preferred">{analysis.preferredCoverage.met} of {analysis.preferredCoverage.total} met</dd></div>
          <div><dt>Verified matches</dt><dd>{counts.matched}</dd></div>
          <div><dt>Weak evidence</dt><dd>{counts.strengthen}</dd></div>
          <div><dt>Missing evidence</dt><dd>{counts.missing}</dd></div>
          <div><dt>Uncertain</dt><dd>{counts.review}</dd></div>
          {counts.notApplicable ? <div><dt>Marked N/A by you</dt><dd>{counts.notApplicable}</dd></div> : null}
          {counts.userConfirmed ? <div><dt>Confirmed by you</dt><dd>{counts.userConfirmed}</dd></div> : null}
        </dl>
        {counts.notApplicable || counts.userConfirmed ? (
          <p className="meta">Your marks change this view only. The score stays as CareerOS calculated it until the résumé itself changes.</p>
        ) : null}
      </Card>

      <Card id="reqs" title="Requirements" testId="score-requirements" badge={<Badge>{visible.length}</Badge>}>
        <div className="filters" role="tablist" aria-label="Filter requirements">
          {(["all", "matched", "strengthen", "missing", "review"] as Filter[]).map((f) => (
            <button key={f} type="button" role="tab" aria-selected={filter === f} className={`chip-btn ${filter === f ? "chip-btn-on" : ""}`} onClick={() => setFilter(f)}>
              {f === "all" ? "All" : GROUP_LABEL[f]}
            </button>
          ))}
        </div>
        <ul className="req-list">
          {visible.map((r) => {
            const o = overrides[r.id];
            return (
              <li key={r.id}>
                <details className="req" data-testid={`req-${r.id}`}>
                  <summary>
                    <span className="req-name">{r.name}</span>
                    <span className="req-tags">
                      <Badge tone="neutral">{r.kind}</Badge>
                      <Badge tone={o === "na" ? "neutral" : GROUP_TONE[r.group]}>{o === "na" ? "N/A" : o === "confirmed" && (r.group === "missing" || r.group === "review") ? "You confirmed" : GROUP_LABEL[r.group]}</Badge>
                    </span>
                  </summary>
                  <div className="req-body">
                    {r.excerpt ? <blockquote className="excerpt">“{r.excerpt}”<cite> — job description</cite></blockquote> : null}
                    <p><strong>{STATUS_TEXT[r.status]}.</strong> {r.explanation}</p>
                    {r.evidence.length ? (
                      <ul className="evidence">
                        {r.evidence.map((e, i) => <li key={i}><span className="meta">{e.section} · {e.label}</span><br />{e.text}</li>)}
                      </ul>
                    ) : <p className="meta">No supporting résumé evidence found.</p>}
                    {!r.scored ? <p className="meta">Low-confidence detection: CareerOS leaves this out of the score until you confirm it.</p> : null}
                    {o === "confirmed" ? <p className="meta">You said you have this skill. It is not on your résumé, so it doesn’t count as a qualification here.</p> : null}
                    <div className="btn-grid">
                      {r.group === "strengthen" || r.group === "matched" ? (
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => openUrl(`${m.base}/resume?tailorFor=${encodeURIComponent(app.id)}`)}>Improve résumé wording</button>
                      ) : null}
                      {r.group === "missing" ? (
                        <>
                          <button type="button" className="btn btn-secondary btn-sm" onClick={() => openUrl(`${m.base}/resume?tailorFor=${encodeURIComponent(app.id)}`)}>Add verified experience</button>
                          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setOverride(r.id, o === "confirmed" ? null : "confirmed")} data-testid={`confirm-${r.id}`}>{o === "confirmed" ? "Undo confirm" : "Confirm skill"}</button>
                        </>
                      ) : null}
                      {r.group === "review" ? (
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setOverride(r.id, o === "reviewed" ? null : "reviewed")}>{o === "reviewed" ? "Reopen" : "Mark reviewed"}</button>
                      ) : null}
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => setOverride(r.id, o === "na" ? null : "na")} data-testid={`na-${r.id}`}>{o === "na" ? "Undo N/A" : "Mark not applicable"}</button>
                    </div>
                  </div>
                </details>
              </li>
            );
          })}
          {visible.length === 0 ? <li className="muted">No requirements in this group.</li> : null}
        </ul>
      </Card>

      <Card id="quality" title="One-page résumé quality" testId="score-quality" badge={<Badge tone={exportReady ? "success" : "warning"}>{exportReady ? "Export ready" : "Needs attention"}</Badge>}>
        <p className="meta">Formatting checks, kept separate from the job-match score.</p>
        <dl className="facts">
          <div><dt>Page count</dt><dd data-testid="quality-pages">{q.pageCount} {q.pageCount === 1 ? "page" : "pages"}</dd></div>
          <div><dt>One-page fit</dt><dd>{q.fitsOnePage ? "Fits on one page" : "Overflows one page"}</dd></div>
          <div><dt>Checks passed</dt><dd>{q.passed} of {q.total}</dd></div>
        </dl>
        <ul className="checks">
          {q.checks.map((c) => (
            <li key={c.id} className={c.passed ? "ok" : "bad"}>
              <span aria-hidden>{c.passed ? "✓" : "✗"}</span>
              <span><strong>{c.label}</strong> <span className="sr-only">{c.passed ? "passed" : "needs attention"}.</span><br /><span className="meta">{c.detail}</span></span>
            </li>
          ))}
        </ul>
        {!exportReady ? <button type="button" className="btn btn-secondary btn-block" onClick={() => openUrl(`${m.base}/resume`)}>Fix in Résumé Studio</button> : null}
      </Card>
    </div>
  );
}
