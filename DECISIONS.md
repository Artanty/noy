# DECISIONS.md

Session log for the `noy/back` Node.js service (Express, Vercel). Kept small per know rules
(`../know/entries/rules.md`); old entries get flagged/archived when it grows.

## 2026-11-11 — add /make-wake-request to Postman private workspace (PLAN)

- User wants the final `/make-wake-request` shape saved as a Postman request in the
  workspace named "private" (id a30e2adc-14fd-40a1-81b8-7d4425ea8b03, personal visibility).
- MCP postman tools return 401 (stale API key) → use the authenticated postman CLI instead.
- Request shape: GET {{baseUrl}}/make-wake-request?target=<full target URL incl. path>&app=<APP>
  [&method=&body=][&maxWaitMs=]; note for SnapDeploy targets the full path matters (HEAD-poll).

## 2026-11-11 — Postman: collection "noy" + env created (RESULT)

- CLI (v1.86.0, already authenticated) used because MCP postman tools 401.
- MISTAKE: created a duplicate "noy" collection + "noy" env without listing workspace
  contents first. Existing "noy" collection (13841909-cd8d8f39-…) already had an empty
  "wake request" request; envs "prod urls"/"dev urls" hold {{NOY_back_domain}} etc.
- Fix: configured the existing collection's "wake request" (13841909-9d8817d8-…):
  GET {{NOY_back_domain}}/make-wake-request?target=…baltrams…/get-updates&app=BALTRAMS
  &maxWaitMs=185000&method=get&body= + full description. Deleted my duplicate collection
  and duplicate env. LESSON: always `collection list` / `environment list` in the target
  workspace before creating anything.

## 2026-11-11 — AGENTS.md added

- `AGENTS.md` at repo root: the know rules (DECISIONS.md workflow, commit rules) plus this
  project's environment quirks, so any agent session picks them up automatically.


## 2026-11-11 — wake-then-request endpoint (`/make-wake-request`)

**Plan**

- Need: endpoint that wakes a sleeping container (SnapDeploy/Render free tier), waits until
  it is actually up, then performs the real API request (port of the Python
  `requests.get(url); time.sleep(60); requests.post(...)` snippet).
- Decision: **no blind sleep** — poll the target until it responds with any "alive" status
  (200/204/301/302/401/403/404). Faster on warm servers, more reliable on slow cold starts.
- Reuse existing `makeRequest` conventions: same controller style, history saving
  (`SAVE_HISTORY`), `addStatEvent`, `target`/`app` query params.

**Progress / result**

- `utils/wakeServer.js` — wake ping (errors swallowed, it only triggers the cold start) +
  poll loop (`pollIntervalMs` 3s, `maxWaitMs` 120s default, per-check timeout 10s). Returns
  `{awake, attempts, elapsedMs}`.
- `controllers/mainController.js` — `makeWakeRequest`: wake first; `504` with wake stats if
  never awake; otherwise run the request (GET/POST/PUT/DELETE via `method` query, JSON
  `body` query param), then history + stat event; response includes the `wake` report.
- `routes/routes.js` — `GET /make-wake-request`.

**Gotchas / lessons**

- Vercel function execution timeout caps how long the synchronous wake-and-wait may run —
  lower `maxWaitMs` via query param if the plan's limit is 10s/60s.
- `body` query param must be URL-encoded JSON; invalid JSON → 400.

## 2026-11-11 — wakeServer: mimic a real browser wake-up

- `wakeServer` failed with "did not wake up within 120000ms" while a manual browser page
  visit woke the same Render container fine.
- Cause/fix: a single long (90s) axios ping can hang on a dead cold-start connection and
  never re-opens it; a browser reloads (fresh connections) and sends full browser headers.
- Rewrote `back/utils/wakeServer.js`: Chrome UA + Accept/Accept-Language headers,
  `maxRedirects: 5`, short per-attempt timeout (15s, `wakeTimeoutMs`), retry loop with
  fresh connections every `pollIntervalMs` until awake or `maxWaitMs` budget spent.
- Return shape `{awake, attempts, elapsedMs}` unchanged; controller untouched.

## 2026-11-11 — startup crash: PROJECT_ID not set

- Local `node app.js` printed "Server is running on port 3000" then failed init silently:
  `process.env.PROJECT_ID.toUpperCase()` threw "Cannot read properties of undefined"
  in `core/db_connection.js` (and would throw in `initController.checkTable` too), swallowed
  by catch, so no "BAG service connected" log and init never completed.
