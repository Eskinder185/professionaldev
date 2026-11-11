export type PlatformId =
  | "greenhouse"
  | "lever"
  | "ashby"
  | "workday"
  | "generic"
  | "unsupported";

export type PlatformSupportLevel = "supported" | "partial" | "unsupported";

export type QueueStatus =
  | "Imported"
  | "Analysis needed"
  | "Ready to prepare"
  | "Needs information"
  | "Ready for autofill"
  | "Autofill in progress"
  | "Ready for review"
  | "Submitted and verified"
  | "Unsupported"
  | "Failed"
  | "Skipped";

export type PageStage =
  | "page_detected"
  | "fields_identified"
  | "autofill_prepared"
  | "fields_filled"
  | "validation_needed"
  | "user_review_required"
  | "continue_permitted"
  | "completion_confirmed";

export type FieldConfidence =
  | "high"
  | "needs_review"
  | "unsupported"
  | "sensitive_manual";

export type FieldReviewStatus =
  | "Ready"
  | "Needs user confirmation"
  | "Missing information"
  | "Unsupported"
  | "Filled and verified";

export type StandardProfileFieldKey =
  | "firstName"
  | "lastName"
  | "fullName"
  | "preferredName"
  | "email"
  | "phone"
  | "city"
  | "state"
  | "location"
  | "country"
  | "linkedin"
  | "github"
  | "website"
  | "headline"
  | "currentEmployer"
  | "currentTitle"
  | "school"
  | "degree"
  | "major"
  | "graduationDate"
  | "skillsSummary"
  | "certificationsSummary"
  | "experienceSummary"
  | "coverLetter"
  | "customQuestion";

export interface ApplicantEducationItem {
  institution: string;
  degree: string;
  field: string;
  location: string;
  startDate: string;
  endDate: string;
}

export interface ApplicantExperienceItem {
  employer: string;
  title: string;
  location: string;
  startDate: string;
  endDate: string;
  current: boolean;
  bullets: string[];
}

export interface SavedQuestionAnswer {
  id: string;
  questionPattern: string;
  questionLabel: string;
  answer: string;
  evidence: string;
  employerSpecific?: string;
  approvedAt: string;
}

export interface ApplicantProfile {
  firstName: string;
  lastName: string;
  preferredName: string;
  email: string;
  phone: string;
  city: string;
  state: string;
  country: string;
  linkedin: string;
  github: string;
  website: string;
  headline: string;
  education: ApplicantEducationItem[];
  experience: ApplicantExperienceItem[];
  skills: string[];
  certifications: string[];
  savedAnswers: SavedQuestionAnswer[];
  updatedAt: string;
}

export interface SharedProfileSubset {
  approvedAt: string;
  sharedFields: StandardProfileFieldKey[];
  values: Partial<Record<StandardProfileFieldKey, string>>;
  education?: ApplicantEducationItem[];
  experience?: ApplicantExperienceItem[];
  skills?: string[];
  certifications?: string[];
  resumeVersionId?: string;
  resumeVersionName?: string;
  resumeFileName?: string;
  resumePlainText?: string;
  preparedAnswers?: Record<string, { question: string; answer: string; evidence: string; approved: boolean }>;
}

export interface DetectedField {
  id: string;
  selector: string;
  nameAttr: string;
  idAttr: string;
  inputType: "text" | "email" | "tel" | "url" | "textarea" | "select" | "custom-select" | "checkbox" | "radio" | "file" | "unknown";
  label: string;
  placeholder: string;
  surroundingText: string;
  required: boolean;
  mappedKey: StandardProfileFieldKey | null;
  confidence: FieldConfidence;
  reviewStatus: FieldReviewStatus;
  preparedValue: string;
  currentDomValue: string;
  sensitiveReason?: string;
  options?: string[];
  evidence?: string;
  verifiedFilled?: boolean;
  validationError?: string;
}

export interface PreparedQuestionDraft {
  id: string;
  question: string;
  category: "motivation" | "troubleshooting" | "linux_systems" | "technical_problem" | "general" | "sensitive_manual";
  draftAnswer: string;
  evidence: string;
  approved: boolean;
  requiresDirectUserInput: boolean;
  sensitiveReason?: string;
  saveForReuse?: boolean;
}

