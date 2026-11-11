/**
 * Model capability detection, task-to-model routing, Local-Only mode enforcement,
 * and Cloud Credential Security status evaluation (Phases 2, 3, 4, and 5).
 */
import type { ModelInfo } from "./client";
import { validateEndpoint } from "./endpoint";
import { PROVIDERS, type ProviderId } from "./providers";

export type AITaskId =
  | "job_analysis"
  | "resume_matching"
  | "resume_tailoring"
  | "cover_letter"
  | "question_drafting"
  | "interview_analysis"
  | "agent_planning";

export interface AITaskSpec {
  id: AITaskId;
  label: string;
  description: string;
  requiresStructuredJson: boolean;
  requiresAgentReasoning: boolean;
  minRecommendedParamsB: number;
}

export const AI_TASKS: AITaskSpec[] = [
  {
    id: "job_analysis",
    label: "Job analysis",
    description: "Extract structured technical requirements, role metadata, and keywords from job postings.",
    requiresStructuredJson: true,
    requiresAgentReasoning: false,
    minRecommendedParamsB: 3,
  },
  {
    id: "resume_matching",
    label: "Résumé matching",
    description: "Compare job requirements against verified Master Profile evidence and explain gaps.",
    requiresStructuredJson: true,
    requiresAgentReasoning: false,
    minRecommendedParamsB: 3,
  },
  {
    id: "resume_tailoring",
    label: "One-page résumé tailoring",
    description: "Propose truthful, grounded bullet rewrites that fit on one US Letter page.",
    requiresStructuredJson: true,
    requiresAgentReasoning: false,
    minRecommendedParamsB: 7,
  },
  {
    id: "cover_letter",
    label: "Cover letter drafting",
    description: "Draft concise, role-aligned cover letter paragraphs grounded in verified experience.",
    requiresStructuredJson: false,
    requiresAgentReasoning: false,
    minRecommendedParamsB: 3,
  },
  {
    id: "question_drafting",
    label: "Application question drafting",
    description: "Draft truthful responses to open-ended employer application questions with source citations.",
    requiresStructuredJson: true,
    requiresAgentReasoning: false,
    minRecommendedParamsB: 3,
  },
  {
    id: "interview_analysis",
    label: "Interview transcript analysis",
    description: "Evaluate STAR structure, answer relevance, technical coverage, and follow-up questions.",
    requiresStructuredJson: true,
    requiresAgentReasoning: false,
    minRecommendedParamsB: 7,
  },
  {
    id: "agent_planning",
    label: "Agent planning",
    description: "Plan permission-controlled multi-step form inspection and preparation actions.",
    requiresStructuredJson: true,
    requiresAgentReasoning: true,
    minRecommendedParamsB: 7,
  },
];

export type TaskModelMap = Partial<Record<AITaskId, string>>;

export interface ModelCapabilityProfile {
  modelId: string;
  isEmbeddingOnly: boolean;
  basicChat: boolean;
  structuredJson: boolean;
  toolCalling: boolean;
  agentPlanning: boolean;
  estimatedParametersBillions: number | null;
  isSmallModel: boolean;
  summaryBadges: string[];
  warnings: string[];
}

/**
 * Parses parameter count in billions from strings like "7B", "1.5b", "qwen2.5:0.5b", "llama3.2:3b", "70B".
 */
export function parseParameterSizeBillions(modelId: string, parameterSize?: string): number | null {
  const combined = `${parameterSize ?? ""} ${modelId}`;
  const m = /(?:^|[:\-_\s])(\d+(?:\.\d+)?)\s*[bB]\b/.exec(combined);
  if (m) {
    const val = Number(m[1]);
    if (Number.isFinite(val) && val > 0) return val;
  }
  const mMillion = /(?:^|[:\-_\s])(\d+)\s*[mM]\b/.exec(combined);
  if (mMillion) {
    const val = Number(mMillion[1]) / 1000;
    if (Number.isFinite(val) && val > 0) return val;
  }
  if (/tinyllama|smollm|nano|micro/i.test(combined)) return 1.1;
  if (/phi-?3-?mini|gemma-?2b/i.test(combined)) return 2.7;
  if (/gpt-4o|claude-3-5-sonnet|claude-sonnet-4|claude-3-opus|gemini-2\.5-pro|gemini-1\.5-pro/i.test(combined)) {
    return 70;
  }
  if (/gpt-4o-mini|claude-3-5-haiku|claude-3-haiku|gemini-2\.5-flash|gemini-2\.0-flash|gemini-1\.5-flash/i.test(combined)) {
    return 14;
  }
  return null;
}

