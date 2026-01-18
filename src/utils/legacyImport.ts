import type { AntibioticEntry, InfectionCase, Resident, VaccinationEntry } from '../types/core';
import { generateId } from './id';
import { nowISO } from './time';

export type LegacyKind = 'vaccination' | 'abt' | 'ip' | 'unknown';

export type LegacyImportResult = {
  kind: LegacyKind;
  residents: Resident[];
  vaccinations: VaccinationEntry[];
  antibiotics: AntibioticEntry[];
  infectionCases: InfectionCase[];
  warnings: string[];
};

function asStr(v: any): string {
  return v == null ? '' : String(v).trim();
}

function slug(s: string): string {
  return asStr(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 40);
}

function residentIdFrom(name: string, mrn?: string, dob?: string): string {
  const m = slug(mrn || 'nomrn');
  const d = slug(dob || 'nodob');
  return `res_${slug(name) || 'unknown'}_${m}_${d}`;
}

function normalizeDateISO(v: any): string {
  const s = asStr(v);
  if (!s) return '';
  // Accept YYYY-MM-DD, YYYY/MM/DD, MM/DD/YYYY, etc.
  const m1 = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (m1) {
    const y = m1[1];
    const mo = m1[2].padStart(2, '0');
    const d = m1[3].padStart(2, '0');
    return `${y}-${mo}-${d}`;
  }
  const m2 = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (m2) {
    const mo = m2[1].padStart(2, '0');
    const d = m2[2].padStart(2, '0');
    const y = m2[3];
    return `${y}-${mo}-${d}`;
  }
  // Fallback: try Date parsing
  const dt = new Date(s);
  if (!Number.isNaN(dt.getTime())) return dt.toISOString().slice(0, 10);
  return '';
}

function detectKind(obj: any): LegacyKind {
  if (!obj) return 'unknown';
  const keys = Array.isArray(obj) ? Object.keys(obj[0] || {}) : Object.keys(obj);
  const k = keys.map((x) => String(x).toLowerCase());
  const has = (needle: string) => k.some((x) => x.includes(needle));
  // Look for obvious list containers
  const top = typeof obj === 'object' && !Array.isArray(obj) ? Object.keys(obj).map((x) => x.toLowerCase()) : [];
  const topHas = (n: string) => top.some((x) => x.includes(n));
  if (topHas('vacc') || has('vaccine') || has('vax')) return 'vaccination';
  if (topHas('abt') || topHas('antibi') || has('antibi') || has('abx') || has('medication')) return 'abt';
  if (topHas('infection') || topHas('case') || has('precaution') || has('isolation') || has('syndrome') || has('organism')) return 'ip';
  return 'unknown';
}

function pickArray(obj: any, candidates: string[]): any[] {
  if (!obj || typeof obj !== 'object') return [];
  if (Array.isArray(obj)) return obj;
  for (const c of candidates) {
    const key = Object.keys(obj).find((k) => k.toLowerCase() === c.toLowerCase() || k.toLowerCase().includes(c.toLowerCase()));
    if (key && Array.isArray(obj[key])) return obj[key];
  }
  return [];
}

