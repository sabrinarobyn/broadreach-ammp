# Broadreach AMMP Monitoring

A small web app for the team: one Node server that **proxies the AMMP Data API**
(handling the CORS + token exchange the browser can't do on its own), serves the
**dashboard** (React 18 + Babel, loaded from CDN — no build step), and runs a small
**Postgres-backed O&M schedule** that's Broadreach's own data, independent of AMMP.
Because the pages and the API share one origin, teammates just open a URL, sign in
with their own AMMP API key, and go — no install, no localhost, no port to configure.
The API key acts as the password: nothing AMMP-related loads without a valid one.

```
ammp-proxy/
  server.js            proxy + static file server + O&M REST API (binds to $PORT)
  package.json
  render.yaml           Render Blueprint: web service + Postgres database
  public/
    index.html           sign-in gate (verifies the key with AMMP, then opens the Platform)
    platform/
      index.html          Platform shell — script tags only, no inline logic
      css/broadreach.css  design tokens & shared styles
      assets/             logo etc.
      js/
        ammp.jsx           AMMP API client: auth, shape-driven field extraction,
                            unit normalization, live-status derivation
        om.jsx             O&M schedule store (CRUD against /api/om)
        charts.jsx         hand-rolled SVG chart primitives (sparklines, per-inverter
                            charts, scatter)
        ui.jsx             shared UI atoms (KpiCard, StatusGlyph, EmptyState, ...)
        portfolio.jsx
        portfolioParts.jsx Portfolio Overview — sortable/filterable site list
        schedule.jsx       O&M Schedule UI — CRUD, CSV import/export, urgency KPIs
        siteParts.jsx      Site Deep Dive side panels (alerts, revenue, environmental
                            impact, string monitoring)
        inverters.jsx      per-inverter analysis section
        powerMix.jsx       Power Mix chart, interval-level Data Sheet, Daily PR chart,
                            environment summary (Chart.js, loaded from CDN)
        site.jsx           Site Deep Dive page
        grapher.jsx        Grapher — power vs. inverter temperature, per asset
        app.jsx            app shell, routing, context providers
```

## What's in the Platform

- **Portfolio Overview** — every AMMP asset in one sortable/filterable list: live
  status, PV kWp, province, last-updated, and an O&M flag. Status is derived from
  live PV output during SAST daylight hours (06:00–19:00), current AMMP alerts, and
  data freshness — not a fixed category AMMP itself provides.
- **Site Deep Dive** — per-site Data Sheet (timestamped interval table), a Power Mix
  chart (PV / consumption / grid import-export / battery / genset, dual-axis with
  battery SOC), a Daily PR bar chart (prefers AMMP's own `performance_ratio`, falls
  back to a manual PV-energy/insolation calc), an environment summary strip, KPIs,
  and per-inverter power/temperature analysis.
- **Grapher** — power vs. inverter temperature for any asset: scatter or dual-axis
  time series, one series per inverter.
- **O&M Schedule** — Broadreach's own maintenance schedule (Preventive / Corrective /
  Inspection / Cleaning / Vegetation / Thermographic Survey), persisted in its own
  Postgres table and optionally linked to an AMMP site. Add / edit / complete /
  delete, CSV export and import, urgency KPIs (urgent ≤30d or overdue, upcoming
  ≤90d, completed). Entirely independent of AMMP — no sign-in required to use it.

## Deploy so the team can use it (Render, free)

Render's Blueprint provisions **both** the web service and the O&M database in one
step.

1. Put this folder in a Git repo (GitHub is easiest — Render connects to it).
2. Go to https://render.com, sign in, **New → Blueprint**, and select the repo.
   Render reads `render.yaml` and provisions:
   - `broadreach-ammp` — the web service (`npm install` / `npm start`)
   - `broadreach-om` — a free Postgres database, with its connection string wired
     into the web service as `DATABASE_URL` automatically
3. When it finishes, you get a URL like `https://broadreach-ammp.onrender.com`.
   Share that with the team.

