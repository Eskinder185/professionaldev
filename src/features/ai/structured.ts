/**
 * Tolerant JSON extraction, schema validation, and anti-fabrication guards for
 * local and OpenAI-compatible models (Phase 7 & Phase 8).
 *
 * Every AI response must pass schema validation and anti-fabrication checks before
 * it can be shown as a user-reviewable proposal. Raw model output never overwrites
 * a résumé directly.
 */
import { uid } from "../resume/model/defaults";
import type { JobMetadata, Requirement, RequirementKind, Resume } from "../resume/model/types";
import { extractJobMetadata } from "../resume/job/extractRequirements";
import { AIError, type ChatMessage, type JsonSchemaFormat } from "./client";

export type WritingActionId =
  | "improve-bullet"
  | "make-concise"
  | "emphasize-technical"
  | "improve-clarity"
  | "match-role"
  | "simplify-sentence"
  | "remove-repetition"
  | "stronger-structure";

export interface WritingActionSpec {
  id: WritingActionId;
  label: string;
  instruction: string;
}

export const WRITING_ACTIONS: WritingActionSpec[] = [
  {
    id: "improve-bullet",
    label: "Improve this bullet",
    instruction: "Strengthen this bullet with a clear action verb and concrete technical clarity while keeping every fact truthful.",
  },
  {
    id: "make-concise",
    label: "Make this more concise",
    instruction: "Shorten this text to save line space on a one-page résumé without losing any technical substance or verified facts.",
  },
  {
    id: "emphasize-technical",
    label: "Emphasize technical impact",
    instruction: "Foreground the specific tools, systems, protocols, and engineering actions already present in the text.",
  },
  {
    id: "improve-clarity",
    label: "Improve clarity",
    instruction: "Rewrite for direct, unambiguous, ATS-friendly readability using active voice.",
  },
  {
    id: "match-role",
    label: "Match the target role",
    instruction: "Align wording with the target job requirements where truthful and supported by the user's verified experience.",
  },
  {
    id: "simplify-sentence",
    label: "Simplify this sentence",
    instruction: "Replace dense or convoluted phrasing with plain, direct professional language.",
  },
  {
    id: "remove-repetition",
    label: "Remove repetition",
    instruction: "Eliminate repeated words or redundant phrases while preserving every distinct accomplishment.",
  },
  {
    id: "stronger-structure",
    label: "Suggest a stronger structure",
    instruction: "Structure the bullet as Action + System/Context + Outcome (using [bracketed placeholders] if an outcome detail is missing).",
  },
];

export interface ValidatedAISuggestion {
  actionType: string;
  originalText: string;
  proposedText: string;
  reason: string;
  evidenceReference: string;
  relatedRequirement: string;
  confidence: "high" | "medium" | "low";
  requiresConfirmation: true;
}

export interface ValidatedInterviewFeedback {
  overallSummary: string;
  starEvaluation: {
    situation: string;
    task: string;
    action: string;
    result: string;
  };
  technicalAccuracy: string;
  jobAlignment: string;
  followUpExamples: string[];
}

/**
 * Strip `<think>...</think>` blocks, markdown code fences, and surrounding prose
 * so smaller local models (Llama, Qwen, Mistral, DeepSeek, Phi) parse reliably.
 */
export function extractJsonBlock(raw: string): unknown {
  if (!raw || !raw.trim()) {
    throw new AIError("malformed", "The model returned an empty response.");
  }
  const withoutThink = raw.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();

  // Try direct parse first
  try {
    return JSON.parse(withoutThink);
  } catch {
    /* continue */
  }

  // Try fenced ```json ... ``` block
  const fenced = withoutThink.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    try {
      return JSON.parse(fenced[1].trim());
    } catch {
      /* continue */
    }
  }

  // Find first balanced { ... } or [ ... ]
  const firstBrace = withoutThink.indexOf("{");
  const lastBrace = withoutThink.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    const candidate = withoutThink.slice(firstBrace, lastBrace + 1);
    try {
      return JSON.parse(candidate);
    } catch {
      /* continue */
    }
  }

  const firstBracket = withoutThink.indexOf("[");
  const lastBracket = withoutThink.lastIndexOf("]");
  if (firstBracket >= 0 && lastBracket > firstBracket) {
    const candidate = withoutThink.slice(firstBracket, lastBracket + 1);
    try {
      return JSON.parse(candidate);
    } catch {
      /* continue */
    }
  }

  throw new AIError(
    "malformed",
    "The model returned an invalid format instead of structured JSON. Click Retry to request a valid response.",
  );
}

