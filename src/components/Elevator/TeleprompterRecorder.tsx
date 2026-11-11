import React, { useEffect, useRef, useState } from "react";
import { Copy, Download } from "lucide-react";
import EmptyState from "../ui/EmptyState";
import { formatMediaError, getSupportedMimeType } from "../../hooks/useMediaRecorder";

type Props = {
  script: string;
  /** When false, teleprompter shows a placeholder and recording is discouraged */
  scriptReady: boolean;
};

export default function TeleprompterRecorder({ script, scriptReady }: Props) {
  const [speed, setSpeed] = useState(28);
  const [font, setFont] = useState(26);
  const [mirror, setMirror] = useState(false);
  const [recording, setRecording] = useState(false);
  const [starting, setStarting] = useState(false);
  const [mediaURL, setMediaURL] = useState<string | undefined>();
  const [recordErr, setRecordErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const mediaRef = useRef<HTMLVideoElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);

  useEffect(() => {
    if (!scriptReady) return;
    const el = scrollerRef.current;
    if (!el) return;
    let y = 0;
    let raf = 0;
    const step = () => {
      y += speed / 60;
      el.scrollTop = y;
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [speed, script, scriptReady]);

  async function startRecording() {
    if (!scriptReady) return;
    setRecordErr(null);
    setStarting(true);
    let stream: MediaStream | null = null;
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new DOMException("Media devices not supported in this environment", "NotSupportedError");
      }
      // Attempt camera + audio; fall back gracefully to audio-only if camera is unavailable or denied
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      } catch {
        // If camera fails, attempt audio-only recording
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      }
      const isVideo = stream.getVideoTracks().length > 0;
      if (mediaRef.current && isVideo) {
        mediaRef.current.srcObject = stream;
      }
      const supported = getSupportedMimeType(isVideo);
      const rec = new MediaRecorder(stream, supported ? { mimeType: supported } : undefined);
      const chunks: BlobPart[] = [];
      rec.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };
      rec.onerror = (e: any) => {
        setRecordErr(e?.error?.message || "Recorder encountered an error.");
      };
      rec.onstop = () => {
        const type = rec.mimeType || supported || (isVideo ? "video/webm" : "audio/webm");
        const blob = new Blob(chunks, { type });
        setMediaURL(URL.createObjectURL(blob));
        stream?.getTracks().forEach((t) => t.stop());
      };
      recorderRef.current = rec;
      rec.start();
      setRecording(true);
    } catch (e) {
      if (stream) stream.getTracks().forEach((t) => t.stop());
      setRecordErr(formatMediaError(e, true));
    } finally {
      setStarting(false);
    }
  }

  function stopRecording() {
    recorderRef.current?.stop();
    setRecording(false);
  }

  async function copyScript() {
    try {
      await navigator.clipboard.writeText(script);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
      <div className="space-y-4 border-t border-black/[0.07] py-8 dark:border-white/[0.09] sm:py-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="min-w-0 flex-1 space-y-1">
            <label htmlFor="tp-speed" className="text-sm font-medium text-ink dark:text-white">
              Scroll speed
            </label>
            <input
              id="tp-speed"
              type="range"
              min={10}
              max={60}
              value={speed}
              className="w-full accent-[rgb(var(--tw-accent))]"
              disabled={!scriptReady}
              onChange={(e) => setSpeed(+e.target.value)}
            />
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <label htmlFor="tp-font" className="text-sm font-medium text-ink dark:text-white">
              Font size
            </label>
            <input
              id="tp-font"
              type="range"
              min={18}
              max={40}
              value={font}
              className="w-full accent-[rgb(var(--tw-accent))]"
              disabled={!scriptReady}
              onChange={(e) => setFont(+e.target.value)}
            />
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-ink dark:text-white">
            <input
              type="checkbox"
              checked={mirror}
              disabled={!scriptReady}
              onChange={(e) => setMirror(e.target.checked)}
              className="rounded border-black/20 dark:border-white/20"
            />
            Mirror text
          </label>
        </div>

        <div
          className="h-[320px] overflow-y-auto border-y border-black/[0.07] bg-canvas-subtle/30 py-6 dark:border-white/10 dark:bg-white/[0.02]"
          ref={scrollerRef}
          style={{ direction: mirror ? "rtl" : "ltr" }}
          aria-label="Teleprompter text"
        >
          {!scriptReady ? (
            <EmptyState
              className="min-h-[240px] border-0 bg-transparent py-12 dark:bg-transparent"
              title="Complete the form above"
              hint="Once your pitch is generated, it will scroll here automatically."
            />
          ) : (
            <div
              className="leading-[1.6] tracking-wide text-ink dark:text-white"
              style={{ fontSize: font, transform: mirror ? "scaleX(-1)" : "none" }}
            >
              {script.split(" ").map((w, i) => (
                <span key={i} className="mx-[4px]">
                  {w}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn btn-primary min-h-10 gap-2 px-4"
            onClick={copyScript}
            disabled={!scriptReady}
          >
            <Copy className="h-4 w-4 shrink-0" aria-hidden />
            {copied ? "Copied" : "Copy script"}
          </button>
          {!recording ? (
            <button
              type="button"
              className="btn surface-muted min-h-10 px-4"
              onClick={startRecording}
              disabled={!scriptReady || starting}
            >
              {starting ? "Starting…" : "Start recording"}
            </button>
          ) : (
            <button type="button" className="btn surface-muted min-h-10 px-4" onClick={stopRecording}>
              Stop &amp; save clip
            </button>
          )}
          {mediaURL ? (
            <a className="btn surface-muted flex min-h-10 items-center gap-2 px-4" href={mediaURL} download="elevator-practice.webm">
              <Download className="h-4 w-4 shrink-0" aria-hidden />
              Download
            </a>
          ) : null}
        </div>
        {copied ? (
          <p className="text-sm font-medium text-accent" role="status">
            Script copied to clipboard
          </p>
        ) : null}
        {recordErr ? (
          <p className="text-sm text-red-600 dark:text-red-400" role="alert">
            {recordErr}
          </p>
        ) : null}
        <p className="text-caption text-ink-muted">Tip: Aim for 30–45 seconds. Repeat until it feels conversational, not memorized.</p>
      </div>

      <div className="space-y-3 border-t border-black/[0.07] py-8 dark:border-white/[0.09] sm:py-10 lg:border-l lg:border-t-0 lg:pl-8 lg:py-0">
        <h3 className="text-sm font-semibold text-ink dark:text-white">Camera preview</h3>
        <p className="text-sm text-ink-muted">Live preview while recording. Audio and video are processed locally.</p>
        <video ref={mediaRef} className="aspect-video w-full rounded-[var(--card-radius)] bg-black/80 object-cover" autoPlay muted playsInline />
        {!recording && !mediaURL ? (
          <p className="text-caption text-ink-faint">Press Start recording to enable the camera.</p>
        ) : null}
      </div>
    </div>
  );
}
