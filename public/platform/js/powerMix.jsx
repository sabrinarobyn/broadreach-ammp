/* ============================================================
   Broadreach Platform — Power Mix chart and Daily PR chart, both
   fed from AMMP's asset-level historic-* endpoints via the signed-in
   user's token (js/ammp.jsx). Chart.js (CDN, see index.html) renders
   both — the existing hand-rolled SVG charts don't cover dual-axis
   multi-series.
   ============================================================ */

function pmIsoDate(d) { return d.toISOString().slice(0, 10); }

/* Internal canonical name -> real AMMP field name. Confirmed against a live account:
   power fields are declared in Watts ("unit":"W" on each field) and grid import/export
   already come pre-split (power_from_grid / power_to_grid) rather than a single net
   field — kept as fallback keys in case another account's asset returns those instead. */
const POWER_FIELD_MAP = {
  pv_power: 'pv_power',
  load_power: 'consumption_power',
  batt_charge_power: 'battery_charge_power',
  batt_discharge_power: 'battery_discharge_power',
  genset_power: 'genset_power',
  grid_power: 'grid_power',
  import_power: 'power_from_grid',
  export_power: 'power_to_grid',
};
const BATT_FIELD_MAP = { batt_soc: 'soc' };
const ENV_FIELD_MAP = { poa_irradiance: 'irradiance' };

/* Builds {internalName: Map(timestamp -> value)}, reading each field's real AMMP key
   and scaling by that field's own declared unit (W/Wh -> kilo-) so callers always see
   kW/kWh regardless of which base unit this account happens to report in. */
function seriesMaps(resp, fieldMap) {
  const maps = {};
  Object.keys(fieldMap).forEach((internal) => {
    const real = fieldMap[internal];
    const s = resp && resp[real];
    const arr = (s && Array.isArray(s.data)) ? s.data : [];
    const unit = s && s.unit;
    const m = new Map();
    arr.forEach((p) => { if (p && p.date) m.set(p.date, scaleByDeclaredUnit(p.value, unit)); });
    maps[internal] = m;
  });
  return maps;
}

/* power_from_grid/power_to_grid if the asset reports them separately (confirmed —
   this is the common case), else split a single net grid_power by sign (positive =
   import, negative = export) for accounts that only report one combined field. */
function resolveGridFlows(row) {
  if (row.import_power != null || row.export_power != null) {
    return { imp: Number(row.import_power) || 0, exp: Number(row.export_power) || 0 };
  }
  const net = Number(row.grid_power) || 0;
  return { imp: Math.max(0, net), exp: Math.max(0, -net) };
}

function buildAlignedRows(power, batt, env) {
  const pMaps = seriesMaps(power, POWER_FIELD_MAP);
  const bMaps = seriesMaps(batt, BATT_FIELD_MAP);
  const eMaps = seriesMaps(env, ENV_FIELD_MAP);

  // Union of every timestamp across all fetched series, not just the first
  // populated one — a fixed priority order here previously truncated the axis
  // to whichever field happened to be checked first (e.g. daylight-only PV
  // power), silently dropping real nighttime data for 24/7 series like grid,
  // load or battery.
  const tsSet = new Set();
  Object.values(pMaps).forEach((m) => m.forEach((_, ts) => tsSet.add(ts)));
  bMaps.batt_soc.forEach((_, ts) => tsSet.add(ts));
  eMaps.poa_irradiance.forEach((_, ts) => tsSet.add(ts));
  const timestamps = [...tsSet].sort();

  return timestamps.map((ts) => {
    const raw = {
      timestamp: ts,
      pv_power: pMaps.pv_power.get(ts) ?? null,
      load_power: pMaps.load_power.get(ts) ?? null,
      batt_charge_power: pMaps.batt_charge_power.get(ts) ?? null,
      batt_discharge_power: pMaps.batt_discharge_power.get(ts) ?? null,
      genset_power: pMaps.genset_power.get(ts) ?? null,
      grid_power: pMaps.grid_power.get(ts) ?? null,
      import_power: pMaps.import_power.get(ts) ?? null,
      export_power: pMaps.export_power.get(ts) ?? null,
      batt_soc: bMaps.batt_soc.get(ts) ?? null,
      poa_irradiance: eMaps.poa_irradiance.get(ts) ?? null,
    };
    const flows = resolveGridFlows(raw);
    const charge = raw.batt_charge_power;
    return { ...raw, gridImport: flows.imp, gridExport: flows.exp, battChargeNorm: charge == null ? null : (charge > 0 ? -charge : charge) };
  });
}

