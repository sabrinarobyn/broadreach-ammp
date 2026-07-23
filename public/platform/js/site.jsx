/* ============================================================
   Broadreach Platform — Single-site detail view
   ============================================================ */

const { useState: _useState } = React;

function SiteHeader({ site, live, onBack }) {
  const st = BR_DATA.STATES[site.status] || BR_DATA.STATES.unknown;
  return (
    <div style={{ marginBottom: 'var(--gap)' }}>
      {onBack && <button onClick={onBack} className="mono" style={{ background: 'none', border: 'none', color: 'var(--br-dk)', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, padding: 0 }}>← Portfolio</button>}
      <div className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap', borderTop: `3px solid ${live ? st.dot : 'var(--br)'}` }}>
        <StatusGlyph status={site.status} live={live} size={44} />
        <div style={{ flex: 1, minWidth: 200 }}>
          <h1 className="display" style={{ fontSize: '1.8rem', color: 'var(--br-dker)', lineHeight: 1 }}>{site.name}</h1>
          <div className="mono" style={{ fontSize: '0.66rem', color: 'var(--ink-light)', marginTop: 5, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <ContractTag c={site.contract} /> {site.id} · {site.town}, {site.province} · {site.epc} · comm. {site.commissioned.getFullYear()}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 22, alignItems: 'center' }}>
          <div style={{ textAlign: 'right' }}>
            <div className="eyebrow">Capacity</div>
            <div className="display" style={{ fontSize: '1.45rem' }}>{BR_DATA.fmtKwp(site.kwp)}</div>
          </div>
          <div style={{ textAlign: 'right', borderLeft: '1px solid var(--line)', paddingLeft: 22 }}>
            <div className="eyebrow">{live ? 'Producing now' : 'Status'}</div>
            {live ? (
              <div className="display" style={{ fontSize: '1.45rem', color: site.status === 'none' ? 'var(--rd)' : 'var(--grn-ink)' }}>{site.liveKw}<span className="mono" style={{ fontSize: '0.7rem', color: 'var(--ink-light)' }}> kW</span></div>
            ) : (
              <div className="display" style={{ fontSize: '1.2rem', color: 'var(--ink-light)' }}>offline</div>
            )}
          </div>
          {live && <span className="pill" style={{ background: 'var(--grn-lt)', borderColor: 'transparent', color: 'var(--grn-ink)' }}><span className="live-dot"></span> LIVE</span>}
        </div>
      </div>
    </div>
  );
}

