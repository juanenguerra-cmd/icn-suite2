import React, { useMemo, useState } from 'react';
import { useIcnStore } from '../store/icnStore';
import type { Resident, ResidentNote, VaccinationEntry, AntibioticEntry } from '../types/core';
import { generateId } from '../utils/id';
import { nowISO, safeDateLabel } from '../utils/time';
import { ResidentPicker } from '../components/ResidentPicker';
import { BulkPasteModal } from '../components/BulkPasteModal';

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function addDaysISO(dateISO: string, delta: number) {
  const d = new Date(dateISO);
  d.setDate(d.getDate() + delta);
  return d.toISOString().slice(0, 10);
}

function residentList(residentsById: Record<string, Resident>, activeIds: string[]): Resident[] {
  const list = activeIds.map((id) => residentsById[id]).filter(Boolean) as Resident[];
  return list.sort((a, b) => {
    const au = String(a.unit || a.lockedUnit || '');
    const bu = String(b.unit || b.lockedUnit || '');
    const ar = String(a.room || a.lockedRoom || '');
    const br = String(b.room || b.lockedRoom || '');
    const k1 = `${au}|${ar}|${a.name}`.toLowerCase();
    const k2 = `${bu}|${br}|${b.name}`.toLowerCase();
    return k1.localeCompare(k2);
  });
}

function withinLastMonths(dateISO: string, months: number) {
  const d = new Date(dateISO);
  if (Number.isNaN(d.getTime())) return false;
  const t = new Date();
  const cutoff = new Date(t);
  cutoff.setMonth(cutoff.getMonth() - months);
  return d >= cutoff && d <= t;
}

function getCurrentFluSeasonWindow(today = new Date()) {
  // Season: Aug 1 -> Mar 31 (cross-year)
  const year = today.getFullYear();
  const seasonStartThisYear = new Date(year, 7, 1); // Aug 1
  const startYear = today >= seasonStartThisYear ? year : year - 1;
  const seasonStart = new Date(startYear, 7, 1);
  const seasonEnd = new Date(startYear + 1, 2, 31);
  return { seasonStart, seasonEnd };
}

function isFluUpToDate(vax: VaccinationEntry[]) {
  const flu = vax.filter((v) => String(v.vaccineType || '').toLowerCase().includes('flu') || String(v.vaccineType || '').toLowerCase().includes('influ'));
  if (flu.length === 0) return false;
  const { seasonStart, seasonEnd } = getCurrentFluSeasonWindow(new Date());
  return flu.some((v) => {
    const d = new Date(v.dateISO);
    if (Number.isNaN(d.getTime())) return false;
    return d >= seasonStart && d <= seasonEnd && withinLastMonths(v.dateISO, 10);
  });
}

function isCovidUpToDate(vax: VaccinationEntry[]) {
  const covid = vax.filter((v) => String(v.vaccineType || '').toLowerCase().includes('covid'));
  if (covid.length === 0) return false;
  return covid.some((v) => withinLastMonths(v.dateISO, 12));
}

