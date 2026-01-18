import React, { useMemo, useState } from 'react';
import { useIcnStore } from '../store/icnStore';
import type { UnitConfig } from '../types/core';

export function ConfigPage() {
  const { data, dispatch } = useIcnStore();
  const [facilityName, setFacilityName] = useState(data.config.facilityName);
  const [totalCapacity, setTotalCapacity] = useState(String(data.config.totalCapacity || ''));
  const [units, setUnits] = useState<UnitConfig[]>(data.config.units);

  const totalUnitsCap = useMemo(() => units.reduce((s, u) => s + (Number(u.capacity) || 0), 0), [units]);

  function updateUnit(idx: number, patch: Partial<UnitConfig>) {
    setUnits((prev) => prev.map((u, i) => (i === idx ? { ...u, ...patch } : u)));
  }

  function apply() {
    dispatch({
      type: 'SET_CONFIG',
      config: {
        facilityName: facilityName.trim() || data.config.facilityName,
        totalCapacity: Number(totalCapacity) || totalUnitsCap || data.config.totalCapacity,
        units: units.map((u) => ({ ...u, capacity: Number(u.capacity) || 0 }))
      }
    } as any);
    alert('Config saved.');
  }

  function resetDefaults() {
    if (!confirm('Reset unit capacities to default 50 each (Units 2/3/4)?')) return;
    setUnits([
      { unitKey: 'Unit 2', unitName: 'Unit 2', capacity: 50 },
      { unitKey: 'Unit 3', unitName: 'Unit 3', capacity: 50 },
      { unitKey: 'Unit 4', unitName: 'Unit 4', capacity: 50 }
    ] as any);
    setTotalCapacity('150');
  }

  return (
    <div className="grid cols2" id="tab-config" style={{ minWidth: 980 }}>
      <div className="card">
        <h2>Facility Settings</h2>
        <div className="grid" style={{ gap: 10 }}>
          <div>
            <label>Facility Name</label>
            <input value={facilityName} onChange={(e) => setFacilityName(e.target.value)} />
          </div>

          <div className="grid cols2" style={{ gap: 10 }}>
            <div>
              <label>Total Capacity (optional override)</label>
              <input type="number" value={totalCapacity} onChange={(e) => setTotalCapacity(e.target.value)} />
              <div className="mini muted" style={{ marginTop: 6 }}>
                If blank, total will use the sum of unit capacities.
              </div>
            </div>
            <div>
              <label>Sum of Unit Capacities</label>
              <div className="badge">{totalUnitsCap}</div>
              <div className="mini muted" style={{ marginTop: 6 }}>
                Current live total: {data.config.totalCapacity}
              </div>
            </div>
          </div>

          <div className="row end">
            <button className="btn" type="button" onClick={resetDefaults}>
              Reset to Unit 2/3/4 = 50
            </button>
            <button className="btn primary edit-only" type="button" onClick={apply}>
              Save Config
            </button>
          </div>
        </div>
      </div>

      <div className="card">
        <h2>Unit Bed Capacity</h2>
        <table className="thin">
          <thead>
            <tr>
              <th>Unit</th>
              <th className="nowrap">Capacity</th>
            </tr>
          </thead>
          <tbody>
            {units.map((u, idx) => (
              <tr key={u.unitKey + idx}>
                <td style={{ fontWeight: 900 }}>{u.unitName}</td>
                <td className="nowrap">
                  <input
                    type="number"
                    value={String(u.capacity || '')}
                    onChange={(e) => updateUnit(idx, { capacity: Number(e.target.value) || 0 })}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="sep" />
        <div className="muted mini">
          Next migration: unit alias editor (room mapping), threshold settings, report presets.
        </div>
      </div>
    </div>
  );
}
