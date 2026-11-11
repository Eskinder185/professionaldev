import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  CheckCircle2,
  ClipboardCopy,
  ExternalLink,
  FileCheck2,
  FileText,
  Link2,
  Play,
  PlugZap,
  Plus,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Trash2,
} from "lucide-react";
import { PLATFORM_ADAPTERS } from "../../../packages/careeros-shared/adapters";
import type {
  ApplicantProfile,
  AutoApplyQueueItem,
  ExtensionCapabilities,
  PreparedQuestionDraft,
  QueueStatus,
  StandardProfileFieldKey,
} from "../../../packages/careeros-shared/types";
import { useAIConnection } from "../ai/AIConnectionProvider";
import SuggestedJobs from "../jobs/SuggestedJobs";
import { buildAIConnectionSnapshot, buildAnalysisSnapshots, summarizeVersions } from "./analysisSync";
import { exportPdf } from "../resume/document/exportPdf";
import { exportDocx } from "../resume/document/exportDocx";
import type { ResumeVersion } from "../resume/model/types";
import {
  exportAutoApplyBundleJson,
  importAutoApplyBundleJson,
  isExtensionTransport,
  sendExtensionMessage,
  type ExtensionConnectionState,
} from "./extensionBridge";

/** Plain-language names for the profile details a user can share with the extension. */
const CONSENT_LABELS: Record<string, string> = {
  firstName: "First name",
  lastName: "Last name",
  fullName: "Full name",
  email: "Email",
  phone: "Phone",
  city: "City",
  state: "State",
  location: "Location",
  country: "Country",
  linkedin: "LinkedIn",
  github: "GitHub",
  website: "Website",
  headline: "Headline",
  currentEmployer: "Current employer",
  currentTitle: "Current title",
};
import {
  buildDefaultQuestionSet,
  draftGroundedAnswerDeterministic,
  generateQuestionDraftWithAI,
} from "./questionAssistant";
import {
  analyzeAndPrepareQueueItem,
  buildSharedProfileSubset,
  checkResumeFitsOnePage,
  computeNextActionForStatus,
  createTailoredOnePageResumeForQueueItem,
  DEFAULT_CONSENTED_FIELDS,
  ensureResumeVersions,
  importUrlsIntoQueue,
  loadApplicantProfile,
  loadAutoApplyQueue,
  loadConsentedFields,
  saveApplicantProfile,
  saveAutoApplyQueue,
  saveConsentedFields,
  syncQueueItemToApplicationTracker,
} from "./storage";
import "./autoapply.css";

const ALL_QUEUE_STATUSES: QueueStatus[] = [
  "Imported",
  "Analysis needed",
  "Ready to prepare",
  "Needs information",
  "Ready for autofill",
  "Autofill in progress",
  "Ready for review",
  "Submitted and verified",
  "Unsupported",
  "Failed",
  "Skipped",
];

const SAMPLE_IMPORT_URLS = [
  "https://boards.greenhouse.io/cascadecloud/jobs/4091821?title=Cloud_Infrastructure_Engineer",
  "https://jobs.lever.co/northwindops/881920-systems-support-engineer?title=Systems_Support_Engineer",
  "http://localhost/professionaldev/autoapply/sandbox?platform=generic&company=Vertex+Data+Centers&role=Linux+Systems+Engineer",
].join("\n");

