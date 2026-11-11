import { readPageContext, readState, resolveTargetTab, openSettings, openUrl, type TargetTab } from "../sidepanel/lib/bridge";
import { matchApplication, siteBase } from "../sidepanel/lib/model";
import { initTheme } from "../../src/theme";

interface SidePanelApi {
  open?: (opts: { tabId?: number; windowId?: number }) => Promise<void>;
}
declare const chrome: { sidePanel?: SidePanelApi } | undefined;

function setText(id: string, value: string): void {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

let currentTab: TargetTab | null = null;
let siteUrl = "https://eskinder185.github.io/professionaldev";

/**
 * The popup is only a launcher: it summarises the current application and opens the side panel.
 * All workflow lives in the side panel, which stays open while the user fills the form.
 */
export async function renderPopup(): Promise<void> {
  const state = await readState();
  currentTab = await resolveTargetTab();
  siteUrl = siteBase(state);

  const app = matchApplication(state, currentTab?.url);
  // Opening the popup is a user gesture, which also lets CareerOS read the current page once (activeTab).
  const read = await readPageContext(currentTab, state.sharedProfile, app);
  const page = read.ok ? read.context : read.fallback;
  const job = read.ok ? read.context.job : null;
  const activeApp = matchApplication(state, page.url || currentTab?.url);

  setText("popup-connection-status", state.connectedOrigin || state.sharedProfile ? "Connected to CareerOS" : "Not connected yet");
  setText("popup-detected-platform", read.ok ? page.platformLabel.replace(/ \(.*/, "") : read.message.split(".")[0]);
  setText(
    "popup-active-role",
    job ? `${job.title || "Role"}${job.company ? ` — ${job.company}` : ""}` : activeApp ? `${activeApp.title} — ${activeApp.company}` : "No job detected",
  );
  setText("popup-queue-status", activeApp?.status ?? (read.ok && page.fields.length ? "Form detected" : "Not in CareerOS queue"));
  setText("popup-profile-status", state.sharedProfile ? `${state.sharedProfile.sharedFields.length} fields shared` : "Not shared yet");

  const badge = document.getElementById("popup-platform-badge");
  if (badge) {
    const level = read.ok ? page.supportLevel : "unsupported";
    badge.className = `badge ${level}`;
    badge.textContent = read.ok ? level.charAt(0).toUpperCase() + level.slice(1) : "Unreadable";
  }
}

function bindPopupActions(): void {
  document.getElementById("btn-open-sidepanel")?.addEventListener("click", () => {
    const api = typeof chrome !== "undefined" ? chrome.sidePanel : undefined;
    // Must run synchronously inside the click so Chrome accepts it as a user gesture.
    if (api?.open && currentTab?.id) {
      api
        .open({ tabId: currentTab.id })
        .then(() => window.close())
        .catch((err: unknown) => {
          setText("popup-feedback", `Couldn’t open the side panel: ${err instanceof Error ? err.message : "unknown error"}`);
        });
    } else {
      setText("popup-feedback", "Open a web page in this window first, then try again.");
    }
  });
  document.getElementById("btn-open-careeros")?.addEventListener("click", () => {
    void openUrl(`${siteUrl}/autoapply`);
  });
  document.getElementById("btn-open-settings")?.addEventListener("click", () => openSettings());
}

if (typeof document !== "undefined") {
  initTheme();
  document.addEventListener("DOMContentLoaded", () => {
    bindPopupActions();
    void renderPopup();
  });
}
