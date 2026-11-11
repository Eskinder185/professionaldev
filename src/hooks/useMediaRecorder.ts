import { useCallback, useEffect, useRef, useState } from "react";

export type RecordingStatus = "idle" | "requesting" | "recording" | "paused" | "stopped" | "error";

export function getSupportedMimeType(isVideo: boolean): string | undefined {
  if (typeof MediaRecorder === "undefined" || typeof MediaRecorder.isTypeSupported !== "function") {
    return undefined;
  }

  const audioCandidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/aac",
    "audio/ogg;codecs=opus",
  ];

  const videoCandidates = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
    "video/mp4;codecs=avc1,mp4a.40.2",
    "video/mp4",
  ];

  const candidates = isVideo ? videoCandidates : audioCandidates;
  for (const candidate of candidates) {
    try {
      if (MediaRecorder.isTypeSupported(candidate)) {
        return candidate;
      }
    } catch {
      // Ignore environment-specific syntax checks
    }
  }
  return undefined;
}

export function formatMediaError(cause: unknown, isVideo: boolean): string {
  const name = cause instanceof DOMException ? cause.name : (cause as { name?: string })?.name;
  if (name === "NotAllowedError" || name === "PermissionDeniedError" || name === "SecurityError") {
    return `${isVideo ? "Camera or microphone" : "Microphone"} permission was denied. Please allow access in your browser address bar settings.`;
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return `No ${isVideo ? "camera or microphone" : "microphone"} detected. Please connect an input device and try again.`;
  }
  if (name === "NotReadableError" || name === "TrackStartError") {
    return `The ${isVideo ? "camera or microphone" : "microphone"} is in use by another application or could not be initialized.`;
  }
  if (name === "OverconstrainedError") {
    return "The requested device configuration is not supported by your hardware.";
  }
  if (name === "NotSupportedError") {
    return "Media recording is not supported in this browser or environment.";
  }
  return (cause as Error)?.message || `Failed to access ${isVideo ? "camera/mic" : "microphone"}`;
}

export function useMediaRecorder(constraints: MediaStreamConstraints = { audio: true, video: true }) {
  const isVideo = Boolean(constraints.video);
  const [status, setStatus] = useState<RecordingStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string>(isVideo ? "video/webm" : "audio/webm");
  const [elapsedMs, setElapsedMs] = useState<number>(0);

  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const startAtRef = useRef<number>(0);
  const pausedAtRef = useRef<number>(0);
  const pausedTotalRef = useRef<number>(0);
  const timerRef = useRef<number | null>(null);

  useEffect(() => () => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    if (recRef.current && recRef.current.state !== "inactive") {
      try {
        recRef.current.stop();
      } catch {
        // ignore on unmount
      }
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const start = useCallback(async () => {
    try {
      setError(null);
      setBlob(null);
      setUrl(null);
      setElapsedMs(0);
      setStatus("requesting");
      pausedTotalRef.current = 0;

      if (!navigator.mediaDevices?.getUserMedia) {
        throw new DOMException("Media devices not supported in this environment", "NotSupportedError");
      }

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      const supported = getSupportedMimeType(isVideo);
      if (supported) {
        setMimeType(supported);
      }

      const rec = new MediaRecorder(stream, supported ? { mimeType: supported } : undefined);
      chunksRef.current = [];

      rec.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      rec.onerror = (e: any) => {
        const msg = e?.error?.message || "Recording error occurred";
        setError(msg);
        setStatus("error");
      };

      rec.onstart = () => {
        setStatus("recording");
        startAtRef.current = Date.now();
        if (timerRef.current) window.clearInterval(timerRef.current);
        timerRef.current = window.setInterval(() => {
          setElapsedMs(Date.now() - startAtRef.current - pausedTotalRef.current);
        }, 200);
      };

      rec.onpause = () => {
        setStatus("paused");
        pausedAtRef.current = Date.now();
      };

      rec.onresume = () => {
        setStatus("recording");
        pausedTotalRef.current += Date.now() - pausedAtRef.current;
      };

      rec.onstop = () => {
        setStatus("stopped");
        if (timerRef.current) window.clearInterval(timerRef.current);
        const resolvedType = rec.mimeType || supported || (isVideo ? "video/webm" : "audio/webm");
        const b = new Blob(chunksRef.current, { type: resolvedType });
        setBlob(b);
        const u = URL.createObjectURL(b);
        setUrl(u);
      };

      recRef.current = rec;
      rec.start(250);
    } catch (e: any) {
      const formatted = formatMediaError(e, isVideo);
      setError(formatted);
      setStatus("error");
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, [constraints, isVideo]);

  const pause = useCallback(() => {
    if (recRef.current && recRef.current.state === "recording") {
      recRef.current.pause();
    }
  }, []);

  const resume = useCallback(() => {
    if (recRef.current && recRef.current.state === "paused") {
      recRef.current.resume();
    }
  }, []);

  const stop = useCallback(async () => {
    const rec = recRef.current;
    if (rec && rec.state !== "inactive") {
      rec.stop();
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  return {
    start,
    stop,
    pause,
    resume,
    status,
    isRecording: status === "recording",
    isPaused: status === "paused",
    blob,
    url,
    error,
    elapsedMs,
    mimeType,
  } as const;
}
