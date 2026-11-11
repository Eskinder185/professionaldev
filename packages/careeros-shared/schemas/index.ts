import type {
  AutoApplyMessage,
  AutoApplyQueueItem,
  MessageAction,
  PlatformId,
  PlatformSupportLevel,
  QueueStatus,
  SharedProfileSubset,
  StandardProfileFieldKey,
} from "../types";

export const ALLOWED_PRODUCTION_ORIGIN = "https://eskinder185.github.io";
export const REQUIRED_PATH_PREFIX = "/professionaldev";

const VALID_ACTIONS = new Set<MessageAction>([
  "HANDSHAKE",
  "GET_CAPABILITIES",
  "IMPORT_QUEUE",
  "TRANSFER_PROFILE",
  "PREPARE_APPLICATION",
  "GET_APPLICATION_STATUS",
  "UPDATE_APPLICATION_STATUS",
  "CLEAR_SHARED_DATA",
  "EXECUTE_AUTOFILL",
  "INSPECT_CURRENT_FORM",
  "CONFIRM_SUBMISSION",
  "SYNC_ANALYSIS",
  "SYNC_AI_CONFIGURATION",
  "GET_AI_CONFIGURATION",
  "SET_SELECTED_RESUME",
  "UPDATE_SHARED_PROFILE",
  "UPDATE_AUTOFILL_RUN",
]);

const VALID_PROFILE_KEYS = new Set<StandardProfileFieldKey>([
  "firstName",
  "lastName",
  "fullName",
  "preferredName",
  "email",
  "phone",
  "city",
  "state",
  "location",
  "country",
  "linkedin",
  "github",
  "website",
  "headline",
  "currentEmployer",
  "currentTitle",
  "school",
  "degree",
  "major",
  "graduationDate",
  "skillsSummary",
  "certificationsSummary",
  "experienceSummary",
  "coverLetter",
  "customQuestion",
]);

const VALID_STATUSES = new Set<QueueStatus>([
  "Imported",
  "Analysis needed",
  "Ready to prepare",
  "Needs information",
  "Ready for autofill",
  "Autofill in progress",
  "Ready for review",
  "Submitted and verified",
  "Unsupported",
  "Failed",
  "Skipped",
]);

/**
 * Validates that an external or window message comes from the authorized CareerOS
 * GitHub Pages application or local CareerOS dev server at /professionaldev/.
 */
export function validateSenderOrigin(senderUrlOrOrigin: string): {
  ok: boolean;
  origin?: string;
  reason?: string;
} {
  if (!senderUrlOrOrigin || typeof senderUrlOrOrigin !== "string") {
    return { ok: false, reason: "Missing sender URL or origin." };
  }
  let parsed: URL;
  try {
    parsed = new URL(senderUrlOrOrigin);
  } catch {
    return { ok: false, reason: "Malformed sender URL." };
  }

  const isProdOrigin = parsed.origin === ALLOWED_PRODUCTION_ORIGIN;
  const isLocalDev =
    (parsed.protocol === "http:" || parsed.protocol === "https:") &&
    (parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost");

  if (!isProdOrigin && !isLocalDev) {
    return {
      ok: false,
      reason: `Unauthorized origin: ${parsed.origin}. Only ${ALLOWED_PRODUCTION_ORIGIN} and localhost development origins are permitted.`,
    };
  }

  // When a full URL with path is provided, require the /professionaldev base path
  if (
    parsed.pathname &&
    parsed.pathname !== "/" &&
    !parsed.pathname.startsWith(REQUIRED_PATH_PREFIX)
  ) {
    return {
      ok: false,
      reason: `Unauthorized application path "${parsed.pathname}". Expected path under ${REQUIRED_PATH_PREFIX}/.`,
    };
  }

  return { ok: true, origin: parsed.origin };
}

const TRACKING_PARAMS = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "fbclid",
  "gclid",
  "mc_cid",
  "mc_eid",
  "ref",
  "source",
]);

const REDIRECT_PARAM_RE = /^(?:redirect|redirect_to|redirect_uri|return_to|returnurl|next|url|dest|destination|continue)$/i;

export interface ParsedJobUrlResult {
  ok: boolean;
  rawUrl: string;
  normalizedUrl?: string;
  dedupeKey?: string;
  platform?: PlatformId;
  supportLevel?: PlatformSupportLevel;
  sourceHost?: string;
  companyHint?: string;
  titleHint?: string;
  jobIdHint?: string;
  error?: string;
}