/**
 * Inspects a model ID and optional server-reported ModelInfo to determine capabilities honestly.
 * Never claims an arbitrary small or embedding model supports reliable structured output or agentic workflows.
 */
export function detectModelCapabilities(
  modelId: string,
  details?: ModelInfo | null,
  provider: ProviderId = "ollama",
): ModelCapabilityProfile {
  const clean = modelId.trim();
  if (!clean) {
    return {
      modelId: "",
      isEmbeddingOnly: false,
      basicChat: false,
      structuredJson: false,
      toolCalling: false,
      agentPlanning: false,
      estimatedParametersBillions: null,
      isSmallModel: false,
      summaryBadges: ["No model selected"],
      warnings: ["Select or enter a model ID to inspect its capabilities."],
    };
  }

  const isEmbeddingOnly =
    /embed|nomic-embed|mxbai-embed|bge-|all-minilm|snowflake-arctic-embed/i.test(clean) ||
    Boolean(details?.capabilities?.includes("embedding") && !details?.capabilities?.includes("completion"));

  if (isEmbeddingOnly) {
    return {
      modelId: clean,
      isEmbeddingOnly: true,
      basicChat: false,
      structuredJson: false,
      toolCalling: false,
      agentPlanning: false,
      estimatedParametersBillions: null,
      isSmallModel: true,
      summaryBadges: ["Embedding-Only Model"],
      warnings: [
        `“${clean}” is a text-embedding model and cannot generate chat responses, structured JSON, or agent plans.`,
      ],
    };
  }

  const paramsB = parseParameterSizeBillions(clean, details?.parameterSize);
  const isSmallModel = paramsB !== null && paramsB < 3;
  const isSubSevenB = paramsB !== null && paramsB < 7;
  const isMediumOrLarger = paramsB === null ? !/tiny|mini-1b|0\.5b|1b|1\.5b|2b|3b/i.test(clean) : paramsB >= 7;

  const serverCaps = details?.capabilities ?? [];
  const hasToolsCap =
    serverCaps.includes("tools") ||
    provider === "openai" ||
    provider === "gemini" ||
    provider === "anthropic" ||
    (!isSmallModel && /qwen2\.5|llama3\.[123]|mistral|command-r|gpt-4|claude|gemini/i.test(clean));

  const structuredJson = !isSmallModel;
  const toolCalling = hasToolsCap && !isSmallModel;
  const agentPlanning = isMediumOrLarger && structuredJson && toolCalling && serverCaps.includes("tested_agent_planning");

  const summaryBadges: string[] = ["Basic Chat"];
  if (structuredJson) summaryBadges.push("Structured JSON (estimated)");
  if (toolCalling) summaryBadges.push("Tool Calling (estimated)");
  if (agentPlanning) summaryBadges.push("Agent Planning (tested)");
  if (isSmallModel) summaryBadges.push(`Small Model (${paramsB ?? "<3"}B)`);
  else if (isSubSevenB) summaryBadges.push(`Compact Model (${paramsB}B)`);

  const warnings: string[] = [];
  if (isSmallModel) {
    warnings.push(
      `“${clean}” (${paramsB ? `${paramsB}B parameters` : "small model"}) is suitable for basic chat or short drafts, but is NOT reliable for strict multi-field JSON schemas or multi-step Agent Planning.`,
    );
  } else if (!agentPlanning) {
    warnings.push(
      `“${clean}” has not passed a controlled agent-planning test. Chat or a parameter estimate alone does not establish agent readiness.`,
    );
  }

  return {
    modelId: clean,
    isEmbeddingOnly: false,
    basicChat: true,
    structuredJson,
    toolCalling,
    agentPlanning,
    estimatedParametersBillions: paramsB,
    isSmallModel,
    summaryBadges,
    warnings,
  };
}

export interface TaskSuitabilityResult {
  suitable: boolean;
  effectiveModel: string;
  capability: ModelCapabilityProfile;
  reason?: string;
}

