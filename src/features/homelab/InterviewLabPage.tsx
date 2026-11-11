import { useEffect, useRef, useState } from "react";
import { MessageSquare } from "lucide-react";
import { ApiError, answerTurn, startInterview, type AnswerResult, type ApplicationSummary, type Feedback, type InterviewTurn } from "./api";
import ConnectionCard from "./ConnectionCard";

const STYLES = [
  { id: "general", label: "General technical screen" },
  { id: "cysa", label: "Security analyst (alert and log triage)" },
  { id: "aws", label: "AWS troubleshooting" },
] as const;

type Entry =
  | { kind: "question"; turn: InterviewTurn }
  | { kind: "answer"; text: string }
  | { kind: "feedback"; feedback: Feedback | null; note: string | null; covers: string[] };

function FeedbackCard({ feedback, note, covers }: { feedback: Feedback | null; note: string | null; covers: string[] }) {
  return (
    <div className="lab-feedback" data-testid="interview-feedback">
      {feedback ? (
        <>
          <p className="lab-score" aria-label={`Score ${feedback.score} out of 5`}><strong>{feedback.score}</strong>/5</p>
          {feedback.strengths.length ? <><h4>What worked</h4><ul>{feedback.strengths.map((s) => <li key={s}>{s}</li>)}</ul></> : null}
          {feedback.gaps.length ? <><h4>What was missing</h4><ul>{feedback.gaps.map((s) => <li key={s}>{s}</li>)}</ul></> : null}
          {feedback.next_step ? <p><strong>Next step:</strong> {feedback.next_step}</p> : null}
        </>
      ) : (
        <p className="career-muted">{note ?? "No feedback was produced for this answer."}</p>
      )}
      {covers.length ? <details><summary>A good answer covers</summary><ul>{covers.map((c) => <li key={c}>{c}</li>)}</ul></details> : null}
    </div>
  );
}

