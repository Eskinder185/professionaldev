import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Pencil, X } from "lucide-react";
import type { DocumentSettings, JobTarget, Resume } from "../model/types";
import { SCORE_METHOD, diffMatches, matchResume, type MatchGroup, type MatchResult, type RequirementMatch } from "./match";
import { KIND_LABELS, buildSuggestions, hasPlaceholder, type Suggestion } from "./suggestions";

const GROUPS: { key: MatchGroup; title: string; description: string }[] = [
  { key: "matched", title: "Requirements matched", description: "Selected requirements backed by résumé content." },
  { key: "strengthen", title: "Requirements to strengthen", description: "Listed without an example, or confirmed by you but not yet described." },
  { key: "missing", title: "Requirements not demonstrated", description: "Not established by the résumé." },
  { key: "review", title: "Needs review", description: "Ambiguous, or not something text matching can judge." },
];

const STATUS_LABELS: Record<RequirementMatch["status"], string> = {
  demonstrated: "Demonstrated",
  equivalent: "Credible equivalent",
  mentioned: "Mentioned only",
  missing: "Not found",
  insufficient: "Can't judge automatically",
};

function Bar({ label, value, detail }: { label: string; value: number; detail: string }) {
  return (
    <div className="rs-bar">
      <div className="rs-bar-head">
        <span>{label}</span>
        <strong>{detail}</strong>
      </div>
      <div className="rs-bar-track" role="presentation">
        <span style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
      </div>
    </div>
  );
}

function SuggestionCard({ suggestion, onAccept, onReject }: { suggestion: Suggestion; onAccept: (text: string) => void; onReject: () => void }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(suggestion.proposed);
  useEffect(() => setText(suggestion.proposed), [suggestion.proposed]);
  const blocked = Boolean(suggestion.apply) && hasPlaceholder(text);
  return (
    <li className={`rs-suggestion ${suggestion.apply ? "" : "is-advice"}`}>
      <div className="rs-suggestion-head">
        <span className="rs-badge">{KIND_LABELS[suggestion.kind]}</span>
        <span className="rs-badge rs-badge-ok">{suggestion.pageImpact}</span>
        <strong>{suggestion.title}</strong>
      </div>
      <div className="rs-diff">
        <div>
          <span>Current</span>
          <p>{suggestion.current}</p>
        </div>
        <div>
          <span>Proposed</span>
          {editing ? <textarea aria-label={`Edit proposed text for ${suggestion.title}`} rows={4} value={text} onChange={(event) => setText(event.target.value)} /> : <p className="rs-proposed">{text}</p>}
        </div>
      </div>
      <p className="rs-suggestion-why">{suggestion.explanation}</p>
      <p className="rs-suggestion-source">
        Based on: {suggestion.evidence} · Page-space impact: {suggestion.pageImpact} · Job relevance: {suggestion.relevance}
      </p>
      {blocked ? <p className="rs-suggestion-block" role="note">Replace the [bracketed] placeholders with what really happened before applying.</p> : null}
      <div className="rs-suggestion-actions">
        {suggestion.apply ? (
          <>
            <button type="button" className="career-quick-create" disabled={blocked || !text.trim()} onClick={() => onAccept(text)}>
              <Check size={14} /> Accept
            </button>
            <button type="button" className="career-secondary-button" aria-pressed={editing} onClick={() => setEditing(!editing)}>
              <Pencil size={14} /> {editing ? "Done editing" : "Edit"}
            </button>
          </>
        ) : null}
        <button type="button" className="career-secondary-button" onClick={onReject}>
          <X size={14} /> {suggestion.apply ? "Reject" : "Dismiss"}
        </button>
      </div>
    </li>
  );
}

type Props = {
  resume: Resume;
  settings: DocumentSettings;
  job: JobTarget;
  pageCount: number;
  onApply: (change: { resume?: Resume; settings?: DocumentSettings }, message: string) => void;
  onJobChange: (job: JobTarget) => void;
};