/**
 * Detect numbers/metrics in `proposedText` (outside of `[bracketed placeholders]`)
 * that do not appear anywhere in `sourceCorpus`. Prevents hallucinated metrics like "45%".
 */
export function findFabricatedNumbers(sourceCorpus: string, proposedText: string): string[] {
  const withoutPlaceholders = proposedText.replace(/\[[^\]]*\]/g, " ");
  const sourceNumbers = new Set(
    (sourceCorpus.match(/\b\d+(?:[.,]\d+)?%?/g) ?? []).map((n) => n.replace(/,/g, "")),
  );
  const proposedNumbers = (withoutPlaceholders.match(/\b\d+(?:[.,]\d+)?%?/g) ?? []).map((n) =>
    n.replace(/,/g, ""),
  );
  return proposedNumbers.filter((n) => !sourceNumbers.has(n));
}

/** Serialize a Resume into a compact text corpus for grounding & fabrication checks. */
export function resumeToGroundingText(resume: Resume): string {
  const parts: string[] = [
    resume.contact.name,
    resume.contact.headline,
    resume.targetRole,
    resume.summary,
    ...resume.skills.map((c) => `${c.name}: ${c.skills.join(", ")}`),
    ...resume.experience.flatMap((e) => [
      `${e.title} at ${e.employer} (${e.startDate} - ${e.endDate})`,
      ...e.bullets,
    ]),
    ...resume.projects.flatMap((p) => [
      `${p.name} (${p.technologies.join(", ")}): ${p.description}`,
      ...p.bullets,
    ]),
    ...resume.education.map((ed) => `${ed.degree} ${ed.field} ${ed.institution} ${ed.endDate}`),
    ...resume.certifications.map((c) => `${c.name} ${c.issuer} ${c.date}`),
  ];
  return parts.filter(Boolean).join("\n");
}

function normalizeConfidence(val: unknown): "high" | "medium" | "low" {
  if (typeof val === "string") {
    const lower = val.toLowerCase();
    if (lower.includes("high")) return "high";
    if (lower.includes("low")) return "low";
  }
  return "medium";
}

function parseSingleSuggestion(
  item: unknown,
  fallbackOriginal: string,
  groundingCorpus: string,
): ValidatedAISuggestion {
  if (!item || typeof item !== "object") {
    throw new AIError("malformed", "Suggestion item is not a JSON object.");
  }
  const obj = item as Record<string, unknown>;
  const actionType = String(obj.actionType ?? obj.action_type ?? "improve-bullet").trim();
  const originalText = String(obj.originalText ?? obj.original_text ?? fallbackOriginal).trim();
  const proposedText = String(obj.proposedText ?? obj.proposed_text ?? "").trim();
  const reason = String(obj.reason ?? obj.explanation ?? "").trim();
  const evidenceReference = String(obj.evidenceReference ?? obj.evidence_reference ?? obj.evidence ?? "Verified résumé content").trim();
  const relatedRequirement = String(obj.relatedRequirement ?? obj.related_job_requirement ?? obj.requirement ?? "Clarity & impact").trim();
  const confidence = normalizeConfidence(obj.confidence ?? obj.uncertainty);

  if (!proposedText || !reason) {
    throw new AIError("malformed", "The model omitted `proposedText` or `reason` in its JSON output.");
  }

  // Anti-fabrication guard: reject unbracketed invented numbers/percentages
  const corpus = `${groundingCorpus}\n${originalText}`;
  const fabricated = findFabricatedNumbers(corpus, proposedText);
  if (fabricated.length > 0) {
    throw new AIError(
      "malformed",
      `Rejected unsafe AI suggestion: it introduced unverified numbers (${fabricated.join(", ")}) not in your résumé. Metrics must use [bracketed placeholders] unless already in your profile.`,
    );
  }

  return {
    actionType,
    originalText: originalText || fallbackOriginal,
    proposedText,
    reason,
    evidenceReference,
    relatedRequirement,
    confidence,
    requiresConfirmation: true,
  };
}

