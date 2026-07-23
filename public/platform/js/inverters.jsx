/* ============================================================
   Broadreach Platform — per-inverter view (Site Deep Dive)
   Always real: every site is a real AMMP asset, so this fetches real
   devices and real historic-data/pv-inverter series — no fallback path.
   ============================================================ */
const { useState: _invUseState, useEffect: _invUseEffect } = React;

const INV_COLORS = ['#C86A1A', '#5d809a', '#4e7d3a', '#6D4AC2', '#1B7E8C', '#d34a5e', '#B58A00', '#315EDC', '#0E7C5A', '#A23E8C', '#7A6CCC', '#3E7C7C'];

const INV_DAY_MS = 86400000;
function invIsoDate(d) { return d.toISOString().slice(0, 10); }
function clampRange(from, to) {
  let a = new Date(from + 'T00:00:00'), b = new Date(to + 'T00:00:00');
  if (b < a) b = new Date(a);
  if ((b - a) / INV_DAY_MS > 6) b = new Date(a.getTime() + 6 * INV_DAY_MS);
  return { from: invIsoDate(a), to: invIsoDate(b), days: Math.round((b - a) / INV_DAY_MS) + 1 };
}

function InverterBlock({ inv, from, to, days, open, onToggle }) {
  const ammp = useAmmp();
  const [series, setSeries] = _invUseState(null);
  const [loadErr, setLoadErr] = _invUseState(null);

  _invUseEffect(() => {
    if (!open) { setSeries(null); return; }
    let cancelled = false;
    setLoadErr(null);
    const dateFromIso = new Date(from + 'T00:00:00Z').toISOString();
    const dateToIso = new Date(to + 'T23:59:59Z').toISOString();
    ammp.inverterSeriesFor(inv.deviceId, dateFromIso, dateToIso, days)
      .then((s) => { if (!cancelled) setSeries(s); })
      .catch((e) => { if (!cancelled) { setLoadErr(e.message || 'Failed to load AMMP data'); setSeries(null); } });
    return () => { cancelled = true; };
  }, [inv.deviceId, from, to, days, open]);

  return (
    <div className="card" style={{ overflow: 'hidden', borderTop: `3px solid ${inv.color}` }}>
      <button onClick={onToggle} style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
        background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer',
      }}>
        <span style={{ width: 12, height: 12, borderRadius: 3, background: inv.color, flexShrink: 0 }}></span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="display" style={{ fontSize: '1.05rem', color: 'var(--br-dker)', letterSpacing: '0.6px' }}>{inv.name}</div>
          <div className="mono" style={{ fontSize: '0.6rem', color: 'var(--ink-light)' }}>
            {open && series ? `peak ${series.peakPower} kW${series.peakTemp != null ? ` · ${series.peakTemp}°C` : ''} · ${series.energyKwh.toLocaleString()} kWh` : 'AMMP device'}
          </div>
        </div>
        <span className="btn btn-ghost btn-sm" style={{ pointerEvents: 'none' }}>{open ? 'Hide' : 'Show'}</span>
      </button>
      {open && loadErr && (
        <div className="mono" style={{ margin: '0 16px 14px', padding: '9px 11px', borderRadius: 8, background: 'var(--rd-lt)', color: 'var(--rd)', fontSize: '0.68rem' }}>✗ {loadErr}</div>
      )}
      {open && series && !loadErr && (series.pts.length === 0
        ? <div style={{ padding: '0 16px 14px' }}><EmptyState title="No power/temperature data for this range." /></div>
        : (
          <div style={{ padding: '0 16px 14px' }}>
            <InverterChart series={series} invColor={inv.color} height={260} metrics={series.peakTemp != null ? ['power', 'temp'] : ['power']} />
            <div className="mono" style={{ fontSize: '0.6rem', color: 'var(--ink-light)', marginTop: 8, textAlign: 'center' }}>Live from AMMP — power{series.peakTemp != null ? ' & temperature' : ''} only; per-string data isn't confirmed available from this endpoint.</div>
          </div>
        ))}
    </div>
  );
}

