import { handleExtensionMessage } from "../../../apps/extension/src/messaging/protocol";
import { runFormActionOnDocument } from "../../../apps/extension/entrypoints/content";
import { loadExtensionState } from "../../../apps/extension/src/storage/stateStore";
import { uid } from "../resume/model/defaults";
import type {
  AutoApplyMessage,
  AutoApplyQueueItem,
  AutoApplyResponse,
  ExtensionCapabilities,
  MessageAction,
  SharedProfileSubset,
} from "../../../packages/careeros-shared/types";

declare const chrome: {
  runtime?: {
    sendMessage?: (
      extIdOrMsg: string | unknown,
      msgOrCb?: unknown,
       maybeCb?: (res: unknown) => void,
    ) => void;
  };
};

export interface ExtensionConnectionState {
  connected: boolean;
  transport: "chrome-external" | "content-bridge" | "local-protocol" | "disconnected";
  extensionId: string;
  capabilities: ExtensionCapabilities | null;
  lastHandshakeAt: string | null;
  error: string | null;
}

/**
 * True only when the installed CareerOS extension's content script is running in this page.
 * The in-page practice handler (used by the sandbox and tests) does not count.
 */
export function isRealExtensionPresent(): boolean {
  return typeof document !== "undefined" && document.documentElement.getAttribute("data-careeros-extension-runtime") === "true";
}

/** A transport that reaches the real extension, as opposed to the in-page practice handler. */
export const isExtensionTransport = (transport: ExtensionConnectionState["transport"]) => transport === "chrome-external" || transport === "content-bridge";

export function createAutoApplyMessage<T>(
  action: MessageAction,
  payload: T,
  originOverride?: string,
): AutoApplyMessage<T> {
  const currentOrigin =
    originOverride ??
    (typeof window !== "undefined" ? window.location.href : "http://localhost/professionaldev/autoapply");
  return {
    protocol: "careeros-autoapply",
    version: "1.0",
    requestId: `req-${uid()}`,
    action,
    origin: currentOrigin,
    timestamp: new Date().toISOString(),
    payload,
  };
}

/**
 * Sends a versioned message from CareerOS website to the CareerOS AutoApply extension.
 * Tries:
 * 1) chrome.runtime.sendMessage(extensionId, msg) if extensionId is provided
 * 2) window.postMessage content-script bridge if data-careeros-extension-installed is present
 * 3) Validated local protocol handler (ensuring origin & schema validation always run)
 */
