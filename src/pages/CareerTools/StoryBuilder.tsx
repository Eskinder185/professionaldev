import React, { useMemo, useState } from "react";
import PageHeader from "../../components/ui/PageHeader";

type Mode = "STAR" | "CARL";
export default function StoryBuilder() {
  const [mode, setMode] = useState<Mode>("STAR");
  const [S, setS] = useState("");
  const [T, setT] = useState("");
  const [A, setA] = useState("");
  const [R, setR] = useState("");
  const [L, setL] = useState("");

  const output = useMemo(() => {
    if (mode === "STAR") {
      return `**Situation:** ${S}\n**Task:** ${T}\n**Action:** ${A}\n**Result:** ${R}`;
    }
    return `**Context:** ${S}\n**Action:** ${A}\n**Result:** ${R}\n**Learning:** ${L}`;
  }, [mode, S, T, A, R, L]);

  return (
    <div className="space-y-0">
      <PageHeader
        eyebrow="Career Tools"
        title="Interview Stories: STAR & CARL"
        sub="STAR = Situation, Task, Action, Result. CARL = Context, Action, Result, Learning. Use CARL when you want to highlight growth/insight."
      />

      <section className="border-t border-border/70 pt-8 sm:pt-10">
        <div className="flex gap-2 mb-4">
          <button className={`btn ${mode === "STAR" ? "btn-anim btn-pink" : ""}`} onClick={() => setMode("STAR")}>
            STAR
          </button>
          <button className={`btn ${mode === "CARL" ? "btn-anim btn-pink" : ""}`} onClick={() => setMode("CARL")}>
            CARL
          </button>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-3">
            <input className="input" placeholder={mode === "STAR" ? "Situation (context)" : "Context"} value={S} onChange={(e) => setS(e.target.value)} />
            {mode === "STAR" && (
              <input className="input" placeholder="Task (goal or responsibility)" value={T} onChange={(e) => setT(e.target.value)} />
            )}
            <textarea className="textarea" placeholder="Action (what you did, why, tools)" value={A} onChange={(e) => setA(e.target.value)} />
            <input className="input" placeholder="Result (metrics, outcomes)" value={R} onChange={(e) => setR(e.target.value)} />
            {mode === "CARL" && (
              <input className="input" placeholder="Learning (insight you took forward)" value={L} onChange={(e) => setL(e.target.value)} />
            )}
          </div>
          <div className="surface-emphasis border-l-4 border-l-[var(--accent-pink)] p-4">
            <h3 className="font-semibold mb-2">Preview</h3>
            <pre className="whitespace-pre-wrap text-[0.95rem]">{output}</pre>
          </div>
        </div>

        <p className="mt-6 text-sm opacity-80">
          Tips: 1) Start with the outcome. 2) Use metrics (%, $, time). 3) Keep it to 60–90s. 4) Phrase actions with
          impact verbs.
        </p>
      </section>
    </div>
  );
}
