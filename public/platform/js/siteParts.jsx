/* ============================================================
   Broadreach Platform — site-detail panels, all real-data-only.
   Each panel fetches its own endpoint and hides itself (`return null`)
   when the asset genuinely has no data for it (no battery device, no
   per-string data found, empty impact series, etc.) rather than
   showing a placeholder.
   ============================================================ */

const { useState: _spUseState } = React;

function Loading({ label }) {
  return <div className="card" style={{ padding: 24, textAlign: 'center' }}><span className="mono" style={{ fontSize: '0.7rem', color: 'var(--ink-light)' }}>{label || 'Loading…'}</span></div>;
}

/* ---------------- Panel Array (per-string monitoring) ---------------- */
function usePerStringData(site) {
  const ammp = useAmmp();
  const [state, setState] = _spUseState({ status: 'loading', strings: [] });
  React.useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading', strings: [] });
    (async () => {
      try {
        const devices = await ammp.devicesFor(site.id, DEVICE_TYPE.INVERTER);
        if (!devices.length) { if (!cancelled) setState({ status: 'empty', strings: [] }); return; }
        const to = new Date(), from = new Date(to.getTime() - 24 * 3600 * 1000);
        const results = await Promise.all(devices.map((d) =>
          fetchInverterHistoric(ammp.token, d.device_id, { dateFrom: from.toISOString(), dateTo: to.toISOString(), interval: '15m' }).catch(() => null)));
        const strings = [];
        results.forEach((resp, i) => {
          if (!resp) return;
          extractDeviceSeries(resp).filter((s) => /string/i.test(s.key)).forEach((s) => {
            const last = s.points[s.points.length - 1];
            if (last && last.value != null) strings.push({ inverter: devices[i].device_name || `Inverter ${i + 1}`, label: s.label, value: last.value });
          });
        });
        if (!cancelled) setState({ status: strings.length ? 'ready' : 'empty', strings });
      } catch (e) {
        if (!cancelled) setState({ status: 'error', strings: [], error: e.message });
      }
    })();
    return () => { cancelled = true; };
  }, [site.id, ammp.token]);
  return state;
}

function PanelArray({ site }) {
  const { status, strings, error } = usePerStringData(site);
  if (status === 'loading') return <Loading label="Loading string data…" />;
  if (status === 'error') return <div className="card" style={{ padding: 16 }}><ErrorNote message={error} /></div>;
  if (status !== 'ready') return null; // no per-string data confirmed for this asset
  return (
    <div className="card" style={{ padding: 16 }}>
      <h3 style={{ fontSize: '0.92rem', fontWeight: 700, margin: '0 0 12px' }}>String Monitoring</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 8 }}>
        {strings.map((s, i) => (
          <div key={i} style={{ background: 'var(--grey-xlt)', borderRadius: 7, padding: '10px 8px', textAlign: 'center' }}>
            <div className="mono" style={{ fontSize: '0.56rem', color: 'var(--ink-light)' }}>{s.inverter}</div>
            <div className="display" style={{ fontSize: '1rem' }}>{Number(s.value).toFixed(1)}</div>
            <div className="mono" style={{ fontSize: '0.54rem', color: 'var(--ink-light)' }}>{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------- Battery ---------------- */
function useBatteryData(site) {
  const ammp = useAmmp();
  const [state, setState] = _spUseState({ status: 'loading' });
  React.useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });
    (async () => {
      try {
        const devices = await ammp.devicesFor(site.id, DEVICE_TYPE.BATTERY);
        if (!devices.length) { if (!cancelled) setState({ status: 'empty' }); return; }
        const to = new Date(), from = new Date(to.getTime() - 6 * 3600 * 1000);
        const resp = await fetchDeviceHistoricBattery(ammp.token, devices[0].device_id, { dateFrom: from.toISOString(), dateTo: to.toISOString(), interval: '15m' });
        const series = extractDeviceSeries(resp);
        if (!cancelled) setState(series.length ? { status: 'ready', series } : { status: 'empty' });
      } catch (e) {
        if (!cancelled) setState({ status: 'error', error: e.message });
      }
    })();
    return () => { cancelled = true; };
  }, [site.id, ammp.token]);
  return state;
}

