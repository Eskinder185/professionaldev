import { useId, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Bookmark, BadgeCheck, BriefcaseBusiness, ExternalLink, MapPin, Send, ThumbsDown, ThumbsUp, Wand2, X } from "lucide-react";
import { getLocal, setLocal } from "../../hooks/useLocal";
import { GROUP_COPY, type PostingAnalysis } from "./analysis";
import { LABEL, postingAge, type JobPosting } from "./schema";
import { formatSalary } from "./text";
import type { JobWorkspace } from "./useJobWorkspace";

export function CompanyMark({ name, size = 40 }: { name: string; size?: number }) {
  const parts = name.replace(/[^A-Za-z0-9 ]/g, " ").trim().split(/\s+/).filter(Boolean);
  const letters = ((parts[0]?.[0] ?? "?") + (parts[1]?.[0] ?? "")).toUpperCase();
  return (
    <span className="jb-mark" style={{ width: size, height: size, fontSize: size * 0.38 }} aria-hidden="true">
      {letters}
    </span>
  );
}

export function metaChips(p: JobPosting): string[] {
  const chips: string[] = [];
  if (p.employmentType !== "unspecified") chips.push(LABEL.employment[p.employmentType]);
  if (p.workArrangement !== "unspecified") chips.push(LABEL.arrangement[p.workArrangement]);
  return chips;
}

export function VerifiedBadge({ posting }: { posting: JobPosting }) {
  if (!posting.verifiedSource) return null;
  const label = { greenhouse: "Greenhouse", lever: "Lever", ashby: "Ashby" }[posting.source as "greenhouse"] ?? "employer board";
  return (
    <span className="jb-verified" title={`Published on the employer's own ${label} job board. This does not confirm the role is still open.`}>
      <BadgeCheck size={14} aria-hidden="true" /> Employer board
    </span>
  );
}

export function JobRow({ posting, selected, saved, onSelect, onToggleSave, score }: { posting: JobPosting; selected: boolean; saved: boolean; onSelect: () => void; onToggleSave: () => void; score?: number | null }) {
  const salary = formatSalary(posting.salary);
  const age = postingAge(posting.postedAt);
  return (
    <div className={`jb-row ${selected ? "is-selected" : ""}`} data-testid={`job-row-${posting.id}`}>
      <button type="button" role="option" aria-selected={selected} tabIndex={selected ? 0 : -1} className="jb-row-main" onClick={onSelect} data-job-id={posting.id}>
        <CompanyMark name={posting.company} />
        <span className="jb-row-text">
          <strong>{posting.title}</strong>
          <span>{posting.company}</span>
          <span className="jb-row-meta">
            {posting.location && <span>{posting.location}</span>}
            {posting.workArrangement !== "unspecified" && <span>{LABEL.arrangement[posting.workArrangement]}</span>}
            {salary && <span>{salary}</span>}
            {age && <span>{age}</span>}
          </span>
        </span>
        {score != null && <span className="jb-score" title="Evidence-based match with your résumé">{score}</span>}
      </button>
      <button type="button" className={`jb-icon ${saved ? "is-on" : ""}`} aria-pressed={saved} aria-label={saved ? `Remove ${posting.title} from saved` : `Save ${posting.title}`} onClick={onToggleSave}>
        <Bookmark size={17} fill={saved ? "currentColor" : "none"} />
      </button>
    </div>
  );
}

