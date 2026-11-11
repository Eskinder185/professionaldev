import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Check,
  Eye,
  FileText,
  Loader2,
  Play,
  Sparkles,
  Wand2,
} from "lucide-react";
import { isDomainAllowedForAutofill } from "../../src/security/permissions";
import type {
  AutofillRunResult,
  AutofillRunState,
  DetectedField,
} from "../../../../packages/careeros-shared/types";
import { Badge, Banner, Card, Gauge, Modal, Progress, type Tone } from "./ui";
import { useModel } from "./lib/context";
import { allowDomain, dispatch, focusTab, openUrl } from "./lib/bridge";
import { autoFillableIds, classifyField, fillSingleField, highlightOnPage, startAutofill, type RunHandle } from "./lib/autofill";
import { activeRun, analysisFor, effectiveCounts, initials } from "./lib/model";
import { aiAvailability, buildCoverLetterContext, draftCoverLetter } from "./lib/ai";
import { checkSensitiveField } from "../../../../packages/careeros-shared/adapters";
import { questionContext, draftQuestionAnswer } from "./lib/questionAI";
import { effectiveExtensionModel } from "../../src/ai/localConnection";

const STATUS_META: Record<AutofillRunResult["status"], { label: string; tone: Tone; group: string }> = {
  filled: { label: "Filled & verified", tone: "success", group: "Fields filled successfully" },
  confirm: { label: "Needs your confirmation", tone: "warning", group: "Fields needing confirmation" },
  missing: { label: "Missing information", tone: "danger", group: "Fields missing information" },
  failed: { label: "Value not kept by the page", tone: "danger", group: "Fields that failed verification" },
  unsupported: { label: "Unsupported", tone: "neutral", group: "Unsupported fields" },
  manual: { label: "You answer this", tone: "info", group: "Manual-only fields" },
  file: { label: "Attach manually", tone: "warning", group: "File uploads" },
};
const GROUP_ORDER: AutofillRunResult["status"][] = ["filled", "confirm", "failed", "missing", "file", "manual", "unsupported"];

export default function AutofillTab({ runner }: { runner: RunnerApi }) {
  const m = useModel();
  const { page, state, ui } = m;
  const run = activeRun(state, runner.localRun, page?.url, runner.running);

  const banners = computeBanners(m, run);
  const reviewRef = useRef<HTMLDivElement>(null);

  const dismiss = (key: string) => m.updateUi((p) => ({ dismissed: [...p.dismissed, key] }));
  const collapsed = (id: string) => Boolean(ui.collapsed[id]);
  const toggle = (id: string) => m.updateUi((p) => ({ collapsed: { ...p.collapsed, [id]: !p.collapsed[id] } }));

  return (
    <div className="stack">
      {banners.map((b) =>
        ui.dismissed.includes(b.key) ? null : (
          <Banner key={b.key} tone={b.tone} critical={b.critical} testId={`banner-${b.id}`} onDismiss={b.critical ? undefined : () => dismiss(b.key)}>
            {b.text}
          </Banner>
        ),
      )}

      <JobCard />
      <StartBlock runner={runner} run={run} onReview={() => reviewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })} />
      <div ref={reviewRef}>
        <ReviewSection run={run} />
      </div>

      <ResumeCard collapsed={collapsed("resume")} onToggle={() => toggle("resume")} />
      <CoverLetterCard collapsed={collapsed("cover")} onToggle={() => toggle("cover")} />
      <QuestionAssistantCard />
    </div>
  );
}

export interface RunnerApi {
  localRun: AutofillRunState | null;
  running: boolean;
  start: () => void;
  cancel: () => void;
}

/** Owns the autofill run so it survives tab switches within the panel. */
export function useRunner(): RunnerApi {
  const m = useModel();
  const [localRun, setLocalRun] = useState<AutofillRunState | null>(null);
  const handle = useRef<RunHandle | null>(null);
  const [running, setRunning] = useState(false);

  const start = useCallback(() => {
    if (handle.current || !m.tab || !m.page) return;
    const h = startAutofill({
      tab: m.tab,
      page: m.page,
      profile: m.state?.sharedProfile ?? null,
      app: m.app,
      onUpdate: setLocalRun,
    });
    handle.current = h;
    setRunning(true);
    void h.done.then(async () => {
      handle.current = null;
      setRunning(false);
      await m.refresh();
    });
  }, [m]);

  const cancel = useCallback(() => handle.current?.cancel(), []);
  return { localRun, running, start, cancel };
}

interface BannerSpec {
  id: string;
  key: string;
  tone: Tone;
  text: string;
  critical?: boolean;
}

