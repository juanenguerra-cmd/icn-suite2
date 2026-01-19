import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Header, type Role, type TabId } from './components/Header';
import { useIcnStore } from './store/icnStore';
import { DashboardPage } from './pages/DashboardPage';
import { CensusPage } from './pages/CensusPage';
import { VaccinationPage } from './pages/VaccinationPage';
import { AbtPage } from './pages/AbtPage';
import { ConfigPage } from './pages/ConfigPage';
import { DataPage } from './pages/DataPage';
import { ReportsPage } from './pages/ReportsPage';
import { InfectionPage } from './pages/InfectionPage';
import { parseLegacyJson } from './utils/legacyImport';

function downloadJson(filename: string, obj: any) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function App() {
  const { data, dispatch, resetAll } = useIcnStore();
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');
  const [role, setRole] = useState<Role>('Admin');
  const [includeDischarged, setIncludeDischarged] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const legacyInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    document.body.dataset.role = role;
  }, [role]);

  const censusCount = data.census.activeResidentIds.length;
  const totalCapacity = Number(data.config.totalCapacity || 0);

  const tabContent = useMemo(() => {
    switch (activeTab) {
      case 'dashboard':
        return <DashboardPage />;
      case 'census':
        return <CensusPage includeDischarged={includeDischarged} />;
      case 'vax':
        return <VaccinationPage includeDischarged={includeDischarged} />;
      case 'abt':
        return <AbtPage includeDischarged={includeDischarged} />;
      case 'config':
        return <ConfigPage />;
      case 'warehouse':
        return <DataPage />;
      case 'reports':
        return <ReportsPage />;
      case 'ip':
        return <InfectionPage includeDischarged={includeDischarged} />;
      default:
        // Keep the UI responsive even for tabs that are placeholders for future phases
        return (
          <section className="tab">
            <div className="card">
              <h2>{activeTab}</h2>
              <div className="muted mini">This module is queued for a later phase.</div>
            </div>
          </section>
        );
    }
  }, [activeTab, includeDischarged]);

  function onBackupExport() {
    const d = new Date();
    const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    downloadJson(`icn-suite-backup-${stamp}.json`, data);
  }

  function onBackupImport() {
    if (!fileInputRef.current) return;
    fileInputRef.current.value = '';
    fileInputRef.current.click();
  }

  function onLegacyImport() {
    if (!legacyInputRef.current) return;
    legacyInputRef.current.value = '';
    legacyInputRef.current.click();
  }

  return (
    <>
      <Header
        activeTab={activeTab}
        onTabChange={setActiveTab}
        role={role}
        onRoleChange={setRole}
        includeDischarged={includeDischarged}
        onIncludeDischargedChange={setIncludeDischarged}
        onBackupExport={onBackupExport}
        onBackupImport={onBackupImport}
        onLegacyImport={onLegacyImport}
        onReset={resetAll}
        onAbout={() => alert('ICN Suite — React baseline. Bulk import + Dashboard Notes enabled.')}
        censusCount={censusCount}
        totalCapacity={totalCapacity}
      />

      <main className="content">{tabContent}</main>

      <input
        ref={fileInputRef}
        type="file"
        accept="application/json"
        style={{ display: 'none' }}
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          const text = await f.text();
          try {
            const obj = JSON.parse(text);
            dispatch({ type: 'LOAD_DATA', data: obj } as any);
            alert('Backup imported.');
          } catch {
            alert('Invalid JSON file.');
          }
        }}
      />

      <input
        ref={legacyInputRef}
        type="file"
        accept="application/json"
        style={{ display: 'none' }}
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          const text = await f.text();
          try {
            const obj = JSON.parse(text);
            const parsed = parseLegacyJson(obj);
            // Merge into current data
            dispatch(
              {
                type: 'MERGE_DATA',
                patch: {
                  residentsById: Object.fromEntries(parsed.residents.map((r) => [r.id, r])) as any,
                  vaccinations: parsed.vaccinations as any,
                  antibiotics: parsed.antibiotics as any,
                  infectionCases: parsed.infectionCases as any
                }
              } as any
            );
            alert(`Legacy import completed (${parsed.kind}).`);
          } catch {
            alert('Invalid legacy JSON.');
          }
        }}
      />
    </>
  );
}
