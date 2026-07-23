/* ============================================================
   Broadreach Platform — Power Mix chart, Data Sheet, Daily PR,
   environment summary. All fed from AMMP's asset-level historic-*
   endpoints via the signed-in user's token (js/ammp.jsx). Chart.js
   (CDN, see index.html) renders the two charts — the existing
   hand-rolled SVG charts don't cover dual-axis multi-series.
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

  const axisKey = Object.keys(POWER_FIELD_MAP).find((k) => pMaps[k].size > 0);
  let timestamps = [];
  if (axisKey) timestamps = [...pMaps[axisKey].keys()];
  else if (bMaps.batt_soc.size) timestamps = [...bMaps.batt_soc.keys()];
  else if (eMaps.poa_irradiance.size) timestamps = [...eMaps.poa_irradiance.keys()];
  timestamps.sort();

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

function usePowerMix(site, from, to) {
  const ammp = useAmmp();
  const [state, setState] = React.useState({ status: 'loading', rows: [] });
  React.useEffect(() => {
    if (!site) return;
    let cancelled = false;
    setState({ status: 'loading', rows: [] });
    (async () => {
      try {
        const opts = { dateFrom: new Date(from + 'T00:00:00Z').toISOString(), dateTo: new Date(to + 'T23:59:59Z').toISOString(), interval: '15m' };
        const [power, batt, env] = await Promise.all([
          fetchHistoricPower(ammp.token, site.id, opts).catch(() => null),
          fetchHistoricBatteryData(ammp.token, site.id, opts).catch(() => null),
          fetchHistoricEnvironmentData(ammp.token, site.id, opts).catch(() => null),
        ]);
        if (cancelled) return;
        const rows = buildAlignedRows(power, batt, env);
        setState(rows.length ? { status: 'ready', rows } : { status: 'empty', rows: [] });
      } catch (e) {
        if (!cancelled) setState({ status: 'error', error: e.message, rows: [] });
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
  const { status, rows, error } = powerMix;
  return (
    <div className="card" style={{ padding: 16, marginBottom: 'var(--gap)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 10 }}>
        <div>
          <h3 style={{ fontSize: '0.92rem', fontWeight: 700, margin: 0 }}>Power Mix</h3>
          <div className="mono" style={{ fontSize: '0.6rem', color: 'var(--ink-light)', marginTop: 2 }}>PV, consumption, grid, battery &amp; genset — 15-minute interval</div>
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
      {status === 'ready' && <PowerMixChart rows={rows} />}
    </div>
  );
}

/* ---------------- Data Sheet (Fix 9) — same aligned rows as the chart ---------------- */
function fmtNum(v) { return v == null ? '—' : Number(v).toFixed(1); }

