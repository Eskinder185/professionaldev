import { useEffect, useId, useMemo, useState, type FormEvent } from "react";
import { Check, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import type { JobTarget, Possession, Requirement, RequirementKind } from "../model/types";
import { groupByCategory } from "./extractRequirements";
import { KIND_LABELS, addRequirement, analyzeJob, emptyJob, removeRequirement, renameCategory, requirementSummary, updateRequirement } from "./requirements";

type Filter = "all" | RequirementKind | "unanswered" | "flagged";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All requirements" },
  { value: "required", label: "Required" },
  { value: "preferred", label: "Preferred" },
  { value: "responsibility", label: "Responsibilities" },
  { value: "context", label: "General context" },
  { value: "unanswered", label: "Not answered yet" },
  { value: "flagged", label: "Flagged for review" },
];

const POSSESSION_OPTIONS: { value: Exclude<Possession, "unanswered">; label: string }[] = [
  { value: "has", label: "I have this" },
  { value: "not", label: "I don't" },
  { value: "uncertain", label: "Not sure" },
];

function highlight(snippet: string, phrases: string[]) {
  const phrase = phrases.find((item) => snippet.toLowerCase().includes(item.toLowerCase()));
  if (!phrase) return snippet;
  const index = snippet.toLowerCase().indexOf(phrase.toLowerCase());
  return (
    <>
      {snippet.slice(0, index)}
      <mark>{snippet.slice(index, index + phrase.length)}</mark>
      {snippet.slice(index + phrase.length)}
    </>
  );
}

function CategoryInput({ value, term, listId, onCommit }: { value: string; term: string; listId: string; onCommit: (value: string) => void }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const commit = () => {
    if (draft.trim() && draft.trim() !== value) onCommit(draft.trim());
    else setDraft(value);
  };
  return (
    <input
      className="rs-req-category"
      aria-label={`Category for ${term}`}
      list={listId}
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          commit();
        }
      }}
    />
  );
}

function RequirementRow({ item, listId, onChange, onRemove }: { item: Requirement; listId: string; onChange: (change: Partial<Requirement>) => void; onRemove: () => void }) {
  const checkboxId = useId();
  return (
    <li className={`rs-req ${item.selected ? "" : "is-excluded"}`}>
      <div className="rs-req-top">
        <input id={checkboxId} type="checkbox" checked={item.selected} onChange={(event) => onChange({ selected: event.target.checked })} aria-label={`Check ${item.term} for coverage`} />
        <label htmlFor={checkboxId} className="rs-req-term">
          {item.term}
        </label>
        {item.uncertain ? <span className="rs-badge rs-badge-warn">Check this</span> : null}
        {item.origin === "user" ? <span className="rs-badge">Added by you</span> : null}
        <button type="button" className="rs-icon-button rs-danger" aria-label={`Remove ${item.term}`} onClick={onRemove}>
          <Trash2 size={13} />
        </button>
      </div>
      <div className="rs-req-controls">
        <select aria-label={`Requirement type for ${item.term}`} value={item.kind} onChange={(event) => onChange({ kind: event.target.value as RequirementKind })}>
          {(Object.keys(KIND_LABELS) as RequirementKind[]).map((kind) => (
            <option key={kind} value={kind}>
              {KIND_LABELS[kind]}
            </option>
          ))}
        </select>
        <CategoryInput value={item.category} term={item.term} listId={listId} onCommit={(category) => onChange({ category })} />
      </div>
      <div className="rs-possession" role="radiogroup" aria-label={`Do you have ${item.term}?`}>
        {POSSESSION_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={item.possession === option.value}
            className={item.possession === option.value ? `selected ${option.value}` : ""}
            onClick={() => onChange({ possession: item.possession === option.value ? "unanswered" : option.value })}
          >
            {item.possession === option.value ? <Check size={12} aria-hidden="true" /> : null}
            {option.label}
          </button>
        ))}
      </div>
      {item.snippets.length || item.phrases.length ? (
        <details className="rs-req-source">
          <summary>From the job description</summary>
          {item.phrases.length && item.phrases.some((phrase) => phrase.toLowerCase() !== item.term.toLowerCase()) ? (
            <p>
              Wording found: {item.phrases.map((phrase) => `“${phrase}”`).join(", ")}
            </p>
          ) : null}
          {item.snippets.map((snippet) => (
            <blockquote key={snippet}>{highlight(snippet, item.phrases)}</blockquote>
          ))}
        </details>
      ) : null}
    </li>
  );
}