export function JobHeader({ posting, ws, compact }: { posting: JobPosting; ws: JobWorkspace; compact?: boolean }) {
  const saved = ws.state.saved.includes(posting.id);
  const tracked = Boolean(ws.state.tracked[posting.id]);
  const salary = formatSalary(posting.salary);
  const age = postingAge(posting.postedAt);
  return (
    <header className="jb-header">
      <div className="jb-header-top">
        <CompanyMark name={posting.company} size={compact ? 44 : 56} />
        <div className="jb-header-title">
          <h2>{posting.title}</h2>
          <p>
            {posting.company}
            {posting.category && <span className="jb-dot"> · {posting.category}</span>}
          </p>
        </div>
      </div>
      <ul className="jb-facts" aria-label="Posting details">
        {posting.location && <li><MapPin size={14} aria-hidden="true" /> {posting.location}</li>}
        {metaChips(posting).map((c) => <li key={c}><BriefcaseBusiness size={14} aria-hidden="true" /> {c}</li>)}
        {salary && <li className="jb-salary" data-testid="job-salary">{salary}</li>}
        {age && <li>Posted {age}</li>}
        {!posting.postedAt && <li className="jb-muted">Posting date not provided</li>}
        <li><VerifiedBadge posting={posting} /></li>
        {posting.source === "manual" && <li className="jb-muted">Added by you. Details not verified.</li>}
      </ul>
      <div className="jb-actions">
        {posting.applyUrl ? (
          <a className="jb-btn jb-btn-primary" href={posting.applyUrl} target="_blank" rel="noopener noreferrer" data-testid="btn-apply">
            Apply <ExternalLink size={14} aria-hidden="true" />
          </a>
        ) : (
          <span className="jb-muted">No application link provided</span>
        )}
        <button type="button" className="jb-btn" aria-pressed={saved} onClick={() => ws.actions.toggleSave(posting)} data-testid="btn-save-job">
          <Bookmark size={15} fill={saved ? "currentColor" : "none"} aria-hidden="true" /> {saved ? "Saved" : "Save"}
        </button>
        <button type="button" className="jb-btn" onClick={() => ws.actions.track(posting)} disabled={tracked} data-testid="btn-track-job">
          {tracked ? "In tracker" : "Add to tracker"}
        </button>
        <button type="button" className="jb-btn" onClick={() => ws.actions.prepare(posting)} data-testid="btn-prepare-autoapply">
          <Send size={15} aria-hidden="true" /> Prepare in AutoApply
        </button>
      </div>
    </header>
  );
}

const SUMMARY_ITEMS = 6;

function Bullets({ items, limit }: { items: string[]; limit: number | null }) {
  const shown = limit == null ? items : items.slice(0, limit);
  return (
    <>
      <ul className="jb-bullets">{shown.map((t, i) => <li key={i}>{t}</li>)}</ul>
      {limit != null && items.length > limit && <p className="jb-muted">+{items.length - limit} more in the full posting</p>}
    </>
  );
}

/** Long postings stay scannable: Summary shows the first items per section, Full shows the whole text. */
export function JobBody({ posting }: { posting: JobPosting }) {
  const [full, setFull] = useState(false);
  const hasSections = posting.about || posting.requirements.length || posting.responsibilities.length;
  return (
    <div className="jb-body">
      <div className="jb-toggle" role="group" aria-label="Posting view">
        <button type="button" aria-pressed={!full} onClick={() => setFull(false)}>Summary</button>
        <button type="button" aria-pressed={full} onClick={() => setFull(true)}>Full posting</button>
      </div>
      {full || !hasSections ? (
        <section aria-label="Full posting">
          <h3>{hasSections ? "Full posting" : "About the job"}</h3>
          {posting.description ? <p className="jb-pre">{posting.description}</p> : <p className="jb-muted">This posting has no description text. Open the original posting for details.</p>}
        </section>
      ) : (
        <>
          {posting.about && (
            <section><h3>About the job</h3><p className="jb-pre">{posting.about.length > 700 ? `${posting.about.slice(0, 700).trim()}…` : posting.about}</p></section>
          )}
          {posting.responsibilities.length > 0 && <section><h3>Responsibilities</h3><Bullets items={posting.responsibilities} limit={SUMMARY_ITEMS} /></section>}
          {posting.requirements.length > 0 && <section><h3>Requirements</h3><Bullets items={posting.requirements} limit={SUMMARY_ITEMS} /></section>}
        </>
      )}
      {posting.url && (
        <p className="jb-muted">
          Source: <a href={posting.url} target="_blank" rel="noopener noreferrer">original posting</a>. Posting text is shown as plain text.
        </p>
      )}
    </div>
  );
}

function Panel({ title, children, testId }: { title: string; children: ReactNode; testId?: string }) {
  const id = useId();
  return (
    <section className="jb-panel" aria-labelledby={id} data-testid={testId}>
      <h3 id={id}>{title}</h3>
      {children}
    </section>
  );
}

