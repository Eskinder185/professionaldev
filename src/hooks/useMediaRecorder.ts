import { useCallback, useEffect, useRef, useState } from "react";

type RecordingStatus = "idle" | "recording" | "stopped";

export function useMediaRecorder(constraints: MediaStreamConstraints = { audio: true, video: true }) {
  const [status, setStatus] = useState<RecordingStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string>("video/webm");
  const [elapsedMs, setElapsedMs] = useState<number>(0);

  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const startAtRef = useRef<number>(0);
  const timerRef = useRef<number | null>(null);

  useEffect(() => () => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    if (recRef.current && recRef.current.state !== "inactive") recRef.current.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
  }, []);

  const start = useCallback(async () => {
    try {
      setBlob(null); setUrl(null); setElapsedMs(0);
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      const preferred = [
        "video/webm;codecs=vp9,opus",
        "video/webm;codecs=vp8,opus",
        "video/webm",
      ];
      const supported = preferred.find((t) => MediaRecorder.isTypeSupported(t));
      if (supported) setMimeType(supported);
      const rec = new MediaRecorder(stream, supported ? { mimeType: supported } : undefined);
      chunksRef.current = [];
      rec.ondataavailable = (e) => { if (e.data?.size) chunksRef.current.push(e.data); };
      rec.onerror = (e: any) => setError(e?.error?.message || "Recorder error");
      rec.onstart = () => {
        setStatus("recording");
        startAtRef.current = Date.now();
        timerRef.current && window.clearInterval(timerRef.current);
        timerRef.current = window.setInterval(() => setElapsedMs(Date.now() - startAtRef.current), 250);
      };
      rec.onstop = () => {
        setStatus("stopped");
        timerRef.current && window.clearInterval(timerRef.current);
        const b = new Blob(chunksRef.current, { type: mimeType });
        setBlob(b);
        const u = URL.createObjectURL(b);
        setUrl(u);
      };
      recRef.current = rec;
      rec.start(250);
    } catch (e: any) {
      setError(e?.message || "Failed to access camera/mic");
      setStatus("idle");
    }
  }, [constraints, mimeType]);

  const stop = useCallback(async () => {
    const rec = recRef.current;
    if (!rec) return;
    rec.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  return { start, stop, status, blob, url, error, elapsedMs, mimeType } as const;
}

