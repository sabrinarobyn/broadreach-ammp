/* ============================================================
   Broadreach Platform — Grapher data logic (no React).
   Shape-driven metric discovery + alignment/aggregation, mirroring
   the conventions already used elsewhere in js/ammp.jsx and
   js/powerMix.jsx (extract whatever keys exist, don't assume a
   fixed schema; union-of-timestamps alignment rather than a fixed
   priority order). Adding a new metric "type" doesn't need changes
   here — it just needs to exist as a key in the AMMP response and,
   optionally, a pattern in GRAPHER_KIND_RULES/inferUnitForKey below
   if the defaults don't already cover it.
   ============================================================ */

/* Whether a metric should be summed or averaged across inverters when
   "aggregate across all inverters" is on — summing a power reading is
   meaningful (total output), summing a temperature/voltage/current
   reading is not. Default to 'avg' for anything unrecognized, since
   that's the safer assumption for an unknown rate/level metric. */
const GRAPHER_KIND_RULES = [
  { test: /power|_p_total$/i, kind: 'sum' },
  { test: /string/i, kind: 'sum' },
  { test: /temp/i, kind: 'avg' },
  { test: /current/i, kind: 'avg' },
  { test: /voltage/i, kind: 'avg' },
  { test: /efficiency|_pr$|ratio|soc|soh/i, kind: 'avg' },
];
function classifyMetricKind(key) {
  const rule = GRAPHER_KIND_RULES.find((r) => r.test.test(key));
  return rule ? rule.kind : 'avg';
}

/* Real device-level power/string channels on this account are confirmed in
   Watts (see js/ammp.jsx toInverterSeries) but device responses don't
   reliably carry a declared "unit" field the way asset-level ones do — fall
   back to a key-name heuristic only when no explicit unit is present. */
function inferUnitForKey(key) {
  if (/string|power|_p_total$/i.test(key)) return 'kW';
  if (/temp/i.test(key)) return '°C';
  if (/current/i.test(key)) return 'A';
  if (/voltage/i.test(key)) return 'V';
  if (/soc|soh|efficiency|ratio|_pr$/i.test(key)) return '%';
  return null;
}

function scaleDeviceValue(value, key, declaredUnit) {
  if (value == null || !isFinite(value)) return value;
  if (declaredUnit === 'W' || declaredUnit === 'Wh') return value / 1000;
  if (declaredUnit) return value;
  return /string|power|_p_total$/i.test(key) ? value / 1000 : value;
}

/* Map(timestamp -> value) for one metric key out of one device's raw
   pv-inverter historic-data response (same nested shape extractDeviceSeries
   already knows: resp[key].datasets[0].data). */
function deviceMetricMap(raw, metricKey) {
  const m = new Map();
  const s = raw && raw[metricKey];
  if (!s || !Array.isArray(s.datasets) || !s.datasets[0] || !Array.isArray(s.datasets[0].data)) return m;
  const declaredUnit = s.unit;
  s.datasets[0].data.forEach((p) => {
    if (p && p.date && p.value != null) m.set(p.date, scaleDeviceValue(p.value, metricKey, declaredUnit));
  });
  return m;
}

/* Whatever metric keys actually exist (with at least one real value) in one
   device's raw response — reuses the already-shape-driven extractDeviceSeries
   from js/ammp.jsx rather than assuming a fixed metric list. */
function discoverDeviceMetrics(rawResp) {
  return extractDeviceSeries(rawResp)
    .filter((s) => s.points.some((p) => p && p.value != null))
    .map((s) => {
      const declaredUnit = rawResp[s.key] && rawResp[s.key].unit;
      return { key: s.key, label: s.label, unit: declaredUnit || inferUnitForKey(s.key), kind: classifyMetricKind(s.key) };
    });
}

/* Union of metrics across every selected inverter's fetched response — a
   metric present on some inverters but not others still shows up once. */
function discoverMetricsAcross(rawByDevice) {
  const byKey = new Map();
  rawByDevice.forEach((d) => discoverDeviceMetrics(d.raw).forEach((m) => { if (!byKey.has(m.key)) byKey.set(m.key, m); }));
  return [...byKey.values()];
}

/* Union-of-timestamps alignment (same fix pattern as the Power Mix bug) then
   sum or average per timestamp across whichever selected inverters actually
   have a value at that timestamp. */
function alignAndAggregate(rawByDevice, metricKey, kind) {
  const maps = rawByDevice.map((d) => deviceMetricMap(d.raw, metricKey));
  const tsSet = new Set();
  maps.forEach((m) => m.forEach((_, ts) => tsSet.add(ts)));
  const timestamps = [...tsSet].sort();
  return timestamps.map((timestamp) => {
    const vals = maps.map((m) => m.get(timestamp)).filter((v) => v != null);
    let value = null;
    if (vals.length) value = kind === 'sum' ? vals.reduce((a, b) => a + b, 0) : vals.reduce((a, b) => a + b, 0) / vals.length;
    return { timestamp, value };
  });
}

