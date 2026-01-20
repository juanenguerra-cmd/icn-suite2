// src/features/import/importUtils.ts
// Stage 7.2 — Import Tab (local-first)
// Applies imports by updating the app's persisted localStorage state directly.
// This is robust even if store actions differ. (Reload the app tab if needed.)

export type IcnBulkPackV1 =
  | {
      version: "icn-bulk-import-v1";
      generatedAt?: string;
      dataset?: string;
      recordCount?: number;
      records?: unknown[];
      datasets?: { dataset?: string; records?: unknown[] }[];
    }
  | any;

export type PersistKeyInfo = { key: string; wrapped: boolean; score: number };

const QUEUE_KEY = "icn_import_queue_v1";
const LATEST_BACKUP_KEY = "icn_latest_backup_key_v1";
const BACKUP_PREFIX = "icn_state_backup_";

export function readQueue(): any[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY) || "[]";
    const q = JSON.parse(raw);
    return Array.isArray(q) ? q : [];
  } catch {
    return [];
  }
}

export function writeQueue(q: any[]) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(q));
}

export function parseMaybeJsonText(text: string): any | null {
  const t = (text || "").trim();
  if (!t) return null;
  try {
    return JSON.parse(t);
  } catch {}
  const i1 = t.indexOf("{");
  const i2 = t.lastIndexOf("}");
  if (i1 !== -1 && i2 !== -1 && i2 > i1) {
    try {
      return JSON.parse(t.slice(i1, i2 + 1));
    } catch {}
  }
  return null;
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

    try {
      const obj = JSON.parse(raw);
      const wrapped = !!obj?.state;
      const state = wrapped ? obj.state : obj;
      const sc = scoreState(state);
      if (sc <= 0) continue;

      if (!best || sc > best.score) best = { key: k, wrapped, score: sc };
    } catch {}
  }

  return best;
}

