// src/features/reports/ReportsPage.tsx
import * as React from "react";
import { toISODate, latestBackupKey } from "../shared/persist";
import { buildSnapshot, toCsv } from "./reportsUtils";

function downloadText(filename: string, text: string, mime: string) {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 600);
}

export default function ReportsPage() {
  const [err, setErr] = React.useState<string>("");
  const [key, setKey] = React.useState<string>("—");
  const [today, setToday] = React.useState<string>("");
  const [abtActive, setAbtActive] = React.useState<any[]>([]);
  const [ipActive, setIpActive] = React.useState<any[]>([]);
  const [vaxAll, setVaxAll] = React.useState<any[]>([]);
  const [top, setTop] = React.useState<[string, number][]>([]);
  const [summary, setSummary] = React.useState<string>("");

  const refresh = React.useCallback(() => {
    setErr("");
    try {
      const snap = buildSnapshot();
      setKey(snap.persistKey);
      setToday(snap.today);
      setAbtActive(snap.abtActive);
      setIpActive(snap.ipActive);
      setVaxAll(snap.vaxAll);
      setTop(snap.topAntibiotics);

      const lines: string[] = [];
      lines.push("ICN Suite — Executive Summary");
      lines.push(`Date: ${snap.today}`);
      lines.push(`Persist key: ${snap.persistKey}`);
      lines.push("");
      lines.push(`ABT active courses: ${snap.abtActive.length}`);
      if (snap.topAntibiotics.length) {
        lines.push("Top antibiotics:");
        snap.topAntibiotics.slice(0, 8).forEach(([k, v]) => lines.push(`- ${k}: ${v}`));
      }
      lines.push("");
      lines.push(`IP active cases: ${snap.ipActive.length}`);
      lines.push(`Vaccination records total: ${snap.vaxAll.length}`);
      setSummary(lines.join("\n"));
    } catch (e: any) {
      setErr(e?.message || String(e));
    }
  }, []);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  const abtRows = React.useMemo(() => {
    return abtActive.slice(0, 500).map((r) => ({
      resident: r?.residentName || r?.name || "",
      room: r?.room || r?.roomNumber || "",
      unit: r?.unit || "",
      antibiotic: r?.antibiotic || r?.med || r?.drug || "",
      route: r?.route || "",
      start: toISODate(r?.start || r?.startDate || ""),
      end: toISODate(r?.end || r?.endDate || ""),
      indication: r?.indication || "",
    }));
  }, [abtActive]);

  const ipRows = React.useMemo(() => {
    return ipActive.slice(0, 500).map((r) => ({
      resident: r?.residentName || r?.name || "",
      room: r?.room || "",
      unit: r?.unit || "",
      precaution: r?.precautionType || "",
      isolation: r?.isolationType || "",
      onset: toISODate(r?.onsetDate || ""),
      status: r?.status || r?.caseStatus || "ACTIVE",
    }));
  }, [ipActive]);

  const vaxCounts = React.useMemo(() => {
    const m: Record<string, number> = {};
    vaxAll.forEach((r) => {
      const k = String(r?.vaccineType || r?.vaccine || "").trim();
      if (!k) return;
      m[k] = (m[k] || 0) + 1;
    });
    return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 20);
  }, [vaxAll]);

  function downloadAbtCsv() {
    if (!abtRows.length) return;
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    downloadText(`icn-abt-active-${stamp}.csv`, toCsv(abtRows as any), "text/csv");
  }

  return (
    <div className="p-4 max-w-6xl mx-auto">
      <div className="rounded-2xl border bg-white shadow-sm p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold">Reports</h1>
            <p className="text-sm text-slate-600">Plain operational reports powered by your local persisted data.</p>
            {err ? <p className="text-sm text-red-600 mt-2">{err}</p> : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="rounded-full border px-4 py-2 text-sm" onClick={refresh}>Refresh</button>
            <button className="rounded-full border px-4 py-2 text-sm" onClick={() => window.print()}>Print</button>
            <button className="rounded-full bg-slate-900 text-white px-4 py-2 text-sm" onClick={downloadAbtCsv}>Download ABT CSV</button>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600">
          <span className="rounded-full border px-3 py-1 bg-white">Today: <span className="font-mono">{today || "—"}</span></span>
          <span className="rounded-full border px-3 py-1 bg-white">Persist key: <span className="font-mono">{key}</span></span>
          <span className="rounded-full border px-3 py-1 bg-white">Latest backup: <span className="font-mono">{latestBackupKey() || "—"}</span></span>
        </div>

        <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div>
            <div className="text-sm font-semibold mb-2">ABT Active ({abtActive.length})</div>
            <div className="rounded-xl border overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-white">
                  <tr className="text-left">
                    <th className="p-2 border-b">Resident</th>
                    <th className="p-2 border-b">Room</th>
                    <th className="p-2 border-b">Unit</th>
                    <th className="p-2 border-b">Antibiotic</th>
                    <th className="p-2 border-b">Route</th>
                    <th className="p-2 border-b">Start</th>
                    <th className="p-2 border-b">End</th>
                  </tr>
                </thead>
                <tbody>
                  {abtRows.slice(0, 200).map((r, i) => (
                    <tr key={i} className={i % 2 ? "bg-slate-50" : ""}>
                      <td className="p-2 border-b">{r.resident}</td>
                      <td className="p-2 border-b">{r.room}</td>
                      <td className="p-2 border-b">{r.unit}</td>
                      <td className="p-2 border-b">{r.antibiotic}</td>
                      <td className="p-2 border-b">{r.route}</td>
                      <td className="p-2 border-b">{r.start}</td>
                      <td className="p-2 border-b">{r.end}</td>
                    </tr>
                  ))}
                  {!abtRows.length ? (
                    <tr><td className="p-3 text-slate-500" colSpan={7}>No active ABT courses.</td></tr>
                  ) : null}
                </tbody>
              </table>
            </div>

            <div className="mt-3 text-sm font-semibold mb-2">Top antibiotics</div>
            <div className="rounded-xl border p-3 text-sm">
              {top.length ? (
                <ul className="list-disc pl-5">
                  {top.slice(0, 10).map(([k, v]) => (
                    <li key={k}><span className="font-mono">{k}</span> — {v}</li>
                  ))}
                </ul>
              ) : (
                <div className="text-slate-500">—</div>
              )}
            </div>
          </div>

          <div>
            <div className="text-sm font-semibold mb-2">IP Active ({ipActive.length})</div>
            <div className="rounded-xl border overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-white">
                  <tr className="text-left">
                    <th className="p-2 border-b">Resident</th>
                    <th className="p-2 border-b">Room</th>
                    <th className="p-2 border-b">Unit</th>
                    <th className="p-2 border-b">Precaution</th>
                    <th className="p-2 border-b">Isolation</th>
                    <th className="p-2 border-b">Onset</th>
                    <th className="p-2 border-b">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {ipRows.slice(0, 200).map((r, i) => (
                    <tr key={i} className={i % 2 ? "bg-slate-50" : ""}>
                      <td className="p-2 border-b">{r.resident}</td>
                      <td className="p-2 border-b">{r.room}</td>
                      <td className="p-2 border-b">{r.unit}</td>
                      <td className="p-2 border-b">{r.precaution}</td>
                      <td className="p-2 border-b">{r.isolation}</td>
                      <td className="p-2 border-b">{r.onset}</td>
                      <td className="p-2 border-b">{r.status}</td>
                    </tr>
                  ))}
                  {!ipRows.length ? (
                    <tr><td className="p-3 text-slate-500" colSpan={7}>No active IP cases.</td></tr>
                  ) : null}
                </tbody>
              </table>
            </div>

            <div className="mt-4 text-sm font-semibold mb-2">Vaccination Snapshot (Top 20)</div>
            <div className="rounded-xl border overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-white">
                  <tr className="text-left">
                    <th className="p-2 border-b">Vaccine</th>
                    <th className="p-2 border-b">Count</th>
                  </tr>
                </thead>
                <tbody>
                  {vaxCounts.map(([k, v], i) => (
                    <tr key={k} className={i % 2 ? "bg-slate-50" : ""}>
                      <td className="p-2 border-b">{k}</td>
                      <td className="p-2 border-b">{v}</td>
                    </tr>
                  ))}
                  {!vaxCounts.length ? (
                    <tr><td className="p-3 text-slate-500" colSpan={2}>No vaccination records.</td></tr>
                  ) : null}
                </tbody>
              </table>
            </div>

            <div className="mt-4 text-sm font-semibold mb-2">Executive Summary</div>
            <textarea className="w-full min-h-[180px] rounded-xl border p-3 font-mono text-xs" readOnly value={summary} />
          </div>
        </div>
      </div>
    </div>
  );
}
