import { create } from "zustand";
import { persist } from "zustand/middleware";

import type {
  ICNState,
  Resident,
  CensusSnapshot,
  VaccineRecord,
  AntibioticRecord,
  AbxStatus
} from "@/types/icn";

const SCHEMA_VERSION = 3;

function nowISO() {
  return new Date().toISOString();
}

function id(prefix: string) {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

// Batch entry shapes (kept simple)
type VaccineEntryInput = {
  name?: string;
  nameOther?: string;
  dateISO?: string;
  notes?: string;
};

type AbxEntryInput = {
  antibiotic?: string;
  startDateISO?: string;
  indication?: string;
  notes?: string;
};

export const useICNStore = create<ICNState>()(
  persist(
    (set, get) => ({
      schemaVersion: SCHEMA_VERSION,

      // Core
      residentsById: {},
      censusHistory: [],

      // Vaccines
      vaccinesByResidentId: {},

      // ABT
      abxByResidentId: {},

      // Export / Import
      exportState: () => {
        const s = get();
        return {
          schemaVersion: s.schemaVersion,
          residentsById: s.residentsById,
          censusHistory: s.censusHistory,
          vaccinesByResidentId: s.vaccinesByResidentId,
          abxByResidentId: s.abxByResidentId,
          exportedISO: nowISO()
        };
      },

      importState: (data: unknown) => {
        try {
          const d = data as any;
          if (!d || typeof d !== "object") return;

          set({
            schemaVersion: typeof d.schemaVersion === "number" ? d.schemaVersion : SCHEMA_VERSION,
            residentsById: d.residentsById ?? {},
            censusHistory: d.censusHistory ?? [],
            vaccinesByResidentId: d.vaccinesByResidentId ?? {},
            abxByResidentId: d.abxByResidentId ?? {}
          });
        } catch {
          // no-op
        }
      },

      resetAll: () =>
        set({
          schemaVersion: SCHEMA_VERSION,
          residentsById: {},
          censusHistory: [],
          vaccinesByResidentId: {},
          abxByResidentId: {}
        }),

      // Census
      applyCensus: (snapshot: CensusSnapshot) => {
        const prev = get().residentsById;
        const next: Record<string, Resident> = { ...prev };

        // mark all as discharged until seen again
        for (const rid of Object.keys(next)) {
          next[rid] = { ...next[rid], status: "discharged" };
        }

        for (const r of snapshot.residents) {
          next[r.id] = {
            ...(next[r.id] ?? r),
            ...r,
            status: "active",
            lastSeenISO: snapshot.createdISO
          };
        }

        set((s: ICNState) => ({
          residentsById: next,
          censusHistory: [snapshot, ...s.censusHistory].slice(0, 120)
        }));
      },

      // --------------------
      // Vaccines
      // --------------------
      addVaccinesBatch: (residentId: string, entries: VaccineEntryInput[]) => {
        if (!residentId) return;

        const cleaned = (entries ?? [])
          .map((e) => ({
            name: (e.name ?? "").trim(),
            nameOther: (e.nameOther ?? "").trim(),
            dateISO: (e.dateISO ?? "").trim(),
            notes: (e.notes ?? "").trim()
          }))
          .filter((e) => !!e.name && !!e.dateISO);

        if (cleaned.length === 0) return;

        set((s: ICNState) => {
          const prev = s.vaccinesByResidentId[residentId] ?? [];
          const adds: VaccineRecord[] = cleaned.map((e) => ({
            id: id("vx"),
            residentId,
            name: e.name as any, // your VaccineName union lives in types/icn.ts
            nameOther: e.name === "Other" ? e.nameOther || "Other" : undefined,
            dateISO: e.dateISO!,
            notes: e.notes || undefined,
            createdISO: nowISO()
          }));

          return {
            vaccinesByResidentId: {
              ...s.vaccinesByResidentId,
              [residentId]: [...adds, ...prev]
            }
          };
        });
      },

      deleteVaccine: (residentId: string, vaccineId: string) => {
        if (!residentId || !vaccineId) return;

        set((s: ICNState) => {
          const prev = s.vaccinesByResidentId[residentId] ?? [];
          const next = prev.filter((v) => v.id !== vaccineId);
          return {
            vaccinesByResidentId: {
              ...s.vaccinesByResidentId,
              [residentId]: next
            }
          };
        });
      },

      // --------------------
      // ABT
      // --------------------
      addAbxBatch: (residentId: string, entries: AbxEntryInput[]) => {
        if (!residentId) return;

        const cleaned = (entries ?? [])
          .map((e) => ({
            antibiotic: (e.antibiotic ?? "").trim(),
            startDateISO: (e.startDateISO ?? "").trim(),
            indication: (e.indication ?? "").trim(),
            notes: (e.notes ?? "").trim()
          }))
          .filter((e) => !!e.antibiotic && !!e.startDateISO);

        if (cleaned.length === 0) return;

        set((s: ICNState) => {
          const prev = s.abxByResidentId[residentId] ?? [];

          const adds: AntibioticRecord[] = cleaned.map((e) => ({
            id: id("abx"),
            residentId,
            antibiotic: e.antibiotic!,
            startDateISO: e.startDateISO!,
            indication: e.indication || undefined,
            notes: e.notes || undefined,
            status: "active" as AbxStatus,
            createdISO: nowISO()
          }));

          return {
            abxByResidentId: {
              ...s.abxByResidentId,
              [residentId]: [...adds, ...prev]
            }
          };
        });
      },

      stopAbx: (residentId: string, abxId: string, stopDateISO: string) => {
        if (!residentId || !abxId || !stopDateISO) return;
        const stop = stopDateISO.trim();
        if (!stop) return;

        set((s: ICNState) => {
          const prev = s.abxByResidentId[residentId] ?? [];
          const next: AntibioticRecord[] = prev.map((a) =>
            a.id === abxId
              ? {
                  ...a,
                  status: "stopped" as AbxStatus,
                  stopDateISO: stop,
                  updatedISO: nowISO()
                }
              : a
          );

          return {
            abxByResidentId: {
              ...s.abxByResidentId,
              [residentId]: next
            }
          };
        });
      },

      stopAbxToday: (residentId: string, abxId: string) => {
        get().stopAbx(residentId, abxId, todayISO());
      },

      deleteAbx: (residentId: string, abxId: string) => {
        if (!residentId || !abxId) return;

        set((s: ICNState) => {
          const prev = s.abxByResidentId[residentId] ?? [];
          const next = prev.filter((a) => a.id !== abxId);
          return {
            abxByResidentId: {
              ...s.abxByResidentId,
              [residentId]: next
            }
          };
        });
      }
    }),
    {
      name: "icn-suite-state-v3",
      partialize: (s: ICNState) => ({
        schemaVersion: s.schemaVersion,
        residentsById: s.residentsById,
        censusHistory: s.censusHistory,
        vaccinesByResidentId: s.vaccinesByResidentId,
        abxByResidentId: s.abxByResidentId
      })
    }
  )
);
