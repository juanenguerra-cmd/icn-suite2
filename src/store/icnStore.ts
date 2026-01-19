import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ICNState, Resident, CensusSnapshot } from "@/types/icn";

const SCHEMA_VERSION = 1;

function nowISO() {
  return new Date().toISOString();
}

export const useICNStore = create<ICNState>()(
  persist(
    (set, get) => ({
      schemaVersion: SCHEMA_VERSION,
      residentsById: {},
      censusHistory: [],

      exportState: () => {
        const s = get();
        return {
          schemaVersion: s.schemaVersion,
          residentsById: s.residentsById,
          censusHistory: s.censusHistory,
          exportedISO: nowISO()
        };
      },

      importState: (data) => {
        try {
          const d = data as any;
          if (!d || typeof d !== "object") return;

          set({
            schemaVersion: typeof d.schemaVersion === "number" ? d.schemaVersion : SCHEMA_VERSION,
            residentsById: d.residentsById ?? {},
            censusHistory: d.censusHistory ?? []
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

      resetAll: () =>
        set({ schemaVersion: SCHEMA_VERSION, residentsById: {}, censusHistory: [] })
    }),
    {
      name: "icn-suite-state-v1",
      partialize: (s) => ({
        schemaVersion: s.schemaVersion,
        residentsById: s.residentsById,
        censusHistory: s.censusHistory
      })
    }
  )
);