function computeBanners(m: ReturnType<typeof useModel>, run: AutofillRunState | null): BannerSpec[] {
  const out: BannerSpec[] = [];
  const page = m.page;
  if (!page || m.loading) return out;
  const host = page.hostname;

  if (run && (run.phase === "inspecting" || run.phase === "filling" || run.phase === "verifying")) {
    const where = page.platform === "generic" || page.platform === "unsupported" ? "this page" : `this ${page.platformLabel.split(" ")[0]} page`;
    out.push({ id: "running", key: `running:${run.runId}`, tone: "info", critical: true, text: `Stay on ${where} while CareerOS fills the form.` });
    return out;
  }
  if (run?.phase === "done") {
    out.push({ id: "done", key: `done:${run.runId}`, tone: "success", critical: true, text: "Autofill completed. Review the highlighted fields before you submit." });
  } else if (run?.phase === "failed") {
    out.push({ id: "failed", key: `failed:${run.runId}`, tone: "danger", critical: true, text: run.error ?? "Autofill stopped before finishing." });
  } else if (run?.phase === "cancelled") {
    out.push({ id: "cancelled", key: `cancelled:${run.runId}`, tone: "warning", text: "Autofill was cancelled. Fields filled so far are listed below." });
  }

  if (!m.readable) {
    out.push({ id: "unreadable", key: `unreadable:${host}`, tone: "warning", critical: true, text: m.read && !m.read.ok ? m.read.message : "CareerOS can't read this page." });
    return out;
  }
  if (page.needsSignIn) {
    out.push({ id: "signin", key: `signin:${host}`, tone: "warning", critical: true, text: "Sign in to continue this application. CareerOS never enters passwords." });
  }
  if (page.confirmed) {
    out.push({ id: "confirmed", key: `confirmed:${page.url}`, tone: "success", text: "This page shows an application confirmation. CareerOS did not submit it." });
  }
  if (page.job?.closedEvidence) {
    out.push({ id: "closed", key: `closed:${page.url}`, tone: "warning", text: `This posting says: “${page.job.closedEvidence}”.` });
  }
  const named = page.platform !== "generic" && page.platform !== "unsupported";
  if (named && page.fields.length > 0 && !run) {
    out.push({ id: "platform", key: `platform:${page.platform}:${host}`, tone: "info", text: `${page.platformLabel.replace(/ \(.*/, "")} application detected.` });
  } else if (named && page.fields.length === 0 && !page.needsSignIn && !page.confirmed) {
    out.push({ id: "platform-nofields", key: `pnf:${page.platform}:${host}`, tone: "info", text: `${page.platformLabel.replace(/ \(.*/, "")} page detected, but no application form is showing yet.` });
  }
  if (page.platform === "unsupported") {
    out.push({ id: "unsupported", key: `unsupported:${host}`, tone: "warning", text: "This platform is gated or not supported. Use your CareerOS checklist and apply manually." });
  }
  if (!m.state?.sharedProfile) {
    out.push({ id: "noprofile", key: "noprofile", tone: "warning", critical: true, text: "No profile has been shared yet. Open CareerOS → AutoApply and press Sync to enable autofill." });
  }
  return out;
}

/* ---------------------------- Job card ---------------------------- */

