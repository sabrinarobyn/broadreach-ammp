/* ============================================================
   Broadreach Platform — Portfolio Overview (KPIs, filters, layouts)
   ============================================================ */

const { useState: _useState } = React;

function AmmpBanner() {
  const ammp = useAmmp();
  const [key, setKey] = _useState('');
  const go = async () => {
    if (!key.trim()) return;
    await ammp.connect(key.trim());
  };
  return (
    <div className="card" style={{ padding: '14px 18px', borderLeft: '3px solid var(--amb)', background: 'linear-gradient(90deg,#FFFDF9,#fff)', marginBottom: 'var(--gap)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 240 }}>
          <div style={{ fontWeight: 700, fontSize: '0.84rem', display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--amb)' }}></span> AMMP not connected
          </div>
          <div className="mono" style={{ fontSize: '0.66rem', color: 'var(--ink-light)', marginTop: 3 }}>Sign in with your AMMP <code>x-api-key</code> to match live assets across the portfolio.</div>
          {ammp.error && <div className="mono" style={{ fontSize: '0.66rem', color: 'var(--rd)', marginTop: 4 }}>✗ {ammp.error}</div>}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <input value={key} onChange={e => setKey(e.target.value)} onKeyDown={e => e.key === 'Enter' && go()} type="password" placeholder="x-api-key" autoComplete="off" className="fld" style={{ width: 220 }} />
          <button className="btn" onClick={go} disabled={ammp.connecting || !key.trim()} style={{ minWidth: 124, justifyContent: 'center' }}>
            {ammp.connecting ? <span className="spin">◠</span> : '→ Authenticate'}
          </button>
        </div>
      </div>
    </div>
  );
}

function PortfolioView({ live, onOpen, layout, setLayout }) {
  const ammp = useAmmp();
  const [q, setQ] = _useState('');
  const [prov, setProv] = _useState('all');
  const [contract, setContract] = _useState('all');
  const [status, setStatus] = _useState('all');
  const [sort, setSort] = _useState({ k: 'omDays', dir: 1 });
  const [group, setGroup] = _useState('status');

  const provinces = React.useMemo(() => ['all', ...Array.from(new Set(BR_DATA.sites.map(s => s.province))).sort()], []);

  const filtered = React.useMemo(() => {
    let r = BR_DATA.sites.filter(s =>
      (q === '' || s.name.toLowerCase().includes(q.toLowerCase()) || s.town.toLowerCase().includes(q.toLowerCase()) || s.id.toLowerCase().includes(q.toLowerCase())) &&
      (prov === 'all' || s.province === prov) &&
      (contract === 'all' || s.contract === contract) &&
      (status === 'all' || !live || s.status === status)
    );
    if (layout === 'table') {
      r = r.slice().sort((a, b) => {
        let av = sort.k === 'omDays' ? a.om.daysAway : a[sort.k];
        let bv = sort.k === 'omDays' ? b.om.daysAway : b[sort.k];
        if (typeof av === 'string') return av.localeCompare(bv) * sort.dir;
        return (av - bv) * sort.dir;
      });
    } else {
      r = r.slice().sort((a, b) => a.om.daysAway - b.om.daysAway);
    }
    return r;
  }, [q, prov, contract, status, live, layout, sort]);

  const t = BR_DATA.totals;

  return (
    <div>
      {/* KPI strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 'var(--gap)', marginBottom: 'var(--gap)' }}>
        <KpiCard label="Total sites" value={t.count} sub="in portfolio" accent="var(--br)" />
        <KpiCard label="Installed PV" value={(t.kwp / 1000).toFixed(2)} unit="MWp" sub={`${t.kwp.toLocaleString()} kWp`} accent="var(--grn)" />
        <KpiCard label="Maintenance due" value={t.dueIn90} sub="sites · next 90 days" accent="var(--amb)" />
        <KpiCard label="Urgent (<30 days)" value={t.urgent} sub="need attention" accent="var(--rd)" />
        <KpiCard label="AMMP connected" value={live ? ammp.matchedCount : '—'} unit={live ? `/ ${t.count}` : ''} sub={live ? 'sites matched to AMMP' : 'authenticate to check'} accent={live ? 'var(--grn)' : 'var(--br)'} />
      </div>

      {!live && <AmmpBanner />}

      {/* toolbar */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 'var(--gap)' }}>
        <div style={{ position: 'relative', flex: '1 1 220px', maxWidth: 320 }}>
          <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-light)', fontSize: 13 }}>⌕</span>
          <input className="fld" value={q} onChange={e => setQ(e.target.value)} placeholder="Search site, town or ID…" style={{ width: '100%', paddingLeft: 28 }} />
        </div>
        <select className="fld" value={prov} onChange={e => setProv(e.target.value)}>
          {provinces.map(p => <option key={p} value={p}>{p === 'all' ? 'All provinces' : p}</option>)}
        </select>
        <select className="fld" value={contract} onChange={e => setContract(e.target.value)}>
          <option value="all">All contracts</option><option value="PPA">PPA</option><option value="M">Maintenance</option><option value="P">Performance</option>
        </select>
        <select className="fld" value={status} onChange={e => setStatus(e.target.value)} disabled={!live} title={live ? '' : 'Connect AMMP to filter by live status'}>
          <option value="all">All statuses</option>
          {Object.values(BR_DATA.STATES).map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
        {(q || prov !== 'all' || contract !== 'all' || status !== 'all') &&
          <button className="btn btn-ghost btn-sm" onClick={() => { setQ(''); setProv('all'); setContract('all'); setStatus('all'); }}>Clear</button>}
        <span className="mono" style={{ fontSize: '0.66rem', color: 'var(--ink-light)' }}>{filtered.length} of {t.count} sites</span>
        {layout === 'grid' && (
          <div style={{ display: 'flex', gap: 4, background: '#fff', border: '1px solid var(--grey-lt)', borderRadius: 8, padding: 3 }}>
            <span className="eyebrow" style={{ alignSelf: 'center', padding: '0 4px 0 6px' }}>Group</span>
            {[['none', 'None'], ['status', 'Status']].map(([v, l]) => (
              <button key={v} onClick={() => setGroup(v)} className="seg-btn" data-on={group === v}>{l}</button>
            ))}
          </div>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 4, background: '#fff', border: '1px solid var(--grey-lt)', borderRadius: 8, padding: 3 }}>
          {[['grid', '▦ Grid'], ['table', '☰ Table'], ['map', '◈ Map']].map(([v, l]) => (
            <button key={v} onClick={() => setLayout(v)} className="seg-btn" data-on={layout === v}>{l}</button>
          ))}
        </div>
      </div>

      {/* layout */}
      <div style={{ marginBottom: 28 }}>
        {filtered.length === 0
          ? <div className="card" style={{ padding: 48, textAlign: 'center', color: 'var(--ink-light)' }}>No sites match your filters.</div>
          : layout === 'grid' ? <SiteGrid sites={filtered} live={live} onOpen={onOpen} group={group} />
          : layout === 'table' ? <SiteTable sites={filtered} live={live} onOpen={onOpen} sort={sort} setSort={setSort} />
          : <SiteMap sites={filtered} live={live} onOpen={onOpen} />}
      </div>
    </div>
  );
}

Object.assign(window, { PortfolioView });
