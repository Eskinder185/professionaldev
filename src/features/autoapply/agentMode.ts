/**
 * Phase 7 — Optional Agent Mode for CareerOS AutoApply.
 *
 * Modes:
 * - "Assist": Inspects job posting & form fields and explains matched/missing qualifications without staging values.
 * - "Prepare": Inspects fields, compares requirements, and drafts open-ended responses & tailored résumé suggestions for user review.
 * - "Guided": Stages high-confidence standard fields and pauses before any uncertain, open-ended, or sensitive field and before final submission.
 *
 * Safety & Security Invariants:
 * - Only actions in TRUSTED_AGENT_ACTIONS may execute.
 * - Unknown actions, raw JavaScript/shell commands, privileged browser API calls, CAPTCHA bypass, and auto-submit are strictly rejected.
 * - Sensitive fields (work authorization, sponsorship, EEO/demographics, criminal history, legal declarations) always pause for manual input.
 * - User can Pause or trigger Emergency Stop at any time, immediately aborting in-flight AI or DOM operations.
 */

export type AgentAutomationMode = "Assist" | "Prepare" | "Guided";

export type TrustedAgentActionType =
  | "INSPECT_PAGE_FIELDS"
  | "COMPARE_REQUIREMENTS"
  | "DRAFT_FIELD_ANSWERS"
  | "STAGE_SAFE_FIELDS"
  | "PAUSE_FOR_USER_REVIEW";

export const TRUSTED_AGENT_ACTIONS: ReadonlySet<TrustedAgentActionType> = new Set<TrustedAgentActionType>([
  "INSPECT_PAGE_FIELDS",
  "COMPARE_REQUIREMENTS",
  "DRAFT_FIELD_ANSWERS",
  "STAGE_SAFE_FIELDS",
  "PAUSE_FOR_USER_REVIEW",
]);

const FORBIDDEN_ACTION_PATTERNS = [
  /submit/i,
  /captcha/i,
  /turnstile/i,
  /recaptcha/i,
  /hcaptcha/i,
  /login/i,
  /signin/i,
  /auth_bypass/i,
  /exec/i,
  /shell/i,
  /eval/i,
  /script/i,
  /cookie/i,
  /navigate_external/i,
];