interface Contact { id: string; name: string; relationship: string; company: string; note: string }
const CONTACTS_KEY = "pd:careeros:contacts";

/** Shows only contacts the user entered. CareerOS never looks up employees or invents referrals. */
function Networking({ company }: { company: string }) {
  const [contacts, setContacts] = useState<Contact[]>(() => getLocal<Contact[]>(CONTACTS_KEY, []));
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({ name: "", relationship: "", note: "" });
  const mine = contacts.filter((c) => c.company.trim().toLowerCase() === company.trim().toLowerCase());
  const save = () => {
    if (!draft.name.trim()) return;
    const next = [...contacts, { id: crypto.randomUUID(), name: draft.name.trim(), relationship: draft.relationship.trim(), company, note: draft.note.trim() }];
    setContacts(next);
    setLocal(CONTACTS_KEY, next);
    setDraft({ name: "", relationship: "", note: "" });
    setOpen(false);
  };
  const remove = (id: string) => {
    const next = contacts.filter((c) => c.id !== id);
    setContacts(next);
    setLocal(CONTACTS_KEY, next);
  };
  return (
    <Panel title="Networking (optional)" testId="panel-networking">
      {mine.length ? (
        <ul className="jb-contacts">
          {mine.map((c) => (
            <li key={c.id}><span><strong>{c.name}</strong>{c.relationship && ` · ${c.relationship}`}{c.note && <em> {c.note}</em>}</span><button type="button" className="jb-icon" aria-label={`Remove ${c.name}`} onClick={() => remove(c.id)}><X size={14} /></button></li>
          ))}
        </ul>
      ) : (
        <p className="jb-muted">No contacts saved for {company}. CareerOS doesn’t look up employees or recruiters. Add someone you know and they’ll show up here.</p>
      )}
      {open ? (
        <form className="jb-form" onSubmit={(e) => { e.preventDefault(); save(); }}>
          <label>Name<input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} required /></label>
          <label>How you know them<input value={draft.relationship} onChange={(e) => setDraft({ ...draft, relationship: e.target.value })} /></label>
          <label>Note<input value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} /></label>
          <div className="jb-actions"><button className="jb-btn jb-btn-primary" type="submit">Save contact</button><button className="jb-btn" type="button" onClick={() => setOpen(false)}>Cancel</button></div>
        </form>
      ) : (
        <button type="button" className="jb-btn" onClick={() => setOpen(true)}>Add a contact</button>
      )}
    </Panel>
  );
}

