/* ============================================================
   Broadreach Platform — AMMP Data API integration
   Same-origin proxy conventions as ../index.html:
   POST /auth/token (x-api-key -> access_token), then
   GET/POST /proxy/v1/... with Authorization: Bearer <token>.
   The API key lives in sessionStorage only, shared with ../index.html
   in this tab.

   This is the ONLY data source for the Platform — there is no seeded
   or fallback dataset anywhere. Every exported value here traces to a
   real https://data-api.ammp.io response. Several endpoints' exact
   field names aren't confirmed (no sample responses were available
   while building this), so series/detail extraction is shape-driven
   (look for "does this look like a series/number/timestamp", not
   "does key X exist") rather than guessing specific key names. Set
   window.AMMP_DEBUG = true in devtools to log each response's own
   top-level keys the first time an endpoint is hit, to sharpen the
   humanizeKey() alias list once real shapes are confirmed.
   ============================================================ */

const KEY_STORE = 'ammpKey';

/* ---------------- low-level fetch ---------------- */

function qs(params) {
  return Object.entries(params || {})
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('&');
}

async function apiGet(token, path) {
  const r = await fetch(`/proxy/${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) {
    const txt = await r.text().catch(() => '');
    throw new Error(`${path.split('?')[0]} failed (${r.status})${txt ? `: ${txt.slice(0, 200)}` : ''}`);
  }
  const json = await r.json();
  if (typeof window !== 'undefined' && window.AMMP_DEBUG) console.debug('[AMMP]', path, Object.keys(json || {}));
  return json;
}

async function apiPost(token, path, body) {
  const r = await fetch(`/proxy/${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  });
  if (!r.ok) {
    const txt = await r.text().catch(() => '');
    throw new Error(`${path.split('?')[0]} failed (${r.status})${txt ? `: ${txt.slice(0, 200)}` : ''}`);
  }
  const json = await r.json();
  if (typeof window !== 'undefined' && window.AMMP_DEBUG) console.debug('[AMMP]', path, Object.keys(json || {}));
  return json;
}

async function authenticate(apiKey) {
  const r = await fetch('/auth/token', { method: 'POST', headers: { 'x-api-key': apiKey } });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d.access_token) {
    throw new Error(r.status === 401 || r.status === 403 ? 'That key was rejected by AMMP.' : `Sign-in failed (${r.status}).`);
  }
  return d.access_token;
}

/* ---------------- asset-level endpoints ---------------- */

async function fetchAssets(token) { return apiGet(token, 'v1/assets'); }
async function fetchAssetDetail(token, assetId) { return apiGet(token, `v1/assets/${assetId}`); }

async function fetchAssetDevices(token, assetId, { includeVirtual } = {}) {
  const q = qs({ include_virtual: includeVirtual });
  const d = await apiGet(token, `v1/assets/${assetId}/devices${q ? `?${q}` : ''}`);
  return (d && d.devices) || [];
}

async function fetchMostRecent(token, assetId, lookbackSeconds) {
  const q = qs({ lookback_seconds: lookbackSeconds });
  return apiGet(token, `v1/assets/${assetId}/most-recent${q ? `?${q}` : ''}`);
}

async function fetchLastDataReceived(token, assetId) { return apiGet(token, `v1/assets/${assetId}/last-data-received`); }
async function fetchStatusInfoLatest(token, assetId) { return apiGet(token, `v1/assets/${assetId}/status-info-latest`); }

function assetHistoricUrl(assetId, endpoint, { dateFrom, dateTo, interval, dataProvider } = {}) {
  const q = qs({ date_from: dateFrom, date_to: dateTo, interval, data_provider: dataProvider });
  return `v1/assets/${assetId}/${endpoint}${q ? `?${q}` : ''}`;
}

