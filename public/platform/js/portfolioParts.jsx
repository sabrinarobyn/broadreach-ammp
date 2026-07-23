/* ============================================================
   Broadreach Platform — portfolio sub-views
   SiteGrid · SiteTable · SiteMap · Legend
   ============================================================ */

const { useState: _useState } = React;

function urgencyColor(days) {
  if (days == null) return 'var(--grey-lt)';
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
function Legend() {
  return (
    <div className="card" style={{ padding: '10px 16px', display: 'flex', flexWrap: 'wrap', gap: '8px 18px', alignItems: 'center' }}>
      <span className="eyebrow" style={{ marginRight: 2 }}>Live status</span>
      {Object.values(STATUS_STATES).map((s) => (
        <span key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.7rem', color: 'var(--ink-mid)' }}>
          <span style={{ width: 18, height: 18, borderRadius: '50%', background: s.bg, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: s.dot }}></span></span>
          {s.label}
        </span>
      ))}
    </div>
  );
}

/* ---------------- CARD GRID ---------------- */
function SiteCard({ s, onOpen }) {
  return (
    <button onClick={() => onOpen(s.id)} className="card site-card scroll"
      style={{ textAlign: 'left', padding: 'var(--card-pad)', position: 'relative', overflow: 'hidden', cursor: 'pointer' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 11 }}>
        <StatusGlyph status={s.status} size={22} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: '0.84rem', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}</div>
          {s.location && <div className="mono" style={{ fontSize: '0.6rem', color: 'var(--ink-light)' }}>{s.location}</div>}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div>
          {s.capacityKw != null
            ? <div className="display" style={{ fontSize: '1.3rem', lineHeight: 1 }}>{s.capacityKw.toFixed(1)}<span className="mono" style={{ fontSize: '0.58rem', color: 'var(--ink-light)' }}> kWp</span></div>
            : <div className="mono" style={{ fontSize: '0.68rem', color: 'var(--ink-light)' }}>capacity n/a</div>}
        </div>
        {s.powerKw != null && (
          <div style={{ textAlign: 'right' }}>
            <div className="display" style={{ fontSize: '1.1rem', lineHeight: 1, color: s.status === 'none' ? 'var(--rd)' : 'var(--grn-ink)' }}>{s.powerKw.toFixed(1)}<span className="mono" style={{ fontSize: '0.55rem', color: 'var(--ink-light)' }}> kW</span></div>
            <div className="eyebrow" style={{ fontSize: '0.5rem' }}>now</div>
          </div>
        )}
      </div>
    </button>
  );
}

const GRID_CSS = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(248px, 1fr))', gap: 'var(--gap)' };
const STATUS_ORDER = ['none', 'alert', 'unknown', 'producing'];

function SiteGrid({ sites, onOpen, group }) {
  if (group !== 'status') {
    return <div style={GRID_CSS}>{sites.map((s) => <SiteCard key={s.id} s={s} onOpen={onOpen} />)}</div>;
  }
  const groups = STATUS_ORDER
    .map((k) => ({ k, st: STATUS_STATES[k], items: sites.filter((s) => s.status === k) }))
    .filter((g) => g.items.length);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      {groups.map((g) => (
        <section key={g.k}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 11, paddingBottom: 7, borderBottom: `2px solid ${g.st.bg}` }}>
            <span style={{ width: 26, height: 26, borderRadius: '50%', background: g.st.bg, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><span style={{ width: 11, height: 11, borderRadius: '50%', background: g.st.dot }}></span></span>
            <h3 className="display" style={{ fontSize: '1.05rem', color: 'var(--br-dker)', letterSpacing: '0.8px', margin: 0, whiteSpace: 'nowrap' }}>{g.st.label}</h3>
            <span className="mono" style={{ fontSize: '0.62rem', fontWeight: 600, color: g.st.dot, background: g.st.bg, padding: '2px 9px', borderRadius: 20 }}>{g.items.length} site{g.items.length === 1 ? '' : 's'}</span>
          </div>
          <div style={GRID_CSS}>
            {g.items.map((s) => <SiteCard key={s.id} s={s} onOpen={onOpen} />)}
          </div>
        </section>
      ))}
    </div>
  );
}

