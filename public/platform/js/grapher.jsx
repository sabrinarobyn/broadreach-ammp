/* ============================================================
   Broadreach Platform — Grapher (per-asset power vs inverter temp)
   Lives as a nav tab inside the Platform shell, reusing AmmpContext
   for auth/asset/device access.
   ============================================================ */
const { useState: _gUseState, useEffect: _gUseEffect } = React;

const GRAPH_COLORS = ['#C86A1A', '#5d809a', '#4e7d3a', '#6D4AC2', '#1B7E8C', '#d34a5e', '#B58A00', '#315EDC', '#0E7C5A', '#A23E8C'];
const GRAPH_DAY_MS = 86400000;
function grapherIsoDate(d) { return d.toISOString().slice(0, 10); }
function grapherClampRange(from, to) {
  let a = new Date(from + 'T00:00:00'), b = new Date(to + 'T00:00:00');
  if (b < a) b = new Date(a);
  if ((b - a) / GRAPH_DAY_MS > 6) b = new Date(a.getTime() + 6 * GRAPH_DAY_MS);
  return { from: grapherIsoDate(a), to: grapherIsoDate(b), days: Math.round((b - a) / GRAPH_DAY_MS) + 1 };
}

function GrapherView() {
  const ammp = useAmmp();
  const [assetId, setAssetId] = _gUseState('');
  const [devices, setDevices] = _gUseState([]);
  const [devErr, setDevErr] = _gUseState(null);
  const [selected, setSelected] = _gUseState(new Set());
  const [from, setFrom] = _gUseState(() => grapherIsoDate(new Date(Date.now() - 7 * GRAPH_DAY_MS)));
  const [to, setTo] = _gUseState(() => grapherIsoDate(new Date()));
  const [tab, setTab] = _gUseState('scatter');
  const [loading, setLoading] = _gUseState(false);
  const [loadErr, setLoadErr] = _gUseState(null);
  const [results, setResults] = _gUseState(null);

  _gUseEffect(() => {
    setDevices([]); setSelected(new Set()); setResults(null); setDevErr(null);
    if (!assetId || !ammp.live) return;
    let cancelled = false;
    ammp.devicesFor(assetId, DEVICE_TYPE.INVERTER).then(list => {
      if (cancelled) return;
      setDevices(list);
      setSelected(new Set(list.map(d => d.device_id)));
      if (!list.length) setDevErr('No PV inverters found on this asset.');
    }).catch(e => { if (!cancelled) setDevErr(e.message || 'Failed to load devices.'); });
    return () => { cancelled = true; };
  }, [assetId, ammp.live]);

  const r = grapherClampRange(from, to);
  const setFromSafe = (v) => { const c = grapherClampRange(v, to); setFrom(c.from); setTo(c.to); };
  const setToSafe = (v) => { const c = grapherClampRange(from, v); setFrom(c.from); setTo(c.to); };

  const toggleDevice = (id) => setSelected(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const selAll = () => setSelected(new Set(devices.map(d => d.device_id)));
  const selNone = () => setSelected(new Set());

  const load = async () => {
    if (!assetId || selected.size === 0) return;
    setLoading(true); setLoadErr(null); setResults(null);
    try {
      const dateFromIso = new Date(r.from + 'T00:00:00Z').toISOString();
      const dateToIso = new Date(r.to + 'T23:59:59Z').toISOString();
      const ids = [...selected];
      const out = await Promise.all(ids.map(async (devId, i) => {
        const dev = devices.find(d => d.device_id === devId);
        const series = await ammp.inverterSeriesFor(devId, dateFromIso, dateToIso, r.days);
        return { deviceId: devId, name: dev ? dev.device_name : devId, color: GRAPH_COLORS[i % GRAPH_COLORS.length], series };
      }));
      setResults(out);
    } catch (e) {
      setLoadErr(e.message || 'Failed to load data.');
    } finally {
      setLoading(false);
    }
  };

  if (!ammp.live) {
    return <ConnectGate note="Sign in with your AMMP x-api-key to list assets and devices." />;
  }

  return (
    <div>
      <div className="card" style={{ padding: '14px 18px', marginBottom: 'var(--gap)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <span className="eyebrow" style={{ flexShrink: 0 }}>1 · Select asset</span>
          <select className="fld" value={assetId} onChange={e => setAssetId(e.target.value)} style={{ flex: '1 1 260px', maxWidth: 380 }}>
            <option value="">— choose an asset —</option>
            {ammp.assets.map(a => <option key={a.asset_id} value={a.asset_id}>{a.asset_name}{a.long_name ? ` — ${a.long_name}` : ''}{a.country_code ? ` (${a.country_code})` : ''}</option>)}
          </select>
          <span className="mono" style={{ fontSize: '0.62rem', color: 'var(--ink-light)' }}>{ammp.assets.length} assets from AMMP</span>
        </div>
        {devErr && <div className="mono" style={{ fontSize: '0.66rem', color: 'var(--rd)', marginTop: 10 }}>✗ {devErr}</div>}
      </div>

      {!!devices.length && (
        <div className="card" style={{ padding: '14px 18px', marginBottom: 'var(--gap)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 12, flexWrap: 'wrap' }}>
            <span className="eyebrow" style={{ paddingTop: 6, flexShrink: 0 }}>2 · Configure</span>
            <div style={{ flex: 1, minWidth: 240 }}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <button className="btn btn-ghost btn-sm" onClick={selAll}>All</button>
                <button className="btn btn-ghost btn-sm" onClick={selNone}>None</button>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {devices.map((d, i) => {
                  const on = selected.has(d.device_id);
                  return (
                    <button key={d.device_id} onClick={() => toggleDevice(d.device_id)} style={{
                      display: 'flex', alignItems: 'center', gap: 7, padding: '5px 11px', borderRadius: 20,
                      border: `1px solid ${on ? GRAPH_COLORS[i % GRAPH_COLORS.length] : 'var(--grey-lt)'}`, background: on ? '#fff' : 'var(--grey-xlt)',
                      fontFamily: 'var(--font-mono)', fontSize: '0.68rem', fontWeight: 600, color: on ? 'var(--ink)' : 'var(--ink-light)', cursor: 'pointer',
                    }}>
                      <span style={{ width: 9, height: 9, borderRadius: '50%', background: on ? GRAPH_COLORS[i % GRAPH_COLORS.length] : '#C2C8CE' }}></span>{d.device_name}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span className="eyebrow">Date range</span>
            <input type="date" className="fld" value={from} onChange={e => setFromSafe(e.target.value)} style={{ fontSize: '0.72rem' }} />
            <span className="mono" style={{ color: 'var(--ink-light)', fontSize: '0.7rem' }}>→</span>
            <input type="date" className="fld" value={to} onChange={e => setToSafe(e.target.value)} style={{ fontSize: '0.72rem' }} />
            <span className="mono" style={{ fontSize: '0.6rem', color: r.days >= 7 ? 'var(--amb-dk)' : 'var(--ink-light)', background: r.days >= 7 ? 'var(--amb-lt)' : 'var(--grey-xlt)', padding: '3px 8px', borderRadius: 6, whiteSpace: 'nowrap' }}>{r.days}d · max 7</span>
            <button className="btn" onClick={load} disabled={loading || !selected.size} style={{ marginLeft: 'auto' }}>{loading ? <span className="spin">◠</span> : 'Load data & plot'}</button>
          </div>
          {loadErr && <div className="mono" style={{ fontSize: '0.66rem', color: 'var(--rd)', marginTop: 10 }}>✗ {loadErr}</div>}
        </div>
      )}

      {results && (
        <div>
          <div style={{ display: 'flex', gap: 4, background: '#fff', border: '1px solid var(--grey-lt)', borderRadius: 8, padding: 3, marginBottom: 'var(--gap)', width: 'fit-content' }}>
            {[['scatter', 'Power vs Inverter Temp'], ['ts', 'Time Series — Dual Axis']].map(([v, l]) => (
              <button key={v} onClick={() => setTab(v)} className="seg-btn" data-on={tab === v}>{l}</button>
            ))}
          </div>

          {tab === 'scatter' ? (
            <div className="card" style={{ padding: 16 }}>
              <h3 style={{ fontSize: '0.92rem', fontWeight: 700, margin: '0 0 2px' }}>AC Power vs Inverter Temperature</h3>
              <div className="mono" style={{ fontSize: '0.62rem', color: 'var(--ink-light)', marginBottom: 12 }}>Each point = one interval, across {results.length} inverter{results.length === 1 ? '' : 's'}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginBottom: 10 }}>
                {results.map(r2 => (
                  <span key={r2.deviceId} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.68rem', color: 'var(--ink-mid)' }}>
                    <span style={{ width: 9, height: 9, borderRadius: '50%', background: r2.color }}></span>{r2.name}
                  </span>
                ))}
              </div>
              <ScatterChart series={results.map(r2 => ({ color: r2.color, pts: r2.series.pts }))} height={380} />
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap)' }}>
              {results.map(r2 => (
                <div key={r2.deviceId} className="card" style={{ padding: 16 }}>
                  <h3 style={{ fontSize: '0.92rem', fontWeight: 700, margin: '0 0 2px' }}>{r2.name}</h3>
                  <div className="mono" style={{ fontSize: '0.62rem', color: 'var(--ink-light)', marginBottom: 10 }}>AC power (kW) · inverter temp (°C, dashed)</div>
                  <InverterChart series={r2.series} invColor={r2.color} height={260} metrics={['power', 'temp']} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

Object.assign(window, { GrapherView });
