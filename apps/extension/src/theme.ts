/**
 * Appearance for every extension page (popup, side panel, options).
 *
 * The preference is "light", "dark", or "system". It is stored in chrome.storage.local so all
 * extension pages and the content script share it, and mirrored in localStorage so a page can
 * apply it synchronously before first paint. When the person changes appearance on the CareerOS
 * website, the content script copies that choice here, so the extension always matches the site.
 */

export type ThemePreference = "light" | "dark" | "system";

export const THEME_STORAGE_KEY = "careeros:theme";

type StorageArea = {
  get: (keys: string | string[]) => Promise<Record<string, unknown>>;
  set: (items: Record<string, unknown>) => Promise<void>;
};
type ChromeLike = {
  storage?: {
    local?: StorageArea;
    onChanged?: { addListener: (listener: (changes: Record<string, { newValue?: unknown }>, area: string) => void) => void };
  };
};

const chromeApi = (): ChromeLike | undefined => (globalThis as unknown as { chrome?: ChromeLike }).chrome;

export const isThemePreference = (value: unknown): value is ThemePreference => value === "light" || value === "dark" || value === "system";

function paint(preference: ThemePreference): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (preference === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", preference);
  root.setAttribute("data-theme-preference", preference);
}

function cached(): ThemePreference {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    if (isThemePreference(value)) return value;
  } catch {
    // Storage may be unavailable; follow the system.
  }
  return "system";
}

/** Apply the saved appearance now, then keep it in sync with changes made elsewhere. */
export function initTheme(onChange?: (preference: ThemePreference) => void): void {
  paint(cached());
  const api = chromeApi();
  const apply = (value: unknown) => {
    if (!isThemePreference(value)) return;
    try {
      localStorage.setItem(THEME_STORAGE_KEY, value);
    } catch {
      // Still applies for this page.
    }
    paint(value);
    onChange?.(value);
  };
  api?.storage?.local
    ?.get(THEME_STORAGE_KEY)
    .then((items) => apply(items[THEME_STORAGE_KEY]))
    .catch(() => undefined);
  api?.storage?.onChanged?.addListener((changes, area) => {
    if (area === "local" && changes[THEME_STORAGE_KEY]) apply(changes[THEME_STORAGE_KEY].newValue);
  });
}

export function getThemePreference(): ThemePreference {
  return cached();
}

export async function setThemePreference(preference: ThemePreference): Promise<void> {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // Still applies for this page.
  }
  paint(preference);
  await chromeApi()?.storage?.local?.set({ [THEME_STORAGE_KEY]: preference }).catch(() => undefined);
}
