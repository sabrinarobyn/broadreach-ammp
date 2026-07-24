const express = require('express');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3001;
const AMMP_BASE = 'https://data-api.ammp.io';

// Broadreach app-level access gate — a single shared password that guards the
// whole app (static files, the AMMP proxy, everything), independent of each
// user's own AMMP x-api-key/session below. If APP_ACCESS_PASSWORD isn't set,
// the gate no-ops (same open-by-default posture as the optional DATABASE_URL
// above) so local dev without the var keeps working unchanged.
const ACCESS_COOKIE = 'br_access';
const APP_ACCESS_TTL_MS = (Number(process.env.APP_ACCESS_TTL_DAYS) || 30) * 86400000;
if (!process.env.APP_ACCESS_PASSWORD) {
  console.warn('APP_ACCESS_PASSWORD not set — the Broadreach app access gate is DISABLED (app is open, as today).');
}

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  header.split(';').forEach((pair) => {
    const idx = pair.indexOf('=');
    if (idx === -1) return;
    const k = pair.slice(0, idx).trim();
    const v = pair.slice(idx + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  });
  return out;
}

function signAccessPayload(payload) {
  return crypto.createHmac('sha256', process.env.APP_ACCESS_PASSWORD).update(payload).digest('hex');
}

function makeAccessToken() {
  const exp = String(Date.now() + APP_ACCESS_TTL_MS);
  return `${exp}.${signAccessPayload(exp)}`;
}

function verifyAccessToken(token) {
  if (!token || typeof token !== 'string') return false;
  const dot = token.indexOf('.');
  if (dot === -1) return false;
  const exp = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  if (!exp || !sig) return false;
  let expected, got;
  try {
    expected = Buffer.from(signAccessPayload(exp), 'hex');
    got = Buffer.from(sig, 'hex');
  } catch {
    return false;
  }
  if (expected.length !== got.length || !crypto.timingSafeEqual(expected, got)) return false;
  return Date.now() < Number(exp);
}

function passwordMatches(supplied) {
  const a = crypto.createHash('sha256').update(String(supplied || '')).digest();
  const b = crypto.createHash('sha256').update(String(process.env.APP_ACCESS_PASSWORD)).digest();
  return crypto.timingSafeEqual(a, b);
}

function isPublicAccessPath(p) {
  return p === '/api/access/login' || p === '/api/access/logout' || p === '/api/access/status'
    || p === '/' || p === '/index.html' || p === '/health';
}

// Gates everything registered after it: static files, /auth/token, /proxy/*,
// /api/om/*. Does NOT touch AMMP auth itself (below) — this only decides
// whether the browser is allowed to talk to this server at all.
function requireAppAccess(req, res, next) {
  if (!process.env.APP_ACCESS_PASSWORD) return next();
  if (isPublicAccessPath(req.path)) return next();
  const cookies = parseCookies(req.headers.cookie);
  if (verifyAccessToken(cookies[ACCESS_COOKIE])) return next();
  const isApiish = req.path.startsWith('/proxy') || req.path.startsWith('/auth') || req.path.startsWith('/api');
  if (isApiish || req.method !== 'GET') {
    return res.status(401).json({ error: 'Not authenticated', code: 'APP_ACCESS_REQUIRED' });
  }
  return res.redirect('/?next=' + encodeURIComponent(req.originalUrl));
}

// O&M schedule store. Optional — if DATABASE_URL isn't set (e.g. local dev without
// a Postgres instance linked), /api/om/* responds 503 instead of the server crashing.
const pool = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
  : null;

