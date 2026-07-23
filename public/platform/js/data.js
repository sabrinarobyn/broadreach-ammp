/* ============================================================
   Broadreach Platform — portfolio dataset (deterministic)
   Exposes window.BR_DATA. The 69-site roster (name/province/town/
   contract/EPC/kWp/O&M schedule) is Broadreach business reference
   data with no AMMP equivalent, so it stays static here. Live
   telemetry (status, per-inverter power/temp) is layered on top by
   js/ammp.js when a site is matched to a real AMMP asset; the
   generators below remain as the offline/demo fallback.
   ============================================================ */
(function () {
  // seeded RNG
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const TODAY = new Date(2026, 5, 10); // 10 Jun 2026

  // AMMP-style live status states
  const STATES = {
    production:   { key: 'production',   label: 'PV Production',  glyph: '', bg: '#DDEED5', dot: '#4e7d3a' },
    issues:       { key: 'issues',       label: 'Issues',         glyph: '', bg: '#FBEECB', dot: '#e0a93b' },
    none:         { key: 'none',         label: 'No production',  glyph: '', bg: '#F7D9DE', dot: '#d34a5e' },
    weather:      { key: 'weather',      label: 'Bad weather',    glyph: '', bg: '#DDE7EE', dot: '#5d809a' },
    throttling:   { key: 'throttling',   label: 'Throttling',     glyph: '', bg: '#ECE6FA', dot: '#6D4AC2' },
    export:       { key: 'export',       label: 'Export',         glyph: '', bg: '#D4EFF2', dot: '#1B7E8C' },
    shedding:     { key: 'shedding',     label: 'Outages',        glyph: '', bg: '#DFE5EA', dot: '#3A4651' },
    unknown:      { key: 'unknown',      label: 'Unknown',        glyph: '', bg: '#EEF1F4', dot: '#9CA3AF' },
  };

  const PROV = {
    'Gauteng':       { lat: -26.10, lng: 28.10, x: 0.62, y: 0.34 },
    'Western Cape':  { lat: -33.90, lng: 19.00, x: 0.18, y: 0.86 },
    'KwaZulu-Natal': { lat: -29.60, lng: 30.90, x: 0.78, y: 0.62 },
    'Eastern Cape':  { lat: -32.90, lng: 26.50, x: 0.52, y: 0.80 },
    'Mpumalanga':    { lat: -25.60, lng: 30.50, x: 0.76, y: 0.28 },
    'Limpopo':       { lat: -23.90, lng: 29.50, x: 0.66, y: 0.12 },
    'Free State':    { lat: -28.50, lng: 26.80, x: 0.50, y: 0.56 },
    'North West':    { lat: -26.70, lng: 25.60, x: 0.42, y: 0.34 },
    'Northern Cape': { lat: -29.00, lng: 21.90, x: 0.26, y: 0.52 },
  };
  const EPCS = ['High Gear', 'SolarSpec', 'NovaEnergy', 'GridWorks', 'Helios EPC'];

  // Curated 69 commercial & industrial PV sites (fictional, SA-flavoured)
  // [name, province, town, contract, epcIndex, kWp]
  const RAW = [
    ['Vodacom Rosslyn', 'Gauteng', 'Rosslyn', 'PPA', 0, 728.1],
    ['Vodacom Silverton', 'Gauteng', 'Silverton', 'PPA', 0, 878.0],
    ['Vodacom Midrand DC', 'Gauteng', 'Midrand', 'PPA', 0, 1120.4],
    ['NeoFresh Cold Store', 'Mpumalanga', 'Nelspruit', 'P', 0, 276.1],
    ['Bouvest Broiler', 'Gauteng', 'Hammanskraal', 'M', 0, 295.7],
    ['Bouvest House', 'Gauteng', 'Centurion', 'M', 0, 29.0],
    ['Capricorn Park', 'Western Cape', 'Muizenberg', 'PPA', 0, 432.8],
    ['OK Laingsburg', 'Western Cape', 'Laingsburg', 'M', 1, 148.5],
    ['Bayhead Logistics', 'KwaZulu-Natal', 'Durban', 'PPA', 1, 849.9],
    ['Astrim Tech Labs', 'Gauteng', 'Sandton', 'M', 1, 532.2],
    ['Namoneng Pack House', 'Limpopo', 'Ohrigstad', 'PPA', 2, 584.6],
    ['Sovereign Wincanton', 'Eastern Cape', 'Gqeberha', 'PPA', 2, 209.5],
    ['Riverside Mall', 'Mpumalanga', 'Mbombela', 'PPA', 1, 612.3],
    ['Highveld Steelworks', 'Mpumalanga', 'eMalahleni', 'PPA', 3, 1980.0],
    ['Karoo Fresh Citrus', 'Eastern Cape', 'Kirkwood', 'M', 2, 366.4],
    ['Table Bay Cold Chain', 'Western Cape', 'Epping', 'PPA', 1, 744.7],
    ['Atlantic Foods', 'Western Cape', 'Atlantis', 'P', 1, 188.2],
    ['Sundale Dairy', 'KwaZulu-Natal', 'Howick', 'M', 0, 254.0],
    ['Magalies Citrus', 'North West', 'Brits', 'PPA', 2, 498.6],
    ['Phakama Mall', 'Gauteng', 'Soweto', 'PPA', 3, 690.1],
    ['Ekhaya Retail Park', 'KwaZulu-Natal', 'Pinetown', 'PPA', 3, 521.9],
    ['Drakensberg Lodge', 'KwaZulu-Natal', 'Bergville', 'M', 4, 96.3],
    ['Kalahari Pivot Farm', 'Northern Cape', 'Upington', 'PPA', 2, 1340.5],
    ['Garden Route Mall', 'Western Cape', 'George', 'PPA', 1, 805.4],
    ['Sasolburg Polymers', 'Free State', 'Sasolburg', 'PPA', 3, 1565.7],
    ['Maluti Brewery', 'Free State', 'Bethlehem', 'M', 4, 312.8],
    ['Boland Winery', 'Western Cape', 'Paarl', 'M', 1, 224.6],
    ['Cederberg Packhouse', 'Western Cape', 'Citrusdal', 'PPA', 2, 478.0],
    ['Zululand Sugar Mill', 'KwaZulu-Natal', 'Empangeni', 'PPA', 3, 1748.2],
    ['Midrand Data Hub', 'Gauteng', 'Midrand', 'PPA', 1, 2240.0],
    ['Kyalami Logistics', 'Gauteng', 'Kyalami', 'PPA', 3, 678.5],
    ['Sandton Office Tower', 'Gauteng', 'Sandton', 'M', 1, 415.3],
    ['Pretoria Glassworks', 'Gauteng', 'Pretoria West', 'P', 0, 350.9],
    ['Vaal Mall', 'Gauteng', 'Vanderbijlpark', 'PPA', 3, 588.1],
    ['Bushveld Abattoir', 'Limpopo', 'Polokwane', 'M', 0, 267.4],
    ['Tzaneen Avocado Co', 'Limpopo', 'Tzaneen', 'PPA', 2, 534.7],
    ['Marble Hall Tomatoes', 'Limpopo', 'Marble Hall', 'PPA', 2, 712.0],
    ['Klerksdorp Cold Store', 'North West', 'Klerksdorp', 'P', 0, 198.6],
    ['Rustenburg Platinum Hub', 'North West', 'Rustenburg', 'PPA', 3, 1410.9],
    ['Mahikeng Retail', 'North West', 'Mahikeng', 'M', 4, 142.7],
    ['Bloem Mediclinic', 'Free State', 'Bloemfontein', 'M', 1, 388.2],
    ['Welkom Gold Plaza', 'Free State', 'Welkom', 'PPA', 3, 466.5],
    ['Kimberley Diamond Park', 'Northern Cape', 'Kimberley', 'PPA', 2, 624.8],
    ['De Aar Solar Farm Annex', 'Northern Cape', 'De Aar', 'PPA', 2, 1890.0],
    ['Springbok Cold Chain', 'Northern Cape', 'Springbok', 'M', 1, 176.4],
    ['East London Auto', 'Eastern Cape', 'East London', 'PPA', 3, 932.6],
    ['Coega IDZ Warehouse', 'Eastern Cape', 'Gqeberha', 'PPA', 3, 1255.3],
    ['Mthatha Retail Park', 'Eastern Cape', 'Mthatha', 'M', 4, 154.9],
    ['Knysna Waterfront', 'Western Cape', 'Knysna', 'M', 1, 118.7],
    ['Worcester Fruit Co', 'Western Cape', 'Worcester', 'PPA', 2, 567.2],
    ['Saldanha Steel Annex', 'Western Cape', 'Saldanha', 'PPA', 3, 1620.4],
    ['Hermanus Brewery', 'Western Cape', 'Hermanus', 'M', 4, 210.5],
    ['Umhlanga Ridge Mall', 'KwaZulu-Natal', 'Umhlanga', 'PPA', 3, 740.0],
    ['Richards Bay Minerals', 'KwaZulu-Natal', 'Richards Bay', 'PPA', 3, 2010.8],
    ['Newcastle Textiles', 'KwaZulu-Natal', 'Newcastle', 'P', 0, 344.1],
    ['Ladysmith Cold Store', 'KwaZulu-Natal', 'Ladysmith', 'M', 0, 232.6],
    ['Witbank Distribution', 'Mpumalanga', 'eMalahleni', 'PPA', 1, 678.9],
    ['Secunda Chemicals', 'Mpumalanga', 'Secunda', 'PPA', 3, 1755.0],
    ['White River Packhouse', 'Mpumalanga', 'White River', 'PPA', 2, 489.3],
    ['Standerton Dairy', 'Mpumalanga', 'Standerton', 'M', 0, 256.7],
    ['Soweto Health Centre', 'Gauteng', 'Soweto', 'M', 4, 88.4],
    ['Germiston Foundry', 'Gauteng', 'Germiston', 'P', 0, 412.0],
    ['Boksburg Logistics', 'Gauteng', 'Boksburg', 'PPA', 1, 596.2],
    ['Roodepoort Plaza', 'Gauteng', 'Roodepoort', 'PPA', 3, 503.8],
    ['Centurion Lifestyle', 'Gauteng', 'Centurion', 'M', 1, 327.5],
    ['Stellenbosch Cellars', 'Western Cape', 'Stellenbosch', 'M', 1, 274.9],
    ['Malmesbury Grain', 'Western Cape', 'Malmesbury', 'PPA', 2, 638.4],
    ['Hartbeespoort Resort', 'North West', 'Hartbeespoort', 'M', 4, 134.2],
    ['Polokwane Mega Mall', 'Limpopo', 'Polokwane', 'PPA', 3, 812.7],
  ];

  function commissionDate(rng) {
    const y = 2019 + Math.floor(rng() * 6);
    const m = Math.floor(rng() * 12);
    const d = 1 + Math.floor(rng() * 27);
    return new Date(y, m, d);
  }

  const TASKS = ['Maintenance', 'PV Module Clean', 'Inverter Service', 'Thermal Inspection', 'String Test'];

  const sites = RAW.map((r, i) => {
    const [name, province, town, contract, epcIdx, kwp] = r;
    const rng = mulberry32(1000 + i * 17);
    // status weighting — mostly producing (offline/demo fallback only)
    const roll = rng();
    let status;
    if (roll < 0.62) status = 'production';
    else if (roll < 0.74) status = 'issues';
    else if (roll < 0.80) status = 'weather';
    else if (roll < 0.86) status = 'export';
    else if (roll < 0.91) status = 'throttling';
    else if (roll < 0.96) status = 'shedding';
    else status = 'none';

    const pr = status === 'none' ? 0 : +(0.74 + rng() * 0.18).toFixed(2);
    const peakHour = 11 + rng() * 2;
    const irr = status === 'weather' ? 0.42 + rng() * 0.2 : 0.82 + rng() * 0.16;
    const currentKw = status === 'none' ? 0 : +(kwp * irr * (0.55 + rng() * 0.35) / 1000 * 1000).toFixed(1);
    const liveKw = status === 'none' ? 0 : +(kwp * (status === 'weather' ? 0.22 : 0.46 + rng() * 0.3)).toFixed(1);
    const todayKwh = status === 'none' ? 0 : +(kwp * (status === 'weather' ? 2.1 : 4.0 + rng() * 1.6)).toFixed(0);
    const availability = status === 'none' ? +(rng() * 30).toFixed(1) : +(96 + rng() * 3.9).toFixed(1);
    const alerts = status === 'none' ? 2 + Math.floor(rng() * 3) : status === 'issues' ? 1 + Math.floor(rng() * 2) : Math.floor(rng() * 2);

    // next O&M (some within 90d, some beyond)
    const daysAway = Math.floor(8 + rng() * 200);
    const omDate = new Date(TODAY.getTime() + daysAway * 86400000);
    const task = TASKS[Math.floor(rng() * TASKS.length)];

    const p = PROV[province];
    const jitter = () => (rng() - 0.5) * 0.06;
    const cells = Math.max(4, Math.round(kwp / 90));

    return {
      id: 'BR-' + String(101 + i),
      name, province, town, contract,
      epc: EPCS[epcIdx],
      kwp,
      status,
      pr, currentKw, liveKw, todayKwh, availability, alerts,
      commissioned: commissionDate(rng),
      om: { task, date: omDate, daysAway },
      strings: cells,
      modules: Math.round(kwp / 0.555),
      inverters: Math.max(1, Math.round(kwp / 110)),
      map: { x: Math.min(0.96, Math.max(0.04, p.x + jitter())), y: Math.min(0.96, Math.max(0.04, p.y + jitter())) },
      seed: 1000 + i * 17,
    };
  });

  // Portfolio-level aggregates
  const totalKwp = sites.reduce((a, s) => a + s.kwp, 0);
  const dueIn90 = sites.filter(s => s.om.daysAway <= 90).length;
  const urgent = sites.filter(s => s.om.daysAway <= 30).length;

  // O&M schedule (all upcoming, sorted)
  const schedule = sites.map(s => ({
    id: s.id, site: s.name, province: s.province, contract: s.contract,
    kwp: s.kwp, task: s.om.task, date: s.om.date, daysAway: s.om.daysAway,
    epc: s.epc, status: s.status,
  })).sort((a, b) => a.daysAway - b.daysAway);

  // --- per-site time series (deterministic by seed + range) ---
  function series(seed, range) {
    const rng = mulberry32(seed + (range === 'today' ? 7 : range === 'week' ? 31 : 91));
    const site = sites.find(s => s.seed === seed) || sites[0];
    const cap = site.kwp;
    if (range === 'today') {
      const pts = [];
      for (let h = 5; h <= 19; h += 0.5) {
        const bell = Math.max(0, Math.exp(-Math.pow((h - 12.4) / 3.0, 2)));
        const noise = 0.9 + rng() * 0.2;
        const prod = +(cap * bell * noise * (site.status === 'weather' ? 0.5 : 1) * (site.status === 'none' ? 0 : 1) / 1000 * 1000).toFixed(1);
        const cons = +(cap * (0.18 + 0.12 * Math.sin((h - 6) / 12 * Math.PI)) * (0.9 + rng() * 0.2) / 1000 * 1000).toFixed(1);
        const exp = Math.max(0, +(prod - cons).toFixed(1));
        pts.push({ t: h, label: (Math.floor(h) < 10 ? '0' : '') + Math.floor(h) + ':' + (h % 1 ? '30' : '00'), prod: prod / 1000 * 1000, cons, exp });
      }
      return { pts, unit: 'kW', xkind: 'hour' };
    }
    if (range === 'week') {
      const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      return {
        pts: days.map((d, i) => {
          const base = cap * (4.2 + rng() * 1.8);
          const prod = +(base * (i === 5 || i === 6 ? 1.04 : 1)).toFixed(0);
          const cons = +(base * (0.42 + rng() * 0.18)).toFixed(0);
          return { t: i, label: d, prod, cons, exp: Math.max(0, +(prod - cons).toFixed(0)) };
        }), unit: 'kWh', xkind: 'day',
      };
    }
    const mos = ['Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
    const seasonal = [1.05, 1.0, 0.92, 0.86, 0.8, 0.78, 0.82, 0.9, 0.98, 1.06, 1.1, 1.08];
    return {
      pts: mos.map((m, i) => {
        const base = cap * 135 * seasonal[i] * (0.95 + rng() * 0.1);
        const prod = +base.toFixed(0);
        const cons = +(base * (0.4 + rng() * 0.12)).toFixed(0);
        return { t: i, label: m, prod, cons, exp: Math.max(0, +(prod - cons).toFixed(0)) };
      }), unit: 'kWh', xkind: 'month',
    };
  }

  // panel/string heatmap for a site
  function panelGrid(seed) {
    const rng = mulberry32(seed + 555);
    const site = sites.find(s => s.seed === seed) || sites[0];
    const cols = 6, rows = 4;
    const grid = [];
    for (let r = 0; r < rows; r++) {
      const row = [];
      for (let c = 0; c < cols; c++) {
        let perf = 70 + rng() * 28;
        if (site.status === 'none') perf = rng() * 20;
        if (site.status === 'issues' && rng() < 0.18) perf = 30 + rng() * 25;
        row.push({ perf: +perf.toFixed(0), kw: +(site.kwp / (cols * rows) * perf / 100).toFixed(1) });
      }
      grid.push(row);
    }
    return { grid, rows, cols, labels: ['A', 'B', 'C', 'D'] };
  }

  function alerts(seed) {
    const rng = mulberry32(seed + 909);
    const site = sites.find(s => s.seed === seed) || sites[0];
    const pool = [
      { sev: 'warn', t: 'String 3 underperforming', d: 'Output 14% below array median' },
      { sev: 'info', t: 'Peak production window active', d: 'Irradiance 940 W/m² — optimal output' },
      { sev: 'ok', t: 'Inverter 2 back online', d: 'Recovered after grid dip at 09:14' },
      { sev: 'warn', t: 'Combiner box temp elevated', d: '58°C — 6°C above baseline' },
      { sev: 'info', t: 'Grid export resumed', d: 'Exporting 6.1 kW at R0.92/kWh' },
      { sev: 'crit', t: 'Inverter 1 fault F0048', d: 'DC isolation low — dispatch required' },
      { sev: 'ok', t: 'Daily yield target met', d: 'PR 0.86 vs 0.82 expected' },
      { sev: 'warn', t: 'Soiling loss detected', d: 'Est. 4.2% loss — clean recommended' },
    ];
    const times = ['6 min ago', '18 min ago', '41 min ago', '1h 12m ago', '2h 08m ago', '3h 30m ago'];
    const n = site.status === 'none' ? 5 : site.status === 'issues' ? 4 : 3;
    const out = [];
    const idx = [...pool.keys()];
    for (let i = 0; i < n; i++) {
      const j = Math.floor(rng() * idx.length);
      const a = pool[idx.splice(j, 1)[0]];
      out.push({ ...a, time: times[i] });
    }
    if (site.status === 'none') out.unshift({ sev: 'crit', t: 'Zero production since 11:42', d: 'Site offline — comms + DC fault suspected', time: '2h 18m ago' });
    return out;
  }

  function batteryFor(seed) {
    const rng = mulberry32(seed + 222);
    const site = sites.find(s => s.seed === seed) || sites[0];
    const has = (seed % 3) !== 0; // ~2/3 have storage
    if (!has) return null;
    const cap = +(site.kwp * (0.4 + rng() * 0.4) / 10).toFixed(1) * 10;
    const soc = site.status === 'none' ? 12 + Math.floor(rng() * 20) : 55 + Math.floor(rng() * 40);
    const charging = site.status !== 'none' && rng() > 0.4;
    const cells = [];
    for (let i = 0; i < 6; i++) {
      const v = +(3.66 + rng() * 0.09).toFixed(2);
      const t = +(23.8 + rng() * 3).toFixed(1);
      cells.push({ id: (i < 3 ? 'A' : 'B') + ((i % 3) + 1), v, t, warn: t > 26.2 });
    }
    return {
      capKwh: cap, stored: +(cap * soc / 100).toFixed(1), soc,
      powerKw: +((charging ? 1 : -1) * (1.5 + rng() * 2.5)).toFixed(1),
      temp: +(24 + rng() * 2.5).toFixed(1), charging, cells,
    };
  }

  // ---------- per-inverter metadata & time series (offline/demo fallback) ----------
  const INV_COLORS = ['#C86A1A', '#5d809a', '#4e7d3a', '#6D4AC2', '#1B7E8C', '#d34a5e', '#B58A00', '#315EDC', '#0E7C5A', '#A23E8C', '#7A6CCC', '#3E7C7C'];
  const INV_BRANDS = [['Huawei', 'HW'], ['Sungrow', 'SG'], ['SMA', 'SMA'], ['Fronius', 'FR'], ['GoodWe', 'GW'], ['Solis', 'SL']];
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const pad2 = (n) => (n < 10 ? '0' : '') + n;

  function invMeta(seed) {
    const site = sites.find(s => s.seed === seed) || sites[0];
    const rng = mulberry32(seed + 333);
    const [brand, abbr] = INV_BRANDS[Math.floor(rng() * INV_BRANDS.length)];
    const count = site.inverters;
    const list = [];
    for (let i = 0; i < count; i++) {
      const ratedKw = +(site.kwp / count * 0.96).toFixed(1);
      list.push({
        idx: i,
        name: `${abbr} Inv ${i + 1}`,
        brand,
        color: INV_COLORS[i % INV_COLORS.length],
        ratedKw,
        strings: Math.max(3, Math.min(14, Math.round(ratedKw / 16))),
      });
    }
    return { brand, abbr, count, list };
  }

  // fromStr: 'YYYY-MM-DD'; days: integer 1..7
  function inverterSeries(seed, idx, fromStr, days) {
    const site = sites.find(s => s.seed === seed) || sites[0];
    const meta = invMeta(seed);
    const inv = meta.list[idx] || meta.list[0];
    const capKw = inv.ratedKw;
    const fromMs = new Date(fromStr + 'T00:00:00').getTime();
    const stepMin = days <= 1 ? 30 : days <= 3 ? 60 : 120;
    const totalMin = days * 24 * 60;
    const rng = mulberry32(seed + idx * 131 + 17);
    const startDay = Math.floor(fromMs / 86400000);
    // per-day cloud factor
    const dayFactor = (d) => { const r = mulberry32(seed + idx * 131 + (startDay + d) * 7); return 0.55 + r() * 0.45; };

    // per-string stable balance factors; one string degraded on fault sites
    const nStr = inv.strings;
    const srng = mulberry32(seed + idx * 977 + 41);
    const strFactor = Array.from({ length: nStr }, () => 0.92 + srng() * 0.16);
    const degradedString = site.status !== 'none' && srng() < 0.7 ? Math.floor(srng() * nStr) : -1;
    if (degradedString >= 0) strFactor[degradedString] *= 0.58;
    const strSum = strFactor.reduce((a, b) => a + b, 0);

    const pts = [];
    let ema = 0;
    let pkPower = 0, pkTemp = -1e9, loTemp = 1e9, energy = 0, pkCur = 0, pkVolt = 0;
    for (let m = 0; m <= totalMin; m += stepMin) {
      const dt = new Date(fromMs + m * 60000);
      const dayIdx = Math.floor(m / (24 * 60));
      const hour = dt.getHours() + dt.getMinutes() / 60;
      const bell = Math.max(0, Math.exp(-Math.pow((hour - 12.6) / 3.1, 2)));
      const daylight = hour > 5.4 && hour < 19.2 ? 1 : 0;
      const cloud = dayFactor(dayIdx);
      const wobble = 0.9 + rng() * 0.2;
      const fault = site.status === 'none' ? 0 : 1;
      let power = capKw * 0.92 * bell * daylight * cloud * wobble * fault;
      // mid-afternoon dip on some inverters for realism
      if (hour > 13.5 && hour < 16 && rng() < 0.12) power *= 0.78;
      power = +power.toFixed(1);
      const ratio = power / (capKw || 1);
      ema = ema * 0.84 + ratio * 0.16;
      const ambient = 13 + 3 * Math.sin((hour - 8) / 24 * Math.PI * 2);
      const temp = +(ambient + ema * 66 + (power > 0 ? 2 : 0)).toFixed(1);
      // DC bus voltage (V): flat plateau while producing, 0 at night
      const voltage = power > 0.05 ? +(690 + 48 * Math.sin((hour - 12.6) / 6) + (rng() - 0.5) * 26).toFixed(1) : 0;
      // total DC current (A) drawn from the array
      const current = voltage > 0 ? +((power * 1000) / voltage).toFixed(1) : 0;
      // per-string power (kW), distributed across strings by stable weights
      const strings = strFactor.map(f => +((power * f) / strSum).toFixed(2));
      energy += power * (stepMin / 60);
      pkPower = Math.max(pkPower, power);
      pkTemp = Math.max(pkTemp, temp);
      loTemp = Math.min(loTemp, temp);
      pkCur = Math.max(pkCur, current);
      pkVolt = Math.max(pkVolt, voltage);
      pts.push({
        m, power, temp, current, voltage, strings,
        label: `${dt.getDate()} ${MON[dt.getMonth()]}, ${pad2(dt.getHours())}:${pad2(dt.getMinutes())}`,
        short: days <= 1 ? `${pad2(dt.getHours())}:${pad2(dt.getMinutes())}` : `${dt.getDate()} ${MON[dt.getMonth()]}`,
      });
    }
    return { pts, peakPower: +pkPower.toFixed(1), peakTemp: +pkTemp.toFixed(1), minTemp: +loTemp.toFixed(1), peakCurrent: +pkCur.toFixed(1), peakVoltage: +pkVolt.toFixed(1), energyKwh: Math.round(energy), capKw, nStrings: nStr, degradedString, real: false };
  }

  window.BR_DATA = {
    TODAY, STATES, PROV, EPCS, sites,
    totals: { count: sites.length, kwp: Math.round(totalKwp), dueIn90, urgent },
    schedule, series, panelGrid, alerts, batteryFor, invMeta, inverterSeries, INV_COLORS,
    fmtKwp: (v) => v >= 1000 ? (v / 1000).toFixed(2) + ' MWp' : v.toFixed(1) + ' kWp',
    monthLabel: (d) => d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }),
  };
})();