/** Validate a single suggestion or array of suggestions from the model. */
export function validateAISuggestions(
  raw: string,
  fallbackOriginal: string,
  groundingCorpus: string,
): ValidatedAISuggestion[] {
  const parsed = extractJsonBlock(raw);
  const list: unknown[] = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === "object" && Array.isArray((parsed as { suggestions?: unknown }).suggestions)
      ? ((parsed as { suggestions: unknown[] }).suggestions)
      : [parsed];

  if (!list.length) {
    throw new AIError("malformed", "The model returned an empty suggestion list.");
  }

  const out: ValidatedAISuggestion[] = [];
  for (const item of list) {
    out.push(parseSingleSuggestion(item, fallbackOriginal, groundingCorpus));
  }
  return out;
}

export const AI_SUGGESTION_SCHEMA: JsonSchemaFormat = {
  name: "resume_suggestions",
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["suggestions"],
    properties: {
      suggestions: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: [
            "actionType",
            "originalText",
            "proposedText",
            "reason",
            "evidenceReference",
            "relatedRequirement",
            "confidence",
            "requiresConfirmation",
          ],
          properties: {
            actionType: { type: "string" },
            originalText: { type: "string" },
            proposedText: { type: "string" },
            reason: { type: "string" },
            evidenceReference: { type: "string" },
            relatedRequirement: { type: "string" },
            confidence: { type: "string", enum: ["high", "medium", "low"] },
            requiresConfirmation: { type: "boolean" },
          },
        },
      },
    },
  },
};

export function buildWritingPrompt(
  action: WritingActionSpec,
  originalText: string,
  resume: Resume,
  targetRole?: string,
  jobRequirements: string[] = [],
): ChatMessage[] {
  return [
    {
      role: "system",
      content: [
        "You are CareerOS Résumé Studio's truthfulness-first writing assistant.",
        "STRICT RULES:",
        "1. NEVER invent employers, job titles, dates, metrics, percentages, certifications, or technologies not in the user's résumé.",
        "2. If a stronger bullet needs a metric or detail that is missing, use a [bracketed placeholder] like [X%] or [specific system].",
        "3. Return ONLY valid JSON matching this exact structure:",
        '{"suggestions":[{"actionType":"string","originalText":"string","proposedText":"string","reason":"string","evidenceReference":"string","relatedRequirement":"string","confidence":"high|medium|low","requiresConfirmation":true}]}',
      ].join("\n"),
    },
    {
      role: "user",
      content: [
        `Action requested: ${action.label} (${action.id})`,
        `Instruction: ${action.instruction}`,
        targetRole ? `Target role: ${targetRole}` : "",
        jobRequirements.length ? `Target job requirements: ${jobRequirements.slice(0, 12).join(", ")}` : "",
        `Original text to improve:\n"${originalText}"`,
        `Verified résumé context:\n${resumeToGroundingText(resume).slice(0, 2500)}`,
      ]
        .filter(Boolean)
        .join("\n\n"),
    },
  ];
}

