import { selectPlatformAdapter } from "../src/adapters";
import { handleExtensionMessage } from "../src/messaging/protocol";
import { detectPageContext } from "../src/detect/pageContext";
import { deepQuery } from "../../../packages/careeros-shared/dom/deepQuery";
import { createPageObserver, type PageObserver } from "../src/page-intelligence/pageObserver";
import { validateSenderOrigin } from "../../../packages/careeros-shared/schemas";
import type {
  AutoApplyMessage,
  AutoApplyQueueItem,
  DetectedField,
  PageStage,
  SharedProfileSubset,
} from "../../../packages/careeros-shared/types";

declare const chrome: {
  runtime?: {
    id?: string;
    sendMessage?: (message: unknown, cb?: (response: unknown) => void) => void;
    onMessage?: {
      addListener: (
        cb: (
          message: unknown,
          sender: unknown,
          sendResponse: (res: unknown) => void,
        ) => boolean | void,
      ) => void;
    };
  };
};

function sendToBackground(message: AutoApplyMessage): Promise<unknown> {
  return new Promise((resolve) => {
    if (typeof chrome !== "undefined" && chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage(message, (res) => {
        if (res && typeof res === "object" && "ok" in (res as Record<string, unknown>)) {
          resolve(res);
        } else {
          handleExtensionMessage(message, {
            url: typeof window !== "undefined" ? window.location.href : message.origin,
          }).then(resolve);
        }
      });
    } else {
      handleExtensionMessage(message, {
        url: typeof window !== "undefined" ? window.location.href : message.origin,
      }).then(resolve);
    }
  });
}

function defaultEmptyProfile(): SharedProfileSubset {
  return {
    approvedAt: new Date().toISOString(),
    sharedFields: [],
    values: {},
  };
}

export function runFormActionOnDocument(
  action: "INSPECT_CURRENT_FORM" | "EXECUTE_AUTOFILL" | "CONFIRM_SUBMISSION",
  doc: Document,
  urlStr: string,
  profile: SharedProfileSubset | null,
  activeApp: AutoApplyQueueItem | null,
  approvedFieldIds?: string[],
  overrideValues?: Record<string, string>,
  onlyFieldIds?: string[],
): {
  platform: string;
  supportLevel: string;
  pageStage: PageStage;
  detectedFields: DetectedField[];
  confirmed: boolean;
  confirmationText?: string;
} {
  const adapter = selectPlatformAdapter(urlStr, doc);
  const effectiveProfile: SharedProfileSubset = profile ?? defaultEmptyProfile();

  // Merge prepared questions from activeApp into effectiveProfile.preparedAnswers if present
  if (activeApp?.preparedQuestions?.length) {
    const map: NonNullable<SharedProfileSubset["preparedAnswers"]> = {
      ...(effectiveProfile.preparedAnswers ?? {}),
    };
    for (const q of activeApp.preparedQuestions) {
      map[q.id] = {
        question: q.question,
        answer: q.draftAnswer,
        evidence: q.evidence,
        approved: q.approved,
      };
    }
    effectiveProfile.preparedAnswers = map;
  }

  if (action === "INSPECT_CURRENT_FORM") {
    const fields = adapter.discover(doc, effectiveProfile);
    const conf = adapter.detectConfirmation(doc);
    const stage: PageStage = conf.confirmed
      ? "completion_confirmed"
      : fields.length > 0
        ? "fields_identified"
        : "page_detected";
    return {
      platform: adapter.id,
      supportLevel: adapter.supportLevel,
      pageStage: stage,
      detectedFields: fields,
      confirmed: conf.confirmed,
      confirmationText: conf.text,
    };
  }

  if (action === "EXECUTE_AUTOFILL") {
    const report = adapter.autofill(doc, effectiveProfile, {
      approvedFieldIds,
      overrideValues,
      onlyFieldIds,
    });
    return {
      platform: adapter.id,
      supportLevel: adapter.supportLevel,
      pageStage: report.pageStage,
      detectedFields: report.fields,
      confirmed: false,
    };
  }

  // CONFIRM_SUBMISSION
  const conf = adapter.detectConfirmation(doc);
  const fields = adapter.discover(doc, effectiveProfile);
  return {
    platform: adapter.id,
    supportLevel: adapter.supportLevel,
    pageStage: conf.confirmed ? "completion_confirmed" : "user_review_required",
    detectedFields: fields,
    confirmed: conf.confirmed,
    confirmationText: conf.text,
  };
}

const HIGHLIGHT_ATTR = "data-careeros-highlight";
const HIGHLIGHT_COLORS: Record<string, string> = {
  filled: "#16a34a",
  confirm: "#d97706",
  missing: "#dc2626",
  failed: "#dc2626",
  manual: "#7c3aed",
  file: "#d97706",
  unsupported: "#64748b",
};