const FORBIDDEN_PAYLOAD_PATTERNS = [
  /<script/i,
  /javascript:/i,
  /\beval\s*\(/i,
  /\bnew\s+Function\b/i,
  /\bchrome\.(?:cookies|tabs|scripting|webRequest|management)\b/i,
  /\bwindow\.open\s*\(/i,
  /\bdocument\.cookie\b/i,
  /\bchild_process\b/i,
  /\bpowershell\b|\bcmd\.exe\b|\bbash\s+-c\b/i,
  /ignore\s+(?:all\s+)?previous\s+instructions/i,
  /exfiltrate|send_api_key/i,
];

const SENSITIVE_FIELD_PATTERNS = [
  /work\s*auth/i,
  /authorized\s+to\s+work/i,
  /sponsorship/i,
  /\bvisa\b/i,
  /citizenship/i,
  /gender|race|ethnicity|hispanic|latino/i,
  /veteran/i,
  /disability|handicap/i,
  /criminal|felony|conviction|background\s+check/i,
  /security\s+clearance/i,
  /i\s+certify|under\s+penalty\s+of\s+perjury|legal\s+signature/i,
];

export interface ProposedAgentStep {
  action: string;
  targetFieldLabel?: string;
  description: string;
  proposedValue?: string;
}

export interface ValidatedAgentStep {
  allowed: boolean;
  requiresPause: boolean;
  action: TrustedAgentActionType | null;
  description: string;
  reason: string;
}

/**
 * Validates any proposed agent step (from an AI planner or workflow) against the strict allowlist
 * and security rules before execution.
 */
export function validateAgentPlanStep(step: ProposedAgentStep): ValidatedAgentStep {
  const rawAction = String(step.action ?? "").trim();
  const desc = String(step.description ?? "").trim();
  const fieldLabel = String(step.targetFieldLabel ?? "").trim();
  const proposedVal = String(step.proposedValue ?? "").trim();

  // 1. Block forbidden action names (auto-submit, CAPTCHA, shell/JS execution, login bypass)
  for (const pat of FORBIDDEN_ACTION_PATTERNS) {
    if (pat.test(rawAction) || pat.test(desc)) {
      return {
        allowed: false,
        requiresPause: true,
        action: null,
        description: desc || rawAction,
        reason: `Blocked unsafe agent action "${rawAction}": CareerOS never auto-submits applications, bypasses CAPTCHAs/login walls, or runs arbitrary code.`,
      };
    }
  }

  // 2. Block prompt-injection / script / privileged API payloads
  const combinedPayload = `${desc} ${fieldLabel} ${proposedVal}`;
  for (const pat of FORBIDDEN_PAYLOAD_PATTERNS) {
    if (pat.test(combinedPayload)) {
      return {
        allowed: false,
        requiresPause: true,
        action: null,
        description: desc || rawAction,
        reason: `Blocked untrusted payload in step "${rawAction}": detected script, privileged API call, or prompt-injection instruction.`,
      };
    }
  }

  // 3. Enforce strict allowlist of trusted action types
  if (!TRUSTED_AGENT_ACTIONS.has(rawAction as TrustedAgentActionType)) {
    return {
      allowed: false,
      requiresPause: true,
      action: null,
      description: desc || rawAction,
      reason: `Blocked unknown agent action "${rawAction}". Only allowlisted actions (${[...TRUSTED_AGENT_ACTIONS].join(", ")}) are permitted.`,
    };
  }

  // 4. Sensitive fields always pause for manual user input
  if (fieldLabel && SENSITIVE_FIELD_PATTERNS.some((p) => p.test(fieldLabel))) {
    return {
      allowed: true,
      requiresPause: true,
      action: "PAUSE_FOR_USER_REVIEW",
      description: `Paused on sensitive field "${fieldLabel}"`,
      reason: `"${fieldLabel}" is a protected legal/EEO/work-authorization question. CareerOS never auto-answers sensitive questions; manual user input is required.`,
    };
  }

  return {
    allowed: true,
    requiresPause: rawAction === "PAUSE_FOR_USER_REVIEW",
    action: rawAction as TrustedAgentActionType,
    description: desc || `Execute ${rawAction}`,
    reason: "Verified against trusted action allowlist.",
  };
}

export type AgentRunState = "idle" | "running" | "paused" | "stopped" | "completed";

export interface AgentLogEntry {
  id: string;
  timestamp: string;
  mode: AgentAutomationMode;
  action: string;
  status: "completed" | "paused" | "blocked" | "stopped";
  detail: string;
}

/**
 * Generates the permission-controlled step plan for the selected Agent Automation Mode.
 */
export function buildModeSteps(
  mode: AgentAutomationMode,
  context: {
    company: string;
    title: string;
    matchedCount: number;
    missingCount: number;
    safeFieldCount: number;
    sensitiveFieldLabels: string[];
  },
): ProposedAgentStep[] {
  const baseSteps: ProposedAgentStep[] = [
    {
      action: "INSPECT_PAGE_FIELDS",
      description: `Inspect form controls and job posting for ${context.title || "Target Role"} at ${context.company || "Employer"}.`,
    },
    {
      action: "COMPARE_REQUIREMENTS",
      description: `Compare posting requirements against verified Master Profile evidence (${context.matchedCount} matched, ${context.missingCount} missing).`,
    },
  ];

  if (mode === "Assist") {
    baseSteps.push({
      action: "PAUSE_FOR_USER_REVIEW",
      description: "Assist mode complete: review requirement coverage and field explanations before preparing values.",
    });
    return baseSteps;
  }

  baseSteps.push({
    action: "DRAFT_FIELD_ANSWERS",
    description: "Prepare grounded application question drafts and one-page résumé tailoring suggestions for user approval.",
  });

  if (mode === "Prepare") {
    baseSteps.push({
      action: "PAUSE_FOR_USER_REVIEW",
      description: "Prepare mode complete: inspect drafted responses and click Accept, Edit, or Reject on each suggestion.",
    });
    return baseSteps;
  }

  // Guided mode: stages safe fields, pauses on any sensitive fields, and always pauses before submission
  baseSteps.push({
    action: "STAGE_SAFE_FIELDS",
    description: `Stage ${context.safeFieldCount} high-confidence contact and profile fields without submitting the form.`,
  });

  for (const label of context.sensitiveFieldLabels) {
    baseSteps.push({
      action: "STAGE_SAFE_FIELDS",
      targetFieldLabel: label,
      description: `Check sensitive field "${label}".`,
    });
  }

  baseSteps.push({
    action: "PAUSE_FOR_USER_REVIEW",
    description: "Guided mode paused for final human review. Verify all staged fields and sensitive answers; submit manually when ready.",
  });

  return baseSteps;
}
