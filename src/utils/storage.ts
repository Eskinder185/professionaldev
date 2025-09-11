export const load = <T>(k: string, f: T): T => {
  try {
    const v = localStorage.getItem(k);
    return v ? (JSON.parse(v) as T) : f;
  } catch {
    return f;
  }
};

export const save = (k: string, v: any) => {
  localStorage.setItem(k, JSON.stringify(v));
};

