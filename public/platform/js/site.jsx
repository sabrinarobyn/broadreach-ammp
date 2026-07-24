/* ============================================================
   Broadreach Platform — Single-site detail view, real data only.
   ============================================================ */

const { useState: _useState } = React;

const SITE_STATUS_PILL_LABEL = { producing: 'Online', none: 'Offline', alert: 'Alert', unknown: 'Unknown' };

function SiteHeader({ site, onBack }) {
  const st = STATUS_STATES[site.status] || STATUS_STATES.unknown;
  const pillLabel = SITE_STATUS_PILL_LABEL[site.status] || 'Unknown';
  return (
    <div style={{ marginBottom: 'var(--gap)' }}>
      {onBack && <button onClick={onBack} className="mono" style={{ background: 'none', border: 'none', color: 'var(--br-dk)', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, padding: 0 }}>← Portfolio</button>}
      <div className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap', borderTop: `3px solid ${st.dot}` }}>
        <StatusGlyph status={site.status} size={44} />
        <div style={{ flex: 1, minWidth: 200 }}>
          <h1 className="display" style={{ fontSize: '1.8rem', color: 'var(--br-dker)', lineHeight: 1 }}>{site.name}</h1>
          {site.location && <div className="mono" style={{ fontSize: '0.66rem', color: 'var(--ink-light)', marginTop: 5 }}>{site.location}</div>}
        </div>
        <div style={{ display: 'flex', gap: 22, alignItems: 'center' }}>
          {site.capacityKw != null && (
            <div style={{ textAlign: 'right' }}>
              <div className="eyebrow">Capacity</div>
              <div className="display" style={{ fontSize: '1.45rem' }}>{site.capacityKw >= 1000 ? (site.capacityKw / 1000).toFixed(2) + ' MWp' : site.capacityKw.toFixed(1) + ' kWp'}</div>
            </div>
          )}
          <span className="pill" style={{ background: st.bg, borderColor: 'transparent', color: st.dot, fontWeight: 700 }}>● {pillLabel}</span>
        </div>
      </div>
    </div>
  );
}

/* Unlike KpiCard, this never hides on null — Fix 4 wants "—" shown and the card
   flagged red specifically when data is missing or output is zero. */
function MaxPvKwpCard({ pvRatioPct }) {
  const flagged = pvRatioPct == null || pvRatioPct === 0;
  const display = pvRatioPct != null ? `${Math.round(pvRatioPct)}%` : '—';
  return (
    <div className="card" style={{ padding: 'var(--card-pad)', borderTop: `3px solid ${flagged ? 'var(--rd)' : 'var(--grn)'}` }}>
      <div className="eyebrow" style={{ marginBottom: 6 }}>Max PV / kWp</div>
      <span className="display" style={{ fontSize: '1.95rem', color: flagged ? 'var(--rd)' : 'var(--ink)' }}>{display}</span>
    </div>
  );
}

/* Latest non-null value for a key, scanning from the end — PR is a daily
   metric that settles a day late, so the most-recent day in the window is
   often still null; walk backwards to the last day that actually has a value. */
function latestNonNullValue(series, keyPattern) {
  const pick = series.find((s) => keyPattern.test(s.key));
  if (!pick) return null;
  for (let i = pick.points.length - 1; i >= 0; i--) {
    const v = pick.points[i].value;
    if (v != null) return Number(v);
  }
  return null;
}

function useSiteKpis(site) {
  const ammp = useAmmp();
  const [state, setState] = _useState({ status: 'loading', todayKwh: null, pr: null, availability: null });
  React.useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, status: 'loading' }));
    (async () => {
      const today = utcDateOnly(new Date());
      // PR settles a day late (see latestNonNullValue), so look back a few days
      // rather than asking only for "today", which is almost always still null.
      const prFrom = utcDateOnly(Date.now() - 3 * 86400000);
      const [energyResp, lossResp, kpiPrResp, perfPrResp] = await Promise.all([
        fetchHistoricEnergy(ammp.token, site.id, { dateFrom: today, dateTo: today, interval: '1d' }).catch(() => null),
        fetchPvYieldLosses(ammp.token, site.id, { dateFrom: today, dateTo: today, interval: '1d' }).catch(() => null),
        fetchHistoricKpiData(ammp.token, site.id, { dateFrom: prFrom, dateTo: today, interval: '1d' }).catch(() => null),
        fetchPvPerformanceKpis(ammp.token, site.id, { dateFrom: prFrom, dateTo: today, interval: '1d' }).catch(() => null),
      ]);
      if (cancelled) return;
      const energySeries = extractAssetSeries(energyResp);
      const energyPick = energySeries.find((s) => /^pv_energy$/i.test(s.key)) || energySeries.find((s) => /energy|yield|production/i.test(s.key)) || energySeries[0] || null;
      const todayKwh = energyPick
        ? scaleByDeclaredUnit(energyPick.points.reduce((a, p) => a + (Number(p.value) || 0), 0), energyPick.unit)
        : null;

      // Prefer historic-kpi-data's performance_ratio, then its weather-corrected
      // variant, then technical-kpis/pv-performance's performance_ratio. Both
      // report a 0-1 fraction, converted to a percentage for display.
      const kpiSeries = extractAssetSeries(kpiPrResp);
      const perfSeries = extractAssetSeries(perfPrResp);
      const prFraction = latestNonNullValue(kpiSeries, /^performance_ratio$/i)
        ?? latestNonNullValue(kpiSeries, /^performance_ratio_weather_corrected$/i)
        ?? latestNonNullValue(perfSeries, /^performance_ratio$/i);
      const pr = prFraction != null ? prFraction * 100 : null;

      const lossSeries = extractAssetSeries(lossResp);
      const availPick = lossSeries.find((s) => /availab|uptime/i.test(s.key));
      const availability = availPick && availPick.points.length ? Number(availPick.points[availPick.points.length - 1].value) : null;

      setState({ status: 'ready', todayKwh, pr, availability });
    })();
    return () => { cancelled = true; };
  }, [site.id, ammp.token]);
  return state;
}

