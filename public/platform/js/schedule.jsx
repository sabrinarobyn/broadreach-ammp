/* ============================================================
   Broadreach Platform — O&M Schedule, sourced from POST /v1/tickets/list.
   The exact ticket request/response schema isn't confirmed, so field
   resolution below tries a short list of plausible key names per column
   and falls back to "—" rather than inventing a value.
   ============================================================ */

const { useState: _useState } = React;

function ticketField(t, ...keys) {
  for (const k of keys) { if (t[k] != null && t[k] !== '') return t[k]; }
  return null;
}

function Schedule() {
  const ammp = useAmmp();
  const [tickets, setTickets] = _useState(null); // null = loading
  const [err, setErr] = _useState(null);

  React.useEffect(() => {
    if (!ammp.live) return;
    let cancelled = false;
    setTickets(null); setErr(null);
    postTicketsList(ammp.token, {}).then((resp) => {
      if (cancelled) return;
      let list = Array.isArray(resp) ? resp : (resp && (resp.tickets || resp.data || resp.results || resp.items));
      setTickets(Array.isArray(list) ? list : []);
    }).catch((e) => { if (!cancelled) { setErr(e.message || 'Failed to load tickets.'); setTickets([]); } });
    return () => { cancelled = true; };
  }, [ammp.live, ammp.token]);

  if (!ammp.live) return <ConnectGate note="Sign in with your AMMP x-api-key to load the O&M schedule." />;
  if (tickets === null) {
    return <div className="card" style={{ padding: 32, textAlign: 'center' }}><span className="mono" style={{ color: 'var(--ink-light)', fontSize: '0.72rem' }}>Loading tickets…</span></div>;
  }

  const rows = tickets.map((t) => {
    const assetId = ticketField(t, 'asset_id', 'site_id');
    const site = ammp.sites.find((s) => s.id === assetId);
    const dueRaw = ticketField(t, 'due_date', 'scheduled_date', 'date', 'created_at');
    const dueDate = dueRaw ? new Date(dueRaw) : null;
    const validDue = dueDate && !isNaN(dueDate.getTime());
    return {
      site: (site && site.name) || ticketField(t, 'asset_name', 'site_name', 'site') || '—',
      title: ticketField(t, 'title', 'summary', 'description', 'name') || 'Ticket',
      status: ticketField(t, 'status', 'state'),
      dueDate: validDue ? dueDate : null,
      daysAway: validDue ? Math.round((dueDate.getTime() - Date.now()) / 86400000) : null,
    };
  }).sort((a, b) => {
    if (a.daysAway == null && b.daysAway == null) return 0;
    if (a.daysAway == null) return 1;
    if (b.daysAway == null) return -1;
    return a.daysAway - b.daysAway;
  });

  return (
    <div>
      <SectionHead title="O&M Schedule" note={`${rows.length} ticket${rows.length === 1 ? '' : 's'}`} />
      <ErrorNote message={err} />
      {rows.length === 0 ? (
        <EmptyState title="No open tickets." note="AMMP's ticket list returned nothing for this account." />
      ) : (
        <div className="card scroll" style={{ overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.74rem', minWidth: 700 }}>
            <thead>
              <tr>
                {['Site', 'Ticket', 'Status', 'Due', 'Days away'].map((h) => (
                  <th key={h} style={{ background: 'var(--br)', color: '#fff', padding: '9px 12px', textAlign: h === 'Days away' ? 'right' : 'left', fontSize: '0.58rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px', position: 'sticky', top: 0 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} style={{ background: i % 2 ? 'var(--grey-xlt)' : '#fff' }}>
                  <td style={{ padding: '7px 12px', borderBottom: '1px solid var(--line)', fontWeight: 700 }}>{r.site}</td>
                  <td style={{ padding: '7px 12px', borderBottom: '1px solid var(--line)' }}>{r.title}</td>
                  <td className="mono" style={{ padding: '7px 12px', borderBottom: '1px solid var(--line)', fontSize: '0.66rem', color: 'var(--ink-mid)' }}>{r.status || '—'}</td>
                  <td className="mono" style={{ padding: '7px 12px', borderBottom: '1px solid var(--line)', color: 'var(--ink-mid)' }}>{r.dueDate ? r.dueDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</td>
                  <td style={{ padding: '7px 12px', borderBottom: '1px solid var(--line)', textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {r.daysAway != null ? (<><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: urgencyColor(r.daysAway), marginRight: 7 }}></span><strong className="mono">{r.daysAway}</strong> <span className="mono" style={{ color: 'var(--ink-light)', fontSize: '0.6rem' }}>days</span></>) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

Object.assign(window, { Schedule });
