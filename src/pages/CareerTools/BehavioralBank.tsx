import React, { useEffect, useMemo, useRef, useState } from "react";

type Mode = "STAR" | "CARL";

type Q = {
  id: string;
  text: string;
  tags?: string[];
};

const QUESTIONS: Q[] = [
  { id: "why-role-company", text: "Why this role and this company?", tags: ["motivation","fit"] },
  { id: "own-end-to-end", text: "Tell me about a time you owned a problem end-to-end.", tags: ["ownership","leadership"] },
  { id: "missed-deadline", text: "A time you missed a deadline—what happened and what did you learn?", tags: ["learning","planning"] },
  { id: "disagree-teammate", text: "A time you disagreed with a teammate/manager—what did you do?", tags: ["collaboration","conflict"] },
  { id: "made-mistake", text: "A time you made a mistake—how did you fix it and prevent repeats?", tags: ["accountability","quality"] },
  { id: "earn-trust", text: "A time you had to earn trust with a skeptical stakeholder.", tags: ["stakeholders","communication"] },
  { id: "simplified-process", text: "A time you simplified a complex process or tool.", tags: ["design","efficiency"] },
  { id: "raise-quality-bar", text: "A time you raised the quality bar (testing, reviews, automation).", tags: ["quality","craft"] },
  { id: "speed-vs-safety", text: "A time you balanced speed vs. safety (Bias for Action vs. risk).", tags: ["tradeoffs","judgment"] },
  { id: "handle-ambiguity", text: "A time you handled ambiguity with little guidance.", tags: ["ambiguity","initiative"] },
  { id: "mentor-unblock", text: "A time you mentored or unblocked someone.", tags: ["mentoring","leadership"] },
  { id: "influence-no-authority", text: "A time you influenced without authority.", tags: ["influence","stakeholders"] },
  { id: "multiple-priorities", text: "A time you handled multiple priorities under pressure.", tags: ["prioritization","resilience"] },
  { id: "measured-impact", text: "A time you measured impact and delivered results.", tags: ["metrics","results"] },
  { id: "think-big", text: "A time you set a bold goal and rallied others (Think Big).", tags: ["vision","leadership"] },
  { id: "frugal-value", text: "A time you were frugal and still delivered value.", tags: ["frugality","resourcefulness"] },
  { id: "dive-deep", text: "A time you had to dive deep into a gnarly issue.", tags: ["analysis","problem-solving"] },
  { id: "pushback-commit", text: "A time you pushed back respectfully and then committed.", tags: ["disagree & commit","teamwork"] },
];

function useAutosave(key: string, initial: string) {
  const [val, setVal] = useState(() => localStorage.getItem(key) ?? initial);
  useEffect(() => { localStorage.setItem(key, val); }, [key, val]);
  return [val, setVal] as const;
}