export function parseLegacyJson(obj: any): LegacyImportResult {
  const warnings: string[] = [];
  const kind = detectKind(obj);
  const now = nowISO();

  /** residentId -> Resident */
  const residentsMap: Record<string, Resident> = {};

  const vaccinations: VaccinationEntry[] = [];
  const antibiotics: AntibioticEntry[] = [];
  const infectionCases: InfectionCase[] = [];

  function upsertResident(r: { name: string; mrn?: string; unit?: string; room?: string; dob?: string }): Resident {
    const name = asStr(r.name);
    const mrn = asStr(r.mrn);
    const dob = asStr(r.dob);
    const id = residentIdFrom(name, mrn, dob);
    const prev = residentsMap[id];
    const res: Resident = {
      id,
      name: name || prev?.name || 'Unknown',
      mrn: mrn || prev?.mrn || undefined,
      unit: asStr(r.unit) || prev?.unit || undefined,
      room: asStr(r.room) || prev?.room || undefined,
      dob: dob || prev?.dob || undefined,
      status: 'Unknown',
      createdAt: prev?.createdAt || now,
      updatedAt: now
    };
    residentsMap[id] = res;
    return res;
  }

  if (kind === 'vaccination') {
    const list = pickArray(obj, ['vaccinations', 'vax', 'vaxlog', 'entries', 'records']);
    for (const raw of list) {
      const name = asStr(raw?.residentName ?? raw?.name ?? raw?.Resident ?? raw?.resident);
      const mrn = asStr(raw?.mrn ?? raw?.MRN ?? raw?.residentMrn);
      const unit = asStr(raw?.unit ?? raw?.Unit);
      const room = asStr(raw?.room ?? raw?.Room);
      const dob = asStr(raw?.dob ?? raw?.DOB);
      const res = upsertResident({ name, mrn, unit, room, dob });

      const type = asStr(raw?.vaccineType ?? raw?.type ?? raw?.vaxType ?? raw?.Vaccine);
      const dateISO = normalizeDateISO(raw?.dateISO ?? raw?.date ?? raw?.givenDate ?? raw?.Date);
      if (!type || !dateISO) {
        warnings.push(`Skipped a vaccination row missing type/date (${name || 'unknown'}).`);
        continue;
      }
      const status = asStr(raw?.status ?? raw?.Status) as any;
      vaccinations.push({
        id: generateId('vax'),
        residentId: res.id,
        residentName: res.name,
        mrn: res.mrn,
        unit: res.unit,
        room: res.room,
        vaccineType: type,
        dateISO,
        status: status || 'Given',
        manufacturer: asStr(raw?.manufacturer ?? raw?.mfg) || undefined,
        lot: asStr(raw?.lot) || undefined,
        route: asStr(raw?.route) || undefined,
        site: asStr(raw?.site) || undefined,
        notes: asStr(raw?.notes) || undefined,
        createdAt: now,
        updatedAt: now
      });
    }
  }

  if (kind === 'abt') {
    const list = pickArray(obj, ['antibiotics', 'abx', 'abt', 'entries', 'records', 'active']);
    for (const raw of list) {
      const name = asStr(raw?.residentName ?? raw?.name ?? raw?.Resident ?? raw?.resident);
      const mrn = asStr(raw?.mrn ?? raw?.MRN);
      const unit = asStr(raw?.unit ?? raw?.Unit);
      const room = asStr(raw?.room ?? raw?.Room);
      const dob = asStr(raw?.dob ?? raw?.DOB);
      const res = upsertResident({ name, mrn, unit, room, dob });

      const med = asStr(raw?.medication ?? raw?.drug ?? raw?.antibiotic ?? raw?.abxName);
      const start = normalizeDateISO(raw?.startDateISO ?? raw?.start ?? raw?.StartDate ?? raw?.dateStart);
      if (!med || !start) {
        warnings.push(`Skipped an ABT row missing medication/start (${name || 'unknown'}).`);
        continue;
      }
      const stop = normalizeDateISO(raw?.stopDateISO ?? raw?.stop ?? raw?.StopDate ?? raw?.dateStop) || undefined;
      const status = (asStr(raw?.status) || (stop ? 'Stopped' : 'Active')) as any;
      antibiotics.push({
        id: generateId('abt'),
        residentId: res.id,
        residentName: res.name,
        mrn: res.mrn,
        unit: res.unit,
        room: res.room,
        medication: med,
        startDateISO: start,
        stopDateISO: stop,
        route: asStr(raw?.route) || undefined,
        dose: asStr(raw?.dose) || undefined,
        frequency: asStr(raw?.frequency ?? raw?.freq) || undefined,
        indication: asStr(raw?.indication) || undefined,
        orderedBy: asStr(raw?.orderedBy ?? raw?.provider) || undefined,
        status,
        notes: asStr(raw?.notes) || undefined,
        createdAt: now,
        updatedAt: now
      });
    }
  }

  if (kind === 'ip') {
    const list = pickArray(obj, ['infectionCases', 'cases', 'ip', 'lineList', 'linelist', 'entries', 'records']);
    for (const raw of list) {
      const name = asStr(raw?.residentName ?? raw?.name ?? raw?.Resident ?? raw?.resident);
      const mrn = asStr(raw?.mrn ?? raw?.MRN);
      const unit = asStr(raw?.unit ?? raw?.Unit);
      const room = asStr(raw?.room ?? raw?.Room);
      const dob = asStr(raw?.dob ?? raw?.DOB);
      const res = upsertResident({ name, mrn, unit, room, dob });

      const onset = normalizeDateISO(raw?.onsetDateISO ?? raw?.onset ?? raw?.OnsetDate ?? raw?.date);
      if (!onset) {
        warnings.push(`Skipped an IP row missing onset date (${name || 'unknown'}).`);
        continue;
      }
      const precautions = asStr(raw?.precautions ?? raw?.precaution ?? raw?.isolation ?? raw?.Precautions) as any;
      const resolved = normalizeDateISO(raw?.resolvedDateISO ?? raw?.resolved ?? raw?.ResolvedDate) || undefined;
      infectionCases.push({
        id: generateId('ip'),
        residentId: res.id,
        residentName: res.name,
        mrn: res.mrn,
        unit: res.unit,
        room: res.room,
        syndrome: asStr(raw?.syndrome ?? raw?.category) || undefined,
        organism: asStr(raw?.organism ?? raw?.pathogen) || undefined,
        onsetDateISO: onset,
        labDateISO: normalizeDateISO(raw?.labDateISO ?? raw?.labDate) || undefined,
        precautions: precautions || 'Unknown',
        resolvedDateISO: resolved,
        notes: asStr(raw?.notes) || undefined,
        createdAt: now,
        updatedAt: now
      });
    }
  }

  if (kind === 'unknown') {
    warnings.push('Could not confidently detect this legacy JSON format. Try exporting a tracker JSON (ABT/Vax/IP) and re-importing it here.');
  }

  return {
    kind,
    residents: Object.values(residentsMap),
    vaccinations,
    antibiotics,
    infectionCases,
    warnings
  };
}