/** Outlines fields on the page for the user's review. Purely visual; values are never changed. */
export function highlightFields(
  doc: Document,
  items: Array<{ selector: string; status: string }>,
): number {
  doc.querySelectorAll<HTMLElement>(`[${HIGHLIGHT_ATTR}]`).forEach((el) => {
    el.style.outline = "";
    el.style.outlineOffset = "";
    el.removeAttribute(HIGHLIGHT_ATTR);
  });
  let count = 0;
  let first: HTMLElement | null = null;
  for (const item of items.slice(0, 200)) {
    let el: HTMLElement | null;
    try {
      el = deepQuery<HTMLElement>(doc, item.selector);
    } catch {
      el = null;
    }
    if (!el) continue;
    el.style.outline = `2px solid ${HIGHLIGHT_COLORS[item.status] ?? "#64748b"}`;
    el.style.outlineOffset = "2px";
    el.setAttribute(HIGHLIGHT_ATTR, item.status);
    count += 1;
    if (!first && item.status !== "filled") first = el;
  }
  first?.scrollIntoView({ block: "center", behavior: "smooth" });
  return count;
}

/**
 * Keep the extension's appearance in step with the CareerOS website. The site records the person's
 * choice (light, dark, or system) on <html data-theme-preference>; we copy it to extension storage.
 */
function mirrorSiteAppearance(): void {
  const storage = (globalThis as unknown as { chrome?: { storage?: { local?: { set: (items: Record<string, unknown>) => Promise<void> } } } }).chrome?.storage?.local;
  if (!storage) return;
  let last = "";
  const copy = () => {
    const preference = document.documentElement.getAttribute("data-theme-preference") ?? "";
    if (preference === last || !["light", "dark", "system"].includes(preference)) return;
    last = preference;
    void storage.set({ "careeros:theme": preference }).catch(() => undefined);
  };
  copy();
  new MutationObserver(copy).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme-preference"] });
}

/** Set when ongoing access is removed: the page script stops answering and watching. */
let deactivated = false;
let pageObserver: PageObserver | null = null;

function deactivate(): void {
  deactivated = true;
  pageObserver?.stop();
  pageObserver = null;
  try {
    highlightFields(document, []);
  } catch {
    // The page may already be gone.
  }
}

/** Announce this page to the extension and watch it for form changes (throttled; never polls). */
function startPageAssist(): void {
  const tell = (event: Record<string, unknown>) => {
    try {
      chrome.runtime!.sendMessage!({ ...event, url: window.location.href }, () => void (chrome.runtime as { lastError?: unknown } | undefined)?.lastError);
    } catch {
      // The extension may have been reloaded.
    }
  };
  tell({ careerosEvent: "HELLO" });
  pageObserver = createPageObserver({
    doc: document,
    win: window,
    onChange: (reason) => {
      if (!deactivated) tell({ careerosEvent: "PAGE_CHANGED", reason });
    },
  });
  pageObserver.start();
}

