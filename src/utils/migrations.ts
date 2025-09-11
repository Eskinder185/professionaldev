export function runMigrations() {
  if (typeof localStorage === 'undefined') return;
  try {
    const removePrefixes = [
      'pd:career:resume:',
      'pd:career:pitch:',
      'pd:speech:'
    ];
    const toDelete: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)!;
      if (removePrefixes.some((p) => key.startsWith(p))) toDelete.push(key);
    }
    toDelete.forEach((k) => localStorage.removeItem(k));
  } catch {}
}

