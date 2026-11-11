const axios = require('axios')

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))

/**
 * Wakes up a sleeping container and waits until it responds.
 *
 * SnapDeploy (`.containers.snapdeploy.app` / `.containers.snapdeploy.dev`)
 * has a dedicated wake flow — plain HTTP GETs to the container DO NOT wake
 * it. The platform serves an "x-wake-page" HTML/JS page whose script:
 *   1. POSTs to https://snapdeploy.dev/api/public/wake/<subdomain>  (the
 *      actual wake signal), and
 *   2. polls the container with HEAD every 3s until it answers ≠ 503
 *      (max 60 attempts ≈ 3 min).
 * That page is exactly why "opening the page in a browser" worked while
 * axios requests never did. For SnapDeploy hosts we replicate that
 * algorithm; for other hosts (Render etc.) we fall back to a generic
 * probe-and-wait loop.
 *
 * @param {string} baseUrl  e.g. https://your-app.containers.snapdeploy.app
 * @param {object} [options]
 * @param {number} [options.totalWaitMs=185000]  total time budget (~3 min, matches SnapDeploy's own page)
 * @param {number} [options.pollIntervalMs=3000]  pause between checks (SnapDeploy uses 3s)
 * @param {number} [options.checkTimeoutMs=10000]  timeout per check
 * @param {string[]} [options.wakeOnStatuses=[200, 204, 301, 302, 401, 403, 404]]  statuses meaning "server is up"
 * @returns {Promise<{ awake: boolean, attempts: number, elapsedMs: number, strategy: string }>}
 */
// Headers that make the requests look like a normal Chrome page load.
const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ' +
    'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9'
}

/**
 * SnapDeploy wake flow, ported from the platform's own wake page script.
 */
async function wakeSnapDeploy (url, { totalWaitMs, pollIntervalMs, checkTimeoutMs, wakeOnStatuses }) {
  const host = new URL(url)
  const subdomain = host.hostname.split('.')[0] // e.g. "baltrams-delivery-39717"
  const isDevHost = host.hostname.includes('containers-dev.snapdeploy.app') ||
    host.hostname.includes('containers.somdip.dev')
  const apiBase = `https://${isDevHost ? 'containers.somdip.dev' : 'snapdeploy.dev'}`

  const startedAt = Date.now()
  console.log(`SnapDeploy wake flow: POST ${apiBase}/api/public/wake/${subdomain}`)

  // 1. The actual wake signal (what the wake page does on load).
  try {
    const { data } = await axios.post(`${apiBase}/api/public/wake/${encodeURIComponent(subdomain)}`, {}, {
      timeout: 20000,
      headers: { ...BROWSER_HEADERS, 'Content-Type': 'application/json' }
    })
    console.log(`Wake initiated: ${data && data.status ? data.status : 'ok'} (${data && data.message})`)
  } catch (error) {
    // Page still continues polling even if the POST fails (e.g. 429 rate
    // limit — the container may already be waking up).
    console.log(`Wake API call failed (${error.code || error.message} / status ${error.response && error.response.status}), continuing to poll anyway`)
  }

  // 2. Poll the container every 3s; "healthy" = anything except 503
  //    (503 is the wake-page response while the container sleeps).
  let attempts = 0
  while (Date.now() - startedAt < totalWaitMs) {
    attempts += 1
    try {
      const response = await axios.head(url, {
        timeout: checkTimeoutMs,
        headers: BROWSER_HEADERS,
        validateStatus: () => true
      })
      if (response.status !== 503 && wakeOnStatuses.includes(response.status)) {
        const elapsedMs = Date.now() - startedAt
        console.log(`Container is awake after ${attempts} check(s), ${elapsedMs}ms`)
        return { awake: true, attempts, elapsedMs, strategy: 'snapdeploy' }
      }
      console.log(`Wake check #${attempts}: status ${response.status}, still starting...`)
    } catch (error) {
      console.log(`Wake check #${attempts} failed (still starting): ${error.code || error.message}`)
    }
    await sleep(pollIntervalMs)
  }

  return { awake: false, attempts, elapsedMs: Date.now() - startedAt, strategy: 'snapdeploy' }
}

/**
 * Generic wake flow for non-SnapDeploy hosts (Render etc.): probe once,
 * then stay silent for a while between probes — no ping spam.
 */
async function wakeGeneric (url, { totalWaitMs, pollIntervalMs, checkTimeoutMs, wakeOnStatuses }) {
  const probePauseMs = 60000
  const startedAt = Date.now()
  console.log(`Generic wake flow (probe → wait ${probePauseMs}ms → probe): ${url}`)

  let attempts = 0
  while (Date.now() - startedAt < totalWaitMs) {
    attempts += 1
    try {
      const response = await axios.get(url, {
        timeout: checkTimeoutMs,
        headers: BROWSER_HEADERS,
        maxRedirects: 5,
        validateStatus: () => true
      })
      if (wakeOnStatuses.includes(response.status)) {
        const elapsedMs = Date.now() - startedAt
        console.log(`Server is awake after ${attempts} probe(s), ${elapsedMs}ms`)
        return { awake: true, attempts, elapsedMs, strategy: 'generic' }
      }
      console.log(`Wake probe ${attempts}: status ${response.status}, waiting ${probePauseMs}ms...`)
    } catch (error) {
      console.log(`Wake probe ${attempts}: connection ${error.code || error.message}, waiting ${probePauseMs}ms...`)
    }
    await sleep(probePauseMs)
  }

  return { awake: false, attempts, elapsedMs: Date.now() - startedAt, strategy: 'generic' }
}

/**
 * Main entry. Detects the platform by hostname and picks the right strategy.
 *
 * @param {string} baseUrl  e.g. https://your-app.containers.snapdeploy.app
 * @param {object} [options]
 * @param {number} [options.totalWaitMs=185000]
 * @param {number} [options.pollIntervalMs=3000]
 * @param {number} [options.checkTimeoutMs=10000]
 * @param {string[]} [options.wakeOnStatuses=[200, 204, 301, 302, 401, 403, 404]]
 * @returns {Promise<{ awake: boolean, attempts: number, elapsedMs: number, strategy: string }>}
 */
async function wakeServer (baseUrl, options = {}) {
  const {
    totalWaitMs = 185000,
    pollIntervalMs = 3000,
    checkTimeoutMs = 10000,
    wakeOnStatuses = [200, 204, 301, 302, 401, 403, 404]
  } = options

  const opts = { totalWaitMs, pollIntervalMs, checkTimeoutMs, wakeOnStatuses }
  const hostname = new URL(baseUrl).hostname

  if (hostname.endsWith('.containers.snapdeploy.app') ||
      hostname.endsWith('.containers.snapdeploy.dev') ||
      hostname.endsWith('.containers.somdip.dev')) {
    return wakeSnapDeploy(baseUrl, opts)
  }
  return wakeGeneric(baseUrl, opts)
}

module.exports = wakeServer