const POWER_MIX_SERIES_LABELS = {
  pv_power: 'PV Power',
  load_power: 'Consumption',
  gridImport: 'Grid Import',
  gridExport: 'Grid Export',
  battChargeNorm: 'Battery Charge',
  batt_discharge_power: 'Battery Discharge',
  genset_power: 'Genset',
  batt_soc: 'Battery SOC',
};

// Which plotted series are legitimately all-null across the whole range (e.g.
// a site with no genset) — surfaced as a note rather than a silently blank
// chart line.
function computeEmptySeries(rows) {
  if (!rows.length) return [];
  return Object.keys(POWER_MIX_SERIES_LABELS).filter((k) => rows.every((r) => r[k] == null));
}

async function fetchPowerMixRows(token, siteId, dateFrom, dateTo, interval) {
  const opts = { dateFrom, dateTo, interval };
  const [power, batt, env] = await Promise.all([
    fetchHistoricPower(token, siteId, opts).catch(() => null),
    fetchHistoricBatteryData(token, siteId, opts).catch(() => null),
    fetchHistoricEnvironmentData(token, siteId, opts).catch(() => null),
  ]);
  return buildAlignedRows(power, batt, env);
}

/* Some accounts/hardware only report power at hourly resolution — requesting 15m
   from those returns an empty series rather than an error. Try 15m first (finer,
   preferred); if empty, retry at 1h before giving up. */
function usePowerMix(site, from, to) {
  const ammp = useAmmp();
  const [state, setState] = React.useState({ status: 'loading', rows: [], interval: '15m' });
  React.useEffect(() => {
    if (!site) return;
    let cancelled = false;
    setState({ status: 'loading', rows: [], interval: '15m' });
    (async () => {
      try {
        const dateFrom = new Date(from + 'T00:00:00Z').toISOString();
        const dateTo = new Date(to + 'T23:59:59Z').toISOString();
        let rows = await fetchPowerMixRows(ammp.token, site.id, dateFrom, dateTo, '15m');
        let interval = '15m';
        if (!rows.length) {
          rows = await fetchPowerMixRows(ammp.token, site.id, dateFrom, dateTo, '1h');
          interval = '1h';
        }
        if (cancelled) return;
        setState(rows.length
          ? { status: 'ready', rows, interval, emptySeries: computeEmptySeries(rows) }
          : { status: 'empty', rows: [], interval });
      } catch (e) {
        if (!cancelled) setState({ status: 'error', error: e.message, rows: [], interval: '15m' });
      }
    })();
    return () => { cancelled = true; };
  }, [site && site.id, ammp.token, from, to]);
  return state;
}

function PowerMixChart({ rows, height = 380 }) {
  const canvasRef = React.useRef(null);
  const chartRef = React.useRef(null);

  React.useEffect(() => {
    if (!canvasRef.current || typeof Chart === 'undefined') return;
    const labels = rows.map((r) => formatSAST(r.timestamp));
    const line = (key, label, color, extra) => ({
      label, data: rows.map((r) => r[key]), borderColor: color, backgroundColor: color + '33',
      yAxisID: 'y', tension: 0.25, pointRadius: 0, borderWidth: 1.8, spanGaps: true, fill: false, ...extra,
    });
    const datasets = [
      line('pv_power', 'PV Power [kW]', '#F5C842', { fill: true }),
      line('load_power', 'Consumption [kW]', '#4CAF50'),
      line('gridImport', 'External Power (Grid Import) [kW]', '#FF7043'),
      line('gridExport', 'Power to Grid (Export) [kW]', '#8D6E63', { borderDash: [4, 2] }),
      line('battChargeNorm', 'Battery Charge Power [kW]', '#90CAF9', { fill: true }),
      line('batt_discharge_power', 'Battery Discharge Power [kW]', '#1565C0'),
      line('genset_power', 'Genset Power [kW]', '#CE93D8'),
      { label: 'Battery SOC [%]', data: rows.map((r) => r.batt_soc), borderColor: '#42A5F5', borderDash: [6, 3], borderWidth: 1.6, yAxisID: 'y1', tension: 0.25, pointRadius: 0, fill: false, spanGaps: true },
    ];

    if (chartRef.current) chartRef.current.destroy();
    chartRef.current = new Chart(canvasRef.current, {
      type: 'line',
      data: { labels, datasets },
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        scales: {
          y: { position: 'left', title: { display: true, text: 'Power [kW]' } },
          y1: { position: 'right', min: 0, max: 100, title: { display: true, text: 'SOC [%]' }, grid: { drawOnChartArea: false } },
        },
        plugins: { legend: { position: 'right', labels: { boxWidth: 10, font: { size: 10 } } } },
      },
    });
    return () => { if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; } };
  }, [rows]);

  return <div style={{ height }}><canvas ref={canvasRef}></canvas></div>;
}

