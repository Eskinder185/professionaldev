import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

/** What is painted. */
export type Theme = "dark" | "light";
/** What the user chose. "system" follows the operating system and updates live. */
export type ThemePreference = Theme | "system";

type Ctx = {
  theme: Theme;
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
  /** Explicitly choose light or dark. */
  setTheme: (theme: Theme) => void;
  /** Flip between light and dark as an explicit choice. */
  toggle: () => void;
};

const ThemeCtx = createContext<Ctx | undefined>(undefined);

/** The explicit choice (light | dark | system). The inline script in index.html reads the same keys before first paint. */
export const THEME_PREFERENCE_KEY = "pd-theme-pref";
/** The resolved theme, kept for older code and for the pre-paint script. */
export const THEME_KEY = "pd-theme";

const systemTheme = (): Theme => (typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: light)").matches ? "light" : "dark");

export function readThemePreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(THEME_PREFERENCE_KEY);
    if (stored === "light" || stored === "dark" || stored === "system") return stored;
    // Before preferences existed, the resolved theme was saved on every load. Keep what the person
    // has been seeing rather than switching them unexpectedly.
    const legacy = localStorage.getItem(THEME_KEY);
    if (legacy === "light" || legacy === "dark") return legacy;
  } catch {
    // Storage can be unavailable; fall back to the system setting.
  }
  return "system";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [preference, setPreference] = useState<ThemePreference>(readThemePreference);
  const [system, setSystem] = useState<Theme>(systemTheme);
  const theme: Theme = preference === "system" ? system : preference;

  // Follow operating-system changes (only matters while the preference is "system").
  useEffect(() => {
    const query = window.matchMedia?.("(prefers-color-scheme: light)");
    if (!query) return;
    const onChange = (event: MediaQueryListEvent) => setSystem(event.matches ? "light" : "dark");
    query.addEventListener?.("change", onChange);
    return () => query.removeEventListener?.("change", onChange);
  }, []);

  // Apply to <html> and persist.
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("light", theme === "light");
    root.classList.toggle("dark", theme === "dark");
    root.dataset.themePreference = preference;
    try {
      localStorage.setItem(THEME_PREFERENCE_KEY, preference);
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      // Appearance still applies for this visit.
    }
  }, [theme, preference]);

  const value = useMemo<Ctx>(
    () => ({
      theme,
      preference,
      setPreference,
      setTheme: (next) => setPreference(next),
      toggle: () => setPreference(theme === "light" ? "dark" : "light"),
    }),
    [theme, preference],
  );

  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeCtx);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
