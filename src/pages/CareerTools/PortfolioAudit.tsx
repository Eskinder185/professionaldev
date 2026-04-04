import { useMemo, useRef, useState } from "react";
import PageHeader from "../../components/ui/PageHeader";
import { save, load } from "../../utils/storage";

type Audit = {
  project: string;
  repoUrl: string;
  tags: string[];
  demo?: string;
  hasReadme: boolean;
  hasInstall: boolean;
  hasScreens: boolean;
  hasLicense: boolean;
  hasScripts: boolean;
  hasCI: boolean;
  lastCommit?: string;
};

const README_TEMPLATE = `# Project Name\n\n## Overview\nShort summary of the project.\n\n## Demo\nLink or screenshots.\n\n## Install\n\n\n## Run\n\n\n## Tests\n\n\n## License\nMIT\n`;

const ISSUE_TEMPLATE = `## Expected Behavior\n\n## Current Behavior\n\n## Steps to Reproduce\n1. \n2. \n3. \n`;

const PR_TEMPLATE = `## Summary\n\n## Changes\n- \n- \n\n## Checklist\n- [ ] Tests added/updated\n- [ ] Docs updated\n`;

export default function PortfolioAudit() {
  const [form, setForm] = useState<Audit>(() => load('pd:career:audit:last', {
    project: '', repoUrl: '', tags: [], demo: '', hasReadme: false, hasInstall: false, hasScreens: false, hasLicense: false, hasScripts: false, hasCI: false, lastCommit: ''
  }));
  const [history, setHistory] = useState<any[]>(() => load('pd:career:audit:history', []));
  const reportRef = useRef<HTMLDivElement>(null);

  const score = useMemo(() => {
    let s = 0;
    s += form.hasReadme ? 20 : 0;
    s += (form.hasInstall && form.hasScripts) ? 20 : (form.hasInstall || form.hasScripts ? 10 : 0);
    s += form.hasScreens ? 15 : 0;
    s += form.hasLicense ? 10 : 0;
    s += form.hasCI ? 15 : 0;
    s += form.demo ? 10 : 0;
    s += form.lastCommit ? 10 : 0;
    return Math.min(100, s);
  }, [form]);

  const fixes = useMemo(() => {
    const arr: string[] = [];
    if (!form.hasReadme) arr.push('Add a clear README.');
    if (!form.hasInstall) arr.push('Document install steps.');
    if (!form.hasScripts) arr.push('Add build/test scripts.');
    if (!form.hasScreens) arr.push('Include screenshots or GIFs.');
    if (!form.hasLicense) arr.push('Add a LICENSE file.');
    if (!form.hasCI) arr.push('Set up GitHub Actions CI.');
    if (!form.demo) arr.push('Link a live demo if possible.');
    if (!form.lastCommit) arr.push('Update last commit date.');
    return arr;
  }, [form]);

  const saveAudit = () => {
    save('pd:career:audit:last', form);
    const item = { ...form, date: new Date().toISOString(), score };
    const next = [item, ...history].slice(0, 5);
    setHistory(next); save('pd:career:audit:history', next);
  };

  const copy = (text: string, name: string) => {
    navigator.clipboard?.writeText(text);
    alert(`${name} copied to clipboard`);
  };

  return (
    <div className="relative">
      <div className="relative z-10 mx-auto max-w-6xl space-y-0 px-4 py-10">
        <PageHeader
          eyebrow="Career Tools"
          title="Portfolio & GitHub audit"
          sub="Checklist-based score with quick templates."
        />

        <section className="border-t border-border/70 pt-8 sm:pt-10">
          <div className="grid gap-3 md:grid-cols-2">
            <input
              aria-label="Project name"
              className="input"
              placeholder="Project name"
              value={form.project}
              onChange={(e) => setForm({ ...form, project: e.target.value })}
            />
            <input
              aria-label="Repo URL"
              className="input"
              placeholder="Repository URL"
              value={form.repoUrl}
              onChange={(e) => setForm({ ...form, repoUrl: e.target.value })}
            />
            <input
              aria-label="Tags"
              className="input"
              placeholder="tags (comma)"
              value={form.tags.join(", ")}
              onChange={(e) =>
                setForm({ ...form, tags: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })
              }
            />
            <input
              aria-label="Demo link"
              className="input"
              placeholder="Demo link (optional)"
              value={form.demo}
              onChange={(e) => setForm({ ...form, demo: e.target.value })}
            />
          </div>
          <div className="mt-4 grid gap-2 text-sm md:grid-cols-3">
            <label className="flex items-center gap-2 text-ink-muted">
              <input type="checkbox" checked={form.hasReadme} onChange={(e) => setForm({ ...form, hasReadme: e.target.checked })} /> README has overview
            </label>
            <label className="flex items-center gap-2 text-ink-muted">
              <input type="checkbox" checked={form.hasInstall} onChange={(e) => setForm({ ...form, hasInstall: e.target.checked })} /> Install/Run steps
            </label>
            <label className="flex items-center gap-2 text-ink-muted">
              <input type="checkbox" checked={form.hasScreens} onChange={(e) => setForm({ ...form, hasScreens: e.target.checked })} /> Screenshots/GIFs
            </label>
            <label className="flex items-center gap-2 text-ink-muted">
              <input type="checkbox" checked={form.hasLicense} onChange={(e) => setForm({ ...form, hasLicense: e.target.checked })} /> License present
            </label>
            <label className="flex items-center gap-2 text-ink-muted">
              <input type="checkbox" checked={form.hasScripts} onChange={(e) => setForm({ ...form, hasScripts: e.target.checked })} /> Scripts: build/test
            </label>
            <label className="flex items-center gap-2 text-ink-muted">
              <input type="checkbox" checked={form.hasCI} onChange={(e) => setForm({ ...form, hasCI: e.target.checked })} /> CI present
            </label>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2 md:items-center">
            <input
              aria-label="Last commit"
              className="input"
              placeholder="Last commit date (YYYY-MM-DD)"
              value={form.lastCommit}
              onChange={(e) => setForm({ ...form, lastCommit: e.target.value })}
            />
            <div className="flex items-center gap-2 text-ink dark:text-white">
              <span className="font-medium">Score:</span> <span>{score}/100</span>
            </div>
          </div>
          <div className="mt-4">
            <button type="button" className="btn btn-primary min-h-10 px-4" onClick={saveAudit}>
              Save audit
            </button>
          </div>
        </section>

        <section className="border-t border-border/70 pt-8 sm:pt-10">
          <div ref={reportRef}>
            <h2 className="mb-3 font-medium text-ink dark:text-white">Missing items</h2>
            {fixes.length === 0 ? (
              <p className="text-sm text-ink-muted">Looks great.</p>
            ) : (
              <ul className="list-disc pl-5 text-sm text-ink-muted">
                {fixes.map((f, i) => (
                  <li key={i}>{f}</li>
                ))}
              </ul>
            )}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" className="btn surface-muted min-h-10 px-4" onClick={() => copy(README_TEMPLATE, "README template")}>
              Copy README template
            </button>
            <button type="button" className="btn surface-muted min-h-10 px-4" onClick={() => copy(ISSUE_TEMPLATE, "Issue template")}>
              Copy Issue template
            </button>
            <button type="button" className="btn surface-muted min-h-10 px-4" onClick={() => copy(PR_TEMPLATE, "PR template")}>
              Copy PR template
            </button>
          </div>
        </section>

        {history.length > 0 && (
          <section className="border-t border-border/70 pt-8 sm:pt-10 pb-2">
            <h2 className="mb-4 font-medium text-ink dark:text-white">Recent audits</h2>
            <div className="grid gap-6 text-sm md:grid-cols-3">
              {history.map((h, i) => (
                <div key={i}>
                  <div className="truncate font-medium text-ink dark:text-white" title={h.project}>
                    {h.project || "Project"}
                  </div>
                  <div className="text-ink-muted">{new Date(h.date).toLocaleString()}</div>
                  <div className="text-ink-muted">
                    Score: <span className="font-medium text-ink dark:text-white">{h.score}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
