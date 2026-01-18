import React, { useMemo, useState } from "react";
import { useICNStore } from "@/store/icnStore";
import type { ICNState, Resident, VaccineName } from "@/types/icn";
import { isCovidUpToDate, isFluUpToDate } from "./vaxRules";

type DraftRow = {
  name: VaccineName;
  nameOther?: string;
  dateISO: string;
  notes: string;
};

const VAX_OPTIONS: VaccineName[] = [
  "COVID",
  "Flu",
  "Pneumo",
  "RSV",
  "Shingles",
  "Tdap",
  "Other"
];

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

export function VaccinationPage() {
  const residentsById = useICNStore((s: ICNState) => s.residentsById);
  const vaccinesByResidentId = useICNStore((s: ICNState) => s.vaccinesByResidentId);
  const addVaccinesBatch = useICNStore((s: ICNState) => s.addVaccinesBatch);
  const deleteVaccine = useICNStore((s: ICNState) => s.deleteVaccine);

  const residents = useMemo(() => Object.values(residentsById).sort(sortResidents), [residentsById]);

  const [q, setQ] = useState("");
  const [includeDischarged, setIncludeDischarged] = useState(false);
  const [selectedId, setSelectedId] = useState<string>("");

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
    const list = selectedId ? vaccinesByResidentId[selectedId] || [] : [];
    // sort newest first by dateISO
    return [...list].sort((a, b) => (a.dateISO < b.dateISO ? 1 : -1));
  }, [vaccinesByResidentId, selectedId]);

  const [rows, setRows] = useState<DraftRow[]>([
    { name: "Flu", dateISO: "", notes: "" }
  ]);

  const today = new Date();
  const fluOk = isFluUpToDate(selectedRecords, today);
  const covidOk = isCovidUpToDate(selectedRecords, today);

  // Facility-level summary for active residents (quick sanity view)
  const facilitySummary = useMemo(() => {
    const activeResidents = residents.filter((r) => r.status === "active");
    let flu = 0;
    let covid = 0;
    for (const r of activeResidents) {
      const rec = vaccinesByResidentId[r.id] || [];
      if (isFluUpToDate(rec, today)) flu++;
      if (isCovidUpToDate(rec, today)) covid++;
    }
    return { total: activeResidents.length, flu, covid };
  }, [residents, vaccinesByResidentId]);

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <header className="mb-4">
        <h1 className="text-xl md:text-2xl font-semibold">Vaccinations</h1>
        <p className="text-sm opacity-80 mt-1">
          Track vaccines per resident. Quick add supports multiple entries in one save.
        </p>
      </header>

      <div className="rounded-xl border bg-white p-4 shadow-sm mb-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="text-sm">
            <span className="font-semibold">Active residents:</span> {facilitySummary.total}
          </div>
          <div className="text-sm">
            <span className="font-semibold">Flu up to date:</span> {facilitySummary.flu}/{facilitySummary.total}
          </div>
          <div className="text-sm">
            <span className="font-semibold">COVID up to date:</span> {facilitySummary.covid}/{facilitySummary.total}
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
          <div className="flex items-center gap-2">
            <input
              className="w-full rounded-full border px-4 py-2"
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search resident (name / room / unit)"
            />
          </div>

          <div className="text-xs opacity-70 mt-2">
            Showing {filteredResidents.length} of {residents.length}
          </div>

          <div className="mt-3 max-h-[520px] overflow-auto rounded-xl border">
            {filteredResidents.length === 0 ? (
              <div className="p-3 text-sm opacity-70">No matching residents.</div>
            ) : (
              <ul>
                {filteredResidents.map((r) => {
                  const isActive = r.status === "active";
                  const rec = vaccinesByResidentId[r.id] || [];
                  const fOk = isFluUpToDate(rec, today);
                  const cOk = isCovidUpToDate(rec, today);
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
                              {r.unit} · {r.room || "—"} {!isActive ? "· Discharged" : ""}
                            </div>
                          </div>
                          <div className="flex gap-1">
                            <span className={"text-xs rounded-full border px-2 py-1 " + (fOk ? "" : "opacity-60")}>
                              Flu {fOk ? "✅" : "⚠️"}
                            </span>
                            <span className={"text-xs rounded-full border px-2 py-1 " + (cOk ? "" : "opacity-60")}>
                              COVID {cOk ? "✅" : "⚠️"}
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
              <div className="text-sm opacity-70">Select a resident to view and add vaccinations.</div>
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
                    <span className="rounded-full border px-3 py-1 text-sm">
                      Flu: {fluOk ? "✅ Up to date" : "⚠️ Not up to date"}
                    </span>
                    <span className="rounded-full border px-3 py-1 text-sm">
                      COVID: {covidOk ? "✅ Up to date" : "⚠️ Not up to date"}
                    </span>
                  </div>
                </div>

                <div className="mt-4 rounded-xl border p-3 bg-gray-50">
                  <div className="font-semibold">Quick Add (multiple entries)</div>
                  <div className="text-xs opacity-70 mt-1">Add rows, then Save all.</div>

                  <div className="mt-3 space-y-2">
                    {rows.map((row, idx) => (
                      <div key={idx} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center">
                        <div className="md:col-span-3">
                          <select
                            className="w-full rounded-full border px-3 py-2"
                            value={row.name}
                            onChange={(e) => {
                              const v = e.target.value as VaccineName;
                              setRows((prev) => {
                                const next = [...prev];
                                next[idx] = { ...next[idx], name: v };
                                if (v !== "Other") delete next[idx].nameOther;
                                return next;
                              });
                            }}
                          >
                            {VAX_OPTIONS.map((v) => (
                              <option key={v} value={v}>
                                {v}
                              </option>
                            ))}
                          </select>
                        </div>

                        {row.name === "Other" ? (
                          <div className="md:col-span-3">
                            <input
                              className="w-full rounded-full border px-3 py-2"
                              value={row.nameOther || ""}
                              onChange={(e) => {
                                const val = e.target.value;
                                setRows((prev) => {
                                  const next = [...prev];
                                  next[idx] = { ...next[idx], nameOther: val };
                                  return next;
                                });
                              }}
                              placeholder="Other name"
                            />
                          </div>
                        ) : (
                          <div className="md:col-span-3" />
                        )}

                        <div className="md:col-span-3">
                          <input
                            className="w-full rounded-full border px-3 py-2"
                            type="date"
                            value={row.dateISO}
                            onChange={(e) => {
                              const val = e.target.value;
                              setRows((prev) => {
                                const next = [...prev];
                                next[idx] = { ...next[idx], dateISO: val };
                                return next;
                              });
                            }}
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
                      onClick={() => setRows((prev) => [...prev, { name: "Flu", dateISO: "", notes: "" }])}
                    >
                      + Add row
                    </button>

                    <button
                      className="rounded-full border px-4 py-2 hover:bg-white"
                      type="button"
                      onClick={() => {
                        if (!selectedResident) return;
                        addVaccinesBatch(selectedResident.id, rows.map((r) => ({
                          name: r.name,
                          nameOther: r.name === "Other" ? r.nameOther : undefined,
                          dateISO: r.dateISO,
                          notes: r.notes
                        })));
                        setRows([{ name: "Flu", dateISO: "", notes: "" }]);
                      }}
                    >
                      Save all
                    </button>

                    <button
                      className="rounded-full border px-4 py-2 hover:bg-white"
                      type="button"
                      onClick={() => setRows([{ name: "Flu", dateISO: "", notes: "" }])}
                    >
                      Clear
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          {selectedResident && (
            <div className="rounded-xl border bg-white shadow-sm p-4">
              <div className="text-lg font-semibold">Vaccine History</div>
              {selectedRecords.length === 0 ? (
                <div className="text-sm opacity-70 mt-2">No vaccines recorded yet.</div>
              ) : (
                <div className="mt-3 overflow-auto rounded-xl border">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-white">
                      <tr className="border-b">
                        <th className="text-left p-2">Vaccine</th>
                        <th className="text-left p-2">Date</th>
                        <th className="text-left p-2">Notes</th>
                        <th className="text-right p-2">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedRecords.map((v) => (
                        <tr key={v.id} className="border-b">
                          <td className="p-2">{v.name === "Other" ? `Other: ${v.nameOther || "—"}` : v.name}</td>
                          <td className="p-2">{fmtDateISO(v.dateISO)}</td>
                          <td className="p-2">{v.notes || "—"}</td>
                          <td className="p-2 text-right">
                            <button
                              className="rounded-full border px-3 py-1 hover:bg-gray-50"
                              type="button"
                              onClick={() => deleteVaccine(selectedResident.id, v.id)}
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
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
