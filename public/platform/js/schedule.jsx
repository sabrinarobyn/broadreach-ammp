/* ============================================================
   Broadreach Platform — O&M Schedule (sortable + actionable)
   ============================================================ */

const { useState: _useState } = React;

function Schedule({ onOpen }) {
  const [sort, setSort] = _useState({ k: 'daysAway', dir: 1 });
  const [win, setWin] = _useState('90');
  const [done, setDone] = _useState(() => new Set());
  const [toast, setToast] = _useState(null);

  const rows = React.useMemo(() => {
    let r = BR_DATA.schedule.slice();
    if (win !== 'all') r = r.filter(x => x.daysAway <= +win);
    r.sort((a, b) => {
      let av = a[sort.k], bv = b[sort.k];
      if (sort.k === 'date') { av = a.daysAway; bv = b.daysAway; }
      if (typeof av === 'string') return av.localeCompare(bv) * sort.dir;
      return (av - bv) * sort.dir;
    });
    return r;
  }, [sort, win]);

  const flash = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2200); };
  const markDone = (id, task, site) => {
    setDone(p => { const n = new Set(p); const key = id + task; n.has(key) ? n.delete(key) : n.add(key); return n; });
    flash(`${task} at ${site} marked complete`);
  };

  const cols = [
    { k: 'site', label: 'Site' }, { k: 'province', label: 'Province' },
    { k: 'contract', label: 'Contract', center: true }, { k: 'kwp', label: 'PV kWp', num: true },
    { k: 'task', label: 'Task' }, { k: 'epc', label: 'EPC' },
    { k: 'date', label: 'Scheduled', num: true }, { k: 'daysAway', label: 'Days away', num: true },
  ];
  const arrow = (k) => sort.k === k ? (sort.dir > 0 ? ' ▲' : ' ▼') : '';

  const counts = {
    '30': BR_DATA.schedule.filter(x => x.daysAway <= 30).length,
    '60': BR_DATA.schedule.filter(x => x.daysAway <= 60).length,
    '90': BR_DATA.schedule.filter(x => x.daysAway <= 90).length,
    all: BR_DATA.schedule.length,
  };

  return (
    <div>
      <SectionHead title="Upcoming O&M Schedule" note={`${rows.length} task${rows.length === 1 ? '' : 's'}`}
        right={
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span className="eyebrow">Window</span>
            {[['30', '≤30d'], ['60', '≤60d'], ['90', '≤90d'], ['all', 'All']].map(([v, l]) => (
              <button key={v} onClick={() => setWin(v)} className="seg-btn" data-on={win === v}>{l} <span style={{ opacity: 0.6 }}>{counts[v]}</span></button>
            ))}
          </div>
        } />
      <div className="card scroll" style={{ overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.74rem', minWidth: 900 }}>
          <thead>
            <tr>
              {cols.map(c => (
                <th key={c.k} onClick={() => setSort(p => ({ k: c.k, dir: p.k === c.k ? -p.dir : 1 }))} style={{
                  background: 'var(--br)', color: '#fff', padding: '9px 12px', textAlign: c.num ? 'right' : c.center ? 'center' : 'left',
                  fontSize: '0.58rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px', cursor: 'pointer', whiteSpace: 'nowrap', position: 'sticky', top: 0,
                }}>{c.label}{arrow(c.k)}</th>
              ))}
              <th style={{ background: 'var(--br)', color: '#fff', padding: '9px 12px', position: 'sticky', top: 0, textAlign: 'right', fontSize: '0.58rem', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const isDone = done.has(r.id + r.task);
              return (
                <tr key={r.id + r.task + i} style={{ background: isDone ? 'var(--grn-lt)' : (i % 2 ? 'var(--grey-xlt)' : '#fff'), opacity: isDone ? 0.72 : 1 }}>
                  <td style={{ padding: '7px 12px', borderBottom: '1px solid var(--line)', fontWeight: 700, textDecoration: isDone ? 'line-through' : 'none' }}>{r.site}</td>
                  <td className="mono" style={{ padding: '7px 12px', borderBottom: '1px solid var(--line)', fontSize: '0.66rem', color: 'var(--ink-mid)' }}>{r.province}</td>
                  <td style={{ padding: '7px 12px', borderBottom: '1px solid var(--line)', textAlign: 'center' }}><ContractTag c={r.contract} /></td>
                  <td className="mono" style={{ padding: '7px 12px', borderBottom: '1px solid var(--line)', textAlign: 'right' }}>{r.kwp.toFixed(1)}</td>
                  <td style={{ padding: '7px 12px', borderBottom: '1px solid var(--line)' }}>{r.task}</td>
                  <td className="mono" style={{ padding: '7px 12px', borderBottom: '1px solid var(--line)', fontSize: '0.66rem', color: 'var(--ink-mid)' }}>{r.epc}</td>
                  <td className="mono" style={{ padding: '7px 12px', borderBottom: '1px solid var(--line)', textAlign: 'right', color: 'var(--ink-mid)' }}>{BR_DATA.monthLabel(r.date)}</td>
                  <td style={{ padding: '7px 12px', borderBottom: '1px solid var(--line)', textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: urgencyColor(r.daysAway), marginRight: 7 }}></span>
                    <strong className="mono">{r.daysAway}</strong> <span className="mono" style={{ color: 'var(--ink-light)', fontSize: '0.6rem' }}>days</span>
                  </td>
                  <td style={{ padding: '7px 12px', borderBottom: '1px solid var(--line)', textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => onOpen(r.id)} style={{ marginRight: 6 }}>Open</button>
                    <button className="btn btn-sm" data-done={isDone} onClick={() => markDone(r.id, r.task, r.site)} style={isDone ? { background: 'var(--grn)' } : {}}>{isDone ? '✓ Done' : 'Mark done'}</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {toast && (
        <div style={{ position: 'fixed', bottom: 22, left: '50%', transform: 'translateX(-50%)', background: 'var(--br-dker)', color: '#fff', padding: '10px 18px', borderRadius: 9, fontSize: '0.78rem', boxShadow: 'var(--shadow-lg)', zIndex: 200, animation: 'brFadeUp .25s ease' }}>{toast}</div>
      )}
    </div>
  );
}

Object.assign(window, { Schedule });