export interface AutoApplyQueueItem {
  id: string;
  url: string;
  normalizedUrl: string;
  company: string;
  title: string;
  location: string;
  source: string;
  platform: PlatformId;
  supportLevel: PlatformSupportLevel;
  status: QueueStatus;
  pageStage: PageStage;
  matchScore: number | null;
  matchedSkills: string[];
  missingSkills: string[];
  missingInfo: string[];
  selectedResumeId: string;
  selectedResumeName: string;
  resumeFitsOnePage: boolean;
  jobDescription: string;
  preparedQuestions: PreparedQuestionDraft[];
  detectedFields: DetectedField[];
  nextAction: string;
  notes: string;
  followUpDate: string;
  trackerApplicationId?: string;
  submittedAt?: string;
  confirmationText?: string;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ExtensionCapabilities {
  extensionVersion: string;
  protocolVersion: "1.0";
  supportedPlatforms: Array<{
    id: PlatformId;
    label: string;
    supportLevel: PlatformSupportLevel;
  }>;
  features: {
    sidePanel: boolean;
    activeTabAutofill: boolean;
    reactControlledInputs: boolean;
    multiPageStateMachine: boolean;
    fileUploadVerification: boolean;
  };
}

export type MessageAction =
  | "HANDSHAKE"
  | "GET_CAPABILITIES"
  | "IMPORT_QUEUE"
  | "TRANSFER_PROFILE"
  | "PREPARE_APPLICATION"
  | "GET_APPLICATION_STATUS"
  | "UPDATE_APPLICATION_STATUS"
  | "CLEAR_SHARED_DATA"
  | "EXECUTE_AUTOFILL"
  | "INSPECT_CURRENT_FORM"
  | "CONFIRM_SUBMISSION"
  | "SYNC_ANALYSIS"
  | "SYNC_AI_CONFIGURATION"
  | "GET_AI_CONFIGURATION"
  | "SET_SELECTED_RESUME"
  | "UPDATE_SHARED_PROFILE"
  | "UPDATE_AUTOFILL_RUN";

export interface AutoApplyMessage<T = unknown> {
  protocol: "careeros-autoapply";
  version: "1.0";
  requestId: string;
  action: MessageAction;
  origin: string;
  timestamp: string;
  payload: T;
}

export interface AutoApplyResponse<T = unknown> {
  protocol: "careeros-autoapply";
  version: "1.0";
  requestId: string;
  ok: boolean;
  action: MessageAction;
  timestamp: string;
  data?: T;
  error?: {
    code:
      | "INVALID_ORIGIN"
      | "INVALID_SCHEMA"
      | "UNSUPPORTED_ACTION"
      | "UNAUTHORIZED"
      | "UNSUPPORTED_PLATFORM"
      | "FORM_NOT_FOUND"
      | "EXECUTION_ERROR";
    message: string;
  };
}

/* ------------------------------------------------------------------ */
/* AutoApply 2.0: analysis, résumé versions, AI status, page context   */
/* ------------------------------------------------------------------ */

export type RequirementMatchStatus = "demonstrated" | "equivalent" | "mentioned" | "missing" | "insufficient";
export type RequirementMatchGroup = "matched" | "strengthen" | "missing" | "review";

export interface RequirementAnalysis {
  id: string;
  name: string;
  kind: "required" | "preferred" | "responsibility" | "context";
  category: string;
  /** Sentence(s) from the job description where the requirement was found. */
  excerpt: string;
  status: RequirementMatchStatus;
  group: RequirementMatchGroup;
  evidence: Array<{ section: string; label: string; text: string }>;
  explanation: string;
  /** False for low-confidence detections that CareerOS leaves out of the score until the user confirms them. */
  scored: boolean;
}

/**
 * Snapshot produced by the CareerOS website's job-matching engine for one
 * (queue item, résumé version) pair. The extension only stores and renders it.
 */
export interface ResumeAnalysisSnapshot {
  applicationId: string;
  resumeVersionId: string;
  resumeVersionName: string;
  analyzedAt: string;
  /** Internal CareerOS estimate, not an employer ATS score. */
  score: number;
  requiredCoverage: { met: number; total: number };
  preferredCoverage: { met: number; total: number };
  counts: Record<RequirementMatchGroup, number>;
  requirements: RequirementAnalysis[];
  quality: {
    pageCount: number;
    fitsOnePage: boolean;
    passed: number;
    total: number;
    percent: number;
    checks: Array<{ id: string; label: string; passed: boolean; detail?: string }>;
  };
}

export interface ResumeVersionSummary {
  id: string;
  name: string;
  kind: "master" | "tailored";
  fitsOnePage: boolean;
  updatedAt: string;
}

/** Non-secret AI connection description pushed by the website or edited in the extension. Never contains keys. */
export interface AIConnectionSnapshot {
  provider: string;
  providerLabel: string;
  baseUrl: string;
  model: string;
  connected: boolean;
  /** True only when the baseUrl host is loopback. A cloud endpoint is never reported as local. */
  isLocal: boolean;
  /** True when no API key is required, so the extension can call it without holding a secret. */
  keyless: boolean;
  /** When enabled, blocks all career data from being sent to non-loopback cloud endpoints. */
  localOnlyMode?: boolean;
  /** Optional per-task model overrides (job_analysis, resume_matching, etc.). */
  taskModels?: Record<string, string>;
  /** Credential security status ("local_keyless" | "companion_proxy" | "session_memory_key" | "setup_required"). */
  credentialMode?: "local_keyless" | "companion_proxy" | "session_memory_key" | "setup_required";
  credentialBadge?: string;
  /** Detected model capability badges (e.g. "Basic Chat", "Structured JSON", "Tool Calling", "Agent Planning"). */
  capabilities?: string[];
  /** Non-secret list of discovered model IDs from the server. */
  discoveredModels?: Array<{ id: string; parameterSize?: string }>;
  updatedAt: string;
}

export interface JobPageInfo {
  title: string;
  company: string;
  location: string;
  /** Only populated when the posting itself lists it (JSON-LD baseSalary or explicit range text). */
  salary: string | null;
  platform: PlatformId;
  platformLabel: string;
  url: string;
  /** Where each value came from, for transparency. */
  sources: Record<string, string>;
  /** Text proving the posting is closed, if the page says so. Never claims "active" without evidence. */
  closedEvidence: string | null;
  description: string;
  /** Only populated when the posting states it (structured data or an explicit label). */
  employmentType?: string;
  workArrangement?: string;
  jobId?: string;
  applicationUrl?: string;
}

/** How sure CareerOS is that a page is a real job posting. */
export type JobConfidence = "high" | "medium" | "low";

/** One requirement found in the posting, with the sentence it came from. */
export interface PageRequirement {
  term: string;
  kind: "required" | "preferred" | "responsibility" | "context";
  category: string;
  /** The sentence in the job description that mentions it. */
  evidence: string;
  /** A low-confidence detection (for example an unfamiliar acronym). Never counted in a match estimate. */
  uncertain: boolean;
}

export interface JobIntelligence {
  confidence: JobConfidence;
  confidenceReasons: string[];
  /** Where the description text came from, for example "JSON-LD JobPosting" or "Greenhouse page". */
  descriptionSource: string;
  descriptionChars: number;
  requirements: PageRequirement[];
  /** Enough real job information to compute a reliable résumé match. */
  sufficientForMatch: boolean;
  insufficiencyReason: string | null;
}

/** An application form embedded from another website, which CareerOS cannot read from this page. */
export interface EmbeddedFrame {
  url: string;
  host: string;
  platformLabel: string;
}

export type CoverLetterState = "required" | "optional" | "none" | "file-only";

export interface CoverLetterField {
  fieldId: string;
  label: string;
  inputType: DetectedField["inputType"];
  required: boolean;
  currentDomValue: string;
}

export interface PageContext {
  supported: boolean;
  url: string;
  hostname: string;
  platform: PlatformId;
  platformLabel: string;
  supportLevel: PlatformSupportLevel;
  job: JobPageInfo | null;
  pageStage: PageStage;
  fields: DetectedField[];
  coverLetter: { state: CoverLetterState; field: CoverLetterField | null };
  needsSignIn: boolean;
  confirmed: boolean;
  /** Validation problems currently shown by the page (invalid values, alert banners). */
  validationIssues: string[];
  detectedAt: string;
  /** What CareerOS understood about the job on this page, when it looks like one. */
  intelligence?: JobIntelligence | null;
  /** Application forms embedded from other sites that this page's script cannot reach. */
  embeddedFrames?: EmbeddedFrame[];
}

export type AutofillRunPhase = "idle" | "inspecting" | "filling" | "verifying" | "done" | "cancelled" | "failed";

export interface AutofillRunResult {
  fieldId: string;
  label: string;
  status: "filled" | "confirm" | "missing" | "unsupported" | "manual" | "failed" | "file";
  insertedValue?: string;
  readBack?: string;
  note?: string;
}

export interface AutofillRunState {
  runId: string;
  applicationId: string | null;
  url: string;
  phase: AutofillRunPhase;
  step: string;
  total: number;
  processed: number;
  /** Values actually read back from the DOM after filling. */
  results: AutofillRunResult[];
  validationIssues: string[];
  error?: string;
  startedAt: string;
  updatedAt: string;
}