export async function sendExtensionMessage<TPayload = unknown, TRes = unknown>(
  action: MessageAction,
  payload: TPayload,
  options?: { extensionId?: string; senderUrlOverride?: string },
): Promise<{ response: AutoApplyResponse<TRes>; transport: ExtensionConnectionState["transport"] }> {
  const senderUrl =
    options?.senderUrlOverride ??
    (typeof window !== "undefined"
      ? window.location.href
      : "http://localhost/professionaldev/autoapply");

  const message = createAutoApplyMessage(action, payload, senderUrl);

  // 1. Try explicit chrome.runtime.sendMessage(extensionId, message)
  if (
    options?.extensionId &&
    typeof chrome !== "undefined" &&
    typeof chrome.runtime?.sendMessage === "function"
  ) {
    const extRes = await new Promise<AutoApplyResponse<TRes> | null>((resolve) => {
      try {
        chrome.runtime!.sendMessage!(options.extensionId!, message, (res) => {
          if (res && typeof res === "object" && "ok" in (res as Record<string, unknown>)) {
            resolve(res as AutoApplyResponse<TRes>);
          } else {
            resolve(null);
          }
        });
      } catch {
        resolve(null);
      }
    });
    if (extRes) {
      return { response: extRes, transport: "chrome-external" };
    }
  }

  // 2. Try content-script postMessage bridge if extension content script is injected on this page
  if (
    typeof window !== "undefined" &&
    typeof document !== "undefined" &&
    document.documentElement.getAttribute("data-careeros-extension-installed")
  ) {
    const bridgeRes = await new Promise<AutoApplyResponse<TRes> | null>((resolve) => {
      const timeout = setTimeout(() => {
        window.removeEventListener("message", onMsg);
        resolve(null);
      }, 1200);

      function onMsg(event: MessageEvent) {
        if (event.source !== window) return;
        const data = event.data as
          | {
              channel?: string;
              requestId?: string;
              response?: AutoApplyResponse<TRes>;
            }
          | undefined;
        if (data?.channel === "CAREEROS_AUTOAPPLY_RES" && data.requestId === message.requestId) {
          clearTimeout(timeout);
          window.removeEventListener("message", onMsg);
          resolve(data.response ?? null);
        }
      }

      window.addEventListener("message", onMsg);
      window.postMessage(
        {
          channel: "CAREEROS_AUTOAPPLY_REQ",
          message,
        },
        window.location.origin,
      );
    });

    if (bridgeRes) {
      return { response: bridgeRes, transport: isRealExtensionPresent() ? "content-bridge" : "local-protocol" };
    }
  }

  // 3. Execute against the extension protocol handler directly (used in local workspace & E2E harness)
  if (
    typeof document !== "undefined" &&
    (action === "INSPECT_CURRENT_FORM" ||
      action === "EXECUTE_AUTOFILL" ||
      action === "CONFIRM_SUBMISSION")
  ) {
    const state = await loadExtensionState();
    const p = (payload ?? {}) as {
      sharedProfile?: SharedProfileSubset | null;
      activeApplication?: AutoApplyQueueItem | null;
      approvedFieldIds?: string[];
      overrideValues?: Record<string, string>;
      applicationId?: string;
    };
    const activeApp =
      p.activeApplication ??
      state.queue.find((q) => q.id === (p.applicationId ?? state.activeApplicationId)) ??
      state.queue[0] ??
      null;
    const domResult = runFormActionOnDocument(
      action,
      document,
      senderUrl,
      p.sharedProfile ?? state.sharedProfile,
      activeApp,
      p.approvedFieldIds,
      p.overrideValues,
    );
    const enrichedMessage = createAutoApplyMessage(
      action,
      {
        ...p,
        url: senderUrl,
        platform: domResult.platform,
        supportLevel: domResult.supportLevel,
        pageStage: domResult.pageStage,
        detectedFields: domResult.detectedFields,
        confirmed: domResult.confirmed,
        confirmationText: domResult.confirmationText,
      },
      senderUrl,
    );
    const res = (await handleExtensionMessage(enrichedMessage, {
      url: senderUrl,
    })) as AutoApplyResponse<TRes>;
    return { response: res, transport: "local-protocol" };
  }

  const res = (await handleExtensionMessage(message, {
    url: senderUrl,
  })) as AutoApplyResponse<TRes>;
  return { response: res, transport: "local-protocol" };
}

/**
 * Exports a portable JSON bundle for manual fallback transfer between CareerOS and the Extension.
 */
export function exportAutoApplyBundleJson(
  queue: AutoApplyQueueItem[],
  sharedProfile: SharedProfileSubset,
): string {
  return JSON.stringify(
    {
      protocol: "careeros-autoapply",
      version: "1.0",
      exportedAt: new Date().toISOString(),
      sharedProfile,
      queue,
    },
    null,
    2,
  );
}

/**
 * Validates and imports a portable JSON bundle.
 */
export function importAutoApplyBundleJson(rawJson: string): {
  ok: boolean;
  queue?: AutoApplyQueueItem[];
  sharedProfile?: SharedProfileSubset;
  error?: string;
} {
  try {
    const parsed = JSON.parse(rawJson) as {
      protocol?: string;
      version?: string;
      queue?: AutoApplyQueueItem[];
      sharedProfile?: SharedProfileSubset;
    };
    if (parsed.protocol !== "careeros-autoapply" || parsed.version !== "1.0") {
      return { ok: false, error: "Invalid AutoApply bundle protocol or version." };
    }
    return {
      ok: true,
      queue: Array.isArray(parsed.queue) ? parsed.queue : [],
      sharedProfile: parsed.sharedProfile,
    };
  } catch {
    return { ok: false, error: "Malformed JSON in AutoApply bundle." };
  }
}
