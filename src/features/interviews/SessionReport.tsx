import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Download, Sparkles, Trash2 } from "lucide-react";
import { useAIConnection } from "../ai/AIConnectionProvider";
import { buildInterviewCoachPrompt, validateAIInterviewFeedback, type ValidatedInterviewFeedback } from "../ai/structured";
import { extractRequirements } from "../resume/job/extractRequirements";
import { contentFeedback, speechFeedback, speechMetrics, type FeedbackItem } from "./analysis";
import { deleteRecording, deleteSessionRecordings, loadRecording } from "./mediaStore";
import { MODE_LABELS, TYPE_LABELS, type Answer, type Session } from "./model";
import { presentationObservations } from "./presentation";
import { transcribeAnswerAudio } from "./transcription";

type Props = { session: Session; onChange: (session: Session) => void; onDelete: () => void; onBack: () => void };

function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const format = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;

function Feedback({ items }: { items: FeedbackItem[] }) {
  return (
    <ul className="iv-feedback">
      {items.map((item) => (
        <li key={item.text} className={item.kind}>
          <span className="iv-feedback-kind">{item.kind === "strength" ? "Strength" : item.kind === "improvement" ? "To improve" : "Note"}</span>
          <span>{item.text}</span>
          {item.evidence ? <q>{item.evidence}</q> : null}
        </li>
      ))}
    </ul>
  );
}

