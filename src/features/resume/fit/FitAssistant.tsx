import { useMemo, useState } from "react";
import { useMeasurer } from "../document/ResumeDocument";
import { layoutResume } from "../layout/engine";
import { BLOCKED_CHOICES, optimizeLayout, planFit, proposeFitChanges, relevanceFromJob } from "../layout/fitting";
import type { DocumentSettings, JobTarget, Resume } from "../model/types";

type Props = {
  resume: Resume;
  settings: DocumentSettings;
  job?: JobTarget;
  versionName: string;
  onApplyLayout: (settings: DocumentSettings) => void;
  /** Content changes are always applied to a separate tailored version, never the master. */
  onCreateTailored: (resume: Resume, settings: DocumentSettings, name: string) => void;
  onAllowMultiPage: () => void;
  onClose: () => void;
};

export default function FitAssistant({ resume, settings, job, versionName, onApplyLayout, onCreateTailored, onAllowMultiPage, onClose }: Props) {
  const measurer = useMeasurer();
  const [chosen, setChosen] = useState<string[]>([]);

  const analysis = useMemo(() => {
    if (!measurer) return null;
    const optimized = optimizeLayout(resume, settings, measurer);
    const proposals = proposeFitChanges(resume, optimized.settings, measurer, relevanceFromJob(job));
    const plan = planFit(resume, optimized.settings, measurer, proposals);
    const current = layoutResume(resume, settings, measurer).fit;
    return { optimized, proposals, plan, current };
  }, [measurer, resume, settings, job]);

  const result = useMemo(() => {
    if (!analysis || !measurer) return null;
    let state = { resume, settings: analysis.optimized.settings };
    for (const proposal of analysis.proposals) if (chosen.includes(proposal.id)) state = proposal.apply(state.resume, state.settings);
    return { ...state, fit: layoutResume(state.resume, state.settings, measurer).fit };
  }, [analysis, chosen, measurer, resume]);

  if (!analysis || !result) return <section className="rs-fit" aria-live="polite">Measuring…</section>;
  const { optimized, proposals, plan, current } = analysis;
  const toggle = (id: string) => setChosen((list) => (list.includes(id) ? list.filter((item) => item !== id) : [...list, id]));

  return (
    <section className="rs-fit" aria-labelledby="rs-fit-title">
      <div className="rs-fit-head">
        <h3 id="rs-fit-title">Optimize to one page</h3>
        <button type="button" className="career-secondary-button" onClick={onClose}>Close</button>
      </div>
      <p className="career-muted">Now: <strong>{current.label}</strong>. Text never goes below 10 pt or margins below 0.5 in. Nothing is removed unless you approve it, and approved content changes go into a separate tailored version, so “{versionName}” stays complete.</p>

      <h4>1. Layout adjustments (no content changes)</h4>
      {optimized.changed ? (
        <>
          <ul>{optimized.adjustments.map((item) => <li key={item.id}>{item.label}</li>)}</ul>
          <p>Result: <strong>{optimized.fit.label}</strong></p>
          <button type="button" className="career-quick-create" onClick={() => onApplyLayout(optimized.settings)}>Apply layout adjustments</button>
        </>
      ) : <p className="career-muted">Spacing, margins and type are already at their compact limits.</p>}

      {optimized.fit.fitsOnePage ? <p aria-live="polite">Layout adjustments alone are enough to reach one page.</p> : (
        <>
          <h4>2. Content changes for a tailored version (you approve each)</h4>
          {proposals.length ? (
            <>
              <div className="rs-fit-actions">
                <button type="button" className="career-secondary-button" onClick={() => setChosen(plan.suggested)}>Select suggested set ({plan.suggested.length})</button>
                <button type="button" className="career-secondary-button" onClick={() => setChosen([])} disabled={!chosen.length}>Clear</button>
              </div>
              <ul className="rs-fit-list">
                {proposals.map((proposal) => (
                  <li key={proposal.id}>
                    <label>
                      <input type="checkbox" checked={chosen.includes(proposal.id)} onChange={() => toggle(proposal.id)} />
                      <span><strong>{proposal.kind === "tighten-wording" ? "Tighten wording" : proposal.kind === "remove-bullet" ? "Leave off this version" : "Hide section"}</strong> · {proposal.location} · saves {proposal.linesSaved} line{proposal.linesSaved === 1 ? "" : "s"}</span>
                    </label>
                    <div className="rs-fit-diff">
                      <del>{proposal.before}</del>
                      {proposal.after ? <ins>{proposal.after}</ins> : <em>Removed from this tailored version only.</em>}
                    </div>
                    <small>{proposal.reason}</small>
                  </li>
                ))}
              </ul>
              <p aria-live="polite">With your selection: <strong>{result.fit.label}</strong></p>
              <button type="button" className="career-quick-create" disabled={!chosen.length} onClick={() => onCreateTailored(result.resume, result.settings, `${versionName} – tailored`)}>
                Create tailored version with {chosen.length} approved change{chosen.length === 1 ? "" : "s"}
              </button>
            </>
          ) : <p className="career-muted">No safe automatic proposals are available.</p>}
          {!plan.fitsAfter ? (
            <div className="rs-fit-blocked" role="alert">
              <strong>One-page export is blocked.</strong> Even with every suggested change, about {plan.remainingOverflowLines} line{plan.remainingOverflowLines === 1 ? "" : "s"} would not fit without going below readable limits or removing essential content. Choose how to proceed:
              <ul>
                {BLOCKED_CHOICES.map((choice) => <li key={choice.id}><strong>{choice.label}</strong>: {choice.detail}</li>)}
              </ul>
              <button type="button" className="career-secondary-button" onClick={onAllowMultiPage}>Allow multiple pages for this version</button>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