function BatteryPanel({ site }) {
  const { status, series, error } = useBatteryData(site);
  if (status === 'loading') return <Loading label="Loading battery data…" />;
  if (status === 'error') return <div className="card" style={{ padding: 16 }}><ErrorNote message={error} /></div>;
  if (status !== 'ready') return null; // no battery device on this asset

  const socSeries = series.find((s) => /soc/i.test(s.key)) || series[0];
  const last = socSeries.points[socSeries.points.length - 1];
  const socValue = last && last.value != null ? Number(last.value) : null;

  return (
    <div className="card" style={{ padding: 16 }}>
      <h3 style={{ fontSize: '0.92rem', fontWeight: 700, margin: '0 0 12px' }}>Battery Storage</h3>
      {socValue != null && <Donut value={Math.min(100, Math.max(0, socValue))} label={socValue.toFixed(0) + '%'} sub={socSeries.label} size={104} />}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 12 }}>
        {series.map((s) => {
          const p = s.points[s.points.length - 1];
          if (!p || p.value == null) return null;
          return (
            <div key={s.key} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem' }}>
              <span style={{ color: 'var(--ink-mid)' }}>{s.label}</span>
              <span className="mono" style={{ fontWeight: 700 }}>{Number(p.value).toFixed(2)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------- Alerts ---------------- */
function useStatusInfo(site) {
  const ammp = useAmmp();
  const [state, setState] = _spUseState({ status: 'loading' });
  React.useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });
    fetchStatusInfoLatest(ammp.token, site.id).then((resp) => {
      if (cancelled) return;
      const arrayKey = Object.keys(resp || {}).find((k) => Array.isArray(resp[k]));
      setState({ status: 'ready', items: arrayKey ? resp[arrayKey] : [] });
    }).catch((e) => { if (!cancelled) setState({ status: 'error', error: e.message }); });
    return () => { cancelled = true; };
  }, [site.id, ammp.token]);
  return state;
}

function AlertsPanel({ site }) {
  const { status, items, error } = useStatusInfo(site);
  return (
    <div className="card" style={{ padding: 16 }}>
      <h3 style={{ fontSize: '0.92rem', fontWeight: 700, margin: '0 0 12px' }}>System Alerts</h3>
      {status === 'loading' && <div className="mono" style={{ fontSize: '0.68rem', color: 'var(--ink-light)', padding: '12px 0', textAlign: 'center' }}>Loading…</div>}
      {status === 'error' && <ErrorNote message={error} />}
      {status === 'ready' && (!items || !items.length) && <div className="mono" style={{ fontSize: '0.68rem', color: 'var(--ink-light)', padding: '12px 0', textAlign: 'center' }}>No active alerts.</div>}
      {status === 'ready' && items && items.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {items.map((a, i) => {
            const title = a.title || a.message || a.description || a.name || 'Alert';
            const time = a.time || a.date || a.timestamp || null;
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
    const to = new Date(), from = new Date(to.getFullYear(), to.getMonth() - 11, 1);
    fetchEnvironmentalImpact(ammp.token, site.id, { dateFrom: from.toISOString(), dateTo: to.toISOString(), interval: '1M' }).then((resp) => {
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
    const to = new Date(), from = new Date(to.getFullYear(), to.getMonth(), 1);
    fetchFinancialImpact(ammp.token, site.id, { dateFrom: from.toISOString(), dateTo: to.toISOString(), interval: '1d' }).then((resp) => {
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

Object.assign(window, { PanelArray, BatteryPanel, AlertsPanel, EnviroPanel, RevenuePanel, Loading });
