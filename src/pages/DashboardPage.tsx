import React from 'react';
import { useIcnStore } from '../store/icnStore';

export function DashboardPage() {
  const { data } = useIcnStore();
  const census = data.census.activeResidentIds.length;
  const cap = Number(data.config.totalCapacity || 0);
  const occ = cap > 0 ? Math.round((census / cap) * 100) : 0;
  const activeAbx = data.antibiotics.filter((a) => a.status === 'Active').length;
  const activeCases = data.infectionCases.filter((c) => !c.resolvedDateISO).length;
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const vaxThisWeek = data.vaccinations.filter((v) => {
    const d = new Date(v.dateISO);
    return !Number.isNaN(d.getTime()) && d >= weekAgo;
  });
  const vaxGivenWeek = vaxThisWeek.filter((v) => v.status === 'Given').length;
  const vaxRefusedWeek = vaxThisWeek.filter((v) => v.status === 'Refused').length;
  const vaxOtherWeek = vaxThisWeek.length - vaxGivenWeek - vaxRefusedWeek;
  return (
    <>
      <section id="tab-dashboard" className="tab">
        <div className="card noprint" id="dashControls" data-dashblock="controls">
          <div className="dashControlsTop">
            <div>
              <h2 style={{ margin: 0 }}>Dashboard</h2>
              <div className="favHint">Pinned favorites + view controls (React baseline).</div>
            </div>
            <div className="row" style={{ gap: 8 }}>
              <button className="btn" type="button">Dashboard Settings</button>
              <button className="btn" type="button">Manage Favorites</button>
            </div>
          </div>
          <div className="sep" />
          <div className="favbar">(Favorites bar will be migrated here)</div>
        </div>

        <div className="dashGrid">
          <div className="dashLeft">
            <div className="card" id="dashFacilityCard" data-dashblock="facility">
              <h2>Facility Snapshot</h2>
              <div className="kpi">
                <div>
                  <div className="lbl">Current Census / Capacity</div>
                  <div className="big">{census} / {cap || '—'}</div>
                </div>
                <div style={{ minWidth: 220 }}>
                  <div className="lbl">Occupancy</div>
                  <div className="progress"><div style={{ width: `${Math.min(100, Math.max(0, occ))}%` }} /></div>
                  <div className="mini muted" style={{ marginTop: 6 }}>{cap > 0 ? `${occ}%` : '—'}</div>
                </div>
              </div>

              <div className="sep" />
              <h3>Quick Drilldowns</h3>
              <div className="muted mini">Buttons will navigate to modules once routing is wired.</div>
              <div className="sep" />

              <div className="grid cols3">
                <div className="card" style={{ boxShadow: 'none' }}>
                  <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div className="mini muted">ABT</div>
                      <div style={{ fontWeight: 900, fontSize: 16, marginTop: 2 }}>Active antibiotics</div>
                    </div>
                    <span className="badge blue">Active: {activeAbx}</span>
                  </div>
                  <div className="sep" />
                  <div className="muted mini">Use the top navigation → More → Antibiotics (ABT).</div>
                </div>

                <div className="card" style={{ boxShadow: 'none' }}>
                  <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div className="mini muted">IP</div>
                      <div style={{ fontWeight: 900, fontSize: 16, marginTop: 2 }}>Active precautions</div>
                    </div>
                    <span className="badge red">Active: {activeCases}</span>
                  </div>
                  <div className="sep" />
                  <div className="muted mini">Use the top navigation → Cases.</div>
                </div>

                <div className="card" style={{ boxShadow: 'none' }}>
                  <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div className="mini muted">Vaccinations</div>
                      <div style={{ fontWeight: 900, fontSize: 16, marginTop: 2 }}>This week overview</div>
                    </div>
                    <span className="badge green">Week: {vaxThisWeek.length}</span>
                  </div>
                  <div className="sep" />
                  <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                    <span className="badge">Given: {vaxGivenWeek}</span>
                    <span className="badge">Refused: {vaxRefusedWeek}</span>
                    <span className="badge">Other: {vaxOtherWeek}</span>
                    <span className="badge">Total: {data.vaccinations.length}</span>
                  </div>
                  <div className="muted mini" style={{ marginTop: 8 }}>Use the top navigation → More → Vaccinations.</div>
                </div>
              </div>
            </div>
          </div>

          <div className="dashRight">
            <div className="card" id="dashResidentCard" data-dashblock="resident">
              <h2>Resident Snapshot</h2>
              <div className="muted mini">Resident selector + profile snapshot will be migrated next.</div>
              <div className="sep" />
              <div className="muted">Select a resident to view snapshot.</div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