export function buildTailoringPrompt(
  resume: Resume,
  jobTitle: string,
  jobRequirements: Requirement[],
): ChatMessage[] {
  const reqList = jobRequirements
    .filter((r) => r.selected && r.kind !== "context")
    .slice(0, 18)
    .map((r) => `${r.term} (${r.kind})`)
    .join(", ");

  return [
    {
      role: "system",
      content: [
        "You are CareerOS Résumé Studio's one-page tailoring assistant.",
        "Compare the user's verified résumé against the target job requirements and propose 2 to 4 high-impact, truthful bullet or summary improvements that help the résumé fit on one page and align with the posting.",
        "STRICT RULES:",
        "1. NEVER fabricate employers, dates, numbers, metrics, certifications, or skills not supported by the user's résumé.",
        "2. Use [bracketed placeholders] if any additional detail is needed from the user.",
        "3. `originalText` MUST match the exact bullet or summary text from the user's résumé.",
        "4. Return ONLY valid JSON:",
        '{"suggestions":[{"actionType":"tailor-bullet","originalText":"exact current bullet","proposedText":"improved bullet","reason":"why this helps","evidenceReference":"Experience / Projects","relatedRequirement":"matched requirement","confidence":"high","requiresConfirmation":true}]}',
      ].join("\n"),
    },
    {
      role: "user",
      content: [
        `Target role: ${jobTitle || resume.targetRole || "Target Role"}`,
        `Confirmed job requirements: ${reqList || "General role alignment"}`,
        `User's verified résumé:\n${resumeToGroundingText(resume).slice(0, 3500)}`,
      ].join("\n\n"),
    },
  ];
}

const FORBIDDEN_LOCATION_STATE = new Set([
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
  "DC", "USD", "YR", "HR", "LLC", "INC", "CORP", "MUST", "REQUIRED", "FULL", "TIME", "SHIFT",
]);

export function buildJobExtractionPrompt(description: string): ChatMessage[] {
  return [
    {
      role: "system",
      content: [
        "Extract structured job requirements and job metadata from the job description.",
        "STRICT RULES:",
        "1. NEVER classify city names, US state abbreviations (e.g. GA, VA, TX), salary units (USD, yr, hr), company names, or generic uppercase words (MUST, REQUIRED, SHIFT) as skills or requirements.",
        "2. Keep an exact `excerpt` from the job description for every extracted requirement.",
        "3. Return ONLY valid JSON:",
        '{"metadata":{"company":"string","location":"string","workMode":"Remote|Hybrid|On-site","compensation":"string","employmentType":"string"},"requirements":[{"term":"string","category":"Technical Skills|Experience|Education|Certifications|Responsibilities|Professional Skills|Other technical terms","kind":"required|preferred|responsibility","uncertain":false,"excerpt":"exact sentence from posting"}]}',
      ].join("\n"),
    },
    {
      role: "user",
      content: `Job description:\n${description.slice(0, 4500)}`,
    },
  ];
}

