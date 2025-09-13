import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

/**
 * Lightweight PD Coach:
 * - Floating button (bottom-right)
 * - Slide-up chat panel
 * - Local intent matcher (resume, linkedin, github, interview, star/carl, certs)
 * - Persists history to localStorage
 * - Suggestion chips
 */
type Msg = { role: "user" | "assistant"; text: string; time: number };

const SUGGESTIONS = [
  "How do I fix my résumé headline?",
  "Give me LinkedIn About examples",
  "What is STAR vs CARL?",
  "How do I format GitHub profile?",
  "Which cert path for cloud?",
  "Behavioral interview practice",
];

const STORAGE = "pd:coach:chat";

export default function PDCoach() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [msgs, setMsgs] = useState<Msg[]>(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE) || "[]"); } catch { return []; }
  });
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { localStorage.setItem(STORAGE, JSON.stringify(msgs)); }, [msgs]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, open]);

  function send(text: string) {
    if (!text.trim()) return;
    const now = Date.now();
    const next = [...msgs, { role: "user", text, time: now }];
    const reply = respond(text);
    setMsgs([...next, { role: "assistant", text: reply, time: now + 1 }]);
    setInput("");
  }

  function respond(q: string): string {
    const s = q.toLowerCase();

    // Résumé
    if (s.includes("résumé") || s.includes("resume")) {
      return [
        "Résumé quick wins:",
        "• Headline: Role · skills · impact (e.g., 'Frontend Engineer · React/TS · -35% TTI').",
        "• Sections: Summary · Skills · Experience · Projects · Education.",
        "• Bullets: start with action verbs + metric.",
        "Open the Résumé Grader in Career Tools for a full check.",
        linkTo("/career-tools")
      ].join("\n");
    }

    // LinkedIn
    if (s.includes("linkedin")) {
      return [
        "LinkedIn structure:",
        "• Headline: role · skills · impact.",
        "• About: 3–5 lines (focus, wins, what's next).",
        "• Experience: impact-first bullets; add media.",
        "Open: LinkedIn Guide.",
        linkTo("/career-tools/linkedin")
      ].join("\n");
    }

    // GitHub
    if (s.includes("github")) {
      return [
        "GitHub profile:",
        "• Create a repo named exactly your username; its README is your profile.",
        "• Pin 6 repos (2 polished projects, 1–2 learning, 1 tooling).",
        "• Each repo README: what/for whom/results + setup.",
        "Open: GitHub Profile Guide.",
        linkTo("/career-tools/github")
      ].join("\n");
    }

    // STAR / CARL
    if (s.includes("star") || s.includes("carl")) {
      return [
        "STAR vs CARL:",
        "• STAR: Situation → Task → Action → Result.",
        "• CARL: Context → Action → Result → Learning (adds learning).",
        "Tip: one metric per story. Practice in Career Tools → Behavioral Q&A.",
        linkTo("/career-tools")
      ].join("\n");
    }

    // Behavioral interview
    if (s.includes("behavioral") || s.includes("behavioural") || s.includes("interview")) {
      return [
        "Behavioral prep:",
        "1) Draft 6–8 STAR/CARL stories (ownership, conflict, mistake, impact, ambiguity, leadership).",
        "2) Practice aloud; record yourself; tighten to 60–90 seconds.",
        "3) End with a metric and a learning.",
        "See Career Tools for prompts.",
        linkTo("/career-tools")
      ].join("\n");
    }

    // Certs / Cloud / Data / Security
    if (s.includes("cert") || s.includes("cloud") || s.includes("data") || s.includes("security")) {
      return [
        "Cert paths (very practical):",
        "• Cloud: AWS CCP → SAA → DevOps/Security specialty.",
        "• Data: Python+SQL+Stats → ML basics → deploy one model.",
        "• Security: Security+ → Cloud Sec (AWS/Azure) → AppSec (OWASP).",
        "Open: Certifications & Learning.",
        linkTo("/Resources/Certs")
      ].join("\n");
    }

    // Default
    return [
      "I can help with résumé, LinkedIn, GitHub, behavioral prep, and cert paths.",
      "Try: 'Give me a LinkedIn About example' or 'Which cert path for cloud?'"
    ].join("\n");
  }

  function linkTo(to: string) { return `→ ${window.location.origin}${to}`; }

  return (
    <>
      {/* Floating button */}
      <button
        className="coach-fab btn btn-anim btn-pink"
        onClick={()=>setOpen(o=>!o)}
        aria-expanded={open}
        title={open ? "Close PD Coach" : "Open PD Coach"}
      >
        {open ? "Close" : "PD Coach"}
      </button>

      {/* Panel */}
      {open && (
        <div className="coach-panel surface p-4 hover-glow">
          <div className="flex items-center justify-between">
            <div className="font-semibold">Professional Development Coach</div>
            <button className="btn" onClick={()=>setOpen(false)}>×</button>
          </div>

          {/* Suggestions */}
          <div className="mt-2 flex flex-wrap gap-2">
            {SUGGESTIONS.map(s => (
              <button key={s} className="chip" onClick={()=>send(s)}>{s}</button>
            ))}
          </div>

          {/* Messages */}
          <div className="mt-3 coach-scroll">
            {msgs.map((m,i)=>(
              <div key={i} className={`mb-2 ${m.role==="user"?"text-right":""}`}>
                <div className={`inline-block max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                  m.role==="user" ? "bg-[color:var(--surface-2)]" : "bg-[color:var(--surface-1)]"
                }`}>
                  {m.text.split("\n").map((line, j)=><div key={j}>{line}</div>)}
                </div>
              </div>
            ))}
            <div ref={endRef} />
          </div>

          {/* Input */}
          <form className="mt-2 flex gap-2" onSubmit={(e)=>{e.preventDefault(); send(input);}}>
            <input
              className="input flex-1"
              placeholder="Ask about résumé, LinkedIn, GitHub, interviews, certs..."
              value={input}
              onChange={e=>setInput(e.target.value)}
            />
            <button className="btn btn-anim btn-pink" type="submit">Send</button>
          </form>
        </div>
      )}
    </>
  );
}
