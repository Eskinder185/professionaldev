import React, { useState } from "react";
import { extractTextFromFile, type Extracted } from "../../utils/extractTextFromFile";
import { analyzeResume, type ResumeAnalysis } from "../../utils/analyzeResume";

export default function ResumeGrader() {
  const [file, setFile] = useState<File | undefined>();
  const [keywords, setKeywords] = useState("");
  const [text, setText] = useState("");
  const [analysis, setAnalysis] = useState<ResumeAnalysis | undefined>();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | undefined>();

  async function onAnalyze() {
    try {
      setErr(undefined);
      setBusy(true);
      
      let extracted: Extracted;
      if (file) {
        extracted = await extractTextFromFile(file);
      } else if (text.trim()) {
        extracted = { kind: "txt" as const, text: text };
      } else {
        throw new Error("Provide a resume file or paste text.");
      }
      
      const kws = keywords.split(",").map((s) => s.trim()).filter(Boolean);
      const res = analyzeResume(extracted, kws);
      setAnalysis(res);
    } catch (e: any) {
      setErr(e?.message || "Failed to analyze");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <header className="surface-muted p-5">
        <h1 className="text-2xl font-semibold brand-heading">Résumé Grader</h1>
        <p>Upload your résumé (PDF/DOCX/TXT) or paste text. Get an ATS-style score plus actionable suggestions.</p>
      </header>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="surface p-5 space-y-3">
          <label className="block text-sm">Upload file</label>
          <input className="input" type="file" accept=".pdf,.docx,.txt,.md" onChange={(e) => setFile(e.target.files?.[0])} />
          <div className="text-xs opacity-80">or paste text</div>
          <textarea className="textarea" placeholder="Paste résumé text…" value={text} onChange={(e) => setText(e.target.value)} />
          <label className="block text-sm">Target keywords (comma-separated)</label>
          <input className="input" placeholder="e.g. React, AWS, Node, CI/CD" value={keywords} onChange={(e) => setKeywords(e.target.value)} />
          <button className="btn btn-anim btn-pink" onClick={onAnalyze} disabled={busy}>
            {busy ? "Analyzing…" : "Analyze résumé"}
          </button>
          {err && <div className="text-red-400 text-sm">{err}</div>}
        </div>

        <div className="surface p-5">
          {!analysis ? (
            <p className="opacity-80">Your score and suggestions will appear here.</p>
          ) : (
            <div className="space-y-4">
              <div className="text-lg font-semibold">
                Score: <span className="brand-heading">{analysis.score}/100</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {analysis.breakdown.map((b, i) => (
                  <div key={i} className="surface-muted p-3 rounded-xl">
                    <div className="font-medium">
                      {b.label}: {b.score}
                    </div>
                    <div className="text-sm opacity-80">{b.note}</div>
                  </div>
                ))}
              </div>
              <div>
                <h3 className="font-semibold mb-2">Suggestions</h3>
                <ul className="list-disc pl-5 space-y-1">
                  {analysis.suggestions.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </div>
              {analysis.typography.available && (
                <div>
                  <h3 className="font-semibold mb-2">Typography Analysis</h3>
                  <div className="space-y-2">
                    {analysis.typography.bodySizePt && (
                      <div>Body text size: ~{analysis.typography.bodySizePt}pt</div>
                    )}
                    {analysis.typography.lineSpacingRatio && (
                      <div>Line spacing: {analysis.typography.lineSpacingRatio}x</div>
                    )}
                    {analysis.typography.headingSizesPt?.length && (
                      <div>Heading sizes: {analysis.typography.headingSizesPt.map(s => `${s}pt`).join(", ")}</div>
                    )}
                    {analysis.typography.fontCandidates?.length && (
                      <div className="text-sm opacity-80">Fonts: {analysis.typography.fontCandidates.join(", ")}</div>
                    )}
                    {analysis.typography.verdicts.length > 0 && (
                      <ul className="list-disc pl-5 text-sm opacity-80">
                        {analysis.typography.verdicts.map((v, i) => (
                          <li key={i}>{v}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              )}
              <div className="text-xs opacity-70">
                Detected: {analysis.detected.emails[0] ? "email ✓" : "email ✗"} · {analysis.detected.links.length ? "links ✓" : "links ✗"} · {analysis.detected.words} words · {analysis.detected.bullets} bullets
              </div>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}

