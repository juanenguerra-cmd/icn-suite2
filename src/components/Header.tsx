import React, { useEffect, useMemo, useRef, useState } from 'react';

export type Role = 'Admin' | 'Staff' | 'Surveyor';
export type TabId =
  | 'dashboard'
  | 'ip'
  | 'audits'
  | 'reports'
  | 'packet'
  | 'actions'
  | 'census'
  | 'abt'
  | 'vax'
  | 'surveillance'
  | 'floormap'
  | 'comms'
  | 'decisions'
  | 'staff'
  | 'env'
  | 'warehouse'
  | 'config';

export const primaryTabs: Array<{ id: TabId; label: string }> = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'ip', label: 'Cases' },
  { id: 'audits', label: 'Audits' },
  { id: 'reports', label: 'Reports' },
  { id: 'packet', label: 'Survey Packet' },
  { id: 'actions', label: 'QAPI Actions' }
];

export const moreTabs: Array<{ id: TabId; label: string; adminOnly?: boolean }> = [
  { id: 'census', label: 'Census' },
  { id: 'abt', label: 'Antibiotics (ABT)' },
  { id: 'vax', label: 'Vaccinations' },
  { id: 'surveillance', label: 'Surveillance' },
  { id: 'floormap', label: 'Floor Map' },
  { id: 'comms', label: 'Communications' },
  { id: 'decisions', label: 'Decision Log' },
  { id: 'staff', label: 'Staffing' },
  { id: 'env', label: 'Environment' },
  { id: 'warehouse', label: 'Data', adminOnly: true },
  { id: 'config', label: 'Config' }
];

type Props = {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  role: Role;
  onRoleChange: (role: Role) => void;
  includeDischarged: boolean;
  onIncludeDischargedChange: (v: boolean) => void;
  onBackupExport: () => void;
  onBackupImport: () => void;
  onLegacyImport: () => void;
  onReset: () => void;
  onAbout: () => void;
  censusCount: number;
  totalCapacity: number;
};

export function Header(props: Props) {
  const {
    activeTab,
    onTabChange,
    role,
    onRoleChange,
    includeDischarged,
    onIncludeDischargedChange,
    onBackupExport,
    onBackupImport,
    onLegacyImport,
    onReset,
    onAbout,
    censusCount,
    totalCapacity
  } = props;

  const [moreOpen, setMoreOpen] = useState(false);
  const [moreSearch, setMoreSearch] = useState('');
  const moreWrapRef = useRef<HTMLDivElement | null>(null);

  // Close More on outside click / ESC.
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!moreWrapRef.current) return;
      if (!moreWrapRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMoreOpen(false);
    };
    document.addEventListener('click', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('click', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  const filteredMore = useMemo(() => {
    const q = moreSearch.trim().toLowerCase();
    const list = moreTabs.filter((t) => (t.adminOnly ? role === 'Admin' : true));
    if (!q) return list;
    return list.filter((t) => t.label.toLowerCase().includes(q) || t.id.toLowerCase().includes(q));
  }, [moreSearch, role]);

  return (
    <header>
      <div className="wrap">
        <div className="topbar">
          <div className="titlebox">
            <p className="app-title" id="appTitle">Infection Control Nurse Compliance Suite</p>
            <p className="app-sub" id="appSub">React + TypeScript baseline (migrating from legacy)</p>
          </div>

          <div className="nav" id="topNav">
            <div className="nav-left">
              {primaryTabs.map((t) => (
                <button
                  key={t.id}
                  className={"tabbtn" + (activeTab === t.id ? ' active' : '')}
                  type="button"
                  onClick={() => onTabChange(t.id)}
                >
                  {t.label}
                </button>
              ))}

              <div className="morewrap" ref={moreWrapRef}>
                <button
                  className={"tabbtn" + (moreOpen ? ' active' : '')}
                  id="btnMore"
                  type="button"
                  aria-haspopup="true"
                  aria-expanded={moreOpen}
                  onClick={() => setMoreOpen((v) => !v)}
                >
                  More ▾
                </button>

                <div className={"moremenu" + (moreOpen ? ' open' : '')} id="moreMenu" role="menu" aria-label="More">
                  <div className="moresearch">
                    <input
                      id="moreSearch"
                      type="search"
                      placeholder="Search modules…"
                      autoComplete="off"
                      value={moreSearch}
                      onChange={(e) => setMoreSearch(e.target.value)}
                    />
                  </div>
                  <div className="menudiv" />

                  {filteredMore.map((t) => (
                    <button
                      key={t.id}
                      className={"menubtn" + (activeTab === t.id ? ' active' : '')}
                      role="menuitem"
                      type="button"
                      onClick={() => {
                        onTabChange(t.id);
                        setMoreOpen(false);
                      }}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="topActions">
            <span className="badge" id="roleBadge">Role: {role}</span>
            <select
              id="viewAsRole"
              className="smallsel"
              value={role}
              onChange={(e) => onRoleChange(e.target.value as Role)}
              aria-label="View as role"
            >
              <option value="Admin">Admin</option>
              <option value="Staff">Staff</option>
              <option value="Surveyor">Surveyor</option>
            </select>
            <button className="smallbtn" id="btnAbout" type="button" onClick={onAbout}>
              About
            </button>
          </div>
        </div>

        <div className="ribbon">
          <div className="chipbar">
            <div className="chip">
              <span>Building Census</span> <span className="n">{censusCount}</span>
            </div>
            <div className="chip">
              <span>Capacity</span> <span className="n">{totalCapacity || '—'}</span>
            </div>
            <div className="chip" id="occChip">
              <span>Occupancy</span>{' '}
              <span className="n">
                {totalCapacity > 0 ? `${Math.round((censusCount / totalCapacity) * 100)}%` : '—'}
              </span>
            </div>
            <label className="chip" style={{ gap: 8, cursor: 'pointer' }}>
              <input
                id="toggleIncludeDischarged"
                type="checkbox"
                checked={includeDischarged}
                onChange={(e) => onIncludeDischargedChange(e.target.checked)}
                style={{ transform: 'scale(1.1)' }}
              />
              <span>Include Discharged</span>
            </label>
          </div>

          <div className="righttools">
            <button className="btn" id="btnBackup" type="button" onClick={onBackupExport}>
              Export Backup
            </button>
            <button className="btn" id="btnRestore" type="button" onClick={onBackupImport}>
              Import Backup
            </button>
            <button className="btn" id="btnLegacy" type="button" onClick={onLegacyImport}>
              Import Legacy JSON (Map)
            </button>
            <button className="btn danger" id="btnReset" type="button" onClick={onReset}>
              Reset Local Data
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