export function initContentScript(): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  // The script can be injected more than once (installed hosts, a granted site, and a one-time
  // injection from the toolbar). Only the first run installs listeners and observers.
  const flag = "__careerosContentScriptLoaded";
  if ((window as unknown as Record<string, unknown>)[flag]) return;
  (window as unknown as Record<string, unknown>)[flag] = true;

  const originCheck = validateSenderOrigin(window.location.href);
  if (originCheck.ok) {
    document.documentElement.setAttribute("data-careeros-extension-installed", "1.0.0");
    // Only a real extension context has a runtime id. The website also bundles this
    // module for its practice sandbox, and must not report that as an installed extension.
    if (typeof chrome !== "undefined" && chrome.runtime?.id) {
      document.documentElement.setAttribute("data-careeros-extension-runtime", "true");
      mirrorSiteAppearance();
    }

    window.addEventListener("message", (event: MessageEvent) => {
      if (event.source !== window) return;
      const data = event.data as
        | {
            channel?: string;
            message?: AutoApplyMessage;
          }
        | undefined;
      if (!data || data.channel !== "CAREEROS_AUTOAPPLY_REQ" || !data.message) return;

      const recheck = validateSenderOrigin(window.location.href);
      if (!recheck.ok) return;

      const reqMsg = data.message;

      if (
        reqMsg.action === "INSPECT_CURRENT_FORM" ||
        reqMsg.action === "EXECUTE_AUTOFILL" ||
        reqMsg.action === "CONFIRM_SUBMISSION"
      ) {
        const payload = (reqMsg.payload ?? {}) as {
          sharedProfile?: SharedProfileSubset | null;
          activeApplication?: AutoApplyQueueItem | null;
          approvedFieldIds?: string[];
          overrideValues?: Record<string, string>;
          applicationId?: string;
        };
        const formResult = runFormActionOnDocument(
          reqMsg.action,
          document,
          window.location.href,
          payload.sharedProfile ?? null,
          payload.activeApplication ?? null,
          payload.approvedFieldIds,
          payload.overrideValues,
        );
        const enrichedMsg: AutoApplyMessage = {
          ...reqMsg,
          payload: {
            ...payload,
            url: window.location.href,
            platform: formResult.platform,
            supportLevel: formResult.supportLevel,
            pageStage: formResult.pageStage,
            detectedFields: formResult.detectedFields,
            confirmed: formResult.confirmed,
            confirmationText: formResult.confirmationText,
          },
        };
        sendToBackground(enrichedMsg).then((response) => {
          window.postMessage(
            {
              channel: "CAREEROS_AUTOAPPLY_RES",
              requestId: reqMsg.requestId,
              response,
            },
            window.location.origin,
          );
        });
        return;
      }

      sendToBackground(reqMsg).then((response) => {
        window.postMessage(
          {
            channel: "CAREEROS_AUTOAPPLY_RES",
            requestId: reqMsg.requestId,
            response,
          },
          window.location.origin,
        );
      });
    });
  }

  // Handle messages sent from the extension background/popup/sidepanel to this tab
  if (typeof chrome !== "undefined" && chrome.runtime?.onMessage) {
    chrome.runtime.onMessage.addListener((rawMessage, sender, sendResponse) => {
      if (!rawMessage || typeof rawMessage !== "object") return;
      // Only this extension's own pages may drive the content script.
      const senderId = (sender as { id?: string } | undefined)?.id;
      if (chrome.runtime?.id && senderId !== chrome.runtime.id) return;

      const ctxMsg = rawMessage as {
        careerosRequest?: string;
        payload?: {
          sharedProfile?: SharedProfileSubset | null;
          activeApplication?: AutoApplyQueueItem | null;
        };
      };
      const hl = rawMessage as { careerosRequest?: string; payload?: { items?: Array<{ selector: string; status: string }> } };
      if (hl.careerosRequest === "DEACTIVATE") {
        deactivate();
        sendResponse({ ok: true });
        return true;
      }
      // After access is revoked this page no longer answers requests from the extension.
      const requested = hl.careerosRequest ?? (rawMessage as { action?: string }).action;
      if (deactivated && requested) {
        sendResponse({ ok: false, error: "ACCESS_REVOKED" });
        return true;
      }
      if (hl.careerosRequest === "HIGHLIGHT_FIELDS") {
        const n = highlightFields(document, Array.isArray(hl.payload?.items) ? hl.payload!.items! : []);
        sendResponse({ ok: true, highlighted: n });
        return true;
      }
      if (ctxMsg.careerosRequest === "GET_PAGE_CONTEXT") {
        try {
          const context = detectPageContext(
            document,
            window.location.href,
            ctxMsg.payload?.sharedProfile ?? null,
            ctxMsg.payload?.activeApplication ?? null,
          );
          sendResponse({ ok: true, context });
        } catch (err) {
          sendResponse({ ok: false, error: err instanceof Error ? err.message : "Detection failed" });
        }
        return true;
      }
      const msg = rawMessage as Partial<AutoApplyMessage> & {
        payload?: {
          sharedProfile?: SharedProfileSubset | null;
          activeApplication?: AutoApplyQueueItem | null;
          approvedFieldIds?: string[];
          overrideValues?: Record<string, string>;
          onlyFieldIds?: string[];
          applicationId?: string;
        };
      };
      if (
        msg.action === "INSPECT_CURRENT_FORM" ||
        msg.action === "EXECUTE_AUTOFILL" ||
        msg.action === "CONFIRM_SUBMISSION"
      ) {
        const result = runFormActionOnDocument(
          msg.action,
          document,
          window.location.href,
          msg.payload?.sharedProfile ?? null,
          msg.payload?.activeApplication ?? null,
          msg.payload?.approvedFieldIds,
          msg.payload?.overrideValues,
          msg.payload?.onlyFieldIds,
        );
        sendResponse({
          ok: true,
          payload: {
            applicationId: msg.payload?.applicationId ?? msg.payload?.activeApplication?.id,
            url: window.location.href,
            platform: result.platform,
            supportLevel: result.supportLevel,
            pageStage: result.pageStage,
            detectedFields: result.detectedFields,
            confirmed: result.confirmed,
            confirmationText: result.confirmationText,
          },
        });
        return true;
      }
    });
    if (chrome.runtime?.id) startPageAssist();
  }
}

initContentScript();
