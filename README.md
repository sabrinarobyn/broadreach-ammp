# Broadreach AMMP Monitoring

A small web app for the team: one Node server that both **proxies the AMMP Data API**
(handling the CORS + token exchange the browser can't do on its own) and **serves the
dashboard pages**. Because the pages and the API share one origin, teammates just open a
URL, sign in with their own AMMP API key, and go — no install, no localhost, no port to
configure. The API key acts as the password: nothing loads without a valid one.

```
ammp-proxy/
  server.js          the proxy + static file server (binds to $PORT)
  package.json
  render.yaml        one-click deploy config for Render
  public/
    index.html       sign-in gate (verifies the key with AMMP, then opens the Platform)
    platform/        the Platform — portfolio overview, O&M schedule, site deep dive
                      and grapher (per-asset power-vs-temp charts), all in one app
```

## Deploy so the team can use it (Render, free)

Render gives a persistent `https://…onrender.com` URL and serves everything from
one service.

1. Put this folder in a Git repo (GitHub is easiest — Render connects to it).
2. Go to https://render.com, sign in, **New → Blueprint**, and select the repo.
   Render reads `render.yaml` and sets everything up. (Or **New → Web Service**,
   pick the repo, Build `npm install`, Start `npm start` — same result.)
3. When it finishes, you get a URL like `https://broadreach-ammp.onrender.com`.
   Share that with the team.

Every person opens the URL and signs in with their **own** AMMP `x-api-key`. The key is
verified against AMMP on sign-in, then held in that browser tab only (`sessionStorage`) —
closing the tab signs them out. It's forwarded straight to AMMP; this server stores no
keys. The tools redirect back to the sign-in page if there's no valid key, so the data is
gated behind a working AMMP key.

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

## How it works

- `POST /auth/token` — takes your `x-api-key` header, exchanges it with AMMP for a
  bearer token, returns the token to the page.
- `ALL /proxy/*` — forwards any AMMP endpoint with your bearer token attached, e.g.
  the page calls `/proxy/v1/assets` and the server calls
  `https://data-api.ammp.io/v1/assets`.
- `GET /health` — used by the pages (and Render) to confirm the service is up.
