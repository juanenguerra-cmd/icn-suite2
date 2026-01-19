import React, { createContext, useContext, useEffect, useMemo, useReducer } from 'react';
import type {
  AppData,
  AntibioticEntry,
  Config,
  InfectionCase,
  Resident,
  ResidentNote,
  VaccinationEntry
} from '../types/core';
import { loadLS, saveLS } from '../utils/storage';
import { nowISO } from '../utils/time';

const DATA_LS_KEY = 'icn-suite:data';
const DATA_VERSION = 'react-v0.3';

type Action =
  | { type: 'SET_CONFIG'; config: Partial<Config> }
  | { type: 'CENSUS_SET_RAW'; rawText: string }
  | { type: 'CENSUS_APPLY'; entries: { id: string; resident: Resident }[]; activeIds: string[] }
  | { type: 'CENSUS_RECORD_SNAPSHOT'; date: string; unitCounts: Record<string, number>; total: number };
  
type ListAction<T> =
  | { type: 'LIST_ADD'; list: 'vaccinations' | 'antibiotics' | 'infectionCases' | 'residentNotes'; item: T }
  | { type: 'LIST_ADD_MANY'; list: 'vaccinations' | 'antibiotics' | 'infectionCases' | 'residentNotes'; items: T[] }
  | { type: 'LIST_UPDATE'; list: 'vaccinations' | 'antibiotics' | 'infectionCases' | 'residentNotes'; id: string; patch: Partial<T> }
  | { type: 'LIST_DELETE'; list: 'vaccinations' | 'antibiotics' | 'infectionCases' | 'residentNotes'; id: string };

type DataAction =
  | { type: 'LOAD_DATA'; data: AppData }
  | { type: 'MERGE_DATA'; patch: Partial<AppData> }
  | ListAction<VaccinationEntry>
  | ListAction<AntibioticEntry>
  | ListAction<InfectionCase>
  | ListAction<ResidentNote>;

type AllActions = Action | DataAction;

type Store = {
  data: AppData;
  dispatch: React.Dispatch<AllActions>;
  resetAll: () => void;
};

const IcnStoreContext = createContext<Store | null>(null);

function defaultConfig(): Config {
  return {
    facilityName: 'Facility',
    totalCapacity: 150,
    units: [
      { unitKey: 'Unit 2', unitName: 'Unit 2', capacity: 50 },
      { unitKey: 'Unit 3', unitName: 'Unit 3', capacity: 50 },
      { unitKey: 'Unit 4', unitName: 'Unit 4', capacity: 50 }
    ],
    unitAliases: {
      '2': 'Unit 2',
      '3': 'Unit 3',
      '4': 'Unit 4'
    }
  };
}

function defaultData(): AppData {
  return {
    version: DATA_VERSION,
    config: defaultConfig(),
    residentsById: {},
    census: { rawText: '', lastPastedAt: null, activeResidentIds: [] },
    censusHistory: [],
    vaccinations: [],
    antibiotics: [],
    infectionCases: [],
    residentNotes: []
  };
}

function normalizeImportedData(d: any): AppData {
  const base = defaultData();
  if (!d || typeof d !== 'object') return base;

  const cfg = d.config && typeof d.config === 'object' ? d.config : {};
  const units = Array.isArray(cfg.units) ? cfg.units : base.config.units;
  const unitAliases = cfg.unitAliases && typeof cfg.unitAliases === 'object' ? cfg.unitAliases : base.config.unitAliases;

  return {
    version: DATA_VERSION,
    config: {
      facilityName: typeof cfg.facilityName === 'string' ? cfg.facilityName : base.config.facilityName,
      totalCapacity: Number(cfg.totalCapacity || base.config.totalCapacity) || base.config.totalCapacity,
      units: units.map((u: any) => ({
        unitKey: (u.unitKey || u.unitName || 'Unassigned') as any,
        unitName: String(u.unitName || u.unitKey || ''),
        capacity: Number(u.capacity || 0) || 0
      })),
      unitAliases: Object.fromEntries(Object.entries(unitAliases).map(([k, v]) => [String(k), String(v)]))
    },
    residentsById: d.residentsById && typeof d.residentsById === 'object' ? d.residentsById : {},
    census: {
      rawText: String(d.census?.rawText || ''),
      lastPastedAt: d.census?.lastPastedAt ? String(d.census.lastPastedAt) : null,
      activeResidentIds: Array.isArray(d.census?.activeResidentIds) ? d.census.activeResidentIds.map(String) : []
    },
    censusHistory: Array.isArray(d.censusHistory) ? d.censusHistory : [],
    vaccinations: Array.isArray(d.vaccinations) ? d.vaccinations : [],
    antibiotics: Array.isArray(d.antibiotics) ? d.antibiotics : [],
    infectionCases: Array.isArray(d.infectionCases) ? d.infectionCases : [],
    residentNotes: Array.isArray(d.residentNotes) ? d.residentNotes : []
  };
}

