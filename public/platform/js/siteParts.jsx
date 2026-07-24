/* ============================================================
   Broadreach Platform — site-detail panels, all real-data-only.
   Each panel fetches its own endpoint and hides itself (`return null`)
   when the asset genuinely has no data for it (empty impact series,
   etc.) rather than showing a placeholder. Per-string monitoring
   lives in js/inverters.jsx, alongside the per-inverter charts it
   overlays onto.
   ============================================================ */

const { useState: _spUseState } = React;

function Loading({ label }) {
  return <div className="card" style={{ padding: 24, textAlign: 'center' }}><span className="mono" style={{ fontSize: '0.7rem', color: 'var(--ink-light)' }}>{label || 'Loading…'}</span></div>;
}

/* ---------------- Alerts ---------------- */
/* Lifted out of AlertsPanel so SiteView can also use "any alert today?" to
   decide whether the page's status badge should be overridden to 'alert' —
   a single fetch shared by both, rather than each doing its own. */
function useStatusInfoToday(site) {
  const ammp = useAmmp();
  const [state, setState] = _spUseState({ status: 'loading' });
  React.useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });
    fetchStatusInfoLatest(ammp.token, site.id).then((resp) => {
      if (cancelled) return;
      const all = deriveActiveAlerts(resp);
      const now = Date.now();
      const today = all.filter((a) => isSameSastDay(a._t, now));
      setState({ status: 'ready', items: today, hasAlertsToday: today.length > 0 });
    }).catch((e) => { if (!cancelled) setState({ status: 'error', error: e.message }); });
    return () => { cancelled = true; };
  }, [site.id, ammp.token]);
  return state;
}

