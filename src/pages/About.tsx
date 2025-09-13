import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";

type Stage = "discover" | "build" | "grow";

const STAGES: Record<Stage, { title: string; blurb: string; links: {label:string; to:string}[]; checklist: string[] }> = {
  discover: {
    title: "Discover",
    blurb: "Clarify strengths, values, and interests so actions match who you are.",
    links: [ { label: "Open Self-Assessment", to: "/self-assessment" } ],
    checklist: ["Take strengths test", "Write 5 values", "Pick 3 role interests"],
  },
  build: {
    title: "Build",
    blurb: "Turn clarity into proof: résumé, LinkedIn, STAR stories, portfolio.",
    links: [ { label: "Open Career Tools", to: "/career-tools" } ],
    checklist: ["Polish résumé headline", "Tighten LinkedIn 'About'", "Add 2 portfolio updates"],
  },
  grow: {
    title: "Grow",
    blurb: "Use roadmaps, trackers, and time tools to keep consistent momentum.",
    links: [ { label: "Open Resources", to: "/resources" } ],
    checklist: ["Pick a cert/learning path", "Plan weekly hours", "Log progress twice this week"],
  },
};

export default function About() {
  const [stage, setStage] = useState<Stage>(() => (localStorage.getItem("pd:about:stage3") as Stage) || "discover");
  useEffect(()=> localStorage.setItem("pd:about:stage3", stage), [stage]);
  const s = STAGES[stage];

  return (
    <div className="space-y-6">
      <header className="surface-muted p-6">
        <h1 className="brand-heading text-2xl font-semibold">About</h1>
        <p>Three-step loop: <b>Discover → Build → Grow</b>. Pick your stage and jump in.</p>
      </header>

      <section className="surface p-5 hover-glow">
        <h2 className="text-lg font-semibold">Where are you now?</h2>
        <div className="grid sm:grid-cols-3 gap-2 mt-3">
          {(["discover","build","grow"] as Stage[]).map(id => (
            <button key={id}
              className={`btn ${stage===id ? "btn-anim btn-pink" : ""}`}
              onClick={()=>setStage(id)}
            >
              {STAGES[id].title}
            </button>
          ))}
        </div>
      </section>

      <section className="surface p-5 hover-glow">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{s.title}</h2>
          <span className="chip">{stage === "build" ? "ship proof" : stage === "grow" ? "keep momentum" : "clarify fit"}</span>
        </div>
        <p className="mt-2">{s.blurb}</p>

        <div className="grid sm:grid-cols-3 gap-2 mt-3">
          {s.links.map(l => <Link key={l.to} to={l.to} className="btn btn-anim btn-pink">{l.label}</Link>)}
        </div>

        <Checklist stage={stage} />
      </section>

      <section className="surface p-5 hover-glow">
        <h2 className="text-lg font-semibold">FAQ</h2>
        <FAQItem q="What should I do first?" a="Start with Discover → one strengths/values pass. Then Build → make one résumé/LinkedIn improvement. Finally Grow → choose one weekly goal." />
        <FAQItem q="How often should I come back?" a="20–40 minutes per day is great. Small daily moves beat big sporadic sessions." />
        <FAQItem q="How do I know I'm progressing?" a="Proof increases: clearer profile, better portfolio, higher application quality, and consistent logs." />
      </section>
    </div>
  );
}

function Checklist({ stage }: { stage: Stage }) {
  const key = `pd:about:${stage}:check3`;
  const defaults = STAGES[stage].checklist;
  const [state, setState] = useState<boolean[]>(() => {
    try { return JSON.parse(localStorage.getItem(key) || "[]"); } catch { return []; }
  });
  useEffect(()=> localStorage.setItem(key, JSON.stringify(state)), [state]);
  return (
    <div className="surface-muted p-4 rounded-xl mt-4">
      <div className="font-medium">Quick checklist</div>
      <ul className="mt-2 space-y-1">
        {defaults.map((label, i) => (
          <li key={label} className="flex items-center gap-2">
            <input type="checkbox" className="accent-[var(--accent-pink)] scale-110"
              checked={!!state[i]}
              onChange={e => { const n=[...state]; n[i]=e.target.checked; setState(n); }}
            />
            <span className={state[i] ? "line-through opacity-70" : ""}>{label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="surface-muted rounded-xl mb-2 overflow-hidden">
      <button className="w-full text-left px-4 py-3 flex items-center justify-between"
        onClick={()=>setOpen(o=>!o)}>
        <span className="font-medium">{q}</span>
        <span className="chip">{open ? "–" : "+"}</span>
      </button>
      <div className={`px-4 pb-4 text-sm transition-[max-height,opacity] duration-300 ${open?"max-h-40 opacity-100":"max-h-0 opacity-0"}`}>
        {a}
      </div>
    </div>
  );
}
