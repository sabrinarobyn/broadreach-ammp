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

// If the Broadreach app-access cookie has expired mid-session, the server's
// requireAppAccess middleware 401s every request (including these) with this
// code. Distinct from AMMP itself rejecting a key/token (r.status===401 with
// no such code) — only redirect for the app-gate case, not an AMMP auth error.
function redirectToAppAccessGate() {
  location.href = '/?next=' + encodeURIComponent(location.pathname);
}

async function apiGet(token, path) {
  const r = await fetch(`/proxy/${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) {
    if (r.status === 401) {
      const body = await r.clone().json().catch(() => ({}));
      if (body.code === 'APP_ACCESS_REQUIRED') { redirectToAppAccessGate(); return new Promise(() => {}); }
    }
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
  if (r.status === 401 && d.code === 'APP_ACCESS_REQUIRED') { redirectToAppAccessGate(); return new Promise(() => {}); }
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

/* ---------------- device type matching ---------------- */
/* device_type varies by account/hardware — confirmed real-world values include
   'pv_inverter' and 'battery_inverter' (hybrid inverters), so match any string
   containing "inverter" rather than a fixed set. Run debugDevices(assetId) from the
   console (via window.__ammp) to confirm the exact device_type values a given
   portfolio actually returns. */

function matchesDeviceType(device, deviceType) {
  if (deviceType == null) return true;
  const t = (device && device.device_type) || '';
  return deviceType instanceof RegExp ? deviceType.test(t) : t === deviceType;
}
const DEVICE_TYPE = { INVERTER: /inverter/i, BATTERY: /batt/i, METER: /meter/i };

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
  if (Array.isArray(resp.data)) return [{ key: 'value', label: 'Value', points: resp.data, unit: resp.unit || null }];
  return Object.keys(resp).filter((k) => isAssetSeriesValue(resp[k])).map((k) => ({
    key: k, label: humanizeKey(k), points: resp[k].data, unit: resp[k].unit || null,
  }));
}

/* Confirmed via a live 422: daily/monthly-interval endpoints (historic-energy,
   historic-kpi-data, commercial-kpis/*, interval 1d or 1M) reject any date_from/
   date_to that isn't exact UTC midnight — {"type":"date_from_datetime_inexact",
   "msg":"Datetimes provided to dates should have zero time - e.g. be exact dates"}.
   Sub-day intervals (15m/1h) accept full datetimes fine; only use this for 1d/1M. */
function utcDateOnly(date) {
  const d = new Date(date);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())).toISOString();
}

/* AMMP declares each series' own unit (confirmed: "W" for power fields) — scale the
   two base-unit forms down to their kilo- equivalent; anything else (%, kg, currency,
   already-kilo) passes through unchanged. Safe to apply broadly since it only fires
   on those two exact unit strings. */
function scaleByDeclaredUnit(value, unit) {
  if (value == null || !isFinite(value)) return value;
  return (unit === 'W' || unit === 'Wh') ? value / 1000 : value;
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

/* total_pv_power is the confirmed nameplate-capacity field on this AMMP account's
   assets (both the /v1/assets list and /v1/assets/{id} detail), reported in Watts —
   not kWp as originally assumed. Prefer it, converting to kW; fall back to a generic
   capacity-like key for accounts whose assets don't carry total_pv_power. */
function extractCapacityKw(detail) {
  if (detail && typeof detail.total_pv_power === 'number') {
    return { value: detail.total_pv_power / 1000, key: 'total_pv_power' };
  }
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
function extractProvince(detail) {
  for (const name of ['province', 'region', 'state']) {
    const f = findField(detail, new RegExp(`^${name}$`, 'i'), { maxDepth: 1 });
    if (f) return f.value;
  }
  return null;
}
function extractCoords(detail) {
  const lat = findField(detail, /^lat(itude)?$/i);
  const lng = findField(detail, /^(lon|lng|longitude)$/i);
  const latN = lat && Number(lat.value), lngN = lng && Number(lng.value);
  return (lat && lng && isFinite(latN) && isFinite(lngN)) ? { lat: latN, lng: lngN } : null;
}

/* Exact-key-first scalar extraction — tries the confirmed field name (e.g. 'pv_power',
   'poa_irradiance') as a bare number, a { value } wrapper, or an asset-series { data:
   [{date,value}] } tail, before falling back to the generic pattern-matched findField.
   Important: if the exact key exists but is null/unusable (e.g. a momentary data gap),
   return null immediately rather than falling through to the broad fallback pattern —
   most-recent responses on this API merge live telemetry with static asset metadata
   (e.g. total_pv_power, the nameplate capacity) into one flat object, and a loose
   /power/i fallback would otherwise pick up total_pv_power and misreport it as the
   current live reading. */
function extractScalar(obj, exactKey, fallbackPattern) {
  if (obj && typeof obj === 'object' && exactKey in obj) {
    const v = obj[exactKey];
    if (typeof v === 'number') return v;
    if (typeof v === 'string' && v !== '' && isFinite(Number(v))) return Number(v);
    if (v && typeof v === 'object') {
      if (typeof v.value === 'number') return v.value;
      if (Array.isArray(v.data) && v.data.length) {
        const last = v.data[v.data.length - 1];
        if (last && last.value != null) return Number(last.value);
      }
    }
    return null;
  }
  if (fallbackPattern) {
    const f = findField(obj, fallbackPattern);
    if (f) return Number(f.value);
  }
  return null;
}

/* most-recent's pv_power is a flat scalar in Watts (same convention confirmed via
   historic-power's declared "unit": "W") — convert to kW. */
function derivePowerKw(mostRecentResp) {
  if (!mostRecentResp) return null;
  const exact = extractScalar(mostRecentResp, 'pv_power', /power/i);
  if (exact != null) return exact / 1000;
  const series = extractAssetSeries(mostRecentResp);
  if (series.length && series[0].points.length) return Number(series[0].points[series[0].points.length - 1].value) / 1000;
  return null;
}
/* status-info-latest's 'alerts' field is confirmed to be a rolling event history per
   device (both "OK" recovery and "Error" events, months deep — one real account had
   658 entries) rather than a list of currently-open problems. Reduce to each device's
   most-recent entry (by timestamp, not array order) and treat only a non-"OK" latest
   state as an active alert — otherwise virtually every asset has *some* alert in its
   history and every site would falsely show as alerting. */
function deriveActiveAlerts(statusInfoResp) {
  if (!statusInfoResp) return [];
  const alerts = Array.isArray(statusInfoResp.alerts) ? statusInfoResp.alerts : null;
  if (!alerts) return [];
  const latestByDevice = new Map();
  for (const a of alerts) {
    const key = a.device_id || a.device_name || '_';
    const t = new Date(a.timestamp || a.time || a.date).getTime();
    const prev = latestByDevice.get(key);
    if (!prev || (isFinite(t) && t > prev._t)) latestByDevice.set(key, { ...a, _t: t });
  }
  return [...latestByDevice.values()].filter((a) => a.status_level && a.status_level !== 'OK');
}

function deriveHasAlerts(statusInfoResp) {
  if (!statusInfoResp) return false;
  if (Array.isArray(statusInfoResp.alerts)) return deriveActiveAlerts(statusInfoResp).length > 0;
  // fallback for accounts without a confirmed 'alerts' key
  return Object.keys(statusInfoResp).some((k) => /alert/i.test(k) && Array.isArray(statusInfoResp[k]) && statusInfoResp[k].length > 0);
}

/* AMMP's time-series endpoints always include an explicit UTC offset ("+00:00"), but
   point-in-time metadata endpoints (e.g. last-data-received) sometimes return a bare
   "YYYY-MM-DDTHH:MM:SS" with none. JS's Date parser treats that as LOCAL time, not
   UTC — on a machine in a non-UTC zone this silently skews staleness/display by the
   local UTC offset (confirmed: ~2h skew on a SAST machine, enough to falsely trip the
   staleness threshold). Normalize by assuming UTC when no offset is present. */
function parseAmmpDate(input) {
  if (input == null) return new Date(NaN);
  const s = String(input);
  const naive = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(s);
  return new Date(naive ? s + 'Z' : s);
}

function deriveStale(lastDataReceivedResp, staleMs = 2 * 3600 * 1000) {
  if (!lastDataReceivedResp) return true;
  const f = findField(lastDataReceivedResp, /time|date|received|timestamp/i);
  if (!f) return true;
  const t = parseAmmpDate(f.value).getTime();
  return !isFinite(t) || (Date.now() - t) > staleMs;
}

/* SAST (UTC+2) daylight window — a site with zero PV output outside 06:00–19:00 SAST
   is expected to be idle, not a fault, so status falls back to 'unknown' (grey) rather
   than 'none' (red) outside that window. */
function isSastDaylight(date) {
  const h = new Date((date || new Date()).getTime() + 2 * 3600 * 1000).getUTCHours();
  return h >= 6 && h < 19;
}
const SAST_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function formatSAST(dateInput) {
  if (!dateInput) return null;
  const d = parseAmmpDate(dateInput);
  if (isNaN(d.getTime())) return null;
  const s = new Date(d.getTime() + 2 * 3600 * 1000);
  const pad2 = (n) => (n < 10 ? '0' : '') + n;
  return `${pad2(s.getUTCDate())} ${SAST_MONTHS[s.getUTCMonth()]} ${s.getUTCFullYear()} ${pad2(s.getUTCHours())}:${pad2(s.getUTCMinutes())}`;
}

/* Relative "N minutes/hours/days ago" display for a timestamp, recomputed
   against the caller-supplied "now" so a live re-render (e.g. a 60s tick) just
   reformats the same underlying value rather than needing a re-fetch. */
function formatRelativeTime(dateInput, nowMs) {
  if (!dateInput) return null;
  const t = parseAmmpDate(dateInput).getTime();
  if (!isFinite(t)) return null;
  const now = nowMs != null ? nowMs : Date.now();
  const diffMin = Math.max(0, Math.round((now - t) / 60000));
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin} min ago`;
  if (diffMin < 24 * 60) return `${Math.round(diffMin / 60)} hr ago`;
  return `${Math.round(diffMin / 1440)} d ago`;
}

/* The 4 real, derivable states — replaces an earlier invented 7-state enum
   (production/issues/weather/throttling/export/shedding) that had no single
   confirmed AMMP source. producing/none is now decided by the PV-output ratio
   during SAST daylight hours; outside daylight (or with no ratio available) it
   falls back to powerKw, then to 'unknown' rather than a fabricated 'none'. */
function deriveStatus({ powerKw, pvRatioPct, hasAlerts, stale, daylight }) {
  if (stale) return 'unknown';
  if (hasAlerts) return 'alert';
  if (!daylight) return 'unknown';
  if (pvRatioPct != null) return pvRatioPct > 0 ? 'producing' : 'none';
  if (powerKw != null) return powerKw > 0 ? 'producing' : 'none';
  return 'unknown';
}

/* total_pv_power (Watts) is the confirmed nameplate-capacity field on this account's
   assets — pv_kwp/kwp are kept as fallbacks for accounts that return those instead. */
function toSite(asset) {
  const pvKwp = typeof asset.total_pv_power === 'number' ? asset.total_pv_power / 1000
    : typeof asset.pv_kwp === 'number' ? asset.pv_kwp
    : typeof asset.kwp === 'number' ? asset.kwp
    : null;
  return {
    id: asset.asset_id || asset.id,
    name: asset.asset_name || asset.name || asset.long_name || String(asset.asset_id || asset.id),
    raw: asset,
    pvKwp,
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
    const daylight = isSastDaylight();
    const enriched = await mapWithConcurrency(baseSites, 8, async (site) => {
      const [detail, mostRecent, lastData, statusInfo] = await Promise.all([
        fetchAssetDetail(tok, site.id).catch(() => null),
        fetchMostRecent(tok, site.id, 3600).catch(() => null),
        fetchLastDataReceived(tok, site.id).catch(() => null),
        fetchStatusInfoLatest(tok, site.id).catch(() => null),
      ]);
      const detailCapacity = detail ? extractCapacityKw(detail) : null;
      const capacityKw = site.pvKwp != null ? site.pvKwp : (detailCapacity ? detailCapacity.value : null);
      const powerKw = derivePowerKw(mostRecent);
      const pvRatioPct = (powerKw != null && capacityKw) ? Math.max(0, Math.min(100, (powerKw / capacityKw) * 100)) : null;
      const hasAlerts = deriveHasAlerts(statusInfo);
      // deriveActiveAlerts already runs over the statusInfo response fetched
      // above for hasAlerts — no extra request needed to surface *when* the
      // most recent alert happened.
      const activeAlerts = deriveActiveAlerts(statusInfo);
      const lastAlertAt = activeAlerts.length
        ? new Date(Math.max(...activeAlerts.map((a) => a._t || 0))).toISOString()
        : null;
      const lastDataField = findField(lastData, /time|date|received|timestamp/i);
      const stale = deriveStale(lastData);
      return {
        ...site,
        detail,
        capacityKw,
        province: detail ? extractProvince(detail) : null,
        location: detail ? extractLocation(detail) : null,
        coords: detail ? extractCoords(detail) : null,
        powerKw,
        pvRatioPct,
        hasAlerts,
        lastAlertAt,
        stale,
        lastDataAt: lastDataField ? lastDataField.value : null,
        status: deriveStatus({ powerKw, pvRatioPct, hasAlerts, stale, daylight }),
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

  /* Live-status poll — every 60s, re-check pv_power (lookback 30 min) for every site
     and recompute status/pvRatioPct. Lighter than enrichSites: no detail/alert refetch. */
  const sitesRef = React.useRef(sites);
  React.useEffect(() => { sitesRef.current = sites; }, [sites]);
  React.useEffect(() => {
    if (!live || !token) return;
    const id = setInterval(async () => {
      const current = sitesRef.current;
      if (!current.length) return;
      const daylight = isSastDaylight();
      const updated = await mapWithConcurrency(current, 8, async (site) => {
        const mostRecent = await fetchMostRecent(token, site.id, 1800).catch(() => null);
        const powerKw = derivePowerKw(mostRecent);
        const pvRatioPct = (powerKw != null && site.capacityKw) ? Math.max(0, Math.min(100, (powerKw / site.capacityKw) * 100)) : null;
        return { ...site, powerKw, pvRatioPct, status: deriveStatus({ powerKw, pvRatioPct, hasAlerts: site.hasAlerts, stale: site.stale, daylight }) };
      });
      setSites(updated);
    }, 60000);
    return () => clearInterval(id);
  }, [live, token]);

  const devicesFor = React.useCallback((assetId, deviceType) => {
    if (!devicesCacheRef.current.has(assetId)) {
      devicesCacheRef.current.set(assetId, fetchAssetDevices(token, assetId));
    }
    return devicesCacheRef.current.get(assetId).then((list) => (deviceType ? list.filter((d) => matchesDeviceType(d, deviceType)) : list));
  }, [token]);

  const debugDevices = React.useCallback(async (assetId) => {
    const list = await fetchAssetDevices(token, assetId);
    console.table(list.map((d) => ({ name: d.device_name, device_type: d.device_type, device_id: d.device_id })));
    return list;
  }, [token]);

  const inverterSeriesFor = React.useCallback(async (deviceId, dateFromIso, dateToIso, days) => {
    const merged = await fetchChunked(fetchInverterHistoric, token, deviceId, dateFromIso, dateToIso, '15m', 7);
    return toInverterSeries(merged, days);
  }, [token]);

  const value = {
    live, connecting, portfolioLoading, error, token, assets, sites,
    connect, disconnect, devicesFor, debugDevices, inverterSeriesFor,
  };

  /* Console convenience: window.__ammp.debugDevices('assetId') to confirm real
     device_type strings for a portfolio (Fix 10). */
  React.useEffect(() => { if (typeof window !== 'undefined') window.__ammp = value; });

  return <AmmpContext.Provider value={value}>{children}</AmmpContext.Provider>;
}

/* Maps a (possibly chunk-merged) pv-inverter historic-data response into a chart-ready
   series. Power + temperature come from confirmed exact keys; per-string channels
   vary by device so are picked up generically (any device-series key containing
   "string"), aligned to the power series by timestamp. */
function toInverterSeries(data, days) {
  const powerSeries = (data && data.pv_inverter_ac_P_total && data.pv_inverter_ac_P_total.datasets && data.pv_inverter_ac_P_total.datasets[0] && data.pv_inverter_ac_P_total.datasets[0].data) || [];
  const tempSeries = (data && data.pv_inverter_temp && data.pv_inverter_temp.datasets && data.pv_inverter_temp.datasets[0] && data.pv_inverter_temp.datasets[0].data) || [];
  const tMap = {};
  tempSeries.forEach((d) => { if (d.value != null) tMap[d.date] = d.value; });

  const stringSeriesList = extractDeviceSeries(data).filter((s) => /string/i.test(s.key));
  const stringMaps = stringSeriesList.map((s) => {
    const m = new Map();
    s.points.forEach((p) => { if (p.value != null) m.set(p.date, p.value / 1000); });
    return m;
  });

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
    const strings = stringMaps.length ? stringMaps.map((m) => (m.has(d.date) ? +m.get(d.date).toFixed(2) : null)) : null;
    return {
      m: ms, power, temp, hasTemp, current: null, voltage: null, strings,
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
    nStrings: stringSeriesList.length, degradedString: -1,
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
  matchesDeviceType, DEVICE_TYPE,
  chunkDateRange, mergeSeriesResponses, fetchChunked,
  extractDeviceSeries, extractAssetSeries, humanizeKey, findField, extractScalar, scaleByDeclaredUnit, utcDateOnly,
  extractCapacityKw, extractLocation, extractProvince, extractCoords,
  derivePowerKw, deriveHasAlerts, deriveActiveAlerts, deriveStale, deriveStatus, toSite, toInverterSeries,
  isSastDaylight, formatSAST, formatRelativeTime, parseAmmpDate,
});