async function fetchHistoricEnergy(token, assetId, opts) { return apiGet(token, assetHistoricUrl(assetId, 'historic-energy', opts)); }
async function fetchHistoricPower(token, assetId, opts) { return apiGet(token, assetHistoricUrl(assetId, 'historic-power', opts)); }
async function fetchHistoricBatteryData(token, assetId, opts) { return apiGet(token, assetHistoricUrl(assetId, 'historic-battery-data', opts)); }
async function fetchHistoricEnvironmentData(token, assetId, opts) { return apiGet(token, assetHistoricUrl(assetId, 'historic-environment-data', opts)); }
async function fetchHistoricKpiData(token, assetId, opts) { return apiGet(token, assetHistoricUrl(assetId, 'historic-kpi-data', opts)); }
async function fetchPvPerformanceKpis(token, assetId, opts) { return apiGet(token, assetHistoricUrl(assetId, 'technical-kpis/pv-performance', opts)); }
async function fetchPvYieldLosses(token, assetId, opts) { return apiGet(token, assetHistoricUrl(assetId, 'technical-kpis/pv-yield-losses', opts)); }
async function fetchFinancialImpact(token, assetId, opts) { return apiGet(token, assetHistoricUrl(assetId, 'commercial-kpis/financial-impact', opts)); }
async function fetchEnvironmentalImpact(token, assetId, opts) { return apiGet(token, assetHistoricUrl(assetId, 'commercial-kpis/environmental-impact', opts)); }

/* ---------------- device-level endpoints (5m/15m only) ---------------- */

function deviceHistoricUrl(deviceId, endpoint, { dateFrom, dateTo, interval } = {}) {
  const q = qs({ date_from: dateFrom, date_to: dateTo, interval });
  return `v1/devices/${deviceId}/${endpoint}${q ? `?${q}` : ''}`;
}

async function fetchInverterHistoric(token, deviceId, opts) { return apiGet(token, deviceHistoricUrl(deviceId, 'historic-data/pv-inverter', opts)); }
async function fetchDeviceHistoricBattery(token, deviceId, opts) { return apiGet(token, deviceHistoricUrl(deviceId, 'historic-data/battery-system', opts)); }
async function fetchDeviceHistoricMeter(token, deviceId, opts) { return apiGet(token, deviceHistoricUrl(deviceId, 'historic-data/meter', opts)); }

/* ---------------- tickets ---------------- */

async function postTicketsList(token, filters) { return apiPost(token, 'v1/tickets/list', filters || {}); }

/* ---------------- device type matching (only pv_inverter is a confirmed exact string) ---------------- */

function matchesDeviceType(device, deviceType) {
  if (deviceType == null) return true;
  const t = (device && device.device_type) || '';
  return deviceType instanceof RegExp ? deviceType.test(t) : t === deviceType;
}
const DEVICE_TYPE = { INVERTER: 'pv_inverter', BATTERY: /batt/i, METER: /meter/i };

/* ---------------- date-range chunking (device endpoints: max 7 days at 5m/15m) ---------------- */

const MS_PER_DAY = 86400000;

function chunkDateRange(fromIso, toIso, maxDays) {
  const chunks = [];
  let cur = new Date(fromIso);
  const end = new Date(toIso);
  if (!(cur < end)) return [{ dateFrom: fromIso, dateTo: toIso }];
  while (cur < end) {
    const chunkEnd = new Date(Math.min(cur.getTime() + maxDays * MS_PER_DAY - 1000, end.getTime()));
    chunks.push({ dateFrom: cur.toISOString(), dateTo: chunkEnd.toISOString() });
    cur = new Date(chunkEnd.getTime() + 1000);
  }
  return chunks;
}

function mergeSeriesResponses(a, b) {
  if (!a) return b;
  if (!b) return a;
  const out = { ...a };
  Object.keys(b).forEach((k) => {
    const bv = b[k];
    if (bv && Array.isArray(bv.data)) {
      const av = out[k] && Array.isArray(out[k].data) ? out[k] : { ...bv, data: [] };
      out[k] = { ...av, data: [...av.data, ...bv.data] };
    } else if (bv && Array.isArray(bv.datasets)) {
      const avDatasets = (out[k] && Array.isArray(out[k].datasets) ? out[k].datasets : bv.datasets.map((ds) => ({ ...ds, data: [] })));
      out[k] = { ...bv, datasets: avDatasets.map((ds, i) => ({ ...ds, data: [...(ds.data || []), ...((bv.datasets[i] && bv.datasets[i].data) || [])] })) };
    } else {
      out[k] = bv;
    }
  });
  return out;
}

async function fetchChunked(fetchFn, token, id, fromIso, toIso, interval, maxDays = 7) {
  const chunks = chunkDateRange(fromIso, toIso, maxDays);
  let merged = null;
  for (const c of chunks) {
    const resp = await fetchFn(token, id, { dateFrom: c.dateFrom, dateTo: c.dateTo, interval });
    merged = mergeSeriesResponses(merged, resp);
  }
  return merged;
}

