/* ============================================================
   Broadreach Platform — O&M Schedule store
   Broadreach-owned maintenance data, persisted in the proxy's own
   Postgres database (server.js: /api/om), independent of AMMP.
   ============================================================ */

const OM_TASK_TYPES = ['Preventive', 'Corrective', 'Inspection', 'Cleaning', 'Vegetation', 'Thermographic Survey'];

async function omFetch(path, opts) {
  const r = await fetch(`/api/om${path}`, {
    headers: opts && opts.body ? { 'Content-Type': 'application/json' } : undefined,
    ...opts,
  });
  if (r.status === 204) return null;
  const isJson = (r.headers.get('content-type') || '').includes('application/json');
  const body = isJson ? await r.json().catch(() => null) : null;
  if (!r.ok) throw new Error((body && body.error) || `O&M request failed (${r.status})`);
  return body;
}

async function fetchOmRows() { return omFetch('', { method: 'GET' }); }
async function createOmRow(row) { return omFetch('', { method: 'POST', body: JSON.stringify(row) }); }
async function updateOmRow(id, patch) { return omFetch(`/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }); }
async function deleteOmRow(id) { return omFetch(`/${id}`, { method: 'DELETE' }); }

/* Urgency: red = due within 30d or overdue (and not completed); amber = within 90d;
   otherwise no flag. Completed rows are always 'completed' regardless of date. */
function omUrgency(row) {
  if (!row) return { level: 'none', daysAway: null };
  if (row.completed) return { level: 'completed', daysAway: null };
  if (!row.scheduled_date) return { level: 'none', daysAway: null };
  const due = new Date(row.scheduled_date);
  if (isNaN(due.getTime())) return { level: 'none', daysAway: null };
  const daysAway = Math.round((due.getTime() - Date.now()) / 86400000);
  if (daysAway <= 30) return { level: 'red', daysAway };
  if (daysAway <= 90) return { level: 'amber', daysAway };
  return { level: 'none', daysAway };
}
const OM_URGENCY_COLORS = {
  red: { bg: 'var(--rd-lt)', fg: 'var(--rd)', dot: 'var(--rd)' },
  amber: { bg: 'var(--amb-lt)', fg: 'var(--amb-dk)', dot: 'var(--amb)' },
  completed: { bg: 'var(--br-xlt)', fg: 'var(--br-dk)', dot: 'var(--br)' },
  none: { bg: 'var(--grey-xlt)', fg: 'var(--ink-light)', dot: 'var(--grey-lt)' },
};

const OmContext = React.createContext(null);
function useOm() { return React.useContext(OmContext); }

function OmProvider({ children }) {
  const [rows, setRows] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);

  const refresh = React.useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const data = await fetchOmRows();
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e.message || 'Failed to load O&M schedule.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { refresh(); }, [refresh]);

  const create = React.useCallback(async (row) => { const r = await createOmRow(row); await refresh(); return r; }, [refresh]);
  const update = React.useCallback(async (id, patch) => { const r = await updateOmRow(id, patch); await refresh(); return r; }, [refresh]);
  const remove = React.useCallback(async (id) => { await deleteOmRow(id); await refresh(); }, [refresh]);

  /* Most urgent open row for a given asset, for the portfolio table's O&M column
     and the site deep dive's O&M panel. */
  const omFlagForAsset = React.useCallback((assetId) => {
    if (!assetId) return null;
    const forAsset = rows.filter((r) => r.asset_id === assetId && !r.completed);
    if (!forAsset.length) return null;
    const withUrgency = forAsset.map((r) => ({ row: r, urgency: omUrgency(r) }))
      .sort((a, b) => (a.urgency.daysAway ?? Infinity) - (b.urgency.daysAway ?? Infinity));
    return withUrgency[0];
  }, [rows]);

  const value = { rows, loading, error, refresh, create, update, remove, omFlagForAsset };
  return <OmContext.Provider value={value}>{children}</OmContext.Provider>;
}

Object.assign(window, {
  OmProvider, useOm, OmContext, OM_TASK_TYPES,
  fetchOmRows, createOmRow, updateOmRow, deleteOmRow, omUrgency, OM_URGENCY_COLORS,
});
