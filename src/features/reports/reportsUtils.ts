// src/features/reports/reportsUtils.ts
import { detectPersistKey, getPersistState, toISODate } from "../shared/persist";

export type ReportSnapshot = {
  persistKey: string;
  abtActive: any[];
  ipActive: any[];
  vaxAll: any[];
  today: string;
  topAntibiotics: [string, number][];
};

function activeABT(records: any[], today: string) {
  return records.filter((r) => {
    const end = toISODate(r?.end || r?.endDate || "");
    return !end || end >= today;
  });
}

function activeIP(cases: any[]) {
  return cases.filter((c) => String(c?.status || c?.caseStatus || "ACTIVE").toUpperCase() === "ACTIVE");
}

function groupCount(items: any[], keyFn: (x: any) => string) {
  const m: Record<string, number> = {};
  items.forEach((x) => {
    const k = keyFn(x);
    if (!k) return;
    m[k] = (m[k] || 0) + 1;
  });
  return Object.entries(m).sort((a, b) => b[1] - a[1]) as [string, number][];
}

export function buildSnapshot(): ReportSnapshot {
  const info = detectPersistKey();
  if (!info) throw new Error("Persisted tracker state not detected. Open the tracker once, then retry.");

  const { state } = getPersistState(info);
  const today = new Date().toISOString().slice(0, 10);

  const abt =
    state?.modules?.abt?.courses && Array.isArray(state.modules.abt.courses)
      ? state.modules.abt.courses
      : Array.isArray(state.abt)
        ? state.abt
        : Array.isArray(state.antibiotics)
          ? state.antibiotics
          : [];

  const ip =
    state?.modules?.ip?.cases && Array.isArray(state.modules.ip.cases)
      ? state.modules.ip.cases
      : Array.isArray(state.ipCases)
        ? state.ipCases
        : Array.isArray(state.ip)
          ? state.ip
          : [];

  const vax =
    state?.modules?.vaccinations?.records && Array.isArray(state.modules.vaccinations.records)
      ? state.modules.vaccinations.records
      : state?.modules?.vax?.records && Array.isArray(state.modules.vax.records)
        ? state.modules.vax.records
        : Array.isArray(state.vaccinations)
          ? state.vaccinations
          : Array.isArray(state.vax)
            ? state.vax
            : [];

  const abtA = activeABT(abt, today);
  const ipA = activeIP(ip);
  const top = groupCount(abtA, (r) => String(r?.antibiotic || r?.med || r?.drug || "").trim()).slice(0, 10);

  return { persistKey: info.key, abtActive: abtA, ipActive: ipA, vaxAll: vax, today, topAntibiotics: top };
}

export function toCsv(rows: Record<string, any>[]) {
  const keys = Object.keys(rows[0] || {});
  const esc = (v: any) => {
    const s = v === null || v === undefined ? "" : String(v);
    const needs = /[",\n\r]/.test(s);
    const out = s.replace(/"/g, '""');
    return needs ? `"${out}"` : out;
  };
  const lines: string[] = [];
  lines.push(keys.map(esc).join(","));
  rows.forEach((r) => lines.push(keys.map((k) => esc(r[k])).join(",")));
  return lines.join("\n");
}
