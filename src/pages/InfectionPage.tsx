import React, { useMemo, useState } from 'react';
import { useIcnStore } from '../store/icnStore';
import type { InfectionCase, PrecautionType, Resident } from '../types/core';
import { ResidentPicker } from '../components/ResidentPicker';
import { generateId } from '../utils/id';
import { nowISO, safeDateLabel } from '../utils/time';

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

export function InfectionPage({ includeDischarged }: Props) {
  const { data, dispatch } = useIcnStore();
  const residents = useMemo(
    () => residentList(data.residentsById, data.census.activeResidentIds, includeDischarged),
    [data.residentsById, data.census.activeResidentIds, includeDischarged]
  );

  const [selected, setSelected] = useState<Resident | null>(null);
  const [onset, setOnset] = useState(() => new Date().toISOString().slice(0, 10));
  const [syndrome, setSyndrome] = useState('');
  const [organism, setOrganism] = useState('');
  const [precautions, setPrecautions] = useState<PrecautionType>('Unknown');
  const [notes, setNotes] = useState('');
  const [search, setSearch] = useState('');
  const [activeOnly, setActiveOnly] = useState(true);

  const activeCases = useMemo(() => (data.infectionCases || []).filter((c) => !c.resolvedDateISO).length, [data.infectionCases]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data.infectionCases || []).filter((c) => {
      if (activeOnly && c.resolvedDateISO) return false;
      if (!q) return true;
      const hay = `${c.residentName} ${c.mrn || ''} ${c.syndrome || ''} ${c.organism || ''} ${c.precautions} ${c.unit || ''} ${c.room || ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [data.infectionCases, search, activeOnly]);

  function addCase() {
    if (!selected) return alert('Select a resident first.');
    if (!onset.trim()) return alert('Onset date is required.');

    const entry: InfectionCase = {
      id: generateId('ip'),
      residentId: selected.id,
      residentName: selected.name,
      mrn: selected.mrn,
      unit: String(selected.unit || selected.lockedUnit || ''),
      room: selected.room || selected.lockedRoom || '',
      onsetDateISO: onset.trim(),
      syndrome: syndrome.trim() || undefined,
      organism: organism.trim() || undefined,
      precautions,
      notes: notes.trim() || undefined,
      createdAt: nowISO(),
      updatedAt: nowISO()
    };

    dispatch({ type: 'LIST_ADD', list: 'infectionCases', item: entry } as any);
    setSyndrome('');
    setOrganism('');
    setNotes('');
  }

  function resolveCase(id: string) {
    dispatch({ type: 'LIST_UPDATE', list: 'infectionCases', id, patch: { resolvedDateISO: new Date().toISOString().slice(0, 10) } } as any);
  }

  function deleteCase(id: string) {
    if (!confirm('Delete this case entry?')) return;
    dispatch({ type: 'LIST_DELETE', list: 'infectionCases', id } as any);
  }

  return (
    <div className="grid cols2" id="tab-ip" style={{ minWidth: 980 }}>
      <div className="card">
        <h2>Case Entry</h2>
        <div className="grid" style={{ gap: 10 }}>
          <ResidentPicker residents={residents} valueId={selected?.id || ''} onChange={setSelected} />

          <div className="grid cols2" style={{ gap: 10 }}>
            <div>
              <label>Onset Date</label>
              <input type="date" value={onset} onChange={(e) => setOnset(e.target.value)} />
            </div>
            <div>
              <label>Precautions</label>
              <select value={precautions} onChange={(e) => setPrecautions(e.target.value as PrecautionType)}>
                <option value="Unknown">Unknown</option>
                <option value="Standard">Standard</option>
                <option value="Contact">Contact</option>
                <option value="Droplet">Droplet</option>
                <option value="Airborne">Airborne</option>
                <option value="Enhanced Barrier">Enhanced Barrier</option>
              </select>
            </div>
          </div>

          <div className="grid cols2" style={{ gap: 10 }}>
            <div>
              <label>Syndrome</label>
              <input value={syndrome} onChange={(e) => setSyndrome(e.target.value)} placeholder="UTI / Respiratory / GI / Skin…" />
            </div>
            <div>
              <label>Organism</label>
              <input value={organism} onChange={(e) => setOrganism(e.target.value)} placeholder="MRSA / C. diff / COVID-19…" />
            </div>
          </div>

          <div>
            <label>Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Isolation signage, symptoms, lab notes, contacts…" />
          </div>

          <div className="row end">
            <button className="btn primary edit-only" type="button" onClick={addCase}>
              Save Case
            </button>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ marginBottom: 0 }}>Line List</h2>
            <div className="muted mini">Active: {activeCases} · Total: {data.infectionCases.length}</div>
          </div>
          <label className="badge" style={{ cursor: 'pointer', userSelect: 'none' }}>
            <input type="checkbox" checked={activeOnly} onChange={(e) => setActiveOnly(e.target.checked)} />
            <span>Active Only</span>
          </label>
        </div>

        <div className="sep" />

        <div>
          <label>Search</label>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, organism, unit, precautions…" />
        </div>

        <div className="sep" />

        <table className="thin">
          <thead>
            <tr>
              <th>Resident</th>
              <th className="nowrap">Onset</th>
              <th>Syndrome / Organism</th>
              <th className="nowrap">Precautions</th>
              <th className="nowrap">Resolved</th>
              <th className="nowrap">Unit/Room</th>
              <th className="nowrap">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="muted">No cases.</td>
              </tr>
            ) : (
              filtered.map((c) => (
                <tr key={c.id}>
                  <td>
                    <div style={{ fontWeight: 900 }}>{c.residentName}</div>
                    <div className="muted mini">{c.notes ? c.notes.slice(0, 80) + (c.notes.length > 80 ? '…' : '') : '—'}</div>
                  </td>
                  <td className="nowrap">{safeDateLabel(c.onsetDateISO)}</td>
                  <td>
                    <div style={{ fontWeight: 900 }}>{c.syndrome || '—'}</div>
                    <div className="muted mini">{c.organism || '—'}</div>
                  </td>
                  <td className="nowrap">{c.precautions}</td>
                  <td className="nowrap">{c.resolvedDateISO ? safeDateLabel(c.resolvedDateISO) : '—'}</td>
                  <td className="nowrap">{[c.unit, c.room].filter(Boolean).join(' · ') || '—'}</td>
                  <td className="nowrap">
                    {!c.resolvedDateISO && (
                      <button className="smallbtn edit-only" type="button" onClick={() => resolveCase(c.id)}>
                        Resolve
                      </button>
                    )}{' '}
                    <button className="smallbtn danger edit-only" type="button" onClick={() => deleteCase(c.id)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        <div className="sep" />
        <div className="muted mini">
          Next migration: contact tracing workspace + outbreak line listing export.
        </div>
      </div>
    </div>
  );
}
