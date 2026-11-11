import { isConnected, type ConnectionState } from "./connectionState";
import { validateEndpoint } from "./endpoint";
import { PROVIDERS } from "./providers";

export type ChipTone = "success" | "warning" | "danger" | "info" | "neutral";

export interface HomeAIView {
  /** A provider and model have been chosen (saved or live). */
  configured: boolean;
  providerLabel: string;
  model: string;
  location: "On this computer" | "Cloud";
  chip: { tone: ChipTone; text: string; busy?: boolean };
  /** A real reply has come back from this model in this session. */
  ready: boolean;
}

/** "Ollama (local)" becomes "Ollama". */
export const plainProviderName = (label: string) => label.replace(/\s*\((local|cloud)\)\s*$/i, "");

/**
 * What the home screen may say about the AI connection.
 *
 * "Ready" is claimed only when the model has actually replied during this session. A merely
 * saved setting says "Not checked yet"; a server that answered the model list but has not
 * generated anything says it was found and still needs a test.
 */
export function describeHomeAI(state: ConnectionState): HomeAIView {
  const preset = PROVIDERS[state.provider];
  const endpoint = validateEndpoint(state.baseUrl);
  const isLocal = endpoint.ok ? endpoint.isLoopback : preset.local;
  const base = {
    configured: state.model.trim() !== "",
    providerLabel: plainProviderName(preset.label),
    model: state.model.trim(),
    location: (isLocal ? "On this computer" : "Cloud") as HomeAIView["location"],
  };

  if (state.status.kind === "testing") return { ...base, ready: false, chip: { tone: "info", text: "Checking…", busy: true } };
  if (state.status.kind === "error") return { ...base, ready: false, chip: { tone: "danger", text: "Not responding" } };
  if (isConnected(state) && state.inference) return { ...base, ready: true, chip: { tone: "success", text: "Ready" } };
  if (isConnected(state)) return { ...base, ready: false, chip: { tone: "info", text: "Found, not tested yet" } };
  return { ...base, ready: false, chip: { tone: "neutral", text: "Not checked yet" } };
}