export function validateAIJobExtraction(
  raw: string,
  description: string,
): { requirements: Requirement[]; metadata: JobMetadata } {
  const parsed = extractJsonBlock(raw);
  if (!parsed || typeof parsed !== "object") {
    throw new AIError("malformed", "The model did not return a JSON object for job requirements.");
  }
  const obj = parsed as Record<string, unknown>;
  const ruleMeta = extractJobMetadata(description);
  const rawMeta = (obj.metadata && typeof obj.metadata === "object" ? obj.metadata : {}) as Record<string, unknown>;
  const rawWorkMode = typeof rawMeta.workMode === "string" ? rawMeta.workMode.trim() : "";
  const workMode: JobMetadata["workMode"] =
    rawWorkMode === "Remote" || rawWorkMode === "Hybrid" || rawWorkMode === "On-site"
      ? rawWorkMode
      : ruleMeta.workMode;
  const metadata: JobMetadata = {
    company: typeof rawMeta.company === "string" && rawMeta.company.trim() ? rawMeta.company.trim() : ruleMeta.company,
    location: typeof rawMeta.location === "string" && rawMeta.location.trim() ? rawMeta.location.trim() : ruleMeta.location,
    workMode,
    compensation: typeof rawMeta.compensation === "string" && rawMeta.compensation.trim() ? rawMeta.compensation.trim() : ruleMeta.compensation,
    employmentType: typeof rawMeta.employmentType === "string" && rawMeta.employmentType.trim() ? rawMeta.employmentType.trim() : ruleMeta.employmentType,
  };

  const rawList = Array.isArray(obj.requirements) ? obj.requirements : [];
  const seen = new Set<string>();
  const requirements: Requirement[] = [];

  for (const item of rawList) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const term = typeof r.term === "string" ? r.term.trim() : "";
    if (!term || term.length < 2) continue;
    if (FORBIDDEN_LOCATION_STATE.has(term.toUpperCase())) continue;
    if (/^[A-Z][A-Za-z .'-]+,\s*[A-Z]{2}$/.test(term)) continue;
    if (/^\$\d/.test(term)) continue;

    const key = term.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    const rawKind = typeof r.kind === "string" ? r.kind.toLowerCase() : "required";
    const kind: RequirementKind =
      rawKind === "preferred" ? "preferred" : rawKind === "responsibility" ? "responsibility" : "required";
    const category = typeof r.category === "string" && r.category.trim() ? r.category.trim() : "Technical Skills";
    const excerpt = typeof r.excerpt === "string" && r.excerpt.trim() ? r.excerpt.trim() : "";
    const uncertain = Boolean(r.uncertain);

    requirements.push({
      id: uid(),
      term,
      phrases: [term],
      snippets: excerpt ? [excerpt.slice(0, 220)] : [],
      category,
      kind,
      selected: true,
      possession: "unanswered",
      origin: "detected",
      uncertain: uncertain || undefined,
    });
  }

  return { requirements, metadata };
}

export function buildInterviewCoachPrompt(
  question: string,
  transcript: string,
  targetRole?: string,
): ChatMessage[] {
  return [
    {
      role: "system",
      content: [
        "You are CareerOS Interview Studio's AI Interview Coach.",
        "Analyze the candidate's text transcript for the interview question.",
        "Evaluate STAR structure (Situation, Task, Action, Result), technical accuracy, and alignment with the target role.",
        "Never fabricate achievements; suggest how the candidate can structure their own real experience more clearly.",
        "Return ONLY valid JSON:",
        '{"overallSummary":"string","starEvaluation":{"situation":"string","task":"string","action":"string","result":"string"},"technicalAccuracy":"string","jobAlignment":"string","followUpExamples":["string"]}',
      ].join("\n"),
    },
    {
      role: "user",
      content: [
        targetRole ? `Target role: ${targetRole}` : "",
        `Interview question: ${question}`,
        `Candidate transcript:\n${transcript}`,
      ]
        .filter(Boolean)
        .join("\n\n"),
    },
  ];
}

export function validateAIInterviewFeedback(raw: string): ValidatedInterviewFeedback {
  const parsed = extractJsonBlock(raw);
  if (!parsed || typeof parsed !== "object") {
    throw new AIError("malformed", "The model did not return a JSON object for interview feedback.");
  }
  const obj = parsed as Record<string, unknown>;
  const star = (obj.starEvaluation && typeof obj.starEvaluation === "object" ? obj.starEvaluation : {}) as Record<string, unknown>;
  const overallSummary = typeof obj.overallSummary === "string" ? obj.overallSummary.trim() : "";
  if (!overallSummary) {
    throw new AIError("malformed", "The model response was missing `overallSummary`.");
  }
  return {
    overallSummary,
    starEvaluation: {
      situation: typeof star.situation === "string" ? star.situation : "Review situation context.",
      task: typeof star.task === "string" ? star.task : "Review task definition.",
      action: typeof star.action === "string" ? star.action : "Review specific actions taken.",
      result: typeof star.result === "string" ? star.result : "Review measurable or observable outcome.",
    },
    technicalAccuracy: typeof obj.technicalAccuracy === "string" ? obj.technicalAccuracy : "Clear technical terminology.",
    jobAlignment: typeof obj.jobAlignment === "string" ? obj.jobAlignment : "Aligned with target role.",
    followUpExamples: Array.isArray(obj.followUpExamples)
      ? obj.followUpExamples.filter((x): x is string => typeof x === "string")
      : [],
  };
}
