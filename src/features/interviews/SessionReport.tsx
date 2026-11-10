import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Download, Trash2 } from "lucide-react";
import { extractRequirements } from "../resume/job/extractRequirements";
import { contentFeedback, speechFeedback, speechMetrics, type FeedbackItem } from "./analysis";
import { deleteRecording, deleteSessionRecordings, loadRecording } from "./mediaStore";
import { MODE_LABELS, TYPE_LABELS, type Answer, type Session } from "./model";
import { presentationObservations } from "./presentation";

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
              {format(answer.durationSec)} · {answer.transcriptSource === "typed" ? "typed answer" : answer.transcriptSource === "live" ? "live transcript" : answer.transcriptSource === "manual" ? "transcript edited by you" : "no transcript"}
            </p>
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
          </article>
        ))
      ) : (
        <p className="career-muted">No answers were recorded in this session.</p>
      )}
    </div>
  );
}