function JobCard() {
  const m = useModel();
  const { page } = m;
  if (m.loading && !page) {
    return (
      <Card id="job" title="Job">
        <p className="muted" role="status">Reading this page…</p>
      </Card>
    );
  }
  const job = page?.job;
  if (!job) return <EmptyJob />;
  return (
    <Card id="job" title="Job" testId="job-card" badge={<Badge tone="info">{page!.platformLabel.replace(/ \(.*/, "")}</Badge>}>
      <div className="job">
        <div className="avatar" aria-hidden>{initials(job.company || job.title)}</div>
        <div className="job-main">
          <p className="job-title" data-testid="job-title">{job.title || "Untitled role"}</p>
          <p className="job-company" data-testid="job-company">{job.company || "Company not detected"}</p>
        </div>
      </div>
      <dl className="facts">
        <div><dt>Location</dt><dd data-testid="job-location-value">{job.location || "Not listed on the page"}</dd></div>
        <div><dt>Platform</dt><dd>{page!.platformLabel}</dd></div>
        {job.salary ? <div><dt>Salary</dt><dd data-testid="job-salary-value">{job.salary}</dd></div> : null}
        <div>
          <dt>Status</dt>
          <dd data-testid="job-status">
            {job.closedEvidence ? <Badge tone="warning">Page says it is closed</Badge> : <span className="muted">Not verified</span>}
          </dd>
        </div>
      </dl>
      {Object.keys(job.sources).length ? (
        <p className="meta">Detected from: {Array.from(new Set(Object.values(job.sources))).join(", ")}</p>
      ) : null}
    </Card>
  );
}

function EmptyJob() {
  const m = useModel();
  const { page } = m;
  const url = page?.url ?? "";
  const hasForm = (page?.fields.length ?? 0) > 0;
  return (
    <Card id="job" title="Job" testId="job-empty">
      <div className="empty">
        <div className="empty-art" aria-hidden><FileText size={26} /></div>
        <p className="empty-title">{hasForm ? "Application form found, job details unavailable" : "No supported job detected"}</p>
        <p className="muted">
          {hasForm
            ? "CareerOS can still fill this form, but it couldn't read a job title or company from the page."
            : m.readable
              ? "Open a job posting or application page (Greenhouse, Lever, Ashby, Workday or a standard form) in this window."
              : "CareerOS can only read pages after you open it on them."}
        </p>
        <button
          type="button"
          className="btn btn-secondary btn-block"
          data-testid="btn-import-job"
          onClick={() => openUrl(`${m.base}/autoapply${/^https?:/.test(url) ? `?import=${encodeURIComponent(url)}` : ""}`)}
        >
          Import this job into CareerOS
        </button>
      </div>
    </Card>
  );
}

/* ------------------------ Start Autofill block ------------------------ */

function StartBlock({ runner, run, onReview }: { runner: RunnerApi; run: AutofillRunState | null; onReview: () => void }) {
  const m = useModel();
  const { page, state } = m;
  const host = page?.hostname ?? "";
  const domainOk = Boolean(page?.url && state && isDomainAllowedForAutofill(page.url, state.allowedDomains));
  const fillable = page ? autoFillableIds(page.fields).length : 0;

  let blocker: string | null = null;
  if (!m.readable || !page) blocker = "CareerOS can't read this page.";
  else if (page.platform === "unsupported") blocker = "This platform is not supported for autofill.";
  else if (!state?.sharedProfile) blocker = "Sync a profile from CareerOS first.";
  else if (page.fields.length === 0) blocker = "No application form fields were found on this page.";
  else if (page.needsSignIn) blocker = "Sign in first, then reopen this panel.";
  else if (page.confirmed) blocker = "This application is already confirmed.";
  else if (fillable === 0) blocker = "Nothing is ready to fill. Review the missing information below.";

  const running = runner.running;
  const phaseActive = run && (run.phase === "inspecting" || run.phase === "filling" || run.phase === "verifying");

  if (!domainOk && page && m.readable && !blocker) {
    return (
      <div className="stack-sm">
        <Banner tone="warning" critical testId="banner-domain">
          Autofill is off for <strong>{host}</strong>. Allow CareerOS to fill forms on this site?
        </Banner>
        <button type="button" className="btn btn-secondary btn-block" data-testid="btn-allow-domain" onClick={async () => { await allowDomain(host); await m.refresh(); }}>
          Allow autofill on {host}
        </button>
      </div>
    );
  }

  if (running || phaseActive) {
    return (
      <div className="card card-flat" data-testid="autofill-progress">
        <div className="row-between">
          <strong>Autofilling…</strong>
          <span className="meta" aria-live="polite">{run ? `${Math.min(run.processed, run.total)} of ${run.total}` : ""}</span>
        </div>
        <Progress value={run?.processed ?? 0} max={Math.max(run?.total ?? 1, 1)} label="Autofill progress" />
        <p className="meta" role="status" data-testid="autofill-step">{run?.step ?? "Starting"}</p>
        <button type="button" className="btn btn-secondary btn-block" data-testid="btn-cancel-autofill" onClick={runner.cancel}>
          Cancel
        </button>
      </div>
    );
  }

  const finished = run && (run.phase === "done" || run.phase === "cancelled");
  return (
    <div className="stack-sm">
      {finished ? (
        <button
          type="button"
          className="btn btn-primary btn-block btn-lg"
          data-testid="btn-review-application"
          onClick={async () => {
            onReview();
            if (m.tab) {
              await highlightOnPage(
                m.tab,
                (page?.fields ?? []).map((f) => ({ selector: f.selector, status: statusOfField(f, run) })).filter((x) => x.status !== "unsupported"),
              );
              await focusTab(m.tab.id);
            }
          }}
        >
          <Eye size={18} aria-hidden /> Review Application
        </button>
      ) : null}
      <button
        type="button"
        className={`btn ${finished ? "btn-secondary" : "btn-primary"} btn-block btn-lg`}
        data-testid="btn-start-autofill"
        disabled={Boolean(blocker)}
        aria-describedby={blocker ? "start-blocker" : undefined}
        onClick={runner.start}
      >
        <Play size={18} aria-hidden /> {finished ? "Run Autofill Again" : "Start Autofill"}
      </button>
      {blocker ? (
        <p id="start-blocker" className="meta" data-testid="start-blocker">{blocker}</p>
      ) : (
        <p className="meta">Fills only fields CareerOS can verify. You review and submit the application yourself.</p>
      )}
    </div>
  );
}

function statusOfField(f: DetectedField, run: AutofillRunState | null): AutofillRunResult["status"] {
  const hit = run?.results.find((r) => r.fieldId === f.id);
  return (hit ?? classifyField(f)).status;
}

/* --------------------------- Review results --------------------------- */

function ReviewSection({ run }: { run: AutofillRunState | null }) {
  const m = useModel();
  const page = m.page;
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});

  const rows: Array<AutofillRunResult & { field?: DetectedField }> = useMemo(() => {
    if (run && (run.phase === "done" || run.phase === "cancelled") && run.results.length) {
      return run.results.map((r) => ({ ...r, field: page?.fields.find((f) => f.id === r.fieldId) }));
    }
    return (page?.fields ?? []).map((f) => ({ ...classifyField(f), field: f }));
  }, [run, page]);

  if (!page || !m.readable || rows.length === 0) return null;
  const finished = Boolean(run && (run.phase === "done" || run.phase === "cancelled"));
  // Live view of what the page is complaining about right now (a stale snapshot would mislead).
  const issues = page.validationIssues;

  const fillOne = async (r: AutofillRunResult) => {
    if (!m.tab) return;
    const value = edits[r.fieldId] ?? r.insertedValue ?? "";
    const res = await fillSingleField({ tab: m.tab, fieldId: r.fieldId, value, profile: m.state?.sharedProfile ?? null, app: m.app });
    setNotes((n) => ({ ...n, [r.fieldId]: res.message }));
    await m.refresh();
  };

  return (
    <Card id="review" title={finished ? "Autofill results" : "Form preview"} testId="review-section" badge={<Badge>{rows.length} fields</Badge>}>
      {finished ? (
        <p className="meta" role="status" data-testid="review-summary">
          {rows.filter((r) => r.status === "filled").length} verified · {rows.filter((r) => r.status === "confirm").length} to confirm · {rows.filter((r) => r.status === "missing" || r.status === "failed").length} need attention
        </p>
      ) : (
        <p className="meta">What CareerOS found on the form. Nothing has been filled yet.</p>
      )}
      {issues.length ? (
        <div className="validation" role="alert" data-testid="validation-issues">
          <strong><AlertTriangle size={14} aria-hidden /> Form validation issues</strong>
          <ul>{issues.map((i) => <li key={i}>{i}</li>)}</ul>
        </div>
      ) : null}
      {GROUP_ORDER.map((status) => {
        const group = rows.filter((r) => r.status === status);
        if (!group.length) return null;
        const meta = STATUS_META[status];
        return (
          <div key={status} className="group" data-testid={`group-${status}`}>
            <h3 className="group-title">{meta.group} <span className="count">{group.length}</span></h3>
            <ul className="field-list">
              {group.map((r) => (
                <li key={r.fieldId} className="field-row" data-testid={`field-${r.fieldId}`}>
                  <div className="row-between">
                    <span className="field-label">{r.label}{r.field?.required && !r.label.trim().endsWith("*") ? <span aria-label="required"> *</span> : null}</span>
                    <Badge tone={meta.tone}>{meta.label}</Badge>
                  </div>
                  {r.status === "filled" && (r.readBack || r.insertedValue) ? (
                    <p className="field-value" data-testid={`readback-${r.fieldId}`}>Page now shows: <code>{r.readBack ?? r.insertedValue}</code></p>
                  ) : null}
                  {r.status === "failed" ? <p className="field-value">Inserted <code>{r.insertedValue}</code>, page shows <code>{r.readBack || "(empty)"}</code>.</p> : null}
                  {r.note ? <p className="meta">{r.note}</p> : null}
                  {r.status === "confirm" && r.field && r.field.inputType !== "file" ? (
                    <div className="inline-edit">
                      <label className="sr-only" htmlFor={`edit-${r.fieldId}`}>Value for {r.label}</label>
                      <input id={`edit-${r.fieldId}`} className="input" value={edits[r.fieldId] ?? r.insertedValue ?? ""} onChange={(e) => setEdits((s) => ({ ...s, [r.fieldId]: e.target.value }))} />
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => fillOne(r)} data-testid={`fill-${r.fieldId}`}>Fill this field</button>
                    </div>
                  ) : null}
                  {notes[r.fieldId] ? <p className="meta" role="status">{notes[r.fieldId]}</p> : null}
                </li>
              ))}
            </ul>
          </div>
        );
      })}
      {finished ? (
        <p className="meta">CareerOS never clicks the employer’s Submit button. Submit it yourself when you’re satisfied.</p>
      ) : null}
    </Card>
  );
}

