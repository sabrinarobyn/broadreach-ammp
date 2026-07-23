/* ============================================================
   Broadreach Platform — Portfolio Overview (KPIs, filters, layouts)
   ============================================================ */

const { useState: _useState } = React;

/* Full-page "sign in with your AMMP key" prompt. Reused by every view that
   needs a live connection (Portfolio, Site Deep Dive, O&M Schedule) — there
   is no more offline/demo mode to fall back to. */
function ConnectGate({ note }) {
  const ammp = useAmmp();
  const [key, setKey] = _useState('');
  const go = async () => { if (!key.trim()) return; await ammp.connect(key.trim()); };
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 420 }}>
      <div className="card" style={{ padding: '28px 32px', maxWidth: 420, width: '100%', borderTop: '3px solid var(--amb)' }}>
        <div style={{ fontWeight: 700, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--amb)' }}></span> Connect to AMMP
        </div>
        <div className="mono" style={{ fontSize: '0.7rem', color: 'var(--ink-light)', marginBottom: 16, lineHeight: 1.5 }}>
          {note || 'Sign in with your AMMP x-api-key to load this view.'}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input value={key} onChange={(e) => setKey(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && go()}
                 type="password" placeholder="x-api-key" autoComplete="off" className="fld" />
          <button className="btn" onClick={go} disabled={ammp.connecting || !key.trim()} style={{ justifyContent: 'center' }}>
            {ammp.connecting ? <span className="spin">◠</span> : '→ Authenticate'}
          </button>
        </div>
        {ammp.error && <div className="mono" style={{ fontSize: '0.68rem', color: 'var(--rd)', marginTop: 12 }}>✗ {ammp.error}</div>}
      </div>
    </div>
  );
}

function PortfolioView({ onOpen, layout, setLayout }) {
  const ammp = useAmmp();
  const [q, setQ] = _useState('');
  const [status, setStatus] = _useState('all');
  const [sort, setSort] = _useState({ k: 'name', dir: 1 });
  const [group, setGroup] = _useState('status');

  const sites = ammp.sites;
  const hasCoords = React.useMemo(() => sites.some((s) => s.coords), [sites]);
  React.useEffect(() => { if (layout === 'map' && !hasCoords) setLayout('grid'); }, [hasCoords, layout, setLayout]);

  const filtered = React.useMemo(() => {
    let r = sites.filter((s) =>
      (q === '' || s.name.toLowerCase().includes(q.toLowerCase()) || s.id.toLowerCase().includes(q.toLowerCase())) &&
      (status === 'all' || s.status === status));
    if (layout === 'table') {
      r = r.slice().sort((a, b) => {
        const av = a[sort.k], bv = b[sort.k];
        if (av == null && bv == null) return 0;
        if (av == null) return 1;
        if (bv == null) return -1;
        if (typeof av === 'string') return av.localeCompare(bv) * sort.dir;
        return (av - bv) * sort.dir;
      });
    }
    return r;
  }, [sites, q, status, layout, sort]);

  if (!ammp.live) return <ConnectGate note="Sign in with your AMMP x-api-key to load the portfolio." />;

  const anyCapacity = sites.some((s) => s.capacityKw != null);
  const totalCapacity = sites.reduce((a, s) => a + (s.capacityKw || 0), 0);
  const producingCount = sites.filter((s) => s.status === 'producing').length;
  const alertCount = sites.filter((s) => s.status === 'alert').length;
  const loading = ammp.portfolioLoading;

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--gap)', marginBottom: 'var(--gap)' }}>
        <KpiCard label="Total sites" value={sites.length} sub="in portfolio" accent="var(--br)" />
        <KpiCard label="Installed PV" loading={loading} value={anyCapacity ? (totalCapacity / 1000).toFixed(2) : null} unit="MWp" sub={anyCapacity ? `${Math.round(totalCapacity).toLocaleString()} kWp` : null} accent="var(--grn)" />
        <KpiCard label="Producing now" loading={loading} value={producingCount} sub="sites with live output" accent="var(--grn)" />
        <KpiCard label="Active alerts" loading={loading} value={alertCount} sub="sites flagged" accent="var(--rd)" />
      </div>

      <div style={{ marginBottom: 'var(--gap)' }}><Legend /></div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 'var(--gap)' }}>
        <div style={{ position: 'relative', flex: '1 1 220px', maxWidth: 320 }}>
          <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-light)', fontSize: 13 }}>⌕</span>
          <input className="fld" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search site or ID…" style={{ width: '100%', paddingLeft: 28 }} />
        </div>
        <select className="fld" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="all">All statuses</option>
          {Object.values(STATUS_STATES).map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
        {(q || status !== 'all') && <button className="btn btn-ghost btn-sm" onClick={() => { setQ(''); setStatus('all'); }}>Clear</button>}
        <span className="mono" style={{ fontSize: '0.66rem', color: 'var(--ink-light)' }}>{filtered.length} of {sites.length} sites</span>
        {layout === 'grid' && (
          <div style={{ display: 'flex', gap: 4, background: '#fff', border: '1px solid var(--grey-lt)', borderRadius: 8, padding: 3 }}>
            <span className="eyebrow" style={{ alignSelf: 'center', padding: '0 4px 0 6px' }}>Group</span>
            {[['none', 'None'], ['status', 'Status']].map(([v, l]) => (
              <button key={v} onClick={() => setGroup(v)} className="seg-btn" data-on={group === v}>{l}</button>
            ))}
          </div>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 4, background: '#fff', border: '1px solid var(--grey-lt)', borderRadius: 8, padding: 3 }}>
          {[['grid', '▦ Grid'], ['table', '☰ Table'], ...(hasCoords ? [['map', '◈ Map']] : [])].map(([v, l]) => (
            <button key={v} onClick={() => setLayout(v)} className="seg-btn" data-on={layout === v}>{l}</button>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: 28 }}>
        {filtered.length === 0
          ? <EmptyState title="No sites match your filters." />
          : layout === 'grid' ? <SiteGrid sites={filtered} onOpen={onOpen} group={group} />
          : layout === 'table' ? <SiteTable sites={filtered} onOpen={onOpen} sort={sort} setSort={setSort} />
          : <SiteMap sites={filtered} onOpen={onOpen} />}
      </div>
    </div>
  );
}

Object.assign(window, { PortfolioView, ConnectGate });
