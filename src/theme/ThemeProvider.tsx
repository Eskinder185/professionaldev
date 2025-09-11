import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

type Theme = "light" | "dark";
type Ctx = { theme: Theme; toggle: () => void; set: (t: Theme) => void };
const C = createContext<Ctx | null>(null);
const KEY = "pd:theme";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem(KEY) as Theme | null;
    if (saved) return saved;
    /* DEFAULT TO DARK */
    return "dark";
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
    localStorage.setItem(KEY, theme);
  }, [theme]);

  const value = useMemo<Ctx>(() => ({
    theme,
    toggle: () => setTheme(t => (t === "dark" ? "light" : "dark")),
    set: setTheme
  }), [theme]);

  return <C.Provider value={value}>{children}</C.Provider>;
}

export const useTheme = () => {
  const ctx = useContext(C);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
};
