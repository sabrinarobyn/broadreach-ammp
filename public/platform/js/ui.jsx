/* ============================================================
   Broadreach Platform — shared UI atoms
   ============================================================ */

/* The 4 real, AMMP-derivable states (see js/ammp.jsx deriveStatus) —
   there is no richer categorical status available from the API today. */
const STATUS_STATES = {
  producing: { key: 'producing', label: 'Producing', bg: '#DDEED5', dot: '#4e7d3a' },
  none:      { key: 'none',      label: 'No production', bg: '#F7D9DE', dot: '#d34a5e' },
  alert:     { key: 'alert',     label: 'Alert', bg: '#FBEECB', dot: '#e0a93b' },
  unknown:   { key: 'unknown',   label: 'Unknown', bg: '#EEF1F4', dot: '#9CA3AF' },
};

function StatusGlyph({ status, size = 26 }) {
  const st = STATUS_STATES[status] || STATUS_STATES.unknown;
  const pulse = status === 'producing';
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

function KpiCard({ label, value, unit, sub, accent = 'var(--br)', spark, sparkColor, delta, loading }) {
  if (loading) {
    return (
      <div className="card" style={{ padding: 'var(--card-pad)', borderTop: '3px solid var(--grey-lt)' }}>
        <div className="eyebrow" style={{ marginBottom: 6, opacity: 0.5 }}>{label}</div>
        <div style={{ height: 28, width: '60%', borderRadius: 6, background: 'var(--grey-xlt)' }} />
      </div>
    );
  }
  if (value == null) return null;
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

function EmptyState({ title, note }) {
  return (
    <div className="card" style={{ padding: 40, textAlign: 'center' }}>
      <div className="display" style={{ fontSize: '1.1rem', color: 'var(--br-dk)', marginBottom: 6 }}>{title}</div>
      {note && <div className="mono" style={{ fontSize: '0.7rem', color: 'var(--ink-light)' }}>{note}</div>}
    </div>
  );
}

function ErrorNote({ message }) {
  if (!message) return null;
  return (
    <div className="mono" style={{ fontSize: '0.68rem', color: 'var(--rd)', background: 'var(--rd-lt)', padding: '8px 12px', borderRadius: 8 }}>✗ {message}</div>
  );
}

Object.assign(window, { STATUS_STATES, StatusGlyph, SectionHead, KpiCard, EmptyState, ErrorNote });
