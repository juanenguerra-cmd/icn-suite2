import type { CensusParsedEntry, Config } from '../types/core';

// Ported (simplified + typed) from your locked HTML baseline.

const DOB_RE = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/;
const ROOM_RE = /^(\d{2,3})(?:\s*-\s*[A-Z])?$/i; // 251 or 251-B
const ROOM_RE2 = /^(\d{2,3})\s*-\s*([A-Z])$/i;

const BAD_STARTS = [
  'DATE:',
  'TIME:',
  'USER:',
  'UNIT:',
  'FLOOR:',
  'FACILITY',
  'PAGE',
  'CENSUS',
  'ROOM-BED',
  'CARE LEVEL',
  'RESIDENT',
  'STATUS',
  'PAYOR',
  'BED',
  'CERTIFICATION'
];

const PAYOR_TOKENS = [
  'MEDICARE',
  'MEDICAID',
  'HMO',
  'MANAGED',
  'PRIVATE',
  'COMMERCIAL',
  'BCBS',
  'AETNA',
  'UNITED',
  'HUMANA',
  'CIGNA',
  'KAISER',
  'TRICARE',
  'SELF PAY'
];

export function normalizeRoomForEdit(v: string): string {
  const t = String(v || '').trim().toUpperCase();
  if (!t) return '';
  const m = t.match(/^([0-9]{2,3})\s*-\s*([A-Z])$/);
  if (m) return `${m[1]}-${m[2]}`;
  return t.replace(/\s+/g, '');
}

function normalizeRoom(s: string): string {
  const t = String(s || '').trim();
  const m = t.match(ROOM_RE2);
  if (m) return `${m[1]}-${m[2].toUpperCase()}`;
  return t.replace(/\s+/g, '').toUpperCase();
}

function looksLikeHeader(line: string): boolean {
  const t = String(line || '').trim().toUpperCase();
  if (!t) return true;
  for (const b of BAD_STARTS) {
    if (t.startsWith(b)) return true;
  }
  if (t.includes('LONG BEACH NURSING') || t.includes('REHABILITATION CENTER')) return true;
  if (t.includes('REPORT') && t.includes('CENSUS')) return true;
  return false;
}

function extractPayor(cols: string[]): string {
  for (const c of cols) {
    const t = String(c || '').trim();
    if (!t) continue;
    const u = t.toUpperCase();
    if (PAYOR_TOKENS.some((p) => u.includes(p))) return t;
  }
  return '';
}

export function inferUnitFromRoom(room: string, config: Config): string {
  const r = String(room || '').trim();
  const m = r.match(/^(\d)/);
  if (!m) return '';
  return config.unitAliases?.[m[1]] || '';
}

/** Matches your legacy behavior: MRN-based IDs when available, else stable hash. */
export function makeResidentId(args: { mrn?: string; unit?: string; room?: string; name?: string }): string {
  const mrn = String(args.mrn || '').trim();
  if (mrn) return `MRN-${mrn}`;
  const key = `${String(args.unit || '').trim()}|${String(args.room || '').trim()}|${String(args.name || '').trim()}`.toUpperCase();
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return `H-${h.toString(16)}`;
}

export function parseCensusRaw(raw: string, config: Config): CensusParsedEntry[] {
  const lines = String(raw || '').split(/\r?\n/);
  const entries: CensusParsedEntry[] = [];

  for (const rawLine of lines) {
    const line = String(rawLine || '');
    if (!line.trim()) continue;
    if (!line.includes('\t')) continue; // legacy expects tab-delimited census
    if (looksLikeHeader(line)) continue;

    const cols = line.split('\t').map((x) => x.trim());
    if (cols.length < 2) continue;

    const roomRaw = cols[0] || '';
    const room = normalizeRoom(roomRaw);
    if (!room) continue;

    const roomCore = room.split('-')[0];
    if (!ROOM_RE.test(room) && !/^\d{2,3}$/i.test(roomCore)) continue;

    const nameCol = String(cols[1] || '').trim();
    if (!nameCol) continue;

    const mrnMatch = nameCol.match(/\(([^)]+)\)/);
    const mrn = mrnMatch ? String(mrnMatch[1] || '').trim() : '';

    const looksLikeName = /,/.test(nameCol) && /[A-Z]/i.test(nameCol);
    if (!mrn && !looksLikeName) continue;

    const name = nameCol.replace(/\s*\([^)]*\)\s*/g, '').trim();

    const dobCand = String(cols[2] || '').trim();
    const dob = DOB_RE.test(dobCand) ? dobCand : '';

    const status = String(cols[3] || '').trim();

    const unit = inferUnitFromRoom(room, config) || '';
    const payorSource = extractPayor(cols);

    entries.push({ name, mrn, room, unit, dob, status, payorSource, rawCols: cols });
  }

  // Deduplicate like legacy (MRN preferred, else Name|Room)
  const seen = new Set<string>();
  const out: CensusParsedEntry[] = [];
  for (const e of entries) {
    const key = e.mrn ? `MRN:${e.mrn}` : `NR:${(e.name || '').toUpperCase()}|${e.room}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(e);
  }
  return out;
}
