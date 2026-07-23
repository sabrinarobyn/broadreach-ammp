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

- Confirmed surfaces, all inside one shell ("Platform") with a single AMMP sign-in shared across views: Portfolio Overview (grid/table/map, KPIs, filters, grouping), O&M Schedule, Site Deep Dive (per-site KPIs, panel array, battery, alerts, revenue/environmental panels, per-inverter charts), Grapher (per-asset power-vs-inverter-temperature charts — scatter and dual-axis time series).
- **There is no seeded/demo dataset anywhere.** The site list *is* `GET /v1/assets` — no separate business roster, no fuzzy name-matching. Every view gates behind a live AMMP connection (a full-page "Connect to AMMP" prompt) instead of falling back to sample data.
- Live data is pulled from a wide slice of AMMP Data API v1 via the proxy's `/auth/token` + `/proxy/*` endpoints: assets, asset detail, devices, most-recent, historic-energy/power/battery/environment/kpi, technical-kpis (pv-performance, pv-yield-losses), commercial-kpis (financial-impact, environmental-impact), last-data-received, status-info-latest, per-device historic-data (pv-inverter/battery-system/meter), and tickets/list for O&M. Contract type and EPC contractor (Broadreach-internal business metadata) have no AMMP source and were removed from the UI rather than faked.
- Several endpoints' exact response field names weren't confirmed while building this (no sample responses were available), so extraction is shape-driven (find any dataset-shaped sub-object, not a hand-guessed key) with generic label humanization — see `platform/js/ammp.jsx`. A panel hides itself entirely when an asset genuinely has no data for it (no battery device, no meter, no ticket, empty series) rather than showing a placeholder. `window.AMMP_DEBUG = true` in devtools logs each new response's top-level keys, to sharpen the extraction once real shapes are confirmed against a live account.
- The status glyph is a 4-state real-derivable set (Producing / No production / Alert / Unknown) computed from `most-recent`, `status-info-latest`, and `last-data-received` — not a richer invented category set.

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