export default function MatchPanel({ resume, settings, job, pageCount, onApply, onJobChange }: Props) {
  const result = useMemo(() => matchResume(resume, job.requirements, settings, pageCount), [resume, job.requirements, settings, pageCount]);
  const previous = useRef<MatchResult | null>(null);
  const [changes, setChanges] = useState<{ from: number; to: number; lines: string[] } | null>(null);
  useEffect(() => {
    const lines = diffMatches(previous.current, result);
    if (previous.current && (lines.length || previous.current.score !== result.score)) setChanges({ from: previous.current.score, to: result.score, lines });
    previous.current = result;
  }, [result]);

  const rejected = new Set(job.rejectedSuggestions ?? []);
  const suggestions = useMemo(() => buildSuggestions(resume, settings, result), [resume, settings, result]).filter((suggestion) => !rejected.has(suggestion.key));

  if (!job.requirements.some((item) => item.selected))
    return <p className="career-muted">Analyze a job description and keep at least one requirement selected to see the match analysis.</p>;

  const missingOrUnverified = result.matches.filter((match) => match.group === "missing" || match.group === "review" || (match.group === "strengthen" && match.status === "missing"));

  return (
    <section className="rs-match" aria-labelledby="rs-match-title">
      <div className="rs-score">
        <div>
          <h3 id="rs-match-title">Job Description Match Score</h3>
          <p className="career-muted">Internal heuristic for this posting, not a score from an employer's ATS. A high score does not guarantee an interview.</p>
        </div>
        <p className="rs-score-value" aria-live="polite">
          <strong>{result.score}</strong>
          <span>/ 100</span>
        </p>
      </div>
      {changes ? (
        <div className="rs-score-change" role="status">
          <strong>
            Score {changes.to === changes.from ? "unchanged" : `changed from ${changes.from} to ${changes.to}`}
          </strong>
          {changes.lines.length ? (
            <ul>
              {changes.lines.slice(0, 6).map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
      <div className="rs-bars">
        <Bar label="Requirement coverage (weighted)" value={result.coverage} detail={`${result.coverage}%`} />
        <Bar label="Required qualifications met" value={result.requiredCoverage.total ? (result.requiredCoverage.met / result.requiredCoverage.total) * 100 : 0} detail={`${result.requiredCoverage.met} of ${result.requiredCoverage.total}`} />
        <Bar label="Preferred qualifications met" value={result.preferredCoverage.total ? (result.preferredCoverage.met / result.preferredCoverage.total) * 100 : 0} detail={`${result.preferredCoverage.met} of ${result.preferredCoverage.total}`} />
        <Bar label="Evidence quality" value={result.evidenceQuality} detail={`${result.evidenceQuality}%`} />
      </div>
      <p className="rs-doc-quality">
        Document quality (separate, not in the score): <strong>{result.documentQuality.passed} of {result.documentQuality.total}</strong> formatting checks passed.
      </p>
      <details className="rs-method">
        <summary>How this score is calculated</summary>
        <ol>
          {SCORE_METHOD.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ol>
      </details>

      {missingOrUnverified.length ? (
        <div className="rs-unverified">
          <h4>Missing or unverified</h4>
          <p>{missingOrUnverified.map((match) => match.requirement.term).join(", ")}</p>
        </div>
      ) : null}

      {GROUPS.map((group) => {
        const items = result.matches.filter((match) => match.group === group.key);
        return (
          <details className={`rs-match-group rs-group-${group.key}`} key={group.key} open={group.key !== "matched" && items.length > 0 && items.length < 12}>
            <summary>
              {group.title} <span>{items.length}</span>
            </summary>
            <p className="career-muted">{group.description}</p>
            {items.length ? (
              <ul>
                {items.map((match) => (
                  <li key={match.requirement.id}>
                    <div className="rs-match-line">
                      <strong>{match.requirement.term}</strong>
                      <span className={`rs-status rs-status-${match.status}`}>{STATUS_LABELS[match.status]}</span>
                    </div>
                    <p>{match.explanation}</p>
                    {match.evidence.map((item) => (
                      <blockquote key={`${item.section}-${item.text}`}>
                        <span>{item.section} · {item.label}</span>
                        {item.text}
                      </blockquote>
                    ))}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="career-muted">None.</p>
            )}
          </details>
        );
      })}

      <section className="rs-suggestions" aria-labelledby="rs-suggestions-title">
        <h3 id="rs-suggestions-title">Suggested changes</h3>
        <p className="career-muted">Rule-based suggestions, prepared from your answers and résumé content. Nothing changes until you accept. Skills are only proposed where you said “I have this”.</p>
        {suggestions.length ? (
          <ul>
            {suggestions.map((suggestion) => (
              <SuggestionCard
                key={suggestion.key}
                suggestion={suggestion}
                onAccept={(text) => {
                  if (!suggestion.apply) return;
                  onApply(suggestion.apply(text, resume, settings), `Applied: ${KIND_LABELS[suggestion.kind]} (${suggestion.title}). The match analysis was recalculated.`);
                }}
                onReject={() => onJobChange({ ...job, rejectedSuggestions: [...(job.rejectedSuggestions ?? []), suggestion.key] })}
              />
            ))}
          </ul>
        ) : (
          <p className="career-muted">No suggestions right now. Answer “I have this” or “I don't” on requirements to get placement advice.</p>
        )}
        {rejected.size ? (
          <button type="button" className="rs-link-button" onClick={() => onJobChange({ ...job, rejectedSuggestions: [] })}>
            Show {rejected.size} rejected suggestion{rejected.size === 1 ? "" : "s"} again
          </button>
        ) : null}
      </section>
    </section>
  );
}
