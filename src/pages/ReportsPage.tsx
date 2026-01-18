import React, { useMemo, useState } from 'react';
import { useIcnStore } from '../store/icnStore';
import type { AntibioticEntry, InfectionCase, Resident, VaccinationEntry } from '../types/core';
import { downloadText, toCsv } from '../utils/csv';

type Props = { includeDischarged: boolean };

function residentsForReports(residentsById: Record<string, Resident>, activeIds: string[], includeDischarged: boolean): Resident[] {
  const ids = includeDischarged ? Object.keys(residentsById) : activeIds;
  return ids.map((id) => residentsById[id]).filter(Boolean) as Resident[];
}

function daysBetween(startISO: string, end = new Date()): number {
  const d = new Date(startISO);
  if (Number.isNaN(d.getTime())) return 0;
  const ms = end.getTime() - d.getTime();
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
}

function monthKey(iso: string): string {
  const m = String(iso || '').match(/^(\d{4})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}` : 'Unknown';
}

function norm(s: any): string {
  return String(s || '').trim().toLowerCase();
}

function isSameVaxCategory(a: string, category: 'flu' | 'covid'): boolean {
  const t = norm(a);
  if (category === 'flu') return t.includes('flu') || t.includes('influenza');
  return t.includes('covid') || t.includes('sars');
}

export function ReportsPage({ includeDischarged }: Props) {
  const { data } = useIcnStore();
  const [tab, setTab] = useState<'kpi' | 'abt' | 'vax' | 'ip' | 'qapi'>('kpi');

  const residents = useMemo(
    () => residentsForReports(data.residentsById, data.census.activeResidentIds, includeDischarged),
    [data.residentsById, data.census.activeResidentIds, includeDischarged]
  );

  const unitCounts = useMemo(() => {
    const out: Record<string, number> = {};
    for (const r of residents) {
      const u = String(r.unit || r.lockedUnit || 'Unassigned').trim() || 'Unassigned';
      out[u] = (out[u] || 0) + 1;
    }
    return out;
  }, [residents]);

  const activeAbx = useMemo(() => data.antibiotics.filter((a) => a.status === 'Active'), [data.antibiotics]);
  const activeCases = useMemo(() => data.infectionCases.filter((c) => !c.resolvedDateISO), [data.infectionCases]);
  const vaxCount = useMemo(() => data.vaccinations.length, [data.vaccinations]);

  // --- ABT report views ---
  const abtStartsLast7 = useMemo(() => {
    const now = new Date();
    return data.antibiotics.filter((a) => daysBetween(a.startDateISO, now) <= 7);
  }, [data.antibiotics]);

  const abtOver14 = useMemo(() => {
    const now = new Date();
    return activeAbx.filter((a) => daysBetween(a.startDateISO, now) > 14);
  }, [activeAbx]);

  const abtByMonth = useMemo(() => {
    const by: Record<string, { starts: number; stopped: number; activeAtEnd: number }> = {};
    for (const a of data.antibiotics) {
      const mk = monthKey(a.startDateISO);
      by[mk] = by[mk] || { starts: 0, stopped: 0, activeAtEnd: 0 };
      by[mk].starts += 1;
      if (a.status === 'Stopped' || a.stopDateISO) by[mk].stopped += 1;
    }
    // Estimate active at end: count entries active now whose start month <= mk
    const months = Object.keys(by).sort();
    for (const mk of months) {
      const [y, m] = mk.split('-').map((x) => Number(x));
      if (!y || !m) continue;
      const end = new Date(y, m, 0); // last day of month
      const activeAt = data.antibiotics.filter((a) => {
        const s = new Date(a.startDateISO);
        if (Number.isNaN(s.getTime())) return false;
        if (s.getTime() > end.getTime()) return false;
        if (!a.stopDateISO) return true;
        const stop = new Date(a.stopDateISO);
        return Number.isNaN(stop.getTime()) ? true : stop.getTime() > end.getTime();
      }).length;
      by[mk].activeAtEnd = activeAt;
    }
    return by;
  }, [data.antibiotics]);

  // --- Vaccination due logic (simple, configurable later) ---
  const vaxDue = useMemo(() => {
    const now = new Date();
    const cutoff = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);

    const lastByResident: Record<string, { flu?: string; covid?: string }> = {};
    for (const e of data.vaccinations) {
      if (!e.residentId) continue;
      const key = e.residentId;
      lastByResident[key] = lastByResident[key] || {};
      if (isSameVaxCategory(e.vaccineType, 'flu')) {
        if (!lastByResident[key].flu || e.dateISO > (lastByResident[key].flu as string)) lastByResident[key].flu = e.dateISO;
      }
      if (isSameVaxCategory(e.vaccineType, 'covid')) {
        if (!lastByResident[key].covid || e.dateISO > (lastByResident[key].covid as string)) lastByResident[key].covid = e.dateISO;
      }
    }

    const due: Array<{ resident: Resident; fluDue: boolean; covidDue: boolean; lastFlu?: string; lastCovid?: string }> = [];
    for (const r of residents) {
      const last = lastByResident[r.id] || {};
      const lastFlu = last.flu;
      const lastCovid = last.covid;
      const fluDue = !lastFlu || new Date(lastFlu).getTime() < cutoff.getTime();
      const covidDue = !lastCovid || new Date(lastCovid).getTime() < cutoff.getTime();
      if (fluDue || covidDue) due.push({ resident: r, fluDue, covidDue, lastFlu, lastCovid });
    }
    return due;
  }, [data.vaccinations, residents]);

  // --- IP summary ---
  const ipPrecautions = useMemo(() => {
    const out: Record<string, number> = {};
    for (const c of activeCases) {
      const p = String(c.precautions || 'Unknown');
      out[p] = (out[p] || 0) + 1;
    }
    return out;
  }, [activeCases]);

  function exportAbtMonthlyCsv() {
    const rows = Object.keys(abtByMonth)
      .sort()
      .map((m) => ({ month: m, starts: abtByMonth[m].starts, stopped: abtByMonth[m].stopped, activeAtEnd: abtByMonth[m].activeAtEnd }));
    downloadText('ABT_Monthly_QAPI.csv', toCsv(rows, ['month', 'starts', 'stopped', 'activeAtEnd']), 'text/csv');
  }

  function exportVaxDueCsv() {
    const rows = vaxDue.map((x) => ({
      name: x.resident.name,
      mrn: x.resident.mrn || '',
      unit: String(x.resident.unit || x.resident.lockedUnit || ''),
      room: String(x.resident.room || x.resident.lockedRoom || ''),
      fluDue: x.fluDue ? 'YES' : 'NO',
      lastFlu: x.lastFlu || '',
      covidDue: x.covidDue ? 'YES' : 'NO',
      lastCovid: x.lastCovid || ''
    }));
    downloadText('Vaccination_Due_List.csv', toCsv(rows), 'text/csv');
  }

  function exportIpLineListCsv() {
    const rows = activeCases.map((c) => ({
      name: c.residentName,
      mrn: c.mrn || '',
      unit: c.unit || '',
      room: c.room || '',
      precautions: c.precautions,
      syndrome: c.syndrome || '',
      organism: c.organism || '',
      onset: c.onsetDateISO,
      labDate: c.labDateISO || ''
    }));
    downloadText('IP_LineList_Active.csv', toCsv(rows), 'text/csv');
  }

  return (
    <div className="card" style={{ minWidth: 980 }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0 }}>Reports</h2>
          <div className="muted mini">Built for Cloudflare Pages: all reporting runs client-side from your saved data.</div>
        </div>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <button className={"tabbtn" + (tab === 'kpi' ? ' active' : '')} onClick={() => setTab('kpi')}>KPIs</button>
          <button className={"tabbtn" + (tab === 'abt' ? ' active' : '')} onClick={() => setTab('abt')}>ABT</button>
          <button className={"tabbtn" + (tab === 'vax' ? ' active' : '')} onClick={() => setTab('vax')}>Vaccinations</button>
          <button className={"tabbtn" + (tab === 'ip' ? ' active' : '')} onClick={() => setTab('ip')}>IP</button>
          <button className={"tabbtn" + (tab === 'qapi' ? ' active' : '')} onClick={() => setTab('qapi')}>Monthly QAPI</button>
        </div>
      </div>

      <div className="sep" />

      {tab === 'kpi' && (
        <div className="grid cols2">
          <div className="card" style={{ margin: 0 }}>
            <h3>Quick KPIs</h3>
            <div className="grid cols3">
              <div className="kpi"><div><div className="lbl">Census</div><div className="big">{residents.length}</div></div></div>
              <div className="kpi"><div><div className="lbl">Active Antibiotics</div><div className="big">{activeAbx.length}</div></div></div>
              <div className="kpi"><div><div className="lbl">Active Cases</div><div className="big">{activeCases.length}</div></div></div>
            </div>
            <div className="sep" />
            <div className="grid cols3">
              <div className="kpi"><div><div className="lbl">Vaccination Entries</div><div className="big">{vaxCount}</div></div></div>
              <div className="kpi"><div><div className="lbl">Occupancy</div><div className="big">{data.config.totalCapacity > 0 ? `${Math.round((residents.length / data.config.totalCapacity) * 100)}%` : '—'}</div></div></div>
              <div className="kpi"><div><div className="lbl">Include Discharged</div><div className="big">{includeDischarged ? 'Yes' : 'No'}</div></div></div>
            </div>
          </div>

          <div className="card" style={{ margin: 0 }}>
            <h3>Unit Census</h3>
            <table className="thin">
              <thead>
                <tr><th>Unit</th><th className="nowrap">Count</th><th className="nowrap">Capacity</th><th className="nowrap">Occ</th></tr>
              </thead>
              <tbody>
                {Object.keys(unitCounts).sort().map((u) => {
                  const count = unitCounts[u] || 0;
                  const capRow = data.config.units.find((x) => x.unitName === u || x.unitKey === u);
                  const cap = capRow?.capacity || 0;
                  const occ = cap > 0 ? `${Math.round((count / cap) * 100)}%` : '—';
                  return (
                    <tr key={u}>
                      <td style={{ fontWeight: 900 }}>{u}</td>
                      <td className="nowrap">{count}</td>
                      <td className="nowrap">{cap || '—'}</td>
                      <td className="nowrap">{occ}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'abt' && (
        <div className="grid cols2">
          <div className="card" style={{ margin: 0 }}>
            <h3>Active Antibiotics</h3>
            <div className="muted mini">Highlights long-duration therapies (&gt;14 days) for review.</div>
            <div className="sep" />
            <table className="thin">
              <thead>
                <tr>
                  <th>Resident</th><th>Unit/Room</th><th>Medication</th><th className="nowrap">Start</th><th className="nowrap">Days</th>
                </tr>
              </thead>
              <tbody>
                {activeAbx.slice(0, 200).map((a) => {
                  const days = daysBetween(a.startDateISO);
                  const warn = days > 14;
                  return (
                    <tr key={a.id}>
                      <td style={{ fontWeight: 900 }}>{a.residentName}</td>
                      <td className="nowrap">{a.unit || '—'} / {a.room || '—'}</td>
                      <td>{a.medication}</td>
                      <td className="nowrap">{a.startDateISO}</td>
                      <td className="nowrap" style={{ fontWeight: 900, color: warn ? 'var(--danger, #ff4a68)' : undefined }}>{days}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {activeAbx.length > 200 && <div className="muted mini">Showing first 200 rows.</div>}
          </div>

          <div className="card" style={{ margin: 0 }}>
            <h3>Start-of-Care / New Starts (last 7 days)</h3>
            <div className="muted mini">Use this as a quick SOC review queue (new antibiotic starts).</div>
            <div className="sep" />
            <div className="grid cols3">
              <div className="kpi"><div><div className="lbl">New Starts</div><div className="big">{abtStartsLast7.length}</div></div></div>
              <div className="kpi"><div><div className="lbl">Long Duration &gt;14d</div><div className="big">{abtOver14.length}</div></div></div>
              <div className="kpi"><div><div className="lbl">Active Total</div><div className="big">{activeAbx.length}</div></div></div>
            </div>
            <div className="sep" />
            <table className="thin">
              <thead><tr><th>Resident</th><th>Medication</th><th className="nowrap">Start</th></tr></thead>
              <tbody>
                {abtStartsLast7.slice(0, 120).map((a) => (
                  <tr key={a.id}>
                    <td style={{ fontWeight: 900 }}>{a.residentName}</td>
                    <td>{a.medication}</td>
                    <td className="nowrap">{a.startDateISO}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'vax' && (
        <div className="grid cols2">
          <div className="card" style={{ margin: 0 }}>
            <h3>Vaccination Due List (simple rule: &gt;365 days)</h3>
            <div className="muted mini">This will be expanded to match your facility policy logic (season windows, contraindications, refusal tracking).</div>
            <div className="sep" />
            <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
              <button className="btn" type="button" onClick={exportVaxDueCsv}>Export Due List (CSV)</button>
            </div>
            <div className="sep" />
            <table className="thin">
              <thead>
                <tr>
                  <th>Resident</th><th>Unit/Room</th><th className="nowrap">Flu Due</th><th className="nowrap">Last Flu</th><th className="nowrap">COVID Due</th><th className="nowrap">Last COVID</th>
                </tr>
              </thead>
              <tbody>
                {vaxDue.slice(0, 250).map((x) => (
                  <tr key={x.resident.id}>
                    <td style={{ fontWeight: 900 }}>{x.resident.name}</td>
                    <td className="nowrap">{String(x.resident.unit || x.resident.lockedUnit || '—')} / {String(x.resident.room || x.resident.lockedRoom || '—')}</td>
                    <td className="nowrap" style={{ fontWeight: 900, color: x.fluDue ? 'var(--danger, #ff4a68)' : undefined }}>{x.fluDue ? 'YES' : 'NO'}</td>
                    <td className="nowrap">{x.lastFlu || '—'}</td>
                    <td className="nowrap" style={{ fontWeight: 900, color: x.covidDue ? 'var(--danger, #ff4a68)' : undefined }}>{x.covidDue ? 'YES' : 'NO'}</td>
                    <td className="nowrap">{x.lastCovid || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {vaxDue.length > 250 && <div className="muted mini">Showing first 250 rows.</div>}
          </div>

          <div className="card" style={{ margin: 0 }}>
            <h3>Vaccination Summary</h3>
            <div className="grid cols3">
              <div className="kpi"><div><div className="lbl">Residents in report</div><div className="big">{residents.length}</div></div></div>
              <div className="kpi"><div><div className="lbl">Residents Due</div><div className="big">{vaxDue.length}</div></div></div>
              <div className="kpi"><div><div className="lbl">Compliance</div><div className="big">{residents.length ? `${Math.round(((residents.length - vaxDue.length) / residents.length) * 100)}%` : '—'}</div></div></div>
            </div>
            <div className="sep" />
            <div className="muted mini">Note: Compliance here is based on the simplified 365-day rule and available entries. We can align this with your locked Vax Tracker logic next.</div>
          </div>
        </div>
      )}

      {tab === 'ip' && (
        <div className="grid cols2">
          <div className="card" style={{ margin: 0 }}>
            <h3>Active Precautions Summary</h3>
            <div className="grid cols3">
              <div className="kpi"><div><div className="lbl">Active Cases</div><div className="big">{activeCases.length}</div></div></div>
              <div className="kpi"><div><div className="lbl">Contact</div><div className="big">{ipPrecautions['Contact'] || 0}</div></div></div>
              <div className="kpi"><div><div className="lbl">Droplet</div><div className="big">{ipPrecautions['Droplet'] || 0}</div></div></div>
            </div>
            <div className="sep" />
            <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
              <button className="btn" type="button" onClick={exportIpLineListCsv}>Export Active Line List (CSV)</button>
            </div>
            <div className="sep" />
            <table className="thin">
              <thead><tr><th>Resident</th><th>Unit/Room</th><th>Precautions</th><th className="nowrap">Onset</th><th>Syndrome/Organism</th></tr></thead>
              <tbody>
                {activeCases.slice(0, 180).map((c) => (
                  <tr key={c.id}>
                    <td style={{ fontWeight: 900 }}>{c.residentName}</td>
                    <td className="nowrap">{c.unit || '—'} / {c.room || '—'}</td>
                    <td className="nowrap">{c.precautions}</td>
                    <td className="nowrap">{c.onsetDateISO}</td>
                    <td>{[c.syndrome, c.organism].filter(Boolean).join(' — ') || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="card" style={{ margin: 0 }}>
            <h3>Precautions breakdown</h3>
            <table className="thin">
              <thead><tr><th>Precaution</th><th className="nowrap">Count</th></tr></thead>
              <tbody>
                {Object.keys(ipPrecautions).sort().map((p) => (
                  <tr key={p}><td style={{ fontWeight: 900 }}>{p}</td><td className="nowrap">{ipPrecautions[p]}</td></tr>
                ))}
              </tbody>
            </table>
            <div className="sep" />
            <div className="muted mini">Next: outbreak mode (case-first contact tracing) + printable line list.</div>
          </div>
        </div>
      )}

      {tab === 'qapi' && (
        <div className="grid cols2">
          <div className="card" style={{ margin: 0 }}>
            <h3>ABT Monthly QAPI (Draft)</h3>
            <div className="muted mini">Counts by start month. Next step will align column order/headings to your locked ABT report template.</div>
            <div className="sep" />
            <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
              <button className="btn" type="button" onClick={exportAbtMonthlyCsv}>Export Monthly QAPI (CSV)</button>
            </div>
            <div className="sep" />
            <table className="thin">
              <thead><tr><th>Month</th><th className="nowrap">Starts</th><th className="nowrap">Stopped</th><th className="nowrap">Active at End</th></tr></thead>
              <tbody>
                {Object.keys(abtByMonth).sort().map((m) => (
                  <tr key={m}>
                    <td style={{ fontWeight: 900 }}>{m}</td>
                    <td className="nowrap">{abtByMonth[m].starts}</td>
                    <td className="nowrap">{abtByMonth[m].stopped}</td>
                    <td className="nowrap">{abtByMonth[m].activeAtEnd}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="card" style={{ margin: 0 }}>
            <h3>Next reporting parity items</h3>
            <ul className="mini muted">
              <li>ABT: Active/Ongoing template parity (column order, headings, print layout).</li>
              <li>Vaccination: policy-aware due logic (season, series, refusals, contraindications).</li>
              <li>IP: outbreak workspace (case-first) + automated contact list.</li>
              <li>Bundle exports: CSV/JSON packets for QAPI minutes + surveyor packet.</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
