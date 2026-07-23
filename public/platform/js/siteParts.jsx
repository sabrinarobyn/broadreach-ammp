/* ============================================================
   Broadreach Platform — site-detail panels
   PanelArray · BatteryPanel · AlertsPanel · EnviroPanel · RevenuePanel
   ============================================================ */

function perfColor(p) {
  if (p < 35) return { bg: '#F5D4D4', fg: '#9B1B1D' };
  if (p < 70) return { bg: '#FAE8D0', fg: '#8F4A10' };
  if (p < 85) return { bg: '#E8EEDF', fg: '#3F5E2C' };
  return { bg: '#DDEED5', fg: '#2F5222' };
}

function PanelArray({ seed, kwp, live }) {
  const { grid, labels } = BR_DATA.panelGrid(seed);
  const avg = (grid.flat().reduce((a, c) => a + c.perf, 0) / grid.flat().length).toFixed(1);
  return (
    <div className="card" style={{ padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div>
          <h3 style={{ fontSize: '0.92rem', fontWeight: 700, margin: 0 }}>Panel Array</h3>
          <div className="mono" style={{ fontSize: '0.62rem', color: 'var(--ink-light)', marginTop: 2 }}>{grid.flat().length} string zones · avg {avg}% efficiency</div>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          {[['Low', '#F5D4D4'], ['Mid', '#FAE8D0'], ['OK', '#E8EEDF'], ['Peak', '#DDEED5']].map(([l, c]) => (
            <span key={l} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.6rem', color: 'var(--ink-light)' }}>
              <span style={{ width: 9, height: 9, borderRadius: 2, background: c }}></span>{l}
            </span>
          ))}
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'auto repeat(6, 1fr)', gap: 6 }}>
        {grid.map((row, r) => (
          <React.Fragment key={r}>
            <div className="display" style={{ fontSize: '0.9rem', color: 'var(--ink-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{labels[r]}</div>
            {row.map((cell, c) => {
              const col = live ? perfColor(cell.perf) : { bg: '#EEF1F4', fg: '#AEB6BD' };
              return (
                <div key={c} title={`${labels[r]}${c + 1}: ${cell.perf}%`} style={{
                  background: col.bg, color: col.fg, borderRadius: 7, padding: '12px 6px', textAlign: 'center',
                  border: '1px solid rgba(0,0,0,0.03)', transition: 'transform .1s', cursor: 'default',
                }}>
                  <div className="display" style={{ fontSize: '1.05rem', lineHeight: 1 }}>{live ? cell.perf + '%' : '—'}</div>
                  <div className="mono" style={{ fontSize: '0.56rem', opacity: 0.8, marginTop: 2 }}>{live ? cell.kw + 'kW' : ''}</div>
                </div>
              );
            })}
          </React.Fragment>
        ))}
        <div></div>
        {[1, 2, 3, 4, 5, 6].map(n => <div key={n} className="mono" style={{ fontSize: '0.56rem', color: 'var(--ink-light)', textAlign: 'center' }}>{n}</div>)}
      </div>
    </div>
  );
}

function BatteryPanel({ bat, live }) {
  if (!bat) return null;
  return (
    <div className="card" style={{ padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ fontSize: '0.92rem', fontWeight: 700, margin: 0 }}>Battery Storage</h3>
        {live && <span className="pill" style={{ background: bat.charging ? 'var(--grn-lt)' : 'var(--amb-lt)', borderColor: 'transparent', color: bat.charging ? 'var(--grn-ink)' : 'var(--amb-dk)' }}>{bat.charging ? '⚡ Charging' : '↓ Discharging'}</span>}
      </div>
      <div style={{ display: 'flex', gap: 18, alignItems: 'center', marginBottom: 14 }}>
        <Donut value={live ? bat.soc : 0} label={live ? bat.soc + '%' : '—'} sub="SOC" color={bat.charging ? 'var(--grn)' : 'var(--amb)'} size={104} />
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 8px' }}>
          <div><div className="display" style={{ fontSize: '1.2rem' }}>{bat.capKwh}<span className="mono" style={{ fontSize: '0.6rem', color: 'var(--ink-light)' }}> kWh</span></div><div className="mono" style={{ fontSize: '0.58rem', color: 'var(--ink-light)' }}>{live ? bat.stored + ' kWh stored' : 'capacity'}</div></div>
          <div><div className="display" style={{ fontSize: '1.2rem', color: live ? (bat.powerKw > 0 ? 'var(--grn-ink)' : 'var(--amb-dk)') : 'var(--ink)' }}>{live ? (bat.powerKw > 0 ? '+' : '') + bat.powerKw : '—'}<span className="mono" style={{ fontSize: '0.6rem', color: 'var(--ink-light)' }}> kW</span></div><div className="mono" style={{ fontSize: '0.58rem', color: 'var(--ink-light)' }}>{bat.powerKw > 0 ? 'power in' : 'power out'}</div></div>
          <div><div className="display" style={{ fontSize: '1.2rem' }}>{live ? bat.temp : '—'}<span className="mono" style={{ fontSize: '0.6rem', color: 'var(--ink-light)' }}> °C</span></div><div className="mono" style={{ fontSize: '0.58rem', color: 'var(--ink-light)' }}>pack temp</div></div>
          <div><div className="display" style={{ fontSize: '1.2rem' }}>{bat.cells.length}</div><div className="mono" style={{ fontSize: '0.58rem', color: 'var(--ink-light)' }}>cells nominal</div></div>
        </div>
      </div>
      <div className="eyebrow" style={{ marginBottom: 7 }}>Cell status</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 7 }}>
        {bat.cells.map(c => (
          <div key={c.id} style={{ border: `1px solid ${c.warn && live ? 'var(--amb)' : 'var(--line)'}`, borderRadius: 7, padding: '7px 9px', background: c.warn && live ? 'var(--amb-lt)' : 'var(--grey-xlt)', position: 'relative' }}>
            <span style={{ position: 'absolute', top: 8, right: 8, width: 6, height: 6, borderRadius: '50%', background: live ? (c.warn ? 'var(--amb)' : 'var(--grn)') : '#CBD2D8' }}></span>
            <div className="mono" style={{ fontSize: '0.56rem', color: 'var(--ink-light)' }}>{c.id}</div>
            <div className="display" style={{ fontSize: '0.98rem' }}>{live ? c.v : '—'}<span className="mono" style={{ fontSize: '0.5rem', color: 'var(--ink-light)' }}>{live ? 'V' : ''}</span></div>
            <div className="mono" style={{ fontSize: '0.54rem', color: c.warn && live ? 'var(--amb-dk)' : 'var(--ink-light)' }}>{live ? c.t + '°C' : ''}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AlertsPanel({ seed, live }) {
  const items = live ? BR_DATA.alerts(seed) : [];
  const sevMap = {
    crit: { bg: 'var(--rd-lt)', fg: 'var(--rd)', icon: '⚠', bar: 'var(--rd)' },
    warn: { bg: 'var(--amb-lt)', fg: 'var(--amb-dk)', icon: '⚠', bar: 'var(--amb)' },
    info: { bg: 'var(--br-xlt)', fg: 'var(--br-dk)', icon: 'ⓘ', bar: 'var(--br)' },
    ok: { bg: 'var(--grn-lt)', fg: 'var(--grn-ink)', icon: '✓', bar: 'var(--grn)' },
  };
  const active = items.filter(i => i.sev === 'crit' || i.sev === 'warn').length;
  return (
    <div className="card" style={{ padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ fontSize: '0.92rem', fontWeight: 700, margin: 0 }}>System Alerts</h3>
        {live && active > 0 && <span className="ctag tag-p">{active} active</span>}
      </div>
      {!live ? (
        <div className="mono" style={{ fontSize: '0.68rem', color: 'var(--ink-light)', padding: '20px 4px', textAlign: 'center' }}>Connect AMMP to stream alerts</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {items.map((a, i) => {
            const s = sevMap[a.sev];
            return (
              <div key={i} style={{ display: 'flex', gap: 10, padding: '9px 11px', borderRadius: 8, background: s.bg, borderLeft: `3px solid ${s.bar}` }}>
                <span style={{ color: s.fg, fontSize: 13, lineHeight: 1.3 }}>{s.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.74rem', color: 'var(--ink)' }}>{a.t}</div>
                  <div className="mono" style={{ fontSize: '0.6rem', color: 'var(--ink-mid)', marginTop: 1 }}>{a.d}</div>
                </div>
                <span className="mono" style={{ fontSize: '0.56rem', color: 'var(--ink-light)', whiteSpace: 'nowrap' }}>{a.time}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function EnviroPanel({ site, live }) {
  const yearKwh = site.kwp * 1550;
  const co2 = (yearKwh * 0.95 / 1000).toFixed(1); // tonnes (SA grid factor ~0.95)
  const trees = Math.round(co2 * 46);
  const water = Math.round(yearKwh * 1.2);
  const months = [3, 4, 4, 5, 5, 6];
  return (
    <div className="card" style={{ padding: 16 }}>
      <h3 style={{ fontSize: '0.92rem', fontWeight: 700, margin: '0 0 12px' }}>Environmental Impact <span className="mono" style={{ fontWeight: 400, fontSize: '0.6rem', color: 'var(--ink-light)' }}>· trailing 12 mo</span></h3>
      {[['CO₂ avoided', co2, 'tonnes', 'var(--grn)'], ['Trees equivalent', trees.toLocaleString(), 'trees', 'var(--grn)'], ['Coal not burned', (co2 * 0.42).toFixed(1), 'tonnes', 'var(--ink-mid)']].map(([l, v, u, c]) => (
        <div key={l} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
          <span style={{ fontSize: '0.74rem', color: 'var(--ink-mid)' }}>{l}</span>
          <span><span className="display" style={{ fontSize: '1.15rem', color: c }}>{live ? v : '—'}</span> <span className="mono" style={{ fontSize: '0.58rem', color: 'var(--ink-light)' }}>{u}</span></span>
        </div>
      ))}
      <div className="eyebrow" style={{ margin: '12px 0 6px' }}>Monthly CO₂ offset</div>
      <MiniBars values={live ? months : [0, 0, 0, 0, 0, 0]} color="var(--grn)" h={40} />
    </div>
  );
}

function RevenuePanel({ site, live }) {
  const monthKwh = site.kwp * 130;
  const exportRev = Math.round(monthKwh * 0.45 * 0.92);
  const savings = Math.round(monthKwh * 0.55 * 2.4);
  const ytd = (exportRev + savings) * 6;
  const spark = [62, 70, 75, 82, 88, 95];
  return (
    <div className="card" style={{ padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <h3 style={{ fontSize: '0.92rem', fontWeight: 700, margin: 0 }}>Revenue &amp; Savings</h3>
        <div style={{ textAlign: 'right' }}><div className="display" style={{ fontSize: '1.3rem', color: 'var(--grn-ink)' }}>R{live ? ytd.toLocaleString() : '—'}</div><div className="mono" style={{ fontSize: '0.56rem', color: 'var(--ink-light)' }}>YTD total</div></div>
      </div>
      <Spark values={spark} color="var(--grn)" full h={46} />
      <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
        <div style={{ flex: 1, background: 'var(--grey-xlt)', borderRadius: 8, padding: '10px 12px' }}>
          <div className="display" style={{ fontSize: '1.3rem', color: 'var(--br-dk)' }}>R{live ? exportRev.toLocaleString() : '—'}</div>
          <div className="mono" style={{ fontSize: '0.58rem', color: 'var(--ink-light)' }}>grid export · this month</div>
        </div>
        <div style={{ flex: 1, background: 'var(--grey-xlt)', borderRadius: 8, padding: '10px 12px' }}>
          <div className="display" style={{ fontSize: '1.3rem', color: 'var(--br-dk)' }}>R{live ? savings.toLocaleString() : '—'}</div>
          <div className="mono" style={{ fontSize: '0.58rem', color: 'var(--ink-light)' }}>bill savings · this month</div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { PanelArray, BatteryPanel, AlertsPanel, EnviroPanel, RevenuePanel });