function AlertsPanel({ statusInfo }) {
  const { status, items, error } = statusInfo;
  return (
    <div className="card" style={{ padding: 16 }}>
      <h3 style={{ fontSize: '0.92rem', fontWeight: 700, margin: '0 0 12px' }}>System Alerts <span className="mono" style={{ fontWeight: 400, fontSize: '0.6rem', color: 'var(--ink-light)' }}>· today</span></h3>
      {status === 'loading' && <div className="mono" style={{ fontSize: '0.68rem', color: 'var(--ink-light)', padding: '12px 0', textAlign: 'center' }}>Loading…</div>}
      {status === 'error' && <ErrorNote message={error} />}
      {status === 'ready' && (!items || !items.length) && <div className="mono" style={{ fontSize: '0.68rem', color: 'var(--ink-light)', padding: '12px 0', textAlign: 'center' }}>No active alerts today.</div>}
      {status === 'ready' && items && items.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {items.map((a, i) => {
            const title = a.content || a.title || a.message || a.description || a.name || 'Alert';
            const time = a.timestamp || a.time || a.date || null;
            return (
              <div key={i} style={{ display: 'flex', gap: 10, padding: '9px 11px', borderRadius: 8, background: 'var(--amb-lt)', borderLeft: '3px solid var(--amb)' }}>
                <div style={{ flex: 1, fontWeight: 700, fontSize: '0.74rem', color: 'var(--ink)' }}>{title}</div>
                {time && <span className="mono" style={{ fontSize: '0.56rem', color: 'var(--ink-light)', whiteSpace: 'nowrap' }}>{new Date(time).toLocaleString()}</span>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ---------------- Environmental impact ---------------- */
function useEnvironmentalImpact(site) {
  const ammp = useAmmp();
  const [state, setState] = _spUseState({ status: 'loading' });
  React.useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });
    const now = new Date();
    const dateFrom = utcDateOnly(new Date(now.getFullYear(), now.getMonth() - 11, 1));
    const dateTo = utcDateOnly(now);
    fetchEnvironmentalImpact(ammp.token, site.id, { dateFrom, dateTo, interval: '1M' }).then((resp) => {
      if (cancelled) return;
      const series = extractAssetSeries(resp);
      setState(series.length ? { status: 'ready', series } : { status: 'empty' });
    }).catch((e) => { if (!cancelled) setState({ status: 'error', error: e.message }); });
    return () => { cancelled = true; };
  }, [site.id, ammp.token]);
  return state;
}

function EnviroPanel({ site }) {
  const { status, series, error } = useEnvironmentalImpact(site);
  if (status === 'loading') return <Loading />;
  if (status === 'error') return <div className="card" style={{ padding: 16 }}><ErrorNote message={error} /></div>;
  if (status !== 'ready') return null;

  const co2Series = series.find((s) => /co.?2/i.test(s.key)) || series[0];
  const monthly = co2Series.points.map((p) => Number(p.value) || 0);
  const total = monthly.reduce((a, v) => a + v, 0);

  return (
    <div className="card" style={{ padding: 16 }}>
      <h3 style={{ fontSize: '0.92rem', fontWeight: 700, margin: '0 0 12px' }}>Environmental Impact <span className="mono" style={{ fontWeight: 400, fontSize: '0.6rem', color: 'var(--ink-light)' }}>· trailing 12 mo</span></h3>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
        <span style={{ fontSize: '0.74rem', color: 'var(--ink-mid)' }}>{co2Series.label}</span>
        <span className="display" style={{ fontSize: '1.15rem', color: 'var(--grn)' }}>{total.toLocaleString(undefined, { maximumFractionDigits: 1 })}</span>
      </div>
      {monthly.length > 1 && (<><div className="eyebrow" style={{ margin: '12px 0 6px' }}>Monthly</div><MiniBars values={monthly} color="var(--grn)" h={40} /></>)}
    </div>
  );
}

/* ---------------- Revenue / financial impact ---------------- */
function useFinancialImpact(site) {
  const ammp = useAmmp();
  const [state, setState] = _spUseState({ status: 'loading' });
  React.useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });
    const now = new Date();
    const dateFrom = utcDateOnly(new Date(now.getFullYear(), now.getMonth(), 1));
    const dateTo = utcDateOnly(now);
    fetchFinancialImpact(ammp.token, site.id, { dateFrom, dateTo, interval: '1d' }).then((resp) => {
      if (cancelled) return;
      const series = extractAssetSeries(resp);
      setState(series.length ? { status: 'ready', series } : { status: 'empty' });
    }).catch((e) => { if (!cancelled) setState({ status: 'error', error: e.message }); });
    return () => { cancelled = true; };
  }, [site.id, ammp.token]);
  return state;
}

function RevenuePanel({ site }) {
  const { status, series, error } = useFinancialImpact(site);
  if (status === 'loading') return <Loading />;
  if (status === 'error') return <div className="card" style={{ padding: 16 }}><ErrorNote message={error} /></div>;
  if (status !== 'ready') return null;

  return (
    <div className="card" style={{ padding: 16 }}>
      <h3 style={{ fontSize: '0.92rem', fontWeight: 700, margin: '0 0 10px' }}>Revenue &amp; Savings <span className="mono" style={{ fontWeight: 400, fontSize: '0.6rem', color: 'var(--ink-light)' }}>· this month</span></h3>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
        {series.map((s) => {
          const values = s.points.map((p) => Number(p.value) || 0);
          const total = values.reduce((a, v) => a + v, 0);
          return (
            <div key={s.key} style={{ flex: '1 1 140px', background: 'var(--grey-xlt)', borderRadius: 8, padding: '10px 12px' }}>
              <div className="display" style={{ fontSize: '1.2rem', color: 'var(--br-dk)' }}>{total.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
              <div className="mono" style={{ fontSize: '0.58rem', color: 'var(--ink-light)' }}>{s.label}</div>
              {values.length > 1 && <Spark values={values} color="var(--grn)" w={110} h={28} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

Object.assign(window, { AlertsPanel, EnviroPanel, RevenuePanel, Loading });