/**
 * Evaluates whether the selected (or task-overridden) model and provider are suitable for a given task.
 */
export function evaluateModelSuitabilityForTask(
  task: AITaskId,
  defaultModel: string,
  taskModels: TaskModelMap = {},
  options?: {
    provider?: ProviderId;
    baseUrl?: string;
    localOnlyMode?: boolean;
    modelDetails?: ModelInfo | null;
  },
): TaskSuitabilityResult {
  const effectiveModel = (taskModels[task]?.trim() || defaultModel.trim());
  const provider = options?.provider ?? "ollama";
  const baseUrl = options?.baseUrl ?? PROVIDERS[provider].defaultBaseUrl;
  const localOnlyMode = Boolean(options?.localOnlyMode);

  const capability = detectModelCapabilities(effectiveModel, options?.modelDetails, provider);
  const spec = AI_TASKS.find((t) => t.id === task) ?? AI_TASKS[0];

  // 1. Check Local-Only mode first
  const ep = validateEndpoint(baseUrl);
  const isLoopback = ep.ok ? ep.isLoopback : PROVIDERS[provider].local;
  if (localOnlyMode && !isLoopback) {
    return {
      suitable: false,
      effectiveModel,
      capability,
      reason:
        "Blocked by Local Only Mode: career data is restricted to local loopback servers (127.0.0.1 / localhost) and will never be sent to a cloud provider.",
    };
  }

  if (!effectiveModel) {
    return {
      suitable: false,
      effectiveModel: "",
      capability,
      reason: `Select a default model or a task override for “${spec.label}”.`,
    };
  }

  if (capability.isEmbeddingOnly) {
    return {
      suitable: false,
      effectiveModel,
      capability,
      reason: capability.warnings[0],
    };
  }

  if (spec.requiresAgentReasoning && !capability.agentPlanning) {
    return {
      suitable: false,
      effectiveModel,
      capability,
      reason: `“${effectiveModel}” has not passed controlled structured-output and tool-planning checks. Agent planning remains unavailable for this model.`,
    };
  }

  if (spec.requiresStructuredJson && !capability.structuredJson) {
    return {
      suitable: false,
      effectiveModel,
      capability,
      reason: `“${effectiveModel}” (${capability.estimatedParametersBillions ?? "<3"}B) is too small for reliable structured JSON in ${spec.label}. Choose a ≥3B model (≥7B recommended) so JSON schemas and factual constraints are followed.`,
    };
  }

  return {
    suitable: true,
    effectiveModel,
    capability,
    reason: capability.warnings[0],
  };
}

export type CloudCredentialMode =
  | "local_keyless"
  | "companion_proxy"
  | "session_memory_key"
  | "setup_required";

export interface CloudCredentialStatus {
  mode: CloudCredentialMode;
  ready: boolean;
  badgeLabel: string;
  explanation: string;
}

/**
 * Evaluates cloud credential security state without ever exposing or logging the raw key.
 */
export function evaluateCloudCredentialStatus(
  provider: ProviderId,
  baseUrl: string,
  hasInMemoryKey: boolean,
  localOnlyMode = false,
): CloudCredentialStatus {
  const preset = PROVIDERS[provider];
  const ep = validateEndpoint(baseUrl);
  const isLoopback = ep.ok ? ep.isLoopback : preset.local;

  if (localOnlyMode && !isLoopback) {
    return {
      mode: "setup_required",
      ready: false,
      badgeLabel: "Blocked (Local Only Mode)",
      explanation:
        "Local Only Mode is active. Cloud providers are disabled so zero career data leaves your device.",
    };
  }

  // 1. Native local providers on loopback
  if (preset.local && isLoopback) {
    return {
      mode: "local_keyless",
      ready: true,
      badgeLabel: "Local Loopback (Keyless)",
      explanation:
        "Connects directly to your local server on 127.0.0.1/localhost without cloud API keys.",
    };
  }

  // No authenticated companion or backend is implemented. A loopback URL or an in-memory
  // key alone does not prove secure credential storage or authenticated transport.
  void hasInMemoryKey;
  return {
    mode: "setup_required",
    ready: false,
    badgeLabel: "Setup Required (Cloud Credential)",
    explanation:
      "Cloud AI is unavailable until an authenticated backend or local companion with OS credential storage is implemented and verified. No cloud request will be sent.",
  };
}
