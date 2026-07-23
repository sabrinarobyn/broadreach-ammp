# Broadreach AMMP Monitoring

A small web app for the team: one Node server that both **proxies the AMMP Data API**
(handling the CORS + token exchange the browser can't do on its own) and **serves the
dashboard pages**. Because the pages and the API share one origin, teammates just open a
URL and paste their own AMMP API key — no install, no localhost, no port to configure.

```
ammp-proxy/
  server.js          the proxy + static file server (binds to $PORT)
  package.json
  render.yaml        one-click deploy config for Render
  public/
    index.html       landing page linking the three tools
    portfolio.html   fleet overview + O&M schedule
    grapher.html     per-asset power-vs-temp charts
    tester.html      API tester / asset inspector
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

Every person opens the URL and enters their **own** AMMP `x-api-key`. The key lives in
their browser for that session only and is forwarded straight to AMMP — this server
stores no keys.

> Free-plan note: Render idles the service after ~15 min of no traffic, so the first
> visit after a quiet spell takes ~30s to wake. Fine for occasional team use; upgrade
> the plan if you want it always-on.

## Run it locally (for development)

```
npm install
npm start
```

Then open http://localhost:3001. The pages use relative paths, so localhost and the
hosted URL behave identically.

## How it works

- `POST /auth/token` — takes your `x-api-key` header, exchanges it with AMMP for a
  bearer token, returns the token to the page.
- `ALL /proxy/*` — forwards any AMMP endpoint with your bearer token attached, e.g.
  the page calls `/proxy/v1/assets` and the server calls
  `https://data-api.ammp.io/v1/assets`.
- `GET /health` — used by the pages (and Render) to confirm the service is up.
