/* ============================================================
   Broadreach Platform — Single-site detail view, real data only.
   ============================================================ */

const { useState: _useState } = React;

function SiteHeader({ site, onBack }) {
  const st = STATUS_STATES[site.status] || STATUS_STATES.unknown;
  return (
    <div style={{ marginBottom: 'var(--gap)' }}>
      {onBack && <button onClick={onBack} className="mono" style={{ background: 'none', border: 'none', color: 'var(--br-dk)', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, padding: 0 }}>← Portfolio</button>}
      <div className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap', borderTop: `3px solid ${st.dot}` }}>
        <StatusGlyph status={site.status} size={44} />
        <div style={{ flex: 1, minWidth: 200 }}>
          <h1 className="display" style={{ fontSize: '1.8rem', color: 'var(--br-dker)', lineHeight: 1 }}>{site.name}</h1>
          <div className="mono" style={{ fontSize: '0.66rem', color: 'var(--ink-light)', marginTop: 5, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {site.id}{site.location ? ` · ${site.location}` : ''}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 22, alignItems: 'center' }}>
          {site.capacityKw != null && (
            <div style={{ textAlign: 'right' }}>
              <div className="eyebrow">Capacity</div>
              <div className="display" style={{ fontSize: '1.45rem' }}>{site.capacityKw >= 1000 ? (site.capacityKw / 1000).toFixed(2) + ' MWp' : site.capacityKw.toFixed(1) + ' kWp'}</div>
            </div>
          )}
          {site.powerKw != null && (
            <div style={{ textAlign: 'right', borderLeft: '1px solid var(--line)', paddingLeft: 22 }}>
              <div className="eyebrow">Now</div>
              <div className="display" style={{ fontSize: '1.45rem', color: site.status === 'none' ? 'var(--rd)' : 'var(--grn-ink)' }}>{site.powerKw.toFixed(1)}<span className="mono" style={{ fontSize: '0.7rem', color: 'var(--ink-light)' }}> kW</span></div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function useSiteKpis(site) {
  const ammp = useAmmp();
  const [state, setState] = _useState({ status: 'loading', todayKwh: null, pr: null, availability: null });
  React.useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, status: 'loading' }));
    (async () => {
      const now = new Date();
      const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const [energyResp, prResp, lossResp] = await Promise.all([
        fetchHistoricEnergy(ammp.token, site.id, { dateFrom: startToday.toISOString(), dateTo: now.toISOString(), interval: '1d' }).catch(() => null),
        fetchPvPerformanceKpis(ammp.token, site.id, { dateFrom: startToday.toISOString(), dateTo: now.toISOString(), interval: '1d' }).catch(() => null),
        fetchPvYieldLosses(ammp.token, site.id, { dateFrom: startToday.toISOString(), dateTo: now.toISOString(), interval: '1d' }).catch(() => null),
      ]);
      if (cancelled) return;
      const energySeries = extractAssetSeries(energyResp);
      const energyPick = energySeries.find((s) => /energy|yield|production/i.test(s.key)) || energySeries[0] || null;
      const todayKwh = energyPick ? energyPick.points.reduce((a, p) => a + (Number(p.value) || 0), 0) : null;

      const prSeries = extractAssetSeries(prResp);
      const prPick = prSeries.find((s) => /(^|_)pr(_|$)/i.test(s.key));
      const pr = prPick && prPick.points.length ? Number(prPick.points[prPick.points.length - 1].value) : null;

      const lossSeries = extractAssetSeries(lossResp);
      const availPick = lossSeries.find((s) => /availab|uptime/i.test(s.key));
      const availability = availPick && availPick.points.length ? Number(availPick.points[availPick.points.length - 1].value) : null;

      setState({ status: 'ready', todayKwh, pr, availability });
    })();
    return () => { cancelled = true; };
  }, [site.id, ammp.token]);
  return state;
}

