import React, { useEffect, useMemo, useRef, useState } from "react";
import { Copy, Download, Mic, Square, Video } from "lucide-react";
import PageHeader from "../../components/ui/PageHeader";
import EmptyState from "../../components/ui/EmptyState";

type Mode = "STAR" | "CARL";

type Q = {
  id: string;
  text: string;
  tags?: string[];
};

const QUESTIONS: Q[] = [
  { id: "why-role-company", text: "Why this role and this company?", tags: ["motivation", "fit"] },
  { id: "own-end-to-end", text: "Tell me about a time you owned a problem end-to-end.", tags: ["ownership", "leadership"] },
  { id: "missed-deadline", text: "A time you missed a deadline—what happened and what did you learn?", tags: ["learning", "planning"] },
  { id: "disagree-teammate", text: "A time you disagreed with a teammate/manager—what did you do?", tags: ["collaboration", "conflict"] },
  { id: "made-mistake", text: "A time you made a mistake—how did you fix it and prevent repeats?", tags: ["accountability", "quality"] },
  { id: "earn-trust", text: "A time you had to earn trust with a skeptical stakeholder.", tags: ["stakeholders", "communication"] },
  { id: "simplified-process", text: "A time you simplified a complex process or tool.", tags: ["design", "efficiency"] },
  { id: "raise-quality-bar", text: "A time you raised the quality bar (testing, reviews, automation).", tags: ["quality", "craft"] },
  { id: "speed-vs-safety", text: "A time you balanced speed vs. safety (Bias for Action vs. risk).", tags: ["tradeoffs", "judgment"] },
  { id: "handle-ambiguity", text: "A time you handled ambiguity with little guidance.", tags: ["ambiguity", "initiative"] },
  { id: "mentor-unblock", text: "A time you mentored or unblocked someone.", tags: ["mentoring", "leadership"] },
  { id: "influence-no-authority", text: "A time you influenced without authority.", tags: ["influence", "stakeholders"] },
  { id: "multiple-priorities", text: "A time you handled multiple priorities under pressure.", tags: ["prioritization", "resilience"] },
  { id: "measured-impact", text: "A time you measured impact and delivered results.", tags: ["metrics", "results"] },
  { id: "think-big", text: "A time you set a bold goal and rallied others (Think Big).", tags: ["vision", "leadership"] },
  { id: "frugal-value", text: "A time you were frugal and still delivered value.", tags: ["frugality", "resourcefulness"] },
  { id: "dive-deep", text: "A time you had to dive deep into a gnarly issue.", tags: ["analysis", "problem-solving"] },
  { id: "pushback-commit", text: "A time you pushed back respectfully and then committed.", tags: ["disagree & commit", "teamwork"] },
];

function useAutosave(key: string, initial: string) {
  const [val, setVal] = useState(() => localStorage.getItem(key) ?? initial);
  useEffect(() => {
    localStorage.setItem(key, val);
  }, [key, val]);
  return [val, setVal] as const;
}

