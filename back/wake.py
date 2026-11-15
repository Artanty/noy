"""Wake a sleeping render.com backend and wait until it responds.

Port of back-nodejs-backup/utils/wakeServer.js `wakeGeneric` — the strategy validated
live against Render: probe once with a browser-like GET (the GET itself carries the
wake signal), then stay silent for a minute between probes — no ping spam. Roughly
three probes fit in the default 185s budget.
"""
import time

import requests

# Headers that make the probe look like a normal Chrome page load.
BROWSER_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}

# Statuses meaning "the server is up" (404 counts: an awake app answering 404).
AWAKE_STATUSES = {200, 204, 301, 302, 401, 403, 404}


def wake_render(url, total_wait_ms=185000, probe_pause_ms=60000, check_timeout_ms=10000):
    """GET the url; if it does not answer like an awake server, wait silently, repeat.

    Returns {awake, attempts, elapsedMs, strategy} — same shape the node build returned.
    """
    started = time.monotonic()
    attempts = 0
    print(f"Wake flow (probe → wait {probe_pause_ms}ms → probe): {url}")

    while (time.monotonic() - started) * 1000 < total_wait_ms:
        attempts += 1
        try:
            response = requests.get(
                url,
                headers=BROWSER_HEADERS,
                timeout=check_timeout_ms / 1000,
                allow_redirects=True,
            )
            if response.status_code in AWAKE_STATUSES:
                elapsed_ms = round((time.monotonic() - started) * 1000)
                print(f"Server is awake after {attempts} probe(s), {elapsed_ms}ms")
                return {"awake": True, "attempts": attempts, "elapsedMs": elapsed_ms, "strategy": "render"}
            print(f"Wake probe {attempts}: status {response.status_code}, waiting {probe_pause_ms}ms...")
        except requests.RequestException as err:
            print(f"Wake probe {attempts}: connection {err.__class__.__name__}, waiting {probe_pause_ms}ms...")
        # Sleep the pause, but never past the total budget.
        remaining_ms = total_wait_ms - (time.monotonic() - started) * 1000
        time.sleep(max(0, min(probe_pause_ms, remaining_ms)) / 1000)

    return {
        "awake": False,
        "attempts": attempts,
        "elapsedMs": round((time.monotonic() - started) * 1000),
        "strategy": "render",
    }