export function getPersistState(info: PersistKeyInfo): { raw: string; obj: any; state: any } {
  const raw = localStorage.getItem(info.key) || "";
  let obj: any = {};
  try {
    obj = raw ? JSON.parse(raw) : {};
  } catch {
    obj = {};
  }
  const state = info.wrapped ? (obj?.state ?? {}) : obj;
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

export function createBackup(beforeRaw: string): string {
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  const bkey = BACKUP_PREFIX + stamp;
  localStorage.setItem(bkey, beforeRaw || "");
  localStorage.setItem(LATEST_BACKUP_KEY, bkey);
  return bkey;
}

export function latestBackupKey(): string {
  return localStorage.getItem(LATEST_BACKUP_KEY) || "";
}

function ensure(obj: any, path: string, def: any) {
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

function toISODate(s: any): string {
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

function normalizeResidentId(r: any): string {
  const rid = r?.residentId ?? r?.patientId ?? r?.id ?? "";
  const mrn = r?.mrn ?? r?.MRN ?? "";
  if (String(rid).startsWith("MRN-")) return String(rid);
  if (mrn) return "MRN-" + String(mrn).trim();
  return String(rid || "");
}

function mapABT(r: any) {
  return {
    id: r?.id || "",
    residentId: normalizeResidentId(r),
    residentName: r?.residentName || r?.name || r?.patientName || "",
    mrn: r?.mrn || "",
    unit: r?.unit || "",
    room: r?.room || r?.roomNumber || "",
    dob: toISODate(r?.dob || r?.dateOfBirth || ""),
    antibiotic: r?.antibiotic || r?.med || r?.drug || "",
    klass: r?.klass || r?.class || "Auto",
    route: r?.route || "",
    start: toISODate(r?.start || r?.startDate || ""),
    end: toISODate(r?.end || r?.endDate || ""),
    indication: r?.indication || "",
    infectionSource: r?.infectionSource || "",
    notes: r?.notes || "",
    raw: r,
  };
}

function mapVAX(r: any) {
  return {
    id: r?.id || "",
    residentId: normalizeResidentId(r),
    patientName: r?.patientName || r?.name || r?.residentName || "",
    mrn: r?.mrn || "",
    roomNumber: r?.roomNumber || r?.room || "",
    unit: r?.unit || "",
    dateOfBirth: toISODate(r?.dateOfBirth || r?.dob || ""),
    patientStatus: r?.patientStatus || "",
    vaccineType: r?.vaccineType || r?.vaccine || "",
    status: r?.status || r?.vaxStatus || "",
    date: toISODate(r?.date || ""),
    notes: r?.notes || "",
    raw: r,
  };
}

function mapIP(r: any) {
  return {
    id: r?.id || "",
    residentId: normalizeResidentId(r),
    residentName: r?.residentName || r?.name || "",
    mrn: r?.mrn || "",
    room: r?.room || "",
    unit: r?.unit || "",
    dob: toISODate(r?.dob || ""),
    status: r?.status || r?.caseStatus || "ACTIVE",
    onsetDate: toISODate(r?.onsetDate || ""),
    resolutionDate: toISODate(r?.resolutionDate || ""),
    precautionType: r?.precautionType || "",
    isolationType: r?.isolationType || "",
    requiredPPE: r?.requiredPPE || "",
    sourceCondition: r?.sourceCondition || r?.source || r?.condition || "",
    pathogen: r?.pathogen || "",
    nhsnPathogenCode: r?.nhsnPathogenCode || r?.nhsnCode || "",
    staffAssignments48hPreOnset: Array.isArray(r?.staffAssignments48hPreOnset)
      ? r.staffAssignments48hPreOnset
      : Array.isArray(r?.staffAssignments)
        ? r.staffAssignments
        : [],
    closeContacts: Array.isArray(r?.closeContacts) ? r.closeContacts : [],
    raw: r,
  };
}

function mapResident(r: any) {
  const rid = r?.residentId || normalizeResidentId(r);
  return {
    residentId: rid,
    mrn: r?.mrn || (String(rid).startsWith("MRN-") ? String(rid).replace("MRN-", "") : ""),
    name: r?.name || r?.residentName || r?.patientName || "",
    room: r?.room || r?.roomNumber || "",
    unit: r?.unit || "",
    dob: toISODate(r?.dob || r?.dateOfBirth || ""),
    raw: r,
  };
}

function abtKey(r: any): string {
  if (r?.id) return "id:" + String(r.id);
  return (
    "abt:" +
    [r?.residentId || r?.mrn || "", r?.antibiotic || "", r?.route || "", r?.start || "", r?.end || ""]
      .map((x: any) => String(x).trim().toUpperCase())
      .join("|")
  );
}
function vaxKey(r: any): string {
  if (r?.id) return "id:" + String(r.id);
  return (
    "vax:" +
    [r?.mrn || "", r?.vaccineType || "", r?.date || "", r?.status || ""]
      .map((x: any) => String(x).trim().toUpperCase())
      .join("|")
  );
}
function ipKey(r: any): string {
  if (r?.id) return "id:" + String(r.id);
  return (
    "ip:" +
    [r?.mrn || r?.residentId || "", r?.precautionType || "", r?.isolationType || "", r?.onsetDate || "", r?.resolutionDate || "", r?.status || ""]
      .map((x: any) => String(x).trim().toUpperCase())
      .join("|")
  );
}

// ---- THIS is the section that was failing TS7006 ----
type DatasetPart = { dataset?: string; records?: unknown[] };

export function normalizePack(pack: IcnBulkPackV1): { dataset: string; records: any[] }[] | null {
  if (!pack || pack.version !== "icn-bulk-import-v1") return null;

  if (Array.isArray(pack.datasets)) {
    return (pack.datasets as DatasetPart[]).map((d: DatasetPart) => ({
      dataset: String(d?.dataset || "generic"),
      records: Array.isArray(d?.records) ? (d.records as any[]) : [],
    }));
  }

  return [
    {
      dataset: String((pack as any).dataset || "generic"),
      records: Array.isArray((pack as any).records) ? (pack as any).records : [],
    },
  ];
}

export type ApplyResult = {
  applied: { dataset: string; added: number }[];
  dropped: number;
  backupKey: string;
  persistKey: string;
};

export function applyPacksToPersist(packs: IcnBulkPackV1[]): ApplyResult {
  const info = detectPersistKey();
  if (!info) throw new Error("Persisted tracker state not detected. Open the tracker once, then retry.");

  const { raw, obj, state } = getPersistState(info);

  const backupKey = createBackup(raw);

  // Ensure canonical paths
  ensure(state, "modules", {});
  ensure(state, "modules.abt", {});
  ensure(state, "modules.abt.courses", []);
  ensure(state, "modules.vaccinations", {});
  ensure(state, "modules.vaccinations.records", []);
  ensure(state, "modules.ip", {});
  ensure(state, "modules.ip.cases", []);
  ensure(state, "residentsById", {});
  ensure(state, "migrations", {});
  (state.migrations ||= {}).importTabV1 = new Date().toISOString();

  const abtArr = state.modules.abt.courses as any[];
  const vaxArr = state.modules.vaccinations.records as any[];
  const ipArr = state.modules.ip.cases as any[];
  const residentsById = state.residentsById as Record<string, any>;

  // IMPORTANT: annotate callback params to avoid TS7006
  const seenABT = new Set(abtArr.map((x: any) => abtKey(mapABT(x))));
  const seenVAX = new Set(vaxArr.map((x: any) => vaxKey(mapVAX(x))));
  const seenIP = new Set(ipArr.map((x: any) => ipKey(mapIP(x))));

  let dropped = 0;
  const applied: { dataset: string; added: number }[] = [];

  const partsAll: { dataset: string; records: any[] }[] = [];
  for (const p of packs) {
    const parts = normalizePack(p);
    if (parts) partsAll.push(...parts);
  }

  for (const part of partsAll) {
    const ds = String(part.dataset || "generic").toLowerCase();
    const recs = Array.isArray(part.records) ? part.records : [];

    if (ds === "residents") {
      let add = 0;
      for (const r of recs) {
        const rr = mapResident(r);
        const key = rr.residentId || ("MRN-" + (rr.mrn || ""));
        if (key && !residentsById[key]) {
          residentsById[key] = rr;
          add++;
        }
      }
      applied.push({ dataset: "residents", added: add });
      continue;
    }

    if (ds === "abt") {
      let add = 0;
      for (const r of recs) {
        const rr = mapABT(r);
        const k = abtKey(rr);
        if (seenABT.has(k)) {
          dropped++;
          continue;
        }
        seenABT.add(k);
        abtArr.push(rr);
        add++;
      }
      applied.push({ dataset: "abt", added: add });
      continue;
    }

    if (ds === "vaccinations" || ds === "vax") {
      let add = 0;
      for (const r of recs) {
        const rr = mapVAX(r);
        const k = vaxKey(rr);
        if (seenVAX.has(k)) {
          dropped++;
          continue;
        }
        seenVAX.add(k);
        vaxArr.push(rr);
        add++;
      }
      applied.push({ dataset: "vaccinations", added: add });
      continue;
    }

    if (ds === "ip") {
      let add = 0;
      for (const r of recs) {
        const rr = mapIP(r);
        const k = ipKey(rr);
        if (seenIP.has(k)) {
          dropped++;
          continue;
        }
        seenIP.add(k);
        ipArr.push(rr);
        add++;
      }
      applied.push({ dataset: "ip", added: add });
      continue;
    }

    // Unknown dataset -> store under state.imports for later inspection
    ensure(state, "imports", []);
    if (Array.isArray(state.imports)) {
      state.imports.push({ dataset: ds, importedAt: new Date().toISOString(), records: recs });
      applied.push({ dataset: ds, added: recs.length });
    }
  }

  writePersistState(info, obj, state);

  return { applied, dropped, backupKey, persistKey: info.key };
}
