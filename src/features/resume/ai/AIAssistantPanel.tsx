import { useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Check, Loader2, Pencil, Plug, RefreshCw, Sparkles, X } from "lucide-react";
import { AIConnectionsSection, ConnectionBadge } from "../../ai/AIConnectionsSection";
import { useAIConnection } from "../../ai/AIConnectionProvider";
import { AIError } from "../../ai/client";
import {
  AI_SUGGESTION_SCHEMA,
  WRITING_ACTIONS,
  buildJobExtractionPrompt,
  buildTailoringPrompt,
  buildWritingPrompt,
  resumeToGroundingText,
  validateAIJobExtraction,
  validateAISuggestions,
  type ValidatedAISuggestion,
  type WritingActionId,
} from "../../ai/structured";
import { layoutResume } from "../layout/engine";
import { hasPlaceholder } from "../job/suggestions";
import type { DocumentSettings, JobTarget, Resume } from "../model/types";

type TargetItem = {
  id: string;
  label: string;
  section: "summary" | "experience" | "projects";
  entryId?: string;
  bulletIndex?: number;
  text: string;
};

function collectTargets(resume: Resume): TargetItem[] {
  const items: TargetItem[] = [];
  if (resume.summary.trim()) {
    items.push({
      id: "summary",
      label: "Professional Summary",
      section: "summary",
      text: resume.summary,
    });
  }
  for (const exp of resume.experience) {
    const title = [exp.title, exp.employer].filter(Boolean).join(" — ") || "Experience";
    exp.bullets.forEach((b, idx) => {
      if (b.trim()) {
        items.push({
          id: `exp:${exp.id}:${idx}`,
          label: `${title} · Bullet ${idx + 1}`,
          section: "experience",
          entryId: exp.id,
          bulletIndex: idx,
          text: b,
        });
      }
    });
  }
  for (const proj of resume.projects) {
    const title = proj.name || "Project";
    proj.bullets.forEach((b, idx) => {
      if (b.trim()) {
        items.push({
          id: `proj:${proj.id}:${idx}`,
          label: `${title} · Bullet ${idx + 1}`,
          section: "projects",
          entryId: proj.id,
          bulletIndex: idx,
          text: b,
        });
      }
    });
  }
  return items;
}

function applyTextReplacement(resume: Resume, originalText: string, newText: string, target?: TargetItem): Resume {
  const cleanNew = newText.trim();
  if (target?.section === "summary") {
    return { ...resume, summary: cleanNew };
  }
  if (target?.section === "experience" && target.entryId != null && target.bulletIndex != null) {
    return {
      ...resume,
      experience: resume.experience.map((e) =>
        e.id === target.entryId
          ? { ...e, bullets: e.bullets.map((b, i) => (i === target.bulletIndex ? cleanNew : b)) }
          : e,
      ),
    };
  }
  if (target?.section === "projects" && target.entryId != null && target.bulletIndex != null) {
    return {
      ...resume,
      projects: resume.projects.map((p) =>
        p.id === target.entryId
          ? { ...p, bullets: p.bullets.map((b, i) => (i === target.bulletIndex ? cleanNew : b)) }
          : p,
      ),
    };
  }
  // Fallback: match by exact text across summary, experience bullets, or project bullets
  if (resume.summary.trim() === originalText.trim()) {
    return { ...resume, summary: cleanNew };
  }
  let replaced = false;
  const nextExp = resume.experience.map((e) => ({
    ...e,
    bullets: e.bullets.map((b) => {
      if (!replaced && b.trim() === originalText.trim()) {
        replaced = true;
        return cleanNew;
      }
      return b;
    }),
  }));
  if (replaced) return { ...resume, experience: nextExp };

  const nextProj = resume.projects.map((p) => ({
    ...p,
    bullets: p.bullets.map((b) => {
      if (!replaced && b.trim() === originalText.trim()) {
        replaced = true;
        return cleanNew;
      }
      return b;
    }),
  }));
  if (replaced) return { ...resume, projects: nextProj };

  // If the original text didn't match verbatim, replace first experience bullet or summary only if target was specified
  return resume;
}

function measureDeltaLines(resume: Resume, settings: DocumentSettings, nextResume: Resume): string {
  const before = layoutResume(resume, settings).fit.totalLines;
  const after = layoutResume(nextResume, settings).fit.totalLines;
  const diff = after - before;
  if (diff === 0) return "No line change";
  if (diff < 0) return `Saves ${Math.abs(diff)} line${Math.abs(diff) === 1 ? "" : "s"}`;
  return `+${diff} line${diff === 1 ? "" : "s"}`;
}