function InverterSection({ site }) {
  const ammp = useAmmp();
  const [devices, setDevices] = _invUseState(null);
  const [err, setErr] = _invUseState(null);
  const [from, setFrom] = _invUseState(() => invIsoDate(new Date()));
  const [to, setTo] = _invUseState(() => invIsoDate(new Date()));
  const [open, setOpen] = _invUseState(new Set());

  _invUseEffect(() => {
    let cancelled = false;
    setDevices(null); setErr(null);
    ammp.devicesFor(site.id, DEVICE_TYPE.INVERTER).then((list) => {
      if (cancelled) return;
      setDevices(list);
      setOpen(new Set(list.map((_, i) => i)));
    }).catch((e) => { if (!cancelled) { setErr(e.message); setDevices([]); } });
    return () => { cancelled = true; };
  }, [site.id]);

  if (devices === null) return <Loading label="Loading inverters…" />;
  if (err) return <div className="card" style={{ padding: 16 }}><ErrorNote message={err} /></div>;
  if (!devices.length) return <EmptyState title="No inverters found for this site." />;

  const meta = devices.map((d, i) => ({ idx: i, name: d.device_name || `Inverter ${i + 1}`, deviceId: d.device_id, color: INV_COLORS[i % INV_COLORS.length] }));
  const r = clampRange(from, to);
  const setFromSafe = (v) => { const c = clampRange(v, to); setFrom(c.from); setTo(c.to); };
  const setToSafe = (v) => { const c = clampRange(from, v); setFrom(c.from); setTo(c.to); };
  const toggle = (idx) => setOpen((p) => { const n = new Set(p); n.has(idx) ? n.delete(idx) : n.add(idx); return n; });
  const allOpen = () => setOpen(new Set(meta.map((i) => i.idx)));
  const noneOpen = () => setOpen(new Set());

  return (
    <div style={{ marginTop: 'var(--gap)' }}>
      <div className="card" style={{ padding: '14px 18px', marginBottom: 'var(--gap)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', marginBottom: 12 }}>
          <span className="eyebrow" style={{ color: 'var(--br-dk)' }}>Inverter visibility</span>
          <span className="mono" style={{ fontSize: '0.6rem', color: 'var(--ink-light)' }}>{meta.length} inverters</span>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span className="eyebrow">Date range</span>
            <input type="date" className="fld" value={from} onChange={(e) => setFromSafe(e.target.value)} style={{ fontSize: '0.72rem' }} />
            <span className="mono" style={{ color: 'var(--ink-light)', fontSize: '0.7rem' }}>→</span>
            <input type="date" className="fld" value={to} onChange={(e) => setToSafe(e.target.value)} style={{ fontSize: '0.72rem' }} />
            <span className="mono" style={{ fontSize: '0.6rem', color: r.days >= 7 ? 'var(--amb-dk)' : 'var(--ink-light)', background: r.days >= 7 ? 'var(--amb-lt)' : 'var(--grey-xlt)', padding: '3px 8px', borderRadius: 6, whiteSpace: 'nowrap' }}>{r.days}d · max 7</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <button className="btn btn-ghost btn-sm" onClick={open.size === meta.length ? noneOpen : allOpen}>{open.size === meta.length ? 'Hide all' : 'Show all'}</button>
          {meta.map((inv) => {
            const on = open.has(inv.idx);
            return (
              <button key={inv.idx} onClick={() => toggle(inv.idx)} style={{
                display: 'flex', alignItems: 'center', gap: 7, padding: '5px 11px', borderRadius: 20,
                border: `1px solid ${on ? inv.color : 'var(--grey-lt)'}`, background: on ? '#fff' : 'var(--grey-xlt)',
                fontFamily: 'var(--font-mono)', fontSize: '0.68rem', fontWeight: 600, color: on ? 'var(--ink)' : 'var(--ink-light)', cursor: 'pointer',
              }}>
                <span style={{ width: 9, height: 9, borderRadius: '50%', background: on ? inv.color : '#C2C8CE' }}></span>{inv.name}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap)' }}>
        {meta.map((inv) => (
          <InverterBlock key={inv.idx} inv={inv} from={r.from} to={r.to} days={r.days} open={open.has(inv.idx)} onToggle={() => toggle(inv.idx)} />
        ))}
      </div>
    </div>
  );
}

Object.assign(window, { InverterSection });