/* ---------------- generic, shape-driven extraction ---------------- */
/* Device-level metrics nest as resp[key] = { datasets: [{ data: [{date,value},...] }] } —
   confirmed via pv_inverter_ac_P_total / pv_inverter_temp. Asset-level metrics nest as
   resp[key] = { data: [{date,value},...] } directly, per the API brief. Both extractors
   walk the response's own keys rather than assuming a specific key exists. */

function isDeviceSeriesValue(v) { return !!(v && Array.isArray(v.datasets) && v.datasets[0] && Array.isArray(v.datasets[0].data)); }
function isAssetSeriesValue(v) { return !!(v && Array.isArray(v.data)); }

function extractDeviceSeries(resp) {
  if (!resp || typeof resp !== 'object') return [];
  return Object.keys(resp).filter((k) => isDeviceSeriesValue(resp[k])).map((k) => ({
    key: k, label: humanizeKey(k), points: resp[k].datasets[0].data,
  }));
}

function extractAssetSeries(resp) {
  if (!resp || typeof resp !== 'object') return [];
  if (Array.isArray(resp.data)) return [{ key: 'value', label: 'Value', points: resp.data }];
  return Object.keys(resp).filter((k) => isAssetSeriesValue(resp[k])).map((k) => ({
    key: k, label: humanizeKey(k), points: resp[k].data,
  }));
}

const WORD_ALIASES = {
  soc: 'SOC', soh: 'SOH', co2: 'CO₂', pr: 'PR', kwh: 'kWh', kwp: 'kWp', kw: 'kW',
  ppa: 'PPA', ac: 'AC', dc: 'DC', temp: 'Temp', pv: 'PV', v: 'V', a: 'A', id: 'ID',
};
function humanizeKey(key) {
  const words = String(key).replace(/([a-z0-9])([A-Z])/g, '$1 $2').split(/[_\s]+/).filter(Boolean);
  return words.map((w) => WORD_ALIASES[w.toLowerCase()] || (w[0].toUpperCase() + w.slice(1).toLowerCase())).join(' ');
}

/* Shallow search for a key matching `pattern` with a scalar value — used against
   asset-detail / most-recent / last-data-received / status-info responses whose
   exact schema isn't confirmed. Never returns a fabricated value; only a real one
   found under a plausibly-named key, or null. */
function findField(obj, pattern, { maxDepth = 2 } = {}) {
  if (!obj || typeof obj !== 'object') return null;
  const queue = [{ o: obj, depth: 0 }];
  while (queue.length) {
    const { o, depth } = queue.shift();
    for (const k of Object.keys(o)) {
      const v = o[k];
      if (pattern.test(k) && (typeof v === 'number' || (typeof v === 'string' && v !== ''))) return { key: k, value: v };
    }
    if (depth < maxDepth) {
      for (const k of Object.keys(o)) {
        const v = o[k];
        if (v && typeof v === 'object' && !Array.isArray(v)) queue.push({ o: v, depth: depth + 1 });
      }
    }
  }
  return null;
}

function extractCapacityKw(detail) {
  const f = findField(detail, /capacity|kwp|kw_dc|installed/i);
  return f ? { value: Number(f.value), key: f.key } : null;
}
function extractLocation(detail) {
  const parts = [];
  for (const name of ['town', 'city', 'municipality', 'district', 'region', 'province', 'state', 'area']) {
    const f = findField(detail, new RegExp(`^${name}$`, 'i'), { maxDepth: 1 });
    if (f) { parts.push(f.value); break; }
  }
  for (const name of ['country', 'country_name', 'country_code']) {
    const f = findField(detail, new RegExp(`^${name}$`, 'i'), { maxDepth: 1 });
    if (f) { parts.push(f.value); break; }
  }
  return parts.length ? parts.join(', ') : null;
}
function extractCoords(detail) {
  const lat = findField(detail, /^lat(itude)?$/i);
  const lng = findField(detail, /^(lon|lng|longitude)$/i);
  const latN = lat && Number(lat.value), lngN = lng && Number(lng.value);
  return (lat && lng && isFinite(latN) && isFinite(lngN)) ? { lat: latN, lng: lngN } : null;
}

