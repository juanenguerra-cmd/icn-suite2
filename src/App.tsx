import React from "react";
import { CensusPage } from "@/features/census/CensusPage";
import { VaccinationPage } from "@/features/vaccination/VaccinationPage";

type TabId = "census" | "vaccinations";

export default function App() {
  const [tab, setTab] = React.useState<TabId>("census");

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-6xl mx-auto px-4 md:px-6 pt-4">
        <div className="rounded-xl border bg-white shadow-sm p-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="font-semibold">ICN Suite</div>
            <div className="ml-auto flex gap-2">
              <button
                type="button"
                className={
                  "rounded-full border px-4 py-2 hover:bg-gray-50 " +
                  (tab === "census" ? "bg-gray-50" : "")
                }
                onClick={() => setTab("census")}
              >
                Census
              </button>
              <button
                type="button"
                className={
                  "rounded-full border px-4 py-2 hover:bg-gray-50 " +
                  (tab === "vaccinations" ? "bg-gray-50" : "")
                }
                onClick={() => setTab("vaccinations")}
              >
                Vaccinations
              </button>
            </div>
          </div>
        </div>
      </div>

      {tab === "census" ? <CensusPage /> : <VaccinationPage />}
    </div>
  );
}
