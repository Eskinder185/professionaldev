import { useState, type ReactNode } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { Badge, Card, type Tone } from "./ui";
import { useModel } from "./lib/context";
import { aiAvailability, aiLabel } from "./lib/ai";
import { clearUiData, dispatch, openUrl } from "./lib/bridge";
import { formatWhen } from "./lib/model";
import type { StandardProfileFieldKey } from "../../../../packages/careeros-shared/types";

type Section = {
  id: string;
  title: string;
  keys: Array<{ key: StandardProfileFieldKey; label: string; type?: string }>;
};

const SECTIONS: Section[] = [
  { id: "personal", title: "Personal details", keys: [{ key: "firstName", label: "First name" }, { key: "lastName", label: "Last name" }, { key: "preferredName", label: "Preferred name" }, { key: "headline", label: "Headline" }] },
  { id: "contact", title: "Contact information", keys: [{ key: "email", label: "Email", type: "email" }, { key: "phone", label: "Phone", type: "tel" }, { key: "city", label: "City" }, { key: "state", label: "State / region" }, { key: "country", label: "Country" }] },
  { id: "links", title: "Links", keys: [{ key: "linkedin", label: "LinkedIn", type: "url" }, { key: "github", label: "GitHub", type: "url" }, { key: "website", label: "Website", type: "url" }] },
];

type FieldState = "verified" | "unconfirmed" | "missing";

