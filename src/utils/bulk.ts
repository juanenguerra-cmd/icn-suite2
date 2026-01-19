import type { Resident, VaccinationStatus, VaccinationEntry, AntibioticEntry, AntibioticStatus } from '../types/core';

function splitCols(line: string): string[] {
  const t = line.trim();
  if (!t) return [];
  if (t.includes('\t')) return t.split(/\t+/).map((s) => s.trim()).filter(Boolean);
  if (t.includes('|')) return t.split('|').map((s) => s.trim()).filter(Boolean);
  return t.split(/\s{2,}/).map((s) => s.trim()).filter(Boolean);
}

export function normalizeDateISO(input: string): string | null {
  const raw = String(input || '').trim();
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const m = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const mm = String(parseInt(m[1], 10)).padStart(2, '0');
    const dd = String(parseInt(m[2], 10)).padStart(2, '0');
    return `${m[3]}-${mm}-${dd}`;
  }
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function normKey(s: string) {
  return String(s || '').trim().toUpperCase();
}

export function matchResidentIdByKey(residentsById: Record<string, Resident>, key: string): string | null {
  const k = normKey(key);
  if (!k) return null;

  // Direct ID match
  if (residentsById[k]) return k;

  // Room-bed match (e.g., 251-A)
  if (/^\d{2,4}-[A-Z0-9]+$/.test(k)) {
    for (const r of Object.values(residentsById)) {
      const room = normKey(r.room || r.lockedRoom || '');
      if (room === k) return r.id;
    }
  }

  // MRN match (e.g., LON202332)
  for (const r of Object.values(residentsById)) {
    const mrn = normKey(r.mrn || '');
    if (mrn && (mrn === k || mrn.includes(k))) return r.id;
  }

  // Name fallback (exact contains)
  for (const r of Object.values(residentsById)) {
    const name = normKey(r.name || '');
    if (name && name === k) return r.id;
  }
  for (const r of Object.values(residentsById)) {
    const name = normKey(r.name || '');
    if (name && name.includes(k)) return r.id;
  }

  return null;
}

export type BulkVaxRow = {
  residentKey: string;
  vaccineType: string;
  dateISO: string;
  status?: VaccinationStatus;
  notes?: string;
};

export type BulkAbxRow = {
  residentKey: string;
  medication: string;
  startDateISO: string;
  indication?: string;
  notes?: string;
};

export function parseBulkVax(text: string, selectedResidentKey?: string): { rows: BulkVaxRow[]; errors: string[] } {
  const rows: BulkVaxRow[] = [];
  const errors: string[] = [];
  const selected = selectedResidentKey ? String(selectedResidentKey).trim() : '';

  const lines = String(text || '').split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith('#')) continue;
    const cols = splitCols(line);

    if (selected) {
      if (cols.length < 2) {
        errors.push(`Line ${i + 1}: expected "VaccineType  Date  Notes"`);
        continue;
      }
      const dateISO = normalizeDateISO(cols[1]);
      if (!cols[0] || !dateISO) {
        errors.push(`Line ${i + 1}: invalid vaccine type or date`);
        continue;
      }
      rows.push({ residentKey: selected, vaccineType: cols[0], dateISO, notes: cols.slice(2).join(' ').trim() || undefined });
      continue;
    }

    if (cols.length < 3) {
      errors.push(`Line ${i + 1}: expected "ResidentKey  VaccineType  Date  Notes"`);
      continue;
    }
    const dateISO = normalizeDateISO(cols[2]);
    if (!cols[1] || !dateISO) {
      errors.push(`Line ${i + 1}: invalid vaccine type or date`);
      continue;
    }
    rows.push({ residentKey: cols[0], vaccineType: cols[1], dateISO, notes: cols.slice(3).join(' ').trim() || undefined });
  }
  return { rows, errors };
}

