export function makeId(prefix = "id"): string {
  // Prefer crypto.randomUUID when available.
  try {
    const c = (globalThis as any).crypto;
    if (c && typeof c.randomUUID === "function") {
      return `${prefix}_${c.randomUUID()}`;
    }
  } catch {
    // ignore
  }

  // Fallback: time + random
  const rand = Math.random().toString(16).slice(2);
  const t = Date.now().toString(16);
  return `${prefix}_${t}_${rand}`;
}
