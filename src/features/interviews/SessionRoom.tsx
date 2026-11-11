import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, CameraOff, ChevronRight, Circle, Crosshair, Eye, EyeOff, Mic, MicOff, Pause, Play, RotateCcw, Square, StopCircle } from "lucide-react";
import { startAudioMeter, type AudioMeter } from "./audioMeter";
import type { FaceTracker } from "./faceTracker";
import { saveRecording } from "./mediaStore";
import { MODE_LABELS, TYPE_LABELS, newId, type Answer, type Session } from "./model";
import { calibrate, summarize, type Baseline, type PoseSample } from "./presentation";
import type { Question } from "./questions";
import { startTranscriber, type LiveTranscriber, type TranscriptionSupport } from "./speech";
import { getSupportedMimeType } from "../../hooks/useMediaRecorder";
import { transcribeAnswerAudio, type TranscriptionProgress } from "./transcription";

type Phase = "idle" | "recording" | "paused" | "transcribing" | "done";
type Permission = "unknown" | "prompt" | "granted" | "denied";

type Props = {
  session: Session;
  questions: Question[];
  transcription: TranscriptionSupport | null;
  onSaveAnswer: (answer: Answer) => void;
  onEnd: () => void;
};

const format = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;

function usePermission(name: "camera" | "microphone") {
  const [state, setState] = useState<Permission>("unknown");
  useEffect(() => {
    let status: PermissionStatus | null = null;
    navigator.permissions
      ?.query({ name: name as PermissionName })
      .then((result) => {
        status = result;
        setState(result.state as Permission);
        result.onchange = () => setState(result.state as Permission);
      })
      .catch(() => setState("unknown"));
    return () => {
      if (status) status.onchange = null;
    };
  }, [name]);
  return [state, setState] as const;
}

const mediaError = (cause: unknown, device: "microphone" | "camera") => {
  const name = cause instanceof DOMException ? cause.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") return `${device === "camera" ? "Camera" : "Microphone"} permission was denied. ${device === "camera" ? "You can continue without the camera." : "You can still practice by typing notes."}`;
  if (name === "NotFoundError" || name === "OverconstrainedError") return `No ${device} was found. Check that it is connected, or choose a different device in setup.`;
  if (name === "NotReadableError") return `The ${device} is in use by another application or could not be started.`;
  return `The ${device} is unavailable in this browser or context.`;
};

