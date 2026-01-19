import { create, type StateCreator } from "zustand";
import { persist } from "zustand/middleware";
import type { ICNState, Resident, CensusSnapshot, VaccineRecord, AntibioticRecord } from "@/types/icn";
import { makeId } from "@/lib/id";

const SCHEMA_VERSION = 1;

function nowISO() {
  return new Date().toISOString();
}

const storeCreator: StateCreator<ICNState> = (set, get) => ({
      schemaVersion: SCHEMA_VERSION,
      residentsById: {},
      censusHistory: [],

      vaccinesByResidentId: {},

      abxByResidentId: {},

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

      applyCensus: (snapshot: CensusSnapshot) => {
        const prev = get().residentsById;
        const next: Record<string, Resident> = { ...prev };

        // Mark all as discharged first; flip back to active when seen in this census
        for (const id of Object.keys(next)) {
          next[id] = { ...next[id], status: "discharged" };
        }

        for (const r of snapshot.residents) {
          next[r.id] = {
            ...(next[r.id] ?? r),
            ...r,
            status: "active",
            lastSeenISO: snapshot.createdISO
          };
        }

        set((s) => ({
          residentsById: next,
          censusHistory: [snapshot, ...s.censusHistory].slice(0, 100)
        }));
      },

      addVaccinesBatch: (residentId, entries) => {
        if (!residentId) return;
        const cleaned = (entries || [])
          .map((e) => ({
            name: e.name,
            nameOther: e.nameOther?.trim() || undefined,
            dateISO: (e.dateISO || "").trim(),
            notes: e.notes?.trim() || undefined
          }))
          .filter((e) => !!e.name && !!e.dateISO);

        if (cleaned.length === 0) return;

        set((s) => {
          const prev = s.vaccinesByResidentId[residentId] ?? [];
          const createdISO = nowISO();
          const nextAdds: VaccineRecord[] = cleaned.map((e) => ({
            id: makeId("vx"),
            residentId,
            name: e.name,
            nameOther: e.name === "Other" ? e.nameOther : undefined,
            dateISO: e.dateISO,
            notes: e.notes,
            createdISO
          }));

          const next = [...nextAdds, ...prev].sort((a, b) => (a.dateISO < b.dateISO ? 1 : -1));
          return {
            vaccinesByResidentId: {
              ...s.vaccinesByResidentId,
              [residentId]: next
            }
          };
        });
      },

      deleteVaccine: (residentId, vaccineId) => {
        if (!residentId || !vaccineId) return;
        set((s) => {
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

      addAbxBatch: (residentId, entries) => {
        if (!residentId) return;
        const cleaned = (entries || [])
          .map((e) => ({
            antibiotic: (e.antibiotic || "").trim(),
            startDateISO: (e.startDateISO || "").trim(),
            stopDateISO: (e.stopDateISO || "").trim() || undefined,
            indication: e.indication?.trim() || undefined,
            notes: e.notes?.trim() || undefined
          }))
          .filter((e) => !!e.antibiotic && !!e.startDateISO);

        if (cleaned.length === 0) return;

        set((s) => {
          const prev = s.abxByResidentId[residentId] ?? [];
          const createdISO = nowISO();
          const nextAdds: AntibioticRecord[] = cleaned.map((e) => {
            const status: AntibioticRecord["status"] = e.stopDateISO ? "stopped" : "active";
            return {
              id: makeId("abx"),
              residentId,
              antibiotic: e.antibiotic,
              startDateISO: e.startDateISO,
              stopDateISO: e.stopDateISO,
              indication: e.indication,
              notes: e.notes,
              status,
              createdISO,
              updatedISO: createdISO
            };
          });

          // active first, then newest start date
          const next = [...nextAdds, ...prev].sort((a, b) => {
            if (a.status !== b.status) return a.status === "active" ? -1 : 1;
            if (a.startDateISO === b.startDateISO) return (a.createdISO < b.createdISO ? 1 : -1);
            return a.startDateISO < b.startDateISO ? 1 : -1;
          });

          return {
            abxByResidentId: {
              ...s.abxByResidentId,
              [residentId]: next
            }
          };
        });
      },

      stopAbx: (residentId, abxId, stopDateISO) => {
        if (!residentId || !abxId || !stopDateISO) return;
        const stop = stopDateISO.trim();
        if (!stop) return;
        set((s) => {
          const prev = s.abxByResidentId[residentId] ?? [];
          const next = prev.map((a) =>
            a.id === abxId
              ? {
                  ...a,
                  status: "stopped",
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

      deleteAbx: (residentId, abxId) => {
        if (!residentId || !abxId) return;
        set((s) => {
          const prev = s.abxByResidentId[residentId] ?? [];
          const next = prev.filter((a) => a.id !== abxId);
          return {
            abxByResidentId: {
              ...s.abxByResidentId,
              [residentId]: next
            }
          };
        });
      },

      resetAll: () =>
        set({
          schemaVersion: SCHEMA_VERSION,
          residentsById: {},
          censusHistory: [],
          vaccinesByResidentId: {},
          abxByResidentId: {}
        })
    });

export const useICNStore = create<ICNState>()(
  persist(storeCreator, {
      name: "icn-suite-state-v1",
      partialize: (s: ICNState) => ({
        schemaVersion: s.schemaVersion,
        residentsById: s.residentsById,
        censusHistory: s.censusHistory,
        vaccinesByResidentId: s.vaccinesByResidentId,
        abxByResidentId: s.abxByResidentId
      })
    })
);