- Fixed both spots to guard unset `PROJECT_ID` (fallback `''` prefix / `UNSET_PROJECT` app_name).
- Verified `app.js` now completes init with a clear `BAG_ERR: Connection error...` when the
  DB service is unreachable locally, and `/get-updates` still responds.

## 2026-11-11 — wakeServer: hold one connection ("wait in connection") — WITHDRAWN

- Yet another timeout with ping-spam initially; then tried one long-held GET (up to 180s).
  SnapDeploy's proxy returns 503 instantly during cold start instead of holding the
  connection (unlike Render), so it burned 2 attempts in seconds: "too fast disconnect".

## 2026-11-11 — wakeServer: probe / silent-wait loop (final) — superseded same day

## 2026-11-11 — wakeServer: SnapDeploy wake API (root cause found)

- Root cause of ALL wake failures: SnapDeploy serves an `x-wake-page` HTML/JS page behind
  Cloudflare. Plain HTTP GETs to the container DO NOT wake it. The page's JS is what a
  browser executes: `POST https://snapdeploy.dev/api/public/wake/<subdomain>` (the real
  wake signal) + poll the container with HEAD every 3s until status ≠ 503 (max 60
  attempts ≈ 3 min). That's why only a real browser visit worked.
- Ported that algorithm into `back/utils/wakeServer.js`:
  - `wakeSnapDeploy(url)`: extract subdomain from hostname, POST to
    `snapdeploy.dev` (prod) or `containers.somdip.dev` (dev) wake API, then HEAD-poll
    every 3s until ≠503. Verified live: container woke (503 → awake).
  - `wakeGeneric(url)`: probe → 60s silent pause → probe (Render etc.).
  - `wakeServer` picks strategy by hostname (`*.containers.snapdeploy.app/.dev`,
    `*.containers.somdip.dev` → snapdeploy; else generic).
  - Options: `totalWaitMs` (185000), `pollIntervalMs` (3000), `checkTimeoutMs` (10000).
  - Returns extra `strategy` field.
- Controller: wakes the full target URL (HEAD-poll needs the path); `SNAPDEPLOY_WAKE=origin`
  env reverts to origin-only if ever needed.
- Note: awake container sleeps again after SnapDeploy's inactivity window; repeated calls
  hit the wake API's 429 rate limit eventually — handled (polls anyway).

- Final strategy = the original Python one: `GET → sleep 60s → GET`, ~3 probes in a
  185s budget (`totalWaitMs`), `probePauseMs=60000` silent wait between probes,
  `probeTimeoutMs=30000` per probe. Matches what worked manually in the browser
  (get 503 → wait ~3 min → page loads). No ping spam.
- Controller default `maxWaitMs` stays 185000; query param overrides.
- Vercel caveat: a ~3 min synchronous wait exceeds most Vercel function limits —
  pass `&maxWaitMs=` lower than the plan's limit, or make the wake async-triggered if it
  becomes a problem.

## 2026-11-12 — clean error handling in makeWakeRequest; port 3211

- Console noise: after a successful wake, the REAL request can still fail (e.g. 404 —
  wrong path on the target). The old catch dumped the whole axios object + stack.
- `mainController.makeWakeRequest` catch is now axios-aware: for HTTP errors log one
  concise line + truncated response body, return the upstream status (`res.status(404)`
  etc.) with `{error, targetStatus, wake}`. Non-axios errors keep full logging.
- Hoisted `wake` out of the try block so the catch can include it (caught a
  ReferenceError during testing).
- `app.js` default port 3000 → 3211 (`process.env.PORT` still wins on Vercel).
- Verified: 404 target → clean one-line log + 404 JSON with wake report.

## 2026-11-12 — SUCCESS/FAILURE markers; stat telemetry made non-fatal

- Added explicit console markers in `makeWakeRequest`:
  `✅ SUCCESS: GET <url> → 200 (woke in Xs, N check(s))` after the real request,
  `❌ FAILURE: target responded <status> after wake: <url>` on upstream HTTP errors.
- Fixed two latent bugs the SUCCESS test surfaced:
  - `utils/readAxiosError.js` crashed on network errors (`e.response`/`e.config` undefined)
    → guarded with optional fallbacks.
  - `externalActions/addStatEvent.js` threw when @stat was down, killing an otherwise
    completed wake request → telemetry failure is now logged as `addStatEvent (non-fatal)`
    and returns false; STAT_URL undefined locally explains the log.
- Verified: success path (200) → ✅ line + `{request:'completed'}`; 404 → ❌ line + 404 JSON.

## Environment quirks