export function parseBulkAbx(text: string, selectedResidentKey?: string): { rows: BulkAbxRow[]; errors: string[] } {
  const rows: BulkAbxRow[] = [];
  const errors: string[] = [];
  const selected = selectedResidentKey ? String(selectedResidentKey).trim() : '';

  const lines = String(text || '').split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith('#')) continue;
    const cols = splitCols(line);

    if (selected) {
      if (cols.length < 2) {
        errors.push(`Line ${i + 1}: expected "Medication  StartDate  Indication  Notes"`);
        continue;
      }
      const startDateISO = normalizeDateISO(cols[1]);
      if (!cols[0] || !startDateISO) {
        errors.push(`Line ${i + 1}: invalid medication or date`);
        continue;
      }
      rows.push({ residentKey: selected, medication: cols[0], startDateISO, indication: cols[2]?.trim() || undefined, notes: cols.slice(3).join(' ').trim() || undefined });
      continue;
    }

    if (cols.length < 3) {
      errors.push(`Line ${i + 1}: expected "ResidentKey  Medication  StartDate  Indication  Notes"`);
      continue;
    }
    const startDateISO = normalizeDateISO(cols[2]);
    if (!cols[1] || !startDateISO) {
      errors.push(`Line ${i + 1}: invalid medication or date`);
      continue;
    }
    rows.push({ residentKey: cols[0], medication: cols[1], startDateISO, indication: cols[3]?.trim() || undefined, notes: cols.slice(4).join(' ').trim() || undefined });
  }
  return { rows, errors };
}

export function buildVaxEntries(args: {
  residentsById: Record<string, Resident>;
  rows: BulkVaxRow[];
  nowISO: string;
  generateId: (prefix: string) => string;
}): { items: VaccinationEntry[]; errors: string[]; skipped: number } {
  const { residentsById, rows, nowISO: now, generateId } = args;
  const items: VaccinationEntry[] = [];
  const errors: string[] = [];
  let skipped = 0;

  for (const r of rows) {
    const rid = matchResidentIdByKey(residentsById, r.residentKey);
    if (!rid) {
      errors.push(`Resident not found: ${r.residentKey}`);
      skipped++;
      continue;
    }
    const res = residentsById[rid];
    if (!res) {
      skipped++;
      continue;
    }
    items.push({
      id: generateId('vax'),
      residentId: res.id,
      residentName: res.name,
      mrn: res.mrn,
      unit: String(res.unit || res.lockedUnit || ''),
      room: res.room || res.lockedRoom || '',
      vaccineType: String(r.vaccineType || '').trim(),
      dateISO: r.dateISO,
      status: (r.status || 'Given') as VaccinationStatus,
      notes: r.notes?.trim() || undefined,
      createdAt: now,
      updatedAt: now
    });
  }

  return { items, errors, skipped };
}

export function buildAbxEntries(args: {
  residentsById: Record<string, Resident>;
  rows: BulkAbxRow[];
  nowISO: string;
  generateId: (prefix: string) => string;
}): { items: AntibioticEntry[]; errors: string[]; skipped: number } {
  const { residentsById, rows, nowISO: now, generateId } = args;
  const items: AntibioticEntry[] = [];
  const errors: string[] = [];
  let skipped = 0;

  for (const r of rows) {
    const rid = matchResidentIdByKey(residentsById, r.residentKey);
    if (!rid) {
      errors.push(`Resident not found: ${r.residentKey}`);
      skipped++;
      continue;
    }
    const res = residentsById[rid];
    if (!res) {
      skipped++;
      continue;
    }
    items.push({
      id: generateId('abt'),
      residentId: res.id,
      residentName: res.name,
      mrn: res.mrn,
      unit: String(res.unit || res.lockedUnit || ''),
      room: res.room || res.lockedRoom || '',
      medication: String(r.medication || '').trim(),
      startDateISO: r.startDateISO,
      stopDateISO: undefined,
      status: 'Active' as AntibioticStatus,
      indication: r.indication?.trim() || undefined,
      notes: r.notes?.trim() || undefined,
      createdAt: now,
      updatedAt: now
    });
  }

  return { items, errors, skipped };
}
