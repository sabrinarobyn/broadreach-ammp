/* ============================================================
   Broadreach Platform — Grapher: pick a site, pick whichever
   inverter metrics exist for it, plot them against time (multi-axis)
   or against each other (scatter), per-inverter or aggregated.
   Data logic lives in js/grapherMetrics.jsx, rendering in
   js/grapherChart.jsx — this file is just selection state + layout.
   ============================================================ */
const { useState: _gUseState, useEffect: _gUseEffect } = React;

const GRAPH_COLORS = ['#C86A1A', '#5d809a', '#4e7d3a', '#6D4AC2', '#1B7E8C', '#d34a5e', '#B58A00', '#315EDC', '#0E7C5A', '#A23E8C'];
const GRAPH_DAY_MS = 86400000;
const GRAPHER_MAX_DAYS = 90;
function grapherIsoDate(d) { return d.toISOString().slice(0, 10); }
function grapherAssetGroups(assets) {
  const sorted = [...assets].sort((a, b) => (a.asset_name || '').localeCompare(b.asset_name || ''));
  const groups = [];
  let cur = null;
  for (const a of sorted) {
    const letter = ((a.asset_name || '')[0] || '#').toUpperCase();
    if (!cur || cur.letter !== letter) { cur = { letter, items: [] }; groups.push(cur); }
    cur.items.push(a);
  }
  return groups;
}
/* Only a soft outer cap now (device-level chunking already handles any range
   transparently via fetchChunked) — bounds total chunked-request count for a
   single load, not a hard UI limit like the old 7-day clamp. */
function grapherClampRange(from, to) {
  let a = new Date(from + 'T00:00:00'), b = new Date(to + 'T00:00:00');
  if (b < a) b = new Date(a);
  if ((b - a) / GRAPH_DAY_MS + 1 > GRAPHER_MAX_DAYS) b = new Date(a.getTime() + (GRAPHER_MAX_DAYS - 1) * GRAPH_DAY_MS);
  return { from: grapherIsoDate(a), to: grapherIsoDate(b), days: Math.round((b - a) / GRAPH_DAY_MS) + 1 };
}

