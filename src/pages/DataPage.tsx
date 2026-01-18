import React, { useMemo, useState } from 'react';
import { useIcnStore } from '../store/icnStore';
import { downloadText, toCsv } from '../utils/csv';
import { parseLegacyJson } from '../utils/legacyImport';
import { nowISO } from '../utils/time';
import type { AppData, Resident } from '../types/core';

type Props = {
  onGoTo: (tab: any) => void;
};

function residentsForExport(residentsById: Record<string, Resident>, activeIds: string[]): Resident[] {
  return activeIds.map((id) => residentsById[id]).filter(Boolean) as Resident[];
}

export function DataPage({ onGoTo }: Props) {
  const { data, dispatch } = useIcnStore();
  const [importInfo, setImportInfo] = useState<{ name: string; result: ReturnType<typeof parseLegacyJson> } | null>(null);
  const [importErr, setImportErr] = useState<string>('');

  const activeResidents = useMemo(() => residentsForExport(data.residentsById, data.census.activeResidentIds), [data.residentsById, data.census.activeResidentIds]);

  function exportAllBackup() {
    const payload = { exportedAt: nowISO(), data };
    downloadText('ICN_Suite_Backup.json', JSON.stringify(payload, null, 2), 'application/json');
  }

  function exportCensusCsv() {
    const rows = activeResidents.map((r) => ({
      name: r.name,
      mrn: r.mrn || '',
      unit: (r.unit || r.lockedUnit || '') as string,
      room: (r.room || r.lockedRoom || '') as string,
      status: r.status || ''
    }));
    downloadText('Census_Active.csv', toCsv(rows, ['name', 'mrn', 'unit', 'room', 'status']), 'text/csv');
  }

  function onPickLegacyFile() {
    setImportErr('');
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const obj = JSON.parse(String(reader.result || ''));
          const result = parseLegacyJson(obj);
          setImportInfo({ name: file.name, result });
        } catch (e: any) {
          setImportErr('Could not read this JSON file.');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }

  function applyLegacyImport() {
    if (!importInfo) return;
    const res = importInfo.result;
    const residentsById = Object.fromEntries(res.residents.map((r) => [r.id, r]));
    const patch: Partial<AppData> = {
      residentsById,
      vaccinations: res.vaccinations,
      antibiotics: res.antibiotics,
      infectionCases: res.infectionCases
    };
    dispatch({ type: 'MERGE_DATA', patch } as any);
    alert(`Imported legacy data: ${res.residents.length} residents, ${res.vaccinations.length} vax, ${res.antibiotics.length} abt, ${res.infectionCases.length} cases.`);
    setImportInfo(null);
    // Take user to the most relevant module after import
    if (res.kind === 'vaccination') onGoTo('vax');
    if (res.kind === 'abt') onGoTo('abt');
    if (res.kind === 'ip') onGoTo('ip');
  }

  return (
    <div className="grid cols2" style={{ minWidth: 980 }}>
      <div className="card">
        <h2>Data Tools</h2>
        <div className="muted mini">Backups and exports. Keep your source-of-truth in your Cloudflare Pages repo, but your day-to-day data lives in this browser (LocalStorage).</div>

        <div className="sep" />
        <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
          <button className="btn" type="button" onClick={exportAllBackup}>Export Full Backup (JSON)</button>
          <button className="btn" type="button" onClick={exportCensusCsv}>Export Active Census (CSV)</button>
        </div>

        <div className="sep" />
        <h3 style={{ marginTop: 0 }}>Legacy JSON Import (Mapping)</h3>
        <div className="muted mini">Upload an old tracker JSON (ABT / Vaccination / IP). We auto-detect and map into the new React store. If detection is wrong, re-export your legacy JSON and try again.</div>
        <div className="sep" />
        <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
          <button className="btn" type="button" onClick={onPickLegacyFile}>Choose Legacy JSON File</button>
          {importInfo && (
            <button className="btn" type="button" onClick={applyLegacyImport}>Apply Import</button>
          )}
        </div>
        {importErr && <div className="mini" style={{ color: 'var(--danger, #ff4a68)', marginTop: 10 }}>{importErr}</div>}

        {importInfo && (
          <div style={{ marginTop: 12 }}>
            <div className="badge">File: {importInfo.name}</div>
            <div className="grid cols3" style={{ marginTop: 12 }}>
              <div className="kpi"><div><div className="lbl">Detected</div><div className="big">{importInfo.result.kind.toUpperCase()}</div></div></div>
              <div className="kpi"><div><div className="lbl">Residents</div><div className="big">{importInfo.result.residents.length}</div></div></div>
              <div className="kpi"><div><div className="lbl">Records</div><div className="big">{importInfo.result.vaccinations.length + importInfo.result.antibiotics.length + importInfo.result.infectionCases.length}</div></div></div>
            </div>
            {importInfo.result.warnings.length > 0 && (
              <div className="mini muted" style={{ marginTop: 10, whiteSpace: 'pre-wrap' }}>
                {importInfo.result.warnings.slice(0, 8).map((w, i) => `• ${w}`).join('\n')}
                {importInfo.result.warnings.length > 8 ? `\n… +${importInfo.result.warnings.length - 8} more` : ''}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="card">
        <h2>What gets deployed vs what stays local</h2>
        <div className="muted mini">
          <div style={{ marginBottom: 8 }}><b>Cloudflare Pages deploys your code</b> (React app). Your <b>data</b> (census entries, vax logs, ABT, cases) is stored in <b>this browser</b>.</div>
          <div style={{ marginBottom: 8 }}>To move data to another computer, use <b>Export Full Backup</b> then <b>Import Backup</b> from the header ribbon.</div>
          <div>Legacy import is for pulling old JSON trackers into the new store so reporting can happen in one place.</div>
        </div>

        <div className="sep" />
        <h3 style={{ marginTop: 0 }}>Next steps (in migration)</h3>
        <ol className="mini muted">
          <li>Finish Report Center parity (ABT SOC + Monthly QAPI, Vaccination Due lists, IP line list export).</li>
          <li>Migrate Survey Packet Generator outputs as print templates.</li>
          <li>Migrate Audit Library + collapsible topic cards (fixing the search refresh bug permanently).</li>
        </ol>
      </div>
    </div>
  );
}
