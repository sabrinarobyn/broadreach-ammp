/* ============================================================
   Broadreach Platform — O&M Schedule
   Editable, persistent (Postgres via /api/om, see js/om.jsx) —
   independent of AMMP; asset_id optionally links a row to a live site.
   ============================================================ */

const { useState: _omUseState } = React;

const OM_CSV_COLUMNS = ['site_name', 'asset_id', 'province', 'task_type', 'scheduled_date', 'responsible', 'notes', 'completed', 'completed_date'];

function csvEscape(v) {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function omToCsv(rows) {
  const lines = rows.map((r) => OM_CSV_COLUMNS.map((c) => csvEscape(r[c])).join(','));
  return [OM_CSV_COLUMNS.join(','), ...lines].join('\n');
}
function csvParse(text) {
  const rows = [];
  let row = [], field = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false; }
      else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = ''; rows.push(row); row = [];
    } else field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  if (!rows.length) return [];
  const header = rows[0].map((h) => h.trim());
  return rows.slice(1).filter((r) => r.some((f) => f !== '')).map((r) => {
    const obj = {};
    header.forEach((h, i) => { obj[h] = r[i] != null ? r[i] : ''; });
    return obj;
  });
}
function downloadText(filename, text) {
  const blob = new Blob([text], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function OmModal({ initial, assets, onSave, onClose }) {
  const [form, setForm] = _omUseState(() => ({
    site_name: initial?.site_name || '', asset_id: initial?.asset_id || '', province: initial?.province || '',
    task_type: initial?.task_type || OM_TASK_TYPES[0], scheduled_date: initial?.scheduled_date ? String(initial.scheduled_date).slice(0, 10) : '',
    responsible: initial?.responsible || '', notes: initial?.notes || '',
  }));
  const [saving, setSaving] = _omUseState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const pickAsset = (e) => {
    const id = e.target.value;
    const a = assets.find((x) => x.id === id);
    setForm((f) => ({ ...f, asset_id: id, site_name: a ? a.name : f.site_name, province: a && a.province ? a.province : f.province }));
  };

  const save = async () => {
    if (!form.site_name.trim()) return;
    setSaving(true);
    try { await onSave({ ...form, asset_id: form.asset_id || null, scheduled_date: form.scheduled_date || null }); onClose(); }
    finally { setSaving(false); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(20,28,34,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }} onClick={onClose}>
      <div className="card" style={{ width: 480, maxWidth: '92vw', maxHeight: '88vh', overflow: 'auto', padding: 22 }} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ fontSize: '1.02rem', fontWeight: 700, margin: '0 0 14px' }}>{initial ? 'Edit task' : 'New O&M task'}</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div>
            <label className="eyebrow" style={{ display: 'block', marginBottom: 4 }}>Link to AMMP site (optional)</label>
            <select className="fld" style={{ width: '100%' }} value={form.asset_id} onChange={pickAsset}>
              <option value="">— not linked —</option>
              {assets.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <div>
            <label className="eyebrow" style={{ display: 'block', marginBottom: 4 }}>Site name *</label>
            <input className="fld" style={{ width: '100%' }} value={form.site_name} onChange={set('site_name')} />
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <label className="eyebrow" style={{ display: 'block', marginBottom: 4 }}>Province</label>
              <input className="fld" style={{ width: '100%' }} value={form.province} onChange={set('province')} />
            </div>
            <div style={{ flex: 1 }}>
              <label className="eyebrow" style={{ display: 'block', marginBottom: 4 }}>Task type</label>
              <select className="fld" style={{ width: '100%' }} value={form.task_type} onChange={set('task_type')}>
                {OM_TASK_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <label className="eyebrow" style={{ display: 'block', marginBottom: 4 }}>Scheduled date</label>
              <input type="date" className="fld" style={{ width: '100%' }} value={form.scheduled_date} onChange={set('scheduled_date')} />
            </div>
            <div style={{ flex: 1 }}>
              <label className="eyebrow" style={{ display: 'block', marginBottom: 4 }}>Responsible</label>
              <input className="fld" style={{ width: '100%' }} value={form.responsible} onChange={set('responsible')} placeholder="e.g. Solar Clean Cape" />
            </div>
          </div>
          <div>
            <label className="eyebrow" style={{ display: 'block', marginBottom: 4 }}>Notes</label>
            <textarea className="fld" style={{ width: '100%', height: 70, resize: 'vertical' }} value={form.notes} onChange={set('notes')} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 18, justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button>
          <button className="btn btn-sm" onClick={save} disabled={saving || !form.site_name.trim()}>{saving ? <span className="spin">◠</span> : 'Save'}</button>
        </div>
      </div>
    </div>
  );
}

function Schedule() {
  const ammp = useAmmp();
  const om = useOm();
  const [q, setQ] = _omUseState('');
  const [statusFilter, setStatusFilter] = _omUseState('all');
  const [modal, setModal] = _omUseState(null); // null | 'new' | row object
  const fileInputRef = React.useRef(null);

  const assets = React.useMemo(() => (ammp.sites || []).map((s) => ({ id: s.id, name: s.name, province: s.province })), [ammp.sites]);

  const withUrgency = React.useMemo(() => om.rows.map((r) => ({ row: r, urgency: omUrgency(r) })), [om.rows]);

  const filtered = withUrgency.filter(({ row, urgency }) => {
    const matchesQ = q === '' || row.site_name.toLowerCase().includes(q.toLowerCase()) || (row.province || '').toLowerCase().includes(q.toLowerCase());
    const matchesStatus = statusFilter === 'all' || urgency.level === statusFilter;
    return matchesQ && matchesStatus;
  }).sort((a, b) => (a.urgency.daysAway ?? Infinity) - (b.urgency.daysAway ?? Infinity));

  const urgentCount = withUrgency.filter((x) => x.urgency.level === 'red').length;
  const upcomingCount = withUrgency.filter((x) => x.urgency.level === 'amber').length;
  const completedCount = withUrgency.filter((x) => x.urgency.level === 'completed').length;

  const toggleComplete = (row) => om.update(row.id, { completed: !row.completed });
  const del = (row) => { if (confirm(`Delete O&M task for ${row.site_name}?`)) om.remove(row.id); };

  const exportCsv = () => downloadText(`om-schedule-${new Date().toISOString().slice(0, 10)}.csv`, omToCsv(om.rows));
  const importCsv = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    const text = await file.text();
    const parsed = csvParse(text);
    for (const r of parsed) {
      const created = await om.create({
        site_name: r.site_name || '', asset_id: r.asset_id || null, province: r.province || null,
        task_type: r.task_type || null, scheduled_date: r.scheduled_date || null, responsible: r.responsible || null,
        notes: r.notes || null,
      });
      const wasCompleted = /^(true|1|yes)$/i.test(String(r.completed || '').trim());
      if (wasCompleted && created && created.id) {
        await om.update(created.id, { completed: true, completed_date: r.completed_date || undefined });
      }
    }
  };

  return (
    <div>
      <SectionHead title="O&M Schedule" note={`${om.rows.length} task${om.rows.length === 1 ? '' : 's'}`} right={
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={exportCsv}>Export CSV</button>
          <button className="btn btn-ghost btn-sm" onClick={() => fileInputRef.current && fileInputRef.current.click()}>Import CSV</button>
          <input ref={fileInputRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={importCsv} />
          <button className="btn btn-sm" onClick={() => setModal('new')}>+ Add task</button>
        </div>
      } />

      <ErrorNote message={om.error} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--gap)', marginBottom: 'var(--gap)' }}>
        <KpiCard label="Urgent (≤30d / overdue)" value={urgentCount} accent="var(--rd)" />
        <KpiCard label="Upcoming (≤90d)" value={upcomingCount} accent="var(--amb)" />
        <KpiCard label="Completed" value={completedCount} accent="var(--br)" />
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 'var(--gap)' }}>
        <input className="fld" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search site or province…" style={{ flex: '1 1 220px', maxWidth: 320 }} />
        <select className="fld" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">All</option>
          <option value="red">Urgent</option>
          <option value="amber">Upcoming</option>
          <option value="completed">Completed</option>
          <option value="none">No flag</option>
        </select>
      </div>

      {om.loading ? (
        <div className="card" style={{ padding: 32, textAlign: 'center' }}><span className="mono" style={{ color: 'var(--ink-light)', fontSize: '0.72rem' }}>Loading…</span></div>
      ) : filtered.length === 0 ? (
        <EmptyState title="No O&M tasks yet." note="Add one, or import a CSV to get started." />
      ) : (
        <div className="card scroll" style={{ overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.74rem', minWidth: 820 }}>
            <thead>
              <tr>
                {['Site', 'Province', 'Task', 'Due', 'Responsible', 'Status', ''].map((h) => (
                  <th key={h} style={{ background: 'var(--br)', color: '#fff', padding: '9px 12px', textAlign: 'left', fontSize: '0.58rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px', position: 'sticky', top: 0 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(({ row, urgency }) => {
                const c = OM_URGENCY_COLORS[urgency.level] || OM_URGENCY_COLORS.none;
                return (
                  <tr key={row.id}>
                    <td style={{ padding: '7px 12px', borderBottom: '1px solid var(--line)', fontWeight: 700 }}>{row.site_name}</td>
                    <td className="mono" style={{ padding: '7px 12px', borderBottom: '1px solid var(--line)', color: 'var(--ink-mid)' }}>{row.province || '—'}</td>
                    <td style={{ padding: '7px 12px', borderBottom: '1px solid var(--line)' }}>{row.task_type || '—'}</td>
                    <td className="mono" style={{ padding: '7px 12px', borderBottom: '1px solid var(--line)', color: 'var(--ink-mid)' }}>{row.scheduled_date ? new Date(row.scheduled_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</td>
                    <td style={{ padding: '7px 12px', borderBottom: '1px solid var(--line)' }}>{row.responsible || '—'}</td>
                    <td style={{ padding: '7px 12px', borderBottom: '1px solid var(--line)' }}>
                      <span className="mono" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '2px 9px', borderRadius: 20, background: c.bg, color: c.fg, fontSize: '0.62rem', fontWeight: 700 }}>
                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: c.dot }}></span>
                        {row.completed ? 'Completed' : urgency.daysAway == null ? 'No date' : urgency.daysAway < 0 ? `${Math.abs(urgency.daysAway)}d overdue` : `${urgency.daysAway}d`}
                      </span>
                    </td>
                    <td style={{ padding: '7px 12px', borderBottom: '1px solid var(--line)', whiteSpace: 'nowrap' }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => toggleComplete(row)} style={{ marginRight: 6 }}>{row.completed ? 'Reopen' : 'Complete'}</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => setModal(row)} style={{ marginRight: 6 }}>Edit</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => del(row)}>Delete</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <OmModal
          initial={modal === 'new' ? null : modal}
          assets={assets}
          onClose={() => setModal(null)}
          onSave={(form) => (modal === 'new' ? om.create(form) : om.update(modal.id, form))}
        />
      )}
    </div>
  );
}

Object.assign(window, { Schedule });