type Props = {
  resume: Resume;
  settings: DocumentSettings;
  job: JobTarget;
  onApply: (change: { resume?: Resume; settings?: DocumentSettings }, message: string) => void;
  onJobChange: (job: JobTarget) => void;
  onStatus: (message: string) => void;
};

export default function AIAssistantPanel({ resume, settings, job, onApply, onJobChange, onStatus }: Props) {
  const { state, connected, chat } = useAIConnection();
  const [showConfig, setShowConfig] = useState(!connected);
  const targets = useMemo(() => collectTargets(resume), [resume]);
  const [selectedTargetId, setSelectedTargetId] = useState<string>(targets[0]?.id ?? "");
  const activeTarget = targets.find((t) => t.id === selectedTargetId) ?? targets[0];

  const [busyLabel, setBusyLabel] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lastRetry, setLastRetry] = useState<(() => void) | null>(null);
  const [proposals, setProposals] = useState<Array<ValidatedAISuggestion & { id: string; target?: TargetItem }>>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<string>("");
  const abortRef = useRef<AbortController | null>(null);

  const cancelActive = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setBusyLabel(null);
  };

  const runWritingAction = async (actionId: WritingActionId) => {
    if (!connected || !activeTarget) return;
    const spec = WRITING_ACTIONS.find((a) => a.id === actionId) ?? WRITING_ACTIONS[0];
    setErrorMsg(null);
    setLastRetry(() => () => void runWritingAction(actionId));
    setBusyLabel(`${spec.label}…`);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const reqTerms = job.requirements.filter((r) => r.selected && r.kind !== "context").map((r) => r.term);
      const messages = buildWritingPrompt(spec, activeTarget.text, resume, job.title || resume.targetRole, reqTerms);
      const res = await chat(messages, {
        format: AI_SUGGESTION_SCHEMA,
        signal: controller.signal,
      });
      const validated = validateAISuggestions(res.text, activeTarget.text, resumeToGroundingText(resume));
      setProposals((prev) => [
        ...validated.map((v, i) => ({ ...v, id: `${Date.now()}-${i}`, target: activeTarget })),
        ...prev,
      ]);
      onStatus(`AI proposed ${validated.length} suggestion${validated.length === 1 ? "" : "s"} for review.`);
    } catch (e) {
      if (e instanceof AIError && e.kind === "cancelled") return;
      setErrorMsg(e instanceof Error ? e.message : "The model returned an unexpected response.");
    } finally {
      setBusyLabel(null);
      abortRef.current = null;
    }
  };

  const runTailoring = async () => {
    if (!connected) return;
    setErrorMsg(null);
    setLastRetry(() => () => void runTailoring());
    setBusyLabel("Analyzing résumé against job requirements…");
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const fallbackBullet = targets[0]?.text ?? "";
      const messages = buildTailoringPrompt(resume, job.title || resume.targetRole, job.requirements);
      const res = await chat(messages, {
        format: AI_SUGGESTION_SCHEMA,
        signal: controller.signal,
      });
      const validated = validateAISuggestions(res.text, fallbackBullet, resumeToGroundingText(resume));
      setProposals((prev) => [
        ...validated.map((v, i) => {
          const matchedTarget = targets.find((t) => t.text.trim() === v.originalText.trim()) ?? targets[0];
          return { ...v, id: `tailor-${Date.now()}-${i}`, target: matchedTarget };
        }),
        ...prev,
      ]);
      onStatus(`AI generated ${validated.length} tailoring suggestion${validated.length === 1 ? "" : "s"} for review.`);
    } catch (e) {
      if (e instanceof AIError && e.kind === "cancelled") return;
      setErrorMsg(e instanceof Error ? e.message : "Failed to generate AI tailoring suggestions.");
    } finally {
      setBusyLabel(null);
      abortRef.current = null;
    }
  };

  const runAIJobExtract = async () => {
    if (!connected || !job.description.trim()) return;
    setErrorMsg(null);
    setLastRetry(() => () => void runAIJobExtract());
    setBusyLabel("Extracting job requirements with AI…");
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const messages = buildJobExtractionPrompt(job.description);
      const res = await chat(messages, { signal: controller.signal });
      const { requirements: aiReqs, metadata } = validateAIJobExtraction(res.text, job.description);
      const existingTerms = new Set(job.requirements.map((r) => r.term.toLowerCase()));
      const merged = [
        ...job.requirements,
        ...aiReqs.filter((r) => !existingTerms.has(r.term.toLowerCase())),
      ];
      onJobChange({
        ...job,
        company: job.company || metadata.company,
        metadata: { ...job.metadata, ...metadata },
        requirements: merged,
        analyzedAt: new Date().toISOString(),
        analyzedDescription: job.description,
      });
      onStatus(`AI extracted ${aiReqs.length} validated requirement${aiReqs.length === 1 ? "" : "s"} from the job description.`);
    } catch (e) {
      if (e instanceof AIError && e.kind === "cancelled") return;
      setErrorMsg(e instanceof Error ? e.message : "AI job extraction returned an invalid response.");
    } finally {
      setBusyLabel(null);
      abortRef.current = null;
    }
  };

  return (
    <section className="rs-ai-panel" aria-labelledby="rs-ai-panel-title">
      <div className="rs-ai-panel-head">
        <div>
          <h3 id="rs-ai-panel-title">Local AI & Writing Assistant</h3>
          <p className="career-muted">
            Bring Your Own AI (Ollama, LM Studio, or OpenAI-compatible). Suggestions are schema-validated and never applied without your approval.
          </p>
        </div>
        <div className="rs-ai-panel-head-actions">
          <ConnectionBadge />
          <button
            type="button"
            className="career-secondary-button"
            onClick={() => setShowConfig((v) => !v)}
          >
            <Plug size={14} /> {showConfig ? "Hide connection setup" : "Configure AI"}
          </button>
        </div>
      </div>

      {!connected && (
        <div className="rs-ai-offline-banner" role="region" aria-label="Offline mode status">
          <p>
            <strong>AI is currently disconnected — Offline Mode is active.</strong> Everything in Résumé Studio still works locally in your browser without AI:
          </p>
          <ul>
            <li>Import, parse, and edit your Master Profile and tailored résumés</li>
            <li>One-page measurement, template switching, and intelligent one-page fitting</li>
            <li>Rule-based job description extraction, match scoring, and wording suggestions</li>
            <li>One-page PDF and DOCX export</li>
          </ul>
          <p className="career-muted">
            To enable AI tailoring and writing actions, connect Ollama or LM Studio below or in{" "}
            <Link to="/settings">Settings → AI Connections</Link>.
          </p>
        </div>
      )}

      {showConfig && (
        <div className="rs-ai-embedded-config">
          <AIConnectionsSection compact />
        </div>
      )}

      {connected && (
        <div className="rs-ai-disclosure" role="note">
          <strong>What will be sent:</strong> When you click an AI button below, the selected bullet/résumé text and target job context are sent to{" "}
          <code>{state.baseUrl}</code> using model <code>{state.model}</code>.
        </div>
      )}

      {busyLabel && (
        <div className="rs-ai-busy" aria-live="polite">
          <Loader2 size={15} className="rs-spin" />
          <span>{busyLabel}</span>
          <button type="button" className="career-secondary-button" onClick={cancelActive}>
            <X size={13} /> Cancel
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="rs-ai-error" role="alert">
          <AlertTriangle size={15} />
          <span>{errorMsg}</span>
          {lastRetry && (
            <button type="button" className="career-secondary-button" onClick={() => lastRetry()}>
              <RefreshCw size={13} /> Retry
            </button>
          )}
        </div>
      )}

      <div className="rs-ai-capabilities">
        <div className="rs-ai-cap-card">
          <h4>1. AI Résumé Tailoring & Job Understanding</h4>
          <p className="career-muted">
            Compare your résumé against the target job description or extract structured requirements with exact source excerpts.
          </p>
          <div className="rs-ai-cap-buttons">
            <button
              type="button"
              className="career-quick-create"
              disabled={!connected || Boolean(busyLabel) || !targets.length}
              onClick={() => void runTailoring()}
            >
              <Sparkles size={14} /> Propose AI Tailoring Suggestions
            </button>
            <button
              type="button"
              className="career-secondary-button"
              disabled={!connected || Boolean(busyLabel) || !job.description.trim()}
              onClick={() => void runAIJobExtract()}
            >
              <Sparkles size={14} /> AI Extract Job Requirements
            </button>
          </div>
        </div>

        <div className="rs-ai-cap-card">
          <h4>2. AI Writing Assistant</h4>
          <div className="rs-field">
            <label htmlFor="rs-ai-target-select">Bullet or section to improve</label>
            <select
              id="rs-ai-target-select"
              value={activeTarget?.id ?? ""}
              onChange={(e) => setSelectedTargetId(e.target.value)}
              disabled={!targets.length}
            >
              {targets.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}: {t.text.slice(0, 68)}{t.text.length > 68 ? "…" : ""}
                </option>
              ))}
            </select>
          </div>
          {activeTarget && (
            <blockquote className="rs-ai-selected-quote">{activeTarget.text}</blockquote>
          )}
          <div className="rs-ai-action-grid" role="group" aria-label="AI writing assistant actions">
            {WRITING_ACTIONS.map((action) => (
              <button
                key={action.id}
                type="button"
                className="career-secondary-button"
                data-testid={`ai-action-${action.id}`}
                disabled={!connected || Boolean(busyLabel) || !activeTarget}
                onClick={() => void runWritingAction(action.id)}
              >
                <Sparkles size={13} /> {action.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {proposals.length > 0 && (
        <div className="rs-ai-proposals" aria-label="AI proposed changes for review">
          <h4>Review AI Suggestions ({proposals.length})</h4>
          <p className="career-muted">
            Every AI suggestion is validated against your résumé. Review the before/after comparison, page-space impact, and job relevance before accepting.
          </p>
          <ul>
            {proposals.map((item) => {
              const isEditing = editingId === item.id;
              const currentDraft = isEditing ? editDraft : item.proposedText;
              const blocked = hasPlaceholder(currentDraft);
              const previewResume = applyTextReplacement(resume, item.originalText, currentDraft, item.target);
              const pageImpact = measureDeltaLines(resume, settings, previewResume);

              return (
                <li key={item.id} className="rs-suggestion" data-testid="ai-suggestion-card">
                  <div className="rs-suggestion-head">
                    <span className="rs-badge">{item.actionType}</span>
                    <span className="rs-badge">Confidence: {item.confidence}</span>
                    <span className="rs-badge rs-badge-ok">{pageImpact}</span>
                    <strong>{item.relatedRequirement}</strong>
                  </div>
                  <div className="rs-diff">
                    <div>
                      <span>Original</span>
                      <p>{item.originalText}</p>
                    </div>
                    <div>
                      <span>Proposed</span>
                      {isEditing ? (
                        <textarea
                          aria-label="Edit AI proposed text"
                          rows={3}
                          value={editDraft}
                          onChange={(e) => setEditDraft(e.target.value)}
                        />
                      ) : (
                        <p className="rs-proposed">{currentDraft}</p>
                      )}
                    </div>
                  </div>
                  <p className="rs-suggestion-why">
                    <strong>Reason:</strong> {item.reason}
                  </p>
                  <p className="rs-suggestion-source">
                    <strong>Source evidence:</strong> {item.evidenceReference} · <strong>Page-space impact:</strong> {pageImpact} ·{" "}
                    <strong>Job relevance:</strong> {item.relatedRequirement}
                  </p>
                  {blocked && (
                    <p className="rs-suggestion-block" role="note">
                      Replace the [bracketed] placeholders with your real details before applying.
                    </p>
                  )}
                  <div className="rs-suggestion-actions">
                    <button
                      type="button"
                      className="career-quick-create"
                      disabled={blocked || !currentDraft.trim()}
                      onClick={() => {
                        const updated = applyTextReplacement(resume, item.originalText, currentDraft, item.target);
                        onApply({ resume: updated }, `Applied AI suggestion (${item.actionType}). Page fit and match score recalculated.`);
                        setProposals((prev) => prev.filter((p) => p.id !== item.id));
                        setEditingId(null);
                      }}
                    >
                      <Check size={14} /> Accept
                    </button>
                    <button
                      type="button"
                      className="career-secondary-button"
                      aria-pressed={isEditing}
                      onClick={() => {
                        if (isEditing) {
                          setProposals((prev) =>
                            prev.map((p) => (p.id === item.id ? { ...p, proposedText: editDraft } : p)),
                          );
                          setEditingId(null);
                        } else {
                          setEditingId(item.id);
                          setEditDraft(item.proposedText);
                        }
                      }}
                    >
                      <Pencil size={14} /> {isEditing ? "Done editing" : "Edit"}
                    </button>
                    <button
                      type="button"
                      className="career-secondary-button"
                      onClick={() => setProposals((prev) => prev.filter((p) => p.id !== item.id))}
                    >
                      <X size={14} /> Reject
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