function useEnergyFlow(site, range) {
  const ammp = useAmmp();
  const [state, setState] = _useState({ status: 'loading' });
  React.useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });
    (async () => {
      try {
        const now = new Date();
        const from = range === 'today' ? new Date(now.getFullYear(), now.getMonth(), now.getDate())
          : range === 'week' ? new Date(now.getTime() - 7 * 86400000)
          : new Date(now.getTime() - 30 * 86400000);
        const interval = range === 'today' ? '15m' : '1h';
        const powerResp = await fetchChunked(fetchHistoricPower, ammp.token, site.id, from.toISOString(), now.toISOString(), interval, 7);
        const prodSeriesAll = extractAssetSeries(powerResp);
        const prodSeries = prodSeriesAll.find((s) => /power|production/i.test(s.key)) || prodSeriesAll[0] || null;
        if (!prodSeries || !prodSeries.points.length) { if (!cancelled) setState({ status: 'empty' }); return; }

        const meters = await ammp.devicesFor(site.id, DEVICE_TYPE.METER);
        let consSeries = null, expSeries = null;
        if (meters.length) {
          const meterResp = await fetchChunked(fetchDeviceHistoricMeter, ammp.token, meters[0].device_id, from.toISOString(), now.toISOString(), '15m', 7);
          const meterSeries = extractDeviceSeries(meterResp);
          consSeries = meterSeries.find((s) => /import|consum|load/i.test(s.key)) || null;
          expSeries = meterSeries.find((s) => /export|feed/i.test(s.key)) || null;
        }

        const fmt = range === 'today' ? { hour: '2-digit', minute: '2-digit' } : { day: '2-digit', month: 'short' };
        const pts = prodSeries.points.map((p, i) => {
          const point = { t: i, label: new Date(p.date).toLocaleString('en-GB', fmt), prod: Number(p.value) || 0 };
          if (consSeries) point.cons = Number((consSeries.points[i] || {}).value) || 0;
          if (expSeries) point.exp = Number((expSeries.points[i] || {}).value) || 0;
          return point;
        });
        if (!cancelled) setState({ status: 'ready', pts, hasCons: !!consSeries, hasExp: !!expSeries });
      } catch (e) {
        if (!cancelled) setState({ status: 'error', error: e.message });
      }
    })();
    return () => { cancelled = true; };
  }, [site.id, ammp.token, range]);
  return state;
}