function Replay({ answer, onDeleted }: { answer: Answer; onDeleted: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  useEffect(() => {
    if (!answer.mediaId) return;
    let objectUrl: string | null = null;
    loadRecording(answer.mediaId)
      .then((blob) => {
        if (!blob) return setMissing(true);
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => setMissing(true));
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [answer.mediaId]);
  if (!answer.mediaId) return <p className="career-muted">No recording was saved for this answer.</p>;
  if (missing) return <p className="career-muted">The recording has expired or was deleted.</p>;
  return (
    <div className="iv-replay">
      {url ? answer.mediaKind === "video" ? <video controls src={url} aria-label={`Recording of answer to: ${answer.question}`} /> : <audio controls src={url} aria-label={`Recording of answer to: ${answer.question}`} /> : <p className="career-muted">Loading recording…</p>}
      <button
        type="button"
        className="career-danger-button"
        onClick={async () => {
          await deleteRecording(answer.mediaId!).catch(() => undefined);
          onDeleted();
        }}
      >
        <Trash2 size={14} /> Delete recording
      </button>
    </div>
  );
}

function TranscribeSavedButton({
  answer,
  onTranscribed,
}: {
  answer: Answer;
  onTranscribed: (text: string, segments: Answer["segments"]) => void;
}) {
  const [transcribing, setTranscribing] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (!answer.mediaId) return null;

  const run = async () => {
    setTranscribing(true);
    setErr(null);
    try {
      const blob = await loadRecording(answer.mediaId!);
      if (!blob) throw new Error("Audio recording is not available in local storage.");
      const res = await transcribeAnswerAudio(blob, "whisper-browser");
      if (res.text) {
        onTranscribed(res.text, res.segments);
      } else {
        setErr("No clear speech detected in recording.");
      }
    } catch (e: any) {
      setErr(e?.message || "Transcription failed.");
    } finally {
      setTranscribing(false);
    }
  };

  return (
    <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      <button
        type="button"
        className="career-secondary-button"
        disabled={transcribing}
        onClick={() => void run()}
      >
        <Sparkles size={14} /> {transcribing ? "Transcribing with Whisper…" : "Transcribe recorded audio with Whisper"}
      </button>
      {err && <span className="career-muted" style={{ color: "#ef4444", fontSize: 12 }}>{err}</span>}
    </div>
  );
}

function AIInterviewReview({ answer, jobTitle }: { answer: Answer; jobTitle?: string }) {
  const { connected, state, chatForTask } = useAIConnection();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<ValidatedInterviewFeedback | null>(null);

  const runAnalysis = async () => {
    if (!connected || !answer.text.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await chatForTask("interview_analysis", buildInterviewCoachPrompt(answer.question, answer.text, jobTitle));
      setFeedback(validateAIInterviewFeedback(res.text));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not analyze transcript with AI.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="iv-ai-coach" style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid rgba(128,128,128,0.2)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
        <strong>AI Interview Coach (Transcript only — webcam video is never sent)</strong>
        {connected ? (
          <button
            type="button"
            className="career-secondary-button"
            disabled={busy || !answer.text.trim()}
            onClick={() => void runAnalysis()}
          >
            <Sparkles size={14} /> {busy ? "Analyzing transcript…" : `Analyze transcript with ${state.taskModels.interview_analysis || state.model}`}
          </button>
        ) : (
          <span className="career-muted">
            AI disconnected · <Link to="/settings">Connect in Settings → AI Connections</Link>
          </span>
        )}
      </div>
      {error ? <p className="rs-notice" role="alert">{error}</p> : null}
      {feedback ? (
        <div className="iv-ai-feedback" style={{ marginTop: 8 }}>
          <p><strong>Overall:</strong> {feedback.overallSummary}</p>
          <ul>
            <li><strong>Situation:</strong> {feedback.starEvaluation.situation}</li>
            <li><strong>Task:</strong> {feedback.starEvaluation.task}</li>
            <li><strong>Action:</strong> {feedback.starEvaluation.action}</li>
            <li><strong>Result:</strong> {feedback.starEvaluation.result}</li>
            <li><strong>Technical accuracy:</strong> {feedback.technicalAccuracy}</li>
            <li><strong>Job alignment:</strong> {feedback.jobAlignment}</li>
          </ul>
        </div>
      ) : null}
    </div>
  );
}

export default function SessionReport({ session, onChange, onDelete, onBack }: Props) {
  const { config } = session;
  const jobTerms = useMemo(() => (config.jobDescription.trim() ? extractRequirements(config.jobDescription).requirements.filter((item) => item.kind === "required" || item.kind === "preferred").filter((item) => !["Education", "Experience", "Responsibilities"].includes(item.category)).map((item) => item.term) : []), [config.jobDescription]);
  const updateAnswer = (id: string, change: Partial<Answer>) => onChange({ ...session, answers: session.answers.map((answer) => (answer.id === id ? { ...answer, ...change } : answer)) });

  const reviewed = session.answers.map((answer) => {
    const expectsStar = ["behavioral", "leadership", "scenario", "job"].includes(config.type);
    const keywords = answer.question.toLowerCase().replace(/[^a-z ]/g, " ").split(/\s+/).filter((word) => word.length > 4);
    const content = contentFeedback(answer, { expectsStar, keywords, type: config.type }, jobTerms);
    const metrics = speechMetrics(answer.text, answer.durationSec, answer.audio, config.speech);
    return { answer, content, metrics, speech: speechFeedback(metrics, config.speech, answer.transcriptSource) };
  });

  const practice = [
    ...reviewed.filter((item) => item.content.filter((feedback) => feedback.kind === "improvement").length >= 2).map((item) => `Revisit “${item.answer.question}” and work on: ${item.content.filter((feedback) => feedback.kind === "improvement").map((feedback) => feedback.text.split(".")[0].toLowerCase()).slice(0, 2).join("; ")}.`),
    ...(jobTerms.length ? [jobTerms.filter((term) => !session.answers.some((answer) => answer.text.toLowerCase().includes(term.toLowerCase())))].filter((terms) => terms.length).map((terms) => `Prepare an example for job requirements you didn't mention: ${terms.slice(0, 5).join(", ")}.`) : []),
    ...(reviewed.some((item) => item.answer.transcriptSource === "none") ? ["Some voice answers have no transcript. Add one in the transcript box to get content feedback."] : []),
  ];

  const transcriptText = () =>
    [`${TYPE_LABELS[config.type]} interview practice${config.jobTitle ? ` — ${config.jobTitle}` : ""}`, new Date(session.createdAt).toLocaleString(), "", ...session.answers.flatMap((answer, index) => [`Q${index + 1}. ${answer.question}`, answer.segments.length && answer.transcriptSource === "live" ? answer.segments.map((segment) => `[${format(segment.t)}] ${segment.text}`).join("\n") : answer.text || "(no transcript)", answer.notes ? `Notes: ${answer.notes}` : "", ""])].join("\n");

  return (
    <div className="iv-report">
      <div className="iv-report-head">
        <button type="button" className="career-secondary-button" onClick={onBack}>
          <ArrowLeft size={15} /> Back to Interview Studio
        </button>
        <div className="iv-row">
          <button type="button" className="career-secondary-button" onClick={() => download(`interview-transcript-${session.createdAt.slice(0, 10)}.txt`, transcriptText(), "text/plain;charset=utf-8")}>
            <Download size={15} /> Export transcript
          </button>
          <button type="button" className="career-secondary-button" onClick={() => download(`interview-session-${session.createdAt.slice(0, 10)}.json`, JSON.stringify(session, null, 2), "application/json")}>
            <Download size={15} /> Export session data
          </button>
          <button
            type="button"
            className="career-danger-button"
            onClick={async () => {
              if (!window.confirm("Delete this session, its transcripts, and any saved recordings? This cannot be undone.")) return;
              await deleteSessionRecordings(session.id).catch(() => undefined);
              onDelete();
            }}
          >
            <Trash2 size={15} /> Delete session
          </button>
        </div>
      </div>
      <section className="career-panel iv-card">
        <span className="career-overline">Session report</span>
        <h2>{TYPE_LABELS[config.type]} · {MODE_LABELS[config.mode]}{config.jobTitle ? ` · ${config.jobTitle}` : ""}</h2>
        <p className="career-muted">
          {new Date(session.createdAt).toLocaleString()} · {session.answers.length} answer{session.answers.length === 1 ? "" : "s"}. Feedback is rule-based, computed in this browser from your transcript and microphone levels, and every point links to something in your answer. It isn't a hiring prediction.
        </p>
        {practice.length ? (
          <div className="iv-practice">
            <h3>Suggested practice</h3>
            <ul>
              {practice.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      {reviewed.length ? (
        reviewed.map(({ answer, content, metrics, speech }, index) => (
          <article className="career-panel iv-card iv-answer" key={answer.id} aria-labelledby={`answer-${answer.id}`}>
            <h3 id={`answer-${answer.id}`}>
              Q{index + 1}. {answer.question}
            </h3>
            <p className="career-muted">
              {format(answer.durationSec)} · {answer.transcriptSource === "typed" ? "typed answer" : answer.transcriptSource === "live" ? "live transcript" : answer.transcriptSource === "whisper" ? "on-device Whisper transcript" : answer.transcriptSource === "manual" ? "transcript edited by you" : "no transcript"}
            </p>
            {answer.durationSec > 0 && answer.transcriptSource !== "typed" && !answer.text.trim() ? (
              <div className="iv-warning" role="note" style={{ margin: "6px 0 10px", padding: "8px 12px", borderRadius: 6, fontSize: 13, background: "rgba(234,179,8,0.12)", border: "1px solid rgba(234,179,8,0.3)" }}>
                Audio was recorded ({format(answer.durationSec)}), but no spoken words were transcribed. You can replay the recording below, transcribe with Whisper, or type your answer to receive STAR and content feedback.
              </div>
            ) : null}
            <div className="iv-answer-grid">
              <section>
                <h4>Answer review</h4>
                <Feedback items={content} />
              </section>
              <section>
                <h4>Speaking patterns</h4>
                {answer.transcriptSource === "typed" ? null : (
                  <dl className="iv-metrics">
                    <div><dt>Words</dt><dd>{metrics.words}</dd></div>
                    <div><dt>Pace</dt><dd>{metrics.wpm !== null ? `${metrics.wpm} wpm` : "—"}</dd></div>
                    <div><dt>Filler words</dt><dd>{config.speech.trackFillers ? metrics.fillerCount : "off"}</dd></div>
                    <div><dt>Pauses ≥1.5s</dt><dd>{answer.audio ? metrics.pauses : "—"}</dd></div>
                  </dl>
                )}
                <Feedback items={speech} />
                {answer.presentation ? (
                  <>
                    <h4>Camera presentation</h4>
                    <ul className="iv-feedback">
                      {presentationObservations(answer.presentation, answer.durationSec).map((note) => (
                        <li key={note} className="note">
                          <span>{note}</span>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : null}
              </section>
            </div>
            <details className="iv-transcript-review">
              <summary>Transcript</summary>
              <textarea aria-label={`Transcript for question ${index + 1}`} rows={5} value={answer.text} onChange={(event) => updateAnswer(answer.id, { text: event.target.value, transcriptSource: answer.transcriptSource === "typed" ? "typed" : "manual" })} />
              {answer.segments.length ? (
                <ol className="iv-segments">
                  {answer.segments.map((segment) => (
                    <li key={`${segment.t}-${segment.text}`}>
                      <time>{format(segment.t)}</time> {segment.text}
                    </li>
                  ))}
                </ol>
              ) : null}
              {answer.notes ? <p className="iv-notes">Notes: {answer.notes}</p> : null}
              <TranscribeSavedButton
                answer={answer}
                onTranscribed={(text, segments) =>
                  updateAnswer(answer.id, { text, segments, transcriptSource: "whisper" })
                }
              />
              <button type="button" className="career-danger-button" disabled={!answer.text && !answer.segments.length} onClick={() => updateAnswer(answer.id, { text: "", segments: [], transcriptSource: answer.transcriptSource === "typed" ? "typed" : "none" })}>
                <Trash2 size={14} /> Delete transcript
              </button>
            </details>
            {config.mode !== "text" ? (
              <details className="iv-transcript-review">
                <summary>Replay</summary>
                <Replay answer={answer} onDeleted={() => updateAnswer(answer.id, { mediaId: undefined, mediaKind: undefined })} />
              </details>
            ) : null}
            <AIInterviewReview answer={answer} jobTitle={config.jobTitle} />
          </article>
        ))
      ) : (
        <p className="career-muted">No answers were recorded in this session.</p>
      )}
    </div>
  );
}
