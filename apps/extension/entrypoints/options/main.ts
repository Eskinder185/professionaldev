import { handleExtensionMessage } from "../../src/messaging/protocol";
import { getExtensionCapabilities, SECURITY_DISCLOSURES } from "../../src/security/permissions";
import { loadExtensionState, saveExtensionState } from "../../src/storage/stateStore";
import { getThemePreference, initTheme, isThemePreference, setThemePreference } from "../../src/theme";
import type { AutoApplyMessage, AutoApplyResponse } from "../../../../packages/careeros-shared/types";

declare const chrome: {
  runtime?: {
    sendMessage?: (msg: unknown, cb: (res: unknown) => void) => void;
  };
};

async function dispatchExtensionMessage(msg: AutoApplyMessage): Promise<AutoApplyResponse> {
  if (typeof chrome !== "undefined" && chrome.runtime?.sendMessage) {
    return new Promise((resolve) => {
      chrome.runtime!.sendMessage!(msg, (res) => {
        if (res && typeof res === "object" && "ok" in (res as Record<string, unknown>)) {
          resolve(res as AutoApplyResponse);
        } else {
          handleExtensionMessage(msg, { isInternalExtensionPage: true }).then(resolve);
        }
      });
    });
  }
  return handleExtensionMessage(msg, { isInternalExtensionPage: true });
}

export async function renderOptions(): Promise<void> {
  const state = await loadExtensionState();
  const caps = getExtensionCapabilities();

  const domainsEl = document.getElementById("opt-domains-list");
  if (domainsEl) {
    domainsEl.textContent = state.allowedDomains.join(", ");
  }

  const retentionInput = document.getElementById("opt-retention-days") as HTMLInputElement | null;
  if (retentionInput) {
    retentionInput.value = String(state.retentionDays ?? 30);
  }

  const diagEl = document.getElementById("opt-diagnostics-output");
  if (diagEl) {
    diagEl.textContent = JSON.stringify(
      {
        extensionVersion: caps.extensionVersion,
        protocolVersion: caps.protocolVersion,
        productionOrigin: SECURITY_DISCLOSURES.productionOrigin,
        requiredPathPrefix: SECURITY_DISCLOSURES.requiredPathPrefix,
        minimalPermissions: SECURITY_DISCLOSURES.minimalPermissions,
        connectedOrigin: state.connectedOrigin,
        queueCount: state.queue.length,
        hasSharedProfile: Boolean(state.sharedProfile),
      },
      null,
      2,
    );
  }
}

function bindOptionsActions(): void {
  const addDomainBtn = document.getElementById("opt-btn-add-domain");
  const newDomainInput = document.getElementById("opt-new-domain") as HTMLInputElement | null;
  const saveRetentionBtn = document.getElementById("opt-btn-save-retention");
  const retentionInput = document.getElementById("opt-retention-days") as HTMLInputElement | null;
  const clearBtn = document.getElementById("opt-btn-clear-data");
  const clearFeedback = document.getElementById("opt-clear-feedback");

  addDomainBtn?.addEventListener("click", async () => {
    const val = (newDomainInput?.value ?? "").trim().toLowerCase();
    if (!val) return;
    await saveExtensionState((prev) => ({
      ...prev,
      allowedDomains: Array.from(new Set([...prev.allowedDomains, val])),
    }));
    if (newDomainInput) newDomainInput.value = "";
    await renderOptions();
  });

  saveRetentionBtn?.addEventListener("click", async () => {
    const days = Math.max(1, Math.min(365, Number(retentionInput?.value ?? 30) || 30));
    await saveExtensionState({ retentionDays: days });
    await renderOptions();
  });

  clearBtn?.addEventListener("click", async () => {
    await dispatchExtensionMessage({
      protocol: "careeros-autoapply",
      version: "1.0",
      requestId: `opt-clear-${Date.now()}`,
      action: "CLEAR_SHARED_DATA",
      origin: "extension://internal",
      timestamp: new Date().toISOString(),
      payload: {},
    });
    if (clearFeedback) {
      clearFeedback.textContent = "All shared profile and queue data cleared.";
    }
    await renderOptions();
  });
}

function bindAppearance(): void {
  const select = document.getElementById("opt-theme") as HTMLSelectElement | null;
  if (!select) return;
  select.value = getThemePreference();
  select.addEventListener("change", () => {
    if (!isThemePreference(select.value)) return;
    void setThemePreference(select.value).then(() => {
      const feedback = document.getElementById("opt-theme-feedback");
      if (feedback) feedback.textContent = "Saved.";
    });
  });
}

if (typeof document !== "undefined") {
  // Apply the saved appearance before the page is shown, and follow later changes.
  initTheme((preference) => {
    const select = document.getElementById("opt-theme") as HTMLSelectElement | null;
    if (select) select.value = preference;
  });
  document.addEventListener("DOMContentLoaded", () => {
    bindAppearance();
    bindOptionsActions();
    renderOptions();
  });
}
