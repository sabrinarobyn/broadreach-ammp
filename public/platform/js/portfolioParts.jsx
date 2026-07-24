/* ============================================================
   Broadreach Platform — portfolio sub-views
   SiteTable · Legend
   ============================================================ */

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

/* ---------------- OPERATIONS TABLE (the only portfolio layout — list view) ---------------- */
function OmFlagCell({ site }) {
  const om = useOm();
  const flag = om.omFlagForAsset(site.id);
  if (!flag) return <span className="mono" style={{ color: 'var(--ink-light)' }}>—</span>;
  const c = OM_URGENCY_COLORS[flag.urgency.level] || OM_URGENCY_COLORS.none;
  const daysLabel = flag.urgency.daysAway < 0 ? `${Math.abs(flag.urgency.daysAway)}d overdue` : `${flag.urgency.daysAway}d`;
  return (
    <span className="mono" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: c.fg, fontSize: '0.66rem' }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: c.dot, flexShrink: 0 }}></span>{daysLabel}
    </span>
  );
}

function SiteTable({ sites, onOpen, sort, setSort }) {
  const cols = [
    { k: 'status', label: '', sortable: false, glyph: true },
    { k: 'name', label: 'Site Name' },
    { k: 'province', label: 'Province' },
    { k: 'capacityKw', label: 'PV kWp', num: true },
    { k: 'status', label: 'Status' },
    { k: 'lastDataAt', label: 'Last Updated' },
    { k: 'om', label: 'O&M', sortable: false },
  ];
  const arrow = (c) => (c.sortable !== false && sort.k === c.k ? (sort.dir > 0 ? ' ▲' : ' ▼') : '');
  const click = (c) => { if (c.sortable === false) return; setSort((p) => ({ k: c.k, dir: p.k === c.k ? -p.dir : 1 })); };

  // Live-ticking "now" so relative-time cells (Last Updated, last-alert time)
  // stay current without re-fetching — same clock-tick pattern as app.jsx's
  // TopBar, just on a slower 60s cadence since these deal in minutes/hours.
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="card scroll" style={{ overflow: 'auto' }}>
      <table className="ops-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.74rem', minWidth: 780 }}>
        <thead>
          <tr>
            {cols.map((c, i) => (
              <th key={i} onClick={() => click(c)} style={{
                background: 'var(--br)', color: '#fff', padding: '9px 12px', textAlign: c.num ? 'right' : 'left',
                fontSize: '0.58rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px',
                cursor: c.sortable === false ? 'default' : 'pointer', whiteSpace: 'nowrap', position: 'sticky', top: 0,
              }}>{c.label}{arrow(c)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sites.map((s) => {
            const st = STATUS_STATES[s.status] || STATUS_STATES.unknown;
            return (
              <tr key={s.id} onClick={() => onOpen(s.id)} style={{ cursor: 'pointer' }} className="ops-row">
                <td style={{ padding: '7px 10px', borderBottom: '1px solid var(--line)' }}><StatusGlyph status={s.status} size={20} /></td>
                <td style={{ padding: '7px 12px', borderBottom: '1px solid var(--line)', fontWeight: 700 }}>{s.name}</td>
                <td className="mono" style={{ padding: '7px 12px', borderBottom: '1px solid var(--line)', fontSize: '0.66rem', color: 'var(--ink-mid)' }}>{s.province || '—'}</td>
                <td className="mono" style={{ padding: '7px 12px', borderBottom: '1px solid var(--line)', textAlign: 'right' }}>{s.capacityKw != null ? s.capacityKw.toFixed(1) : '—'}</td>
                <td className="mono" style={{ padding: '7px 12px', borderBottom: '1px solid var(--line)', fontSize: '0.66rem', color: st.dot, fontWeight: 700 }}>
                  {st.label}
                  {s.status === 'alert' && s.lastAlertAt && (
                    <div title={formatSAST(s.lastAlertAt)} style={{ fontWeight: 400, fontSize: '0.6rem', color: 'var(--ink-light)', marginTop: 2 }}>
                      {formatRelativeTime(s.lastAlertAt, now)}
                    </div>
                  )}
                </td>
                <td className="mono" title={s.lastDataAt ? formatSAST(s.lastDataAt) : ''} style={{ padding: '7px 12px', borderBottom: '1px solid var(--line)', fontSize: '0.64rem', color: 'var(--ink-mid)' }}>{s.lastDataAt ? formatRelativeTime(s.lastDataAt, now) : '—'}</td>
                <td style={{ padding: '7px 12px', borderBottom: '1px solid var(--line)' }}><OmFlagCell site={s} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ---------------- SITES NOT ON AMMP (placeholder) ---------------- */
/* Config-driven, not wired to any real data source yet — see js/offAmmpConfig.jsx. */
function OffAmmpPanel() {
  const list = (typeof OFF_AMMP_SITES !== 'undefined' && Array.isArray(OFF_AMMP_SITES)) ? OFF_AMMP_SITES : [];
  if (!list.length) return null;
  return (
    <div style={{ marginTop: 8 }}>
      <SectionHead title="Sites not on AMMP" note={`${list.length} site${list.length === 1 ? '' : 's'}`} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 'var(--gap)' }}>
        {list.map((site, i) => (
          <div key={i} className="card" style={{
            padding: '14px 16px', borderTop: '3px dashed var(--grey-lt)', background: 'var(--grey-xlt)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span className="mono" style={{
                fontSize: '0.58rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px',
                color: 'var(--ink-light)', background: '#fff', border: '1px solid var(--grey-lt)', padding: '2px 7px', borderRadius: 20,
              }}>Not connected</span>
            </div>
            <div style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: 10 }}>{site.name}</div>
            {site.url && (
              <a href={site.url} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm" style={{ display: 'inline-flex' }}>
                View on external platform ↗
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

Object.assign(window, { SiteTable, Legend, OffAmmpPanel });
