import { useMemo, useState } from "react";
import { Check, Layers, Sparkles } from "lucide-react";
import type { DocumentSettings, JobTarget, Resume, ResumeVersion } from "../model/types";
import { layoutResume } from "../layout/engine";
import { buildTailoredProposal, rankTextRelevance } from "./tailorEngine";

type Props = {
  masterVersion: ResumeVersion;
  activeVersion: ResumeVersion;
  job?: JobTarget;
  onCreateTailored: (
    name: string,
    resume: Resume,
    settings: DocumentSettings,
    meta: { company?: string; role?: string },
  ) => void;
  onUpdateActive: (resume: Resume, message: string) => void;
};

export default function MasterProfileSelector({
  masterVersion,
  activeVersion,
  job,
  onCreateTailored,
  onUpdateActive,
}: Props) {
  const master = masterVersion.resume;
  const active = activeVersion.resume;
  const isMasterActive = activeVersion.id === masterVersion.id;

  const proposal = useMemo(
    () => buildTailoredProposal(master, activeVersion.settings, job),
    [master, activeVersion.settings, job],
  );

  const [companyDraft, setCompanyDraft] = useState(
    activeVersion.company || job?.company || job?.metadata?.company || "",
  );
  const [roleDraft, setRoleDraft] = useState(
    activeVersion.role || job?.title || active.targetRole || "",
  );
  const [showSelector, setShowSelector] = useState(false);

  const activeFit = useMemo(
    () => layoutResume(active, activeVersion.settings).fit,
    [active, activeVersion.settings],
  );

  const toggleBulletInActive = (
    section: "experience" | "projects",
    entryId: string,
    bulletText: string,
    include: boolean,
  ) => {
    if (section === "experience") {
      const masterEntry = master.experience.find((e) => e.id === entryId);
      if (!masterEntry) return;
      const exists = active.experience.some((e) => e.id === entryId);
      const nextExp = exists
        ? active.experience.map((e) => {
            if (e.id !== entryId) return e;
            const bullets = include
              ? [...e.bullets, bulletText]
              : e.bullets.filter((b) => b !== bulletText);
            return { ...e, bullets };
          })
        : [...active.experience, { ...masterEntry, bullets: [bulletText] }];
      onUpdateActive({ ...active, experience: nextExp }, include ? "Added bullet from Master Profile." : "Excluded bullet from tailored version.");
    } else {
      const masterProj = master.projects.find((p) => p.id === entryId);
      if (!masterProj) return;
      const exists = active.projects.some((p) => p.id === entryId);
      const nextProj = exists
        ? active.projects.map((p) => {
            if (p.id !== entryId) return p;
            const bullets = include
              ? [...p.bullets, bulletText]
              : p.bullets.filter((b) => b !== bulletText);
            return { ...p, bullets };
          })
        : [...active.projects, { ...masterProj, bullets: [bulletText] }];
      onUpdateActive({ ...active, projects: nextProj }, include ? "Added project bullet from Master Profile." : "Excluded project bullet from tailored version.");
    }
  };

  const toggleEntryInActive = (
    section: "experience" | "projects" | "education" | "certifications",
    entryId: string,
    include: boolean,
  ) => {
    if (section === "experience") {
      const item = master.experience.find((e) => e.id === entryId);
      if (!item) return;
      const next = include
        ? [...active.experience, item]
        : active.experience.filter((e) => e.id !== entryId);
      onUpdateActive({ ...active, experience: next }, include ? `Included ${item.employer || item.title} in tailored version.` : `Excluded ${item.employer || item.title} from tailored version.`);
    } else if (section === "projects") {
      const item = master.projects.find((p) => p.id === entryId);
      if (!item) return;
      const next = include
        ? [...active.projects, item]
        : active.projects.filter((p) => p.id !== entryId);
      onUpdateActive({ ...active, projects: next }, include ? `Included project ${item.name}.` : `Excluded project ${item.name}.`);
    } else if (section === "education") {
      const item = master.education.find((ed) => ed.id === entryId);
      if (!item) return;
      const next = include
        ? [...active.education, item]
        : active.education.filter((ed) => ed.id !== entryId);
      onUpdateActive({ ...active, education: next }, include ? `Included ${item.institution}.` : `Excluded ${item.institution}.`);
    } else if (section === "certifications") {
      const item = master.certifications.find((c) => c.id === entryId);
      if (!item) return;
      const next = include
        ? [...active.certifications, item]
        : active.certifications.filter((c) => c.id !== entryId);
      onUpdateActive({ ...active, certifications: next }, include ? `Included ${item.name}.` : `Excluded ${item.name}.`);
    }
  };

  return (
    <section className="rs-tailor-box" aria-label="Master Profile and Tailored Version Controls">
      <div className="rs-tailor-head">
        <div>
          <span className={`rs-badge ${isMasterActive ? "" : "rs-badge-ok"}`}>
            {isMasterActive ? "Master Profile" : "Tailored One-Page Version"}
          </span>
          <h4>
            {isMasterActive
              ? "Complete verified career history"
              : `${activeVersion.name} (from ${masterVersion.name})`}
          </h4>
        </div>
        <button
          type="button"
          className="career-secondary-button"
          onClick={() => setShowSelector((v) => !v)}
        >
          <Layers size={14} /> {showSelector ? "Hide entry selector" : "Select entries & bullets"}
        </button>
      </div>

      <p className="career-muted">
        Your Master Profile keeps your complete verified history untouched. Create job-specific tailored versions for each company and role.
      </p>

      <div className="rs-two">
        <div className="rs-field">
          <label htmlFor="rs-tailor-company">Target company</label>
          <input
            id="rs-tailor-company"
            value={companyDraft}
            onChange={(e) => setCompanyDraft(e.target.value)}
            placeholder="e.g. Amazon"
          />
        </div>
        <div className="rs-field">
          <label htmlFor="rs-tailor-role">Target role</label>
          <input
            id="rs-tailor-role"
            value={roleDraft}
            onChange={(e) => setRoleDraft(e.target.value)}
            placeholder="e.g. Data Center Technician"
          />
        </div>
      </div>

      <div className="rs-tailor-actions">
        <button
          type="button"
          className="career-quick-create"
          data-testid="propose-tailored-btn"
          onClick={() => {
            const co = companyDraft.trim() || proposal.company;
            const ro = roleDraft.trim() || proposal.role;
            const name = co && ro ? `${co} — ${ro}` : ro ? `${ro} — Tailored One-Page` : co ? `${co} — Tailored One-Page` : proposal.versionName;
            onCreateTailored(name, proposal.tailoredResume, proposal.tailoredSettings, {
              company: co || undefined,
              role: ro || undefined,
            });
          }}
        >
          <Sparkles size={14} /> Propose Tailored One-Page Version ({proposal.fitAfter.label})
        </button>
      </div>

      {showSelector ? (
        <div className="rs-master-selector" role="region" aria-label="Master Profile entry and bullet selector">
          <div className="rs-master-selector-bar">
            <strong>Include in {isMasterActive ? "current résumé" : activeVersion.name}</strong>
            <span className={`rs-badge ${activeFit.fitsOnePage ? "rs-badge-ok" : "rs-badge-warn"}`}>
              {activeFit.label}
            </span>
          </div>
          {isMasterActive ? (
            <p className="rs-notice" role="note">
              You are viewing the Master Profile. Click “Propose Tailored One-Page Version” above first so toggling entries only affects the tailored version.
            </p>
          ) : null}

          <div className="rs-selector-group">
            <h5>Professional Experience ({master.experience.length})</h5>
            {master.experience.map((exp) => {
              const inActive = active.experience.find((e) => e.id === exp.id);
              const entryChecked = Boolean(inActive);
              return (
                <div key={exp.id} className="rs-selector-entry">
                  <label className="rs-check">
                    <input
                      type="checkbox"
                      checked={entryChecked}
                      disabled={isMasterActive}
                      onChange={(e) => toggleEntryInActive("experience", exp.id, e.target.checked)}
                    />
                    <strong>{[exp.title, exp.employer].filter(Boolean).join(" — ")}</strong>
                  </label>
                  {entryChecked ? (
                    <ul className="rs-selector-bullets">
                      {exp.bullets.map((b, idx) => {
                        const rel = rankTextRelevance(b, job);
                        const tight = b.trim();
                        const bulletChecked = inActive?.bullets.some(
                          (ab) => ab.trim() === tight || ab.includes(tight.slice(0, 32)),
                        ) ?? false;
                        return (
                          <li key={`${exp.id}-${idx}`}>
                            <label className="rs-check">
                              <input
                                type="checkbox"
                                checked={bulletChecked}
                                disabled={isMasterActive}
                                onChange={(e) => toggleBulletInActive("experience", exp.id, b, e.target.checked)}
                              />
                              <span>{b}</span>
                            </label>
                            {rel.matchedTerms.length ? (
                              <span className="rs-badge rs-badge-ok">
                                <Check size={11} /> Matches: {rel.matchedTerms.join(", ")}
                              </span>
                            ) : null}
                          </li>
                        );
                      })}
                    </ul>
                  ) : null}
                </div>
              );
            })}
          </div>

          {master.projects.length ? (
            <div className="rs-selector-group">
              <h5>Projects ({master.projects.length})</h5>
              {master.projects.map((proj) => {
                const inActive = active.projects.find((p) => p.id === proj.id);
                const entryChecked = Boolean(inActive);
                return (
                  <div key={proj.id} className="rs-selector-entry">
                    <label className="rs-check">
                      <input
                        type="checkbox"
                        checked={entryChecked}
                        disabled={isMasterActive}
                        onChange={(e) => toggleEntryInActive("projects", proj.id, e.target.checked)}
                      />
                      <strong>{proj.name}</strong>
                    </label>
                    {entryChecked ? (
                      <ul className="rs-selector-bullets">
                        {proj.bullets.map((b, idx) => {
                          const rel = rankTextRelevance(b, job);
                          const bulletChecked = inActive?.bullets.some(
                            (ab) => ab.trim() === b.trim() || ab.includes(b.trim().slice(0, 32)),
                          ) ?? false;
                          return (
                            <li key={`${proj.id}-${idx}`}>
                              <label className="rs-check">
                                <input
                                  type="checkbox"
                                  checked={bulletChecked}
                                  disabled={isMasterActive}
                                  onChange={(e) => toggleBulletInActive("projects", proj.id, b, e.target.checked)}
                                />
                                <span>{b}</span>
                              </label>
                              {rel.matchedTerms.length ? (
                                <span className="rs-badge rs-badge-ok">
                                  <Check size={11} /> Matches: {rel.matchedTerms.join(", ")}
                                </span>
                              ) : null}
                            </li>
                          );
                        })}
                      </ul>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : null}

          {master.certifications.length ? (
            <div className="rs-selector-group">
              <h5>Certifications ({master.certifications.length})</h5>
              {master.certifications.map((cert) => {
                const entryChecked = active.certifications.some((c) => c.id === cert.id);
                return (
                  <label key={cert.id} className="rs-check">
                    <input
                      type="checkbox"
                      checked={entryChecked}
                      disabled={isMasterActive}
                      onChange={(e) => toggleEntryInActive("certifications", cert.id, e.target.checked)}
                    />
                    <span>{cert.name}</span>
                  </label>
                );
              })}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