function EnergyFlow({ seed }) {
  const [range, setRange] = _useState('today');
  const data = React.useMemo(() => BR_DATA.series(seed, range), [seed, range]);
  const keys = [
    { k: 'prod', label: 'Production', c: 'var(--amb)' },
    { k: 'cons', label: 'Consumption', c: 'var(--br)', fill: false },
    { k: 'exp', label: 'Grid export', c: 'var(--grn)', fill: false, w: 2 },
  ];
  return (
    <div className="card" style={{ padding: 16, marginBottom: 'var(--gap)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div>
          <h3 style={{ fontSize: '0.92rem', fontWeight: 700, margin: 0 }}>Energy Flow</h3>
          <div className="mono" style={{ fontSize: '0.62rem', color: 'var(--ink-light)', marginTop: 2 }}>Production vs consumption vs grid export · estimated</div>
        </div>
        <div style={{ display: 'flex', gap: 4, background: 'var(--grey-xlt)', border: '1px solid var(--grey-lt)', borderRadius: 8, padding: 3 }}>
          {[['today', 'Today'], ['week', 'Week'], ['year', 'Year']].map(([v, l]) => (
            <button key={v} onClick={() => setRange(v)} className="seg-btn" data-on={range === v}>{l}</button>
          ))}
        </div>
      </div>
      <FlowChart data={data} keys={keys} height={300} />
      <div style={{ display: 'flex', gap: 18, marginTop: 8 }}>
        {keys.map(k => (
          <span key={k.k} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.68rem', color: 'var(--ink-mid)' }}>
            <span style={{ width: 9, height: 9, borderRadius: 2, background: k.c }}></span>{k.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function SiteOM({ site, onAct }) {
  const f = flagClass(site.om.daysAway);
  return (
    <div className="card" style={{ padding: 16 }}>
      <h3 style={{ fontSize: '0.92rem', fontWeight: 700, margin: '0 0 12px' }}>Next Maintenance</h3>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 11px', borderRadius: 8, background: f.bg, color: f.fg, fontFamily: 'var(--font-mono)', fontSize: '0.72rem', marginBottom: 12 }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: f.dot, flexShrink: 0 }}></span> {site.om.task} — {BR_DATA.monthLabel(site.om.date)} ({site.om.daysAway} days)
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
        {[['Modules', site.modules.toLocaleString()], ['Inverters', site.inverters], ['String zones', site.strings], ['Availability', site.availability.toFixed(1) + '%']].map(([l, v]) => (
          <div key={l}><div className="eyebrow" style={{ fontSize: '0.52rem' }}>{l}</div><div className="display" style={{ fontSize: '1.15rem' }}>{v}</div></div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn btn-sm" style={{ flex: 1, justifyContent: 'center' }} onClick={() => onAct('Site visit scheduled for ' + site.name)}>Schedule visit</button>
        <button className="btn btn-ghost btn-sm" style={{ flex: 1, justifyContent: 'center' }} onClick={() => onAct('Report queued for ' + site.name)}>Export report</button>
      </div>
    </div>
  );
}

function SiteView({ siteId, live, onBack }) {
  const site = React.useMemo(() => BR_DATA.sites.find(s => s.id === siteId), [siteId]);
  const bat = React.useMemo(() => BR_DATA.batteryFor(site.seed), [site]);
  const [toast, setToast] = _useState(null);
  const act = (m) => { setToast(m); setTimeout(() => setToast(null), 2200); };

  const todayKwh = site.todayKwh;
  const monthRev = Math.round(site.kwp * 130 * (0.45 * 0.92 + 0.55 * 2.4));

  return (
    <div>
      <SiteHeader site={site} live={live} onBack={onBack} />

      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${bat ? 5 : 4}, 1fr)`, gap: 'var(--gap)', marginBottom: 'var(--gap)' }}>
        <KpiCard label="Today's production" value={live ? todayKwh.toLocaleString() : '—'} unit="kWh" sub={live ? `peak ${site.liveKw} kW` : 'offline'} accent="var(--amb)" delta={live ? { up: true, v: '12%' } : null} />
        <KpiCard label="Performance ratio" value={live ? site.pr.toFixed(2) : '—'} sub="PR · vs 0.82 target" accent="var(--br)" delta={live && site.pr ? { up: site.pr >= 0.82, v: site.pr >= 0.82 ? '+2%' : '-3%' } : null} />
        <KpiCard label="Availability" value={live ? site.availability.toFixed(1) : '—'} unit="%" sub="trailing 30 days" accent={live && site.availability < 90 ? 'var(--rd)' : 'var(--grn)'} />
        <KpiCard label="Month revenue" value={live ? 'R' + monthRev.toLocaleString() : '—'} sub="export + savings" accent="var(--grn)" delta={live ? { up: true, v: '8%' } : null} />
        {bat && <KpiCard label="Battery SOC" value={live ? bat.soc : '—'} unit="%" sub={live ? (bat.charging ? 'charging' : 'discharging') : 'idle'} accent="var(--vio)" />}
      </div>

      <EnergyFlow seed={site.seed} />

      <div style={{ display: 'grid', gridTemplateColumns: '1.55fr 1fr', gap: 'var(--gap)', alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap)' }}>
          <PanelArray seed={site.seed} kwp={site.kwp} live={live} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--gap)' }}>
            <RevenuePanel site={site} live={live} />
            <EnviroPanel site={site} live={live} />
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap)' }}>
          {bat && <BatteryPanel bat={bat} live={live} />}
          <AlertsPanel seed={site.seed} live={live} />
          <SiteOM site={site} onAct={act} />
        </div>
      </div>

      {toast && (
        <div style={{ position: 'fixed', bottom: 22, left: '50%', transform: 'translateX(-50%)', background: 'var(--br-dker)', color: '#fff', padding: '10px 18px', borderRadius: 9, fontSize: '0.78rem', boxShadow: 'var(--shadow-lg)', zIndex: 200, animation: 'brFadeUp .25s ease' }}>{toast}</div>
      )}
    </div>
  );
}

/* ---------------- full data sheet (all fields) ---------------- */
function DataRow({ k, v, accent }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, padding: '7px 0', borderBottom: '1px solid var(--line)' }}>
      <span style={{ fontSize: '0.72rem', color: 'var(--ink-light)' }}>{k}</span>
      <span className="mono" style={{ fontSize: '0.74rem', fontWeight: 600, color: accent || 'var(--ink)', textAlign: 'right' }}>{v}</span>
    </div>
  );
}
function DataGroup({ title, children }) {
  return (
    <div style={{ breakInside: 'avoid' }}>
      <div className="eyebrow" style={{ color: 'var(--br-dk)', borderBottom: '2px solid var(--br-xlt)', paddingBottom: 5, marginBottom: 4 }}>{title}</div>
      {children}
    </div>
  );
}
function SiteDataSheet({ site, bat, live }) {
  const p = BR_DATA.PROV[site.province];
  const lat = Math.abs(p.lat + (site.map.y - 0.5) * 1.1).toFixed(3);
  const lng = (p.lng + (site.map.x - 0.5) * 1.1).toFixed(3);
  const st = BR_DATA.STATES[site.status] || BR_DATA.STATES.unknown;
  const dash = (v) => live ? v : '—';
  const contractName = { PPA: 'Power purchase agreement', M: 'Maintenance contract', P: 'Performance contract' }[site.contract];
  return (
    <div className="card" style={{ padding: 18, marginTop: 'var(--gap)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14, borderBottom: '1px solid var(--grey-lt)', paddingBottom: 8 }}>
        <h3 className="display" style={{ fontSize: '1.15rem', color: 'var(--br-dker)', letterSpacing: '0.8px', margin: 0 }}>Full data sheet</h3>
        <span className="mono" style={{ fontSize: '0.6rem', color: 'var(--ink-light)' }}>{site.id} · all recorded fields</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(248px, 1fr))', gap: '6px 32px' }}>
        <DataGroup title="Identification">
          <DataRow k="Site ID" v={site.id} />
          <DataRow k="Site name" v={site.name} />
          <DataRow k="Contract type" v={contractName} />
          <DataRow k="EPC contractor" v={site.epc} />
          <DataRow k="Commissioned" v={site.commissioned.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} />
        </DataGroup>
        <DataGroup title="Location">
          <DataRow k="Town" v={site.town} />
          <DataRow k="Province" v={site.province} />
          <DataRow k="Approx. coordinates" v={`${lat}°S, ${lng}°E`} />
          <DataRow k="Grid region" v={site.province === 'Western Cape' ? 'Cape' : site.province === 'KwaZulu-Natal' ? 'Coastal' : 'Inland'} />
        </DataGroup>
        <DataGroup title="System">
          <DataRow k="PV capacity" v={BR_DATA.fmtKwp(site.kwp)} />
          <DataRow k="PV modules" v={site.modules.toLocaleString()} />
          <DataRow k="Inverters" v={site.inverters} />
          <DataRow k="String zones" v={site.strings} />
          <DataRow k="Battery storage" v={bat ? `${bat.capKwh} kWh` : 'None'} />
        </DataGroup>
        <DataGroup title="Live performance">
          <DataRow k="Status" v={dash(st.label)} accent={live ? st.dot : null} />
          <DataRow k="Current output" v={dash(site.liveKw + ' kW')} />
          <DataRow k="Today's yield" v={dash(site.todayKwh.toLocaleString() + ' kWh')} />
          <DataRow k="Performance ratio" v={dash(site.pr ? site.pr.toFixed(2) : '0.00')} />
          <DataRow k="Availability" v={dash(site.availability.toFixed(1) + '%')} accent={live && site.availability < 90 ? 'var(--rd)' : null} />
          <DataRow k="Active alerts" v={dash(site.alerts)} accent={live && site.alerts > 0 ? 'var(--amb-dk)' : null} />
        </DataGroup>
        <DataGroup title="O&amp;M schedule">
          <DataRow k="Next task" v={site.om.task} />
          <DataRow k="Scheduled" v={BR_DATA.monthLabel(site.om.date)} />
          <DataRow k="Days away" v={`${site.om.daysAway} days`} accent={urgencyColor(site.om.daysAway)} />
          <DataRow k="O&M window" v={site.om.daysAway <= 30 ? 'Urgent (<30d)' : site.om.daysAway <= 60 ? '30–60 days' : site.om.daysAway <= 90 ? '60–90 days' : 'Beyond 90 days'} />
        </DataGroup>
      </div>
    </div>
  );
}

/* ---------------- Site Deep Dive page ---------------- */
function DeepDiveView({ live }) {
  const [sel, setSel] = _useState('');
  const byProv = React.useMemo(() => {
    const m = {};
    BR_DATA.sites.slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .forEach(s => { (m[s.province] = m[s.province] || []).push(s); });
    return m;
  }, []);
  // single ordered list matching the dropdown: provinces A→Z, sites A→Z within each
  const ordered = React.useMemo(() => Object.keys(byProv).sort().flatMap(p => byProv[p]), [byProv]);
  const site = sel ? BR_DATA.sites.find(s => s.id === sel) : null;
  const bat = site ? BR_DATA.batteryFor(site.seed) : null;
  const idx = site ? ordered.findIndex(s => s.id === sel) : -1;
  const step = (d) => { const n = (idx + d + ordered.length) % ordered.length; setSel(ordered[n].id); window.scrollTo(0, 0); };

  return (
    <div>
      <div className="card" style={{ padding: '14px 18px', marginBottom: 'var(--gap)', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', position: 'sticky', top: 0, zIndex: 8 }}>
        <span className="eyebrow" style={{ flexShrink: 0 }}>Deep dive — select site</span>
        <select className="fld" value={sel} onChange={e => { setSel(e.target.value); window.scrollTo(0, 0); }} style={{ flex: '1 1 280px', maxWidth: 380, height: 38, fontSize: '0.82rem', fontWeight: 700 }}>
          <option value="">Choose a site…</option>
          {Object.keys(byProv).sort().map(prov => (
            <optgroup key={prov} label={prov}>
              {byProv[prov].map(s => <option key={s.id} value={s.id}>{s.name} · {s.kwp.toFixed(0)} kWp</option>)}
            </optgroup>
          ))}
        </select>
        {site && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
            <span className="mono" style={{ fontSize: '0.62rem', color: 'var(--ink-light)' }}>{idx + 1} of {ordered.length}</span>
            <button className="btn btn-ghost btn-sm" onClick={() => step(-1)} title="Previous site">‹</button>
            <button className="btn btn-ghost btn-sm" onClick={() => step(1)} title="Next site">›</button>
          </div>
        )}
      </div>
      {site ? (
        <div>
          <SiteView siteId={sel} live={live} />
          <div style={{ marginTop: 'calc(var(--gap) + 6px)', marginBottom: 10 }}>
            <h2 className="display" style={{ fontSize: '1.28rem', color: 'var(--br-dk)', letterSpacing: '1px', borderBottom: '1px solid var(--grey-lt)', paddingBottom: 8 }}>Per-inverter analysis</h2>
          </div>
          <InverterSection site={site} live={live} />
          <SiteDataSheet site={site} bat={bat} live={live} />
        </div>
      ) : (
        <div className="card" style={{ padding: '72px 32px', textAlign: 'center' }}>
          <div style={{ fontSize: 38, marginBottom: 10, color: 'var(--br)', lineHeight: 1 }}>⌕</div>
          <div className="display" style={{ fontSize: '1.5rem', color: 'var(--br-dk)', marginBottom: 6 }}>Select a site to begin</div>
          <div className="mono" style={{ fontSize: '0.72rem', color: 'var(--ink-light)', maxWidth: 420, margin: '0 auto' }}>Choose any of the {BR_DATA.totals.count} portfolio sites from the dropdown above for a full deep dive — live performance, panel array, battery, alerts and the complete data sheet.</div>
        </div>
      )}
    </div>
  );
}

Object.assign(window, { SiteView, DeepDiveView });
