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
