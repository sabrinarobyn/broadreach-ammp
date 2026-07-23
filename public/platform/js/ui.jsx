/* ============================================================
   Broadreach Platform — shared UI atoms
   ============================================================ */

function StatusGlyph({ status, live, size = 26 }) {
  const st = BR_DATA.STATES[status] || BR_DATA.STATES.unknown;
  if (!live) {
    return (
      <span title="Connect AMMP for live status" style={{
        width: size, height: size, borderRadius: '50%', background: '#EEF1F4',
        border: '1px dashed #CBD2D8', display: 'inline-flex', alignItems: 'center',
        justifyContent: 'center', flexShrink: 0,
      }}>
        <span style={{ width: Math.round(size * 0.34), height: 2, borderRadius: 2, background: '#AEB6BD' }}></span>
      </span>
    );
  }
  const pulse = status === 'production';
  return (
    <span title={st.label} style={{
      width: size, height: size, borderRadius: '50%', background: st.bg,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0, boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.04)',
    }}>
      <span style={{
        width: Math.round(size * 0.46), height: Math.round(size * 0.46), borderRadius: '50%',
        background: st.dot, animation: pulse ? 'brPulse 2s ease-in-out infinite' : 'none',
      }}></span>
    </span>
  );
}

function ContractTag({ c }) {
  const cls = c === 'PPA' ? 'tag-ppa' : c === 'M' ? 'tag-m' : 'tag-p';
  return <span className={`ctag ${cls}`}>{c}</span>;
}

function SectionHead({ title, note, right }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      borderBottom: '1px solid var(--grey-lt)', paddingBottom: 8, marginBottom: 14,
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
        <h2 className="display" style={{ fontSize: '1.28rem', color: 'var(--br-dk)', margin: 0 }}>{title}</h2>
        {note && <span className="mono" style={{
          fontSize: '0.62rem', color: 'var(--ink-light)', background: 'var(--grey-xlt)',
          border: '1px solid var(--grey-lt)', padding: '2px 9px', borderRadius: 20,
        }}>{note}</span>}
      </div>
      {right}
    </div>
  );
}

function KpiCard({ label, value, unit, sub, accent = 'var(--br)', spark, sparkColor, delta }) {
  return (
    <div className="card" style={{ padding: 'var(--card-pad)', borderTop: `3px solid ${accent}`, position: 'relative' }}>
      <div className="eyebrow" style={{ marginBottom: 6 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8 }}>
        <div>
          <span className="display" style={{ fontSize: '1.95rem', color: 'var(--ink)' }}>{value}</span>
          {unit && <span className="mono" style={{ fontSize: '0.78rem', color: 'var(--ink-light)', marginLeft: 4 }}>{unit}</span>}
        </div>
        {spark && <Spark values={spark} color={sparkColor || accent} w={84} h={30} />}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 5 }}>
        {delta && (
          <span className="mono" style={{
            fontSize: '0.6rem', fontWeight: 700, color: delta.up ? 'var(--grn)' : 'var(--rd)',
            background: delta.up ? 'var(--grn-lt)' : 'var(--rd-lt)', padding: '1px 6px', borderRadius: 5,
          }}>{delta.up ? '▲' : '▼'} {delta.v}</span>
        )}
        {sub && <span className="mono" style={{ fontSize: '0.62rem', color: 'var(--ink-light)' }}>{sub}</span>}
      </div>
    </div>
  );
}

Object.assign(window, { StatusGlyph, ContractTag, SectionHead, KpiCard });
