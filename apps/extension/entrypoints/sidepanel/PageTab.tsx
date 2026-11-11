import { useCallback, useEffect, useState } from "react";
import { Badge, Banner, Card, type Tone } from "./ui";
import { useModel } from "./lib/context";
import { siteAccessDeps } from "./lib/bridge";
import { disableAssist, enableAssist, getAssistState, type AssistResult, type AssistState } from "../../src/page-intelligence/sitePermissions";
import { classifySite } from "../../src/page-intelligence/siteEligibility";
import { groupRequirements } from "../../src/page-intelligence/requirementGroups";
import { aiAvailability } from "./lib/ai";
import { computeLiveMatch, type LiveStatus } from "../../src/page-intelligence/liveMatch";
import type { JobConfidence } from "../../../../packages/careeros-shared/types";

const CONFIDENCE_TONE: Record<JobConfidence, Tone> = { high: "success", medium: "info", low: "warning" };
const CONFIDENCE_LABEL: Record<JobConfidence, string> = { high: "High confidence", medium: "Medium confidence", low: "Low confidence" };

/* ---------------- Page access ---------------- */

function PageAccessCard() {
  const m = useModel();
  const url = m.tab?.url;
  const [assist, setAssist] = useState<AssistState | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<AssistResult | null>(null);
  const deps = siteAccessDeps();

  const load = useCallback(async () => {
    if (!deps || !url) return setAssist(null);
    setAssist(await getAssistState(url, deps));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  useEffect(() => {
    setResult(null);
    void load();
  }, [load]);

  // Chrome's own prompt only appears for a click, so this handler asks for access first thing.
  const turnOn = () => {
    if (!deps || busy) return;
    setBusy(true);
    void enableAssist(url, deps)
      .then(async (r) => {
        setResult(r);
        await load();
        if (r.ok) await m.refresh();
      })
      .finally(() => setBusy(false));
  };
  const turnOff = () => {
    if (!deps || busy) return;
    setBusy(true);
    void disableAssist(url, deps)
      .then(async (r) => {
        setResult(r);
        await load();
        await m.refresh();
      })
      .finally(() => setBusy(false));
  };

  const access = classifySite(url);
  const read = m.read;
  const readNote = !url
    ? "Open a job page in this window and CareerOS will look at it."
    : read && !read.ok
      ? read.message
      : null;

  let badge = <Badge tone="neutral">Checking</Badge>;
  let body: JSX.Element | null = null;
  if (!url) {
    badge = <Badge tone="neutral">No page</Badge>;
  } else if (access.status !== "ok") {
    badge = <Badge tone="neutral">Not available</Badge>;
    body = <p className="muted" data-testid="access-message">{access.message}</p>;
  } else if (!assist) {
    body = <p className="muted">{deps ? "Checking access…" : "Access controls are only available inside the installed extension."}</p>;
  } else if (assist.kind === "always") {
    badge = <Badge tone="success">Always on for this site</Badge>;
    body = (
      <>
        <p data-testid="access-message">{assist.message}</p>
        <button type="button" className="btn btn-secondary" onClick={turnOff} disabled={busy} data-testid="access-off">
          Turn off for this site
        </button>
      </>
    );
  } else if (assist.kind === "built-in") {
    badge = <Badge tone="info">Included</Badge>;
    body = <p data-testid="access-message">{assist.message} You can remove it in Chrome’s extension settings.</p>;
  } else if (assist.kind === "limited") {
    badge = <Badge tone="warning">Limited</Badge>;
    body = <p data-testid="access-message">{assist.message}</p>;
  } else if (assist.kind === "page-only") {
    badge = <Badge tone="neutral">This page only</Badge>;
    body = (
      <>
        <p data-testid="access-message">{assist.message}</p>
        <p className="meta">Turning on ongoing access asks Chrome for permission for {access.hostname} only. You can turn it off any time.</p>
        <button type="button" className="btn btn-primary" onClick={turnOn} disabled={busy} data-testid="access-on">
          Always assist on this site
        </button>
      </>
    );
  } else {
    body = <p className="muted" data-testid="access-message">{assist.message}</p>;
  }

  return (
    <Card id="access" title="Page access" badge={badge}>
      {body}
      {readNote && access.status === "ok" ? <p className="meta" data-testid="read-note">{readNote}</p> : null}
      <div aria-live="polite" data-testid="access-result">
        {result ? <Banner tone={result.ok ? "success" : result.reason === "denied" ? "warning" : "danger"}>{result.message}</Banner> : null}
      </div>
    </Card>
  );
}

/* ---------------- Job intelligence ---------------- */

function JobCard() {
  const m = useModel();
  const page = m.page;
  const job = page?.job;
  const intel = page?.intelligence;
  const frames = page?.embeddedFrames ?? [];
  const grouped = groupRequirements(intel?.requirements ?? []);
  const total = grouped.reduce((n, g) => n + g.items.length, 0);

  if (!m.readable || !page) return null;
  if (!job && !intel) {
    return (
      <Card id="job" title="This page">
        <p className="muted" data-testid="job-none">CareerOS didn’t find a job posting on this page.</p>
        {frames.length ? <EmbeddedNotice /> : null}
      </Card>
    );
  }
  const facts: Array<[string, string | null | undefined, string]> = [
    ["Company", job?.company, "company"],
    ["Location", job?.location, "location"],
    ["Work", job?.workArrangement, "workArrangement"],
    ["Type", job?.employmentType, "employmentType"],
    ["Salary", job?.salary, "salary"],
    ["Job ID", job?.jobId, "jobId"],
  ];
  return (
    <Card
      id="job"
      title="Job"
      badge={intel ? <Badge tone={CONFIDENCE_TONE[intel.confidence]}>{CONFIDENCE_LABEL[intel.confidence]}</Badge> : undefined}
    >
      <div data-testid="job-card">
        <p className="job-title" data-testid="job-title">{job?.title || "Title not found on this page"}</p>
        <dl className="facts">
          {facts.map(([label, value, key]) =>
            value ? (
              <div key={label} className="fact">
                <dt>{label}</dt>
                <dd data-testid={`job-${label.toLowerCase().replace(/\s/g, "-")}`} title={job?.sources[key] ? `Read from: ${job.sources[key]}` : undefined}>{value}</dd>
              </div>
            ) : null,
          )}
        </dl>
        {job && !job.company && !job.location && !job.salary ? <p className="meta">Company, location, and salary weren’t stated on the page, so CareerOS leaves them blank.</p> : null}
        {job?.closedEvidence ? <Banner tone="warning">This posting may be closed: “{job.closedEvidence}”</Banner> : null}
        {intel ? (
          <details className="why">
            <summary>Why {CONFIDENCE_LABEL[intel.confidence].toLowerCase()}?</summary>
            <ul>
              {intel.confidenceReasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
            {intel.descriptionSource ? <p className="meta">Description read from {intel.descriptionSource} ({intel.descriptionChars.toLocaleString()} characters).</p> : null}
          </details>
        ) : null}
        {grouped.length ? (
          <details className="why" data-testid="requirements">
            <summary>{total} requirements and duties found</summary>
            {grouped.map((group) => (
              <section key={group.id} className="req-group" aria-label={group.title} data-testid={`req-group-${group.id}`}>
                <h3 className="sub-title">{group.title}</h3>
                <ul className="reqs">
                  {group.items.slice(0, 30).map((item) => (
                    <li key={item.label}>
                      <span className={group.id === "responsibilities" ? "" : "req-term"}>{item.label}</span>
                      {item.importance ? <Badge tone={item.importance === "required" ? "info" : "neutral"}>{item.importance === "mentioned" ? "In duties" : item.importance === "required" ? "Required" : "Preferred"}</Badge> : null}
                      {item.evidence ? <blockquote className="meta">{item.evidence}</blockquote> : null}
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </details>
        ) : null}
        {frames.length ? <EmbeddedNotice /> : null}
      </div>
    </Card>
  );
}

function EmbeddedNotice() {
  const m = useModel();
  const frames = m.page?.embeddedFrames ?? [];
  if (!frames.length) return null;
  return (
    <Banner tone="info" testId="embedded-notice">
      The application form is hosted by {frames.map((f) => f.platformLabel || f.host).join(", ")} in a frame. Chrome keeps pages from different sites separate, so CareerOS can’t read or fill it from here. Open the form in its own tab to use autofill.
      {frames[0]?.url ? (
        <>
          {" "}
          <span className="meta">({frames[0].host})</span>
        </>
      ) : null}
    </Banner>
  );
}

/* ---------------- Live match ---------------- */

const STATUS_TONE: Record<LiveStatus, Tone> = { matched: "success", partial: "warning", missing: "danger", uncertain: "info" };
const STATUS_LABEL: Record<LiveStatus, string> = { matched: "Matched", partial: "Partial", missing: "Missing", uncertain: "Uncertain" };

function MatchCard() {
  const m = useModel();
  if (!m.readable || !m.page?.intelligence) return null;
  const match = computeLiveMatch(m.page.intelligence, m.state?.sharedProfile ?? null);
  if (!match.ready) {
    return (
      <Card id="live-match" title="Résumé match">
        <p className="muted" data-testid="match-unavailable">{match.reason}</p>
      </Card>
    );
  }
  return (
    <Card id="live-match" title="Résumé match" badge={<Badge tone="neutral">Estimate</Badge>}>
      <div data-testid="match-card">
        <p className="match-figure">
          <span className="match-number" data-testid="match-percent" aria-label={`${match.percent} percent estimated match`}>{match.percent}%</span>
          <span className="meta"> estimated match</span>
        </p>
        <p className="meta">{match.note}</p>
        <p className="meta" data-testid="match-counts">
          {match.counts.matched} matched · {match.counts.partial} partial · {match.counts.missing} missing · {match.counts.uncertain} uncertain
        </p>
        <ul className="reqs" data-testid="match-list">
          {match.results.map((r) => (
            <li key={`${r.term}-${r.kind}`}>
              <details>
                <summary>
                  <span className="req-term">{r.term}</span> <Badge tone={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}</Badge>
                </summary>
                <p>{r.rationale}</p>
                {r.evidence.length ? <p className="meta">Your profile: {r.evidence.join("; ")}</p> : null}
                {r.jobEvidence ? <blockquote className="meta">Job: {r.jobEvidence}</blockquote> : null}
              </details>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}

/** Shortcuts into the Ask tab. They use the approved connection and never switch to a cloud model. */
function AiQuickActions() {
  const m = useModel();
  if (!m.readable || !m.page?.job?.description) return null;
  const ai = aiAvailability(m.state?.aiConnection ?? null);
  const go = (pendingAction: NonNullable<typeof m.ui.pendingAction>) => m.updateUi({ tab: "ask", pendingAction });
  if (ai.kind !== "ready") {
    return (
      <Card id="ai-actions" title="AI help">
        <p className="muted" data-testid="ai-actions-unavailable">{ai.reason}</p>
        <button type="button" className="btn btn-secondary" onClick={() => m.updateUi({ tab: "ai" })} data-testid="ai-actions-connect">Connect AI</button>
      </Card>
    );
  }
  return (
    <Card id="ai-actions" title="AI help" badge={<Badge tone="success">On this device</Badge>}>
      <div className="row" role="group" aria-label="AI actions for this job">
        <button type="button" className="btn btn-primary" onClick={() => go("qualify")} data-testid="quick-analyze">Analyze with AI</button>
        <button type="button" className="btn btn-secondary" onClick={() => go("improve")} data-testid="quick-improve">Improve My Résumé</button>
        <button type="button" className="btn btn-secondary" onClick={() => go("answers")} data-testid="quick-answers">Help With Application</button>
      </div>
    </Card>
  );
}

export default function PageTab() {
  return (
    <div className="stack" data-testid="page-tab">
      <PageAccessCard />
      <JobCard />
      <AiQuickActions />
      <MatchCard />
    </div>
  );
}
