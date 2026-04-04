import React, { useState } from "react";
import { FileText } from "lucide-react";
import PageHeader from "../../components/ui/PageHeader";
import EmptyState from "../../components/ui/EmptyState";
import { extractTextFromFile, type Extracted } from "../../utils/extractTextFromFile";
import { analyzeResume, type ResumeAnalysis } from "../../utils/analyzeResume";

export default function ResumeGrader() {
  const [file, setFile] = useState<File | undefined>();
  const [keywords, setKeywords] = useState("");
  const [text, setText] = useState("");
  const [analysis, setAnalysis] = useState<ResumeAnalysis | undefined>();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | undefined>();
  const [justAnalyzed, setJustAnalyzed] = useState(false);

  const canAnalyze = Boolean(file || text.trim());

  async function onAnalyze() {
    try {
      setErr(undefined);
      setJustAnalyzed(false);
      setBusy(true);

      let extracted: Extracted;
      if (file) {
        extracted = await extractTextFromFile(file);
      } else if (text.trim()) {
        extracted = { kind: "txt" as const, text: text };
      } else {
        throw new Error("Add a file or paste your résumé text first.");
      }

      const kws = keywords
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const res = analyzeResume(extracted, kws);
      setAnalysis(res);
      setJustAnalyzed(true);
      window.setTimeout(() => setJustAnalyzed(false), 4000);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Something went wrong. Try again.";
      setErr(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8 pb-6">
      <PageHeader
        eyebrow="Career Tools"
        title="Résumé Grader"
        sub="Local, ATS-style check: structure, keywords, and quick wins. Nothing is uploaded to a server — processing happens in your browser."
      />

      <div className="grid gap-0 border-t border-black/[0.07] dark:border-white/[0.09] lg:grid-cols-2 lg:items-start">
        <div className="space-y-6 border-black/[0.07] py-10 dark:border-white/[0.09] lg:border-r lg:pr-10 lg:py-12">
          <div>
            <h2 className="text-title-sm text-ink dark:text-white">1. Add your résumé</h2>
            <p className="mt-1 text-sm text-ink-muted">
              PDF, DOCX, TXT, or Markdown — or paste plain text if you prefer.
            </p>
          </div>

          <div className="space-y-2">
            <label htmlFor="resume-file" className="text-sm font-medium text-ink dark:text-white">
              Upload file
            </label>
            <input
              id="resume-file"
              className="input text-sm file:mr-3 file:rounded-md file:border-0 file:bg-canvas-subtle file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-ink dark:file:bg-white/10"
              type="file"
              accept=".pdf,.docx,.txt,.md"
              onChange={(e) => setFile(e.target.files?.[0])}
            />
            {file ? (
              <p className="text-caption text-ink-muted">Selected: {file.name}</p>
            ) : null}
          </div>

          <div className="relative">
            <div className="absolute inset-x-0 top-0 flex items-center gap-3" aria-hidden>
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-ink-faint/30 to-transparent dark:via-white/15" />
              <span className="shrink-0 text-caption uppercase tracking-wider text-ink-faint">or</span>
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-ink-faint/30 to-transparent dark:via-white/15" />
            </div>
            <div className="pt-8">
              <label htmlFor="resume-paste" className="text-sm font-medium text-ink dark:text-white">
                Paste text
              </label>
              <textarea
                id="resume-paste"
                className="textarea mt-2 min-h-[160px]"
                placeholder="Paste your résumé here if you’re not using a file…"
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="resume-keywords" className="text-sm font-medium text-ink dark:text-white">
              Target keywords <span className="font-normal text-ink-muted">(optional)</span>
            </label>
            <input
              id="resume-keywords"
              className="input"
              placeholder="e.g. React, TypeScript, AWS, CI/CD"
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
            />
            <p className="text-caption text-ink-muted">
              Comma-separated. We’ll compare them against your text for a simple match readout.
            </p>
          </div>

          <div className="flex flex-col gap-3 border-t border-black/[0.06] pt-6 dark:border-white/10">
            <button
              type="button"
              className="btn btn-primary min-h-11 px-6"
              onClick={onAnalyze}
              disabled={busy || !canAnalyze}
            >
              {busy ? "Analyzing…" : "Analyze résumé"}
            </button>
            {!canAnalyze ? (
              <p className="text-caption text-ink-muted">Choose a file or paste text to enable analysis.</p>
            ) : null}
            {err ? (
              <p className="text-sm text-red-600 dark:text-red-400" role="alert">
                {err}
              </p>
            ) : null}
            {justAnalyzed && !err ? (
              <p className="text-sm font-medium text-accent" role="status">
                Analysis updated — review the panel on the right.
              </p>
            ) : null}
          </div>
        </div>

        <div className="border-t border-black/[0.07] py-10 dark:border-white/[0.09] lg:border-t-0 lg:pl-10 lg:py-12">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-title-sm text-ink dark:text-white">2. Results</h2>
              <p className="mt-1 text-sm text-ink-muted">
                Score, breakdown, and suggestions appear here after you run an analysis.
              </p>
            </div>
            {analysis ? (
              <span className="shrink-0 rounded-full bg-accent/10 px-3 py-1 text-xs font-semibold text-accent">
                {analysis.score}/100
              </span>
            ) : null}
          </div>

          {!analysis ? (
            <EmptyState
              title="No analysis yet"
              hint="Upload or paste your résumé, then run Analyze. You’ll get a score, category breakdown, and concrete suggestions."
            >
              <FileText className="mx-auto h-10 w-10 text-ink-faint" strokeWidth={1.25} aria-hidden />
            </EmptyState>
          ) : (
            <div className="space-y-6">
              <div className="text-lg font-semibold text-ink dark:text-white">
                Overall score:{" "}
                <span className="text-accent">{analysis.score}</span>
                <span className="text-ink-muted">/100</span>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {analysis.breakdown.map((b, i) => (
                  <div key={i} className="border-b border-black/[0.06] py-4 dark:border-white/[0.08]">
                    <div className="font-medium text-ink dark:text-white">
                      {b.label}: <span className="text-accent">{b.score}</span>
                    </div>
                    <div className="mt-1 text-sm text-ink-muted">{b.note}</div>
                  </div>
                ))}
              </div>
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">Suggestions</h3>
                <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-ink dark:text-white/90">
                  {analysis.suggestions.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </div>
              {analysis.typography.available && (
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
                    Typography
                  </h3>
                  <div className="mt-2 space-y-1.5 text-sm text-ink-muted">
                    {analysis.typography.bodySizePt && (
                      <div>Body size (approx.): {analysis.typography.bodySizePt}pt</div>
                    )}
                    {analysis.typography.lineSpacingRatio && (
                      <div>Line spacing: {analysis.typography.lineSpacingRatio}×</div>
                    )}
                    {analysis.typography.headingSizesPt?.length ? (
                      <div>
                        Headings: {analysis.typography.headingSizesPt.map((s) => `${s}pt`).join(", ")}
                      </div>
                    ) : null}
                    {analysis.typography.fontCandidates?.length ? (
                      <div className="text-caption">Fonts: {analysis.typography.fontCandidates.join(", ")}</div>
                    ) : null}
                    {analysis.typography.verdicts.length > 0 ? (
                      <ul className="list-disc pl-5 text-caption">
                        {analysis.typography.verdicts.map((v, i) => (
                          <li key={i}>{v}</li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                </div>
              )}
              <p className="text-caption text-ink-faint">
                Detected: {analysis.detected.emails[0] ? "email ✓" : "email —"} ·{" "}
                {analysis.detected.links.length ? "links ✓" : "links —"} · {analysis.detected.words} words ·{" "}
                {analysis.detected.bullets} bullets
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
