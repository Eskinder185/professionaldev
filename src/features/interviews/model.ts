import { getLocal, setLocal } from "../../hooks/useLocal";

export type InterviewType = "behavioral" | "technical" | "hr" | "leadership" | "scenario" | "job";
export type PracticeMode = "text" | "voice" | "camera";
export type Difficulty = "intro" | "standard" | "challenging";
export type Level = "entry" | "mid" | "senior";

export const TYPE_LABELS: Record<InterviewType, string> = {
  behavioral: "Behavioral",
  technical: "Technical",
  hr: "HR screening",
  leadership: "Leadership",
  scenario: "Scenario-based",
  job: "Job-description-specific",
};

export const MODE_LABELS: Record<PracticeMode, string> = { text: "Text interview", voice: "Voice interview", camera: "Camera + voice" };

export type Consents = {
  /** Keep audio/video recordings in this browser after an answer ends. */
  saveRecordings: boolean;
  retentionDays: number;
  /** Allow the browser's speech service (may send audio to the browser vendor). */
  cloudTranscription: boolean;
  /** Run on-device face/head-position estimates while the camera is on. */
  cameraAnalysis: boolean;
};

export type SpeechPreferences = { paceMin: number; paceMax: number; fillers: string[]; trackFillers: boolean };

export type InterviewConfig = {
  jobTitle: string;
  type: InterviewType;
  level: Level;
  difficulty: Difficulty;
  jobDescription: string;
  questionCount: number;
  mode: PracticeMode;
  transcription: "browser" | "off";
  micId: string;
  cameraId: string;
  consents: Consents;
  speech: SpeechPreferences;
};

export type TranscriptSegment = { t: number; text: string };

export type AudioStats = { speakingSec: number; pauses: number[]; measuredSec: number };

export type PresentationSummary = {
  samples: number;
  faceVisiblePct: number;
  facingPct: number;
  lookAways: number;
  largeMovements: number;
  framingShiftPct: number;
  calibrated: boolean;
};

export type Answer = {
  id: string;
  questionId: string;
  question: string;
  text: string;
  segments: TranscriptSegment[];
  transcriptSource: "typed" | "live" | "manual" | "none";
  notes: string;
  durationSec: number;
  startedAt: string;
  audio: AudioStats | null;
  presentation: PresentationSummary | null;
  mediaId?: string;
  mediaKind?: "audio" | "video";
};

export type Session = {
  id: string;
  createdAt: string;
  endedAt?: string;
  config: InterviewConfig;
  answers: Answer[];
};

export const DEFAULT_FILLERS = ["um", "uh", "er", "ah", "you know", "i mean", "sort of", "kind of", "basically"];

export const defaultConfig = (): InterviewConfig => ({
  jobTitle: "",
  type: "behavioral",
  level: "entry",
  difficulty: "standard",
  jobDescription: "",
  questionCount: 3,
  mode: "text",
  transcription: "browser",
  micId: "",
  cameraId: "",
  consents: { saveRecordings: false, retentionDays: 30, cloudTranscription: false, cameraAnalysis: false },
  speech: { paceMin: 110, paceMax: 170, fillers: DEFAULT_FILLERS, trackFillers: true },
});

export const SESSIONS_KEY = "pd:careeros:interview-sessions-v2";
export const CONFIG_KEY = "pd:careeros:interview-config";
const LEGACY_KEY = "pd:careeros:interview-sessions";

export const newId = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `id-${Date.now()}-${Math.random().toString(36).slice(2)}`);

type LegacySession = { id?: string; date?: string; mode?: string; question?: string; notes?: string; durationSeconds?: number };

/** Load v2 sessions; earlier notes-only sessions are shown as text sessions (the old key is left untouched). */
export function loadSessions(): Session[] {
  const stored = getLocal<unknown>(SESSIONS_KEY, null);
  if (Array.isArray(stored)) return stored.filter((item): item is Session => typeof item === "object" && item !== null && Array.isArray((item as Session).answers));
  const legacy = getLocal<unknown>(LEGACY_KEY, []);
  if (!Array.isArray(legacy)) return [];
  return (legacy as LegacySession[]).map((item) => {
    const config = { ...defaultConfig(), type: "behavioral" as InterviewType };
    return {
      id: item.id || newId(),
      createdAt: item.date || new Date().toISOString(),
      endedAt: item.date,
      config,
      answers: [{ id: newId(), questionId: "legacy", question: item.question || "Practice question", text: item.notes || "", segments: [], transcriptSource: "typed", notes: "", durationSec: item.durationSeconds || 0, startedAt: item.date || "", audio: null, presentation: null }],
    };
  });
}

export const saveSessions = (sessions: Session[]) => setLocal(SESSIONS_KEY, sessions);

export function loadConfig(): InterviewConfig {
  const stored = getLocal<Partial<InterviewConfig> | null>(CONFIG_KEY, null);
  const base = defaultConfig();
  if (!stored || typeof stored !== "object") return base;
  return { ...base, ...stored, consents: { ...base.consents, ...(stored.consents || {}) }, speech: { ...base.speech, ...(stored.speech || {}) } };
}
