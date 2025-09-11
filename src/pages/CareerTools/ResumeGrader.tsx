import React, { useState } from "react";
import { extractTextFromFile } from "../../utils/extractTextFromFile";
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
      const resumeText = file ? await extractTextFromFile(file) : text;
      if (!resumeText.trim()) throw new Error("Provide a resume file or paste text.");
      const kws = keywords.split(",").map((s) => s.trim()).filter(Boolean);
      const res = analyzeResume(resumeText, kws);
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
          <button className="btn btn-primary" onClick={onAnalyze} disabled={busy}>
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
              <div className="text-xs opacity-70">
                Detected: {analysis.detected.emails[0] ? "email ✓" : "email ✗"} · {analysis.detected.links.length ? "links ✓" : "links ✗"} · {analysis.detected.words} words · {analysis.detected.bullets} bullets
              </div>
            </div>
          )}
        </div>
      </div>

      <section className="surface p-5">
        <h2 className="font-semibold">LinkedIn & GitHub organization (quick guide)</h2>
        <div className="grid md:grid-cols-2 gap-4 mt-3">
          <ul className="list-disc pl-5 space-y-1">
            <li>
              Headline = <b>Role</b> + key skills (e.g., “Frontend Developer · React · TypeScript”).
            </li>
            <li>Top link = portfolio or GitHub; feature best 3 posts/projects.</li>
            <li>About = your elevator pitch + 3 bullets with metrics.</li>
            <li>Add media to experience (demos, screenshots, PDFs).</li>
          </ul>
          <ul className="list-disc pl-5 space-y-1">
            <li>GitHub: pin 6 repos (1–2 polished projects, 1 learning repo, 1 demo).</li>
            <li>Each repo: clean README (what, why, how to run, screenshots).</li>
            <li>Use semantic commits; archive noisy school repos.</li>
            <li>Profile README: short bio + links (auto-update pinned badges).</li>
          </ul>
        </div>
      </section>
    </div>
  );
}

