import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

type Theme = "dark" | "light";
type Ctx = { theme: Theme; setTheme: (t: Theme) => void; toggle: () => void; };

const ThemeCtx = createContext<Ctx | undefined>(undefined);
const STORAGE_KEY = "pd-theme";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    // initial: localStorage or system
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(STORAGE_KEY) as Theme | null;
      if (saved === "light" || saved === "dark") return saved;
      const sys = window.matchMedia?.("(prefers-color-scheme: light)").matches ? "light" : "dark";
      return sys;
    }
    return "dark";
  });

  // apply to <html>
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "light") root.classList.add("light");
    else root.classList.remove("light");
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  // react to system changes when user hasn't explicitly chosen
  useEffect(() => {
    const m = window.matchMedia?.("(prefers-color-scheme: light)");
    if (!m) return;
    const handler = (e: MediaQueryListEvent) => {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) setTheme(e.matches ? "light" : "dark");
    };
    m.addEventListener?.("change", handler);
    return () => m.removeEventListener?.("change", handler);
  }, []);

  const value = useMemo<Ctx>(() => ({
    theme, setTheme,
    toggle: () => setTheme(t => (t === "light" ? "dark" : "light"))
  }), [theme]);

  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeCtx);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}