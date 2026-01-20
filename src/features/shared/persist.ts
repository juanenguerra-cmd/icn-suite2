// src/features/shared/persist.ts
// Shared persisted-state helpers (local-first, key-agnostic)

export type PersistKeyInfo = { key: string; wrapped: boolean; score: number };

export function safeParse(raw: string): any | null {
  try { return JSON.parse(raw); } catch { return null; }
}

function scoreState(state: any): number {
  if (!state || typeof state !== "object") return 0;
  let s = 0;
  if (state.modules && typeof state.modules === "object") s += 5;
  if (Array.isArray(state.modules?.abt?.courses)) s += 5;
  if (Array.isArray(state.modules?.vaccinations?.records)) s += 5;
  if (Array.isArray(state.modules?.ip?.cases)) s += 5;

  if (Array.isArray(state.abt) || Array.isArray(state.antibiotics)) s += 3;
  if (Array.isArray(state.vaccinations) || Array.isArray(state.vax)) s += 3;
  if (Array.isArray(state.ipCases) || Array.isArray(state.ip) || Array.isArray(state.cases)) s += 3;

  if (state.residentsById && typeof state.residentsById === "object" && !Array.isArray(state.residentsById)) s += 2;
  return s;
}

export function detectPersistKey(): PersistKeyInfo | null {
  const keys = Object.keys(localStorage);
  let best: PersistKeyInfo | null = null;
  for (const k of keys) {
    const raw = localStorage.getItem(k);
    if (!raw || raw.length < 20) continue;
    if (raw[0] !== "{" && raw[0] !== "[") continue;
    const obj = safeParse(raw);
    if (!obj || typeof obj !== "object") continue;
    const wrapped = !!(obj as any)?.state;
    const state = wrapped ? (obj as any).state : obj;
    const sc = scoreState(state);
    if (sc <= 0) continue;
    if (!best || sc > best.score) best = { key: k, wrapped, score: sc };
  }
  return best;
}

export function getPersistState(info: PersistKeyInfo): { raw: string; obj: any; state: any } {
  const raw = localStorage.getItem(info.key) || "";
  const obj = safeParse(raw) || {};
  const state = info.wrapped ? ((obj as any)?.state ?? {}) : obj;
  return { raw, obj, state };
}

export function writePersistState(info: PersistKeyInfo, obj: any, state: any) {
  if (info.wrapped) {
    obj.state = state;
    localStorage.setItem(info.key, JSON.stringify(obj));
  } else {
    localStorage.setItem(info.key, JSON.stringify(state));
  }
}

export function ensure(obj: any, path: string, def: any) {
  const parts = path.split(".");
  let cur = obj;
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i]!;
    if (i === parts.length - 1) {
      if (cur[p] === undefined) cur[p] = def;
      return cur[p];
    }
    if (cur[p] === undefined || cur[p] === null || typeof cur[p] !== "object") cur[p] = {};
    cur = cur[p];
  }
}

const LATEST_BACKUP_KEY = "icn_latest_backup_key_v1";
const BACKUP_PREFIX = "icn_state_backup_";

export function latestBackupKey(): string {
  return localStorage.getItem(LATEST_BACKUP_KEY) || "";
}

export function createBackup(beforeRaw: string): string {
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  const bkey = BACKUP_PREFIX + stamp;
  localStorage.setItem(bkey, beforeRaw || "");
  localStorage.setItem(LATEST_BACKUP_KEY, bkey);
  return bkey;
}

export function toISODate(s: any): string {
  if (!s) return "";
  const t = String(s).trim();
  if (!t) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  const m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const mm = String(parseInt(m[1]!, 10)).padStart(2, "0");
    const dd = String(parseInt(m[2]!, 10)).padStart(2, "0");
    return `${m[3]}-${mm}-${dd}`;
  }
  const m2 = t.match(/^(\d{4}-\d{2}-\d{2})T/);
  if (m2) return m2[1]!;
  return t;
}
