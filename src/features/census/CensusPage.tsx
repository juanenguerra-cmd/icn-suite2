import React from "react";
import { parseCensus } from "./parseCensus";
import { useICNStore } from "@/store/icnStore";
import type { ICNState } from "@/types/icn";

export function CensusPage() {
  const applyCensus = useICNStore((s: ICNState) => s.applyCensus);
  const residents = useICNStore((s: ICNState) => Object.values(s.residentsById));

  const [raw, setRaw] = React.useState("");
  const [preview, setPreview] = React.useState<ReturnType<typeof parseCensus> | null>(null);

  const activeCount = residents.filter((r) => r.status === "active").length;
  const dischargedCount = residents.filter((r) => r.status === "discharged").length;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-5xl mx-auto p-6">
        <div className="mb-6">
          <div className="text-2xl font-semibold">ICN Suite — Phase 1</div>
          <div className="text-sm opacity-75">
            Census foundation: Paste → Preview → Commit (crash-safe + persistent)
          </div>
        </div>

        <div className="rounded-xl border bg-white shadow-sm p-5">
          <div className="text-lg font-semibold">Census</div>
          <div className="text-sm opacity-80 mt-1">
            Paste your census list. The app will parse it and show a preview before saving.
          </div>

          <textarea
            className="w-full mt-4 rounded-xl border p-3 min-h-[180px]"
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            placeholder={`Examples:\nUnit: Unit 2   Bed Certification: All\n251-A\tLAST, FIRST (LON123)\t5/12/1967\tActive\tL1\tSTD\tMedicare A\tSemi Private\tOCCUPIED`}
          />

          <div className="flex flex-wrap gap-2 mt-4">
            <button
              className="rounded-full border px-4 py-2"
              onClick={() => setPreview(parseCensus(raw))}
            >
              Parse / Preview
            </button>

            <button
              className="rounded-full border px-4 py-2 disabled:opacity-50"
              disabled={!preview}
              onClick={() => {
                if (!preview) return;
                applyCensus(preview);
                setPreview(null);
              }}
            >
              Commit Census
            </button>
          </div>
        </div>

        {preview && (
          <div className="rounded-xl border bg-white shadow-sm p-5 mt-4">
            <div className="flex items-center justify-between">
              <div className="text-lg font-semibold">Preview ({preview.residents.length} residents)</div>
              <div className="text-xs opacity-70">{new Date(preview.createdISO).toLocaleString()}</div>
            </div>

            {preview.warnings.length > 0 && (
              <div className="mt-3 rounded-xl border p-3 text-sm">
                <div className="font-semibold">Warnings</div>
                <ul className="list-disc pl-5 mt-1">
                  {preview.warnings.slice(0, 8).map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
                {preview.warnings.length > 8 && (
                  <div className="text-xs opacity-70 mt-1">+{preview.warnings.length - 8} more…</div>
                )}
              </div>
            )}

            <div className="mt-3 overflow-auto rounded-xl border">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-white">
                  <tr className="border-b">
                    <th className="text-left p-2">Name</th>
                    <th className="text-left p-2">Room</th>
                    <th className="text-left p-2">Unit</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.residents.map((r) => (
                    <tr key={r.id} className="border-b">
                      <td className="p-2">{r.displayName}</td>
                      <td className="p-2">{r.room ?? "—"}</td>
                      <td className="p-2">{r.unit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="rounded-xl border bg-white shadow-sm p-5 mt-4">
          <div className="text-lg font-semibold">Current Store</div>
          <div className="text-sm opacity-80 mt-1">
            Total residents stored: {residents.length} (Active: {activeCount} | Discharged: {dischargedCount})
          </div>
        </div>

        <div className="text-xs opacity-70 mt-4">
          Tip: After you commit a census, refresh the page. Data should persist (LocalStorage).
        </div>
      </div>
    </div>
  );
}
