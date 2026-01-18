import React, { useMemo, useState } from "react";
import { useICNStore } from "@/store/icnStore";
import type { ICNState, Resident, AntibioticRecord } from "@/types/icn";
import { abxFlags, summarizeResidentAbx } from "./abtRules";

type DraftRow = {
  antibiotic: string;
  startDateISO: string;
  indication: string;
  notes: string;
};

function sortResidents(a: Resident, b: Resident) {
  const au = a.unit || "UNK";
  const bu = b.unit || "UNK";
  if (au !== bu) return au.localeCompare(bu);

  const ar = a.room || "";
  const br = b.room || "";
  if (ar !== br) return ar.localeCompare(br);

  return a.displayName.localeCompare(b.displayName);
}

function fmtDateISO(iso: string) {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString();
  } catch {
    return iso;
  }
}

function emptyRow(): DraftRow {
  return { antibiotic: "", startDateISO: "", indication: "", notes: "" };
}

function sortAbx(a: AntibioticRecord, b: AntibioticRecord) {
  if (a.status !== b.status) return a.status === "active" ? -1 : 1;
  if (a.startDateISO !== b.startDateISO) return a.startDateISO < b.startDateISO ? 1 : -1;
  return a.createdISO < b.createdISO ? 1 : -1;
}

export function AbtPage() {
  const residentsById = useICNStore((s: ICNState) => s.residentsById);
  const abxByResidentId = useICNStore((s: ICNState) => s.abxByResidentId);
  const addAbxBatch = useICNStore((s: ICNState) => s.addAbxBatch);
  const stopAbx = useICNStore((s: ICNState) => s.stopAbx);
  const deleteAbx = useICNStore((s: ICNState) => s.deleteAbx);

  const residents = useMemo(() => Object.values(residentsById).sort(sortResidents), [residentsById]);

  const [q, setQ] = useState("");
  const [includeDischarged, setIncludeDischarged] = useState(false);
  const [selectedId, setSelectedId] = useState<string>("");

  const today = new Date();

  const filteredResidents = useMemo(() => {
    const t = q.trim().toLowerCase();
    return residents.filter((r) => {
      if (!includeDischarged && r.status === "discharged") return false;
      if (!t) return true;
      const hay = `${r.displayName} ${r.room || ""} ${r.unit || ""} ${r.id}`.toLowerCase();
      return hay.includes(t);
    });
  }, [q, residents, includeDischarged]);

  const selectedResident = selectedId ? residentsById[selectedId] : undefined;
  const selectedRecords = useMemo(() => {
    const list = selectedId ? abxByResidentId[selectedId] || [] : [];
    return [...list].sort(sortAbx);
  }, [abxByResidentId, selectedId]);

  const facilitySummary = useMemo(() => {
    const activeResidents = residents.filter((r) => r.status === "active");
    let residentsOnAbx = 0;
    let activeAbx = 0;
    let reviewDue = 0;
    let overdue = 0;

    for (const r of activeResidents) {
      const list = abxByResidentId[r.id] || [];
      const sum = summarizeResidentAbx(list, today);
      if (sum.activeCount > 0) residentsOnAbx++;
      activeAbx += sum.activeCount;
      reviewDue += sum.reviewDueCount;
      overdue += sum.overdueCount;
    }

    return {
      totalActiveResidents: activeResidents.length,
      residentsOnAbx,
      activeAbx,
      reviewDue,
      overdue
    };
  }, [residents, abxByResidentId]);

  const [rows, setRows] = useState<DraftRow[]>([emptyRow()]);

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <header className="mb-4">
        <h1 className="text-xl md:text-2xl font-semibold">ABT (Antibiotic Tracking)</h1>
        <p className="text-sm opacity-80 mt-1">
          Log active antibiotics and track basic stewardship flags (Day 3 review due, Day 7 overdue).
        </p>
      </header>

      <div className="rounded-xl border bg-white p-4 shadow-sm mb-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="text-sm">
            <span className="font-semibold">Active residents:</span> {facilitySummary.totalActiveResidents}
          </div>
          <div className="text-sm">
            <span className="font-semibold">Residents on ABX:</span> {facilitySummary.residentsOnAbx}
          </div>
          <div className="text-sm">
            <span className="font-semibold">Active ABX:</span> {facilitySummary.activeAbx}
          </div>
          <div className="text-sm">
            <span className="font-semibold">Review due (Day 3+):</span> {facilitySummary.reviewDue}
          </div>
          <div className="text-sm">
            <span className="font-semibold">Overdue (Day 7+):</span> {facilitySummary.overdue}
          </div>

          <div className="ml-auto flex items-center gap-2">
            <label className="text-sm flex items-center gap-2">
              <input
                type="checkbox"
                checked={includeDischarged}
                onChange={(e) => setIncludeDischarged(e.target.checked)}
              />
              Include discharged
            </label>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: resident list */}
        <div className="rounded-xl border bg-white shadow-sm p-4">
          <input
            className="w-full rounded-full border px-4 py-2"
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search resident (name / room / unit)"
          />

          <div className="text-xs opacity-70 mt-2">
            Showing {filteredResidents.length} of {residents.length}
          </div>

          <div className="mt-3 max-h-[520px] overflow-auto rounded-xl border">
            {filteredResidents.length === 0 ? (
              <div className="p-3 text-sm opacity-70">No matching residents.</div>
            ) : (
              <ul>
                {filteredResidents.map((r) => {
                  const list = abxByResidentId[r.id] || [];
                  const sum = summarizeResidentAbx(list, today);
                  const hasReview = sum.reviewDueCount > 0;
                  const hasOverdue = sum.overdueCount > 0;

                  return (
                    <li key={r.id} className="border-b last:border-b-0">
                      <button
                        className={
                          "w-full text-left p-3 hover:bg-gray-50 " +
                          (selectedId === r.id ? "bg-gray-50" : "")
                        }
                        onClick={() => setSelectedId(r.id)}
                        type="button"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <div className="font-medium">{r.displayName}</div>
                            <div className="text-xs opacity-70">
                              {r.unit} · {r.room || "—"} {r.status === "discharged" ? "· Discharged" : ""}
                            </div>
                          </div>
                          <div className="flex gap-1">
                            <span className={"text-xs rounded-full border px-2 py-1 " + (sum.activeCount ? "" : "opacity-60")}>
                              ABX {sum.activeCount}
                            </span>
                            <span className={"text-xs rounded-full border px-2 py-1 " + (hasReview ? "" : "opacity-60")}>
                              D3 {hasReview ? "⚠️" : "—"}
                            </span>
                            <span className={"text-xs rounded-full border px-2 py-1 " + (hasOverdue ? "" : "opacity-60")}>
                              D7 {hasOverdue ? "⏰" : "—"}
                            </span>
                          </div>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        {/* Right: details */}
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-xl border bg-white shadow-sm p-4">
            {!selectedResident ? (
              <div className="text-sm opacity-70">Select a resident to view and add antibiotics.</div>
            ) : (
              <>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="text-lg font-semibold">{selectedResident.displayName}</div>
                    <div className="text-sm opacity-70">
                      {selectedResident.unit} · {selectedResident.room || "—"}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {(() => {
                      const sum = summarizeResidentAbx(selectedRecords, today);
                      return (
                        <>
                          <span className="rounded-full border px-3 py-1 text-sm">Active ABX: {sum.activeCount}</span>
                          <span className="rounded-full border px-3 py-1 text-sm">D3+: {sum.reviewDueCount}</span>
                          <span className="rounded-full border px-3 py-1 text-sm">D7+: {sum.overdueCount}</span>
                        </>
                      );
                    })()}
                  </div>
                </div>

                <div className="mt-4 rounded-xl border p-3 bg-gray-50">
                  <div className="font-semibold">Quick Add (multiple entries)</div>
                  <div className="text-xs opacity-70 mt-1">Add rows, then Save all.</div>

                  <div className="mt-3 space-y-2">
                    {rows.map((row, idx) => (
                      <div key={idx} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center">
                        <div className="md:col-span-3">
                          <input
                            className="w-full rounded-full border px-3 py-2"
                            value={row.antibiotic}
                            onChange={(e) => {
                              const val = e.target.value;
                              setRows((prev) => {
                                const next = [...prev];
                                next[idx] = { ...next[idx], antibiotic: val };
                                return next;
                              });
                            }}
                            placeholder="Antibiotic"
                          />
                        </div>

                        <div className="md:col-span-3">
                          <input
                            className="w-full rounded-full border px-3 py-2"
                            type="date"
                            value={row.startDateISO}
                            onChange={(e) => {
                              const val = e.target.value;
                              setRows((prev) => {
                                const next = [...prev];
                                next[idx] = { ...next[idx], startDateISO: val };
                                return next;
                              });
                            }}
                          />
                        </div>

                        <div className="md:col-span-3">
                          <input
                            className="w-full rounded-full border px-3 py-2"
                            value={row.indication}
                            onChange={(e) => {
                              const val = e.target.value;
                              setRows((prev) => {
                                const next = [...prev];
                                next[idx] = { ...next[idx], indication: val };
                                return next;
                              });
                            }}
                            placeholder="Indication (optional)"
                          />
                        </div>

                        <div className="md:col-span-3">
                          <input
                            className="w-full rounded-full border px-3 py-2"
                            value={row.notes}
                            onChange={(e) => {
                              const val = e.target.value;
                              setRows((prev) => {
                                const next = [...prev];
                                next[idx] = { ...next[idx], notes: val };
                                return next;
                              });
                            }}
                            placeholder="Notes (optional)"
                          />
                        </div>

                        <div className="md:col-span-12 flex justify-end gap-2">
                          {rows.length > 1 && (
                            <button
                              className="rounded-full border px-3 py-2 hover:bg-white"
                              type="button"
                              onClick={() => setRows((prev) => prev.filter((_, i) => i !== idx))}
                            >
                              Remove row
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      className="rounded-full border px-4 py-2 hover:bg-white"
                      type="button"
                      onClick={() => setRows((prev) => [...prev, emptyRow()])}
                    >
                      + Add row
                    </button>

                    <button
                      className="rounded-full border px-4 py-2 hover:bg-white"
                      type="button"
                      onClick={() => {
                        if (!selectedResident) return;
                        addAbxBatch(selectedResident.id, rows.map((r) => ({
                          antibiotic: r.antibiotic,
                          startDateISO: r.startDateISO,
                          indication: r.indication,
                          notes: r.notes
                        })));
                        setRows([emptyRow()]);
                      }}
                    >
                      Save all
                    </button>

                    <button
                      className="rounded-full border px-4 py-2 hover:bg-white"
                      type="button"
                      onClick={() => setRows([emptyRow()])}
                    >
                      Clear
                    </button>
                  </div>

                  <div className="text-xs opacity-70 mt-2">
                    Tip: Start date drives Day 3 and Day 7 flags. Stop an antibiotic when it ends.
                  </div>
                </div>
              </>
            )}
          </div>

          {selectedResident && (
            <div className="rounded-xl border bg-white shadow-sm p-4">
              <div className="text-lg font-semibold">Antibiotic Log</div>
              {selectedRecords.length === 0 ? (
                <div className="text-sm opacity-70 mt-2">No antibiotics recorded yet.</div>
              ) : (
                <div className="mt-3 overflow-auto rounded-xl border">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-white">
                      <tr className="border-b">
                        <th className="text-left p-2">Antibiotic</th>
                        <th className="text-left p-2">Start</th>
                        <th className="text-left p-2">Day</th>
                        <th className="text-left p-2">Indication</th>
                        <th className="text-left p-2">Status</th>
                        <th className="text-left p-2">Stop</th>
                        <th className="text-right p-2">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedRecords.map((a) => {
                        const f = abxFlags(a, today);
                        return (
                          <tr key={a.id} className="border-b">
                            <td className="p-2">
                              <div className="font-medium">{a.antibiotic}</div>
                              <div className="text-xs opacity-70">{a.notes || "—"}</div>
                            </td>
                            <td className="p-2">{fmtDateISO(a.startDateISO)}</td>
                            <td className="p-2">
                              {f.day ? `Day ${f.day}` : "—"} {f.reviewDue ? "⚠️" : ""} {f.overdue ? "⏰" : ""}
                            </td>
                            <td className="p-2">{a.indication || "—"}</td>
                            <td className="p-2">{a.status}</td>
                            <td className="p-2">{a.stopDateISO ? fmtDateISO(a.stopDateISO) : "—"}</td>
                            <td className="p-2 text-right">
                              {f.isActive && (
                                <button
                                  className="rounded-full border px-3 py-1 hover:bg-gray-50"
                                  type="button"
                                  onClick={() => stopAbx(selectedResident.id, a.id, new Date().toISOString().slice(0, 10))}
                                >
                                  Stop today
                                </button>
                              )}
                              <button
                                className="rounded-full border px-3 py-1 hover:bg-gray-50 ml-2"
                                type="button"
                                onClick={() => deleteAbx(selectedResident.id, a.id)}
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