- Node 18 engines pin (`package.json`), CommonJS modules throughout, axios for HTTP.
- Existing routes live in `routes/routes.js`, controllers as class instances exported
  singletons (see `mainController.js`).

## Plan (2026-11-15) - CORS for /make-wake-request (stat web noy-mode wake)

stat@web (stat.twc1.net) wakes its Render back through noy via feat wake-up v3 noy mode
(`GET {NOY_URL}/make-wake-request?target=…&app=stat` from the browser). Live test: the
browser fetch died instantly with "noy unreachable" — noy has NO CORS headers, so the
cross-origin response is blocked before the element ever sees it. Plan: add a permissive
`Access-Control-Allow-Origin: *` middleware in `back/app.js` (simple GET, no preflight
needed; wildcard is fine — the endpoint is public by design, same as it was on Vercel
public URLs). NOTE: AGENTS says deploy target Vercel, but noy@back is now deployed on
Render at https://ed-j5jw.onrender.com (user, 2026-11-15) — no Vercel function timeout
anymore, but the service itself sleeps when idle.

### Progress (2026-11-15)
- Added the permissive ACAO middleware in `back/app.js` (before express.json, all routes). Verified locally on :3299 — `/make-wake-request?target=http://localhost:3299/&app=test` responds with `Access-Control-Allow-Origin: *` (404 body from the wake report, endpoint itself healthy). NOT deployed — needs a noy deploy before stat's noy-mode wake works in prod (deployed noy at ed-j5jw.onrender.com still lacks CORS).

## Plan (2026-11-16) - noy@back rewritten in Python (simplified, wake-only)

- Node version stays as reference: `back` → `back-nodejs-backup` (plain `mv`, no git staging —
  user commits when ready). Root .gitignore already covers node_modules/.env for the backup.
- New `back` = Python (Flask + requests + dotenv), modeled on `../plst/back` structure but
  much smaller. ONE function: wake a render.com backend. Website calls it at startup and
  waits for the response (no request-forwarding, no DB, no history, no stat events).
- Files: `app.py` (Flask app, CORS `*` like the node build), `wake.py` (port of node
  `utils/wakeServer.js` `wakeGeneric` — the validated "probe → 60s silence → probe" strategy,
  browser headers, awake statuses 200/204/301/302/401/403/404, 185s budget, 10s probe
  timeout), `config.py` (env: HOST/PORT 3211, WAKE_TARGET, timing overrides),
  `requirements.txt`, `.env.example`, `.gitignore` (venv/__pycache__/.env).
- API: `GET /wake[?target=<url>][&maxWaitMs=<ms>]` — target defaults to env WAKE_TARGET.
  200 `{awake:true, attempts, elapsedMs, target}` / 504 `{awake:false, …}` when budget spent.
  Plus `GET /healthz`. Flask dev server (threaded by default) is enough for Timeweb.
- AGENTS.md "Project quirks" will be updated to the Python reality.

## Result (2026-11-16, 2) - githooklib reinstalled, back versioned 1.0.4

- `rm -rf node_modules && npm install` in build/: githooklib 2.2.0 (npm latest, unchanged)
  reinstalled, postinstall re-set `core.hooksPath` → `build/node_modules/githooklib/hooks`.