function GrapherView() {
  const ammp = useAmmp();
  const [assetId, setAssetId] = _gUseState('');
  const [devices, setDevices] = _gUseState([]);
  const [devErr, setDevErr] = _gUseState(null);
  const [selected, setSelected] = _gUseState(new Set());
  const [aggregate, setAggregate] = _gUseState(false);
  const [from, setFrom] = _gUseState(() => grapherIsoDate(new Date(Date.now() - 6 * GRAPH_DAY_MS)));
  const [to, setTo] = _gUseState(() => grapherIsoDate(new Date()));
  const [chartType, setChartType] = _gUseState('timeseries');
  const [loading, setLoading] = _gUseState(false);
  const [loadErr, setLoadErr] = _gUseState(null);
  const [rawByDevice, setRawByDevice] = _gUseState(null);
  const [metrics, setMetrics] = _gUseState([]);
  const [selectedMetricKeys, setSelectedMetricKeys] = _gUseState(new Set());
  const [xMetricKey, setXMetricKey] = _gUseState('');
  const [yMetricKey, setYMetricKey] = _gUseState('');
  const chartInstRef = React.useRef(null);

  _gUseEffect(() => {
    setDevices([]); setSelected(new Set()); setRawByDevice(null); setMetrics([]); setSelectedMetricKeys(new Set()); setDevErr(null);
    if (!assetId || !ammp.live) return;
    let cancelled = false;
    ammp.devicesFor(assetId, DEVICE_TYPE.INVERTER).then((list) => {
      if (cancelled) return;
      setDevices(list);
      setSelected(new Set(list.map((d) => d.device_id)));
      if (!list.length) setDevErr('No PV inverters found on this asset.');
    }).catch((e) => { if (!cancelled) setDevErr(e.message || 'Failed to load devices.'); });
    return () => { cancelled = true; };
  }, [assetId, ammp.live]);

  const r = grapherClampRange(from, to);
  const setFromSafe = (v) => { const c = grapherClampRange(v, to); setFrom(c.from); setTo(c.to); };
  const setToSafe = (v) => { const c = grapherClampRange(from, v); setFrom(c.from); setTo(c.to); };
  const setPresetToday = () => { const d = grapherIsoDate(new Date()); setFrom(d); setTo(d); };
  const setPreset7d = () => { setFrom(grapherIsoDate(new Date(Date.now() - 6 * GRAPH_DAY_MS))); setTo(grapherIsoDate(new Date())); };
  const setPreset30d = () => { setFrom(grapherIsoDate(new Date(Date.now() - 29 * GRAPH_DAY_MS))); setTo(grapherIsoDate(new Date())); };

  const toggleDevice = (id) => setSelected((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const selAll = () => setSelected(new Set(devices.map((d) => d.device_id)));
  const selNone = () => setSelected(new Set());
  const toggleMetric = (key) => setSelectedMetricKeys((p) => { const n = new Set(p); n.has(key) ? n.delete(key) : n.add(key); return n; });

  const load = async () => {
    if (!assetId || selected.size === 0) return;
    setLoading(true); setLoadErr(null); setRawByDevice(null); setMetrics([]); setSelectedMetricKeys(new Set());
    try {
      const dateFromIso = new Date(r.from + 'T00:00:00Z').toISOString();
      const dateToIso = new Date(r.to + 'T23:59:59Z').toISOString();
      const ids = [...selected];
      const out = await mapWithConcurrency(ids, 4, async (devId, i) => {
        const dev = devices.find((d) => d.device_id === devId);
        const raw = await fetchChunked(fetchInverterHistoric, ammp.token, devId, dateFromIso, dateToIso, '15m', 7);
        return { deviceId: devId, name: dev ? dev.device_name : devId, color: GRAPH_COLORS[i % GRAPH_COLORS.length], raw };
      });
      setRawByDevice(out);
      const discovered = discoverMetricsAcross(out);
      setMetrics(discovered);
      if (discovered.length) {
        setSelectedMetricKeys(new Set([discovered[0].key]));
        const tempM = discovered.find((m) => /temp/i.test(m.key));
        const powerM = discovered.find((m) => /power|_p_total$/i.test(m.key));
        setXMetricKey((tempM || discovered[1] || discovered[0]).key);
        setYMetricKey((powerM || discovered[0]).key);
      } else {
        setLoadErr('No metrics with data were found for the selected inverter(s) in this range.');
      }
    } catch (e) {
      setLoadErr(e.message || 'Failed to load data.');
    } finally {
      setLoading(false);
    }
  };

  const plotted = React.useMemo(() => {
    if (!rawByDevice || chartType !== 'timeseries') return [];
    const chosen = metrics.filter((m) => selectedMetricKeys.has(m.key));
    const list = [];
    if (aggregate) {
      chosen.forEach((m, mi) => {
        list.push({ label: `${m.label} (aggregate)`, unit: m.unit, color: GRAPH_COLORS[mi % GRAPH_COLORS.length], points: alignAndAggregate(rawByDevice, m.key, m.kind) });
      });
    } else {
      let ci = 0;
      rawByDevice.forEach((d) => {
        chosen.forEach((m) => {
          const map = deviceMetricMap(d.raw, m.key);
          list.push({ label: `${d.name} · ${m.label}`, unit: m.unit, color: GRAPH_COLORS[ci % GRAPH_COLORS.length], points: [...map.entries()].map(([timestamp, value]) => ({ timestamp, value })) });
          ci++;
        });
      });
    }
    return list;
  }, [rawByDevice, chartType, aggregate, metrics, selectedMetricKeys]);

  const scatterSeries = React.useMemo(() => {
    if (!rawByDevice || chartType !== 'scatter') return [];
    const xMetric = metrics.find((m) => m.key === xMetricKey);
    const yMetric = metrics.find((m) => m.key === yMetricKey);
    if (!xMetric || !yMetric) return [];
    if (aggregate) {
      return [{ label: 'Aggregate', color: GRAPH_COLORS[0], xPoints: alignAndAggregate(rawByDevice, xMetric.key, xMetric.kind), yPoints: alignAndAggregate(rawByDevice, yMetric.key, yMetric.kind) }];
    }
    return rawByDevice.map((d, i) => ({
      label: d.name, color: GRAPH_COLORS[i % GRAPH_COLORS.length],
      xPoints: [...deviceMetricMap(d.raw, xMetric.key).entries()].map(([timestamp, value]) => ({ timestamp, value })),
      yPoints: [...deviceMetricMap(d.raw, yMetric.key).entries()].map(([timestamp, value]) => ({ timestamp, value })),
    }));
  }, [rawByDevice, chartType, aggregate, metrics, xMetricKey, yMetricKey]);

  const tsChartConfig = React.useMemo(() => (chartType === 'timeseries' ? buildTimeSeriesConfig(plotted) : null), [chartType, plotted]);
  const xMetric = metrics.find((m) => m.key === xMetricKey);
  const yMetric = metrics.find((m) => m.key === yMetricKey);
  const scatterChartConfig = React.useMemo(() => (chartType === 'scatter' ? buildScatterConfig(scatterSeries) : null), [chartType, scatterSeries]);

  const exportCsv = () => {
    if (!rawByDevice) return;
    const csv = chartType === 'timeseries'
      ? buildGrapherCsv(plotted)
      : buildScatterCsv(scatterSeries, (xMetric && xMetric.label) || 'X', (yMetric && yMetric.label) || 'Y');
    downloadText(`grapher-${assetId}-${from}-to-${to}.csv`, csv);
  };
  const exportPng = () => {
    if (chartInstRef.current) downloadDataUrl(`grapher-${assetId}-${from}-to-${to}.png`, chartInstRef.current.toBase64Image());
  };

  if (!ammp.live) {
    return <ConnectGate note="Sign in with your AMMP x-api-key to list assets and devices." />;
  }

  const hasChart = chartType === 'timeseries' ? plotted.length > 0 : scatterSeries.length > 0;

  return (
    <div>
      <div className="card" style={{ padding: '14px 18px', marginBottom: 'var(--gap)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <span className="eyebrow" style={{ flexShrink: 0 }}>1 · Select asset</span>
          <select className="fld" value={assetId} onChange={(e) => setAssetId(e.target.value)} style={{ flex: '1 1 260px', maxWidth: 380 }}>
            <option value="">— choose an asset —</option>
            {grapherAssetGroups(ammp.assets).map((g) => (
              <optgroup key={g.letter} label={g.letter}>
                {g.items.map((a) => <option key={a.asset_id} value={a.asset_id}>{a.asset_name}{a.long_name ? ` — ${a.long_name}` : ''}{a.country_code ? ` (${a.country_code})` : ''}</option>)}
              </optgroup>
            ))}
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
              <div style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <button className="btn btn-ghost btn-sm" onClick={selAll}>All</button>
                <button className="btn btn-ghost btn-sm" onClick={selNone}>None</button>
                <label className="mono" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.68rem', color: 'var(--ink-mid)', marginLeft: 10 }}>
                  <input type="checkbox" checked={aggregate} onChange={(e) => setAggregate(e.target.checked)} disabled={selected.size < 2} />
                  Aggregate across inverters (sum power, average rate/level metrics)
                </label>
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
            <button className="btn btn-ghost btn-sm" onClick={setPresetToday}>Today</button>
            <button className="btn btn-ghost btn-sm" onClick={setPreset7d}>7 days</button>
            <button className="btn btn-ghost btn-sm" onClick={setPreset30d}>30 days</button>
            <input type="date" className="fld" value={from} onChange={(e) => setFromSafe(e.target.value)} style={{ fontSize: '0.72rem' }} />
            <span className="mono" style={{ color: 'var(--ink-light)', fontSize: '0.7rem' }}>→</span>
            <input type="date" className="fld" value={to} onChange={(e) => setToSafe(e.target.value)} style={{ fontSize: '0.72rem' }} />
            <span className="mono" style={{ fontSize: '0.6rem', color: r.days >= GRAPHER_MAX_DAYS ? 'var(--amb-dk)' : 'var(--ink-light)', background: r.days >= GRAPHER_MAX_DAYS ? 'var(--amb-lt)' : 'var(--grey-xlt)', padding: '3px 8px', borderRadius: 6, whiteSpace: 'nowrap' }}>{r.days}d · max {GRAPHER_MAX_DAYS}</span>
            <button className="btn" onClick={load} disabled={loading || !selected.size} style={{ marginLeft: 'auto' }}>{loading ? <span className="spin">◠</span> : 'Load data & plot'}</button>
          </div>
          {loadErr && <div className="mono" style={{ fontSize: '0.66rem', color: 'var(--rd)', marginTop: 10 }}>✗ {loadErr}</div>}
        </div>
      )}

      {!!metrics.length && (
        <div className="card" style={{ padding: '14px 18px', marginBottom: 'var(--gap)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, flexWrap: 'wrap' }}>
            <span className="eyebrow" style={{ paddingTop: 6, flexShrink: 0 }}>3 · Metrics</span>
            <div style={{ flex: 1, minWidth: 240 }}>
              <div style={{ display: 'flex', gap: 4, background: '#fff', border: '1px solid var(--grey-lt)', borderRadius: 8, padding: 3, marginBottom: 12, width: 'fit-content' }}>
                {[['timeseries', 'Time series'], ['scatter', 'Scatter']].map(([v, l]) => (
                  <button key={v} onClick={() => setChartType(v)} className="seg-btn" data-on={chartType === v}>{l}</button>
                ))}
              </div>

              {chartType === 'timeseries' ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {metrics.map((m) => {
                    const on = selectedMetricKeys.has(m.key);
                    return (
                      <button key={m.key} onClick={() => toggleMetric(m.key)} style={{
                        display: 'flex', alignItems: 'center', gap: 7, padding: '5px 11px', borderRadius: 20,
                        border: `1px solid ${on ? 'var(--br)' : 'var(--grey-lt)'}`, background: on ? '#fff' : 'var(--grey-xlt)',
                        fontFamily: 'var(--font-mono)', fontSize: '0.68rem', fontWeight: 600, color: on ? 'var(--ink)' : 'var(--ink-light)', cursor: 'pointer',
                      }}>
                        {m.label}{m.unit ? ` (${m.unit})` : ''}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
                  <label className="mono" style={{ fontSize: '0.68rem', color: 'var(--ink-mid)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    X:
                    <select className="fld" value={xMetricKey} onChange={(e) => setXMetricKey(e.target.value)}>
                      {metrics.map((m) => <option key={m.key} value={m.key}>{m.label}{m.unit ? ` (${m.unit})` : ''}</option>)}
                    </select>
                  </label>
                  <label className="mono" style={{ fontSize: '0.68rem', color: 'var(--ink-mid)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    Y:
                    <select className="fld" value={yMetricKey} onChange={(e) => setYMetricKey(e.target.value)}>
                      {metrics.map((m) => <option key={m.key} value={m.key}>{m.label}{m.unit ? ` (${m.unit})` : ''}</option>)}
                    </select>
                  </label>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {hasChart && (
        <div className="card" style={{ padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10, marginBottom: 10 }}>
            <div>
              <h3 style={{ fontSize: '0.92rem', fontWeight: 700, margin: '0 0 2px' }}>
                {chartType === 'timeseries' ? 'Time series' : `${(yMetric && yMetric.label) || 'Y'} vs ${(xMetric && xMetric.label) || 'X'}`}
              </h3>
              <div className="mono" style={{ fontSize: '0.62rem', color: 'var(--ink-light)' }}>
                {aggregate ? 'Aggregated across selected inverters' : `${rawByDevice.length} inverter${rawByDevice.length === 1 ? '' : 's'}`} · scroll/pinch to zoom, drag to pan{chartType === 'timeseries' ? ', click a legend item to toggle it' : ''}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-ghost btn-sm" onClick={exportCsv}>Export CSV</button>
              <button className="btn btn-ghost btn-sm" onClick={exportPng}>Export PNG</button>
            </div>
          </div>
          {chartType === 'timeseries'
            ? <GrapherChart chartType="timeseries" datasets={tsChartConfig.datasets} scales={tsChartConfig.scales} height={420} chartRef={chartInstRef} />
            : <GrapherChart chartType="scatter" datasets={scatterChartConfig.datasets} xLabel={xMetric && `${xMetric.label}${xMetric.unit ? ` (${xMetric.unit})` : ''}`} yLabel={yMetric && `${yMetric.label}${yMetric.unit ? ` (${yMetric.unit})` : ''}`} height={420} chartRef={chartInstRef} />}
        </div>
      )}
    </div>
  );
}

Object.assign(window, { GrapherView });