function reducer(state: AppData, action: AllActions): AppData {
  switch (action.type) {
    case 'LOAD_DATA': {
      return normalizeImportedData(action.data);
    }

    case 'MERGE_DATA': {
      const incoming = normalizeImportedData({ ...state, ...(action.patch || {}) } as any);

      // Merge config (prefer incoming)
      const config = { ...state.config, ...(incoming.config || {}) };

      // Merge residents
      const residentsById = { ...state.residentsById };
      for (const [id, r] of Object.entries(incoming.residentsById || {})) {
        if (!id || !r) continue;
        const prev = residentsById[id];
        residentsById[id] = {
          ...(prev || (r as any)),
          ...(r as any),
          id,
          createdAt: (prev?.createdAt || (r as any).createdAt || nowISO()) as any,
          updatedAt: nowISO()
        };
      }

      // Merge lists with light dedupe
      function dedupeKey(list: 'vaccinations' | 'antibiotics' | 'infectionCases', x: any): string {
        if (list === 'vaccinations') {
          return [x.residentId, x.dateISO, String(x.vaccineType || '').toLowerCase(), String(x.status || '').toLowerCase()].join('|');
        }
        if (list === 'antibiotics') {
          return [x.residentId, x.startDateISO, String(x.medication || '').toLowerCase()].join('|');
        }
        return [x.residentId, x.onsetDateISO, String(x.precautions || '').toLowerCase(), String(x.organism || '').toLowerCase(), String(x.syndrome || '').toLowerCase()].join('|');
      }

      function dedupeKeyNotes(x: any): string {
        return [x.residentId, x.dateISO, String(x.text || '').toLowerCase()].join('|');
      }

      function mergeList<T>(listName: 'vaccinations' | 'antibiotics' | 'infectionCases'): T[] {
        const a = ((state as any)[listName] as any[]) || [];
        const b = ((incoming as any)[listName] as any[]) || [];
        const seen = new Set<string>();
        const out: any[] = [];
        for (const item of [...b, ...a]) {
          if (!item) continue;
          const k = dedupeKey(listName, item);
          if (seen.has(k)) continue;
          seen.add(k);
          out.push(item);
        }
        return out as T[];
      }

      return {
        ...state,
        version: DATA_VERSION,
        config,
        residentsById,
        // Keep existing census state unless explicitly provided
        census: action.patch?.census ? incoming.census : state.census,
        censusHistory: action.patch?.censusHistory ? incoming.censusHistory : state.censusHistory,
        vaccinations: mergeList('vaccinations'),
        antibiotics: mergeList('antibiotics'),
        infectionCases: mergeList('infectionCases'),
        residentNotes: (() => {
          const a = (state.residentNotes as any[]) || [];
          const b = (incoming.residentNotes as any[]) || [];
          const seen = new Set<string>();
          const out: any[] = [];
          for (const item of [...b, ...a]) {
            if (!item) continue;
            const k = dedupeKeyNotes(item);
            if (seen.has(k)) continue;
            seen.add(k);
            out.push(item);
          }
          return out as ResidentNote[];
        })()
      };
    }
    case 'SET_CONFIG': {
      const next: AppData = {
        ...state,
        config: { ...state.config, ...action.config }
      };
      return next;
    }
    case 'CENSUS_SET_RAW': {
      return {
        ...state,
        census: {
          ...state.census,
          rawText: action.rawText
        }
      };
    }
    case 'CENSUS_APPLY': {
      const now = nowISO();
      const residentsById = { ...state.residentsById };
      // Merge in parsed residents
      for (const row of action.entries) {
        const prev = residentsById[row.id];
        const merged: Resident = {
          ...(prev || { id: row.id, createdAt: now }),
          ...row.resident,
          id: row.id,
          createdAt: prev?.createdAt || now,
          updatedAt: now
        };
        residentsById[row.id] = merged;
      }

      // Smart Restore: mark residents not on the current census as discharged, but preserve last-known location.
      const activeSet = new Set(action.activeIds);
      for (const id of Object.keys(residentsById)) {
        const r = residentsById[id];
        if (!r) continue;
        if (activeSet.has(id)) {
          residentsById[id] = {
            ...r,
            status: 'Active',
            lastSeenOnCensus: now
          };
        } else {
          // If previously active, mark discharged.
          if (r.status !== 'Discharged') {
            residentsById[id] = {
              ...r,
              status: 'Discharged',
              lockedRoom: r.room || r.lockedRoom,
              lockedUnit: r.unit || r.lockedUnit,
              lastSeenOnCensus: r.lastSeenOnCensus || state.census.lastPastedAt || null,
              updatedAt: now
            };
          }
        }
      }

      return {
        ...state,
        residentsById,
        census: {
          rawText: state.census.rawText,
          lastPastedAt: now,
          activeResidentIds: action.activeIds
        }
      };
    }
    case 'CENSUS_RECORD_SNAPSHOT': {
      const snap = { date: action.date, unitCounts: action.unitCounts, total: action.total, updatedAt: nowISO() };
      const history = [...state.censusHistory];
      const idx = history.findIndex((x) => x && x.date === action.date);
      if (idx >= 0) history[idx] = snap;
      else history.push(snap);
      if (history.length > 120) history.splice(0, history.length - 120);
      return { ...state, censusHistory: history };
    }

    case 'LIST_ADD': {
      const now = nowISO();
      const listName = action.list;
      const list = (state as any)[listName] as any[];
      const item = { ...action.item };
      if (!item.createdAt) item.createdAt = now;
      (item as any).updatedAt = now;
      return { ...(state as any), [listName]: [item, ...list] } as AppData;
    }

    case 'LIST_ADD_MANY': {
      const now = nowISO();
      const listName = action.list;
      const list = ((state as any)[listName] as any[]) || [];
      const items = (action.items || []).map((x: any) => {
        const item = { ...x };
        if (!item.createdAt) item.createdAt = now;
        item.updatedAt = now;
        return item;
      });
      // Prepend new items (most recent first)
      return { ...(state as any), [listName]: [...items, ...list] } as AppData;
    }

    case 'LIST_UPDATE': {
      const now = nowISO();
      const listName = action.list;
      const list = ((state as any)[listName] as any[]) || [];
      const next = list.map((x) => (x && x.id === action.id ? { ...x, ...action.patch, updatedAt: now } : x));
      return { ...(state as any), [listName]: next } as AppData;
    }
    case 'LIST_DELETE': {
      const listName = action.list;
      const list = ((state as any)[listName] as any[]) || [];
      const next = list.filter((x) => x && x.id !== action.id);
      return { ...(state as any), [listName]: next } as AppData;
    }
    default:
      return state;
  }
}

export function IcnStoreProvider({ children }: { children: React.ReactNode }) {
  const initial = useMemo(() => {
    const loaded = loadLS<any>(DATA_LS_KEY, null);
    return normalizeImportedData(loaded);
  }, []);

  const [data, dispatch] = useReducer(reducer, initial);

  useEffect(() => {
    saveLS(DATA_LS_KEY, data);
  }, [data]);

  function resetAll() {
    if (!confirm('Reset ALL ICN Suite data in this browser?')) return;
    localStorage.removeItem(DATA_LS_KEY);
    window.location.reload();
  }

  const value: Store = useMemo(() => ({ data, dispatch, resetAll }), [data]);

  return <IcnStoreContext.Provider value={value}>{children}</IcnStoreContext.Provider>;
}

export function useICNStore(): Store {
  const ctx = useContext(IcnStoreContext);
  if (!ctx) throw new Error('useIcnStore must be used inside IcnStoreProvider');
  return ctx;
}

// Backward-compatible alias
export const useIcnStore = useICNStore;

export const ICN_DATA_LS_KEY = DATA_LS_KEY;