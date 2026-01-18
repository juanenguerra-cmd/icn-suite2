import React, { useMemo, useState } from 'react';
import type { Resident } from '../types/core';

type Props = {
  residents: Resident[];
  valueId: string;
  onChange: (resident: Resident | null) => void;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
};

function displayResident(r: Resident): string {
  const room = r.room || r.lockedRoom || '';
  const unit = String(r.unit || r.lockedUnit || '').trim();
  const loc = [unit, room].filter(Boolean).join(' · ');
  return `${r.name}${loc ? ` — ${loc}` : ''}`;
}

export function ResidentPicker({ residents, valueId, onChange, label = 'Resident', placeholder = 'Search resident…', disabled }: Props) {
  const [q, setQ] = useState('');

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return residents;
    return residents.filter((r) => {
      const hay = `${r.name} ${r.mrn || ''} ${r.room || ''} ${r.unit || ''}`.toLowerCase();
      return hay.includes(t);
    });
  }, [q, residents]);

  return (
    <div>
      <label>{label}</label>
      <input
        type="text"
        value={q}
        disabled={disabled}
        onChange={(e) => setQ(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
      />
      <div style={{ marginTop: 6 }}>
        <select
          value={valueId}
          disabled={disabled}
          onChange={(e) => {
            const id = e.target.value;
            const r = residents.find((x) => x.id === id) || null;
            onChange(r);
          }}
        >
          <option value="">— Select —</option>
          {filtered.map((r) => (
            <option key={r.id} value={r.id}>
              {displayResident(r)}
            </option>
          ))}
        </select>
      </div>
      <div className="mini muted" style={{ marginTop: 6 }}>
        Showing {filtered.length} of {residents.length}
      </div>
    </div>
  );
}