export function DashboardPage() {
  const { data, dispatch } = useIcnStore();

  const residents = useMemo(() => residentList(data.residentsById, data.census.activeResidentIds), [data.residentsById, data.census.activeResidentIds]);
  const [selectedId, setSelectedId] = useState('');
  const selected = selectedId ? data.residentsById[selectedId] : null;

  const [noteText, setNoteText] = useState('');

  // Speed mode: bulk import from Dashboard
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkKind, setBulkKind] = useState<'vaccinations' | 'antibiotics'>('vaccinations');

  // Daily Summary date selector
  const [summaryDateISO, setSummaryDateISO] = useState(() => todayISO());

  const selectedVax = useMemo(() => (selected ? data.vaccinations.filter((v) => v.residentId === selected.id) : []), [data.vaccinations, selected]);
  const selectedAbx = useMemo(() => (selected ? data.antibiotics.filter((a) => a.residentId === selected.id) : []), [data.antibiotics, selected]);
  const selectedCases = useMemo(
    () => (selected ? data.infectionCases.filter((c) => c.residentId === selected.id && !c.resolvedDateISO) : []),
    [data.infectionCases, selected]
  );
  const selectedNotes = useMemo(
    () => (selected ? data.residentNotes.filter((n) => n.residentId === selected.id).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))) : []),
    [data.residentNotes, selected]
  );

  const notesForDate = useMemo(() => {
    const list = (data.residentNotes || []).filter((n) => n.dateISO === summaryDateISO);
    // group by residentId
    const groups = new Map<string, ResidentNote[]>();
    for (const n of list) {
      const arr = groups.get(n.residentId) || [];
      arr.push(n);
      groups.set(n.residentId, arr);
    }
    for (const [k, arr] of groups.entries()) {
      arr.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
      groups.set(k, arr);
    }
    // sort groups by unit/room/name
    return Array.from(groups.entries()).sort((a, b) => {
      const ra = data.residentsById[a[0]];
      const rb = data.residentsById[b[0]];
      const ka = `${ra?.unit || ra?.lockedUnit || ''}|${ra?.room || ra?.lockedRoom || ''}|${ra?.name || ''}`.toLowerCase();
      const kb = `${rb?.unit || rb?.lockedUnit || ''}|${rb?.room || rb?.lockedRoom || ''}|${rb?.name || ''}`.toLowerCase();
      return ka.localeCompare(kb);
    });
  }, [data.residentNotes, summaryDateISO, data.residentsById]);

  function addNote() {
    if (!selected) return alert('Select a resident first.');
    const text = noteText.trim();
    if (!text) return;
    const now = nowISO();
    const note: ResidentNote = {
      id: generateId('note'),
      residentId: selected.id,
      residentName: selected.name,
      mrn: selected.mrn,
      unit: String(selected.unit || selected.lockedUnit || ''),
      room: selected.room || selected.lockedRoom || '',
      dateISO: todayISO(),
      text,
      createdAt: now,
      updatedAt: now
    };
    dispatch({ type: 'LIST_ADD', list: 'residentNotes', item: note } as any);
    setNoteText('');
  }

  function deleteNote(id: string) {
    if (!confirm('Delete this note?')) return;
    dispatch({ type: 'LIST_DELETE', list: 'residentNotes', id } as any);
  }

  const cap = Number(data.config.totalCapacity || 0);
  const census = data.census.activeResidentIds.length;
  const occ = cap > 0 ? Math.round((census / cap) * 100) : 0;
  const activeAbxCount = data.antibiotics.filter((a) => a.status === 'Active').length;
  const activeCasesCount = data.infectionCases.filter((c) => !c.resolvedDateISO).length;

  return (
    <section id="tab-dashboard" className="tab">
      <div className="dashGrid">
        <div className="dashLeft">
          <div className="card noprint">
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
              <div>
                <h2 style={{ marginBottom: 0 }}>Speed Mode: Bulk Import Center</h2>
                <div className="muted mini">Paste Vaccinations or ABT entries without switching tabs.</div>
              </div>
              <div className="row" style={{ gap: 8 }}>
                <button
                  className="btn"
                  type="button"
                  onClick={() => {
                    setBulkKind('vaccinations');
                    setBulkOpen(true);
                  }}
                >
                  Bulk Vaccinations
                </button>
                <button
                  className="btn"
                  type="button"
                  onClick={() => {
                    setBulkKind('antibiotics');
                    setBulkOpen(true);
                  }}
                >
                  Bulk ABT
                </button>
              </div>
            </div>
            <div className="sep" />
            <div className="muted mini">
              Format examples:
              <div style={{ marginTop: 6 }}>
                <div><b>Vaccines:</b> 251-A  Flu  01/16/2026  Notes</div>
                <div><b>ABT:</b> 251-A  Ceftriaxone  01/16/2026  PNA  Notes</div>
              </div>
            </div>
          </div>

          <div className="card">
            <h2>Facility Snapshot</h2>
            <div className="kpi">
              <div>
                <div className="lbl">Current Census / Capacity</div>
                <div className="big">{census} / {cap || '—'}</div>
              </div>
              <div style={{ minWidth: 220 }}>
                <div className="lbl">Occupancy</div>
                <div className="progress"><div style={{ width: `${Math.min(100, Math.max(0, occ))}%` }} /></div>
                <div className="mini muted" style={{ marginTop: 6 }}>{cap > 0 ? `${occ}%` : '—'}</div>
              </div>
            </div>

            <div className="sep" />
            <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
              <span className="badge blue">Active ABT: {activeAbxCount}</span>
              <span className="badge red">Active Precautions: {activeCasesCount}</span>
              <span className="badge">Notes today: {(data.residentNotes || []).filter((n) => n.dateISO === todayISO()).length}</span>
            </div>
          </div>

          <div className="card">
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <div>
                <h2 style={{ marginBottom: 0 }}>Daily Summary</h2>
                <div className="muted mini">Select a date to review resident follow-ups.</div>
              </div>
              <div className="row" style={{ gap: 8 }}>
                <button className="smallbtn" type="button" onClick={() => setSummaryDateISO(todayISO())}>Today</button>
                <button className="smallbtn" type="button" onClick={() => setSummaryDateISO(addDaysISO(todayISO(), -1))}>Yesterday</button>
                <input type="date" value={summaryDateISO} onChange={(e) => setSummaryDateISO(e.target.value)} />
              </div>
            </div>
            <div className="sep" />

            {notesForDate.length === 0 ? (
              <div className="muted">No notes for {safeDateLabel(summaryDateISO)}.</div>
            ) : (
              <div className="grid" style={{ gap: 10 }}>
                {notesForDate.map(([rid, items]) => {
                  const r = data.residentsById[rid];
                  const title = r ? `${r.name}` : items[0].residentName;
                  const loc = r ? [r.unit || r.lockedUnit, r.room || r.lockedRoom].filter(Boolean).join(' · ') : [items[0].unit, items[0].room].filter(Boolean).join(' · ');
                  return (
                    <div key={rid} className="itemRow">
                      <div className="row" style={{ justifyContent: 'space-between' }}>
                        <div>
                          <div className="itemTitle">{title}</div>
                          <div className="itemMeta">{loc || '—'}</div>
                        </div>
                        <button className="smallbtn" type="button" onClick={() => setSelectedId(rid)}>View</button>
                      </div>
                      <ul style={{ margin: '8px 0 0 18px' }}>
                        {items.slice(0, 5).map((n) => (
                          <li key={n.id} className="mini">{n.text}</li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="dashRight">
          <div className="card" id="dashResidentCard">
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
              <div>
                <h2 style={{ marginBottom: 0 }}>Resident Profile Viewer</h2>
                <div className="muted mini">Quick notes + ABT + Vaccination + Precautions snapshot.</div>
              </div>
            </div>

            <div className="sep" />
            <ResidentPicker residents={residents} valueId={selectedId} onChange={(r) => setSelectedId(r?.id || '')} />

            {!selected ? (
              <div className="muted" style={{ marginTop: 10 }}>Select a resident to view details.</div>
            ) : (
              <>
                <div className="sep" />
                <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontWeight: 950, fontSize: 16 }}>{selected.name}</div>
                    <div className="muted mini">MRN: {selected.mrn || '—'}</div>
                    <div className="muted mini">{[selected.unit || selected.lockedUnit, selected.room || selected.lockedRoom].filter(Boolean).join(' · ') || '—'}</div>
                  </div>
                  <div className="row" style={{ gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    <span className={"pill " + (isFluUpToDate(selectedVax) ? 'ok' : 'warn')}>Flu {isFluUpToDate(selectedVax) ? '✅' : '⚠️'}</span>
                    <span className={"pill " + (isCovidUpToDate(selectedVax) ? 'ok' : 'warn')}>COVID {isCovidUpToDate(selectedVax) ? '✅' : '⚠️'}</span>
                    <span className={"pill " + (selectedAbx.some((a) => a.status === 'Active') ? 'warn' : 'info')}>ABT {selectedAbx.filter((a) => a.status === 'Active').length}</span>
                    <span className={"pill " + (selectedCases.length ? 'bad' : 'ok')}>Precautions {selectedCases.length}</span>
                  </div>
                </div>

                <div className="sep" />
                <h3>Quick Notes</h3>
                <div className="grid" style={{ gap: 10 }}>
                  <textarea value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="Type quick issues/concerns/follow-up…" />
                  <div className="row end">
                    <button className="btn primary edit-only" type="button" onClick={addNote}>Save Note</button>
                  </div>
                </div>

                {selectedNotes.length > 0 && (
                  <div className="sep" />
                )}
                {selectedNotes.length > 0 && (
                  <div className="grid" style={{ gap: 8 }}>
                    {selectedNotes.slice(0, 10).map((n) => (
                      <div key={n.id} className="itemRow">
                        <div className="row" style={{ justifyContent: 'space-between' }}>
                          <div className="muted mini">{safeDateLabel(n.dateISO)}</div>
                          <button className="smallbtn danger edit-only" type="button" onClick={() => deleteNote(n.id)}>Delete</button>
                        </div>
                        <div style={{ marginTop: 6 }}>{n.text}</div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="sep" />
                <h3>ABT History</h3>
                <div className="tableWrap">
                  <table className="thin">
                    <thead>
                      <tr>
                        <th>Medication</th>
                        <th className="nowrap">Start</th>
                        <th className="nowrap">Stop</th>
                        <th className="nowrap">Status</th>
                        <th>Indication</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedAbx.length === 0 ? (
                        <tr><td colSpan={5} className="muted">No antibiotics.</td></tr>
                      ) : (
                        selectedAbx
                          .slice()
                          .sort((a, b) => String(b.startDateISO).localeCompare(String(a.startDateISO)))
                          .slice(0, 12)
                          .map((a: AntibioticEntry) => (
                            <tr key={a.id}>
                              <td>{a.medication}</td>
                              <td className="nowrap">{safeDateLabel(a.startDateISO)}</td>
                              <td className="nowrap">{a.stopDateISO ? safeDateLabel(a.stopDateISO) : '—'}</td>
                              <td className="nowrap">{a.status}</td>
                              <td>{a.indication || '—'}</td>
                            </tr>
                          ))
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="sep" />
                <h3>Vaccination History</h3>
                <div className="tableWrap">
                  <table className="thin">
                    <thead>
                      <tr>
                        <th className="nowrap">Date</th>
                        <th>Type</th>
                        <th className="nowrap">Status</th>
                        <th>Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedVax.length === 0 ? (
                        <tr><td colSpan={4} className="muted">No vaccinations.</td></tr>
                      ) : (
                        selectedVax
                          .slice()
                          .sort((a, b) => String(b.dateISO).localeCompare(String(a.dateISO)))
                          .slice(0, 12)
                          .map((v: VaccinationEntry) => (
                            <tr key={v.id}>
                              <td className="nowrap">{safeDateLabel(v.dateISO)}</td>
                              <td>{v.vaccineType}</td>
                              <td className="nowrap">{v.status}</td>
                              <td>{v.notes || '—'}</td>
                            </tr>
                          ))
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="sep" />
                <h3>Active Precautions</h3>
                {selectedCases.length === 0 ? (
                  <div className="muted">No active precautions.</div>
                ) : (
                  <div className="grid" style={{ gap: 8 }}>
                    {selectedCases.map((c) => (
                      <div key={c.id} className="itemRow">
                        <div className="row" style={{ justifyContent: 'space-between' }}>
                          <div>
                            <div className="itemTitle">{c.precautions}</div>
                            <div className="itemMeta">Onset: {safeDateLabel(c.onsetDateISO)} · {c.organism || c.syndrome || '—'}</div>
                          </div>
                        </div>
                        {c.notes && <div style={{ marginTop: 6 }} className="mini muted">{c.notes}</div>}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <BulkPasteModal
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        kind={bulkKind}
        residentsById={data.residentsById}
        selectedResidentKey={selected?.id}
        onImportMany={(items) => {
          dispatch({ type: 'LIST_ADD_MANY', list: bulkKind, items } as any);
        }}
      />
    </section>
  );
}
