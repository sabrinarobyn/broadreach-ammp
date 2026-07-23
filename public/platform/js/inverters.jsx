/* ============================================================
   Broadreach Platform — per-inverter view (Site Deep Dive)
   Pulls real AMMP historic-data when the site is matched to a live
   AMMP asset; otherwise falls back to the seeded demo series.
   ============================================================ */
const { useState: _invUseState } = React;

const DAY_MS = 86400000;
function isoDate(d) { return d.toISOString().slice(0, 10); }
function clampRange(from, to) {
  let a = new Date(from + 'T00:00:00'), b = new Date(to + 'T00:00:00');
  if (b < a) b = new Date(a);
  if ((b - a) / DAY_MS > 6) b = new Date(a.getTime() + 6 * DAY_MS);
  return { from: isoDate(a), to: isoDate(b), days: Math.round((b - a) / DAY_MS) + 1 };
}

const METRIC_HUE = { power: null, current: 'var(--cyan)', voltage: 'var(--vio)', temp: 'var(--amb)' };

function InverterBlock({ site, inv, from, to, days, open, onToggle }) {
  const ammp = useAmmp();
  const [series, setSeries] = _invUseState(null);
  const [loadErr, setLoadErr] = _invUseState(null);

  React.useEffect(() => {
    if (!open) { setSeries(null); return; }
    let cancelled = false;
    setLoadErr(null);
    if (inv.real) {
      const dateFromIso = new Date(from + 'T00:00:00Z').toISOString();
      const dateToIso = new Date(to + 'T23:59:59Z').toISOString();
      ammp.seriesFor(inv.deviceId, dateFromIso, dateToIso, days)
        .then(s => { if (!cancelled) setSeries(s); })
        .catch(e => { if (!cancelled) { setLoadErr(e.message || 'Failed to load AMMP data'); setSeries(null); } });
    } else {
      setSeries(BR_DATA.inverterSeries(site.seed, inv.idx, from, days));
    }
    return () => { cancelled = true; };
  }, [site.seed, inv.idx, inv.real, inv.deviceId, from, to, days, open]);

  const [metrics, setMetrics] = _invUseState(['power', 'temp']);
  const [showStrings, setShowStrings] = _invUseState(false);
  const metricOrder = series && series.real ? ['power', 'temp'] : INV_METRIC_ORDER;
  const toggleMetric = (k) => setMetrics(p => {
    if (p.includes(k)) return p.length === 1 ? p : p.filter(m => m !== k);
    return [...metricOrder].filter(m => p.includes(m) || m === k);
  });

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
            {inv.real ? 'AMMP device' : inv.brand}{inv.ratedKw ? ` · rated ${inv.ratedKw} kW` : ''}{inv.strings ? ` · ${inv.strings} strings` : ''}{open && series ? ` · peak ${series.peakPower} kW · ${series.peakTemp}°C · ${series.energyKwh.toLocaleString()} kWh` : ''}
          </div>
        </div>
        {open && series && series.degradedString >= 0 && (
          <span className="mono" style={{ fontSize: '0.58rem', fontWeight: 600, color: 'var(--rd)', background: 'var(--rd-lt)', padding: '3px 8px', borderRadius: 6, whiteSpace: 'nowrap' }}>String {series.degradedString + 1} underperforming</span>
        )}
        <span className="btn btn-ghost btn-sm" style={{ pointerEvents: 'none' }}>{open ? 'Hide' : 'Show'}</span>
      </button>
      {open && loadErr && (
        <div className="mono" style={{ margin: '0 16px 14px', padding: '9px 11px', borderRadius: 8, background: 'var(--rd-lt)', color: 'var(--rd)', fontSize: '0.68rem' }}>✗ {loadErr}</div>
      )}
      {open && series && (
        <div style={{ padding: '0 16px 14px' }}>
          {/* per-device chart controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
            <span className="eyebrow" style={{ color: 'var(--ink-light)' }}>Compare</span>
            {metricOrder.map(k => {
              const on = metrics.includes(k), hue = METRIC_HUE[k] || inv.color;
              return (
                <button key={k} onClick={() => toggleMetric(k)} style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 20,
                  border: `1px solid ${on ? hue : 'var(--grey-lt)'}`, background: on ? '#fff' : 'var(--grey-xlt)',
                  fontFamily: 'var(--font-mono)', fontSize: '0.66rem', fontWeight: 600,
                  color: on ? 'var(--ink)' : 'var(--ink-light)', cursor: 'pointer',
                }}>
                  <span style={{ width: 14, height: 0, borderTop: `2px ${INV_METRICS[k].dash ? 'dashed' : 'solid'} ${on ? hue : '#C2C8CE'}` }}></span>
                  {INV_METRICS[k].label} <span style={{ opacity: 0.55 }}>({INV_METRICS[k].unit})</span>
                </button>
              );
            })}
            {!series.real && (
              <button onClick={() => setShowStrings(s => !s)} style={{
                marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, padding: '4px 11px 4px 8px', borderRadius: 20,
                border: `1px solid ${showStrings ? inv.color : 'var(--grey-lt)'}`, background: showStrings ? '#fff' : 'var(--grey-xlt)',
                fontFamily: 'var(--font-mono)', fontSize: '0.66rem', fontWeight: 600, color: showStrings ? 'var(--ink)' : 'var(--ink-light)', cursor: 'pointer',
              }}>
                <span style={{ width: 26, height: 15, borderRadius: 9, background: showStrings ? inv.color : '#C2C8CE', position: 'relative', transition: 'background 0.15s' }}>
                  <span style={{ position: 'absolute', top: 2, left: showStrings ? 13 : 2, width: 11, height: 11, borderRadius: '50%', background: '#fff', transition: 'left 0.15s' }}></span>
                </span>
                String monitoring
              </button>
            )}
          </div>
          <InverterChart series={series} invColor={inv.color} height={260} metrics={metrics} showStrings={showStrings && !series.real} />
          {series.real ? (
            <div className="mono" style={{ fontSize: '0.6rem', color: 'var(--ink-light)', marginTop: 8, textAlign: 'center' }}>Live from AMMP — power &amp; temperature only; per-string data isn't exposed by this endpoint.</div>
          ) : showStrings && (
            <div className="mono" style={{ fontSize: '0.6rem', color: 'var(--ink-light)', marginTop: 8, textAlign: 'center' }}>
              {series.nStrings} strings shown as thin lines (kW){series.degradedString >= 0 ? ` · string ${series.degradedString + 1} flagged in red` : ' · all balanced'}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function InverterSection({ site, live }) {
  const ammp = useAmmp();
  const asset = live ? ammp.assetFor(site) : null;
  const [meta, setMeta] = _invUseState(null);
  const [metaErr, setMetaErr] = _invUseState(null);

  React.useEffect(() => {
    let cancelled = false;
    setMetaErr(null);
    if (asset) {
      ammp.devicesFor(asset.asset_id).then(devices => {
        if (cancelled) return;
        if (!devices.length) { setMetaErr(`No PV inverters found on AMMP asset "${asset.asset_name}".`); setMeta(BR_DATA.invMeta(site.seed)); return; }
        const list = devices.map((d, i) => ({
          idx: i, name: d.device_name || `Inverter ${i + 1}`, brand: '', deviceId: d.device_id,
          color: BR_DATA.INV_COLORS[i % BR_DATA.INV_COLORS.length], ratedKw: null, strings: null, real: true,
        }));
        setMeta({ brand: asset.asset_name, count: list.length, list, real: true });
      }).catch(e => {
        if (cancelled) return;
        setMetaErr(e.message || 'Failed to load AMMP devices');
        setMeta(BR_DATA.invMeta(site.seed));
      });
    } else {
      setMeta(BR_DATA.invMeta(site.seed));
    }
    return () => { cancelled = true; };
  }, [site.seed, asset && asset.asset_id]);

  const [from, setFrom] = _invUseState('2026-06-10');
  const [to, setTo] = _invUseState('2026-06-10');
  const [open, setOpen] = _invUseState(new Set());

  // re-open all when the resolved inverter list changes
  React.useEffect(() => { if (meta) setOpen(new Set(meta.list.map(i => i.idx))); }, [meta]);

  if (!meta) return <div className="card" style={{ padding: 32, textAlign: 'center' }}><span className="mono" style={{ color: 'var(--ink-light)', fontSize: '0.72rem' }}>Loading inverters…</span></div>;

  const r = clampRange(from, to);
  const setFromSafe = (v) => { const c = clampRange(v, to); setFrom(c.from); setTo(c.to); };
  const setToSafe = (v) => { const c = clampRange(from, v); setFrom(c.from); setTo(c.to); };

  const toggle = (idx) => setOpen(p => { const n = new Set(p); n.has(idx) ? n.delete(idx) : n.add(idx); return n; });
  const allOpen = () => setOpen(new Set(meta.list.map(i => i.idx)));
  const noneOpen = () => setOpen(new Set());

  return (
    <div style={{ marginTop: 'var(--gap)' }}>
      {/* control card */}
      <div className="card" style={{ padding: '14px 18px', marginBottom: 'var(--gap)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', marginBottom: 12 }}>
          <span className="eyebrow" style={{ color: 'var(--br-dk)' }}>Inverter visibility</span>
          <span className="mono" style={{ fontSize: '0.6rem', color: 'var(--ink-light)' }}>{meta.count} inverters · {meta.real ? `live via AMMP (${meta.brand})` : `demo · ${meta.brand}`}</span>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span className="eyebrow">Date range</span>
            <input type="date" className="fld" value={from} onChange={e => setFromSafe(e.target.value)} style={{ fontSize: '0.72rem' }} />
            <span className="mono" style={{ color: 'var(--ink-light)', fontSize: '0.7rem' }}>→</span>
            <input type="date" className="fld" value={to} onChange={e => setToSafe(e.target.value)} style={{ fontSize: '0.72rem' }} />
            <span className="mono" style={{ fontSize: '0.6rem', color: r.days >= 7 ? 'var(--amb-dk)' : 'var(--ink-light)', background: r.days >= 7 ? 'var(--amb-lt)' : 'var(--grey-xlt)', padding: '3px 8px', borderRadius: 6, whiteSpace: 'nowrap' }}>{r.days}d · max 7</span>
          </div>
        </div>
        {metaErr && <div className="mono" style={{ fontSize: '0.66rem', color: 'var(--rd)', marginBottom: 10 }}>✗ {metaErr} Showing demo data instead.</div>}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <button className="btn btn-ghost btn-sm" onClick={open.size === meta.count ? noneOpen : allOpen}>{open.size === meta.count ? 'Hide all' : 'Show all'}</button>
          {meta.list.map(inv => {
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

      {/* per-inverter blocks */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap)' }}>
        {meta.list.map(inv => (
          <InverterBlock key={inv.idx} site={site} inv={inv} from={r.from} to={r.to} days={r.days} open={open.has(inv.idx)} onToggle={() => toggle(inv.idx)} />
        ))}
      </div>
    </div>
  );
}

Object.assign(window, { InverterSection });
