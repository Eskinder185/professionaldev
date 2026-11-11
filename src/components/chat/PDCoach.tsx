import React, { useEffect, useRef, useState } from "react";

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
    const userMessage: Msg = { role: "user", text, time: now };
    const next: Msg[] = [...msgs, userMessage];
    const reply = respond(text);
    const assistantMessage: Msg = { role: "assistant", text: reply, time: now + 1 };
    setMsgs([...next, assistantMessage]);
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
        linkTo("/resources/certs")
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
        type="button"
        className="coach-fab"
        onClick={()=>setOpen(o=>!o)}
        aria-expanded={open}
        aria-controls="pd-coach-panel"
        id="pd-coach-toggle"
        title={open ? "Close PD Coach" : "Open PD Coach"}
        aria-label={open ? "Close PD Coach assistant" : "Open PD Coach assistant"}
      >
        {open ? "Close" : "PD Coach"}
      </button>

      {/* Panel */}
      {open && (
        <div className="coach-panel p-4" id="pd-coach-panel" role="region" aria-labelledby="pd-coach-title">
          <div className="flex shrink-0 items-center justify-between gap-2">
            <div id="pd-coach-title" className="text-sm font-semibold text-ink dark:text-white">
              PD Coach
            </div>
            <button type="button" className="btn min-h-9 min-w-9 px-0" onClick={()=>setOpen(false)} aria-label="Close coach">
              ×
            </button>
          </div>

          {/* Suggestions */}
          <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Suggested prompts">
            {SUGGESTIONS.map((s) => (
              <button key={s} type="button" className="chip-action max-w-full text-left" onClick={() => send(s)}>
                <span className="line-clamp-2">{s}</span>
              </button>
            ))}
          </div>

          {/* Messages */}
          <div className="mt-3 coach-scroll" role="log" aria-live="polite" aria-relevant="additions">
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
          <form className="mt-3 flex shrink-0 flex-col gap-2 sm:flex-row" onSubmit={(e)=>{e.preventDefault(); send(input);}}>
            <label htmlFor="pd-coach-input" className="sr-only">
              Message to PD Coach
            </label>
            <input
              id="pd-coach-input"
              className="input min-h-11 flex-1"
              placeholder="Ask about résumé, LinkedIn, GitHub, interviews, certs…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              autoComplete="off"
            />
            <button className="btn btn-primary min-h-11 shrink-0 px-5 sm:px-4" type="submit">
              Send
            </button>
          </form>
        </div>
      )}
    </>
  );
}