export function AnalysisSidebar({ posting, ws, showFeedback }: { posting: JobPosting; ws: JobWorkspace; showFeedback?: boolean }) {
  const analysis: PostingAnalysis | null = ws.analysisFor(posting);
  const g = analysis?.glance;
  const fb = ws.state.feedback;
  const liked = fb.liked.includes(posting.id);
  const disliked = fb.disliked.includes(posting.id);
  const groups = (["matched", "strengthen", "missing", "review"] as const).map((k) => ({ k, items: analysis?.matches.filter((m) => m.group === k) ?? [] }));
  return (
    <aside className="jb-side" aria-label="Job analysis" data-testid="analysis-sidebar">
      <Panel title="Requirements at a glance" testId="panel-glance">
        <dl className="jb-dl">
          <dt>Experience</dt><dd>{g?.experience ?? <span className="jb-muted">Not stated</span>}{g?.experienceLevel && <span className="jb-tag">{g.experienceLevel === "entry" ? "Entry level" : g.experienceLevel === "mid" ? "Mid level" : "Senior"}</span>}</dd>
          <dt>Education</dt><dd>{g?.education ?? <span className="jb-muted">Not stated</span>}</dd>
          <dt>Certifications</dt><dd>{g?.certifications.length ? g.certifications.join(", ") : <span className="jb-muted">None named</span>}</dd>
          {g?.workAuthorization && (<><dt>Work authorization</dt><dd data-testid="glance-auth">{g.workAuthorization}</dd></>)}
          {g?.other.map((o) => (<><dt key={`${o}-t`}>Other</dt><dd key={o}>{o}</dd></>))}
        </dl>
        {!analysis && <p className="jb-muted">This posting has too little text to extract requirements.</p>}
      </Panel>

      <Panel title="Improve your résumé" testId="panel-improve">
        <label className="jb-select">
          <span>Compare with</span>
          <select value={ws.versionId} onChange={(e) => ws.setVersionId(e.target.value)} aria-label="Résumé version to compare">
            {ws.versions.map((v) => <option key={v.id} value={v.id}>{v.name}{v.kind === "tailored" ? " (tailored)" : ""}</option>)}
          </select>
        </label>
        {analysis ? (
          <>
            <div className="jb-coverage" data-testid="coverage">
              <strong>{analysis.coverage.supported} of {analysis.coverage.total}</strong> requirements supported
              <div className="jb-bar" role="img" aria-label={`${analysis.coverage.percent} percent supported`}><span style={{ width: `${analysis.coverage.percent}%` }} /></div>
              <small>Match {analysis.score}/100 · CareerOS estimate from your résumé text, not an employer score.</small>
            </div>
            {groups.map(({ k, items }) => items.length > 0 && (
              <details key={k} className={`jb-group jb-group-${k}`} open={k !== "matched"} data-testid={`group-${k}`}>
                <summary>{GROUP_COPY[k].label} <span>{items.length}</span></summary>
                <p className="jb-muted">{GROUP_COPY[k].hint}</p>
                <ul>
                  {items.map((m) => (
                    <li key={m.requirement.id}><strong>{m.requirement.term}</strong>
                      {m.evidence[0] && <small>{m.evidence[0].section}: {m.evidence[0].text.slice(0, 110)}</small>}
                    </li>
                  ))}
                </ul>
              </details>
            ))}
          </>
        ) : (
          <p className="jb-muted">No analysis: this posting has no usable requirement text.</p>
        )}
        <Link className="jb-btn jb-btn-primary jb-block" to={`/resume?tailorJob=${encodeURIComponent(posting.id)}`} data-testid="btn-tailor">
          <Wand2 size={15} aria-hidden="true" /> Tailor résumé
        </Link>
        <p className="jb-muted">Opens a one-page draft built only from your Master Profile. You accept or reject every change.</p>
      </Panel>

      {posting.benefits.length > 0 && (
        <Panel title="Benefits" testId="panel-benefits">
          <p className="jb-muted">Listed by the employer.</p>
          <ul className="jb-bullets">{posting.benefits.slice(0, 12).map((b, i) => <li key={i}>{b}</li>)}</ul>
        </Panel>
      )}

      <Panel title="History" testId="panel-history">
        <p className="jb-muted">Posting history isn’t available. CareerOS only knows what this posting says{posting.postedAt ? ` (published ${new Date(posting.postedAt).toLocaleDateString()})` : ""}.</p>
      </Panel>

      {showFeedback && (
        <Panel title="Would you like more jobs like this?" testId="panel-feedback">
          <div className="jb-actions">
            <button type="button" className={`jb-btn ${liked ? "jb-btn-on" : ""}`} aria-pressed={liked} onClick={() => ws.actions.feedback(posting, liked ? "clear" : "like")} data-testid="feedback-yes"><ThumbsUp size={15} aria-hidden="true" /> Yes</button>
            <button type="button" className={`jb-btn ${disliked ? "jb-btn-on" : ""}`} aria-pressed={disliked} onClick={() => ws.actions.feedback(posting, disliked ? "clear" : "dislike")} data-testid="feedback-no"><ThumbsDown size={15} aria-hidden="true" /> No</button>
          </div>
          <p className="jb-muted">Saved on this device and used to rank your feed.</p>
        </Panel>
      )}

      <Networking company={posting.company} />
    </aside>
  );
}

export function SkeletonRows({ count = 5 }: { count?: number }) {
  return (
    <div className="jb-skeleton-list" role="status" aria-label="Loading jobs">
      {Array.from({ length: count }, (_, i) => <div className="jb-skeleton" key={i} />)}
    </div>
  );
}
