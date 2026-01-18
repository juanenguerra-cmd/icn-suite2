import React, { useMemo, useState } from 'react';
import { useIcnStore } from '../store/icnStore';
import type { CensusParsedEntry } from '../types/core';
import { parseCensusRaw, makeResidentId } from '../utils/census';
import { safeDateLabel, todayKey } from '../utils/time';

function countByUnit(entries: CensusParsedEntry[]) {
  const unitCounts: Record<string, number> = {};
  let total = 0;
  for (const e of entries) {
    const u = (e.unit || '').trim() || 'Unassigned';
    unitCounts[u] = (unitCounts[u] || 0) + 1;
    total += 1;
  }
  return { unitCounts, total };
}

export function CensusPage() {
  const { data, dispatch } = useIcnStore();
  const [parsed, setParsed] = useState<CensusParsedEntry[]>([]);
  const [lastParsedAt, setLastParsedAt] = useState<string | null>(null);

  const rawText = data.census.rawText;

  const { unitCounts, total } = useMemo(() => countByUnit(parsed), [parsed]);

  function onParse() {
    const out = parseCensusRaw(rawText, data.config);
    setParsed(out);
    setLastParsedAt(new Date().toISOString());
  }

  function onApply() {
    if (parsed.length === 0) return;
    const rows = parsed.map((e) => {
      const id = makeResidentId({ mrn: e.mrn, unit: e.unit, room: e.room, name: e.name });
      return {
        id,
        resident: {
          id,
          name: e.name || '',
          mrn: e.mrn || '',
          room: e.room || '',
          unit: (e.unit || '') as any,
          dob: e.dob || '',
          payorSource: e.payorSource || '',
          status: 'Active' as const,
          createdAt: new Date().toISOString()
        }
      };
    });

    const activeIds = rows.map((r) => r.id);
    dispatch({ type: 'CENSUS_APPLY', entries: rows, activeIds });
    dispatch({ type: 'CENSUS_RECORD_SNAPSHOT', date: todayKey(), unitCounts, total });
  }

  return (
    <div className="wrap">
      <div className="pageHead">
        <div>
          <h2 style={{ margin: 0 }}>Census Paste → Parse → Apply</h2>
          <div className="muted mini">Paste raw census (tab-delimited) and apply to the central resident database.</div>
        </div>
        <div className="chips">
          <span className="chip">
            <span>Active Census</span> <span className="n">{data.census.activeResidentIds.length}</span>
          </span>
          <span className="chip">
            <span>Last Pasted</span> <span className="n">{safeDateLabel(data.census.lastPastedAt)}</span>
          </span>
        </div>
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <label>Raw Census Text</label>
        <textarea
          value={rawText}
          onChange={(e) => dispatch({ type: 'CENSUS_SET_RAW', rawText: e.target.value })}
          placeholder="Paste census here..."
          style={{ minHeight: 180 }}
        />
        <div className="row" style={{ marginTop: 10, gap: 10, flexWrap: 'wrap' }}>
          <button className="btn" onClick={onParse}>
            Parse
          </button>
          <button className="btn primary" onClick={onApply} disabled={parsed.length === 0}>
            Apply Census
          </button>
          <span className="muted mini">
            {lastParsedAt ? `Parsed: ${safeDateLabel(lastParsedAt)} (${parsed.length} rows)` : 'Not parsed yet'}
          </span>
        </div>
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontWeight: 900 }}>Parsed Preview</div>
          <div className="chips">
            <span className="chip">
              <span>Total</span> <span className="n">{total}</span>
            </span>
            {Object.keys(unitCounts).map((u) => (
              <span className="chip" key={u}>
                <span>{u}</span> <span className="n">{unitCounts[u]}</span>
              </span>
            ))}
          </div>
        </div>
        <div className="sep"></div>
        {parsed.length === 0 ? (
          <div className="muted">Nothing parsed yet. Click Parse.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="tbl" style={{ minWidth: 780 }}>
              <thead>
                <tr>
                  <th style={{ width: 180 }}>Name</th>
                  <th style={{ width: 90 }}>MRN</th>
                  <th style={{ width: 90 }}>Room</th>
                  <th style={{ width: 110 }}>Unit</th>
                  <th style={{ width: 100 }}>DOB</th>
                  <th>Payor</th>
                </tr>
              </thead>
              <tbody>
                {parsed.slice(0, 200).map((e, idx) => (
                  <tr key={idx}>
                    <td>{e.name}</td>
                    <td className="mono">{e.mrn}</td>
                    <td className="mono">{e.room}</td>
                    <td>{e.unit || '—'}</td>
                    <td className="mono">{e.dob || '—'}</td>
                    <td>{e.payorSource || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {parsed.length > 200 ? <div className="muted mini" style={{ marginTop: 8 }}>Showing first 200 rows.</div> : null}
          </div>
        )}
      </div>
    </div>
  );
}
