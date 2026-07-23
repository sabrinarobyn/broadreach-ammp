/* ============================================================
   Broadreach Platform — chart primitives (SVG). Exposed to window.
   ============================================================ */
const { useRef: _useRef, useState: _useState, useEffect: _useEffect } = React;

/* hook: measure container width */
function useWidth() {
  const ref = _useRef(null);
  const [w, setW] = _useState(800);
  _useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver((es) => { for (const e of es) setW(e.contentRect.width); });
    ro.observe(ref.current);
    setW(ref.current.clientWidth);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

function smoothPath(pts) {
  if (pts.length < 2) return '';
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i], p1 = pts[i + 1];
    const cx = (p0.x + p1.x) / 2;
    d += ` C ${cx} ${p0.y}, ${cx} ${p1.y}, ${p1.x} ${p1.y}`;
  }
  return d;
}

/* ---- Mini sparkline ---- */
function Spark({ values, color = 'var(--br)', w = 96, h = 30, fill = true, full = false }) {
  const W = full ? 300 : w;
  const max = Math.max(...values), min = Math.min(...values);
  const rng = max - min || 1;
  const pts = values.map((v, i) => ({ x: (i / (values.length - 1)) * W, y: h - 3 - ((v - min) / rng) * (h - 6) }));
  const d = smoothPath(pts);
  return (
    <svg width={full ? '100%' : w} height={h} viewBox={`0 0 ${W} ${h}`}
         preserveAspectRatio={full ? 'none' : 'xMidYMid meet'}
         style={{ display: 'block', overflow: 'visible' }}>
      {fill && <path d={d + ` L ${W} ${h} L 0 ${h} Z`} fill={color} opacity="0.12" />}
      <path d={d} fill="none" stroke={color} strokeWidth={full ? 1.4 : 1.8} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/* ---- Tiny bar series ---- */
function MiniBars({ values, color = 'var(--grn)', h = 44 }) {
  const max = Math.max(...values) || 1;
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: h }}>
      {values.map((v, i) => (
        <div key={i} style={{ flex: 1, height: `${(v / max) * 100}%`, background: color, borderRadius: 3, minHeight: 3, opacity: 0.55 + (v / max) * 0.45 }}></div>
      ))}
    </div>
  );
}

/* ---- Per-inverter metric catalogue ---- */
const INV_METRICS = {
  power:   { key: 'power',   label: 'Power',       unit: 'kW', color: null,          dash: false, get: p => p.power,   dom: s => [0, Math.max(5, Math.ceil(s.peakPower / 5) * 5)] },
  current: { key: 'current', label: 'Current',     unit: 'A',  color: 'var(--cyan)', dash: false, get: p => p.current, dom: s => [0, Math.max(10, Math.ceil(s.peakCurrent / 10) * 10)] },
  voltage: { key: 'voltage', label: 'Voltage',     unit: 'V',  color: 'var(--vio)',  dash: true,  get: p => p.voltage, dom: s => [0, Math.max(100, Math.ceil(s.peakVoltage / 100) * 100)] },
  temp:    { key: 'temp',    label: 'Temperature', unit: '°C', color: 'var(--amb)',  dash: true,  get: p => p.temp,    dom: s => { const mx = Math.max(20, Math.ceil(s.peakTemp / 10) * 10); return [Math.min(mx - 10, Math.floor(s.minTemp / 10) * 10), mx]; } },
};
const INV_METRIC_ORDER = ['power', 'current', 'voltage', 'temp'];

