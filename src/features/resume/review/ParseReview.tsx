import { AlertTriangle, Check, Info } from "lucide-react";
import type { ParseIssue, ResumeVersion } from "../model/types";

type Props = {
  version: ResumeVersion;
  onResolve: (id: string) => void;
  onReopenAll: () => void;
  onGoTo: (issue: ParseIssue) => void;
};

const SOURCE_LABEL: Record<NonNullable<ResumeVersion["source"]>["kind"], string> = { pdf: "PDF", docx: "Word document", txt: "Text file", paste: "Pasted text" };

/** Shows what the parser was unsure about, with the original text for comparison. */
export default function ParseReview({ version, onResolve, onReopenAll, onGoTo }: Props) {
  const open = version.issues.filter((issue) => !version.resolvedIssues.includes(issue.id));
  const resolved = version.issues.length - open.length;
  return (
    <section className="rs-review" aria-labelledby="rs-review-title">
      <h3 id="rs-review-title">Parsing review</h3>
      {version.source ? (
        <p className="career-muted">
          From {SOURCE_LABEL[version.source.kind]}
          {version.source.fileName ? ` “${version.source.fileName}”` : ""} · imported {new Date(version.source.importedAt).toLocaleString()}
        </p>
      ) : (
        <p className="career-muted">This version was created in the editor.</p>
      )}
      {open.length ? (
        <ul className="rs-issues">
          {open.map((issue) => (
            <li key={issue.id} className={issue.severity}>
              <div className="rs-issue-text">
                {issue.severity === "warning" ? <AlertTriangle size={15} aria-label="Warning" /> : <Info size={15} aria-label="Note" />}
                <span>{issue.message}</span>
              </div>
              {issue.source ? <q className="rs-issue-source">{issue.source}</q> : null}
              <div className="rs-issue-actions">
                {issue.section !== "extraction" ? (
                  <button type="button" className="rs-link-button" onClick={() => onGoTo(issue)}>
                    Edit this section
                  </button>
                ) : null}
                <button type="button" className="rs-link-button" onClick={() => onResolve(issue.id)}>
                  <Check size={13} /> Mark reviewed
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rs-all-clear">
          <Check size={15} aria-hidden="true" /> {version.issues.length ? "All parsing notes reviewed." : "No parsing notes for this version."}
        </p>
      )}
      {resolved ? (
        <button type="button" className="rs-link-button" onClick={onReopenAll}>
          Show {resolved} reviewed note{resolved === 1 ? "" : "s"} again
        </button>
      ) : null}
      {version.source?.extractedText ? (
        <details className="rs-source">
          <summary>Original extracted text</summary>
          <pre tabIndex={0}>{version.source.extractedText}</pre>
        </details>
      ) : null}
    </section>
  );
}