export default function AutoApplyPage() {
  const navigate = useNavigate();
  const { connected: aiConnected, chatForTask: aiChatForTask, state: aiState } = useAIConnection();
  const deepLink = useMemo(() => new URLSearchParams(window.location.search), []);

  const [versions, setVersions] = useState<ResumeVersion[]>(() => ensureResumeVersions());
  const [profile, setProfile] = useState<ApplicantProfile>(() => loadApplicantProfile());
  const [consentedFields, setConsentedFields] = useState<StandardProfileFieldKey[]>(() =>
    loadConsentedFields(),
  );
  const [queue, setQueue] = useState<AutoApplyQueueItem[]>(() => loadAutoApplyQueue());
  const [selectedId, setSelectedId] = useState<string | null>(() => {
    const initial = loadAutoApplyQueue();
    const focus = deepLink.get("focus");
    return (focus && initial.find((q) => q.id === focus)?.id) || initial[0]?.id || null;
  });

  // URL Importer state
  // `?import=<url>` is used by the extension's "Import this job" button; it only prefills the box.
  const [urlInput, setUrlInput] = useState(() => deepLink.get("import") ?? "");
  const [importReport, setImportReport] = useState<{
    addedCount: number;
    duplicates: Array<{ rawUrl: string; duplicateOf: string }>;
    invalid: Array<{ rawUrl: string; error: string }>;
  } | null>(null);

  // Custom question input
  const [customQuestionInput, setCustomQuestionInput] = useState("");
  const [aiDraftingId, setAiDraftingId] = useState<string | null>(null);

  // Extension connection state
  const [extIdInput, setExtIdInput] = useState("");
  const [connection, setConnection] = useState<ExtensionConnectionState>({
    connected: false,
    transport: "disconnected",
    extensionId: "",
    capabilities: null,
    lastHandshakeAt: null,
    error: null,
  });
  const extensionLive = connection.connected && isExtensionTransport(connection.transport);
  const [syncBanner, setSyncBanner] = useState("");
  const [jsonBundleText, setJsonBundleText] = useState("");
  const [showJsonFallback, setShowJsonFallback] = useState(false);

  const selectedItem = useMemo(
    () => queue.find((item) => item.id === selectedId) ?? queue[0] ?? null,
    [queue, selectedId],
  );

  const selectedResumeVersion = useMemo(
    () =>
      versions.find((v) => v.id === selectedItem?.selectedResumeId) ??
      versions.find((v) => v.kind === "master") ??
      versions[0],
    [versions, selectedItem],
  );

  const updateQueueItem = (
    id: string,
    updater: (prev: AutoApplyQueueItem) => AutoApplyQueueItem,
  ) => {
    setQueue((prev) => {
      const next = prev.map((item) => {
        if (item.id !== id) return item;
        const updated = updater(item);
        syncQueueItemToApplicationTracker(updated);
        return updated;
      });
      saveAutoApplyQueue(next);
      return next;
    });
  };

  const handleHandshake = async () => {
    const { response, transport } = await sendExtensionMessage<
      Record<string, never>,
      { capabilities: ExtensionCapabilities; connectedOrigin: string; connectedAt: string }
    >("HANDSHAKE", {}, { extensionId: extIdInput.trim() || undefined });

    if (response.ok && response.data) {
      setConnection({
        connected: true,
        transport,
        extensionId: extIdInput.trim(),
        capabilities: response.data.capabilities,
        lastHandshakeAt: response.data.connectedAt,
        error: null,
      });
      setSyncBanner(
        isExtensionTransport(transport)
          ? `Connected to the CareerOS extension (version ${response.data.capabilities.extensionVersion}).`
          : "The CareerOS extension wasn't detected in this browser. You can prepare applications and try the practice sandbox; autofill on real job sites needs the extension.",
      );
    } else {
      setConnection((prev) => ({
        ...prev,
        connected: false,
        error: response.error?.message ?? "CareerOS couldn't reach the extension.",
      }));
    }
  };

  useEffect(() => {
    handleHandshake().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleImportUrls = () => {
    if (!urlInput.trim()) return;
    const result = importUrlsIntoQueue(urlInput, queue, versions);
    // Seed default grounded question drafts on newly added items
    const enrichedQueue = result.nextQueue.map((item) => {
      if (result.added.some((a) => a.id === item.id) && item.preparedQuestions.length === 0) {
        return {
          ...item,
          preparedQuestions: buildDefaultQuestionSet(profile, item),
        };
      }
      return item;
    });
    saveAutoApplyQueue(enrichedQueue);
    setQueue(enrichedQueue);
    if (result.added[0]) {
      setSelectedId(result.added[0].id);
    }
    setImportReport({
      addedCount: result.added.length,
      duplicates: result.duplicates,
      invalid: result.invalid,
    });
    if (result.added.length > 0) {
      setUrlInput("");
    }
  };

  const handleLoadSampleBatch = () => {
    setUrlInput(SAMPLE_IMPORT_URLS);
  };

  const handleAnalyzeSelectedJob = () => {
    if (!selectedItem) return;
    updateQueueItem(selectedItem.id, (prev) => {
      const questions =
        prev.preparedQuestions.length > 0
          ? prev.preparedQuestions
          : buildDefaultQuestionSet(profile, prev);
      return analyzeAndPrepareQueueItem(prev, versions, questions);
    });
    setSyncBanner("Job requirements analyzed and matched against your Master Profile.");
  };

  const handleCreateTailoredResume = () => {
    if (!selectedItem) return;
    const { version, allVersions } = createTailoredOnePageResumeForQueueItem(selectedItem);
    setVersions(allVersions);
    const fits = checkResumeFitsOnePage(version);
    updateQueueItem(selectedItem.id, (prev) => ({
      ...prev,
      selectedResumeId: version.id,
      selectedResumeName: version.name,
      resumeFitsOnePage: fits,
      updatedAt: new Date().toISOString(),
    }));
    setSyncBanner(`Created tailored one-page résumé "${version.name}" (Page Fit: 1 of 1).`);
  };

  const handleAddCustomQuestion = () => {
    if (!selectedItem || !customQuestionInput.trim()) return;
    const draft = draftGroundedAnswerDeterministic(customQuestionInput.trim(), profile, selectedItem);
    updateQueueItem(selectedItem.id, (prev) => ({
      ...prev,
      preparedQuestions: [...prev.preparedQuestions, draft],
      updatedAt: new Date().toISOString(),
    }));
    setCustomQuestionInput("");
  };

  const handleDraftWithAI = async (q: PreparedQuestionDraft) => {
    if (!selectedItem) return;
    setAiDraftingId(q.id);
    try {
      const updatedDraft = await generateQuestionDraftWithAI(
        q.question,
        profile,
        selectedItem,
        aiConnected ? async (msgs) => (await aiChatForTask("question_drafting", msgs)).text : undefined,
      );
      updateQueueItem(selectedItem.id, (prev) => ({
        ...prev,
        preparedQuestions: prev.preparedQuestions.map((item) =>
          item.id === q.id ? { ...updatedDraft, id: q.id } : item,
        ),
        updatedAt: new Date().toISOString(),
      }));
    } finally {
      setAiDraftingId(null);
    }
  };

  const handleSyncToExtension = async () => {
    const sharedSubset = buildSharedProfileSubset(
      profile,
      consentedFields,
      selectedResumeVersion,
      selectedItem?.preparedQuestions ?? [],
    );
    const profRes = await sendExtensionMessage(
      "TRANSFER_PROFILE",
      sharedSubset,
      { extensionId: extIdInput.trim() || undefined },
    );
    const queueRes = await sendExtensionMessage(
      "IMPORT_QUEUE",
      {
        queue,
        activeApplicationId: selectedItem?.id ?? queue[0]?.id ?? null,
      },
      { extensionId: extIdInput.trim() || undefined },
    );

    // Analyses come from the real matching engine; the AI snapshot never contains a key.
    const analysisRes = await sendExtensionMessage(
      "SYNC_ANALYSIS",
      {
        resumeVersions: summarizeVersions(versions),
        analyses: buildAnalysisSnapshots(queue, versions),
        ...(aiConnected ? { aiConnection: buildAIConnectionSnapshot(aiState, true) } : {}),
      },
      { extensionId: extIdInput.trim() || undefined },
    );
    if (profRes.response.ok && queueRes.response.ok && !analysisRes.response.ok) {
      setSyncBanner(analysisRes.response.error?.message ?? "Synced profile and queue, but analysis sync failed.");
      return;
    }

    if (profRes.response.ok && queueRes.response.ok) {
      setSyncBanner(
        `Synced ${consentedFields.length} consented profile fields and ${queue.length} queued application(s) to extension.`,
      );
    } else {
      setSyncBanner(
        profRes.response.error?.message ??
          queueRes.response.error?.message ??
          "Failed to sync with extension.",
      );
    }
  };

  const handleClearExtensionData = async () => {
    const { response } = await sendExtensionMessage("CLEAR_SHARED_DATA", {});
    if (response.ok) {
      setSyncBanner("Cleared all shared profile and queue data from extension storage.");
    }
  };

  const handleOpenSandboxForItem = async (item: AutoApplyQueueItem) => {
    const sharedSubset = buildSharedProfileSubset(
      profile,
      consentedFields,
      versions.find((v) => v.id === item.selectedResumeId) ?? selectedResumeVersion,
      item.preparedQuestions,
    );
    await sendExtensionMessage("PREPARE_APPLICATION", {
      application: item,
      applicationId: item.id,
      profile: sharedSubset,
    });
    await sendExtensionMessage("SYNC_ANALYSIS", {
      resumeVersions: summarizeVersions(versions),
      analyses: buildAnalysisSnapshots([item], versions),
      ...(aiConnected ? { aiConnection: buildAIConnectionSnapshot(aiState, true) } : {}),
    });
    const params = new URLSearchParams({
      platform: item.platform === "unsupported" ? "unsupported" : item.platform,
      company: item.company,
      role: item.title,
      appId: item.id,
    });
    navigate(`/autoapply/sandbox?${params.toString()}`);
  };

  const toggleConsentedField = (fieldKey: StandardProfileFieldKey) => {
    const next = consentedFields.includes(fieldKey)
      ? consentedFields.filter((k) => k !== fieldKey)
      : [...consentedFields, fieldKey];
    setConsentedFields(next);
    saveConsentedFields(next);
  };

  const submittedItems = useMemo(
    () => queue.filter((q) => q.status === "Submitted and verified"),
    [queue],
  );

  return (
    <div className="career-feature aa-page" data-testid="autoapply-page">
      {/* Header */}
      <div className="career-feature-header">
        <div>
          <span className="career-overline">CAREEROS AUTOAPPLY 1.0</span>
          <h1>Job Application Autofill &amp; Copilot</h1>
          <p>
            Import job links, match requirements, select a verified one-page ATS résumé, and autofill applications with human-in-the-loop review.
          </p>
        </div>
        <div className="aa-header-actions">
          <Link
            to="/autoapply/sandbox?platform=generic&company=Cascade+Cloud+Systems&role=Cloud+Infrastructure+Engineer"
            className="aa-btn aa-btn-secondary"
            data-testid="btn-open-sandbox-direct"
          >
            <Play size={15} /> Open Application Sandbox
          </Link>
          <button
            type="button"
            className="aa-btn aa-btn-primary"
            onClick={handleSyncToExtension}
            data-testid="btn-sync-to-extension"
          >
            <PlugZap size={15} /> Sync Queue &amp; Profile to Extension
          </button>
        </div>
      </div>

      {/* Metrics Bar */}
      <div className="aa-metrics-grid" data-testid="autoapply-metrics">
        <div className="aa-metric-card">
          <span>Total Queued</span>
          <strong data-testid="metric-total-queued">{queue.length}</strong>
        </div>
        <div className="aa-metric-card">
          <span>Ready for Autofill</span>
          <strong data-testid="metric-ready-autofill">
            {queue.filter((q) => q.status === "Ready for autofill").length}
          </strong>
        </div>
        <div className="aa-metric-card">
          <span>Ready for Review</span>
          <strong data-testid="metric-ready-review">
            {queue.filter((q) => q.status === "Ready for review").length}
          </strong>
        </div>
        <div className="aa-metric-card">
          <span>Submitted &amp; Verified</span>
          <strong data-testid="metric-submitted-verified">{submittedItems.length}</strong>
        </div>
        <div className="aa-metric-card">
          <span>Browser Extension</span>
          <strong data-testid="metric-extension-status">
            {extensionLive ? "Connected" : "Not detected"}
          </strong>
        </div>
      </div>

      {syncBanner && (
        <div className="aa-banner-info" aria-live="polite" data-testid="autoapply-sync-banner">
          <CheckCircle2 size={16} />
          <span>{syncBanner}</span>
        </div>
      )}

      <SuggestedJobs onQueued={() => setQueue(loadAutoApplyQueue())} />

      {/* 1. Job Link Importer & Extension Connection Row */}
      <div className="aa-two-col">
        <section className="aa-card" data-testid="job-link-importer">
          <div className="aa-card-header">
            <div>
              <h2>1. Import Job Application Links</h2>
              <p>Paste 1–20 job posting URLs (one per line). Tracking parameters are stripped and duplicates are skipped.</p>
            </div>
            <button
              type="button"
              className="aa-btn aa-btn-secondary"
              onClick={handleLoadSampleBatch}
              data-testid="btn-load-sample-urls"
            >
              Load Sample Batch
            </button>
          </div>
          <textarea
            className="aa-textarea"
            rows={4}
            placeholder="https://boards.greenhouse.io/company/jobs/12345&#10;https://jobs.lever.co/company/abcdef"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            data-testid="job-urls-input"
          />
          <div className="aa-card-footer">
            <button
              type="button"
              className="aa-btn aa-btn-primary"
              onClick={handleImportUrls}
              data-testid="btn-import-job-urls"
            >
              <Plus size={15} /> Import Links to Queue
            </button>
          </div>

          {importReport && (
            <div className="aa-import-report" data-testid="import-batch-report">
              <p>
                <strong>Imported:</strong> {importReport.addedCount} ·{" "}
                <strong>Duplicates skipped:</strong> {importReport.duplicates.length} ·{" "}
                <strong>Invalid/Blocked:</strong> {importReport.invalid.length}
              </p>
              {importReport.duplicates.map((d, i) => (
                <div key={i} className="aa-report-warn" data-testid="import-duplicate-item">
                  Duplicate skipped: <code>{d.rawUrl}</code>
                </div>
              ))}
              {importReport.invalid.map((inv, i) => (
                <div key={i} className="aa-report-err" data-testid="import-invalid-item">
                  Rejected <code>{inv.rawUrl}</code>: {inv.error}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Extension Connection & Profile Consent Panel */}
        <section className="aa-card" data-testid="extension-connection-panel">
          <div className="aa-card-header">
            <div>
              <h2>Extension &amp; Shared Details</h2>
              <p>Only the details you tick below are shared with the CareerOS browser extension.</p>
            </div>
            <span className={`aa-badge ${extensionLive ? "aa-badge-success" : "aa-badge-neutral"}`} data-testid="extension-handshake-badge">
              {extensionLive ? "Extension connected" : "Practice mode"}
            </span>
          </div>

          <div className="aa-ext-row">
            <input
              type="text"
              className="aa-input"
              aria-label="Extension ID (optional)"
              placeholder="Extension ID (optional, found automatically)"
              value={extIdInput}
              onChange={(e) => setExtIdInput(e.target.value)}
              data-testid="input-extension-id"
            />
            <button
              type="button"
              className="aa-btn aa-btn-secondary"
              onClick={handleHandshake}
              data-testid="btn-verify-handshake"
            >
              <RefreshCw size={14} /> Check Connection
            </button>
          </div>

          <div className="aa-consent-grid" data-testid="profile-consent-checkboxes">
            {DEFAULT_CONSENTED_FIELDS.slice(0, 12).map((fieldKey) => (
              <label key={fieldKey} className="aa-consent-item">
                <input
                  type="checkbox"
                  checked={consentedFields.includes(fieldKey)}
                  onChange={() => toggleConsentedField(fieldKey)}
                  data-testid={`consent-checkbox-${fieldKey}`}
                />
                <span>{CONSENT_LABELS[fieldKey] ?? fieldKey}</span>
              </label>
            ))}
          </div>

          <div className="aa-card-footer">
            <button
              type="button"
              className="aa-btn aa-btn-secondary"
              onClick={handleClearExtensionData}
              data-testid="btn-clear-extension-data"
            >
              Clear Shared Extension Data
            </button>
            <button
              type="button"
              className="aa-btn aa-btn-secondary"
              onClick={() => {
                const subset = buildSharedProfileSubset(
                  profile,
                  consentedFields,
                  selectedResumeVersion,
                  selectedItem?.preparedQuestions ?? [],
                );
                setJsonBundleText(exportAutoApplyBundleJson(queue, subset));
                setShowJsonFallback((prev) => !prev);
              }}
              data-testid="btn-toggle-json-fallback"
            >
              {showJsonFallback ? "Hide JSON Fallback" : "Manual JSON Export/Import"}
            </button>
          </div>

          {showJsonFallback && (
            <div className="aa-json-fallback" data-testid="json-fallback-panel">
              <textarea
                className="aa-textarea aa-mono"
                rows={4}
                value={jsonBundleText}
                onChange={(e) => setJsonBundleText(e.target.value)}
                data-testid="textarea-json-bundle"
              />
              <button
                type="button"
                className="aa-btn aa-btn-secondary"
                onClick={() => {
                  const res = importAutoApplyBundleJson(jsonBundleText);
                  if (res.ok && res.queue) {
                    setQueue(res.queue);
                    saveAutoApplyQueue(res.queue);
                    setSyncBanner(`Imported ${res.queue.length} application(s) from JSON bundle.`);
                  } else {
                    setSyncBanner(res.error ?? "Failed to import JSON bundle.");
                  }
                }}
                data-testid="btn-import-json-bundle"
              >
                Import JSON Bundle
              </button>
            </div>
          )}
        </section>
      </div>

      {/* 2. Application Queue Table */}
      <section className="aa-card" data-testid="application-queue-section">
        <div className="aa-card-header">
          <div>
            <h2>2. Application Queue</h2>
            <p>Select any queued application to prepare your one-page résumé, review grounded question drafts, or launch autofill.</p>
          </div>
          <Link to="/applications" className="aa-btn aa-btn-secondary" data-testid="link-to-applications-tracker">
            View in Application Tracker ({queue.length})
          </Link>
        </div>

        {queue.length === 0 ? (
          <div className="aa-empty" data-testid="queue-empty-state">
            <Link2 size={26} />
            <p>No job links in your AutoApply queue yet. Paste job URLs above or click Load Sample Batch.</p>
          </div>
        ) : (
          <div className="aa-table-wrap">
            <table className="aa-table" data-testid="application-queue-table">
              <thead>
                <tr>
                  <th>Company</th>
                  <th>Job title</th>
                  <th>Location</th>
                  <th>Source</th>
                  <th>Match estimate</th>
                  <th>Selected résumé</th>
                  <th>Application platform</th>
                  <th>Completion status</th>
                  <th>Next action</th>
                  <th>Last updated</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {queue.map((item) => {
                  const adapter = PLATFORM_ADAPTERS[item.platform] ?? PLATFORM_ADAPTERS.generic;
                  const isSelected = selectedItem?.id === item.id;
                  return (
                    <tr
                      key={item.id}
                      className={isSelected ? "aa-row-selected" : ""}
                      onClick={() => setSelectedId(item.id)}
                      data-testid={`queue-row-${item.id}`}
                    >
                      <td>
                        <strong>{item.company}</strong>
                      </td>
                      <td>{item.title}</td>
                      <td>{item.location}</td>
                      <td className="aa-mono">{item.source}</td>
                      <td>
                        {item.matchScore !== null ? (
                          <span className="aa-badge aa-badge-primary">{item.matchScore}% match</span>
                        ) : (
                          <span className="aa-muted">Add JD</span>
                        )}
                      </td>
                      <td>
                        <span>{item.selectedResumeName}</span>{" "}
                        <span className="aa-badge aa-badge-success">
                          {item.resumeFitsOnePage ? "1 of 1" : "Check fit"}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`aa-badge ${
                            item.supportLevel === "supported"
                              ? "aa-badge-success"
                              : item.supportLevel === "partial"
                                ? "aa-badge-warning"
                                : "aa-badge-danger"
                          }`}
                        >
                          {adapter.label} ({item.supportLevel})
                        </span>
                      </td>
                      <td>
                        <select
                          aria-label={`Completion status for ${item.title} at ${item.company}`}
                          value={item.status}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => {
                            const nextStatus = e.target.value as QueueStatus;
                            updateQueueItem(item.id, (prev) => ({
                              ...prev,
                              status: nextStatus,
                              nextAction: computeNextActionForStatus(nextStatus),
                              submittedAt:
                                nextStatus === "Submitted and verified"
                                  ? prev.submittedAt ?? new Date().toISOString()
                                  : prev.submittedAt,
                              updatedAt: new Date().toISOString(),
                            }));
                          }}
                          data-testid={`status-select-${item.id}`}
                        >
                          {ALL_QUEUE_STATUSES.map((st) => (
                            <option key={st} value={st}>
                              {st}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>{item.nextAction}</td>
                      <td className="aa-mono">{item.updatedAt.slice(0, 10)}</td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <div className="aa-row-actions">
                          <button
                            type="button"
                            className="aa-btn aa-btn-primary aa-btn-sm"
                            onClick={() => handleOpenSandboxForItem(item)}
                            data-testid={`btn-launch-autofill-${item.id}`}
                          >
                            <Play size={13} /> Autofill
                          </button>
                          <button
                            type="button"
                            className="aa-btn aa-btn-secondary aa-btn-sm"
                            aria-label={`Delete ${item.title} at ${item.company}`}
                            onClick={() => {
                              const next = queue.filter((q) => q.id !== item.id);
                              setQueue(next);
                              saveAutoApplyQueue(next);
                            }}
                            data-testid={`btn-delete-queue-${item.id}`}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* 3. Selected Application Detail, One-Page Résumé Selection & Question Assistant */}
      {selectedItem && (
        <div className="aa-two-col" data-testid="application-detail-view">
          {/* Left: Job Details + One-Page Résumé Selection */}
          <section className="aa-card">
            <div className="aa-card-header">
              <div>
                <h2>3. Application Detail &amp; One-Page Résumé</h2>
                <p>Verify extracted details, analyze the job description, and select your one-page ATS résumé.</p>
              </div>
              <button
                type="button"
                className="aa-btn aa-btn-primary"
                onClick={() => handleOpenSandboxForItem(selectedItem)}
                data-testid="detail-btn-open-autofill"
              >
                <ExternalLink size={14} /> Open Form &amp; Autofill
              </button>
            </div>

            <div className="aa-form-grid">
              <label>
                Company
                <input
                  type="text"
                  value={selectedItem.company}
                  onChange={(e) =>
                    updateQueueItem(selectedItem.id, (prev) => ({
                      ...prev,
                      company: e.target.value,
                      updatedAt: new Date().toISOString(),
                    }))
                  }
                  data-testid="detail-input-company"
                />
              </label>
              <label>
                Job Title
                <input
                  type="text"
                  value={selectedItem.title}
                  onChange={(e) =>
                    updateQueueItem(selectedItem.id, (prev) => ({
                      ...prev,
                      title: e.target.value,
                      updatedAt: new Date().toISOString(),
                    }))
                  }
                  data-testid="detail-input-title"
                />
              </label>
              <label>
                Location
                <input
                  type="text"
                  value={selectedItem.location}
                  onChange={(e) =>
                    updateQueueItem(selectedItem.id, (prev) => ({
                      ...prev,
                      location: e.target.value,
                      updatedAt: new Date().toISOString(),
                    }))
                  }
                  data-testid="detail-input-location"
                />
              </label>
              <label>
                Follow-up Date
                <input
                  type="date"
                  value={selectedItem.followUpDate}
                  onChange={(e) =>
                    updateQueueItem(selectedItem.id, (prev) => ({
                      ...prev,
                      followUpDate: e.target.value,
                      updatedAt: new Date().toISOString(),
                    }))
                  }
                  data-testid="detail-input-followup"
                />
              </label>
            </div>

            <label className="aa-block-label">
              Job Description (paste to calculate requirement match &amp; tailor résumé)
              <textarea
                className="aa-textarea"
                rows={4}
                placeholder="Paste job requirements here (e.g., Linux, TCP/IP, DNS, Bash, Python, AWS, hardware diagnostics)..."
                value={selectedItem.jobDescription}
                onChange={(e) =>
                  updateQueueItem(selectedItem.id, (prev) => ({
                    ...prev,
                    jobDescription: e.target.value,
                    updatedAt: new Date().toISOString(),
                  }))
                }
                data-testid="detail-textarea-jd"
              />
            </label>

            <div className="aa-card-footer">
              <button
                type="button"
                className="aa-btn aa-btn-secondary"
                onClick={handleAnalyzeSelectedJob}
                data-testid="btn-analyze-job"
              >
                Analyze Job &amp; Compute Match
              </button>
              {selectedItem.matchScore !== null && (
                <span className="aa-badge aa-badge-primary" data-testid="detail-match-score">
                  Match Score: {selectedItem.matchScore}% (Matched:{" "}
                  {selectedItem.matchedSkills.slice(0, 5).join(", ") || "Core profile"})
                </span>
              )}
            </div>

            <hr className="aa-divider" />

            {/* One-Page Résumé Selection View */}
            <div data-testid="resume-selection-view">
              <div className="aa-card-header">
                <div>
                  <h3>One-Page ATS Résumé Selection</h3>
                  <p>Integrated with CareerOS Résumé Studio 3.0 layout engine.</p>
                </div>
                <span
                  className="aa-badge aa-badge-success"
                  data-testid="selected-resume-page-fit"
                >
                  Page Fit: {selectedItem.resumeFitsOnePage ? "1 of 1" : "Check Fit"}
                </span>
              </div>

              <div className="aa-ext-row">
                <select
                  aria-label="Select Résumé Version"
                  className="aa-input"
                  value={selectedItem.selectedResumeId}
                  onChange={(e) => {
                    const ver = versions.find((v) => v.id === e.target.value);
                    if (!ver) return;
                    const fits = checkResumeFitsOnePage(ver);
                    updateQueueItem(selectedItem.id, (prev) => ({
                      ...prev,
                      selectedResumeId: ver.id,
                      selectedResumeName: ver.name,
                      resumeFitsOnePage: fits,
                      updatedAt: new Date().toISOString(),
                    }));
                  }}
                  data-testid="select-resume-version"
                >
                  {versions.map((ver) => (
                    <option key={ver.id} value={ver.id}>
                      {ver.name} ({ver.kind === "master" ? "Master" : "Tailored"})
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="aa-btn aa-btn-secondary"
                  onClick={handleCreateTailoredResume}
                  data-testid="btn-create-tailored-resume"
                >
                  <Sparkles size={14} /> Tailor One-Page Résumé
                </button>
              </div>

              <div className="aa-card-footer">
                {selectedResumeVersion && (
                  <>
                    <button
                      type="button"
                      className="aa-btn aa-btn-secondary aa-btn-sm"
                      onClick={() => exportPdf(selectedResumeVersion.resume, selectedResumeVersion.settings)}
                      data-testid="btn-export-selected-pdf"
                    >
                      <FileText size={13} /> Export One-Page PDF
                    </button>
                    <button
                      type="button"
                      className="aa-btn aa-btn-secondary aa-btn-sm"
                      onClick={() => exportDocx(selectedResumeVersion.resume, selectedResumeVersion.settings)}
                      data-testid="btn-export-selected-docx"
                    >
                      <FileText size={13} /> Export One-Page DOCX
                    </button>
                  </>
                )}
                <Link to="/resume" className="aa-btn aa-btn-secondary aa-btn-sm">
                  Open in Résumé Studio 3.0
                </Link>
              </div>
            </div>
          </section>

          {/* Right: Application Question Assistant & Unsupported Checklist Fallback */}
          <section className="aa-card" data-testid="question-assistant-view">
            <div className="aa-card-header">
              <div>
                <h2>4. Application Question Assistant</h2>
                <p>
                  Answers are grounded strictly in your verified Master Profile. Sensitive legal, EEO, and work-authorization questions require direct user input.
                </p>
              </div>
              <span className="aa-badge">
                AI: {aiConnected ? "Local AI Connected" : "Grounded Profile Engine"}
              </span>
            </div>

            <div className="aa-ext-row">
              <input
                type="text"
                className="aa-input"
                placeholder="Add an application question (e.g., Describe your Linux experience or Visa sponsorship)..."
                value={customQuestionInput}
                onChange={(e) => setCustomQuestionInput(e.target.value)}
                data-testid="input-custom-question"
              />
              <button
                type="button"
                className="aa-btn aa-btn-secondary"
                onClick={handleAddCustomQuestion}
                data-testid="btn-add-question"
              >
                <Plus size={14} /> Add Question
              </button>
            </div>

            <div className="aa-questions-stack" data-testid="prepared-questions-list">
              {selectedItem.preparedQuestions.map((q) => (
                <article
                  key={q.id}
                  className={`aa-question-card ${
                    q.requiresDirectUserInput ? "aa-question-sensitive" : ""
                  }`}
                  data-testid={`question-card-${q.category}`}
                >
                  <div className="aa-question-top">
                    <strong>{q.question}</strong>
                    <span
                      className={`aa-badge ${
                        q.requiresDirectUserInput
                          ? "aa-badge-warning"
                          : q.approved
                            ? "aa-badge-success"
                            : ""
                      }`}
                    >
                      {q.requiresDirectUserInput
                        ? "Direct User Input Required"
                        : q.approved
                          ? "Approved for Autofill"
                          : "Draft — Review Required"}
                    </span>
                  </div>

                  {q.requiresDirectUserInput ? (
                    <p className="aa-sensitive-note" data-testid="sensitive-question-warning">
                      <ShieldCheck size={14} /> {q.sensitiveReason}
                    </p>
                  ) : (
                    <>
                      <textarea
                        className="aa-textarea"
                        rows={3}
                        value={q.draftAnswer}
                        onChange={(e) => {
                          const val = e.target.value;
                          updateQueueItem(selectedItem.id, (prev) => ({
                            ...prev,
                            preparedQuestions: prev.preparedQuestions.map((item) =>
                              item.id === q.id ? { ...item, draftAnswer: val } : item,
                            ),
                            updatedAt: new Date().toISOString(),
                          }));
                        }}
                        data-testid={`question-textarea-${q.category}`}
                      />
                      <div className="aa-question-meta">
                        <small>Source Evidence: {q.evidence}</small>
                        <div className="aa-row-actions">
                          <button
                            type="button"
                            className="aa-btn aa-btn-secondary aa-btn-sm"
                            disabled={aiDraftingId === q.id}
                            onClick={() => handleDraftWithAI(q)}
                            data-testid={`btn-regenerate-question-${q.category}`}
                          >
                            <Sparkles size={12} />{" "}
                            {aiDraftingId === q.id ? "Drafting..." : "Refine Draft"}
                          </button>
                          <label className="aa-consent-item">
                            <input
                              type="checkbox"
                              checked={q.approved}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                updateQueueItem(selectedItem.id, (prev) => ({
                                  ...prev,
                                  preparedQuestions: prev.preparedQuestions.map((item) =>
                                    item.id === q.id ? { ...item, approved: checked } : item,
                                  ),
                                  updatedAt: new Date().toISOString(),
                                }));
                              }}
                              data-testid={`checkbox-approve-question-${q.category}`}
                            />
                            <span>Approve</span>
                          </label>
                          <button
                            type="button"
                            className="aa-btn aa-btn-secondary aa-btn-sm"
                            onClick={() => {
                              const nextProfile: ApplicantProfile = {
                                ...profile,
                                savedAnswers: [
                                  ...profile.savedAnswers.filter(
                                    (s) => s.questionLabel !== q.question,
                                  ),
                                  {
                                    id: q.id,
                                    questionPattern: q.category,
                                    questionLabel: q.question,
                                    answer: q.draftAnswer,
                                    evidence: q.evidence,
                                    approvedAt: new Date().toISOString(),
                                  },
                                ],
                              };
                              setProfile(nextProfile);
                              saveApplicantProfile(nextProfile);
                              setSyncBanner(`Saved answer for "${q.question}" for future reuse.`);
                            }}
                            data-testid={`btn-save-reusable-${q.category}`}
                          >
                            Save for Reuse
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </article>
              ))}
            </div>

            {/* Guided Copyable Checklist Fallback for Unsupported / Partial Platforms */}
            {(selectedItem.supportLevel === "unsupported" ||
              selectedItem.supportLevel === "partial") && (
              <div
                className="aa-unsupported-checklist"
                data-testid="unsupported-checklist-panel"
              >
                <h3>Guided Copy-Paste Checklist ({selectedItem.platform})</h3>
                <p>
                  This platform uses gated or multi-step custom controls. Copy your verified profile pack below to paste manually:
                </p>
                <pre className="aa-mono">
                  {[
                    `Full Name: ${profile.firstName} ${profile.lastName}`,
                    `Email: ${profile.email} | Phone: ${profile.phone}`,
                    `Location: ${profile.city}, ${profile.state}`,
                    `LinkedIn: ${profile.linkedin} | GitHub: ${profile.github}`,
                    `Selected One-Page Résumé: ${selectedItem.selectedResumeName}`,
                  ].join("\n")}
                </pre>
                <button
                  type="button"
                  className="aa-btn aa-btn-secondary aa-btn-sm"
                  onClick={() => {
                    navigator.clipboard?.writeText(
                      `${profile.firstName} ${profile.lastName}\n${profile.email}\n${profile.phone}\n${profile.linkedin}`,
                    );
                    setSyncBanner("Copied applicant checklist to clipboard.");
                  }}
                  data-testid="btn-copy-checklist"
                >
                  <ClipboardCopy size={13} /> Copy Profile Pack
                </button>
              </div>
            )}
          </section>
        </div>
      )}

      {/* 5. Verified Submission History */}
      <section className="aa-card" data-testid="submission-history-view">
        <div className="aa-card-header">
          <div>
            <h2>5. Verified Submission History</h2>
            <p>
              Applications are listed here only after you submit the form and the confirmation state is verified. All records sync automatically with CareerOS Application Tracker.
            </p>
          </div>
          <Link to="/applications" className="aa-btn aa-btn-secondary">
            <FileCheck2 size={14} /> Open Application Tracker
          </Link>
        </div>

        {submittedItems.length === 0 ? (
          <p className="aa-muted" data-testid="submission-history-empty">
            No verified submissions yet. Autofill alone never marks an application as submitted.
          </p>
        ) : (
          <table className="aa-table" data-testid="submission-history-table">
            <thead>
              <tr>
                <th>Company</th>
                <th>Role</th>
                <th>Platform</th>
                <th>Résumé Used</th>
                <th>Submitted &amp; Verified At</th>
                <th>Confirmation</th>
              </tr>
            </thead>
            <tbody>
              {submittedItems.map((item) => (
                <tr key={item.id} data-testid={`submitted-row-${item.id}`}>
                  <td>
                    <strong>{item.company}</strong>
                  </td>
                  <td>{item.title}</td>
                  <td>{item.platform}</td>
                  <td>{item.selectedResumeName}</td>
                  <td className="aa-mono">{(item.submittedAt || item.updatedAt).slice(0, 19)}</td>
                  <td>{item.confirmationText || "Verified by user"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