/* ----------------------------- Résumé card ----------------------------- */

function ResumeCard({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const m = useModel();
  const { state, app } = m;
  const shared = state?.sharedProfile ?? null;
  const [preview, setPreview] = useState(false);
  const [msg, setMsg] = useState("");
  const versions = state?.resumeVersions ?? [];
  const selectedId = app?.selectedResumeId || shared?.resumeVersionId || "";
  const selected = versions.find((v) => v.id === selectedId);
  const name = selected?.name ?? (selectedId && selectedId === shared?.resumeVersionId ? shared?.resumeVersionName : undefined) ?? app?.selectedResumeName ?? shared?.resumeVersionName ?? "";
  const fileName = selectedId && selectedId === shared?.resumeVersionId && shared?.resumeFileName ? shared.resumeFileName : name ? `${name.replace(/[^a-zA-Z0-9_-]+/g, "_")}.pdf` : "";
  const analysis = analysisFor(state, app, selectedId);
  const overrides = app ? m.ui.overrides[app.id] : undefined;
  const counts = analysis ? effectiveCounts(analysis.requirements, overrides) : null;
  const supported = analysis ? analysis.requiredCoverage.met + analysis.preferredCoverage.met : 0;
  const total = analysis ? analysis.requiredCoverage.total + analysis.preferredCoverage.total : 0;

  const choose = async (versionId: string) => {
    if (!app) return;
    const res = await dispatch("SET_SELECTED_RESUME", { applicationId: app.id, versionId });
    setMsg(res.ok ? "Résumé version changed for this application." : res.error?.message ?? "Could not change version.");
    await m.refresh();
  };

  const canPreviewText = Boolean(shared?.resumePlainText && selectedId === shared.resumeVersionId);

  return (
    <Card
      id="resume"
      title="Résumé"
      testId="resume-card"
      collapsible
      collapsed={collapsed}
      onToggle={onToggle}
      badge={analysis ? <Badge tone={analysis.score >= 70 ? "success" : analysis.score >= 40 ? "warning" : "danger"}>{analysis.score}/100</Badge> : <Badge>No analysis</Badge>}
    >
      <div className="resume-file">
        <FileText size={20} aria-hidden />
        <div className="resume-file-main">
          <p className="job-title" data-testid="resume-filename">{fileName || "No résumé selected"}</p>
          <p className="meta" data-testid="resume-version">{name ? `Version: ${name}` : "Sync from CareerOS to choose a résumé."}</p>
        </div>
        <button type="button" className="icon-btn" aria-label="Preview résumé" title="Preview résumé" data-testid="btn-preview-resume" onClick={() => setPreview(true)} disabled={!name}>
          <Eye size={16} aria-hidden />
        </button>
      </div>

      <div className="field">
        <label htmlFor="resume-select" className="label">Change résumé</label>
        <select id="resume-select" className="input" data-testid="resume-select" value={versions.some((v) => v.id === selectedId) ? selectedId : ""} disabled={!app || versions.length === 0} onChange={(e) => choose(e.target.value)}>
          {!versions.some((v) => v.id === selectedId) ? <option value="">{name || "No versions synced"}</option> : null}
          {versions.map((v) => (
            <option key={v.id} value={v.id}>{v.name}{v.kind === "tailored" ? " (tailored)" : ""}{v.fitsOnePage ? "" : " – over 1 page"}</option>
          ))}
        </select>
        {!app ? <p className="meta">Import this job into CareerOS to pick a version for it.</p> : null}
        {msg ? <p className="meta" role="status">{msg}</p> : null}
      </div>

      {analysis && counts ? (
        <div className="match" data-testid="match-block">
          <div className="match-head">
            <Gauge value={analysis.score} label={`Résumé match ${analysis.score} out of 100`} />
            <div>
              <p className="job-title" data-testid="match-score">Résumé match: {analysis.score}/100</p>
              <p className="meta" data-testid="match-support">{supported} of {total} confirmed requirements supported</p>
            </div>
          </div>
          <div className="chips" data-testid="match-breakdown">
            <Badge tone="success">{counts.matched} verified</Badge>
            <Badge tone="warning">{counts.strengthen} weak evidence</Badge>
            <Badge tone="danger">{counts.missing} missing</Badge>
            <Badge tone="info">{counts.review} uncertain</Badge>
          </div>
          <p className="meta">This is a CareerOS internal matching estimate from your résumé text, not an employer ATS score. Analyzed {new Date(analysis.analyzedAt).toLocaleString()}.</p>
          <button type="button" className="btn btn-link" onClick={() => m.updateUi({ tab: "score" })}>See requirement details →</button>
        </div>
      ) : (
        <div className="notice" data-testid="match-empty">
          <p>
            {!app
              ? "No résumé match yet. Import this job into CareerOS so it can be analyzed against your résumé."
              : "CareerOS hasn’t analyzed this résumé against this job yet. Open it in CareerOS and press Sync."}
          </p>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => openUrl(app ? `${m.base}/autoapply?focus=${encodeURIComponent(app.id)}` : `${m.base}/autoapply`)}>
            Open CareerOS AutoApply
          </button>
        </div>
      )}

      <button
        type="button"
        className="btn btn-accent btn-block"
        data-testid="btn-tailor-resume"
        disabled={!app}
        onClick={() => app && openUrl(`${m.base}/resume?tailorFor=${encodeURIComponent(app.id)}`)}
      >
        <Wand2 size={16} aria-hidden /> Tailor Résumé
      </button>
      <p className="meta">Opens Résumé Studio with a separate draft for this job. Your Master Profile is never changed, and you accept or reject each suggestion.</p>

      {preview ? (
        <Modal title={`Preview: ${name}`} onClose={() => setPreview(false)} testId="resume-preview">
          {canPreviewText ? (
            <pre className="preview-text" data-testid="resume-preview-text">{shared!.resumePlainText}</pre>
          ) : (
            <div className="stack-sm">
              <p>The text of this version hasn’t been shared with the extension. Open it in Résumé Studio to preview the exact one-page layout.</p>
              <button type="button" className="btn btn-secondary" onClick={() => openUrl(`${m.base}/resume`)}>Open Résumé Studio</button>
            </div>
          )}
        </Modal>
      ) : null}
    </Card>
  );
}