function EnergyFlow({ site }) {
  const [range, setRange] = _useState('today');
  const { status, pts, hasCons, hasExp, error } = useEnergyFlow(site, range);
  const keys = [{ k: 'prod', label: 'Production', c: 'var(--amb)' }];
  if (hasCons) keys.push({ k: 'cons', label: 'Consumption', c: 'var(--br)', fill: false });
  if (hasExp) keys.push({ k: 'exp', label: 'Grid export', c: 'var(--grn)', fill: false, w: 2 });

  return (
    <div className="card" style={{ padding: 16, marginBottom: 'var(--gap)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div>
          <h3 style={{ fontSize: '0.92rem', fontWeight: 700, margin: 0 }}>Energy Flow</h3>
          <div className="mono" style={{ fontSize: '0.62rem', color: 'var(--ink-light)', marginTop: 2 }}>{hasCons || hasExp ? 'Production vs consumption vs grid export' : 'Production only — no meter device found for this site'}</div>
        </div>
        <div style={{ display: 'flex', gap: 4, background: 'var(--grey-xlt)', border: '1px solid var(--grey-lt)', borderRadius: 8, padding: 3 }}>
          {[['today', 'Today'], ['week', 'Week'], ['month', 'Month']].map(([v, l]) => (
            <button key={v} onClick={() => setRange(v)} className="seg-btn" data-on={range === v}>{l}</button>
          ))}
        </div>
      </div>
      {status === 'loading' && <Loading />}
      {status === 'error' && <ErrorNote message={error} />}
      {status === 'empty' && <EmptyState title="No power data for this range." />}
      {status === 'ready' && (
        <>
          <FlowChart data={{ pts, unit: 'kW' }} keys={keys} height={300} />
          <div style={{ display: 'flex', gap: 18, marginTop: 8 }}>
            {keys.map((k) => (
              <span key={k.k} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.68rem', color: 'var(--ink-mid)' }}>
                <span style={{ width: 9, height: 9, borderRadius: 2, background: k.c }}></span>{k.label}
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function useSiteTickets(site) {
  const ammp = useAmmp();
  const [state, setState] = _useState({ status: 'loading', tickets: [] });
  React.useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading', tickets: [] });
    postTicketsList(ammp.token, {}).then((resp) => {
      if (cancelled) return;
      let list = Array.isArray(resp) ? resp : (resp && (resp.tickets || resp.data || resp.results || resp.items));
      list = Array.isArray(list) ? list : [];
      setState({ status: 'ready', tickets: list.filter((t) => ticketField(t, 'asset_id', 'site_id') === site.id) });
    }).catch((e) => { if (!cancelled) setState({ status: 'error', error: e.message, tickets: [] }); });
    return () => { cancelled = true; };
  }, [site.id, ammp.token]);
  return state;
}

function SiteOM({ site, onAct }) {
  const { status, tickets, error } = useSiteTickets(site);
  if (status === 'loading') return <Loading />;
  if (status === 'error') return <div className="card" style={{ padding: 16 }}><ErrorNote message={error} /></div>;
  if (!tickets.length) return null;

  const withDue = tickets.map((t) => {
    const dueRaw = ticketField(t, 'due_date', 'scheduled_date', 'date', 'created_at');
    const dueDate = dueRaw ? new Date(dueRaw) : null;
    const valid = dueDate && !isNaN(dueDate.getTime());
    return { t, dueDate: valid ? dueDate : null, daysAway: valid ? Math.round((dueDate.getTime() - Date.now()) / 86400000) : null };
  }).sort((a, b) => {
    if (a.daysAway == null) return 1;
    if (b.daysAway == null) return -1;
    return a.daysAway - b.daysAway;
  });
  const next = withDue[0];
  const title = ticketField(next.t, 'title', 'summary', 'description', 'name') || 'Ticket';
  const f = next.daysAway != null ? flagClass(next.daysAway) : { bg: 'var(--grey-xlt)', fg: 'var(--ink-mid)', dot: 'var(--grey-lt)' };

  return (
    <div className="card" style={{ padding: 16 }}>
      <h3 style={{ fontSize: '0.92rem', fontWeight: 700, margin: '0 0 12px' }}>Next Maintenance</h3>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 11px', borderRadius: 8, background: f.bg, color: f.fg, fontFamily: 'var(--font-mono)', fontSize: '0.72rem', marginBottom: 12 }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: f.dot, flexShrink: 0 }}></span>
        {title}{next.dueDate ? ` — ${next.dueDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}` : ''}{next.daysAway != null ? ` (${next.daysAway} days)` : ''}
      </div>
      {tickets.length > 1 && <div className="mono" style={{ fontSize: '0.62rem', color: 'var(--ink-light)' }}>{tickets.length - 1} more ticket{tickets.length - 1 === 1 ? '' : 's'} open for this site</div>}
    </div>
  );
}

function SiteView({ siteId, onBack }) {
  const ammp = useAmmp();
  const site = React.useMemo(() => ammp.sites.find((s) => s.id === siteId), [ammp.sites, siteId]);
  const kpis = useSiteKpis(site);

  if (!site) return <EmptyState title="Site not found." />;

  return (
    <div>
      <SiteHeader site={site} onBack={onBack} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--gap)', marginBottom: 'var(--gap)' }}>
        <KpiCard label="Today's production" loading={kpis.status === 'loading'} value={kpis.todayKwh != null ? Math.round(kpis.todayKwh).toLocaleString() : null} unit="kWh" accent="var(--amb)" />
        <KpiCard label="Performance ratio" loading={kpis.status === 'loading'} value={kpis.pr != null ? kpis.pr.toFixed(2) : null} sub="PR" accent="var(--br)" />
        <KpiCard label="Availability" loading={kpis.status === 'loading'} value={kpis.availability != null ? kpis.availability.toFixed(1) : null} unit="%" accent={kpis.availability != null && kpis.availability < 90 ? 'var(--rd)' : 'var(--grn)'} />
      </div>

      <EnergyFlow site={site} />

      <div style={{ display: 'grid', gridTemplateColumns: '1.55fr 1fr', gap: 'var(--gap)', alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap)' }}>
          <PanelArray site={site} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--gap)' }}>
            <RevenuePanel site={site} />
            <EnviroPanel site={site} />
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap)' }}>
          <BatteryPanel site={site} />
          <AlertsPanel site={site} />
          <SiteOM site={site} />
        </div>
      </div>

      <SiteDataSheet site={site} />
    </div>
  );
}

/* ---------------- full data sheet — only rows that were actually found ---------------- */
function DataRow({ k, v, accent }) {
  if (v == null || v === '') return null;
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, padding: '7px 0', borderBottom: '1px solid var(--line)' }}>
      <span style={{ fontSize: '0.72rem', color: 'var(--ink-light)' }}>{k}</span>
      <span className="mono" style={{ fontSize: '0.74rem', fontWeight: 600, color: accent || 'var(--ink)', textAlign: 'right' }}>{v}</span>
    </div>
  );
}
function DataGroup({ title, children }) {
  const hasContent = React.Children.toArray(children).some(Boolean);
  if (!hasContent) return null;
  return (
    <div style={{ breakInside: 'avoid' }}>
      <div className="eyebrow" style={{ color: 'var(--br-dk)', borderBottom: '2px solid var(--br-xlt)', paddingBottom: 5, marginBottom: 4 }}>{title}</div>
      {children}
    </div>
  );
}
function SiteDataSheet({ site }) {
  const st = STATUS_STATES[site.status] || STATUS_STATES.unknown;
  const coordStr = site.coords ? `${site.coords.lat.toFixed(3)}, ${site.coords.lng.toFixed(3)}` : null;
  return (
    <div className="card" style={{ padding: 18, marginTop: 'var(--gap)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14, borderBottom: '1px solid var(--grey-lt)', paddingBottom: 8 }}>
        <h3 className="display" style={{ fontSize: '1.15rem', color: 'var(--br-dker)', letterSpacing: '0.8px', margin: 0 }}>Full data sheet</h3>
        <span className="mono" style={{ fontSize: '0.6rem', color: 'var(--ink-light)' }}>{site.id}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(248px, 1fr))', gap: '6px 32px' }}>
        <DataGroup title="Identification">
          <DataRow k="Site ID" v={site.id} />
          <DataRow k="Site name" v={site.name} />
        </DataGroup>
        <DataGroup title="Location">
          <DataRow k="Location" v={site.location} />
          <DataRow k="Coordinates" v={coordStr} />
        </DataGroup>
        <DataGroup title="System">
          <DataRow k="PV capacity" v={site.capacityKw != null ? `${site.capacityKw.toFixed(1)} kWp` : null} />
        </DataGroup>
        <DataGroup title="Live performance">
          <DataRow k="Status" v={st.label} accent={st.dot} />
          <DataRow k="Current output" v={site.powerKw != null ? `${site.powerKw.toFixed(1)} kW` : null} />
          <DataRow k="Last data received" v={site.lastDataAt ? new Date(site.lastDataAt).toLocaleString() : null} />
        </DataGroup>
      </div>
    </div>
  );
}

/* ---------------- Site Deep Dive page ---------------- */
function DeepDiveView() {
  const ammp = useAmmp();
  const [sel, setSel] = _useState('');
  const ordered = React.useMemo(() => ammp.sites.slice().sort((a, b) => a.name.localeCompare(b.name)), [ammp.sites]);

  if (!ammp.live) return <ConnectGate note="Sign in with your AMMP x-api-key to load Site Deep Dive." />;

  const site = sel ? ammp.sites.find((s) => s.id === sel) : null;
  const idx = site ? ordered.findIndex((s) => s.id === sel) : -1;
  const step = (d) => { const n = (idx + d + ordered.length) % ordered.length; setSel(ordered[n].id); window.scrollTo(0, 0); };

  return (
    <div>
      <div className="card" style={{ padding: '14px 18px', marginBottom: 'var(--gap)', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', position: 'sticky', top: 0, zIndex: 8 }}>
        <span className="eyebrow" style={{ flexShrink: 0 }}>Deep dive — select site</span>
        <select className="fld" value={sel} onChange={(e) => { setSel(e.target.value); window.scrollTo(0, 0); }} style={{ flex: '1 1 280px', maxWidth: 380, height: 38, fontSize: '0.82rem', fontWeight: 700 }}>
          <option value="">Choose a site…</option>
          {ordered.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
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
          <SiteView siteId={sel} />
          <div style={{ marginTop: 'calc(var(--gap) + 6px)', marginBottom: 10 }}>
            <h2 className="display" style={{ fontSize: '1.28rem', color: 'var(--br-dk)', letterSpacing: '1px', borderBottom: '1px solid var(--grey-lt)', paddingBottom: 8 }}>Per-inverter analysis</h2>
          </div>
          <InverterSection site={site} />
        </div>
      ) : (
        <div className="card" style={{ padding: '72px 32px', textAlign: 'center' }}>
          <div style={{ fontSize: 38, marginBottom: 10, color: 'var(--br)', lineHeight: 1 }}>⌕</div>
          <div className="display" style={{ fontSize: '1.5rem', color: 'var(--br-dk)', marginBottom: 6 }}>Select a site to begin</div>
          <div className="mono" style={{ fontSize: '0.72rem', color: 'var(--ink-light)', maxWidth: 420, margin: '0 auto' }}>Choose any of the {ammp.sites.length} connected sites from the dropdown above for a full deep dive.</div>
        </div>
      )}
    </div>
  );
}

Object.assign(window, { SiteView, DeepDiveView, SiteHeader });