export default function ProfileTab() {
  const m = useModel();
  const { state } = m;
  const shared = state?.sharedProfile ?? null;
  const unconfirmed = new Set(state?.unconfirmedProfileFields ?? []);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState("");

  const stateOf = (key: string, value: string | undefined): FieldState =>
    !value?.trim() ? "missing" : unconfirmed.has(key) || !shared?.sharedFields.includes(key as StandardProfileFieldKey) ? "unconfirmed" : "verified";

  const sectionTone = (states: FieldState[]): { tone: Tone; label: string } => {
    if (states.some((s) => s === "unconfirmed")) return { tone: "warning", label: "Unconfirmed edits" };
    if (states.every((s) => s === "missing")) return { tone: "danger", label: "Missing" };
    if (states.some((s) => s === "missing")) return { tone: "info", label: "Partly missing" };
    return { tone: "success", label: "Verified" };
  };

  const save = async (payload: Record<string, unknown>, okText: string) => {
    const res = await dispatch("UPDATE_SHARED_PROFILE", payload);
    setMsg(res.ok ? okText : res.error?.message ?? "Could not update.");
    setEditing(null);
    await m.refresh();
  };

  const startEdit = (id: string, initial: Record<string, string>) => {
    setDraft(initial);
    setEditing(id);
  };

  const confirmDelete = (what: string) => window.confirm(`Delete ${what} from the extension? Your data in CareerOS is not affected.`);

  const syncBlock = (
    <Card id="sync" title="Sync with CareerOS" testId="profile-sync" badge={shared ? (unconfirmed.size ? <Badge tone="warning">{unconfirmed.size} unconfirmed</Badge> : <Badge tone="success">In sync</Badge>) : <Badge tone="danger">Not synced</Badge>}>
      <dl className="facts">
        <div><dt>Last synced</dt><dd data-testid="sync-last">{formatWhen(state?.lastSyncedAt ?? shared?.approvedAt ?? null)}</dd></div>
        <div><dt>Connected site</dt><dd>{state?.connectedOrigin ?? "Not connected"}</dd></div>
        <div><dt>Shared fields</dt><dd data-testid="sync-count">{shared?.sharedFields.length ?? 0}</dd></div>
        <div><dt>AI connection</dt><dd data-testid="ai-status">{aiLabel(state?.aiConnection ?? null)}</dd></div>
      </dl>
      {state?.aiConnection ? <p className="meta">{aiAvailability(state.aiConnection).kind === "ready" ? "Drafting runs on this device after you confirm what is sent." : aiAvailability(state.aiConnection).kind === "needs-careeros" ? (aiAvailability(state.aiConnection) as { reason: string }).reason : "AI drafting isn’t available right now."}</p> : <p className="meta">Connect Ollama or LM Studio in CareerOS → AI Connections, then press Sync.</p>}
      <p className="meta">The extension keeps only the fields you approved in CareerOS. Edits made here stay in the extension and are marked unconfirmed until you update CareerOS.</p>
      <div className="btn-grid">
        <button type="button" className="btn btn-secondary" onClick={() => openUrl(`${m.base}/autoapply`)}>Open CareerOS to sync</button>
        <button
          type="button"
          className="btn btn-danger-outline"
          data-testid="btn-delete-all"
          onClick={async () => {
            if (!window.confirm("Delete ALL data shared with the extension (profile, queue, analyses, drafts)? Your data in CareerOS is not affected.")) return;
            await dispatch("CLEAR_SHARED_DATA", {});
            await clearUiData();
            setMsg("All shared data was deleted from the extension.");
            await m.refresh();
          }}
        >
          <Trash2 size={14} aria-hidden /> Delete shared data
        </button>
      </div>
      {msg ? <p className="meta" role="status" data-testid="profile-message">{msg}</p> : null}
    </Card>
  );

  if (!shared) {
    return (
      <div className="stack">
        {syncBlock}
        <Card id="profile-empty" title="Profile" testId="profile-empty">
          <div className="empty">
            <p className="empty-title">No profile shared yet</p>
            <p className="muted">Choose which profile fields to share in CareerOS → AutoApply, then press Sync. Nothing is copied automatically.</p>
          </div>
        </Card>
      </div>
    );
  }

  const value = (k: StandardProfileFieldKey) => shared.values[k] ?? "";

  const scalarSection = (s: Section) => {
    const states = s.keys.map((k) => stateOf(k.key, value(k.key)));
    const tone = sectionTone(states);
    const isEditing = editing === s.id;
    return (
      <Card key={s.id} id={s.id} title={s.title} testId={`profile-${s.id}`} badge={<Badge tone={tone.tone}>{tone.label}</Badge>}
        actions={!isEditing ? <button type="button" className="icon-btn" aria-label={`Edit ${s.title}`} onClick={() => startEdit(s.id, Object.fromEntries(s.keys.map((k) => [k.key, value(k.key)])))}><Pencil size={15} aria-hidden /></button> : undefined}>
        {isEditing ? (
          <form className="stack-sm" onSubmit={(e) => { e.preventDefault(); const changed: Record<string, string> = {}; for (const k of s.keys) if ((draft[k.key] ?? "") !== value(k.key)) changed[k.key] = draft[k.key] ?? ""; void save({ values: changed }, `${s.title} saved in the extension (unconfirmed).`); }}>
            {s.keys.map((k) => (
              <div className="field" key={k.key}>
                <label className="label" htmlFor={`pf-${k.key}`}>{k.label}</label>
                <input id={`pf-${k.key}`} className="input" type={k.type ?? "text"} value={draft[k.key] ?? ""} onChange={(e) => setDraft((d) => ({ ...d, [k.key]: e.target.value }))} />
              </div>
            ))}
            <div className="btn-grid">
              <button type="submit" className="btn btn-primary">Save</button>
              <button type="button" className="btn btn-secondary" onClick={() => setEditing(null)}>Cancel</button>
            </div>
          </form>
        ) : (
          <>
            <dl className="facts">
              {s.keys.map((k, i) => (
                <div key={k.key}>
                  <dt>{k.label}</dt>
                  <dd data-testid={`pv-${k.key}`}>{value(k.key) || <span className="missing">Missing</span>} {states[i] === "unconfirmed" ? <Badge tone="warning">Unconfirmed</Badge> : null}</dd>
                </div>
              ))}
            </dl>
            <button type="button" className="btn btn-link btn-danger-link" onClick={() => { if (confirmDelete(s.title)) void save({ removeFields: s.keys.map((k) => k.key) }, `${s.title} deleted from the extension.`); }}>Delete this section’s data</button>
          </>
        )}
      </Card>
    );
  };

  const listSection = (id: string, title: string, items: ReactNode[], clear: "experience" | "education", emptyText: string, fieldKeys: StandardProfileFieldKey[]) => (
    <Card key={id} id={id} title={title} testId={`profile-${id}`} badge={<Badge tone={items.length ? "success" : "danger"}>{items.length ? `${items.length} verified` : "Missing"}</Badge>}>
      {items.length ? <ul className="plain-list">{items}</ul> : <p className="muted">{emptyText}</p>}
      <div className="btn-grid">
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => openUrl(`${m.base}/resume`)}>Edit in CareerOS</button>
        <button type="button" className="btn btn-link btn-danger-link" onClick={() => { if (confirmDelete(title)) void save({ clearSections: [clear], removeFields: fieldKeys }, `${title} deleted from the extension.`); }}>Delete</button>
      </div>
    </Card>
  );

  const listEdit = (id: "skills" | "certifications", title: string, items: string[]) => {
    const isEditing = editing === id;
    const st: FieldState = items.length === 0 ? "missing" : unconfirmed.has(id) ? "unconfirmed" : "verified";
    const tone = sectionTone([st]);
    return (
      <Card key={id} id={id} title={title} testId={`profile-${id}`} badge={<Badge tone={tone.tone}>{tone.label}</Badge>}
        actions={!isEditing ? <button type="button" className="icon-btn" aria-label={`Edit ${title}`} onClick={() => startEdit(id, { text: items.join("\n") })}><Pencil size={15} aria-hidden /></button> : undefined}>
        {isEditing ? (
          <form className="stack-sm" onSubmit={(e) => { e.preventDefault(); const list = (draft.text ?? "").split(/\n|,/).map((x) => x.trim()).filter(Boolean); void save({ [id]: list }, `${title} saved in the extension (unconfirmed).`); }}>
            <div className="field">
              <label className="label" htmlFor={`pl-${id}`}>{title} (one per line)</label>
              <textarea id={`pl-${id}`} className="input textarea" rows={5} value={draft.text ?? ""} onChange={(e) => setDraft({ text: e.target.value })} />
            </div>
            <div className="btn-grid">
              <button type="submit" className="btn btn-primary">Save</button>
              <button type="button" className="btn btn-secondary" onClick={() => setEditing(null)}>Cancel</button>
            </div>
          </form>
        ) : (
          <>
            {items.length ? <div className="chips">{items.map((s) => <Badge key={s}>{s}</Badge>)}</div> : <p className="muted">None shared.</p>}
            <button type="button" className="btn btn-link btn-danger-link" onClick={() => { if (confirmDelete(title)) void save({ clearSections: [id] }, `${title} deleted from the extension.`); }}>Delete</button>
          </>
        )}
      </Card>
    );
  };

  const experience = (shared.experience ?? []).map((e, i) => (
    <li key={i}><strong>{e.title}</strong> · {e.employer}<br /><span className="meta">{e.startDate}–{e.current ? "Present" : e.endDate}{e.location ? ` · ${e.location}` : ""}</span></li>
  ));
  const education = (shared.education ?? []).map((e, i) => (
    <li key={i}><strong>{e.degree}{e.field ? `, ${e.field}` : ""}</strong> · {e.institution}<br /><span className="meta">{e.endDate}</span></li>
  ));

  const answers = Object.entries(shared.preparedAnswers ?? {});
  const consentKeys = shared.sharedFields;

  return (
    <div className="stack">
      {syncBlock}
      {SECTIONS.slice(0, 2).map(scalarSection)}
      {listSection("experience", "Work experience", experience, "experience", "No work experience shared.", ["currentEmployer", "currentTitle"])}
      {listSection("education", "Education", education, "education", "No education shared.", ["school", "degree", "major", "graduationDate"])}
      {listEdit("skills", "Technical skills", shared.skills ?? [])}
      {listEdit("certifications", "Certifications", shared.certifications ?? [])}
      {scalarSection(SECTIONS[2])}
      <Card id="prefs" title="Application preferences" testId="profile-prefs" badge={<Badge tone="info">{consentKeys.length} shared</Badge>}>
        <p className="meta">Fields you approved CareerOS to use when filling forms. Stop sharing any of them here.</p>
        <div className="chips">
          {consentKeys.map((k) => (
            <button key={k} type="button" className="chip-btn" aria-label={`Stop sharing ${k}`} title={`Stop sharing ${k}`} onClick={() => void save({ removeFields: [k] }, `Stopped sharing ${k}.`)}>{k} ✕</button>
          ))}
        </div>
        <p className="meta">Work authorization, sponsorship, demographic, background-check and signature questions are never autofilled.</p>
      </Card>
      <Card id="answers" title="Saved answers" testId="profile-answers" badge={<Badge tone={answers.length ? "success" : "neutral"}>{answers.length}</Badge>}>
        {answers.length ? (
          <ul className="plain-list">
            {answers.map(([id, a]) => (
              <li key={id}>
                <div className="row-between"><strong>{a.question}</strong>{a.approved ? <Badge tone="success">Approved</Badge> : <Badge tone="warning">Draft</Badge>}</div>
                <p className="meta">{a.answer.slice(0, 160)}{a.answer.length > 160 ? "…" : ""}</p>
                <button type="button" className="btn btn-link btn-danger-link" onClick={() => void save({ removeAnswerIds: [id] }, "Answer deleted from the extension.")}>Delete</button>
              </li>
            ))}
          </ul>
        ) : <p className="muted">No saved answers yet.</p>}
      </Card>
    </div>
  );
}
