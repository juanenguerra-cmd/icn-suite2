import React, { useMemo, useState } from 'react';
import { Modal } from './Modal';
import { buildAbxEntries, buildVaxEntries, parseBulkAbx, parseBulkVax } from '../utils/bulk';
import { generateId } from '../utils/id';
import { nowISO } from '../utils/time';
import type { Resident, VaccinationEntry, AntibioticEntry } from '../types/core';

type Kind = 'vaccinations' | 'antibiotics';

export type BulkImportResult = { added: number; skipped: number; errors: string[] };

type Props = {
  open: boolean;
  onClose: () => void;
  kind: Kind;
  residentsById: Record<string, Resident>;
  selectedResidentKey?: string;
  onImportMany: (items: VaccinationEntry[] | AntibioticEntry[]) => void;
};

export function BulkPasteModal({ open, onClose, kind, residentsById, selectedResidentKey, onImportMany }: Props) {
  const [raw, setRaw] = useState('');
  const [useSelected, setUseSelected] = useState(false);
  const [result, setResult] = useState<BulkImportResult | null>(null);

  const effectiveSelected = useSelected && selectedResidentKey ? selectedResidentKey : undefined;

  const parsed = useMemo(() => {
    setResult(null);
    if (!raw.trim()) return { rows: [], errors: [] as string[] };
    return kind === 'vaccinations' ? parseBulkVax(raw, effectiveSelected) : parseBulkAbx(raw, effectiveSelected);
  }, [raw, kind, effectiveSelected]);

  const title = kind === 'vaccinations' ? 'Bulk Paste Import — Vaccinations' : 'Bulk Paste Import — Antibiotics (ABT)';

  function doImport() {
    const now = nowISO();
    if (kind === 'vaccinations') {
      const built = buildVaxEntries({ residentsById, rows: parsed.rows as any, nowISO: now, generateId });
      onImportMany(built.items);
      setResult({ added: built.items.length, skipped: built.skipped, errors: [...parsed.errors, ...built.errors] });
      return;
    }
    const built = buildAbxEntries({ residentsById, rows: parsed.rows as any, nowISO: now, generateId });
    onImportMany(built.items);
    setResult({ added: built.items.length, skipped: built.skipped, errors: [...parsed.errors, ...built.errors] });
  }

  return (
    <Modal title={title} open={open} onClose={onClose}>
      <div className="grid" style={{ gap: 10 }}>
        <div className="muted mini">
          Delimiters supported: TAB, |, or 2+ spaces. Dates: YYYY-MM-DD or MM/DD/YYYY.
        </div>

        {selectedResidentKey && (
          <label className="badge" style={{ cursor: 'pointer', userSelect: 'none', gap: 8, justifyContent: 'flex-start' }}>
            <input type="checkbox" checked={useSelected} onChange={(e) => setUseSelected(e.target.checked)} />
            <span>Use selected resident only</span>
            <span className="muted mini">({selectedResidentKey})</span>
          </label>
        )}

        <textarea value={raw} onChange={(e) => setRaw(e.target.value)} placeholder={
          kind === 'vaccinations'
            ? (effectiveSelected
              ? 'VaccineType\tDate\tNotes\nFlu\t01/16/2026\tGiven at bedside'
              : 'Room-Bed or MRN\tVaccineType\tDate\tNotes\n251-A\tFlu\t01/16/2026\tGiven')
            : (effectiveSelected
              ? 'Medication\tStartDate\tIndication\tNotes\nCeftriaxone\t01/16/2026\tPNA\tStart per MD'
              : 'Room-Bed or MRN\tMedication\tStartDate\tIndication\tNotes\n251-A\tCeftriaxone\t01/16/2026\tPNA\tStart')
        } />

        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div className="muted mini">
            Parsed rows: <b>{parsed.rows.length}</b> · Parse errors: <b>{parsed.errors.length}</b>
          </div>
          <div className="row" style={{ gap: 8 }}>
            <button className="btn" type="button" onClick={() => { setRaw(''); setResult(null); }}>
              Clear
            </button>
            <button className="btn primary" type="button" disabled={parsed.rows.length === 0} onClick={doImport}>
              Import
            </button>
          </div>
        </div>

        {(parsed.errors.length > 0 || result?.errors?.length) && (
          <div className="card" style={{ boxShadow: 'none' }}>
            <div style={{ fontWeight: 900 }}>Issues</div>
            <ul style={{ margin: '6px 0 0 18px', padding: 0 }}>
              {[...parsed.errors, ...(result?.errors || [])].slice(0, 12).map((e, i) => (
                <li key={i} className="mini">{e}</li>
              ))}
            </ul>
          </div>
        )}

        {result && (
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <span className="badge green">Added: {result.added}</span>
            <span className="badge amber">Skipped: {result.skipped}</span>
          </div>
        )}
      </div>
    </Modal>
  );
}
