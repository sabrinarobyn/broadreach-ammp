/* ============================================================
   Broadreach Platform — AMMP Data API integration
   Same-origin proxy conventions as ../index.html / ../portfolio.html:
   POST /auth/token (x-api-key -> access_token), then
   GET /proxy/v1/... with Authorization: Bearer <token>.
   The API key lives in sessionStorage only, shared with the other
   ammp-proxy pages in this tab.
   ============================================================ */

const KEY_STORE = 'ammpKey';
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pad2 = (n) => (n < 10 ? '0' : '') + n;

async function authenticate(apiKey) {
  const r = await fetch('/auth/token', { method: 'POST', headers: { 'x-api-key': apiKey } });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d.access_token) {
    throw new Error(r.status === 401 || r.status === 403 ? 'That key was rejected by AMMP.' : `Sign-in failed (${r.status}).`);
  }
  return d.access_token;
}

async function fetchAssets(token) {
  const r = await fetch('/proxy/v1/assets', { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) throw new Error(`Failed to load AMMP assets (${r.status}).`);
  return r.json();
}

async function fetchDevices(token, assetId) {
  const r = await fetch(`/proxy/v1/assets/${assetId}/devices`, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) throw new Error(`Failed to load devices for asset ${assetId} (${r.status}).`);
  const d = await r.json();
  return (d.devices || []).filter((x) => x.device_type === 'pv_inverter');
}

async function fetchInverterHistoric(token, deviceId, dateFromIso, dateToIso, interval = '15m') {
  const url = `/proxy/v1/devices/${deviceId}/historic-data/pv-inverter?date_from=${dateFromIso}&date_to=${dateToIso}&interval=${interval}`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) {
    const txt = await r.text().catch(() => '');
    throw new Error(`${r.status} ${r.statusText}: ${txt}`);
  }
  return r.json();
}

// Same fuzzy heuristic as portfolio.html: match on the first word of either name.
function matchSitesToAssets(sites, assets) {
  const bySite = new Map();
  assets.forEach((a) => {
    const name = (a.asset_name || '').toLowerCase();
    if (!name) return;
    sites.forEach((s) => {
      if (bySite.has(s.id)) return;
      const sname = s.name.toLowerCase();
      if (name.includes(sname.split(' ')[0]) || sname.includes(name.split(' ')[0])) {
        bySite.set(s.id, a);
      }
    });
  });
  return bySite;
}

// Map an AMMP historic-data/pv-inverter response into the same shape
// js/data.js's synthetic inverterSeries() returns, so InverterChart and
// InverterBlock don't need to know whether data is real or demo. Only
// power + temperature are available from this endpoint — current/voltage
// stay at 0 and callers should hide those toggles when series.real is true.
function toInverterSeries(data, days) {
  const powerSeries = (data && data.pv_inverter_ac_P_total && data.pv_inverter_ac_P_total.datasets && data.pv_inverter_ac_P_total.datasets[0] && data.pv_inverter_ac_P_total.datasets[0].data) || [];
  const tempSeries = (data && data.pv_inverter_temp && data.pv_inverter_temp.datasets && data.pv_inverter_temp.datasets[0] && data.pv_inverter_temp.datasets[0].data) || [];
  const tMap = {};
  tempSeries.forEach((d) => { if (d.value != null) tMap[d.date] = d.value; });

  let pkPower = 0, pkTemp = -1e9, loTemp = 1e9, energyKwh = 0, prevMs = null;
  const pts = powerSeries.filter((d) => d.value != null).map((d) => {
    const dt = new Date(d.date);
    const power = +(d.value / 1000).toFixed(2);
    const temp = tMap[d.date] != null ? +tMap[d.date].toFixed(1) : 0;
    pkPower = Math.max(pkPower, power);
    if (tMap[d.date] != null) { pkTemp = Math.max(pkTemp, temp); loTemp = Math.min(loTemp, temp); }
    const ms = dt.getTime();
    if (prevMs != null) energyKwh += power * ((ms - prevMs) / 3600000);
    prevMs = ms;
    return {
      m: ms, power, temp, current: 0, voltage: 0, strings: null,
      label: `${dt.getDate()} ${MON[dt.getMonth()]}, ${pad2(dt.getHours())}:${pad2(dt.getMinutes())}`,
      short: days <= 1 ? `${pad2(dt.getHours())}:${pad2(dt.getMinutes())}` : `${dt.getDate()} ${MON[dt.getMonth()]}`,
    };
  });

  return {
    pts,
    peakPower: +pkPower.toFixed(1),
    peakTemp: pkTemp === -1e9 ? 0 : +pkTemp.toFixed(1),
    minTemp: loTemp === 1e9 ? 0 : +loTemp.toFixed(1),
    peakCurrent: 0, peakVoltage: 0,
    energyKwh: Math.round(energyKwh),
    nStrings: 0, degradedString: -1,
    real: true,
  };
}

const AmmpContext = React.createContext(null);
function useAmmp() { return React.useContext(AmmpContext); }

function AmmpProvider({ sites, children }) {
  const [live, setLive] = React.useState(false);
  const [connecting, setConnecting] = React.useState(false);
  const [error, setError] = React.useState(null);
  const [token, setToken] = React.useState(null);
  const [assets, setAssets] = React.useState([]);
  const matchesRef = React.useRef(new Map());
  const devicesCacheRef = React.useRef(new Map()); // assetId -> Promise<devices>

  const connect = React.useCallback(async (apiKey) => {
    setConnecting(true); setError(null);
    try {
      const tok = await authenticate(apiKey);
      const list = await fetchAssets(tok);
      sessionStorage.setItem(KEY_STORE, apiKey);
      setToken(tok);
      setAssets(list);
      matchesRef.current = matchSitesToAssets(sites, list);
      devicesCacheRef.current = new Map();
      setLive(true);
      return true;
    } catch (e) {
      sessionStorage.removeItem(KEY_STORE);
      setError(e.message || 'Could not connect to AMMP.');
      setLive(false);
      return false;
    } finally {
      setConnecting(false);
    }
  }, [sites]);

  const disconnect = React.useCallback(() => {
    sessionStorage.removeItem(KEY_STORE);
    setToken(null); setAssets([]); setLive(false);
    matchesRef.current = new Map();
    devicesCacheRef.current = new Map();
  }, []);

  // Auto-connect if this tab already holds a key from index.html/portfolio.html.
  React.useEffect(() => {
    const stored = sessionStorage.getItem(KEY_STORE);
    if (stored) connect(stored);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const assetFor = React.useCallback((site) => matchesRef.current.get(site.id) || null, []);

  const devicesFor = React.useCallback((assetId) => {
    if (!devicesCacheRef.current.has(assetId)) {
      devicesCacheRef.current.set(assetId, fetchDevices(token, assetId));
    }
    return devicesCacheRef.current.get(assetId);
  }, [token]);

  const seriesFor = React.useCallback(async (deviceId, dateFromIso, dateToIso, days) => {
    const data = await fetchInverterHistoric(token, deviceId, dateFromIso, dateToIso, '15m');
    return toInverterSeries(data, days);
  }, [token]);

  const value = {
    live, connecting, error, assets,
    matchedCount: matchesRef.current.size,
    connect, disconnect, assetFor, devicesFor, seriesFor,
  };

  return <AmmpContext.Provider value={value}>{children}</AmmpContext.Provider>;
}

Object.assign(window, { AmmpProvider, useAmmp, AmmpContext, AMMP_KEY_STORE: KEY_STORE });
