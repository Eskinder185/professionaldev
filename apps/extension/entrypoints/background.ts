import { handleExtensionMessage } from "../src/messaging/protocol";
import { loadExtensionState } from "../src/storage/stateStore";
import type { AutoApplyMessage } from "../../../packages/careeros-shared/types";
import { handleCareerosEvent, initAssistLifecycle, isCareerosEvent } from "../src/page-intelligence/assistLifecycle";

declare const chrome: {
  runtime: {
    id?: string;
    onInstalled?: { addListener: (cb: () => void) => void };
    onMessage: {
      addListener: (
        cb: (
          message: unknown,
          sender: { url?: string; origin?: string; id?: string; tab?: { id?: number; url?: string } },
          sendResponse: (res: unknown) => void,
        ) => boolean | void,
      ) => void;
    };
    onMessageExternal?: {
      addListener: (
        cb: (
          message: unknown,
          sender: { url?: string; origin?: string; id?: string; tab?: { id?: number; url?: string } },
          sendResponse: (res: unknown) => void,
        ) => boolean | void,
      ) => void;
    };
  };
  tabs?: {
    query: (
      queryInfo: { active?: boolean; currentWindow?: boolean },
      cb: (tabs: Array<{ id?: number; url?: string }>) => void,
    ) => void;
    sendMessage: (
      tabId: number,
      message: unknown,
      cb: (response: unknown) => void,
    ) => void;
  };
  sidePanel?: {
    setPanelBehavior?: (options: { openPanelOnActionClick: boolean }) => Promise<void>;
  };
};

async function forwardToActiveTabIfNeeded(rawMessage: unknown): Promise<unknown | null> {
  if (!rawMessage || typeof rawMessage !== "object") return null;
  const msg = rawMessage as Partial<AutoApplyMessage> & {
    payload?: Record<string, unknown>;
  };
  if (
    msg.action !== "INSPECT_CURRENT_FORM" &&
    msg.action !== "EXECUTE_AUTOFILL" &&
    msg.action !== "CONFIRM_SUBMISSION"
  ) {
    return null;
  }
  if (!msg.payload?.forwardToActiveTab || typeof chrome === "undefined" || !chrome.tabs) {
    return null;
  }

  const state = await loadExtensionState();
  const activeApp =
    state.queue.find((q) => q.id === state.activeApplicationId) ?? state.queue[0] ?? null;

  return new Promise((resolve) => {
    chrome.tabs!.query({ active: true, currentWindow: true }, (tabs) => {
      const activeTab = tabs?.[0];
      if (!activeTab?.id) {
        resolve(null);
        return;
      }
      chrome.tabs!.sendMessage(
        activeTab.id,
        {
          ...msg,
          payload: {
            ...msg.payload,
            forwardToActiveTab: false,
            sharedProfile: state.sharedProfile,
            activeApplication: activeApp,
          },
        },
        (tabRes) => {
          resolve(tabRes ?? null);
        },
      );
    });
  });
}

export function initBackgroundServiceWorker(): void {
  if (typeof chrome === "undefined" || !chrome.runtime) return;

  // Reconciles approved sites with Chrome's real permissions every time the worker starts, and
  // shuts page scripts down when a site's access is removed.
  const lifecycle = initAssistLifecycle();

  if (chrome.sidePanel?.setPanelBehavior) {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch(() => {
      // ignore if browser does not support sidePanel behavior
    });
  }

  const listener = (
    message: unknown,
    sender: { url?: string; origin?: string; id?: string; tab?: { id?: number; url?: string } },
    sendResponse: (res: unknown) => void,
  ) => {
    // Internal = one of this extension's own pages (popup, side panel, options). Content scripts
    // also carry our id but their sender.url is the web page, so they can never match.
    const isInternal = Boolean(
      sender.id &&
        chrome.runtime.id &&
        sender.id === chrome.runtime.id &&
        sender.url?.startsWith(`chrome-extension://${chrome.runtime.id}/`),
    );
    const senderUrl = sender.url ?? sender.tab?.url;

    // Light-weight notices from page scripts (not protocol messages). No reply is needed.
    if (isCareerosEvent(message)) {
      if (lifecycle) void handleCareerosEvent(message, sender, lifecycle).catch(() => undefined);
      return;
    }

    (async () => {
      const forwarded = await forwardToActiveTabIfNeeded(message);
      if (
        forwarded &&
        typeof forwarded === "object" &&
        "payload" in (forwarded as Record<string, unknown>)
      ) {
        const merged = {
          ...(message as Record<string, unknown>),
          payload: (forwarded as { payload: unknown }).payload,
        };
        const res = await handleExtensionMessage(merged, {
          url: senderUrl,
          origin: sender.origin,
          id: sender.id,
          isInternalExtensionPage: isInternal,
        });
        sendResponse(res);
        return;
      }

      const response = await handleExtensionMessage(message, {
        url: senderUrl,
        origin: sender.origin,
        id: sender.id,
        isInternalExtensionPage: isInternal,
      });
      sendResponse(response);
    })();

    return true;
  };

  chrome.runtime.onMessage.addListener(listener);
  if (chrome.runtime.onMessageExternal) {
    chrome.runtime.onMessageExternal.addListener(listener);
  }
}

initBackgroundServiceWorker();