function SiteDataSheet({ status, rows }) {
  if (status === 'loading') return <Loading label="Loading data sheet…" />;
  if (status !== 'ready' || !rows.length) return null;
  const MAX_ROWS = 500;
  const shown = rows.length > MAX_ROWS ? rows.slice(-MAX_ROWS) : rows;
  const cols = ['Timestamp', 'PV Power (kW)', 'Consumption (kW)', 'Ext. Power (kW)', 'To Grid (kW)', 'Batt SOC (%)', 'Batt Charge (kW)', 'Batt Discharge (kW)', 'Genset (kW)', 'Irradiance (W/m²)'];
  return (
    <div className="card" style={{ marginBottom: 'var(--gap)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '14px 18px 8px' }}>
        <h3 className="display" style={{ fontSize: '1.05rem', color: 'var(--br-dker)', letterSpacing: '0.6px', margin: 0 }}>Data Sheet</h3>
        {rows.length > MAX_ROWS && <span className="mono" style={{ fontSize: '0.6rem', color: 'var(--ink-light)' }}>showing most recent {MAX_ROWS} of {rows.length} intervals</span>}
      </div>
      <div className="scroll" style={{ overflow: 'auto', maxHeight: 360, padding: '0 18px 14px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.7rem', minWidth: 920 }}>
          <thead>
            <tr>
              {cols.map((h, i) => (
                <th key={h} style={{ background: 'var(--grey-xlt)', color: 'var(--ink-mid)', padding: '6px 10px', textAlign: i === 0 ? 'left' : 'right', fontSize: '0.58rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.3px', position: 'sticky', top: 0, whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.timestamp}>
                <td className="mono" style={{ padding: '5px 10px', borderBottom: '1px solid var(--line)', whiteSpace: 'nowrap' }}>{formatSAST(r.timestamp)}</td>
                <td className="mono" style={{ padding: '5px 10px', borderBottom: '1px solid var(--line)', textAlign: 'right' }}>{fmtNum(r.pv_power)}</td>
                <td className="mono" style={{ padding: '5px 10px', borderBottom: '1px solid var(--line)', textAlign: 'right' }}>{fmtNum(r.load_power)}</td>
                <td className="mono" style={{ padding: '5px 10px', borderBottom: '1px solid var(--line)', textAlign: 'right' }}>{fmtNum(r.gridImport)}</td>
                <td className="mono" style={{ padding: '5px 10px', borderBottom: '1px solid var(--line)', textAlign: 'right' }}>{fmtNum(r.gridExport)}</td>
                <td className="mono" style={{ padding: '5px 10px', borderBottom: '1px solid var(--line)', textAlign: 'right' }}>{fmtNum(r.batt_soc)}</td>
                <td className="mono" style={{ padding: '5px 10px', borderBottom: '1px solid var(--line)', textAlign: 'right' }}>{fmtNum(r.batt_charge_power)}</td>
                <td className="mono" style={{ padding: '5px 10px', borderBottom: '1px solid var(--line)', textAlign: 'right' }}>{fmtNum(r.batt_discharge_power)}</td>
                <td className="mono" style={{ padding: '5px 10px', borderBottom: '1px solid var(--line)', textAlign: 'right' }}>{fmtNum(r.genset_power)}</td>
                <td className="mono" style={{ padding: '5px 10px', borderBottom: '1px solid var(--line)', textAlign: 'right' }}>{fmtNum(r.poa_irradiance)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
        const to = new Date();
        const from = new Date(to.getTime() - 29 * 86400000);
        const opts = { dateFrom: from.toISOString(), dateTo: to.toISOString(), interval: '1d' };

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

/* ---------------- Environment summary strip (Fix 12 step 4) ---------------- */
function useEnvSummary(site) {
  const ammp = useAmmp();
  const [state, setState] = React.useState({ status: 'loading' });
  React.useEffect(() => {
    if (!site) return;
    let cancelled = false;
    setState({ status: 'loading' });
    (async () => {
      try {
        const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
        const [mostRecent, envDaily] = await Promise.all([
          fetchMostRecent(ammp.token, site.id, 3600).catch(() => null),
          fetchHistoricEnvironmentData(ammp.token, site.id, { dateFrom: todayStart.toISOString(), dateTo: new Date().toISOString(), interval: '1d' }).catch(() => null),
        ]);
        if (cancelled) return;
        const poa = extractScalar(mostRecent, 'irradiance', /irradiance/i);
        const moduleTemp = extractScalar(mostRecent, 'module_temperature', /module.*temp/i);
        const ambientTemp = extractScalar(mostRecent, 'ambient_temperature', /ambient.*temp/i);
        const envSeries = extractAssetSeries(envDaily);
        const insolPick = envSeries.find((s) => /insolation/i.test(s.key));
        let insolation = insolPick && insolPick.points.length ? scaleByDeclaredUnit(Number(insolPick.points[insolPick.points.length - 1].value), insolPick.unit) : null;
        if (insolation != null && insolation > 50) insolation = insolation / 1000;
        setState({ status: 'ready', poa, moduleTemp, ambientTemp, insolation });
      } catch (e) {
        if (!cancelled) setState({ status: 'error', error: e.message });
      }
    })();
    return () => { cancelled = true; };
  }, [site && site.id, ammp.token]);
  return state;
}

function EnvChip({ label, value, unit, warn }) {
  return (
    <div className="card" style={{ padding: '10px 14px', flex: '1 1 140px', borderTop: `3px solid ${warn ? 'var(--amb)' : 'var(--br-xlt)'}` }}>
      <div className="eyebrow">{label}</div>
      <div className="display" style={{ fontSize: '1.15rem', color: warn ? 'var(--amb-dk)' : 'var(--ink)' }}>
        {value != null ? value : '—'}{value != null && unit && <span className="mono" style={{ fontSize: '0.62rem', color: 'var(--ink-light)', marginLeft: 3 }}>{unit}</span>}
      </div>
    </div>
  );
}

function EnvSummaryStrip({ site }) {
  const s = useEnvSummary(site);
  if (s.status !== 'ready') return null;
  return (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 'var(--gap)' }}>
      <EnvChip label="POA Irradiance" value={s.poa != null ? s.poa.toFixed(0) : null} unit="W/m²" />
      <EnvChip label="Module Temp" value={s.moduleTemp != null ? s.moduleTemp.toFixed(1) : null} unit="°C" warn={s.moduleTemp != null && s.moduleTemp > 65} />
      <EnvChip label="Ambient Temp" value={s.ambientTemp != null ? s.ambientTemp.toFixed(1) : null} unit="°C" />
      <EnvChip label="Today's Insolation" value={s.insolation != null ? s.insolation.toFixed(2) : null} unit="kWh/m²" />
    </div>
  );
}

Object.assign(window, {
  pmIsoDate, usePowerMix, PowerMixChart, PowerMixSection, SiteDataSheet,
  useDailyPr, DailyPRChart, DailyPrSection, useEnvSummary, EnvSummaryStrip,
});