/* ---------------- OPERATIONS TABLE ---------------- */
function SiteTable({ sites, onOpen, sort, setSort }) {
  const cols = [
    { k: 'status', label: '', sortable: false },
    { k: 'name', label: 'Site' },
    { k: 'location', label: 'Location' },
    { k: 'capacityKw', label: 'PV kWp', num: true },
    { k: 'powerKw', label: 'Now kW', num: true },
  ];
  const arrow = (k) => (sort.k === k ? (sort.dir > 0 ? ' ▲' : ' ▼') : '');
  const click = (c) => { if (c.sortable === false) return; setSort((p) => ({ k: c.k, dir: p.k === c.k ? -p.dir : 1 })); };
  return (
    <div className="card scroll" style={{ overflow: 'auto' }}>
      <table className="ops-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.74rem', minWidth: 720 }}>
        <thead>
          <tr>
            {cols.map((c) => (
              <th key={c.k} onClick={() => click(c)} style={{
                background: 'var(--br)', color: '#fff', padding: '9px 12px', textAlign: c.num ? 'right' : 'left',
                fontSize: '0.58rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px',
                cursor: c.sortable === false ? 'default' : 'pointer', whiteSpace: 'nowrap', position: 'sticky', top: 0,
              }}>{c.label}{arrow(c.k)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sites.map((s) => (
            <tr key={s.id} onClick={() => onOpen(s.id)} style={{ cursor: 'pointer' }} className="ops-row">
              <td style={{ padding: '7px 10px', borderBottom: '1px solid var(--line)' }}><StatusGlyph status={s.status} size={20} /></td>
              <td style={{ padding: '7px 12px', borderBottom: '1px solid var(--line)', fontWeight: 700 }}>{s.name}<div className="mono" style={{ fontSize: '0.58rem', color: 'var(--ink-light)', fontWeight: 400 }}>{s.id}</div></td>
              <td className="mono" style={{ padding: '7px 12px', borderBottom: '1px solid var(--line)', fontSize: '0.66rem', color: 'var(--ink-mid)' }}>{s.location || '—'}</td>
              <td className="mono" style={{ padding: '7px 12px', borderBottom: '1px solid var(--line)', textAlign: 'right' }}>{s.capacityKw != null ? s.capacityKw.toFixed(1) : '—'}</td>
              <td className="mono" style={{ padding: '7px 12px', borderBottom: '1px solid var(--line)', textAlign: 'right', color: s.status === 'none' ? 'var(--rd)' : 'var(--ink)' }}>{s.powerKw != null ? s.powerKw.toFixed(1) : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---------------- MAP (only rendered by PortfolioView when at least one site has real coordinates) ---------------- */
function projectCoords(sites) {
  const located = sites.filter((s) => s.coords);
  const map = new Map();
  if (!located.length) return map;
  const lats = located.map((s) => s.coords.lat), lngs = located.map((s) => s.coords.lng);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  const latSpan = (maxLat - minLat) || 1, lngSpan = (maxLng - minLng) || 1;
  located.forEach((s) => {
    map.set(s.id, {
      x: 0.08 + ((s.coords.lng - minLng) / lngSpan) * 0.84,
      y: 0.08 + ((maxLat - s.coords.lat) / latSpan) * 0.84,
    });
  });
  return map;
}

function SiteMap({ sites, onOpen }) {
  const [hover, setHover] = _useState(null);
  const positions = React.useMemo(() => projectCoords(sites), [sites]);
  const located = sites.filter((s) => positions.has(s.id));
  const unlocated = sites.filter((s) => !positions.has(s.id));
  const maxKwp = Math.max(1, ...located.map((s) => s.capacityKw || 0));
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 'var(--gap)', alignItems: 'stretch' }}>
      <div className="card" style={{ padding: 0, position: 'relative', overflow: 'hidden', minHeight: 560, background: 'linear-gradient(160deg,#F7FAFB,#EAF0F3)' }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
          {Array.from({ length: 9 }, (_, i) => (
            <g key={i}>
              <line x1={(i + 1) * 10} y1="0" x2={(i + 1) * 10} y2="100" stroke="#DCE4E9" strokeWidth="0.15" />
              <line x1="0" y1={(i + 1) * 10} x2="100" y2={(i + 1) * 10} stroke="#DCE4E9" strokeWidth="0.15" />
            </g>
          ))}
        </svg>
        <div className="mono" style={{ position: 'absolute', top: 12, left: 14, fontSize: '0.62rem', color: 'var(--ink-light)', textTransform: 'uppercase', letterSpacing: 1 }}>{located.length} located · {sites.length} total</div>
        {located.map((s) => {
          const st = STATUS_STATES[s.status] || STATUS_STATES.unknown;
          const p = positions.get(s.id);
          const r = 5 + ((s.capacityKw || 0) / maxKwp) * 13;
          const active = hover === s.id;
          return (
            <button key={s.id} onClick={() => onOpen(s.id)} onMouseEnter={() => setHover(s.id)} onMouseLeave={() => setHover(null)}
              style={{
                position: 'absolute', left: `${p.x * 100}%`, top: `${p.y * 100}%`, width: r * 2, height: r * 2,
                marginLeft: -r, marginTop: -r, borderRadius: '50%', border: '2px solid #fff', background: st.dot,
                opacity: 0.85, cursor: 'pointer', boxShadow: active ? '0 0 0 4px rgba(92,128,152,0.25)' : 'var(--shadow-sm)',
                transition: 'box-shadow .15s, transform .15s', transform: active ? 'scale(1.18)' : 'scale(1)', zIndex: active ? 5 : 1, padding: 0,
              }} title={s.name} />
          );
        })}
        {hover && (() => {
          const s = located.find((x) => x.id === hover);
          const p = positions.get(hover);
          if (!s) return null;
          return (
            <div className="card" style={{ position: 'absolute', left: `${p.x * 100}%`, top: `${p.y * 100}%`, transform: `translate(${p.x > 0.6 ? '-108%' : '12px'}, -50%)`, padding: '8px 11px', zIndex: 6, pointerEvents: 'none', minWidth: 150 }}>
              <div style={{ fontWeight: 700, fontSize: '0.76rem' }}>{s.name}</div>
              {s.location && <div className="mono" style={{ fontSize: '0.6rem', color: 'var(--ink-light)', margin: '2px 0 5px' }}>{s.location}</div>}
              <div className="mono" style={{ fontSize: '0.66rem', color: STATUS_STATES[s.status].dot }}>{STATUS_STATES[s.status].label}</div>
            </div>
          );
        })()}
      </div>
      <div className="card scroll" style={{ overflow: 'auto', maxHeight: 560, padding: 6 }}>
        {located.map((s) => (
          <button key={s.id} onClick={() => onOpen(s.id)} onMouseEnter={() => setHover(s.id)} onMouseLeave={() => setHover(null)}
            style={{ width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 9, padding: '7px 9px', border: 'none', borderRadius: 7, background: hover === s.id ? 'var(--br-xlt)' : 'transparent', cursor: 'pointer' }}>
            <StatusGlyph status={s.status} size={18} />
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontWeight: 700, fontSize: '0.72rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}</span>
            </span>
            {s.capacityKw != null && <span className="mono" style={{ fontSize: '0.62rem', color: 'var(--ink-mid)' }}>{s.capacityKw.toFixed(0)}</span>}
          </button>
        ))}
        {unlocated.length > 0 && (
          <div className="mono" style={{ fontSize: '0.6rem', color: 'var(--ink-light)', padding: '10px 9px 4px', borderTop: '1px solid var(--line)', marginTop: 6 }}>
            {unlocated.length} site{unlocated.length === 1 ? '' : 's'} without location data
          </div>
        )}
      </div>
    </div>
  );
}

Object.assign(window, { SiteGrid, SiteTable, SiteMap, Legend, urgencyColor, flagClass, projectCoords });
