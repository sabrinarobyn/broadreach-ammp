const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;
const AMMP_BASE = 'https://data-api.ammp.io';

app.use(cors());
app.use(express.json());

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

app.get('/health', (_, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`AMMP proxy + dashboard running on port ${PORT}`);
});