/* ---- Chart.js config shaping ---- */

function grapherTsToMs(ts) { return new Date(ts).getTime(); }

/* plotted: [{ label, unit, color, points: [{timestamp,value}] }] (color/label
   already decided by the caller — this only handles Chart.js shaping: one
   y-axis per distinct unit, not capped at 2 like the old SVG charts). */
function buildTimeSeriesConfig(plotted) {
  const unitOrder = [];
  plotted.forEach((s) => { const u = s.unit || 'value'; if (!unitOrder.includes(u)) unitOrder.push(u); });
  const axisIdForUnit = (unit) => `y-${unitOrder.indexOf(unit || 'value')}`;

  const datasets = plotted.map((s) => ({
    label: s.label,
    data: s.points.filter((p) => p.value != null).map((p) => ({ x: grapherTsToMs(p.timestamp), y: p.value })),
    borderColor: s.color,
    backgroundColor: s.color + '33',
    yAxisID: axisIdForUnit(s.unit),
    tension: 0.2, pointRadius: 0, borderWidth: 1.8, spanGaps: true, fill: false,
  }));

  const scales = {
    x: { type: 'linear', ticks: { callback: (v) => formatSAST(new Date(v).toISOString()) } },
  };
  unitOrder.forEach((unit, i) => {
    scales[`y-${i}`] = {
      position: i % 2 === 0 ? 'left' : 'right',
      title: { display: true, text: unit },
      grid: { drawOnChartArea: i === 0 },
    };
  });
  return { datasets, scales };
}

/* scatterSeries: [{ label, color, xPoints, yPoints }] (both [{timestamp,value}],
   matched by shared timestamp). */
function buildScatterConfig(scatterSeries) {
  const datasets = scatterSeries.map((s) => {
    const yMap = new Map(s.yPoints.map((p) => [p.timestamp, p.value]));
    const data = s.xPoints
      .filter((p) => p.value != null && yMap.get(p.timestamp) != null)
      .map((p) => ({ x: p.value, y: yMap.get(p.timestamp) }));
    return { label: s.label, data, backgroundColor: s.color, borderColor: s.color, pointRadius: 3, showLine: false };
  });
  return { datasets };
}

/* ---- CSV export ---- */

function buildGrapherCsv(plotted) {
  const header = ['timestamp', ...plotted.map((s) => s.label)];
  const maps = plotted.map((s) => new Map(s.points.map((p) => [p.timestamp, p.value])));
  const tsSet = new Set();
  maps.forEach((m) => m.forEach((_, ts) => tsSet.add(ts)));
  const timestamps = [...tsSet].sort();
  const lines = [header.map(csvEscape).join(',')];
  timestamps.forEach((ts) => {
    const row = [ts, ...maps.map((m) => (m.has(ts) && m.get(ts) != null ? m.get(ts) : ''))];
    lines.push(row.map(csvEscape).join(','));
  });
  return lines.join('\n');
}

function buildScatterCsv(scatterSeries, xLabel, yLabel) {
  const header = ['timestamp'];
  const xMaps = [], yMaps = [];
  scatterSeries.forEach((s) => {
    header.push(`${s.label} — ${xLabel}`, `${s.label} — ${yLabel}`);
    xMaps.push(new Map(s.xPoints.map((p) => [p.timestamp, p.value])));
    yMaps.push(new Map(s.yPoints.map((p) => [p.timestamp, p.value])));
  });
  const tsSet = new Set();
  xMaps.forEach((m) => m.forEach((_, ts) => tsSet.add(ts)));
  yMaps.forEach((m) => m.forEach((_, ts) => tsSet.add(ts)));
  const timestamps = [...tsSet].sort();
  const lines = [header.map(csvEscape).join(',')];
  timestamps.forEach((ts) => {
    const row = [ts];
    xMaps.forEach((m, i) => { row.push(m.get(ts) != null ? m.get(ts) : ''); row.push(yMaps[i].get(ts) != null ? yMaps[i].get(ts) : ''); });
    lines.push(row.map(csvEscape).join(','));
  });
  return lines.join('\n');
}

Object.assign(window, {
  classifyMetricKind, inferUnitForKey, scaleDeviceValue, deviceMetricMap,
  discoverDeviceMetrics, discoverMetricsAcross, alignAndAggregate,
  buildTimeSeriesConfig, buildScatterConfig, buildGrapherCsv, buildScatterCsv,
});
