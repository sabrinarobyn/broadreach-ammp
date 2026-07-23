# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **O&M / asset-ops staff** — day-to-day: check live production status across the fleet, spot underperforming sites or inverters, track upcoming maintenance against the O&M schedule.
- **Leadership** — periodic: scan portfolio-level KPIs (installed capacity, sites at risk, revenue) rather than operate day-to-day.

Same tool serves both from the same shell — Portfolio Overview and its KPI strip are the leadership scan; Site Deep Dive, Grapher, and the O&M Schedule are the ops drill-down.

## Product Purpose

A fleet-monitoring dashboard for Broadreach Energy's commercial & industrial solar PV portfolio. It fuses live telemetry from the AMMP Data API (per-site and per-inverter power, temperature) with Broadreach's own O&M schedule and contract/business data in one place, so the team isn't cross-referencing AMMP's own dashboard against a separate maintenance spreadsheet.

## Positioning

Unlike using the raw AMMP Data API / AMMP's own dashboard directly, this overlays business context — contract type, EPC, O&M due dates, portfolio KPIs — on top of live telemetry, and needs no install: a teammate opens a URL, signs in with their own AMMP API key, and is in.

## Operating Context

- Deployed as a Node/Express service (`ammp-proxy/`) that both proxies the AMMP Data API (handles CORS + token exchange the browser can't do alone) and serves the dashboard's static files from one origin.
- Each teammate signs in with their own AMMP `x-api-key`; the key lives in `sessionStorage` for that browser tab only and is forwarded straight to AMMP — the server never stores it. Closing the tab signs them out.
- Runs locally via `npm start` (port 3001, or `$PORT`) or deployed to Render (`render.yaml`; free tier idles after ~15 min, ~30s cold start on first visit after).
- No build step: React 18 + Babel-standalone loaded from CDN, JSX transpiled in-browser. Deliberate, so the team never needs `npm install`/a toolchain to run or tweak it.

## Capabilities and Constraints

- Confirmed surfaces, all inside one shell ("Platform") with a single AMMP sign-in shared across views: Portfolio Overview (grid/table/map, KPIs, filters, grouping), O&M Schedule, Site Deep Dive (per-site KPIs, panel array, battery, alerts, revenue/environmental estimates, per-inverter charts), Grapher (per-asset power-vs-inverter-temperature charts — scatter and dual-axis time series).
- Live telemetry comes only from AMMP Data API v1 via the proxy's `/auth/token` + `/proxy/*` endpoints (`/v1/assets`, `/v1/assets/{id}/devices`, `/v1/devices/{id}/historic-data/pv-inverter`). Only power and inverter temperature are available per device today. There is no AMMP endpoint for battery, alerts, panel-level heatmaps, or revenue — those stay on seeded demo data even once AMMP is connected, and must read as estimated/offline rather than presented as live.
- The 69-site roster (names, provinces, towns, contracts, EPCs, kWp, O&M schedule) in `platform/js/data.js` is a fictional seeded placeholder standing in for Broadreach's real portfolio. **It is expected to become real** — a future task will wire in the actual site roster and O&M schedule (source not yet decided: spreadsheet import, another system's API, or manual entry). Sites are matched to real AMMP assets by fuzzy name (first-word match either direction) since there's no shared ID between the business roster and AMMP's asset list.
- Undecided: where the real site-roster/O&M data will come from.

## Brand Commitments

"Broadreach" / "Broadreach Energy" naming. Steel-blue brand palette carried over from the existing ammp-proxy pages and the Claude Design import (`--br: #5d809a` family of tokens in `platform/css/broadreach.css`).

## Evidence on Hand

- `ammp-proxy/README.md` documents the proxy's endpoints and deployment.
- `ammp-proxy/public/platform/` is the current implementation (Claude Design import wired to real AMMP auth/telemetry) — grid/table/map, schedule, deep dive, grapher.
- No real portfolio/O&M data source on hand yet beyond the seeded 69-site placeholder.

## Product Principles

1. One sign-in, one place: fuse live AMMP telemetry with Broadreach's own business/O&M data instead of making the team cross-reference two tools.
2. Serve both audiences from the same shell — a portfolio-level KPI scan for leadership, a site/inverter-level drill-down for ops — without separate apps.
3. No install, no server-side secrets: open a URL, sign in with your own AMMP key; the proxy never stores it.
4. Degrade honestly: when AMMP isn't connected, or a data point has no AMMP equivalent, show it as offline/estimated rather than presenting demo numbers as if live.
5. Business-roster data (site list, O&M schedule) is expected to become real; treat the 69-site dataset as replaceable, not load-bearing.