/* ---- Configurable per-inverter chart: pick metrics + optional string monitoring ---- */
function InverterChart({ series, invColor = 'var(--br)', height = 280, metrics = ['power', 'temp'], showStrings = false }) {
  const [ref, w] = useWidth();
  const [hover, setHover] = _useState(null);
  const pts = series.pts;
  const padL = 46, padR = 48, padT = 14, padB = 28;
  const W = Math.max(360, w), H = height;
  const iw = W - padL - padR, ih = H - padT - padB;

  const cfgs = metrics.map(k => INV_METRICS[k]).filter(Boolean).map(c => ({ ...c, color: c.color || invColor }));
  const doms = cfgs.map(c => c.dom(series));
  const normalized = cfgs.length > 2;              // >2 units → single 0–100% axis
  const leftC = cfgs[0] || null, rightC = normalized ? null : cfgs[1] || null;

  const x = (i) => padL + (pts.length === 1 ? iw / 2 : (i / (pts.length - 1)) * iw);
  const frac = (ci, v) => { const [a, b] = doms[ci]; return b === a ? 0 : (v - a) / (b - a); };
  const y = (ci, v) => padT + ih - frac(ci, v) * ih;

  // string axis always mapped in kW against peak power
  const strMax = Math.max(1, INV_METRICS.power.dom(series)[1]);
  const yStr = (v) => padT + ih - (v / strMax) * ih;

  const ticks = 5;
  const labelStep = Math.max(1, Math.ceil(pts.length / 9));
  const fmt = (v) => Math.abs(v) >= 100 ? Math.round(v) : (Math.round(v * 10) / 10);

  const onMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width * W;
    let best = 0, bd = 1e9;
    pts.forEach((p, i) => { const d = Math.abs(x(i) - px); if (d < bd) { bd = d; best = i; } });
    setHover(best);
  };

  const leftDom = leftC ? doms[cfgs.indexOf(leftC)] : [0, 1];
  const rightDom = rightC ? doms[cfgs.indexOf(rightC)] : null;

  return (
    <div ref={ref} style={{ width: '100%', position: 'relative' }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} style={{ display: 'block', overflow: 'visible' }}
           onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
        {Array.from({ length: ticks + 1 }, (_, i) => {
          const yy = padT + ih - (i / ticks) * ih;
          const lv = normalized ? `${Math.round((i / ticks) * 100)}%` : fmt(leftDom[0] + (i / ticks) * (leftDom[1] - leftDom[0]));
          const rv = rightDom ? fmt(rightDom[0] + (i / ticks) * (rightDom[1] - rightDom[0])) : null;
          return (
            <g key={i}>
              <line x1={padL} x2={W - padR} y1={yy} y2={yy} stroke="#EAEEF1" strokeWidth="1" strokeDasharray={i === 0 ? '0' : '3 4'} />
              <text x={padL - 8} y={yy + 3} textAnchor="end" fontSize="10" fontFamily="var(--font-mono)" fill={normalized ? '#9AA4AE' : (leftC ? leftC.color : '#9AA4AE')} opacity="0.85">{lv}</text>
              {rv !== null && <text x={W - padR + 8} y={yy + 3} textAnchor="start" fontSize="10" fontFamily="var(--font-mono)" fill={rightC.color} opacity="0.85">{rv}</text>}
            </g>
          );
        })}
        {pts.map((p, i) => i % labelStep === 0 || i === pts.length - 1 ? (
          <text key={i} x={x(i)} y={H - 8} textAnchor="middle" fontSize="9.5" fontFamily="var(--font-mono)" fill="#9AA4AE">{p.short}</text>
        ) : null)}

        {/* string monitoring: faint per-string power lines */}
        {showStrings && pts[0].strings && pts[0].strings.map((_, s) => {
          const isBad = s === series.degradedString;
          const path = smoothPath(pts.map((p, i) => ({ x: x(i), y: yStr(p.strings[s]) })));
          return <path key={`str${s}`} d={path} fill="none" stroke={isBad ? 'var(--rd)' : invColor} strokeWidth={isBad ? 1.6 : 1} opacity={isBad ? 0.9 : 0.32} strokeDasharray={isBad ? '4 3' : '0'} strokeLinecap="round" />;
        })}

        {/* selected metric lines */}
        {cfgs.map((c, ci) => (
          <path key={c.key} d={smoothPath(pts.map((p, i) => ({ x: x(i), y: y(ci, c.get(p)) })))}
                fill="none" stroke={c.color} strokeWidth={c.key === 'power' ? 2.4 : 1.9}
                strokeDasharray={c.dash ? '5 4' : '0'} opacity={c.dash ? 0.82 : 1} strokeLinecap="round" strokeLinejoin="round" />
        ))}

        {hover !== null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={padT} y2={padT + ih} stroke="#B9C3CB" strokeWidth="1" strokeDasharray="3 3" />
            {cfgs.map((c, ci) => (
              <circle key={c.key} cx={x(hover)} cy={y(ci, c.get(pts[hover]))} r="3.6" fill="#fff" stroke={c.color} strokeWidth="2.4" />
            ))}
          </g>
        )}
      </svg>

      {normalized && <div className="mono" style={{ position: 'absolute', left: padL, top: -2, fontSize: 8.5, color: '#9AA4AE', letterSpacing: '0.3px' }}>NORMALISED · % of peak</div>}
      {!normalized && leftC && <div className="mono" style={{ position: 'absolute', left: padL, bottom: -2, fontSize: 9, color: leftC.color }}>{leftC.unit}</div>}
      {!normalized && rightC && <div className="mono" style={{ position: 'absolute', right: 2, bottom: -2, fontSize: 9, color: rightC.color }}>{rightC.unit}</div>}

      {hover !== null && (
        <div style={{
          position: 'absolute', top: 6, left: `clamp(8px, ${(x(hover) / W) * 100}%, calc(100% - 186px))`,
          background: 'var(--br-dker)', color: '#fff', borderRadius: 8, padding: '8px 10px',
          fontSize: 11, pointerEvents: 'none', boxShadow: 'var(--shadow-md)', minWidth: 168, zIndex: 3,
        }}>
          <div style={{ fontFamily: 'var(--font-mono)', opacity: 0.7, marginBottom: 4, fontSize: 10 }}>{pts[hover].label}</div>
          {cfgs.map(c => (
            <div key={c.key} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginTop: 2 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 12, height: 0, borderTop: `${c.dash ? '2px dashed' : '2px solid'} ${c.color}` }}></span>{c.label}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{c.get(pts[hover])} {c.unit}</span>
            </div>
          ))}
          {showStrings && pts[0].strings && (() => {
            const vals = pts[hover].strings.filter((v) => v != null);
            return vals.length ? (
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginTop: 4, paddingTop: 4, borderTop: '1px solid rgba(255,255,255,0.16)' }}>
                <span style={{ opacity: 0.8 }}>Strings ({series.nStrings})</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{Math.min(...vals).toFixed(1)}–{Math.max(...vals).toFixed(1)} kW</span>
              </div>
            ) : null;
          })()}
        </div>
      )}
    </div>
  );
}

