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

/* ---- Area / line chart with hover ---- */
function FlowChart({ data, keys, height = 320 }) {
  const [ref, w] = useWidth();
  const [hover, setHover] = _useState(null);
  const padL = 42, padR = 16, padT = 16, padB = 30;
  const W = Math.max(320, w), H = height;
  const iw = W - padL - padR, ih = H - padT - padB;
  const pts = data.pts;
  const maxV = Math.max(...pts.flatMap(p => keys.map(k => p[k.k]))) * 1.12 || 1;
  const x = (i) => padL + (pts.length === 1 ? iw / 2 : (i / (pts.length - 1)) * iw);
  const y = (v) => padT + ih - (v / maxV) * ih;

  const yticks = 4;
  const gridY = Array.from({ length: yticks + 1 }, (_, i) => (maxV / yticks) * i);

  const onMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width * W;
    let best = 0, bd = 1e9;
    pts.forEach((p, i) => { const d = Math.abs(x(i) - px); if (d < bd) { bd = d; best = i; } });
    setHover(best);
  };

  return (
    <div ref={ref} style={{ width: '100%', position: 'relative' }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} style={{ display: 'block', overflow: 'visible' }}
           onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
        <defs>
          {keys.map((k, ki) => (
            <linearGradient key={ki} id={`grad-${ki}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={k.c} stopOpacity="0.26" />
              <stop offset="100%" stopColor={k.c} stopOpacity="0.01" />
            </linearGradient>
          ))}
        </defs>
        {gridY.map((g, i) => (
          <g key={i}>
            <line x1={padL} x2={W - padR} y1={y(g)} y2={y(g)} stroke="#EAEEF1" strokeWidth="1" strokeDasharray={i === 0 ? '0' : '3 4'} />
            <text x={padL - 8} y={y(g) + 3} textAnchor="end" fontSize="10" fontFamily="var(--font-mono)" fill="#9AA4AE">{Math.round(g)}</text>
          </g>
        ))}
        {keys.map((k, ki) => {
          const linePts = pts.map((p, i) => ({ x: x(i), y: y(p[k.k]) }));
          const dLine = smoothPath(linePts);
          const dArea = dLine + ` L ${x(pts.length - 1)} ${y(0)} L ${x(0)} ${y(0)} Z`;
          return (
            <g key={ki}>
              {k.fill !== false && <path d={dArea} fill={`url(#grad-${ki})`} />}
              <path d={dLine} fill="none" stroke={k.c} strokeWidth={k.w || 2.4} strokeLinejoin="round" strokeLinecap="round" />
            </g>
          );
        })}
        {pts.map((p, i) => i % Math.ceil(pts.length / 12) === 0 || i === pts.length - 1 ? (
          <text key={i} x={x(i)} y={H - 9} textAnchor="middle" fontSize="10" fontFamily="var(--font-mono)" fill="#9AA4AE">{p.label}</text>
        ) : null)}
        {hover !== null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={padT} y2={padT + ih} stroke="#B9C3CB" strokeWidth="1" strokeDasharray="3 3" />
            {keys.map((k, ki) => (
              <circle key={ki} cx={x(hover)} cy={y(pts[hover][k.k])} r="4" fill="#fff" stroke={k.c} strokeWidth="2.5" />
            ))}
          </g>
        )}
      </svg>
      {hover !== null && (
        <div style={{
          position: 'absolute', top: 8, left: `clamp(8px, ${(x(hover) / W) * 100}%, calc(100% - 168px))`,
          background: 'var(--br-dker)', color: '#fff', borderRadius: 8, padding: '8px 10px',
          fontSize: 11, pointerEvents: 'none', boxShadow: 'var(--shadow-md)', minWidth: 150, zIndex: 3,
        }}>
          <div style={{ fontFamily: 'var(--font-mono)', opacity: 0.7, marginBottom: 4, fontSize: 10 }}>{pts[hover].label}</div>
          {keys.map((k, ki) => (
            <div key={ki} style={{ display: 'flex', justifyContent: 'space-between', gap: 14, lineHeight: 1.6 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: k.c }}></span>{k.label}
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{pts[hover][k.k].toLocaleString()} {data.unit}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---- Donut gauge (SOC etc) ---- */
function Donut({ value, size = 116, stroke = 12, color = 'var(--amb)', track = '#EEF1F4', label, sub }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const off = c * (1 - value / 100);
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
                strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round"
                style={{ transition: 'stroke-dashoffset 0.9s cubic-bezier(.22,1,.36,1)' }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div className="display" style={{ fontSize: size * 0.27, color: 'var(--ink)' }}>{label}</div>
        {sub && <div className="mono" style={{ fontSize: 9, color: 'var(--ink-light)', letterSpacing: 1 }}>{sub}</div>}
      </div>
    </div>
  );
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
          {showStrings && pts[0].strings && (
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginTop: 4, paddingTop: 4, borderTop: '1px solid rgba(255,255,255,0.16)' }}>
              <span style={{ opacity: 0.8 }}>Strings ({series.nStrings})</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{Math.min(...pts[hover].strings).toFixed(1)}–{Math.max(...pts[hover].strings).toFixed(1)} kW</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

Object.assign(window, { FlowChart, Donut, Spark, MiniBars, useWidth, InverterChart, INV_METRICS, INV_METRIC_ORDER });
