/* ============================================================
   Broadreach Platform — portfolio sub-views
   SiteGrid · SiteTable · SiteMap · Schedule · Legend
   ============================================================ */

const { useState: _useState } = React;

function urgencyColor(days) {
  if (days <= 30) return 'var(--rd)';
  if (days <= 60) return 'var(--amb)';
  if (days <= 90) return 'var(--br)';
  return 'var(--grey-lt)';
}
function flagClass(days) {
  if (days <= 30) return { bg: 'var(--rd-lt)', fg: 'var(--rd)', dot: 'var(--rd)' };
  if (days <= 60) return { bg: 'var(--amb-lt)', fg: 'var(--amb-dk)', dot: 'var(--amb)' };
  return { bg: 'var(--br-xlt)', fg: 'var(--br-dk)', dot: 'var(--br)' };
}

/* ---------------- LEGEND ---------------- */
function Legend({ live }) {
  const order = ['production', 'issues', 'none', 'weather', 'throttling', 'export', 'shedding'];
  return (
    <div className="card" style={{ padding: '10px 16px', display: 'flex', flexWrap: 'wrap', gap: '8px 18px', alignItems: 'center' }}>
      <span className="eyebrow" style={{ marginRight: 2 }}>{live ? 'Live status' : 'Status (offline)'}</span>
      {order.map(k => {
        const s = BR_DATA.STATES[k];
        return (
          <span key={k} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.7rem', color: 'var(--ink-mid)', opacity: live ? 1 : 0.5 }}>
            <span style={{ width: 18, height: 18, borderRadius: '50%', background: s.bg, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: s.dot }}></span></span>
            {s.label}
          </span>
        );
      })}
      <span style={{ marginLeft: 'auto', display: 'flex', gap: 14, alignItems: 'center' }}>
        <span className="eyebrow">O&amp;M window</span>
        {[['<30d', 'var(--rd)'], ['30–60d', 'var(--amb)'], ['60–90d', 'var(--br)']].map(([t, c]) => (
          <span key={t} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.68rem', color: 'var(--ink-mid)' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: c }}></span>{t}
          </span>
        ))}
      </span>
    </div>
  );
}

/* ---------------- CARD GRID ---------------- */
function SiteCard({ s, i, live, onOpen, showStatus }) {
  const reveal = showStatus || live;
  const due = s.om.daysAway <= 90;
  const f = flagClass(s.om.daysAway);
  return (
    <button onClick={() => onOpen(s.id)} className="card site-card scroll"
      style={{
        textAlign: 'left', padding: 'var(--card-pad)', position: 'relative', overflow: 'hidden',
        borderTop: `3px solid ${due ? urgencyColor(s.om.daysAway) : 'var(--line)'}`, cursor: 'pointer',
      }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 11 }}>
        <StatusGlyph status={s.status} live={reveal} size={22} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: '0.84rem', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}</div>
          <div className="mono" style={{ fontSize: '0.6rem', color: 'var(--ink-light)' }}>{s.province}</div>
        </div>
        <ContractTag c={s.contract} />
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div>
          <div className="display" style={{ fontSize: '1.3rem', lineHeight: 1 }}>{s.kwp.toFixed(1)}<span className="mono" style={{ fontSize: '0.58rem', color: 'var(--ink-light)' }}> kWp</span></div>
        </div>
        {live
          ? <div style={{ textAlign: 'right' }}><div className="display" style={{ fontSize: '1.1rem', lineHeight: 1, color: s.status === 'none' ? 'var(--rd)' : 'var(--grn-ink)' }}>{s.liveKw}<span className="mono" style={{ fontSize: '0.55rem', color: 'var(--ink-light)' }}> kW</span></div><div className="eyebrow" style={{ fontSize: '0.5rem' }}>now</div></div>
          : due ? <span className="mono" style={{ fontSize: '0.6rem', color: f.fg, background: f.bg, padding: '3px 8px', borderRadius: 6, whiteSpace: 'nowrap' }}>O&amp;M · {s.om.daysAway}d</span> : null}
      </div>
      {live && due && (
        <div className="mono" style={{ marginTop: 9, fontSize: '0.58rem', color: f.fg, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: urgencyColor(s.om.daysAway) }}></span>
          {s.om.task} · {BR_DATA.monthLabel(s.om.date)} · {s.om.daysAway}d
        </div>
      )}
    </button>
  );
}