function CategoryHeading({ name, count, onRename }: { name: string; count: number; onRename: (name: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  useEffect(() => setDraft(name), [name]);
  if (editing)
    return (
      <form
        className="rs-req-rename"
        onSubmit={(event) => {
          event.preventDefault();
          onRename(draft);
          setEditing(false);
        }}
      >
        <input aria-label={`Rename category ${name}`} value={draft} autoFocus onChange={(event) => setDraft(event.target.value)} />
        <button type="submit" className="rs-icon-button" aria-label="Save category name">
          <Check size={13} />
        </button>
        <button type="button" className="rs-icon-button" aria-label="Cancel renaming" onClick={() => { setDraft(name); setEditing(false); }}>
          <X size={13} />
        </button>
      </form>
    );
  return (
    <div className="rs-req-group-head">
      <h4>
        {name} <span>{count}</span>
      </h4>
      <button type="button" className="rs-icon-button" aria-label={`Rename category ${name}`} onClick={() => setEditing(true)}>
        <Pencil size={13} />
      </button>
    </div>
  );
}

type Props = { job: JobTarget | undefined; title: string; onChange: (job: JobTarget) => void; onTitleChange: (title: string) => void; onStatus: (message: string) => void; onShowMatch?: () => void };

export default function JobRequirementsPanel({ job: stored, title, onChange, onTitleChange, onStatus, onShowMatch }: Props) {
  const job = stored ?? emptyJob();
  const [filter, setFilter] = useState<Filter>("all");
  const [newTerm, setNewTerm] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [newKind, setNewKind] = useState<RequirementKind>("required");
  const listId = useId();
  const descriptionId = useId();
  const categories = useMemo(() => [...new Set(job.requirements.map((item) => item.category))], [job.requirements]);
  const summary = requirementSummary(job.requirements);
  const stale = Boolean(job.analyzedAt) && job.analyzedDescription !== job.description;

  const visible = job.requirements.filter((item) => {
    if (filter === "all") return true;
    if (filter === "unanswered") return item.selected && item.possession === "unanswered";
    if (filter === "flagged") return Boolean(item.uncertain);
    return item.kind === filter;
  });
  const groups = groupByCategory(visible);

  const analyze = () => {
    const next = analyzeJob({ ...job, title });
    onChange(next);
    const added = next.requirements.filter((item) => item.origin === "detected").length;
    onStatus(added ? `Found ${added} requirement${added === 1 ? "" : "s"} in the job description. All are selected for review.` : "No recognizable requirements were found. You can add them manually.");
  };

  const add = (event: FormEvent) => {
    event.preventDefault();
    if (!newTerm.trim()) return;
    onChange(addRequirement(job, newTerm, newCategory || "Added by me", newKind));
    onStatus(`Added “${newTerm.trim()}”.`);
    setNewTerm("");
  };

  return (
    <section className="rs-job" aria-labelledby="rs-job-title">
      <h3 id="rs-job-title">Job description</h3>
      <div className="rs-two">
        <div className="rs-field">
          <label htmlFor={`${descriptionId}-company`}>Target company</label>
          <input
            id={`${descriptionId}-company`}
            value={job.company ?? ""}
            onChange={(event) => onChange({ ...job, company: event.target.value })}
            placeholder="e.g. Amazon"
          />
        </div>
        <div className="rs-field">
          <label htmlFor={`${descriptionId}-role`}>Target job title</label>
          <input id={`${descriptionId}-role`} value={title} onChange={(event) => onTitleChange(event.target.value)} placeholder="e.g. IT Support Specialist" />
        </div>
      </div>
      <div className="rs-field">
        <label htmlFor={descriptionId}>Paste the job description</label>
        <textarea id={descriptionId} rows={8} value={job.description} onChange={(event) => onChange({ ...job, description: event.target.value })} placeholder="Paste the full posting: responsibilities, requirements, and preferred qualifications." />
      </div>
      <button type="button" className="career-quick-create rs-analyze" disabled={!job.description.trim()} onClick={analyze}>
        <Search size={15} /> {job.analyzedAt ? "Re-analyze requirements" : "Analyze requirements"}
      </button>
      {stale ? <p className="rs-notice" role="note">The description changed after the last analysis. Re-analyze to update; your answers and added requirements are kept.</p> : null}
      <p className="career-muted">Found with a built-in skill dictionary and wording rules, in this browser. Review every item. Your answers here never change the résumé.</p>

      {job.metadata && (job.metadata.company || job.metadata.location || job.metadata.workMode || job.metadata.compensation || job.metadata.employmentType) ? (
        <div className="rs-job-meta" aria-label="Detected job metadata">
          <strong>Detected posting metadata (excluded from skill scoring):</strong>
          <div className="rs-job-meta-chips">
            {job.metadata.company ? <span className="rs-badge">Company: {job.metadata.company}</span> : null}
            {job.metadata.location ? <span className="rs-badge">Location: {job.metadata.location}</span> : null}
            {job.metadata.workMode ? <span className="rs-badge">Work mode: {job.metadata.workMode}</span> : null}
            {job.metadata.compensation ? <span className="rs-badge">Compensation: {job.metadata.compensation}</span> : null}
            {job.metadata.employmentType ? <span className="rs-badge">Type: {job.metadata.employmentType}</span> : null}
          </div>
        </div>
      ) : null}

      {job.analyzedAt || job.requirements.length ? (
        <>
          <div className="rs-req-summary" aria-live="polite">
            <p>
              <strong>{summary.selected}</strong> of {summary.total} selected · {summary.required} required · {summary.preferred} preferred · {summary.responsibilities} responsibilities
            </p>
            <p className="career-muted">
              You have {summary.has} · don't have {summary.not} · not sure {summary.uncertain} · not answered {summary.unanswered}
            </p>
          </div>
          {onShowMatch && summary.selected ? (
            <button type="button" className="career-secondary-button rs-to-match" onClick={onShowMatch}>
              See match analysis and suggestions
            </button>
          ) : null}
          <div className="rs-req-toolbar">
            <div className="rs-field">
              <label htmlFor={`${descriptionId}-filter`}>Show</label>
              <select id={`${descriptionId}-filter`} value={filter} onChange={(event) => setFilter(event.target.value as Filter)}>
                {FILTERS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="rs-req-bulk">
              <button type="button" className="rs-link-button" onClick={() => onChange({ ...job, requirements: job.requirements.map((item) => ({ ...item, selected: true })) })}>
                Select all
              </button>
              <button type="button" className="rs-link-button" onClick={() => onChange({ ...job, requirements: job.requirements.map((item) => ({ ...item, selected: false })) })}>
                Clear selection
              </button>
            </div>
          </div>
          <datalist id={listId}>
            {categories.map((category) => (
              <option key={category} value={category} />
            ))}
          </datalist>
          {groups.length ? (
            groups.map((group) => (
              <div className="rs-req-group" key={group.category}>
                <CategoryHeading name={group.category} count={group.items.length} onRename={(name) => onChange(renameCategory(job, group.category, name))} />
                <ul>
                  {group.items.map((item) => (
                    <RequirementRow
                      key={item.id}
                      item={item}
                      listId={listId}
                      onChange={(change) => onChange(updateRequirement(job, item.id, change))}
                      onRemove={() => {
                        onChange(removeRequirement(job, item.id));
                        onStatus(`Removed “${item.term}”. Re-analysis will not add it back.`);
                      }}
                    />
                  ))}
                </ul>
              </div>
            ))
          ) : (
            <p className="career-muted">{job.requirements.length ? "No requirements match this filter." : "No recognizable requirements were found in this description. Add the ones that matter below."}</p>
          )}
          <form className="rs-req-add" onSubmit={add}>
            <h4>Add a requirement</h4>
            <div className="rs-field">
              <label htmlFor={`${descriptionId}-new`}>Requirement</label>
              <input id={`${descriptionId}-new`} value={newTerm} onChange={(event) => setNewTerm(event.target.value)} placeholder="e.g. Jamf" />
            </div>
            <div className="rs-two">
              <div className="rs-field">
                <label htmlFor={`${descriptionId}-new-cat`}>Category</label>
                <input id={`${descriptionId}-new-cat`} list={listId} value={newCategory} onChange={(event) => setNewCategory(event.target.value)} placeholder="Added by me" />
              </div>
              <div className="rs-field">
                <label htmlFor={`${descriptionId}-new-kind`}>Type</label>
                <select id={`${descriptionId}-new-kind`} value={newKind} onChange={(event) => setNewKind(event.target.value as RequirementKind)}>
                  {(Object.keys(KIND_LABELS) as RequirementKind[]).map((kind) => (
                    <option key={kind} value={kind}>
                      {KIND_LABELS[kind]}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <button type="submit" className="career-secondary-button" disabled={!newTerm.trim()}>
              <Plus size={14} /> Add requirement
            </button>
          </form>
        </>
      ) : null}
    </section>
  );
}
