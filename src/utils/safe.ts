export const asString = (v: unknown): string => (v == null ? '' : String(v));

export function safeSplitTags(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(asString).map(s => s.trim()).filter(Boolean);
  const s = asString(v).trim();
  if (!s) return [];
  return s.split(/[,;|]+/).map(t => t.trim()).filter(Boolean);
}