- `back/pyproject.toml` created with `version = "1.0.4"` (continues node back's 1.0.3).
  Verified with githooklib's own VersionManager: `getCurrentVersion(back)` → **1.0.4**
  (resolveSource correctly skips missing back/package.json and picks pyproject.toml).
- `build/.env` TAG_VERSION fixed 0.0.0.0.0.0 → 1.0.4.0.0.0 (the 0.0.0 run was the broken
  state). On the next commit the pre-commit hook will see staged pyproject 1.0.4 vs HEAD
  absent → "manually changed to 1.0.4" (no auto-bump), then rewrite TAG_VERSION — as intended.

## Plan (2026-11-16, 2) - build/ githooklib reinstall + python back version 1.0.4

- `build/` is the githooklib (2.2.0, user-authored) versioning hooks; repo
  `core.hooksPath` → `build/node_modules/githooklib/hooks`. npm latest is still 2.2.0,
  and the installed copy already supports python version sources (pyproject.toml,
  `__version__` in .py) — resolveSource falls back when `back/package.json` is absent.
- Why 11-15 wrote TAG_VERSION=0.0.0.0.0.0: no parsable back version chain at that state.
- Plan: `rm -rf node_modules && npm install` in build/ (re-runs postinstall → re-sets
  core.hooksPath); create `back/pyproject.toml` with version 1.0.4 (node back ended at
  1.0.3 in back-nodejs-backup/package.json; pyproject is githooklib's preferred python
  source and matches ../plst/back); fix stale build/.env TAG_VERSION → 1.0.4.0.0.0
  (pre-commit rewrites it on every commit anyway, but leave it correct).

## Result (2026-11-16) - python back created and verified locally

- `back` → `back-nodejs-backup` (plain `mv`; nothing staged, nothing committed).
- New `back/`: `app.py` (Flask, CORS `*`, `GET /wake`, `GET /healthz`), `wake.py` (port of
  node `wakeGeneric`: browser headers, GET probe, 60s silent pause, awake statuses
  200/204/301/302/401/403/404, budget-aware sleep so a short `maxWaitMs` fails fast),
  `config.py` (HOST/PORT 3211/WAKE_TARGET + WAKE_* timings), `requirements.txt`
  (flask/requests/python-dotenv), `.env.example`, `.gitignore`. venv in `back/venv/`.
- Verified on :3299 — awake target → `200 {awake:true, attempts:1}`; no target → 400;
  dead target + `maxWaitMs=3000` → 504 after exactly the budget; ACAO header present.
- Gotcha: wake-flow `print`s were invisible in the redirected log (stdout block buffering;
  werkzeug access log goes to stderr). Fixed with `sys.stdout.reconfigure(line_buffering=True)`
  in `app.py` main — SUCCESS/FAILURE lines now flush immediately (hosting logs need this).
- Flask's `app.run()` is threaded by default, so a blocking 185s `/wake` does not stall
  `/healthz`. No `/make-wake-request` request-forwarding: consumers wake via `/wake`, then
  hit the target themselves.

## Plan (2026-11-16, 3) - fix noy VH deploy (flask>=3.0 unresolvable on slot python 3.6)

- Failed slave run: slot venv is python 3.6 (old pip), no `flask>=3.0` wheel exists there
  → pip install failed, workflow refused restart. feat deploys fine with `flask>=2.0`.
- Changes to `back/`:
  - `requirements.txt` floor-pinned py3.6-compatible: `flask>=2.0`, `requests>=2.27`
    (2.31 needs py3.7), `python-dotenv>=0.20` (1.0 needs py3.8).
  - Add `index.wsgi` (chmod 755, feat pattern: logging to stderr first, append slot
    venv site-packages to sys.path, import `app` as `application`) + `.htaccess`
    (wsgi-script handler, rewrite to /index.wsgi/$1) — Timeweb VH has NO Passenger;
    Apache wsgi-script is the serving pattern (know: deploy-slave, feat).
  - Guard `sys.stdout.reconfigure` (py3.7+; absent on 3.6) in `app.py` __main__.
- Update know `entries/deploy-timeweb-vh.md` with the python-back config section
  (py3.6 pins, index.wsgi/.htaccess, rsync-exec-bit note).
- The failed run already synced code + created the slot venv but never restarted — next
  `-d` deploy finishes it (wsgi mtime change re-imports anyway).

## Plan (2026-11-16, 4) - add /make-wake-request (feat wake-up v3 noy-mode contract)

- stat@web (feat wake-up v3, mode=noy) calls from the browser:
  `GET {NOY_URL}/make-wake-request?target=…&app=…` and reads
  `{request:'completed', wake:{awake, attempts, elapsedMs, strategy}}` (resp.ok required;
  wake-up v3 runNoy: `resp.ok && body.request==='completed' && wake.awake` → success).
- Changes in `back/`:
  - `wake.py`: strategy detection like feat v3 (`*.onrender.com`→render, snapdeploy
    containers→snapdeploy wake-POST + 3s HEAD poll, else→poll probe loop); keep the
    existing probe-pause loop as the render/poll strategy. Dispatcher `wake_server()`.
  - `app.py`: `GET /make-wake-request[?target=&app=&maxWaitMs=]` — wake via dispatcher,
    200 `{request:'completed', wake:{…}}` when awake, 504 `{request:'failed', wake:{…}}`
    when budget spent. `app` is a stat label only (py back has no stat) → logged.
    `/wake` stays as-is (python-native consumers).
- Test locally against an awake target + short-budget dead target.

## Result (2026-11-16, 4) - /make-wake-request added (feat wake-up v3 noy contract)

- `back/wake.py`: strategy detection (feat v3 parity: onrender→render, snapdeploy
  containers→snapdeploy wake-POST + 3s HEAD poll ≠503, else→poll). `wake_server()`
  dispatcher; probe-pause loop renamed `wake_probe` (`wake_render` kept as alias).
  py3.6-safe: no f-strings added in wake.py (`.format`), regex module import.
- `back/app.py`: `GET /make-wake-request?target=&app=&maxWaitMs=` → 200
  `{request:'completed', wake:{…}}` / 504 `{request:'failed', wake:{…}}` / 400 no target.
  `app` label log-only (no stat in py back). `/wake` unchanged, now via dispatcher.
- Verified locally: awake target → 200 completed (ACAO `*` present); dead target +
  2s budget → 504 after exactly the budget; no target → 400; `/wake` regression OK;
  wsgi import OK. NOT deployed — needs a `-d` commit; the browser request from stat
  (noy.twc1.net) will 404 until then.

## Result (2026-11-16, 3) - back fixed for slot python 3.6

- `back/requirements.txt`: flask>=2.0, requests>=2.27, python-dotenv>=0.20.
- `back/index.wsgi` added (755, feat pattern adapted: exposes Flask `app`, appends
  venv/lib/python*/site-packages, stderr logging) + `back/.htaccess` (wsgi-script +
  rewrite). `app.py` reconfigure guarded with hasattr (py3.6-safe).
- know `entries/deploy-timeweb-vh.md`: new "Python backend on the slot" section.

## Decision (2026-11-15, 2) - noy@back moves to Timeweb virtual hosting
- Render is out (user): the sleeping-proxy problem (wake-the-waker) makes Render a bad
  fit for noy's role. Vercel rejected (Hobby function timeout caps the synchronous wake).
- Target: Timeweb virtual hosting — always awake, no execution-time cap, same host as
  stat (stat.twc1.net) and feat (feat.twc1.net). User deploys manually ("i'll deploy it
  to tw virtual hosting"); the ACAO CORS fix (entry above) rides along.
- Consumers then point NOY_URL at the new address (stat@web env on its deploy).

## Plan (2026-11-16, 2) - Inject feat thru feature (FEAT_THRU flag)
- User decision: noy's plain proxy role moves to the shared feat `thru` feature (feat/back/features/thru/v1/py/thru.py); the backend earns the `/thru` endpoint ONLY when the feature is injected — config flag decides (know feature-slots.md backend slots).
- Plan: vendor thru.py into noy/back/ (consumer contract, like logging/db-diag in plst); config.py `FEAT_THRU` (env FEAT_THRU=true); app.py registers thru_bp ONLY under that flag; .env.example documents FEAT_THRU=true. Verify locally: with flag on, /thru proxies /healthz; with flag off, 404. Wake endpoints (/wake, /make-wake-request) untouched — user: "it is working, don't change it".

### Progress (2026-11-16, 2)
- Vendored feat thru v1 (back/thru.py, copy of feat features/thru/v1/py/thru.py); config.py FEAT_THRU; app.py registers thru_bp ONLY under FEAT_THRU=true; .env.example documents it. Verified locally on :3299: flag ON → GET /thru?target=…/healthz mirrors {"ok":true,…} (200); flag OFF → /thru 404 while /healthz + wake routes intact. NOT deployed — noy needs a `-d` with FEAT_THRU=true in its env.

## Plan (2026-11-16, 3) - Root page '/' with version-display + /version.json
- User request: noy@back gets a simple back page at '/' carrying the feat version-display badge.
- Plan: /version.json serves {version (pyproject.toml), project: noy, namespace: back}; '/' renders minimal HTML (no deps) loading feat version-display v4 js-web from FEAT_URL (env, default https://feat.twc1.net) + <deploy-info src="/version.json" manifest="{FEAT_URL}/manifest.json">; .env.example documents FEAT_URL. Local verify with feat :5477.

### Progress (2026-11-16, 3)
- '/' page (no deps, inline HTML): noy@back title, links /healthz /wake /thru (with FEAT_THRU on/off shown), version-display v4 badge (`<deploy-info src="/version.json" manifest="{FEAT_URL}/manifest.json">`, bundle from FEAT_URL — config.py FEAT_URL default https://feat.twc1.net, .env.example row). /version.json serves pyproject version (githooklib-bumped) + project/namespace.
- Verified locally (FEAT_URL=http://localhost:5477 feat dev): /version.json {"version":"1.0.7",...}, page renders, badge shows v1.0.7. Also verified this session: stat deploy tab through local noy /thru renders full runs list — the prod "deploy tab doesn't work" (HAR 15:33) is ONLY the deployed noy missing /thru (404); needs the noy `-d` (FEAT_THRU=true already in .env.example).