function humanizeSlug(slug: string): string {
  const clean = decodeURIComponent(slug)
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!clean) return "";
  return clean.replace(/\b[a-z]/g, (ch) => ch.toUpperCase());
}

/**
 * Validates, normalizes, and inspects a job posting URL without inventing unavailable details.
 */
export function validateAndAnalyzeJobUrl(rawInput: string): ParsedJobUrlResult {
  const rawUrl = rawInput.trim();
  if (!rawUrl) {
    return { ok: false, rawUrl, error: "Empty line." };
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { ok: false, rawUrl, error: "Invalid URL format. Use a full http:// or https:// link." };
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return {
      ok: false,
      rawUrl,
      error: `Unsupported protocol "${parsed.protocol}". Only http:// and https:// URLs are allowed.`,
    };
  }

  if (parsed.username || parsed.password) {
    return {
      ok: false,
      rawUrl,
      error: "URLs containing embedded credentials are not allowed.",
    };
  }

  // Block open redirect parameters pointing to external URLs
  for (const [key, val] of parsed.searchParams.entries()) {
    if (REDIRECT_PARAM_RE.test(key) && (/^https?:\/\//i.test(val) || val.startsWith("//"))) {
      return {
        ok: false,
        rawUrl,
        error: `Unsafe redirect parameter "${key}" detected in URL.`,
      };
    }
  }

  // Strip known tracking params while sorting remaining params conservatively
  const nextParams = new URLSearchParams();
  const sortedEntries = [...parsed.searchParams.entries()].sort(([a], [b]) => a.localeCompare(b));
  for (const [k, v] of sortedEntries) {
    if (!TRACKING_PARAMS.has(k.toLowerCase())) {
      nextParams.append(k, v);
    }
  }

  const normalized = new URL(parsed.origin + parsed.pathname.replace(/\/+$/, ""));
  if (normalized.pathname === "") normalized.pathname = "/";
  const qs = nextParams.toString();
  if (qs) normalized.search = `?${qs}`;

  const host = parsed.hostname.toLowerCase();
  const segments = parsed.pathname.split("/").filter(Boolean);

  let platform: PlatformId;
  let supportLevel: PlatformSupportLevel;
  let companyHint = "";
  let titleHint = "";
  let jobIdHint = "";

  // 1. Greenhouse: boards.greenhouse.io/<company>/jobs/<id> or job-boards.greenhouse.io/<company>/jobs/<id>
  if (host === "boards.greenhouse.io" || host === "job-boards.greenhouse.io") {
    platform = "greenhouse";
    supportLevel = "supported";
    if (segments[0]) companyHint = humanizeSlug(segments[0]);
    const jobsIdx = segments.indexOf("jobs");
    if (jobsIdx >= 0 && segments[jobsIdx + 1]) {
      jobIdHint = segments[jobsIdx + 1];
    } else if (parsed.searchParams.get("gh_jid")) {
      jobIdHint = parsed.searchParams.get("gh_jid") ?? "";
    }
    const roleParam = parsed.searchParams.get("title") || parsed.searchParams.get("role");
    if (roleParam) titleHint = humanizeSlug(roleParam);
  }
  // 2. Lever: jobs.lever.co/<company>/<job-id>
  else if (host === "jobs.lever.co" || host === " jobs.eu.lever.co".trim()) {
    platform = "lever";
    supportLevel = "supported";
    if (segments[0]) companyHint = humanizeSlug(segments[0]);
    if (segments[1]) jobIdHint = segments[1];
    const roleParam = parsed.searchParams.get("title") || parsed.searchParams.get("role");
    if (roleParam) titleHint = humanizeSlug(roleParam);
  }
  // 3. Ashby: jobs.ashbyhq.com/<company>/<job-id>
  else if (host === "jobs.ashbyhq.com") {
    platform = "ashby";
    supportLevel = "partial";
    if (segments[0]) companyHint = humanizeSlug(segments[0]);
    if (segments[1]) jobIdHint = segments[1];
  }
  // 4. Workday: *.myworkdayjobs.com/...
  else if (host.endsWith(".myworkdayjobs.com") || host === "myworkdayjobs.com") {
    platform = "workday";
    supportLevel = "partial";
    const sub = host.split(".")[0];
    if (sub && sub !== "myworkdayjobs") companyHint = humanizeSlug(sub);
    const jobSeg = segments[segments.length - 1];
    if (jobSeg) {
      jobIdHint = jobSeg;
      const cleaned = jobSeg.replace(/_[A-Z0-9-]+$/i, "");
      if (cleaned && cleaned !== jobSeg) titleHint = humanizeSlug(cleaned);
    }
  }
  // 5. Known unsupported gated / login-wall hosts
  else if (
    host.includes("linkedin.com") ||
    host.includes("indeed.com") ||
    host.includes("glassdoor.com") ||
    host.includes("monster.com") ||
    host.includes("ziprecruiter.com")
  ) {
    platform = "unsupported";
    supportLevel = "unsupported";
  }
  // 6. Local synthetic fixture or generic career form
  else {
    platform = "generic";
    supportLevel = "supported";
    const coParam = parsed.searchParams.get("company");
    const roleParam = parsed.searchParams.get("role") || parsed.searchParams.get("title");
    const platformParam = parsed.searchParams.get("platform");
    if (coParam) companyHint = coParam.trim();
    if (roleParam) titleHint = roleParam.trim();
    if (platformParam === "greenhouse" || platformParam === "lever" || platformParam === "ashby" || platformParam === "workday") {
      platform = platformParam;
      supportLevel = platformParam === "ashby" || platformParam === "workday" ? "partial" : "supported";
    } else if (platformParam === "unsupported") {
      platform = "unsupported";
      supportLevel = "unsupported";
    }
  }

  const normalizedUrl = normalized.toString();
  const dedupeKey =
    platform !== "generic" && platform !== "unsupported" && companyHint && jobIdHint
      ? `${platform}:${companyHint.toLowerCase()}:${jobIdHint.toLowerCase()}`
      : normalizedUrl.toLowerCase();

  return {
    ok: true,
    rawUrl,
    normalizedUrl,
    dedupeKey,
    platform,
    supportLevel,
    sourceHost: host,
    companyHint,
    titleHint,
    jobIdHint,
  };
}

export interface BatchImportResult {
  accepted: ParsedJobUrlResult[];
  duplicates: Array<{ rawUrl: string; duplicateOf: string }>;
  invalid: Array<{ rawUrl: string; error: string }>;
}

/**
 * Processes a multiline batch of job URLs (up to 20 per batch by default, extensible for larger queues).
 */
export function importJobUrlBatch(
  multilineText: string,
  existingItems: Pick<AutoApplyQueueItem, "normalizedUrl" | "platform" | "company" | "url">[] = [],
  maxBatchSize = 20,
): BatchImportResult {
  const lines = multilineText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const accepted: ParsedJobUrlResult[] = [];
  const duplicates: Array<{ rawUrl: string; duplicateOf: string }> = [];
  const invalid: Array<{ rawUrl: string; error: string }> = [];

  const seenKeys = new Set<string>();
  const seenUrls = new Set<string>();

  for (const item of existingItems) {
    if (item.normalizedUrl) seenUrls.add(item.normalizedUrl.toLowerCase());
    const analyzed = validateAndAnalyzeJobUrl(item.url || item.normalizedUrl);
    if (analyzed.ok && analyzed.dedupeKey) seenKeys.add(analyzed.dedupeKey);
  }

  lines.slice(0, maxBatchSize).forEach((line) => {
    const res = validateAndAnalyzeJobUrl(line);
    if (!res.ok || !res.normalizedUrl || !res.dedupeKey) {
      invalid.push({ rawUrl: line, error: res.error || "Invalid URL" });
      return;
    }
    if (seenUrls.has(res.normalizedUrl.toLowerCase()) || seenKeys.has(res.dedupeKey)) {
      duplicates.push({ rawUrl: line, duplicateOf: res.normalizedUrl });
      return;
    }
    seenUrls.add(res.normalizedUrl.toLowerCase());
    seenKeys.add(res.dedupeKey);
    accepted.push(res);
  });

  if (lines.length > maxBatchSize) {
    for (const extra of lines.slice(maxBatchSize)) {
      invalid.push({
        rawUrl: extra,
        error: `Batch limit of ${maxBatchSize} links per import reached. Import remaining links in the next batch.`,
      });
    }
  }

  return { accepted, duplicates, invalid };
}

/**
 * Runtime schema validator for incoming AutoApply messages.
 */
export function validateAutoApplyMessage(input: unknown): {
  ok: boolean;
  message?: AutoApplyMessage;
  error?: string;
} {
  if (!input || typeof input !== "object") {
    return { ok: false, error: "Message must be a JSON object." };
  }
  const obj = input as Record<string, unknown>;
  if (obj.protocol !== "careeros-autoapply") {
    return { ok: false, error: 'Invalid protocol. Expected "careeros-autoapply".' };
  }
  if (obj.version !== "1.0") {
    return { ok: false, error: `Unsupported protocol version "${String(obj.version)}". Expected "1.0".` };
  }
  if (typeof obj.requestId !== "string" || obj.requestId.trim().length < 3) {
    return { ok: false, error: "Missing or invalid requestId." };
  }
  if (typeof obj.action !== "string" || !VALID_ACTIONS.has(obj.action as MessageAction)) {
    return { ok: false, error: `Unsupported action "${String(obj.action)}".` };
  }
  if (typeof obj.timestamp !== "string" || !obj.timestamp.trim()) {
    return { ok: false, error: "Missing timestamp." };
  }
  if (typeof obj.origin !== "string" || !obj.origin.trim()) {
    return { ok: false, error: "Missing origin." };
  }

  const action = obj.action as MessageAction;
  const payload = obj.payload;

  if (action === "TRANSFER_PROFILE") {
    const check = validateSharedProfileSubset(payload);
    if (!check.ok) return { ok: false, error: check.error };
  } else if (action === "UPDATE_APPLICATION_STATUS") {
    if (!payload || typeof payload !== "object") {
      return { ok: false, error: "UPDATE_APPLICATION_STATUS requires an object payload." };
    }
    const p = payload as Record<string, unknown>;
    if (typeof p.applicationId !== "string" || !p.applicationId.trim()) {
      return { ok: false, error: "UPDATE_APPLICATION_STATUS requires applicationId." };
    }
    if (typeof p.status !== "string" || !VALID_STATUSES.has(p.status as QueueStatus)) {
      return { ok: false, error: `Invalid queue status "${String(p.status)}".` };
    }
    // Never allow marking "Submitted and verified" unless confirmationVerified === true
    if (p.status === "Submitted and verified" && p.confirmationVerified !== true) {
      return {
        ok: false,
        error: 'Status "Submitted and verified" requires explicit confirmationVerified: true.',
      };
    }
  } else if (action === "SYNC_AI_CONFIGURATION") {
    if (!payload || typeof payload !== "object") {
      return { ok: false, error: "SYNC_AI_CONFIGURATION requires an object payload." };
    }
    const serialized = JSON.stringify(payload);
    if (/"apiKey"\s*:|sk-[a-zA-Z0-9-]{12,}|AIza[0-9A-Za-z_-]{20,}/i.test(serialized)) {
      return {
        ok: false,
        error: "API keys and credentials must never be included in AI configuration sync.",
      };
    }
  }

  return {
    ok: true,
    message: {
      protocol: "careeros-autoapply",
      version: "1.0",
      requestId: obj.requestId,
      action,
      origin: obj.origin,
      timestamp: obj.timestamp,
      payload,
    },
  };
}

/**
 * Validates that a SharedProfileSubset only contains user-approved fields and never leaks secrets.
 */
export function validateSharedProfileSubset(input: unknown): {
  ok: boolean;
  subset?: SharedProfileSubset;
  error?: string;
} {
  if (!input || typeof input !== "object") {
    return { ok: false, error: "Profile payload must be an object." };
  }
  const obj = input as Record<string, unknown>;
  if (typeof obj.approvedAt !== "string" || !obj.approvedAt.trim()) {
    return { ok: false, error: "Profile transfer requires an explicit approvedAt timestamp." };
  }
  if (!Array.isArray(obj.sharedFields) || obj.sharedFields.length === 0) {
    return { ok: false, error: "Select at least one profile field to share." };
  }
  for (const key of obj.sharedFields) {
    if (typeof key !== "string" || !VALID_PROFILE_KEYS.has(key as StandardProfileFieldKey)) {
      return { ok: false, error: `Invalid profile field key "${String(key)}".` };
    }
  }
  if (!obj.values || typeof obj.values !== "object") {
    return { ok: false, error: "Profile values object is required." };
  }
  const values = obj.values as Record<string, unknown>;
  const allowedSet = new Set(obj.sharedFields as string[]);
  const sanitizedValues: Partial<Record<StandardProfileFieldKey, string>> = {};

  for (const [k, v] of Object.entries(values)) {
    if (!allowedSet.has(k)) {
      return {
        ok: false,
        error: `Field "${k}" was present in values but not authorized in sharedFields.`,
      };
    }
    if (typeof v === "string") {
      sanitizedValues[k as StandardProfileFieldKey] = v;
    }
  }

  // Ensure no API key or credential field is ever smuggled
  const serialized = JSON.stringify(obj);
  if (/"apiKey"\s*:|sk-[a-zA-Z0-9]{16,}/i.test(serialized)) {
    return { ok: false, error: "API keys and credentials must never be included in profile transfers." };
  }

  return {
    ok: true,
    subset: {
      approvedAt: obj.approvedAt,
      sharedFields: obj.sharedFields as StandardProfileFieldKey[],
      values: sanitizedValues,
      education: Array.isArray(obj.education) ? (obj.education as SharedProfileSubset["education"]) : undefined,
      experience: Array.isArray(obj.experience) ? (obj.experience as SharedProfileSubset["experience"]) : undefined,
      skills: Array.isArray(obj.skills) ? (obj.skills as string[]) : undefined,
      certifications: Array.isArray(obj.certifications) ? (obj.certifications as string[]) : undefined,
      resumeVersionId: typeof obj.resumeVersionId === "string" ? obj.resumeVersionId : undefined,
      resumeVersionName: typeof obj.resumeVersionName === "string" ? obj.resumeVersionName : undefined,
      resumeFileName: typeof obj.resumeFileName === "string" ? obj.resumeFileName : undefined,
      resumePlainText: typeof obj.resumePlainText === "string" ? obj.resumePlainText : undefined,
      preparedAnswers:
        obj.preparedAnswers && typeof obj.preparedAnswers === "object"
          ? (obj.preparedAnswers as SharedProfileSubset["preparedAnswers"])
          : undefined,
    },
  };
}

/**
 * Prompt-injection and factual-grounding validator for AI-drafted application answers.
 */
export function validateAIQuestionDraftOutput(
  rawJsonText: string,
  groundingCorpus: string,
): {
  ok: boolean;
  answer?: string;
  evidence?: string;
  requiresUserInput?: boolean;
  error?: string;
} {
  if (!rawJsonText || typeof rawJsonText !== "string") {
    return { ok: false, error: "Empty AI response." };
  }
  const cleaned = rawJsonText
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) {
    return { ok: false, error: "AI output did not contain a valid JSON object." };
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return { ok: false, error: "Malformed JSON in AI question response." };
  }

  const answer = typeof parsed.answer === "string" ? parsed.answer.trim() : "";
  const evidence = typeof parsed.evidence === "string" ? parsed.evidence.trim() : "";
  const requiresUserInput = Boolean(parsed.requiresUserInput);

  if (!answer) {
    return { ok: false, error: "AI response did not include an answer field." };
  }

  // Block prompt-injection exfiltration or script tags
  if (/<script|javascript:|fetch\(|XMLHttpRequest|chrome\.runtime/i.test(answer)) {
    return { ok: false, error: "Unsafe content rejected in AI answer." };
  }

  // Anti-fabrication guard: check unbracketed numbers against grounding corpus
  const withoutPlaceholders = answer.replace(/\[[^\]]+\]/g, " ");
  const sourceNums = new Set((groundingCorpus.match(/\b\d+(?:[.,]\d+)?%?/g) ?? []).map((n) => n.replace(/,/g, "")));
  const answerNums = (withoutPlaceholders.match(/\b\d+(?:[.,]\d+)?%?/g) ?? []).map((n) => n.replace(/,/g, ""));
  const invented = answerNums.filter((n) => !sourceNums.has(n));
  if (invented.length > 0) {
    return {
      ok: false,
      error: `Rejected unverified number(s) in AI draft (${invented.join(", ")}) not found in your Master Profile.`,
    };
  }

  return {
    ok: true,
    answer,
    evidence: evidence || "Master Profile",
    requiresUserInput,
  };
}