function SiteOM({ site }) {
  const om = useOm();
  const rows = React.useMemo(() => om.rows.filter((r) => r.asset_id === site.id), [om.rows, site.id]);
  if (om.loading) return <Loading />;
  if (!rows.length) return null;

  const withUrgency = rows.map((r) => ({ row: r, urgency: omUrgency(r) }))
    .sort((a, b) => (a.urgency.daysAway ?? Infinity) - (b.urgency.daysAway ?? Infinity));
  const next = withUrgency.find((x) => !x.row.completed) || withUrgency[0];
  const c = OM_URGENCY_COLORS[next.urgency.level] || OM_URGENCY_COLORS.none;
  const open = rows.filter((r) => !r.completed).length;

  return (
    <div className="card" style={{ padding: 16 }}>
      <h3 style={{ fontSize: '0.92rem', fontWeight: 700, margin: '0 0 12px' }}>Next Maintenance</h3>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 11px', borderRadius: 8, background: c.bg, color: c.fg, fontFamily: 'var(--font-mono)', fontSize: '0.72rem', marginBottom: 12 }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: c.dot, flexShrink: 0 }}></span>
        {next.row.task_type || 'Task'}{next.row.scheduled_date ? ` — ${new Date(next.row.scheduled_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}` : ''}{next.urgency.daysAway != null ? ` (${next.urgency.daysAway}d)` : ''}
      </div>
      {open > 1 && <div className="mono" style={{ fontSize: '0.62rem', color: 'var(--ink-light)' }}>{open - 1} more open task{open - 1 === 1 ? '' : 's'} for this site</div>}
    </div>
  );
}

function SiteView({ siteId, onBack }) {
  const ammp = useAmmp();
  const site = React.useMemo(() => ammp.sites.find((s) => s.id === siteId), [ammp.sites, siteId]);
  const kpis = useSiteKpis(site);
  const statusInfo = useStatusInfoToday(site);
  const [from, setFrom] = _useState(() => pmIsoDate(new Date(Date.now() - 6 * 86400000)));
  const [to, setTo] = _useState(() => pmIsoDate(new Date()));
  const powerMix = usePowerMix(site, from, to);

  if (!site) return <EmptyState title="Site not found." />;

  // Only today's alerts drive an 'alert' override here — once there's no alert
  // today, fall through to the same production-based status Portfolio uses
  // (not a hardcoded 'producing'), so a genuinely offline site still reads as
  // offline rather than being misrepresented.
  const displayStatus = statusInfo.status === 'ready' && !statusInfo.hasAlertsToday
    ? deriveStatus({ powerKw: site.powerKw, pvRatioPct: site.pvRatioPct, hasAlerts: false, stale: site.stale, daylight: isSastDaylight() })
    : site.status;
  const headerSite = displayStatus === site.status ? site : { ...site, status: displayStatus };

  return (
    <div>
      <SiteHeader site={headerSite} onBack={onBack} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 'var(--gap)', marginBottom: 'var(--gap)', alignItems: 'start' }}>
        <KpiCard label="Today's production" loading={kpis.status === 'loading'} value={kpis.todayKwh != null ? Math.round(kpis.todayKwh).toLocaleString() : null} unit="kWh" accent="var(--amb)" />
        <KpiCard label="Performance ratio" loading={kpis.status === 'loading'} value={kpis.pr != null ? kpis.pr.toFixed(1) : null} unit="%" sub="PR" accent="var(--br)" />
        <KpiCard label="Availability" loading={kpis.status === 'loading'} value={kpis.availability != null ? kpis.availability.toFixed(1) : null} unit="%" accent={kpis.availability != null && kpis.availability < 90 ? 'var(--rd)' : 'var(--grn)'} />
        <MaxPvKwpCard pvRatioPct={site.pvRatioPct} />
        <AlertsPanel statusInfo={statusInfo} />
      </div>

      <PowerMixSection site={site} from={from} to={to} setFrom={setFrom} setTo={setTo} powerMix={powerMix} />
      <DailyPrSection site={site} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--gap)' }}>
        <RevenuePanel site={site} />
        <EnviroPanel site={site} />
        <SiteOM site={site} />
      </div>
    </div>
  );
}

/* ---------------- Site Deep Dive page ---------------- */
function siteOptgroups(ordered) {
  const groups = [];
  let cur = null;
  for (const s of ordered) {
    const letter = (s.name[0] || '#').toUpperCase();
    if (!cur || cur.letter !== letter) { cur = { letter, items: [] }; groups.push(cur); }
    cur.items.push(s);
  }
  return groups;
}

function DeepDiveView() {
  const ammp = useAmmp();
  const [sel, setSel] = _useState('');
  const ordered = React.useMemo(() => ammp.sites.slice().sort((a, b) => a.name.localeCompare(b.name)), [ammp.sites]);
  const groups = React.useMemo(() => siteOptgroups(ordered), [ordered]);

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
          {groups.map((g) => (
            <optgroup key={g.letter} label={g.letter}>
              {g.items.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
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