export default function InterviewLabPage() {
  const [applications, setApplications] = useState<ApplicationSummary[] | null>(null);
  const [applicationId, setApplicationId] = useState("");
  const [style, setStyle] = useState<string>("general");
  const [count, setCount] = useState(5);
  const [session, setSession] = useState<{ id: number; total: number; model: string | null } | null>(null);
  const [log, setLog] = useState<Entry[]>([]);
  const [current, setCurrent] = useState<InterviewTurn | null>(null);
  const [scores, setScores] = useState<Array<{ skill: string | null; score: number | null }>>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState<"starting" | "answering" | null>(null);
  const [error, setError] = useState("");
  const [finished, setFinished] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => () => abort.current?.abort(), []);
  useEffect(() => {
    if (typeof endRef.current?.scrollIntoView === "function") endRef.current.scrollIntoView({ block: "nearest" });
  }, [log, busy]);

  const reset = () => {
    abort.current?.abort();
    setSession(null);
    setLog([]);
    setCurrent(null);
    setScores([]);
    setDraft("");
    setFinished(false);
    setError("");
    setBusy(null);
  };

  const start = async () => {
    if (!applicationId) return;
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    setBusy("starting");
    setError("");
    try {
      const started = await startInterview({ application_id: Number(applicationId), style, question_count: count }, controller.signal);
      setSession({ id: started.id, total: started.total, model: started.model });
      setLog([{ kind: "question", turn: started.next_turn }]);
      setCurrent(started.next_turn);
      setScores([]);
      setFinished(false);
    } catch (e) {
      if ((e as { name?: string })?.name !== "AbortError") setError(e instanceof ApiError ? e.message : "Couldn’t start the session.");
    } finally {
      setBusy(null);
    }
  };

  const send = async () => {
    if (!session || !current || !draft.trim() || busy) return;
    const controller = new AbortController();
    abort.current = controller;
    const text = draft.trim();
    setBusy("answering");
    setError("");
    try {
      const result: AnswerResult = await answerTurn(session.id, current.index, text, controller.signal);
      setLog((entries) => [
        ...entries,
        { kind: "answer", text },
        { kind: "feedback", feedback: result.feedback, note: result.feedback_note, covers: result.good_answer_covers },
        ...(result.next_turn ? [{ kind: "question", turn: result.next_turn } as Entry] : []),
      ]);
      setScores((s) => [...s, { skill: current.skill, score: result.feedback?.score ?? null }]);
      setDraft("");
      setCurrent(result.next_turn);
      setFinished(result.finished);
    } catch (e) {
      // The typed answer stays in the box so a model hiccup never costs the person their work.
      if ((e as { name?: string })?.name !== "AbortError") setError(e instanceof ApiError ? e.message : "Couldn’t send that answer.");
    } finally {
      setBusy(null);
    }
  };

  const scored = scores.filter((s) => s.score !== null) as Array<{ skill: string | null; score: number }>;
  const average = scored.length ? scored.reduce((sum, s) => sum + s.score, 0) / scored.length : null;

  return (
    <div className="career-feature lab-page" data-testid="interview-lab">
      <div className="career-feature-header">
        <div>
          <span className="career-overline">HOME LAB</span>
          <h1>Technical screen practice</h1>
          <p>Scenario questions built from a job’s required skills and your own skill ratings, written by the model on your own server.</p>
        </div>
      </div>

      <ConnectionCard onConnected={(list) => { setApplications(list); if (!applicationId && list[0]) setApplicationId(String(list[0].id)); }} onDisconnected={() => { setApplications(null); reset(); }} />

      {applications ? (
        <section className="career-panel" aria-labelledby="lab-setup-h">
          <div className="career-panel-heading"><h2 id="lab-setup-h"><MessageSquare size={18} aria-hidden /> New session</h2></div>
          {applications.length === 0 ? (
            <p className="career-muted">There are no applications in your home-lab database yet.</p>
          ) : (
            <form className="lab-setup" onSubmit={(e) => { e.preventDefault(); void start(); }}>
              <label>
                Application
                <select value={applicationId} onChange={(e) => setApplicationId(e.target.value)} data-testid="interview-application">
                  {applications.map((a) => <option key={a.id} value={a.id}>{a.title} · {a.company.name}</option>)}
                </select>
              </label>
              <label>
                Style
                <select value={style} onChange={(e) => setStyle(e.target.value)} data-testid="interview-style">
                  {STYLES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
              </label>
              <label>
                Questions
                <select value={count} onChange={(e) => setCount(Number(e.target.value))} data-testid="interview-count">
                  {[3, 5, 8].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </label>
              <button type="submit" className="lab-btn" disabled={!applicationId || busy !== null} data-testid="interview-start">{session ? "Start a new session" : "Start"}</button>
            </form>
          )}
          <p className="career-muted lab-fineprint">Questions are original practice scenarios in the style of performance-based exam items. They are not real exam questions, and nothing here predicts an exam result.</p>
          {busy === "starting" ? <p role="status" className="career-muted" data-testid="interview-starting">Writing questions with your model. This can take a minute…</p> : null}
          {!session && error ? <p className="lab-error" role="alert" data-testid="interview-error">{error}</p> : null}
        </section>
      ) : null}

      {session ? (
        <section className="career-panel lab-chat" aria-labelledby="lab-chat-h" data-testid="interview-chat">
          <div className="career-panel-heading">
            <h2 id="lab-chat-h">Session</h2>
            <span className="career-muted" data-testid="interview-progress">{finished ? "Finished" : `Question ${Math.min((current?.index ?? session.total - 1) + 1, session.total)} of ${session.total}`}{session.model ? ` · ${session.model}` : ""}</span>
          </div>
          <div className="lab-log" role="log" aria-live="polite" aria-label="Interview conversation">
            {log.map((entry, i) =>
              entry.kind === "question" ? (
                <div key={i} className="lab-bubble lab-bubble-assistant" data-testid="interview-question">
                  <div className="lab-bubble-meta">{entry.turn.skill ? <span className="lab-pill">{entry.turn.skill}</span> : null}<span className="career-muted">Difficulty {entry.turn.difficulty}/5</span></div>
                  <p className="lab-scenario">{entry.turn.scenario}</p>
                  <p><strong>{entry.turn.question}</strong></p>
                </div>
              ) : entry.kind === "answer" ? (
                <div key={i} className="lab-bubble lab-bubble-user" data-testid="interview-answer">{entry.text}</div>
              ) : (
                <FeedbackCard key={i} feedback={entry.feedback} note={entry.note} covers={entry.covers} />
              ),
            )}
            {busy === "answering" ? <p role="status" className="career-muted" data-testid="interview-thinking">Reading your answer…</p> : null}
            <div ref={endRef} />
          </div>

          {finished ? (
            <div className="lab-summary" data-testid="interview-summary">
              <h3>Session complete</h3>
              {average !== null ? <p>Average score <strong>{average.toFixed(1)}/5</strong> across {scored.length} scored answer{scored.length === 1 ? "" : "s"}.</p> : <p>No answers were scored.</p>}
              <ul>{scores.map((s, i) => <li key={i}>{s.skill ?? "Question"}: {s.score === null ? "not scored" : `${s.score}/5`}</li>)}</ul>
              <button type="button" className="lab-btn lab-btn-secondary" onClick={reset}>Close session</button>
            </div>
          ) : current ? (
            <form className="lab-answer" onSubmit={(e) => { e.preventDefault(); void send(); }}>
              <label htmlFor="lab-answer-input">Your answer</label>
              <textarea
                id="lab-answer-input"
                rows={5}
                maxLength={4000}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); void send(); } }}
                disabled={busy === "answering"}
                data-testid="interview-input"
              />
              <div className="lab-row">
                <button type="submit" className="lab-btn" disabled={!draft.trim() || busy !== null} data-testid="interview-send">Send answer</button>
                {busy === "answering" ? <button type="button" className="lab-btn lab-btn-secondary" onClick={() => abort.current?.abort()}>Stop waiting</button> : null}
                <span className="career-muted">Ctrl+Enter to send</span>
              </div>
              {error ? <p className="lab-error" role="alert" data-testid="interview-error">{error}</p> : null}
            </form>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