/* --------------------------- Cover letter card --------------------------- */

function CoverLetterCard({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const m = useModel();
  const { page, state, app, ui } = m;
  const key = app?.id ?? (page?.hostname || "page");
  const draft = ui.coverDrafts[key] ?? { text: "", aiDrafted: false, reviewed: false };
  const [text, setText] = useState(draft.text);
  const [aiDrafted, setAiDrafted] = useState(draft.aiDrafted);
  const [reviewed, setReviewed] = useState(draft.reviewed);
  const [showPreview, setShowPreview] = useState(false);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    const d = m.ui.coverDrafts[key] ?? { text: "", aiDrafted: false, reviewed: false };
    setText(d.text);
    setAiDrafted(d.aiDrafted);
    setReviewed(d.reviewed);
    setWarnings([]);
    setMessage("");
    // Switching job resets the editor to that job's saved draft (intentionally keyed on `key` only).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const persist = (next: { text: string; aiDrafted: boolean; reviewed: boolean }) =>
    m.updateUi((p) => ({ coverDrafts: { ...p.coverDrafts, [key]: next } }));

  const cover = page?.coverLetter ?? { state: "none" as const, field: null };
  const inserted = Boolean(cover.field && cover.field.inputType !== "file" && cover.field.currentDomValue.trim());
  const prepared = text.trim().length > 0 && (!aiDrafted || reviewed);
  const analysis = analysisFor(state, app, app?.selectedResumeId || state?.sharedProfile?.resumeVersionId);
  const ai = aiAvailability(state?.aiConnection ?? null);

  const statusBadge = inserted ? <Badge tone="success">Cover letter inserted</Badge> : prepared ? <Badge tone="success">Cover letter prepared</Badge> : cover.state === "required" ? <Badge tone="warning">Cover letter needed</Badge> : cover.state === "optional" ? <Badge tone="info">Cover letter optional</Badge> : cover.state === "file-only" ? <Badge tone="warning">Upload field</Badge> : <Badge>No cover letter field</Badge>;

  const ctx = state?.sharedProfile && ai.kind === "ready" ? buildCoverLetterContext({ job: page?.job ?? null, profile: state.sharedProfile, analysis }) : null;

  const generate = async () => {
    if (ai.kind !== "ready" || !ctx) return;
    setConsent(false);
    setBusy(true);
    setMessage("");
    abort.current = new AbortController();
    try {
      const out = await draftCoverLetter(ai, ctx.prompt, ctx.grounding, abort.current.signal);
      setText(out.text);
      setAiDrafted(true);
      setReviewed(false);
      setWarnings(out.warnings);
      persist({ text: out.text, aiDrafted: true, reviewed: false });
      setMessage("AI draft ready. Read it, edit it, then tick “I reviewed this draft”.");
    } catch (err) {
      setMessage(err instanceof Error ? `Could not draft: ${err.message}` : "Could not draft a letter.");
    } finally {
      setBusy(false);
      abort.current = null;
    }
  };

  const insert = async () => {
    if (!m.tab || !cover.field || cover.field.inputType === "file") return;
    const res = await fillSingleField({ tab: m.tab, fieldId: cover.field.fieldId, value: text, profile: state?.sharedProfile ?? null, app });
    setMessage(res.ok ? "Cover letter inserted and verified on the page." : res.message);
    await m.refresh();
  };

  const canInsert = Boolean(cover.field && cover.field.inputType !== "file" && text.trim() && (!aiDrafted || reviewed));
  const saved = ui.coverLetters;

  return (
    <Card id="cover" title="Cover letter" testId="cover-card" collapsible collapsed={collapsed} onToggle={onToggle} badge={statusBadge}>
      <p className="meta" data-testid="cover-status">
        {cover.state === "required" && `This form requires a cover letter (“${cover.field?.label}”).`}
        {cover.state === "optional" && `This form has an optional cover letter field (“${cover.field?.label}”).`}
        {cover.state === "file-only" && `This form asks for a cover letter file (“${cover.field?.label}”). Extensions can’t attach files; prepare the text and attach it yourself.`}
        {cover.state === "none" && (m.readable ? "No cover letter field was detected on this form, so CareerOS won’t fill one." : "Open a supported application form to detect a cover letter field.")}
      </p>

      {saved.length ? (
        <div className="field">
          <label htmlFor="cover-existing" className="label">Use a saved cover letter</label>
          <select id="cover-existing" className="input" data-testid="cover-existing" value="" onChange={(e) => { const s = saved.find((x) => x.id === e.target.value); if (s) { setText(s.text); setAiDrafted(false); setReviewed(false); persist({ text: s.text, aiDrafted: false, reviewed: false }); } }}>
            <option value="">Choose…</option>
            {saved.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      ) : null}

      <div className="field">
        <label htmlFor="cover-text" className="label">Letter text</label>
        <textarea id="cover-text" className="input textarea" rows={7} data-testid="cover-text" value={text} placeholder="Write your own, pick a saved letter, or draft one with local AI." onChange={(e) => { setText(e.target.value); setReviewed(false); }} onBlur={() => persist({ text, aiDrafted, reviewed })} />
      </div>

      {aiDrafted ? (
        <label className="check">
          <input type="checkbox" data-testid="cover-reviewed" checked={reviewed} onChange={(e) => { setReviewed(e.target.checked); persist({ text, aiDrafted, reviewed: e.target.checked }); }} />
          <span>I reviewed this AI draft and every statement is true.</span>
        </label>
      ) : null}
      {warnings.map((w) => <Banner key={w} tone="warning" critical>{w}</Banner>)}
      {message ? <p className="meta" role="status" data-testid="cover-message">{message}</p> : null}

      <div className="btn-grid">
        <button type="button" className="btn btn-secondary" data-testid="btn-ai-draft" disabled={ai.kind !== "ready" || busy || !state?.sharedProfile} onClick={() => setConsent(true)}>
          {busy ? <Loader2 size={15} className="spin" aria-hidden /> : <Sparkles size={15} aria-hidden />} Draft with AI
        </button>
        <button type="button" className="btn btn-secondary" onClick={() => setShowPreview(true)} disabled={!text.trim()} data-testid="btn-cover-preview"><Eye size={15} aria-hidden /> Preview</button>
        <button type="button" className="btn btn-secondary" disabled={!text.trim()} data-testid="btn-cover-save" onClick={() => { const name = `Letter ${saved.length + 1}${page?.job?.company ? ` – ${page.job.company}` : ""}`; m.updateUi((p) => ({ coverLetters: [...p.coverLetters, { id: `cl-${Date.now()}`, name, text, updatedAt: new Date().toISOString() }] })); setMessage(`Saved as “${name}”.`); }}>Save letter</button>
        <button type="button" className="btn btn-primary" data-testid="btn-cover-insert" disabled={!canInsert} onClick={insert}>
          <Check size={15} aria-hidden /> Insert into form
        </button>
      </div>
      {ai.kind !== "ready" ? <p className="meta" data-testid="cover-ai-reason">AI drafting unavailable: {ai.reason}</p> : null}
      {cover.state === "file-only" && text.trim() ? (
        <button type="button" className="btn btn-secondary btn-block" onClick={() => navigator.clipboard?.writeText(text).then(() => setMessage("Copied to clipboard."))}>Copy text to attach yourself</button>
      ) : null}

      {consent && ai.kind === "ready" && ctx ? (
        <Modal title="Send résumé details to your AI?" onClose={() => setConsent(false)} testId="ai-consent">
          <p>
            CareerOS will send the text below to <strong>{ai.host}</strong> using model <strong>{ai.snapshot.model}</strong>.
            This endpoint is on this device. Nothing is sent without this confirmation.
          </p>
          <pre className="preview-text" data-testid="ai-consent-payload">{ctx.preview}</pre>
          <div className="btn-grid">
            <button type="button" className="btn btn-secondary" onClick={() => setConsent(false)} data-testid="btn-ai-cancel">Cancel</button>
            <button type="button" className="btn btn-primary" onClick={generate} data-testid="btn-ai-consent">Send and draft</button>
          </div>
        </Modal>
      ) : null}
      {showPreview ? (
        <Modal title="Cover letter preview" onClose={() => setShowPreview(false)}>
          <pre className="preview-text letter">{text}</pre>
        </Modal>
      ) : null}
    </Card>
  );
}

function QuestionAssistantCard() {
  const m = useModel();
  const [fieldId, setFieldId] = useState("");
  const [showConsent, setShowConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const abort = useRef<AbortController | null>(null);
  const fields = (m.page?.fields ?? []).filter((field) =>
    (field.inputType === "textarea" || field.mappedKey === "customQuestion") &&
    !/cover\s*letter/i.test(field.label) &&
    !checkSensitiveField([field.label, field.surroundingText, field.placeholder].join(" ")).isSensitive,
  );
  const selected = fields.find((field) => field.id === fieldId) ?? fields[0];
  const key = `${m.app?.id ?? m.page?.url ?? "page"}:${selected?.id ?? ""}`;
  const [answer, setAnswer] = useState("");
  const [evidence, setEvidence] = useState("");
  const [approved, setApproved] = useState(false);
  const ai = aiAvailability(m.state?.aiConnection ?? null);
  const profile = m.state?.sharedProfile;
  const jobDescription = m.app?.jobDescription ?? "";
  let context: ReturnType<typeof questionContext> | null = null;
  if (selected && profile && jobDescription) {
    try { context = questionContext(selected.label, profile, jobDescription); }
    catch { context = null; }
  }
  useEffect(() => {
    const next = m.ui.questionDrafts[key];
    setAnswer(next?.answer ?? "");
    setEvidence(next?.evidence ?? "");
    setApproved(next?.approved ?? false);
    setMessage("");
    // Reset the editor when the question changes (intentionally keyed on `key` only).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const persist = (next: { answer: string; evidence: string; approved: boolean } | null) => {
    m.updateUi((ui) => {
      const questionDrafts = { ...ui.questionDrafts };
      if (next) questionDrafts[key] = next;
      else delete questionDrafts[key];
      return { questionDrafts };
    });
  };
  const generate = async () => {
    if (ai.kind !== "ready" || !context || !selected) return;
    setShowConsent(false);
    setBusy(true);
    setMessage("");
    const controller = new AbortController();
    abort.current = controller;
    try {
      const draft = await draftQuestionAnswer(ai, context.prompt, context.facts, controller.signal);
      setAnswer(draft.answer);
      setEvidence(draft.evidence);
      setApproved(false);
      persist({ ...draft, approved: false });
      setMessage("Draft ready. Check the evidence and every claim before accepting.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not draft an answer.");
    } finally {
      setBusy(false);
      abort.current = null;
    }
  };
  return (
    <Card id="question-ai" title="Application answer assistant" testId="question-ai-card">
      <p className="meta">Drafts open-ended answers from the approved job description and shared résumé evidence. Sensitive and legal questions are excluded. Nothing is inserted until you accept it.</p>
      {fields.length ? <div className="field">
        <label className="label" htmlFor="question-ai-field">Question on this form</label>
        <select id="question-ai-field" className="input" value={selected?.id ?? ""} onChange={(event) => setFieldId(event.target.value)}>
          {fields.map((field) => <option key={field.id} value={field.id}>{field.label}</option>)}
        </select>
      </div> : <p className="meta">No supported open-ended question was detected on this page.</p>}
      {!jobDescription && <p className="meta">Add and sync an approved job description in CareerOS AutoApply before drafting.</p>}
      <button type="button" className="btn btn-secondary btn-block" disabled={!selected || !context || ai.kind !== "ready" || busy} onClick={() => setShowConsent(true)} data-testid="btn-question-ai-draft">
        {busy ? "Drafting…" : "Draft answer with AI"}
      </button>
      {busy && <button type="button" className="btn btn-secondary" onClick={() => abort.current?.abort()}>Cancel draft</button>}
      {ai.kind !== "ready" && <p className="meta">{ai.reason}</p>}
      {answer && <div className="stack-sm">
        <p className="meta">Supporting résumé evidence: “{evidence}”</p>
        <div className="field">
          <label className="label" htmlFor="question-ai-answer">Suggested answer</label>
          <textarea id="question-ai-answer" className="input textarea" rows={5} value={answer} onChange={(event) => { setAnswer(event.target.value); setApproved(false); }} onBlur={() => persist({ answer, evidence, approved: false })} />
        </div>
        <div className="btn-grid">
          <button type="button" className="btn btn-primary" onClick={() => { setApproved(true); persist({ answer, evidence, approved: true }); }}>Accept reviewed answer</button>
          <button type="button" className="btn btn-secondary" onClick={() => { setAnswer(""); setEvidence(""); setApproved(false); persist(null); }}>Reject</button>
        </div>
        {approved && <button type="button" className="btn btn-secondary btn-block" disabled={!m.tab || !selected} onClick={async () => {
          if (!m.tab || !selected || !approved) return;
          const result = await fillSingleField({ tab: m.tab, fieldId: selected.id, value: answer, profile: profile ?? null, app: m.app });
          setMessage(result.ok ? "Approved answer inserted and verified. Review it on the page before submitting." : result.message);
          await m.refresh();
        }}>Insert approved answer into form</button>}
      </div>}
      {message && <p className="meta" role="status">{message}</p>}
      {showConsent && ai.kind === "ready" && context && selected && <Modal title="Send application context to AI?" onClose={() => setShowConsent(false)} testId="question-ai-consent">
        <p>The exact text below will be sent to <strong>{ai.host}</strong> using <strong>{effectiveExtensionModel(ai.snapshot, "question_drafting")}</strong>. A loopback server may forward it elsewhere.</p>
        <pre className="preview-text">{context.prompt}</pre>
        <div className="btn-grid">
          <button type="button" className="btn btn-secondary" onClick={() => setShowConsent(false)}>Cancel</button>
          <button type="button" className="btn btn-primary" onClick={() => void generate()}>Send and draft</button>
        </div>
      </Modal>}
    </Card>
  );
}

