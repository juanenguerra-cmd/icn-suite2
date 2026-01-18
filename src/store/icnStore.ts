import { create, type StateCreator } from "zustand";
import { persist } from "zustand/middleware";
import type { ICNState, Resident, CensusSnapshot, VaccineRecord } from "@/types/icn";
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

      exportState: () => {
        const s = get();
        return {
          schemaVersion: s.schemaVersion,
          residentsById: s.residentsById,
          censusHistory: s.censusHistory,
          vaccinesByResidentId: s.vaccinesByResidentId,
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
            vaccinesByResidentId: d.vaccinesByResidentId ?? {}
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

      resetAll: () =>
        set({ schemaVersion: SCHEMA_VERSION, residentsById: {}, censusHistory: [], vaccinesByResidentId: {} })
    });

export const useICNStore = create<ICNState>()(
  persist(storeCreator, {
      name: "icn-suite-state-v1",
      partialize: (s: ICNState) => ({
        schemaVersion: s.schemaVersion,
        residentsById: s.residentsById,
        censusHistory: s.censusHistory,
        vaccinesByResidentId: s.vaccinesByResidentId
      })
    })
);
