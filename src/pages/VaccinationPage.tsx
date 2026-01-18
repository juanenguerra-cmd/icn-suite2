import React, { useMemo, useState } from 'react';
import { useIcnStore } from '../store/icnStore';
import type { Resident, VaccinationEntry, VaccinationStatus } from '../types/core';
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

function normDate(s: string): string {
  return String(s || '').trim();
}

function vaxKey(v: Pick<VaccinationEntry, 'residentId' | 'vaccineType' | 'dateISO'>): string {
  return `${v.residentId}::${(v.vaccineType || '').toUpperCase()}::${normDate(v.dateISO)}`;
}

export function VaccinationPage({ includeDischarged }: Props) {
  const { data, dispatch } = useIcnStore();
  const residents = useMemo(
    () => residentList(data.residentsById, data.census.activeResidentIds, includeDischarged),
    [data.residentsById, data.census.activeResidentIds, includeDischarged]
  );

  const [selected, setSelected] = useState<Resident | null>(null);
  const [vaccineType, setVaccineType] = useState('Influenza');
  const [dateISO, setDateISO] = useState(() => new Date().toISOString().slice(0, 10));
  const [status, setStatus] = useState<VaccinationStatus>('Given');
  const [notes, setNotes] = useState('');

  const [search, setSearch] = useState('');
  const [dupOnly, setDupOnly] = useState(false);

  const duplicates = useMemo(() => {
    const m = new Map<string, number>();
    for (const v of data.vaccinations) {
      const k = vaxKey(v);
      m.set(k, (m.get(k) || 0) + 1);
    }
    const d = new Set<string>();
    for (const [k, n] of m.entries()) if (n > 1) d.add(k);
    return d;
  }, [data.vaccinations]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data.vaccinations || []).filter((v) => {
      if (dupOnly && !duplicates.has(vaxKey(v))) return false;
      if (!q) return true;
      const hay = `${v.residentName} ${v.mrn || ''} ${v.vaccineType} ${v.unit || ''} ${v.room || ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [data.vaccinations, search, dupOnly, duplicates]);

  const willBeDup = useMemo(() => {
    if (!selected) return false;
    const k = vaxKey({ residentId: selected.id, vaccineType, dateISO } as any);
    return data.vaccinations.some((v) => vaxKey(v) === k);
  }, [selected, vaccineType, dateISO, data.vaccinations]);

  function addEntry() {
    if (!selected) return alert('Select a resident first.');
    if (!vaccineType.trim()) return alert('Enter vaccine type.');
    if (!dateISO.trim()) return alert('Enter date.');

    const entry: VaccinationEntry = {
      id: generateId('vax'),
      residentId: selected.id,
      residentName: selected.name,
      mrn: selected.mrn,
      unit: String(selected.unit || selected.lockedUnit || ''),
      room: selected.room || selected.lockedRoom || '',
      vaccineType: vaccineType.trim(),
      dateISO: normDate(dateISO),
      status,
      notes: notes.trim() || undefined,
      createdAt: nowISO(),
      updatedAt: nowISO()
    };

    // Soft warning before saving
    if (willBeDup) {
      const ok = confirm('This looks like a duplicate (Resident + Date + Type). Save anyway?');
      if (!ok) return;
    }

    dispatch({ type: 'LIST_ADD', list: 'vaccinations', item: entry } as any);
    setNotes('');
  }

  function deleteEntry(id: string) {
    if (!confirm('Delete this vaccination entry?')) return;
    dispatch({ type: 'LIST_DELETE', list: 'vaccinations', id } as any);
  }

  return (
    <div className="grid cols2" id="tab-vax" style={{ minWidth: 980 }}>
      <div className="card">
        <h2>Vaccination Entry</h2>
        <div className="grid" style={{ gap: 10 }}>
          <ResidentPicker residents={residents} valueId={selected?.id || ''} onChange={setSelected} disabled={false} />

          <div className="grid cols2" style={{ gap: 10 }}>
            <div>
              <label>Vaccine Type</label>
              <input value={vaccineType} onChange={(e) => setVaccineType(e.target.value)} placeholder="Influenza / COVID-19 / Pneumococcal…" />
            </div>
            <div>
              <label>Date</label>
              <input type="date" value={dateISO} onChange={(e) => setDateISO(e.target.value)} />
            </div>
          </div>

          <div className="grid cols2" style={{ gap: 10 }}>
            <div>
              <label>Status</label>
              <select value={status} onChange={(e) => setStatus(e.target.value as VaccinationStatus)}>
                <option value="Given">Given</option>
                <option value="Refused">Refused</option>
                <option value="Contraindicated">Contraindicated</option>
                <option value="Unknown">Unknown</option>
              </select>
            </div>
            <div>
              <label>Duplicate Check</label>
              <div className="badge" style={{ alignItems: 'center' }}>
                <span className={willBeDup ? 'badgeDup' : ''}>{willBeDup ? '⚠️ Duplicate detected' : 'No duplicate detected'}</span>
              </div>
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
            <h2 style={{ marginBottom: 0 }}>Vaccine Log</h2>
            <div className="muted mini">Total: {data.vaccinations.length}</div>
          </div>
          <div className="row" style={{ gap: 8 }}>
            <label className="badge" style={{ cursor: 'pointer', userSelect: 'none' }}>
              <input type="checkbox" checked={dupOnly} onChange={(e) => setDupOnly(e.target.checked)} />
              <span>Show Duplicates Only</span>
            </label>
          </div>
        </div>

        <div className="sep" />

        <div className="row" style={{ gap: 10 }}>
          <div style={{ flex: 1 }}>
            <label>Search</label>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, unit, type…" />
          </div>
        </div>

        <div className="sep" />

        <table className="thin">
          <thead>
            <tr>
              <th className="nowrap">Date</th>
              <th>Resident</th>
              <th className="nowrap">Type</th>
              <th className="nowrap">Status</th>
              <th className="nowrap">Unit/Room</th>
              <th className="nowrap">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="muted">No entries.</td>
              </tr>
            ) : (
              filtered.map((v) => {
                const isDup = duplicates.has(vaxKey(v));
                return (
                  <tr key={v.id} className={isDup ? 'trDup' : ''}>
                    <td className="nowrap">{safeDateLabel(v.dateISO)}</td>
                    <td>
                      <div style={{ fontWeight: 900 }}>{v.residentName}</div>
                      <div className="muted mini">{v.mrn ? `MRN ${v.mrn}` : '—'}</div>
                    </td>
                    <td className="nowrap">{v.vaccineType}</td>
                    <td className="nowrap">
                      {v.status}
                      {isDup && <span className="badge badgeDup" style={{ marginLeft: 6 }}>DUP</span>}
                    </td>
                    <td className="nowrap">{[v.unit, v.room].filter(Boolean).join(' · ') || '—'}</td>
                    <td className="nowrap">
                      <button className="smallbtn danger edit-only" type="button" onClick={() => deleteEntry(v.id)}>
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