const GRID_CSS = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(248px, 1fr))', gap: 'var(--gap)' };
const STATUS_ORDER = ['none', 'issues', 'shedding', 'throttling', 'weather', 'export', 'production'];

function SiteGrid({ sites, live, onOpen, group }) {
  // ungrouped
  if (group !== 'status') {
    return <div style={GRID_CSS}>{sites.map((s, i) => <SiteCard key={s.id} s={s} i={i} live={live} onOpen={onOpen} />)}</div>;
  }
  // grouped by status (status revealed because we're organising by it)
  const groups = STATUS_ORDER
    .map(k => ({ k, st: BR_DATA.STATES[k], items: sites.filter(s => s.status === k) }))
    .filter(g => g.items.length);
  let n = 0;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      {groups.map(g => (
        <section key={g.k}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 11, paddingBottom: 7, borderBottom: `2px solid ${g.st.bg}` }}>
            <span style={{ width: 26, height: 26, borderRadius: '50%', background: g.st.bg, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><span style={{ width: 11, height: 11, borderRadius: '50%', background: g.st.dot }}></span></span>
            <h3 className="display" style={{ fontSize: '1.05rem', color: 'var(--br-dker)', letterSpacing: '0.8px', margin: 0, whiteSpace: 'nowrap' }}>{g.st.label}</h3>
            <span className="mono" style={{ fontSize: '0.62rem', fontWeight: 600, color: g.st.dot, background: g.st.bg, padding: '2px 9px', borderRadius: 20 }}>{g.items.length} site{g.items.length === 1 ? '' : 's'}</span>
            <span className="mono" style={{ fontSize: '0.6rem', color: 'var(--ink-light)', marginLeft: 'auto' }}>{BR_DATA.fmtKwp(g.items.reduce((a, s) => a + s.kwp, 0))}</span>
          </div>
          <div style={GRID_CSS}>
            {g.items.map(s => <SiteCard key={s.id} s={s} i={n++} live={live} onOpen={onOpen} showStatus={true} />)}
          </div>
        </section>
      ))}
    </div>
  );
}

