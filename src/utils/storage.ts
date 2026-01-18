export function safeJsonParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function loadLS<T>(key: string, fallback: T): T {
  const v = safeJsonParse<T>(localStorage.getItem(key));
  return v ?? fallback;
}

export function saveLS<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore quota/security errors
  }
}