Every person opens the URL and signs in with their **own** AMMP `x-api-key`. The key is
verified against AMMP on sign-in, then held in that browser tab only (`sessionStorage`) —
closing the tab signs them out. It's forwarded straight to AMMP; this server stores no
AMMP keys. The Platform redirects back to the sign-in page if there's no valid key, so
AMMP data is gated behind a working key — the O&M Schedule is not (it's Broadreach's own
data, not AMMP's, so it's reachable by anyone who can reach the URL).

If you ever deploy the web service on its own (skipping the Blueprint, e.g. **New → Web
Service**), the O&M Schedule tab still loads — it just shows a clear "O&M database not
configured" message and stays empty until a Postgres instance is linked and `DATABASE_URL`
is set.

> Free-plan note: Render idles the service after ~15 min of no traffic, so the first
> visit after a quiet spell takes ~30s to wake. Fine for occasional team use; upgrade
> the plan if you want it always-on.

## Run it locally (for development)

```
npm install
npm start
```

Then open http://localhost:3001, sign in, and you land in the Platform. The pages
use relative paths, so localhost and the hosted URL behave identically.

Without a local Postgres, `/api/om` returns a clean `503` and the O&M Schedule tab
shows that message — Portfolio, Site Deep Dive, and Grapher all work normally against
live AMMP data regardless. To exercise O&M locally, point `DATABASE_URL` at any
Postgres instance (local or a scratch Render database) before running `npm start`;
the `om_tasks` table is created automatically on first boot if it doesn't exist.

## How it works

- `POST /auth/token` — takes your `x-api-key` header, exchanges it with AMMP for a
  bearer token, returns the token to the page.
- `ALL /proxy/*` — forwards any AMMP endpoint with your bearer token attached, e.g.
  the page calls `/proxy/v1/assets` and the server calls
  `https://data-api.ammp.io/v1/assets`.
- `GET /api/om`, `POST /api/om`, `PATCH /api/om/:id`, `DELETE /api/om/:id` — the O&M
  schedule, stored in this server's own Postgres (`om_tasks` table). No AMMP token
  involved; `asset_id` is just an optional free-text link back to an AMMP site.
- `GET /health` — used by the pages (and Render) to confirm the service is up.

### Environment variables

| Variable       | Required | Notes                                                        |
|----------------|----------|---------------------------------------------------------------|
| `PORT`         | No       | Defaults to `3001`.                                           |
| `DATABASE_URL` | No       | Postgres connection string for the O&M schedule. Without it, `/api/om/*` returns `503` instead of the server crashing; everything else works normally. Render's Blueprint sets this automatically. |

## A note on AMMP's data shapes

AMMP's exact field names and units vary by account and hardware, and aren't fully
documented up front — `js/ammp.jsx` extracts data in a shape-driven way (matching
plausible field names/patterns, degrading to "no data" rather than guessing a
number) instead of hardcoding one schema. Where a response declares its own unit
(e.g. `"unit": "W"` on a power series), values are scaled generically off that
declared unit rather than an assumption. A few things confirmed against a live
account and worth knowing if you're debugging a new one:

- Asset capacity lives in `total_pv_power` (Watts), not a `pv_kwp`/kW field.
- Point-in-time endpoints like `last-data-received` can return timestamps with no
  UTC marker (unlike every time-series endpoint, which always includes one) — treat
  those as UTC, not local time, or staleness checks will drift by your machine's
  timezone offset.
- `status-info-latest`'s `alerts` field is a rolling history (OK and Error events
  mixed, potentially months deep), not a "currently open" list — only a device's
  most recent entry being non-`"OK"` means it's actually alerting now.
- `device_type` for inverters isn't a fixed string — e.g. hybrid inverters can come
  back as `battery_inverter` rather than `pv_inverter`.

`window.__ammp` is exposed in the browser console for ad-hoc checks against your own
account, e.g. `await __ammp.debugDevices('<assetId>')` to print real device types.
