import { useCallback, useEffect, useState } from "react";

export function getLocal<T = unknown>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function setLocal<T = unknown>(key: string, value: T) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

export function removeLocal(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {}
}

export function useLocal<T = unknown>(key: string, initial: T) {
  const [state, setState] = useState<T>(() => getLocal<T>(key, initial));
  useEffect(() => setLocal(key, state), [key, state]);
  const reset = useCallback(() => setState(initial), [initial]);
  return [state, setState, reset] as const;
}

export function listKeys(prefix = "pd:") {
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)!;
    if (k.startsWith(prefix)) keys.push(k);
  }
  return keys.sort();
}