export default function BehavioralBank() {
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<Mode>("STAR");
  const [selected, setSelected] = useState<Q | null>(null);
  
  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return QUESTIONS;
    return QUESTIONS.filter(item =>
      item.text.toLowerCase().includes(q) || item.tags?.some(t => t.includes(q))
    );
  }, [query]);

  // form fields (STAR/CARL share some)
  const keyPrefix = `pd:behavioral:${selected?.id ?? "none"}`;
  const [S, setS] = useAutosave(`${keyPrefix}:S`, "");
  const [T, setT] = useAutosave(`${keyPrefix}:T`, "");
  const [A, setA] = useAutosave(`${keyPrefix}:A`, "");
  const [R, setR] = useAutosave(`${keyPrefix}:R`, "");
  const [L, setL] = useAutosave(`${keyPrefix}:L`, "");

  const output = useMemo(() => {
    if (!selected) return "";
    if (mode === "STAR") {
      return `**Q:** ${selected.text}

**Situation:** ${S}
**Task:** ${T}
**Action:** ${A}
**Result:** ${R}`;
    }
    return `**Q:** ${selected.text}

**Context:** ${S}
**Action:** ${A}
**Result:** ${R}
**Learning:** ${L}`;
  }, [selected, mode, S, T, A, R, L]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(output);
      alert("Copied to clipboard");
    } catch { /* ignore */ }
  }

  // Recording functions
  async function startRecording() {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: true, 
        audio: true 
      });
      setStream(mediaStream);
      
      const mediaRecorder = new MediaRecorder(mediaStream, {
        mimeType: 'video/webm;codecs=vp9,opus'
      });
      
      chunksRef.current = [];
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        setRecordingUrl(url);
        mediaStream.getTracks().forEach(track => track.stop());
        setStream(null);
      };
      
      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Error starting recording:', error);
      alert('Could not access camera/microphone. Please check permissions.');
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }

  function downloadRecording() {
    if (recordingUrl) {
      const a = document.createElement('a');
      a.href = recordingUrl;
      a.download = `behavioral-practice-${selected?.id || 'question'}.webm`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      if (recordingUrl) {
        URL.revokeObjectURL(recordingUrl);
      }
    };
  }, [stream, recordingUrl]);

  return (
    <div className="space-y-6">
      <header className="surface-muted p-6 fade-up">
        <h1 className="brand-heading text-2xl font-semibold">Behavioral Interview Q&A</h1>
        <p>Pick a question, choose STAR or CARL, draft your story with metrics, and copy your final answer.</p>
      </header>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* LEFT: question list */}
        <div className="surface p-5 hover-glow" style={{ ["--glow" as any]:"var(--accent-blue)" }}>
          <div className="mb-3">
            <input
              className="input"
              placeholder="Search questions or tags (e.g., trust, quality, ambiguity)"
              value={query}
              onChange={e=>setQuery(e.target.value)}
            />
          </div>
          <ul className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
            {list.map(q => (
              <li key={q.id}>
                <button
                  onClick={()=>setSelected(q)}
                  className={`w-full text-left surface-muted p-3 rounded-xl transition hover:opacity-90 ${selected?.id===q.id?"outline outline-1 outline-[var(--accent-blue)]":""}`}
                >
                  <div className="font-medium">{q.text}</div>
                  {!!q.tags?.length && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {q.tags.map(t => <span key={t} className="chip">{t}</span>)}
                    </div>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* RIGHT: builder */}
        <div className="lg:col-span-2 space-y-6">
          <div className="surface p-5">
            <div className="flex flex-wrap items-center gap-4 mb-4">
              <div className="flex gap-2">
                <button 
                  className={`btn px-4 py-2 ${mode==="STAR"?"btn-anim btn-pink":"surface-muted"}`} 
                  onClick={()=>setMode("STAR")}
                >
                  STAR
                </button>
                <button 
                  className={`btn px-4 py-2 ${mode==="CARL"?"btn-anim btn-pink":"surface-muted"}`} 
                  onClick={()=>setMode("CARL")}
                >
                  CARL
                </button>
              </div>
              <div className="text-sm opacity-80">
                {mode === "STAR" ? "Situation, Task, Action, Result" : "Context, Action, Result, Learning"}
              </div>
            </div>

            {!selected ? (
              <div className="opacity-80 mt-4">Select a question to begin drafting.</div>
            ) : (
              <div className="grid md:grid-cols-2 gap-4 mt-4">
                <div className="space-y-3">
                  {/* STAR/CARL inputs */}
                  <textarea className="textarea" placeholder={mode==="STAR"?"Situation (context)":"Context"}
                            value={S} onChange={e=>setS(e.target.value)} />
                  {mode==="STAR" && (
                    <input className="input" placeholder="Task (goal/responsibility)" value={T} onChange={e=>setT(e.target.value)} />
                  )}
                  <textarea className="textarea" placeholder="Action (what you did, why, tools)"
                            value={A} onChange={e=>setA(e.target.value)} />
                  <input className="input" placeholder="Result (metrics, outcomes)" value={R} onChange={e=>setR(e.target.value)} />
                  {mode==="CARL" && (
                    <input className="input" placeholder="Learning (insight you carried forward)" value={L} onChange={e=>setL(e.target.value)} />
                  )}
                </div>

                <div className="surface-muted p-4 rounded-xl">
                  <h3 className="font-semibold mb-2">Preview</h3>
                  <pre className="whitespace-pre-wrap text-[0.95rem]">{output || "Your formatted answer will appear here."}</pre>
                  <div className="mt-3 flex gap-2 flex-wrap">
                    <button className="btn btn-anim btn-pink" onClick={copy}>Copy answer</button>
                    <button className="btn" onClick={() => { setS(""); setT(""); setA(""); setR(""); setL(""); }}>Clear</button>
                  </div>
                  <div className="text-xs opacity-70 mt-2">
                    STAR = Situation, Task, Action, Result. CARL = Context, Action, Result, Learning.
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Recording Section */}
          {selected && (
            <div className="surface p-5 hover-glow" style={{ ["--glow" as any]: "var(--accent-orange)" }}>
              <h3 className="font-semibold mb-3">Practice Recording</h3>
              <p className="text-sm opacity-80 mb-4">
                Record yourself answering the selected question. Aim for 60-90 seconds.
              </p>
              
              <div className="flex flex-wrap gap-2 mb-4">
                {!isRecording ? (
                  <button className="btn btn-anim btn-pink" onClick={startRecording}>
                    🎥 Start Recording
                  </button>
                ) : (
                  <button className="btn" onClick={stopRecording}>
                    ⏹️ Stop Recording
                  </button>
                )}
                
                {recordingUrl && (
                  <button className="btn" onClick={downloadRecording}>
                    💾 Download Video
                  </button>
                )}
              </div>
              
              {isRecording && (
                <div className="text-sm text-orange-400 flex items-center gap-2">
                  <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                  Recording in progress...
                </div>
              )}
              
              {recordingUrl && (
                <div className="mt-3">
                  <video 
                    src={recordingUrl} 
                    controls 
                    className="w-full max-w-md rounded-lg"
                    style={{ maxHeight: '200px' }}
                  />
                </div>
              )}
            </div>
          )}

          {/* Tips panel */}
          <div className="surface p-4 hover-glow" style={{ ["--glow" as any]:"var(--accent-orange)" }}>
            <h3 className="font-semibold">Quick tips</h3>
            <ul className="list-disc pl-5 mt-2 space-y-1 text-sm">
              <li>Lead with outcome; then 1–2 lines each for context, action, metrics.</li>
              <li>Numbers beat adjectives: %, $, time saved, incidents reduced, users impacted.</li>
              <li>Own your part: use "I" for actions, "we" for collaboration.</li>
              <li>Keep it concise: ~120–180 seconds max for deep stories; 60–90 seconds ideal.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}