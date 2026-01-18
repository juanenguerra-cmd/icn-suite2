import React, { useMemo, useState } from 'react';
import { useIcnStore } from '../store/icnStore';
import type { AntibioticEntry, AntibioticStatus, Resident } from '../types/core';
import { generateId } from '../utils/id';
import { nowISO, safeDateLabel } from '../utils/time';
import { ResidentPicker } from '../components/ResidentPicker';

type Props = {
  includeDischarged: boolean;
};

function residentList(residentsById: Record<string, Resident>, activeIds: string[], includeDischarged: boolean): Resident[] {
  const ids = includeDischarged ? Object.keys(residentsById) : activeIds;
  const list = ids.map((id) => residentsById[id]).filter(Boolean) as Resident[];
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

export function AbtPage({ includeDischarged }: Props) {
  const { data, dispatch } = useIcnStore();
  const residents = useMemo(
    () => residentList(data.residentsById, data.census.activeResidentIds, includeDischarged),
    [data.residentsById, data.census.activeResidentIds, includeDischarged]
  );

  const [selected, setSelected] = useState<Resident | null>(null);
  const [med, setMed] = useState('');
  const [start, setStart] = useState(() => new Date().toISOString().slice(0, 10));
  const [stop, setStop] = useState('');
  const [status, setStatus] = useState<AntibioticStatus>('Active');
  const [indication, setIndication] = useState('');
  const [route, setRoute] = useState('');
  const [dose, setDose] = useState('');
  const [freq, setFreq] = useState('');
  const [notes, setNotes] = useState('');

  const [search, setSearch] = useState('');
  const [activeOnly, setActiveOnly] = useState(true);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data.antibiotics || []).filter((a) => {
      if (activeOnly && a.status !== 'Active') return false;
      if (!q) return true;
      const hay = `${a.residentName} ${a.mrn || ''} ${a.medication} ${a.unit || ''} ${a.room || ''} ${a.indication || ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [data.antibiotics, search, activeOnly]);

  const activeCount = useMemo(() => (data.antibiotics || []).filter((a) => a.status === 'Active').length, [data.antibiotics]);

  function addEntry() {
    if (!selected) return alert('Select a resident first.');
    if (!med.trim()) return alert('Medication is required.');
    if (!start.trim()) return alert('Start date is required.');

    const entry: AntibioticEntry = {
      id: generateId('abt'),
      residentId: selected.id,
      residentName: selected.name,
      mrn: selected.mrn,
      unit: String(selected.unit || selected.lockedUnit || ''),
      room: selected.room || selected.lockedRoom || '',
      medication: med.trim(),
      startDateISO: start.trim(),
      stopDateISO: stop.trim() || undefined,
      status,
      indication: indication.trim() || undefined,
      route: route.trim() || undefined,
      dose: dose.trim() || undefined,
      frequency: freq.trim() || undefined,
      notes: notes.trim() || undefined,
      createdAt: nowISO(),
      updatedAt: nowISO()
    };

    dispatch({ type: 'LIST_ADD', list: 'antibiotics', item: entry } as any);
    setMed('');
    setIndication('');
    setRoute('');
    setDose('');
    setFreq('');
    setNotes('');
  }

  function stopEntry(id: string) {
    dispatch({ type: 'LIST_UPDATE', list: 'antibiotics', id, patch: { status: 'Stopped', stopDateISO: new Date().toISOString().slice(0, 10) } } as any);
  }

  function deleteEntry(id: string) {
    if (!confirm('Delete this antibiotic entry?')) return;
    dispatch({ type: 'LIST_DELETE', list: 'antibiotics', id } as any);
  }

  return (
    <div className="grid cols2" id="tab-abt" style={{ minWidth: 980 }}>
      <div className="card">
        <h2>Antibiotic Entry</h2>
        <div className="grid" style={{ gap: 10 }}>
          <ResidentPicker residents={residents} valueId={selected?.id || ''} onChange={setSelected} />

          <div>
            <label>Medication</label>
            <input value={med} onChange={(e) => setMed(e.target.value)} placeholder="e.g., Ceftriaxone" />
          </div>

          <div className="grid cols2" style={{ gap: 10 }}>
            <div>
              <label>Start Date</label>
              <input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div>
              <label>Stop Date</label>
              <input type="date" value={stop} onChange={(e) => setStop(e.target.value)} />
            </div>
          </div>

          <div className="grid cols2" style={{ gap: 10 }}>
            <div>
              <label>Status</label>
              <select value={status} onChange={(e) => setStatus(e.target.value as AntibioticStatus)}>
                <option value="Active">Active</option>
                <option value="Stopped">Stopped</option>
                <option value="Unknown">Unknown</option>
              </select>
            </div>
            <div>
              <label>Indication</label>
              <input value={indication} onChange={(e) => setIndication(e.target.value)} placeholder="UTI / PNA / SSTI…" />
            </div>
          </div>

          <div className="grid cols3" style={{ gap: 10 }}>
            <div>
              <label>Route</label>
              <input value={route} onChange={(e) => setRoute(e.target.value)} placeholder="PO / IV" />
            </div>
            <div>
              <label>Dose</label>
              <input value={dose} onChange={(e) => setDose(e.target.value)} placeholder="500 mg" />
            </div>
            <div>
              <label>Frequency</label>
              <input value={freq} onChange={(e) => setFreq(e.target.value)} placeholder="BID" />
            </div>
          </div>

          <div>
            <label>Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes…" />
          </div>

          <div className="row end">
            <button className="btn primary edit-only" type="button" onClick={addEntry}>
              Save Entry
            </button>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ marginBottom: 0 }}>Antibiotic Log</h2>
            <div className="muted mini">Active: {activeCount} · Total: {data.antibiotics.length}</div>
          </div>
          <label className="badge" style={{ cursor: 'pointer', userSelect: 'none' }}>
            <input type="checkbox" checked={activeOnly} onChange={(e) => setActiveOnly(e.target.checked)} />
            <span>Active Only</span>
          </label>
        </div>

        <div className="sep" />

        <div>
          <label>Search</label>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, med, unit, indication…" />
        </div>

        <div className="sep" />

        <table className="thin">
          <thead>
            <tr>
              <th>Resident</th>
              <th className="nowrap">Medication</th>
              <th className="nowrap">Start</th>
              <th className="nowrap">Stop</th>
              <th className="nowrap">Status</th>
              <th className="nowrap">Unit/Room</th>
              <th className="nowrap">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="muted">No entries.</td>
              </tr>
            ) : (
              filtered.map((a) => (
                <tr key={a.id}>
                  <td>
                    <div style={{ fontWeight: 900 }}>{a.residentName}</div>
                    <div className="muted mini">{a.indication || '—'}</div>
                  </td>
                  <td className="nowrap">{a.medication}</td>
                  <td className="nowrap">{safeDateLabel(a.startDateISO)}</td>
                  <td className="nowrap">{a.stopDateISO ? safeDateLabel(a.stopDateISO) : '—'}</td>
                  <td className="nowrap">{a.status}</td>
                  <td className="nowrap">{[a.unit, a.room].filter(Boolean).join(' · ') || '—'}</td>
                  <td className="nowrap">
                    {a.status === 'Active' && (
                      <button className="smallbtn edit-only" type="button" onClick={() => stopEntry(a.id)}>
                        Stop
                      </button>
                    )}{' '}
                    <button className="smallbtn danger edit-only" type="button" onClick={() => deleteEntry(a.id)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