export default function SessionRoom({ session, questions, transcription, onSaveAnswer, onEnd }: Props) {
  const { config } = session;
  const voice = config.mode !== "text";
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [typed, setTyped] = useState("");
  const [notes, setNotes] = useState("");
  const [segments, setSegments] = useState<Answer["segments"]>([]);
  const [interim, setInterim] = useState("");
  const [transcript, setTranscript] = useState("");
  const [, setTranscriptSource] = useState<Answer["transcriptSource"]>("none");
  const [sttProgress, setSttProgress] = useState<TranscriptionProgress | null>(null);
  const [audioPreviewUrl, setAudioPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [sttError, setSttError] = useState("");
  const [sttActive, setSttActive] = useState(false);
  const [micOn, setMicOn] = useState(false);
  const [muted, setMuted] = useState(false);
  const [recording, setRecording] = useState(false);
  const [level, setLevel] = useState(0);
  const [cameraOn, setCameraOn] = useState(false);
  const [analysisOn, setAnalysisOn] = useState(config.consents.cameraAnalysis);
  const [tracker, setTrackerState] = useState<"off" | "loading" | "ready" | "error">("off");
  const [faceNow, setFaceNow] = useState<boolean | null>(null);
  const [baseline, setBaseline] = useState<Baseline | null>(null);
  const [calibrating, setCalibrating] = useState(false);
  const [micPermission, setMicPermission] = usePermission("microphone");
  const [cameraPermission, setCameraPermission] = usePermission("camera");

  const question = questions[index];
  const micStream = useRef<MediaStream | null>(null);
  const camStream = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<BlobPart[]>([]);
  const lastBlobRef = useRef<Blob | null>(null);
  const currentAnswerId = useRef<string>(newId());
  const meter = useRef<AudioMeter | null>(null);
  const transcriber = useRef<LiveTranscriber | null>(null);
  const trackerRef = useRef<FaceTracker | null>(null);
  const samples = useRef<PoseSample[]>([]);
  const calibrationSamples = useRef<PoseSample[] | null>(null);
  const timing = useRef({ startedAt: 0, pausedTotal: 0, pausedAt: 0 });
  const phaseRef = useRef<Phase>("idle");
  phaseRef.current = phase;
  const segmentsRef = useRef<Answer["segments"]>([]);
  const mounted = useRef(true);

  const answerSeconds = useCallback(() => {
    const { startedAt, pausedTotal, pausedAt } = timing.current;
    if (!startedAt) return 0;
    const now = phaseRef.current === "paused" ? pausedAt : performance.now();
    return Math.max(0, (now - startedAt - pausedTotal) / 1000);
  }, []);

  // Timer and level meter display.
  useEffect(() => {
    if (phase !== "recording") return;
    const timer = window.setInterval(() => {
      setElapsed(answerSeconds());
      setLevel(meter.current?.level() ?? 0);
    }, 200);
    return () => window.clearInterval(timer);
  }, [phase, answerSeconds]);

  const stopMic = () => {
    micStream.current?.getTracks().forEach((track) => track.stop());
    micStream.current = null;
    setMicOn(false);
    setMuted(false);
  };
  const stopCamera = () => {
    camStream.current?.getTracks().forEach((track) => track.stop());
    camStream.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraOn(false);
    setFaceNow(null);
  };

  // Release every device when leaving the session.
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      transcriber.current?.stop();
      meter.current?.stop();
      if (recorder.current && recorder.current.state !== "inactive") recorder.current.stop();
      micStream.current?.getTracks().forEach((track) => track.stop());
      camStream.current?.getTracks().forEach((track) => track.stop());
      trackerRef.current?.close();
    };
  }, []);

  // Face tracking loop (only while the camera is on and analysis is enabled).
  useEffect(() => {
    if (!cameraOn || !analysisOn || !config.consents.cameraAnalysis) return;
    let cancelled = false;
    let timer = 0;
    const run = async () => {
      try {
        if (!trackerRef.current) {
          setTrackerState("loading");
          const { createFaceTracker } = await import("./faceTracker");
          const created = await createFaceTracker();
          if (cancelled) return created.close();
          trackerRef.current = created;
        }
        setTrackerState("ready");
        timer = window.setInterval(() => {
          const video = videoRef.current;
          if (!video || !trackerRef.current) return;
          const sample = trackerRef.current.sample(video, performance.now());
          setFaceNow(sample.face);
          if (calibrationSamples.current) calibrationSamples.current.push(sample);
          if (phaseRef.current === "recording") samples.current.push(sample);
        }, 120);
      } catch {
        if (!cancelled) setTrackerState("error");
      }
    };
    void run();
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [cameraOn, analysisOn, config.consents.cameraAnalysis]);

  const toggleCamera = async () => {
    if (cameraOn) return stopCamera();
    setError("");
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new DOMException("Unsupported", "NotSupportedError");
      const stream = await navigator.mediaDevices.getUserMedia({ video: { ...(config.cameraId ? { deviceId: { exact: config.cameraId } } : {}), width: { ideal: 960 }, height: { ideal: 540 } }, audio: false });
      if (!mounted.current) return stream.getTracks().forEach((track) => track.stop());
      camStream.current = stream;
      setCameraPermission("granted");
      setCameraOn(true);
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play().catch(() => undefined);
        }
      });
      stream.getVideoTracks()[0]?.addEventListener("ended", () => {
        if (mounted.current) {
          setError("The camera stopped. You can continue without it.");
          stopCamera();
        }
      });
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === "NotAllowedError") setCameraPermission("denied");
      setError(mediaError(cause, "camera"));
    }
  };

  const startLiveTranscription = () => {
    setSttError("");
    if (config.transcription !== "browser" || !transcription || transcription.kind === "unsupported") return;
    if (transcription.kind === "cloud" && !config.consents.cloudTranscription) return;
    transcriber.current = startTranscriber({
      local: transcription.kind === "on-device",
      onoffset: answerSeconds,
      onFinal: (text, at) => {
        segmentsRef.current = [...segmentsRef.current, { t: Math.round(at * 10) / 10, text }];
        setSegments(segmentsRef.current);
      },
      onInterim: setInterim,
      onError: (message, fatal) => {
        setSttError(message);
        if (fatal) setSttActive(false);
      },
    });
    setSttActive(Boolean(transcriber.current));
  };

  const startAnswer = async () => {
    currentAnswerId.current = newId();
    if (audioPreviewUrl) {
      URL.revokeObjectURL(audioPreviewUrl);
      setAudioPreviewUrl(null);
    }
    lastBlobRef.current = null;
    setError("");
    setSttError("");
    setSttProgress(null);
    segmentsRef.current = [];
    setSegments([]);
    setInterim("");
    setTranscript("");
    samples.current = [];
    chunks.current = [];
    if (voice) {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new DOMException("Unsupported", "NotSupportedError");
        const stream = await navigator.mediaDevices.getUserMedia({ audio: config.micId ? { deviceId: { exact: config.micId } } : true });
        if (!mounted.current) return stream.getTracks().forEach((track) => track.stop());
        micStream.current = stream;
        setMicOn(true);
        setMicPermission("granted");
        meter.current = startAudioMeter(stream, () => phaseRef.current === "paused" || stream.getAudioTracks().every((track) => !track.enabled));
        stream.getAudioTracks()[0]?.addEventListener("ended", () => {
          if (mounted.current && phaseRef.current === "recording") setError("Microphone access ended. Your answer so far was kept; stop the answer to save it.");
        });

        // Always capture in-memory audio so that speech-to-text and playback work reliably
        if (typeof MediaRecorder !== "undefined") {
          const isVideo = config.mode === "camera" && Boolean(camStream.current);
          const tracks = [...stream.getAudioTracks(), ...(isVideo ? camStream.current!.getVideoTracks() : [])];
          const supported = getSupportedMimeType(isVideo);
          const instance = new MediaRecorder(new MediaStream(tracks), supported ? { mimeType: supported } : undefined);
          instance.ondataavailable = (event) => {
            if (event.data && event.data.size > 0) chunks.current.push(event.data);
          };
          instance.onerror = () => mounted.current && setError("Recording was interrupted. Your notes and transcript are still here.");
          instance.start(250);
          recorder.current = instance;
          setRecording(true);
        }
      } catch (cause) {
        if (cause instanceof DOMException && cause.name === "NotAllowedError") setMicPermission("denied");
        setError(mediaError(cause, "microphone"));
      }
    }
    timing.current = { startedAt: performance.now(), pausedTotal: 0, pausedAt: 0 };
    setElapsed(0);
    setPhase("recording");
    phaseRef.current = "recording";
    if (micStream.current) startLiveTranscription();
  };

  const pause = () => {
    timing.current.pausedAt = performance.now();
    setPhase("paused");
    if (recorder.current?.state === "recording") recorder.current.pause();
    transcriber.current?.stop();
    transcriber.current = null;
    setSttActive(false);
  };
  const resume = () => {
    timing.current.pausedTotal += performance.now() - timing.current.pausedAt;
    setPhase("recording");
    phaseRef.current = "recording";
    if (recorder.current?.state === "paused") recorder.current.resume();
    if (micStream.current) startLiveTranscription();
  };

  const stopAnswer = async () => {
    if (phaseRef.current === "paused") timing.current.pausedTotal += performance.now() - timing.current.pausedAt;
    const durationSec = Math.round(answerSeconds() * 10) / 10;
    timing.current.startedAt = 0;
    transcriber.current?.stop();
    transcriber.current = null;
    setSttActive(false);
    const audio = meter.current?.stop() ?? null;
    meter.current = null;

    let mediaId: string | undefined;
    let mediaKind: Answer["mediaKind"];
    let recordedBlob: Blob | null = null;

    if (recorder.current && recorder.current.state !== "inactive") {
      const active = recorder.current;
      await new Promise<void>((resolve) => {
        active.onstop = () => resolve();
        active.stop();
      });
      if (chunks.current.length) {
        const resolvedType = active.mimeType || "audio/webm";
        recordedBlob = new Blob(chunks.current, { type: resolvedType });
        lastBlobRef.current = recordedBlob;
        const previewUrl = URL.createObjectURL(recordedBlob);
        setAudioPreviewUrl(previewUrl);

        mediaId = newId();
        mediaKind = active.stream.getVideoTracks().length ? "video" : "audio";
        if (config.consents.saveRecordings) {
          try {
            await saveRecording(mediaId, session.id, recordedBlob, config.consents.retentionDays);
          } catch {
            mediaId = undefined;
            setError("The recording could not be saved to browser storage. Your transcript and notes were kept.");
          }
        }
      }
    }
    recorder.current = null;
    setRecording(false);
    stopMic();

    let finalText = voice ? segmentsRef.current.map((segment) => segment.text).join(" ") : typed.trim();
    let source: Answer["transcriptSource"] = !voice ? "typed" : finalText ? "live" : "none";

    // If voice mode is active and we didn't get live transcript (or config is whisper), transcribe the recorded audio!
    if (voice && recordedBlob && (!finalText || config.transcription !== "browser") && config.transcription !== "off") {
      setPhase("transcribing");
      phaseRef.current = "transcribing";
      try {
        const engine = config.transcription === "whisper-local" ? "whisper-local" : "whisper-browser";
        const result = await transcribeAnswerAudio(recordedBlob, engine, {
          onProgress: (p) => setSttProgress(p),
        });
        if (result.text) {
          finalText = result.text;
          segmentsRef.current = result.segments;
          setSegments(result.segments);
          source = "whisper";
        } else if (durationSec > 1) {
          setSttError("No clear speech was recognized in your recording. Check your microphone or speak clearly.");
        }
      } catch (sttErr: any) {
        setSttError(sttErr?.message || "Transcription could not be completed on this recording. You can type or edit your transcript.");
      }
    }

    setTranscript(finalText);
    setTranscriptSource(source);
    setInterim("");
    setPhase("done");
    phaseRef.current = "done";

    const presentation = samples.current.length ? summarize(samples.current, baseline) : null;
    onSaveAnswer({
      id: currentAnswerId.current,
      questionId: question.id,
      question: question.text,
      text: finalText,
      segments: segmentsRef.current,
      transcriptSource: source,
      notes,
      durationSec,
      startedAt: new Date().toISOString(),
      audio,
      presentation,
      mediaId,
      mediaKind,
    });
  };

  const saveTranscriptEdit = () => {
    setTranscriptSource("manual");
    onSaveAnswer({
      id: currentAnswerId.current,
      questionId: question.id,
      question: question.text,
      text: transcript.trim(),
      segments: segmentsRef.current,
      transcriptSource: "manual",
      notes,
      durationSec: Math.round(answerSeconds() * 10) / 10 || 1,
      startedAt: new Date().toISOString(),
      audio: null,
      presentation: null,
    });
  };

  const retryTranscription = async () => {
    if (!lastBlobRef.current) return;
    setPhase("transcribing");
    phaseRef.current = "transcribing";
    setSttError("");
    try {
      const engine = config.transcription === "whisper-local" ? "whisper-local" : "whisper-browser";
      const result = await transcribeAnswerAudio(lastBlobRef.current, engine, {
        onProgress: (p) => setSttProgress(p),
      });
      if (result.text) {
        setTranscript(result.text);
        setSegments(result.segments);
        segmentsRef.current = result.segments;
        setTranscriptSource("whisper");
        onSaveAnswer({
          id: currentAnswerId.current,
          questionId: question.id,
          question: question.text,
          text: result.text,
          segments: result.segments,
          transcriptSource: "whisper",
          notes,
          durationSec: Math.round(result.durationSec * 10) / 10,
          startedAt: new Date().toISOString(),
          audio: null,
          presentation: null,
        });
      } else {
        setSttError("No speech detected in recorded audio.");
      }
    } catch (err: any) {
      setSttError(err?.message || "Retry transcription failed.");
    } finally {
      setPhase("done");
      phaseRef.current = "done";
    }
  };

  const next = () => {
    if (audioPreviewUrl) {
      URL.revokeObjectURL(audioPreviewUrl);
      setAudioPreviewUrl(null);
    }
    lastBlobRef.current = null;
    setIndex(index + 1);
    setPhase("idle");
    setTyped("");
    setNotes("");
    setTranscript("");
    setTranscriptSource("none");
    setSegments([]);
    segmentsRef.current = [];
    setElapsed(0);
    setError("");
    setSttError("");
    setSttProgress(null);
  };

  const runCalibration = () => {
    calibrationSamples.current = [];
    setCalibrating(true);
    window.setTimeout(() => {
      const result = calibrate(calibrationSamples.current ?? []);
      calibrationSamples.current = null;
      setCalibrating(false);
      if (result) setBaseline(result);
      else setError("Calibration needs your face in view. Look at the camera and try again.");
    }, 1800);
  };

  const live = phase === "recording" || phase === "paused";
  const transcriptionNote =
    !voice ? null : config.transcription === "off" ? "Transcription is off. Type the transcript after your answer." : !transcription ? "Checking transcription…" : transcription.kind === "unsupported" ? "Live transcription isn't available in this browser. Type the transcript after your answer." : transcription.kind === "cloud" && !config.consents.cloudTranscription ? "Live transcription is off because you didn't allow the browser's speech service." : transcription.kind === "on-device" ? "Live transcription runs on this device." : "Live transcription uses the browser's speech service, as you allowed.";

  return (
    <div className="iv-room">
      <div className="iv-room-head">
        <div>
          <span className="career-overline">{TYPE_LABELS[config.type]} · {MODE_LABELS[config.mode]}</span>
          <h2>Question {index + 1} of {questions.length}</h2>
        </div>
        <div className="iv-indicators" aria-live="polite">
          {voice ? <span className={`iv-chip ${micOn && !muted ? "on" : ""}`}>{micOn ? (muted ? "Mic muted" : "Mic on") : "Mic off"} · permission {micPermission === "unknown" ? "not checked" : micPermission}</span> : null}
          {config.mode === "camera" ? <span className={`iv-chip ${cameraOn ? "on" : ""}`}>{cameraOn ? "Camera on" : "Camera off"} · permission {cameraPermission === "unknown" ? "not checked" : cameraPermission}</span> : null}
          {recording && config.consents.saveRecordings ? (
            <span className="iv-chip iv-rec" role="status">
              <Circle size={10} fill="currentColor" aria-hidden="true" /> Recording · saved on this device
            </span>
          ) : null}
          {live ? <span className="iv-chip">{phase === "paused" ? "Paused" : "Answering"} {format(elapsed)}</span> : null}
        </div>
      </div>

      <div className="iv-room-grid">
        <section className="iv-stage" aria-label={config.mode === "camera" ? "Camera preview" : "Answer area"}>
          {config.mode === "camera" ? (
            <div className="iv-video">
              <video ref={videoRef} muted playsInline aria-label="Your camera preview" className={cameraOn ? "" : "hidden"} />
              {!cameraOn ? (
                <div className="iv-video-off">
                  <CameraOff size={34} aria-hidden="true" />
                  <p>Camera is off. Turn it on when you're ready; it's optional.</p>
                </div>
              ) : null}
              {cameraOn && analysisOn && config.consents.cameraAnalysis ? (
                <div className="iv-face-status" aria-live="polite">
                  {tracker === "loading" ? "Loading on-device face tracking…" : tracker === "error" ? "Face tracking couldn't start on this device. The camera still works." : faceNow === null ? "Waiting for camera frames…" : faceNow ? "Face detected" : "Face not detected: check lighting and framing"}
                  {baseline ? " · calibrated" : ""}
                </div>
              ) : null}
            </div>
          ) : voice ? (
            <div className="iv-voice">
              <Mic size={40} aria-hidden="true" />
              <div className="iv-meter" role="meter" aria-label="Microphone input level" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(Math.min(1, level * 8) * 100)}>
                <span style={{ width: `${Math.min(100, level * 800)}%` }} />
              </div>
              <p>{micOn ? "Listening. Speak naturally." : "The microphone turns on when you press Start answer."}</p>
            </div>
          ) : (
            <div className="rs-field iv-typed">
              <label htmlFor="iv-typed">Your answer</label>
              <textarea id="iv-typed" rows={10} value={typed} disabled={phase === "done"} onChange={(event) => setTyped(event.target.value)} placeholder="Type your answer as you would say it." />
            </div>
          )}
        </section>

        <aside className="career-panel iv-side" aria-label="Question and transcript">
          <div className="iv-question">
            <span className="career-overline">Current question</span>
            <p>{question.text}</p>
            {question.expectsStar ? <small>Tip: Situation, Task, Action, Result.</small> : null}
          </div>
          {voice ? (
            <div className="iv-transcript">
              <h3>{phase === "done" ? "Transcript (editable)" : phase === "transcribing" ? "Transcribing speech…" : "Live transcript"}</h3>
              {phase === "transcribing" && (
                <div className="iv-transcribing-card" role="status" aria-live="polite" style={{ padding: "12px 14px", borderRadius: 8, background: "rgba(37,99,235,0.08)", border: "1px solid rgba(37,99,235,0.2)", margin: "8px 0" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 600, color: "#2563eb" }}>
                    <span className="inline-block w-3 h-3 rounded-full bg-blue-600 animate-ping" />
                    <span>Processing spoken answer…</span>
                  </div>
                  <p style={{ margin: "4px 0 0", fontSize: 12, color: "inherit" }}>
                    {sttProgress?.message || "Running on-device Whisper speech-to-text…"}
                  </p>
                </div>
              )}
              {transcriptionNote && phase !== "transcribing" ? <p className="career-muted">{transcriptionNote}</p> : null}
              {phase === "done" ? (
                <>
                  {audioPreviewUrl && (
                    <div className="iv-playback-box" style={{ margin: "10px 0 12px", padding: 10, borderRadius: 8, background: "var(--career-soft)" }}>
                      <span className="career-overline" style={{ display: "block", marginBottom: 4 }}>Review recorded answer</span>
                      <audio controls src={audioPreviewUrl} style={{ width: "100%", height: 36 }} />
                    </div>
                  )}
                  <textarea aria-label="Transcript (editable)" rows={6} value={transcript} onChange={(event) => setTranscript(event.target.value)} placeholder="Type or paste what you said." />
                  <div className="iv-row" style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <button type="button" className="career-secondary-button" onClick={saveTranscriptEdit}>Save transcript</button>
                    {lastBlobRef.current && (
                      <button type="button" className="career-secondary-button" onClick={() => void retryTranscription()}>
                        <RotateCcw size={14} /> Retry transcription
                      </button>
                    )}
                    <button type="button" className="career-secondary-button" disabled={!transcript} onClick={() => void navigator.clipboard?.writeText(transcript).catch(() => undefined)}>Copy</button>
                  </div>
                </>
              ) : phase !== "transcribing" ? (
                <div className="iv-live" aria-live="polite">
                  {segments.map((segment) => (
                    <p key={`${segment.t}-${segment.text}`}>
                      <time>{format(segment.t)}</time> {segment.text}
                    </p>
                  ))}
                  {interim ? <p className="iv-interim">{interim}</p> : null}
                  {!segments.length && !interim ? <p className="career-muted">{live ? (sttActive ? "Listening for speech…" : "Not transcribing.") : "Your words will appear here."}</p> : null}
                </div>
              ) : null}
              {sttError ? (
                <p className="iv-warning" role="alert" style={{ marginTop: 8 }}>
                  {sttError}{" "}
                  {live && !sttActive ? (
                    <button type="button" className="rs-link-button" onClick={startLiveTranscription}>Retry live transcription</button>
                  ) : lastBlobRef.current && phase === "done" ? (
                    <button type="button" className="rs-link-button" onClick={() => void retryTranscription()}>Retry speech model</button>
                  ) : null}
                </p>
              ) : null}
            </div>
          ) : null}
          <div className="rs-field">
            <label htmlFor="iv-notes">Notes</label>
            <textarea id="iv-notes" rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Key points, or reminders for next time." />
          </div>
          {error ? <p className="career-form-error" role="alert">{error}</p> : null}
        </aside>
      </div>

      <div className="iv-controls" role="toolbar" aria-label="Session controls">
        {config.mode === "camera" ? (
          <button type="button" className={`iv-control ${cameraOn ? "on" : ""}`} aria-pressed={cameraOn} onClick={() => void toggleCamera()}>
            {cameraOn ? <Camera size={18} /> : <CameraOff size={18} />} {cameraOn ? "Turn camera off" : "Turn camera on"}
          </button>
        ) : null}
        {config.mode === "camera" && config.consents.cameraAnalysis ? (
          <>
            <button type="button" className={`iv-control ${analysisOn ? "on" : ""}`} aria-pressed={analysisOn} onClick={() => setAnalysisOn(!analysisOn)}>
              {analysisOn ? <Eye size={18} /> : <EyeOff size={18} />} {analysisOn ? "Presentation feedback on" : "Presentation feedback off"}
            </button>
            <button type="button" className="iv-control" disabled={!cameraOn || tracker !== "ready" || calibrating || !analysisOn} onClick={runCalibration}>
              <Crosshair size={18} /> {calibrating ? "Look at the camera…" : "Calibrate"}
            </button>
          </>
        ) : null}
        {voice ? (
          <button
            type="button"
            className={`iv-control ${muted ? "" : micOn ? "on" : ""}`}
            aria-pressed={muted}
            disabled={!micOn}
            onClick={() => {
              const next = !muted;
              micStream.current?.getAudioTracks().forEach((track) => (track.enabled = !next));
              setMuted(next);
            }}
          >
            {muted ? <MicOff size={18} /> : <Mic size={18} />} {muted ? "Unmute" : "Mute"}
          </button>
        ) : null}
        <span className="iv-controls-spacer" />
        {phase === "idle" ? (
          <button type="button" className="career-quick-create iv-primary" onClick={() => void startAnswer()}>
            <Play size={16} /> Start answer
          </button>
        ) : null}
        {phase === "recording" ? (
          <button type="button" className="iv-control" onClick={pause}>
            <Pause size={18} /> Pause
          </button>
        ) : null}
        {phase === "paused" ? (
          <button type="button" className="iv-control" onClick={resume}>
            <Play size={18} /> Resume
          </button>
        ) : null}
        {live ? (
          <button type="button" className="career-quick-create iv-primary iv-stop" onClick={() => void stopAnswer()}>
            <Square size={15} /> Stop answer
          </button>
        ) : null}
        {phase === "done" && index < questions.length - 1 ? (
          <button type="button" className="career-quick-create iv-primary" onClick={next}>
            Next question <ChevronRight size={16} />
          </button>
        ) : null}
        {phase === "transcribing" ? (
          <button type="button" className="iv-control" disabled>
            Transcribing…
          </button>
        ) : null}
        <button type="button" className="career-danger-button" disabled={live || phase === "transcribing"} onClick={onEnd}>
          <StopCircle size={16} /> End session
        </button>
      </div>
    </div>
  );
}