/* ---------------- OPERATIONS TABLE ---------------- */
function SiteTable({ sites, live, onOpen, sort, setSort }) {
  const cols = [
    { k: 'status', label: '', w: 36, sortable: false },
    { k: 'name', label: 'Site' },
    { k: 'province', label: 'Province' },
    { k: 'contract', label: 'Contract', center: true },
    { k: 'kwp', label: 'PV kWp', num: true },
    { k: 'liveKw', label: 'Now kW', num: true, live: true },
    { k: 'pr', label: 'PR', num: true, live: true },
    { k: 'availability', label: 'Avail %', num: true, live: true },
    { k: 'alerts', label: 'Alerts', num: true, live: true },
    { k: 'omDays', label: 'Next O&M', num: true },
  ];
  const arrow = (k) => sort.k === k ? (sort.dir > 0 ? ' ▲' : ' ▼') : '';
  const click = (c) => { if (c.sortable === false) return; setSort(p => ({ k: c.k, dir: p.k === c.k ? -p.dir : 1 })); };
  return (
    <div className="card scroll" style={{ overflow: 'auto' }}>
      <table className="ops-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.74rem', minWidth: 880 }}>
        <thead>
          <tr>
            {cols.map(c => (
              <th key={c.k} onClick={() => click(c)} style={{
                background: 'var(--br)', color: '#fff', padding: '9px 12px', textAlign: c.num ? 'right' : c.center ? 'center' : 'left',
                fontSize: '0.58rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px',
                cursor: c.sortable === false ? 'default' : 'pointer', whiteSpace: 'nowrap', position: 'sticky', top: 0,
              }}>{c.label}{arrow(c.k)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sites.map(s => (
            <tr key={s.id} onClick={() => onOpen(s.id)} style={{ cursor: 'pointer' }} className="ops-row">
              <td style={{ padding: '7px 10px', borderBottom: '1px solid var(--line)' }}><StatusGlyph status={s.status} live={live} size={20} /></td>
              <td style={{ padding: '7px 12px', borderBottom: '1px solid var(--line)', fontWeight: 700 }}>{s.name}<div className="mono" style={{ fontSize: '0.58rem', color: 'var(--ink-light)', fontWeight: 400 }}>{s.id} · {s.town}</div></td>
              <td className="mono" style={{ padding: '7px 12px', borderBottom: '1px solid var(--line)', fontSize: '0.66rem', color: 'var(--ink-mid)' }}>{s.province}</td>
              <td style={{ padding: '7px 12px', borderBottom: '1px solid var(--line)', textAlign: 'center' }}><ContractTag c={s.contract} /></td>
              <td className="mono" style={{ padding: '7px 12px', borderBottom: '1px solid var(--line)', textAlign: 'right' }}>{s.kwp.toFixed(1)}</td>
              <td className="mono" style={{ padding: '7px 12px', borderBottom: '1px solid var(--line)', textAlign: 'right', color: live ? (s.status === 'none' ? 'var(--rd)' : 'var(--ink)') : '#C2C8CE' }}>{live ? s.liveKw : '—'}</td>
              <td className="mono" style={{ padding: '7px 12px', borderBottom: '1px solid var(--line)', textAlign: 'right', color: live ? 'var(--ink)' : '#C2C8CE' }}>{live ? (s.pr ? s.pr.toFixed(2) : '—') : '—'}</td>
              <td className="mono" style={{ padding: '7px 12px', borderBottom: '1px solid var(--line)', textAlign: 'right', color: live ? (s.availability < 90 ? 'var(--rd)' : 'var(--ink)') : '#C2C8CE' }}>{live ? s.availability.toFixed(1) : '—'}</td>
              <td className="mono" style={{ padding: '7px 12px', borderBottom: '1px solid var(--line)', textAlign: 'right' }}>
                {live ? (s.alerts > 0 ? <span style={{ background: s.alerts > 2 ? 'var(--rd-lt)' : 'var(--amb-lt)', color: s.alerts > 2 ? 'var(--rd)' : 'var(--amb-dk)', padding: '1px 7px', borderRadius: 10, fontWeight: 700 }}>{s.alerts}</span> : <span style={{ color: 'var(--ink-light)' }}>0</span>) : '—'}
              </td>
              <td style={{ padding: '7px 12px', borderBottom: '1px solid var(--line)', textAlign: 'right', whiteSpace: 'nowrap' }}>
                <span className="mono" style={{ color: 'var(--ink-mid)', fontSize: '0.66rem' }}>{BR_DATA.monthLabel(s.om.date)}</span>
                <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: urgencyColor(s.om.daysAway), margin: '0 5px 0 8px' }}></span>
                <strong className="mono">{s.om.daysAway}d</strong>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---------------- MAP ---------------- */
function SiteMap({ sites, live, onOpen }) {
  const [hover, setHover] = _useState(null);
  const provinces = Object.entries(BR_DATA.PROV);
  const maxKwp = Math.max(...sites.map(s => s.kwp));
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 'var(--gap)', alignItems: 'stretch' }}>
      <div className="card" style={{ padding: 0, position: 'relative', overflow: 'hidden', minHeight: 560, background: 'linear-gradient(160deg,#F7FAFB,#EAF0F3)' }}>
        {/* graticule */}
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
          {Array.from({ length: 9 }, (_, i) => (
            <g key={i}>
              <line x1={(i + 1) * 10} y1="0" x2={(i + 1) * 10} y2="100" stroke="#DCE4E9" strokeWidth="0.15" />
              <line x1="0" y1={(i + 1) * 10} x2="100" y2={(i + 1) * 10} stroke="#DCE4E9" strokeWidth="0.15" />
            </g>
          ))}
        </svg>
        <div className="mono" style={{ position: 'absolute', top: 12, left: 14, fontSize: '0.62rem', color: 'var(--ink-light)', textTransform: 'uppercase', letterSpacing: 1 }}>South Africa · {sites.length} sites</div>
        {/* province labels */}
        {provinces.map(([name, p]) => (
          <div key={name} style={{ position: 'absolute', left: `${p.x * 100}%`, top: `${p.y * 100 - 7}%`, transform: 'translate(-50%,-50%)', fontFamily: 'var(--font-display)', fontSize: '0.7rem', letterSpacing: 1, color: '#B4BFC7', pointerEvents: 'none', whiteSpace: 'nowrap' }}>{name}</div>
        ))}
        {/* site dots */}
        {sites.map(s => {
          const st = BR_DATA.STATES[s.status] || BR_DATA.STATES.unknown;
          const r = 5 + (s.kwp / maxKwp) * 13;
          const c = live ? st.dot : '#9FB0BB';
          const active = hover === s.id;
          return (
            <button key={s.id} onClick={() => onOpen(s.id)} onMouseEnter={() => setHover(s.id)} onMouseLeave={() => setHover(null)}
              style={{
                position: 'absolute', left: `${s.map.x * 100}%`, top: `${s.map.y * 100}%`, width: r * 2, height: r * 2,
                marginLeft: -r, marginTop: -r, borderRadius: '50%', border: `2px solid #fff`, background: c,
                opacity: live ? 0.82 : 0.5, cursor: 'pointer', boxShadow: active ? '0 0 0 4px rgba(92,128,152,0.25)' : 'var(--shadow-sm)',
                transition: 'box-shadow .15s, transform .15s', transform: active ? 'scale(1.18)' : 'scale(1)', zIndex: active ? 5 : 1, padding: 0,
              }} title={s.name} />
          );
        })}
        {hover && (() => {
          const s = sites.find(x => x.id === hover);
          return (
            <div className="card" style={{ position: 'absolute', left: `${s.map.x * 100}%`, top: `${s.map.y * 100}%`, transform: `translate(${s.map.x > 0.6 ? '-108%' : '12px'}, -50%)`, padding: '8px 11px', zIndex: 6, pointerEvents: 'none', minWidth: 150 }}>
              <div style={{ fontWeight: 700, fontSize: '0.76rem' }}>{s.name}</div>
              <div className="mono" style={{ fontSize: '0.6rem', color: 'var(--ink-light)', margin: '2px 0 5px' }}>{s.town}, {s.province}</div>
              <div className="mono" style={{ fontSize: '0.66rem', display: 'flex', justifyContent: 'space-between', gap: 10 }}><span>{BR_DATA.fmtKwp(s.kwp)}</span><span style={{ color: live ? (BR_DATA.STATES[s.status] || BR_DATA.STATES.unknown).dot : 'var(--ink-light)' }}>{live ? (BR_DATA.STATES[s.status] || BR_DATA.STATES.unknown).label : 'offline'}</span></div>
            </div>
          );
        })()}
      </div>
      {/* side list */}
      <div className="card scroll" style={{ overflow: 'auto', maxHeight: 560, padding: 6 }}>
        {sites.map(s => (
          <button key={s.id} onClick={() => onOpen(s.id)} onMouseEnter={() => setHover(s.id)} onMouseLeave={() => setHover(null)}
            style={{ width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 9, padding: '7px 9px', border: 'none', borderRadius: 7, background: hover === s.id ? 'var(--br-xlt)' : 'transparent', cursor: 'pointer' }}>
            <StatusGlyph status={s.status} live={live} size={18} />
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontWeight: 700, fontSize: '0.72rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}</span>
              <span className="mono" style={{ fontSize: '0.56rem', color: 'var(--ink-light)' }}>{s.province}</span>
            </span>
            <span className="mono" style={{ fontSize: '0.62rem', color: 'var(--ink-mid)' }}>{s.kwp.toFixed(0)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

Object.assign(window, { SiteGrid, SiteTable, SiteMap, Legend, urgencyColor, flagClass });