function derivePowerKw(mostRecentResp) {
  if (!mostRecentResp) return null;
  const f = findField(mostRecentResp, /power/i);
  if (f) return Number(f.value);
  const series = extractAssetSeries(mostRecentResp);
  if (series.length && series[0].points.length) return Number(series[0].points[series[0].points.length - 1].value);
  return null;
}
function deriveHasAlerts(statusInfoResp) {
  if (!statusInfoResp) return false;
  return Object.keys(statusInfoResp).some((k) => Array.isArray(statusInfoResp[k]) && statusInfoResp[k].length > 0);
}
function deriveStale(lastDataReceivedResp, staleMs = 2 * 3600 * 1000) {
  if (!lastDataReceivedResp) return true;
  const f = findField(lastDataReceivedResp, /time|date|received|timestamp/i);
  if (!f) return true;
  const t = new Date(f.value).getTime();
  return !isFinite(t) || (Date.now() - t) > staleMs;
}
/* The 4 real, derivable states — replaces an earlier invented 7-state enum
   (production/issues/weather/throttling/export/shedding) that had no single
   confirmed AMMP source. */
function deriveStatus({ powerKw, hasAlerts, stale }) {
  if (stale) return 'unknown';
  if (hasAlerts) return 'alert';
  if (powerKw != null) return powerKw > 0 ? 'producing' : 'none';
  return 'unknown';
}

function toSite(asset) {
  return {
    id: asset.asset_id || asset.id,
    name: asset.asset_name || asset.name || asset.long_name || String(asset.asset_id || asset.id),
    raw: asset,
    status: 'unknown',
  };
}

