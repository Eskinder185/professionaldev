import { adapterFor, PROVIDERS, type ProviderId } from "../../../../../src/features/ai/providers";
import { isLoopbackHost, validateEndpoint } from "../../../../../src/features/ai/endpoint";
import { findFabricatedNumbers } from "../../../../../src/features/ai/structured";
import { effectiveExtensionModel, LOCAL_PROVIDERS } from "../../../src/ai/localConnection";
import type {
  AIConnectionSnapshot,
  JobPageInfo,
  ResumeAnalysisSnapshot,
  SharedProfileSubset,
} from "../../../../../packages/careeros-shared/types";

export type AIAvailability =
  | { kind: "none"; reason: string }
  | { kind: "needs-careeros"; reason: string; snapshot: AIConnectionSnapshot }
  | { kind: "ready"; snapshot: AIConnectionSnapshot; host: string };

/**
 * The extension only ever calls a model that needs no secret and is on this device. Keys stay in
 * CareerOS (memory only), so a keyed or cloud endpoint is reported but never called from here.
 */
export function aiAvailability(snapshot: AIConnectionSnapshot | null): AIAvailability {
  if (!snapshot) return { kind: "none", reason: "No AI connection selected. Open the AI tab to connect a local model." };
  if (!snapshot.connected) return { kind: "none", reason: "The AI connection has not been checked. Open the AI tab to test it." };
  if (!snapshot.model) return { kind: "none", reason: "No model is selected in CareerOS." };
  const ep = validateEndpoint(snapshot.baseUrl);
  if (!ep.ok) return { kind: "none", reason: "The saved AI endpoint is not valid." };
  const host = new URL(ep.baseUrl).hostname;
  if (!snapshot.keyless || !isLoopbackHost(host) || !snapshot.isLocal || !LOCAL_PROVIDERS.includes(snapshot.provider as ProviderId)) {
    return {
      kind: "needs-careeros",
      snapshot,
      reason: snapshot.isLocal
        ? "This connection uses an API key, which only CareerOS holds. Draft in CareerOS instead."
        : "This connection is not on this device. Drafting stays in CareerOS so you control what leaves it.",
    };
  }
  return { kind: "ready", snapshot, host };
}

export function aiLabel(snapshot: AIConnectionSnapshot | null): string {
  if (!snapshot) return "AI: not shared";
  const where = snapshot.isLocal ? "Local" : "Remote";
  return `AI: ${where} · ${snapshot.model || snapshot.providerLabel}${snapshot.connected ? "" : " (not connected)"}`;
}

export interface CoverLetterInput {
  job: JobPageInfo | null;
  profile: SharedProfileSubset;
  analysis: ResumeAnalysisSnapshot | null;
}

/** Everything the model is allowed to know. Shown to the user before anything is sent. */
export function buildCoverLetterContext(input: CoverLetterInput): { prompt: string; grounding: string; preview: string } {
  const v = input.profile.values;
  const name = v.fullName || [v.firstName, v.lastName].filter(Boolean).join(" ");
  const roles = (input.profile.experience ?? [])
    .slice(0, 3)
    .map((e) => `${e.title} at ${e.employer}: ${e.bullets.slice(0, 3).join(" ")}`)
    .join("\n");
  const skills = (input.profile.skills ?? []).slice(0, 25).join(", ");
  const supported = (input.analysis?.requirements ?? [])
    .filter((r) => r.group === "matched")
    .map((r) => r.name)
    .slice(0, 12)
    .join(", ");
  const grounding = [name, v.headline, roles, skills, supported, input.job?.title, input.job?.company].filter(Boolean).join("\n");
  const prompt = [
    "Write a concise cover letter (under 220 words) for the job below.",
    "Use ONLY the facts listed under APPLICANT FACTS. Do not invent employers, titles, dates, numbers, certifications or skills.",
    "If something is not in the facts, leave it out. Plain text, no markdown, no placeholders other than [Hiring Manager].",
    "",
    `JOB: ${input.job?.title ?? "(title unknown)"} at ${input.job?.company ?? "(company unknown)"}`,
    "",
    "APPLICANT FACTS:",
    name ? `Name: ${name}` : "",
    v.headline ? `Headline: ${v.headline}` : "",
    roles ? `Experience:\n${roles}` : "",
    skills ? `Skills: ${skills}` : "",
    supported ? `Requirements supported by the résumé: ${supported}` : "",
  ]
    .filter(Boolean)
    .join("\n");
  return { prompt, grounding, preview: prompt };
}

export async function draftCoverLetter(
  availability: Extract<AIAvailability, { kind: "ready" }>,
  prompt: string,
  grounding: string,
  signal?: AbortSignal,
): Promise<{ text: string; warnings: string[] }> {
  const s = availability.snapshot;
  const provider = (s.provider in PROVIDERS ? s.provider : "custom") as ProviderId;
  const preset = PROVIDERS[provider];
  const adapter = adapterFor(provider);
  const result = await adapter.chat(
    { baseUrl: s.baseUrl, model: effectiveExtensionModel(s, "cover_letter"), apiKey: "", structured: preset.structured },
    [
      { role: "system", content: "You write honest, grounded cover letters. You never fabricate facts." },
      { role: "user", content: prompt },
    ],
    { signal },
  );
  const text = result.text.trim();
  const warnings: string[] = [];
  const fabricated = findFabricatedNumbers(grounding, text);
  if (fabricated.length) warnings.push(`Numbers not found in your profile: ${[...new Set(fabricated)].join(", ")}. Remove or verify them.`);
  if (/\[(?!Hiring Manager)[^\]]+\]/.test(text)) warnings.push("The draft contains bracketed placeholders to fill in.");
  return { text, warnings };
}