async function ensureOmTable() {
  if (!pool) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS om_tasks (
      id TEXT PRIMARY KEY,
      site_name TEXT NOT NULL,
      asset_id TEXT,
      province TEXT,
      task_type TEXT,
      scheduled_date DATE,
      responsible TEXT,
      notes TEXT,
      completed BOOLEAN NOT NULL DEFAULT false,
      completed_date DATE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
}
if (pool) ensureOmTable().catch((err) => console.error('Failed to prepare om_tasks table:', err.message));

app.use(cors());
app.use(express.json());
app.use(requireAppAccess);

app.post('/api/access/login', (req, res) => {
  if (!process.env.APP_ACCESS_PASSWORD) return res.status(503).json({ error: 'Access gate not configured.' });
  const { password } = req.body || {};
  if (!password || !passwordMatches(password)) {
    return res.status(401).json({ error: 'Incorrect password.' });
  }
  res.cookie(ACCESS_COOKIE, makeAccessToken(), {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: APP_ACCESS_TTL_MS,
    secure: req.secure || req.get('x-forwarded-proto') === 'https',
  });
  res.json({ ok: true });
});

app.post('/api/access/logout', (req, res) => {
  res.clearCookie(ACCESS_COOKIE, { path: '/' });
  res.json({ ok: true });
});

app.get('/api/access/status', (req, res) => {
  if (!process.env.APP_ACCESS_PASSWORD) return res.json({ authenticated: true, gateDisabled: true });
  const cookies = parseCookies(req.headers.cookie);
  res.json({ authenticated: verifyAccessToken(cookies[ACCESS_COOKIE]) });
});

// Serve the dashboard pages from this same origin. Because the pages and the
// proxy share an origin, the pages call the API with relative paths -- no
// localhost and no port for anyone to configure.
app.use(express.static(path.join(__dirname, 'public')));

// Step 1: exchange x-api-key for a bearer token
app.post('/auth/token', async (req, res) => {
  const apiKey = req.headers['x-api-key'];
  if (!apiKey) return res.status(400).json({ error: 'Missing x-api-key header' });
  try {
    const upstream = await fetch(`${AMMP_BASE}/v1/token`, {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' }
    });
    const text = await upstream.text();
    res.status(upstream.status).set('Content-Type', 'application/json').send(text);
  } catch (err) {
    res.status(502).json({ error: 'Proxy error', message: err.message });
  }
});

// Step 2: forward all other requests with bearer token
app.all('/proxy/*', async (req, res) => {
  const upstreamPath = req.params[0];
  const query = new URLSearchParams(req.query).toString();
  const url = `${AMMP_BASE}/${upstreamPath}${query ? '?' + query : ''}`;

  const headers = { 'Content-Type': 'application/json' };
  const auth = req.headers['authorization'];
  if (auth) headers['Authorization'] = auth;

  const options = { method: req.method, headers };
  if (['POST', 'PATCH', 'PUT'].includes(req.method) && req.body) {
    options.body = JSON.stringify(req.body);
  }

  try {
    const upstream = await fetch(url, options);
    const text = await upstream.text();
    res.status(upstream.status);
    upstream.headers.forEach((value, key) => {
      if (!['content-encoding', 'transfer-encoding', 'connection'].includes(key.toLowerCase())) {
        res.setHeader(key, value);
      }
    });
    res.send(text);
  } catch (err) {
    res.status(502).json({ error: 'Proxy error', message: err.message });
  }
});

// O&M schedule — Broadreach-owned data, persisted separately from AMMP.
const OM_FIELDS = ['site_name', 'asset_id', 'province', 'task_type', 'scheduled_date', 'responsible', 'notes'];

function requireOm(req, res, next) {
  if (!pool) return res.status(503).json({ error: 'O&M database not configured (DATABASE_URL missing).' });
  next();
}

app.get('/api/om', requireOm, async (_req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM om_tasks ORDER BY scheduled_date ASC NULLS LAST, created_at ASC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/om', requireOm, async (req, res) => {
  const b = req.body || {};
  if (!b.site_name) return res.status(400).json({ error: 'site_name is required' });
  const id = b.id || crypto.randomUUID();
  try {
    const { rows } = await pool.query(
      `INSERT INTO om_tasks (id, site_name, asset_id, province, task_type, scheduled_date, responsible, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [id, b.site_name, b.asset_id || null, b.province || null, b.task_type || null,
       b.scheduled_date || null, b.responsible || null, b.notes || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/om/:id', requireOm, async (req, res) => {
  const b = req.body || {};
  const sets = [];
  const values = [];
  let i = 1;
  for (const f of OM_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(b, f)) { sets.push(`${f} = $${i++}`); values.push(b[f]); }
  }
  if (Object.prototype.hasOwnProperty.call(b, 'completed')) {
    sets.push(`completed = $${i++}`); values.push(!!b.completed);
    sets.push(`completed_date = $${i++}`); values.push(b.completed ? (b.completed_date || new Date().toISOString().slice(0, 10)) : null);
  }
  if (!sets.length) return res.status(400).json({ error: 'No updatable fields provided' });
  sets.push('updated_at = now()');
  values.push(req.params.id);
  try {
    const { rows } = await pool.query(`UPDATE om_tasks SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`, values);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/om/:id', requireOm, async (req, res) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM om_tasks WHERE id = $1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: 'Not found' });
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/health', (_, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`AMMP proxy + dashboard running on port ${PORT}`);
});
