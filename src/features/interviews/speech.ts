/**
 * Live transcription with the browser's SpeechRecognition API.
 *
 * Availability differs by browser. Chrome and Edge implement it, and by default
 * send audio to the browser vendor's speech service; newer versions can run
 * on-device when a language pack is installed (`processLocally`). Firefox does
 * not provide it. We require consent before using it. When unavailable, recording and manual notes still work.
 */

type RecognitionResult = { isFinal: boolean; 0: { transcript: string } };
type RecognitionEvent = { resultIndex: number; results: ArrayLike<RecognitionResult> };
type RecognitionError = { error: string };

interface Recognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  processLocally?: boolean;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: ((event: RecognitionError) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

type RecognitionCtor = new () => Recognition;

export type TranscriptionSupport = { kind: "on-device" | "cloud" | "unsupported"; detail: string };

const ctor = (): RecognitionCtor | null => {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};

export async function detectTranscription(lang = "en-US"): Promise<TranscriptionSupport> {
  const Recognition = ctor();
  if (!Recognition) return { kind: "unsupported", detail: "This browser does not provide speech recognition. Recording and manual notes still work; you can type the transcript after answering." };
  // SpeechRecognition.available() would tell us whether on-device recognition is
  // installed, but calling it crashes the renderer in some Chromium builds, so we
  // don't call it and conservatively treat recognition as cloud-backed (consent required).
  void lang;
  return { kind: "cloud", detail: "This browser's live transcription sends audio to the browser vendor's speech service (for example Google in Chrome). It is used only if you allow it." };
}

export type LiveTranscriber = { stop: () => void };

export function startTranscriber(options: {
  onoffset: () => number;
  local: boolean;
  lang?: string;
  onFinal: (text: string, at: number) => void;
  onInterim: (text: string) => void;
  onError: (message: string, fatal: boolean) => void;
}): LiveTranscriber | null {
  const Recognition = ctor();
  if (!Recognition) return null;
  let stopped = false;
  let restarts = 0;
  const recognition = new Recognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = options.lang ?? "en-US";
  if (options.local) recognition.processLocally = true;
  recognition.onresult = (event) => {
    let interim = "";
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      const text = result[0].transcript.trim();
      if (!text) continue;
      if (result.isFinal) options.onFinal(text, options.onoffset());
      else interim += `${text} `;
    }
    options.onInterim(interim.trim());
  };
  recognition.onerror = (event) => {
    const messages: Record<string, [string, boolean]> = {
      "not-allowed": ["Microphone or speech recognition permission was denied. Recording and notes still work.", true],
      "service-not-allowed": ["The browser's speech service is not available here. You can type the transcript instead.", true],
      network: ["The speech service could not be reached. Live transcription stopped; use Retry or type the transcript.", true],
      "audio-capture": ["No microphone audio was captured for transcription.", true],
      "language-not-supported": ["Live transcription doesn't support this language on this device.", true],
      "no-speech": ["No speech detected yet.", false],
      aborted: ["", false],
    };
    const [message, fatal] = messages[event.error] ?? [`Transcription error: ${event.error}.`, true];
    if (fatal) stopped = true;
    if (message) options.onError(message, fatal);
  };
  recognition.onend = () => {
    // Chrome ends recognition after silence; restart while the answer is still running.
    if (!stopped && restarts < 50) {
      restarts++;
      try {
        recognition.start();
      } catch {
        stopped = true;
      }
    }
  };
  try {
    recognition.start();
  } catch (cause) {
    options.onError(cause instanceof Error ? cause.message : "Live transcription could not start.", true);
    return null;
  }
  return {
    stop: () => {
      stopped = true;
      try {
        recognition.stop();
      } catch {
        // Already stopped.
      }
    },
  };
}
