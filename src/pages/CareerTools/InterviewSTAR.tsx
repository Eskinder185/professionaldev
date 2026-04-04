import { useState } from "react";
import PageHeader from "../../components/ui/PageHeader";

export default function InterviewSTAR() {
  const [s, setS] = useState("");
  const [t, setT] = useState("");
  const [a, setA] = useState("");
  const [r, setR] = useState("");
  const result =
    s && t && a && r
      ? `In ${s}, my task was ${t}. I took action by ${a}. As a result, ${r}.`
      : "";

  return (
    <div className="space-y-0">
      <PageHeader
        eyebrow="Career Tools"
        title="STAR Method Practice"
        sub="Generate a polished answer from four short inputs."
      />

      <section className="border-t border-border/70 pt-8 sm:pt-10">
        <div className="grid max-w-3xl gap-3">
          <input className="input" placeholder="Situation" value={s} onChange={(e) => setS(e.target.value)} />
          <input className="input" placeholder="Task" value={t} onChange={(e) => setT(e.target.value)} />
          <input className="input" placeholder="Action" value={a} onChange={(e) => setA(e.target.value)} />
          <input className="input" placeholder="Result" value={r} onChange={(e) => setR(e.target.value)} />
        </div>
        <div className="mt-6 max-w-3xl">
          <div className="text-sm text-ink-muted mb-2">Your answer</div>
          <div className="surface-emphasis border-l-4 border-l-[var(--accent-blue)] min-h-[100px] p-4 text-body">
            {result || "Fill all fields to preview."}
          </div>
        </div>
      </section>
    </div>
  );
}