export default function BehavioralBank() {
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<Mode>("STAR");
  const [selected, setSelected] = useState<Q | null>(null);

  const [isRecording, setIsRecording] = useState(false);
  const [startingRecording, setStartingRecording] = useState(false);
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [recordErr, setRecordErr] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const [copied, setCopied] = useState(false);
  const [cleared, setCleared] = useState(false);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return QUESTIONS;
    return QUESTIONS.filter(
      (item) => item.text.toLowerCase().includes(q) || item.tags?.some((t) => t.includes(q)),
    );
  }, [query]);

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

  const hasDraftBody = Boolean(S.trim() || T.trim() || A.trim() || R.trim() || L.trim());

  async function copyAnswer() {
    try {
      await navigator.clipboard.writeText(output);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }

  async function startRecording() {
    setRecordErr(null);
    setStartingRecording(true);
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      setStream(mediaStream);

      const mediaRecorder = new MediaRecorder(mediaStream, {
        mimeType: "video/webm;codecs=vp9,opus",
      });

      chunksRef.current = [];
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "video/webm" });
        const url = URL.createObjectURL(blob);
        setRecordingUrl(url);
        mediaStream.getTracks().forEach((track) => track.stop());
        setStream(null);
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error("Error starting recording:", error);
      setRecordErr("Camera or microphone access was blocked or unavailable. Check browser permissions and try again.");
    } finally {
      setStartingRecording(false);
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
      const a = document.createElement("a");
      a.href = recordingUrl;
      a.download = `behavioral-practice-${selected?.id || "question"}.webm`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  }

  function clearFields() {
    setS("");
    setT("");
    setA("");
    setR("");
    setL("");
    setCleared(true);
    window.setTimeout(() => setCleared(false), 2000);
  }

  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
      if (recordingUrl) {
        URL.revokeObjectURL(recordingUrl);
      }
    };
  }, [stream, recordingUrl]);

  return (
    <div className="space-y-8 pb-6">
      <PageHeader
        eyebrow="Career Tools"
        title="Behavioral Interview Q&A"
        sub="Choose a prompt, fill in STAR or CARL, then copy a clean answer or record a practice take. Drafts autosave per question in this browser; nothing is sent to a server."
      />

      <div className="grid gap-0 border-t border-black/[0.07] dark:border-white/[0.09] lg:grid-cols-3 lg:items-start">
        <div className="border-black/[0.07] py-8 dark:border-white/[0.09] lg:border-r lg:pr-8 lg:py-10">
          <div className="space-y-2">
            <label htmlFor="behavioral-search" className="text-sm font-medium text-ink dark:text-white">
              Find a question
            </label>
            <input
              id="behavioral-search"
              className="input"
              placeholder="Search text or tags (e.g. trust, quality, ambiguity)"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <p className="text-caption text-ink-muted">{list.length} match{list.length === 1 ? "" : "es"}</p>
          </div>
          {list.length === 0 ? (
            <EmptyState
              className="mt-4 min-h-[10rem]"
              title="No questions match"
              hint="Try a shorter search or a different tag."
            />
          ) : (
            <ul className="mt-4 max-h-[min(60vh,28rem)] divide-y divide-black/[0.07] overflow-y-auto border-t border-black/[0.07] dark:divide-white/[0.09] dark:border-white/[0.09]">
              {list.map((q) => (
                <li key={q.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(q)}
                    className={[
                      "w-full py-3.5 text-left transition-colors",
                      "hover:bg-black/[0.02] dark:hover:bg-white/[0.03]",
                      selected?.id === q.id ? "text-accent" : "text-ink dark:text-white",
                    ].join(" ")}
                  >
                    <div className="font-medium text-ink dark:text-white">{q.text}</div>
                    {!!q.tags?.length && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {q.tags.map((t) => (
                          <span key={t} className="chip">
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-0 border-t border-black/[0.07] dark:border-white/[0.09] lg:col-span-2 lg:border-t-0 lg:pl-8">
          <div className="py-8 lg:py-10">
            <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className={mode === "STAR" ? "btn btn-primary min-h-10 px-4" : "btn surface-muted min-h-10 px-4"}
                  onClick={() => setMode("STAR")}
                >
                  STAR
                </button>
                <button
                  type="button"
                  className={mode === "CARL" ? "btn btn-primary min-h-10 px-4" : "btn surface-muted min-h-10 px-4"}
                  onClick={() => setMode("CARL")}
                >
                  CARL
                </button>
              </div>
              <p className="text-sm text-ink-muted">
                {mode === "STAR"
                  ? "Situation → Task → Action → Result"
                  : "Context → Action → Result → Learning"}
              </p>
            </div>

            {!selected ? (
              <EmptyState
                className="mt-6"
                title="Pick a question to start"
                hint="Your answers are saved per question. Switch prompts anytime — each keeps its own draft."
              />
            ) : (
              <div className="mt-6 grid gap-6 md:grid-cols-2">
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-ink dark:text-white">Your story</h3>
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <label htmlFor="b-s" className="text-caption font-medium text-ink-muted">
                        {mode === "STAR" ? "Situation" : "Context"}
                      </label>
                      <textarea
                        id="b-s"
                        className="textarea min-h-[5rem]"
                        placeholder={mode === "STAR" ? "Set the scene: team, constraints, stakes…" : "Where were you, and what was going on?"}
                        value={S}
                        onChange={(e) => setS(e.target.value)}
                      />
                    </div>
                    {mode === "STAR" && (
                      <div className="space-y-1.5">
                        <label htmlFor="b-t" className="text-caption font-medium text-ink-muted">
                          Task
                        </label>
                        <input
                          id="b-t"
                          className="input"
                          placeholder="What were you responsible for delivering?"
                          value={T}
                          onChange={(e) => setT(e.target.value)}
                        />
                      </div>
                    )}
                    <div className="space-y-1.5">
                      <label htmlFor="b-a" className="text-caption font-medium text-ink-muted">
                        Action
                      </label>
                      <textarea
                        id="b-a"
                        className="textarea min-h-[5rem]"
                        placeholder="What did you do, step by step? Tools, decisions, collaboration…"
                        value={A}
                        onChange={(e) => setA(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label htmlFor="b-r" className="text-caption font-medium text-ink-muted">
                        Result
                      </label>
                      <input
                        id="b-r"
                        className="input"
                        placeholder="Outcomes with metrics if you have them"
                        value={R}
                        onChange={(e) => setR(e.target.value)}
                      />
                    </div>
                    {mode === "CARL" && (
                      <div className="space-y-1.5">
                        <label htmlFor="b-l" className="text-caption font-medium text-ink-muted">
                          Learning
                        </label>
                        <input
                          id="b-l"
                          className="input"
                          placeholder="What you’d do again or differently"
                          value={L}
                          onChange={(e) => setL(e.target.value)}
                        />
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-col border-t border-black/[0.07] pt-6 dark:border-white/[0.09] md:border-t-0 md:border-l md:pl-6 md:pt-0">
                  <h3 className="text-sm font-semibold text-ink dark:text-white">Preview</h3>
                  <p className="mt-1 text-caption text-ink-muted">Formatted for notes or chat — copy when you’re ready.</p>
                  {!hasDraftBody ? (
                    <EmptyState
                      className="mt-4 min-h-[12rem] flex-1 border-black/[0.08] dark:border-white/12"
                      title="Nothing to show yet"
                      hint="Add a few bullets in the fields on the left. The preview updates as you type."
                    />
                  ) : (
                    <pre className="mt-4 max-h-[min(50vh,22rem)] flex-1 overflow-auto whitespace-pre-wrap border-l border-black/[0.08] py-2 pl-4 text-sm text-ink dark:border-white/10 dark:text-white/90">
                      {output}
                    </pre>
                  )}
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="btn btn-primary min-h-10 gap-2 px-4"
                      onClick={copyAnswer}
                      disabled={!hasDraftBody}
                    >
                      <Copy className="h-4 w-4 shrink-0" aria-hidden />
                      {copied ? "Copied" : "Copy answer"}
                    </button>
                    <button type="button" className="btn surface-muted min-h-10 px-4" onClick={clearFields}>
                      {cleared ? "Cleared" : "Clear fields"}
                    </button>
                  </div>
                  {copied ? (
                    <p className="mt-2 text-sm font-medium text-accent" role="status">
                      On your clipboard
                    </p>
                  ) : null}
                </div>
              </div>
            )}
          </div>

          {selected ? (
            <div className="border-t border-black/[0.07] py-8 dark:border-white/[0.09] lg:py-10">
              <h3 className="text-title-sm text-ink dark:text-white">Practice recording</h3>
              <p className="mt-1 text-sm text-ink-muted">
                Record a 60–90 second answer as if you were in a live interview. Video stays on your device until you download it.
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                {!isRecording ? (
                  <button
                    type="button"
                    className="btn btn-primary min-h-10 gap-2 px-4"
                    onClick={startRecording}
                    disabled={startingRecording}
                  >
                    <Video className="h-4 w-4 shrink-0" aria-hidden />
                    {startingRecording ? "Starting…" : "Start recording"}
                  </button>
                ) : (
                  <button type="button" className="btn surface-muted min-h-10 gap-2 px-4" onClick={stopRecording}>
                    <Square className="h-4 w-4 shrink-0" aria-hidden />
                    Stop recording
                  </button>
                )}

                {recordingUrl ? (
                  <button type="button" className="btn surface-muted min-h-10 gap-2 px-4" onClick={downloadRecording}>
                    <Download className="h-4 w-4 shrink-0" aria-hidden />
                    Download video
                  </button>
                ) : null}
              </div>

              {recordErr ? (
                <p className="mt-3 text-sm text-red-600 dark:text-red-400" role="alert">
                  {recordErr}
                </p>
              ) : null}

              {isRecording ? (
                <p className="mt-3 flex items-center gap-2 text-sm font-medium text-accent" role="status">
                  <Mic className="h-4 w-4 shrink-0" aria-hidden />
                  <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-red-500" aria-hidden />
                  Recording…
                </p>
              ) : null}

              {!recordingUrl && !isRecording ? (
                <div className="mt-4 border-b border-dashed border-black/[0.1] py-8 text-center dark:border-white/12">
                  <p className="text-sm text-ink-muted">Your recording preview will show here after you stop.</p>
                </div>
              ) : null}

              {recordingUrl ? (
                <div className="mt-4">
                  <video src={recordingUrl} controls className="max-h-[220px] w-full max-w-md" />
                </div>
              ) : null}
            </div>
          ) : (
            <div className="border-t border-black/[0.07] py-8 dark:border-white/[0.09]">
              <EmptyState
                title="Recording unlocks after you choose a question"
                hint="Select a prompt from the list so your practice clip is tied to that scenario."
              />
            </div>
          )}

          <div className="border-t border-black/[0.07] py-8 dark:border-white/[0.09] lg:py-10">
            <h3 className="text-sm font-semibold text-ink dark:text-white">Quick tips</h3>
            <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-ink-muted">
              <li>Lead with the outcome, then short context and what you personally did.</li>
              <li>Prefer numbers: %, dollars, time saved, incidents reduced, users affected.</li>
              <li>Use &quot;I&quot; for your actions and &quot;we&quot; when crediting the team.</li>
              <li>Aim for about 60–90 seconds on camera; tighten wording on each repeat.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