async function mapWithConcurrency(items, limit, fn) {
  const results = new Array(items.length);
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await fn(items[idx], idx);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

/* ---------------- React context ---------------- */

const AmmpContext = React.createContext(null);
function useAmmp() { return React.useContext(AmmpContext); }

function AmmpProvider({ children }) {
  const [live, setLive] = React.useState(false);
  const [connecting, setConnecting] = React.useState(false);
  const [portfolioLoading, setPortfolioLoading] = React.useState(false);
  const [error, setError] = React.useState(null);
  const [token, setToken] = React.useState(null);
  const [assets, setAssets] = React.useState([]);
  const [sites, setSites] = React.useState([]);
  const devicesCacheRef = React.useRef(new Map());

  const enrichSites = React.useCallback(async (tok, baseSites) => {
    setPortfolioLoading(true);
    const enriched = await mapWithConcurrency(baseSites, 8, async (site) => {
      const [detail, mostRecent, lastData, statusInfo] = await Promise.all([
        fetchAssetDetail(tok, site.id).catch(() => null),
        fetchMostRecent(tok, site.id, 3600).catch(() => null),
        fetchLastDataReceived(tok, site.id).catch(() => null),
        fetchStatusInfoLatest(tok, site.id).catch(() => null),
      ]);
      const capacity = detail ? extractCapacityKw(detail) : null;
      const powerKw = derivePowerKw(mostRecent);
      const hasAlerts = deriveHasAlerts(statusInfo);
      const lastDataField = findField(lastData, /time|date|received|timestamp/i);
      const stale = deriveStale(lastData);
      return {
        ...site,
        detail,
        capacityKw: capacity ? capacity.value : null,
        location: detail ? extractLocation(detail) : null,
        coords: detail ? extractCoords(detail) : null,
        powerKw,
        hasAlerts,
        lastDataAt: lastDataField ? lastDataField.value : null,
        status: deriveStatus({ powerKw, hasAlerts, stale }),
      };
    });
    setSites(enriched);
    setPortfolioLoading(false);
  }, []);

  const connect = React.useCallback(async (apiKey) => {
    setConnecting(true); setError(null);
    try {
      const tok = await authenticate(apiKey);
      const rawAssets = await fetchAssets(tok);
      const baseSites = rawAssets.map(toSite);
      sessionStorage.setItem(KEY_STORE, apiKey);
      setToken(tok);
      setAssets(rawAssets);
      setSites(baseSites);
      devicesCacheRef.current = new Map();
      setLive(true);
      enrichSites(tok, baseSites);
      return true;
    } catch (e) {
      sessionStorage.removeItem(KEY_STORE);
      setError(e.message || 'Could not connect to AMMP.');
      setLive(false);
      return false;
    } finally {
      setConnecting(false);
    }
  }, [enrichSites]);

  const disconnect = React.useCallback(() => {
    sessionStorage.removeItem(KEY_STORE);
    setToken(null); setAssets([]); setSites([]); setLive(false); setPortfolioLoading(false);
    devicesCacheRef.current = new Map();
  }, []);

  React.useEffect(() => {
    const stored = sessionStorage.getItem(KEY_STORE);
    if (stored) connect(stored);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const devicesFor = React.useCallback((assetId, deviceType) => {
    if (!devicesCacheRef.current.has(assetId)) {
      devicesCacheRef.current.set(assetId, fetchAssetDevices(token, assetId));
    }
    return devicesCacheRef.current.get(assetId).then((list) => (deviceType ? list.filter((d) => matchesDeviceType(d, deviceType)) : list));
  }, [token]);

  const inverterSeriesFor = React.useCallback(async (deviceId, dateFromIso, dateToIso, days) => {
    const merged = await fetchChunked(fetchInverterHistoric, token, deviceId, dateFromIso, dateToIso, '15m', 7);
    return toInverterSeries(merged, days);
  }, [token]);

  const value = {
    live, connecting, portfolioLoading, error, token, assets, sites,
    connect, disconnect, devicesFor, inverterSeriesFor,
  };

  return <AmmpContext.Provider value={value}>{children}</AmmpContext.Provider>;
}

/* Maps a (possibly chunk-merged) pv-inverter historic-data response into a chart-ready
   series. Only power + temperature are confirmed available from this endpoint —
   current/voltage/per-string stay absent (not zeroed/faked) so callers can hide those
   affordances rather than plot fabricated flat lines. */
function toInverterSeries(data, days) {
  const powerSeries = (data && data.pv_inverter_ac_P_total && data.pv_inverter_ac_P_total.datasets && data.pv_inverter_ac_P_total.datasets[0] && data.pv_inverter_ac_P_total.datasets[0].data) || [];
  const tempSeries = (data && data.pv_inverter_temp && data.pv_inverter_temp.datasets && data.pv_inverter_temp.datasets[0] && data.pv_inverter_temp.datasets[0].data) || [];
  const tMap = {};
  tempSeries.forEach((d) => { if (d.value != null) tMap[d.date] = d.value; });

  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const pad2 = (n) => (n < 10 ? '0' : '') + n;

  let pkPower = 0, pkTemp = -Infinity, loTemp = Infinity, energyKwh = 0, prevMs = null;
  const pts = powerSeries.filter((d) => d.value != null).map((d) => {
    const dt = new Date(d.date);
    const power = +(d.value / 1000).toFixed(2);
    const hasTemp = tMap[d.date] != null;
    const temp = hasTemp ? +tMap[d.date].toFixed(1) : null;
    pkPower = Math.max(pkPower, power);
    if (hasTemp) { pkTemp = Math.max(pkTemp, temp); loTemp = Math.min(loTemp, temp); }
    const ms = dt.getTime();
    if (prevMs != null) energyKwh += power * ((ms - prevMs) / 3600000);
    prevMs = ms;
    return {
      m: ms, power, temp, hasTemp, current: null, voltage: null, strings: null,
      label: `${dt.getDate()} ${MON[dt.getMonth()]}, ${pad2(dt.getHours())}:${pad2(dt.getMinutes())}`,
      short: days <= 1 ? `${pad2(dt.getHours())}:${pad2(dt.getMinutes())}` : `${dt.getDate()} ${MON[dt.getMonth()]}`,
    };
  });

  return {
    pts,
    peakPower: +pkPower.toFixed(1),
    peakTemp: pkTemp === -Infinity ? null : +pkTemp.toFixed(1),
    minTemp: loTemp === Infinity ? null : +loTemp.toFixed(1),
    energyKwh: Math.round(energyKwh),
    nStrings: 0, degradedString: -1,
    real: true,
  };
}

Object.assign(window, {
  AmmpProvider, useAmmp, AmmpContext, AMMP_KEY_STORE: KEY_STORE,
  authenticate, fetchAssets, fetchAssetDetail, fetchAssetDevices, fetchMostRecent,
  fetchLastDataReceived, fetchStatusInfoLatest, fetchHistoricEnergy, fetchHistoricPower,
  fetchHistoricBatteryData, fetchHistoricEnvironmentData, fetchHistoricKpiData,
  fetchPvPerformanceKpis, fetchPvYieldLosses, fetchFinancialImpact, fetchEnvironmentalImpact,
  fetchInverterHistoric, fetchDeviceHistoricBattery, fetchDeviceHistoricMeter,
  postTicketsList, matchesDeviceType, DEVICE_TYPE,
  chunkDateRange, mergeSeriesResponses, fetchChunked,
  extractDeviceSeries, extractAssetSeries, humanizeKey, findField,
  extractCapacityKw, extractLocation, extractCoords,
  derivePowerKw, deriveHasAlerts, deriveStale, deriveStatus, toSite, toInverterSeries,
});
