import React from "react";
import type { ICNState } from "@/types/icn";
import { parseCensus } from "./parseCensus";
import { useICNStore } from "@/store/icnStore";

export function CensusPage() {
  const applyCensus = useICNStore((s: ICNState) => s.applyCensus);
  const residents = useICNStore((s: ICNState) => Object.values(s.residentsById));
  const [raw, setRaw] = React.useState("");
  const [preview, setPreview] = React.useState<ReturnType<typeof parseCensus> | null>(null);

  const activeCount = residents.filter((r) => r.status === "active").length; // 'r' is inferred now

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <header className="mb-4">
        <h1 className="text-xl md:text-2xl font-semibold">ICN Suite — Phase 1</h1>
        <p className="text-sm opacity-80 mt-1">Census foundation: Paste → Preview → Commit (crash-safe + persistent)</p>
      </header>

      <div className="rounded-xl border bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold">Census</h2>
        <p className="text-sm opacity-80 mt-1">
          Paste your census list. The app will parse it and show a preview before saving.
        </p>

        <textarea
          className="w-full mt-3 rounded-xl border p-3 min-h-[160px]"
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          placeholder={`Examples:\nLast, First | 212A\nFirst Last - 312`}
        />

        <div className="flex flex-wrap gap-2 mt-3">
          <button
            className="rounded-full border px-4 py-2 hover:bg-gray-50"
            onClick={() => setPreview(parseCensus(raw))}
          >
            Parse / Preview
          </button>

          <button
            className="rounded-full border px-4 py-2 hover:bg-gray-50 disabled:opacity-50"
            disabled={!preview}
            onClick={() => {
              if (!preview) return;
              applyCensus(preview);
              setRaw("");
              setPreview(null);
            }}
          >
            Commit Census
          </button>
        </div>
      </div>

      {preview && (
        <div className="rounded-xl border bg-white p-4 shadow-sm mt-4">
          <h3 className="font-semibold">Preview ({preview.residents.length} residents)</h3>

          {preview.warnings.length > 0 && (
            <div className="mt-2 rounded-xl border p-3 text-sm bg-gray-50">
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

      <div className="rounded-xl border bg-white p-4 shadow-sm mt-4">
        <h3 className="font-semibold">Current Store</h3>
        <div className="text-sm opacity-80 mt-1">
          Total residents stored: {residents.length} (Active: {activeCount} | Discharged: {residents.length - activeCount})
        </div>
      </div>

      <footer className="text-xs opacity-60 mt-6">
        Tip: After you commit a census, refresh the page. Data should persist (LocalStorage).
      </footer>
    </div>
  );
}