function PowerMixSection({ site, from, to, setFrom, setTo, powerMix }) {
  const { status, rows, error, interval, emptySeries } = powerMix;
  return (
    <div className="card" style={{ padding: 16, marginBottom: 'var(--gap)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 10 }}>
        <div>
          <h3 style={{ fontSize: '0.92rem', fontWeight: 700, margin: 0 }}>Power Mix</h3>
          <div className="mono" style={{ fontSize: '0.6rem', color: 'var(--ink-light)', marginTop: 2 }}>PV, consumption, grid, battery &amp; genset — {interval === '1h' ? 'hourly' : '15-minute'} interval</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input type="date" className="fld" value={from} onChange={(e) => setFrom(e.target.value)} style={{ fontSize: '0.72rem' }} />
          <span className="mono" style={{ color: 'var(--ink-light)', fontSize: '0.7rem' }}>→</span>
          <input type="date" className="fld" value={to} onChange={(e) => setTo(e.target.value)} style={{ fontSize: '0.72rem' }} />
        </div>
      </div>
      {status === 'loading' && <Loading label="Loading power mix…" />}
      {status === 'error' && <ErrorNote message={error} />}
      {status === 'empty' && <EmptyState title="No power data for this range." />}
      {status === 'ready' && (
        <>
          <PowerMixChart rows={rows} />
          {emptySeries && emptySeries.length > 0 && (
            <div className="mono" style={{ fontSize: '0.62rem', color: 'var(--ink-light)', marginTop: 8 }}>
              No data for this range: {emptySeries.map((k) => POWER_MIX_SERIES_LABELS[k]).join(', ')}.
            </div>
          )}
        </>
      )}
    </div>
  );
}


/* ---------------- Daily PR (Fix 12) ---------------- */
function useDailyPr(site) {
  const ammp = useAmmp();
  const [state, setState] = React.useState({ status: 'loading', days: [] });
  React.useEffect(() => {
    if (!site) return;
    let cancelled = false;
    setState({ status: 'loading', days: [] });
    (async () => {
      try {
        const opts = { dateFrom: utcDateOnly(Date.now() - 29 * 86400000), dateTo: utcDateOnly(Date.now()), interval: '1d' };

        const kpiResp = await fetchHistoricKpiData(ammp.token, site.id, opts).catch(() => null);
        const kpiSeries = extractAssetSeries(kpiResp);
        const prPick = kpiSeries.find((s) => /^(performance_ratio|pr)$/i.test(s.key));
        if (prPick && prPick.points.some((p) => p.value != null)) {
          const days = prPick.points.map((p) => ({ date: p.date.slice(0, 10), pr: p.value != null ? Number(p.value) : null, approx: false }));
          if (!cancelled) setState({ status: 'ready', days });
          return;
        }

        const [energyResp, envResp] = await Promise.all([
          fetchHistoricEnergy(ammp.token, site.id, opts).catch(() => null),
          fetchHistoricEnvironmentData(ammp.token, site.id, opts).catch(() => null),
        ]);
        const energySeries = extractAssetSeries(energyResp);
        const energyPick = energySeries.find((s) => /^pv_energy$/i.test(s.key)) || energySeries[0];
        const envSeries = extractAssetSeries(envResp);
        const poaPick = envSeries.find((s) => /poa_irradiance|^irradiance$/i.test(s.key));
        const ghiPick = envSeries.find((s) => /^ghi$/i.test(s.key));
        const insolPick = envSeries.find((s) => /insolation/i.test(s.key)) || poaPick || ghiPick;
        const approx = !poaPick && !!ghiPick;

        const insolMap = {};
        (insolPick ? insolPick.points : []).forEach((p) => { if (p.value != null) insolMap[p.date.slice(0, 10)] = scaleByDeclaredUnit(Number(p.value), insolPick.unit); });
        const isWh = Object.values(insolMap).some((v) => v > 50);
        const pvKwp = site.capacityKw;

        const days = (energyPick ? energyPick.points : []).map((p) => {
          const date = p.date.slice(0, 10);
          const pvEnergy = p.value != null ? scaleByDeclaredUnit(Number(p.value), energyPick.unit) : null;
          let insol = insolMap[date];
          if (insol != null && isWh) insol = insol / 1000;
          const pr = (pvEnergy != null && insol > 0 && pvKwp > 0) ? (pvEnergy / (insol * pvKwp)) * 100 : null;
          return { date, pr, approx };
        });
        if (!cancelled) setState({ status: days.length ? 'ready' : 'empty', days });
      } catch (e) {
        if (!cancelled) setState({ status: 'error', error: e.message, days: [] });
      }
    })();
    return () => { cancelled = true; };
  }, [site && site.id, site && site.capacityKw, ammp.token]);
  return state;
}

function DailyPRChart({ days, targetPr, height = 260 }) {
  const canvasRef = React.useRef(null);
  const chartRef = React.useRef(null);
  React.useEffect(() => {
    if (!canvasRef.current || typeof Chart === 'undefined') return;
    const colors = days.map((d) => d.pr == null ? 'rgba(200,200,200,0.4)' : d.pr >= targetPr ? 'rgba(76,175,80,0.7)' : d.pr >= targetPr - 10 ? 'rgba(255,193,7,0.7)' : 'rgba(244,67,54,0.7)');
    if (chartRef.current) chartRef.current.destroy();
    chartRef.current = new Chart(canvasRef.current, {
      data: {
        labels: days.map((d) => d.date),
        datasets: [
          { type: 'bar', label: 'Daily PR [%]', data: days.map((d) => d.pr), backgroundColor: colors, borderRadius: 3 },
          { type: 'line', label: `Target PR ${targetPr}%`, data: days.map(() => targetPr), borderColor: '#5C8098', borderDash: [6, 3], borderWidth: 1.5, pointRadius: 0, fill: false },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        scales: { y: { min: 0, max: 100, title: { display: true, text: 'PR [%]' } }, x: { title: { display: true, text: 'Date' } } },
        plugins: {
          tooltip: {
            callbacks: {
              label: (ctx) => {
                if (ctx.dataset.type === 'line') return `Target: ${targetPr}%`;
                const d = days[ctx.dataIndex];
                return `PR: ${d.pr != null ? (d.approx ? '~' : '') + d.pr.toFixed(1) : '—'}%`;
              },
            },
          },
        },
      },
    });
    return () => { if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; } };
  }, [days, targetPr]);
  return <div style={{ height }}><canvas ref={canvasRef}></canvas></div>;
}

function DailyPrSection({ site }) {
  const { status, days, error } = useDailyPr(site);
  const expected = site.detail ? findField(site.detail, /expected_pr/i) : null;
  const targetPr = expected && isFinite(Number(expected.value)) ? Number(expected.value) : 75;
  return (
    <div className="card" style={{ padding: 16, marginBottom: 'var(--gap)' }}>
      <h3 style={{ fontSize: '0.92rem', fontWeight: 700, margin: '0 0 10px' }}>Daily Performance Ratio <span className="mono" style={{ fontWeight: 400, fontSize: '0.6rem', color: 'var(--ink-light)' }}>· trailing 30 days</span></h3>
      {status === 'loading' && <Loading label="Loading PR…" />}
      {status === 'error' && <ErrorNote message={error} />}
      {status === 'empty' && <EmptyState title="No PR data for this range." />}
      {status === 'ready' && <DailyPRChart days={days} targetPr={targetPr} />}
    </div>
  );
}

Object.assign(window, {
  pmIsoDate, usePowerMix, PowerMixChart, PowerMixSection,
  useDailyPr, DailyPRChart, DailyPrSection,
});