/* ---- Scatter chart: AC power vs inverter temperature, one series per inverter ---- */
function ScatterChart({ series, height = 360 }) {
  const [ref, w] = useWidth();
  const padL = 46, padR = 16, padT = 16, padB = 34;
  const W = Math.max(320, w), H = height;
  const iw = W - padL - padR, ih = H - padT - padB;

  const allPts = series.flatMap(s => s.pts.filter(p => p.temp).map(p => ({ x: p.temp, y: p.power, color: s.color })));
  if (!allPts.length) {
    return <div className="mono" style={{ padding: 32, textAlign: 'center', color: 'var(--ink-light)', fontSize: '0.72rem' }}>No matched power/temperature points in this range.</div>;
  }
  const maxX = Math.max(...allPts.map(p => p.x)) * 1.08 || 1;
  const minX = Math.min(0, Math.min(...allPts.map(p => p.x)));
  const maxY = Math.max(...allPts.map(p => p.y)) * 1.12 || 1;
  const x = (v) => padL + ((v - minX) / (maxX - minX || 1)) * iw;
  const y = (v) => padT + ih - (v / maxY) * ih;
  const ticks = 5;

  return (
    <div ref={ref} style={{ width: '100%' }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} style={{ display: 'block' }}>
        {Array.from({ length: ticks + 1 }, (_, i) => {
          const yy = padT + ih - (i / ticks) * ih;
          return (
            <g key={i}>
              <line x1={padL} x2={W - padR} y1={yy} y2={yy} stroke="#EAEEF1" strokeWidth="1" strokeDasharray={i === 0 ? '0' : '3 4'} />
              <text x={padL - 8} y={yy + 3} textAnchor="end" fontSize="10" fontFamily="var(--font-mono)" fill="#9AA4AE">{Math.round(maxY * (i / ticks))}</text>
            </g>
          );
        })}
        {Array.from({ length: ticks + 1 }, (_, i) => {
          const xx = padL + (i / ticks) * iw;
          const v = minX + (i / ticks) * (maxX - minX);
          return <text key={i} x={xx} y={H - 10} textAnchor="middle" fontSize="10" fontFamily="var(--font-mono)" fill="#9AA4AE">{Math.round(v)}</text>;
        })}
        {allPts.map((p, i) => <circle key={i} cx={x(p.x)} cy={y(p.y)} r="3" fill={p.color} opacity="0.65" />)}
      </svg>
      <div className="mono" style={{ textAlign: 'center', fontSize: '0.62rem', color: 'var(--ink-light)', marginTop: 4 }}>X: inverter temperature (°C) · Y: AC power (kW)</div>
    </div>
  );
}

Object.assign(window, { Spark, MiniBars, useWidth, InverterChart, INV_METRICS, INV_METRIC_ORDER, ScatterChart });
