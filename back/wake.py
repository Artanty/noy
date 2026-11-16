"""Wake a sleeping PaaS container and wait until it responds.

Strategy detection matches feat's wake-up v3 (URL-parsed 'way'):
  *.onrender.com → 'render'   (no wake API: the probe request itself triggers cold start)
  *.containers.snapdeploy.app|dev / *.containers.somdip.dev → 'snapdeploy'
  anything else  → 'poll'     (same probe loop as render)

Port of back-nodejs-backup/utils/wakeServer.js: snapdeploy replicates the platform's own
wake page (POST the wake API, then HEAD-poll every ~3s until status ≠ 503); render/poll
use the strategy validated live against Render — probe once with a browser-like GET,
then stay silent for a minute between probes. No ping spam.
"""
import re
import time
from urllib.parse import urlparse

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

_SNAPDEPLOY_HOST = re.compile(
    r"^([a-z0-9-]+)\.containers\.(snapdeploy\.app|snapdeploy\.dev|somdip\.dev)$", re.I
)


def detect_strategy(url):
    """Parse the target hostname and pick the wake 'way' (feat wake-up v3 parity)."""
    try:
        host = urlparse(url).hostname or ""
    except ValueError:
        return "poll"
    if host.endswith(".onrender.com"):
        return "render"
    if _SNAPDEPLOY_HOST.match(host):
        return "snapdeploy"
    return "poll"


def _remaining_ms(started, total_wait_ms):
    return total_wait_ms - (time.monotonic() - started) * 1000


def wake_snapdeploy(url, total_wait_ms=185000, poll_interval_ms=3000, check_timeout_ms=10000):
    """Replicate snapdeploy's own wake page: POST the wake API, then HEAD-poll.

    503 is the sleeping wake-page response — anything else in AWAKE_STATUSES is awake.
    A failed wake POST (e.g. 429) is swallowed: the container may already be waking,
    the poll decides.
    """
    host = urlparse(url).hostname or ""
    m = _SNAPDEPLOY_HOST.match(host)
    subdomain = m.group(1) if m else host.split(".")[0]
    # dev hosts use the somdip API; prod snapdeploy.dev
    api_base = "https://containers.somdip.dev" if host.endswith(".somdip.dev") else "https://snapdeploy.dev"

    started = time.monotonic()
    print("SnapDeploy wake flow: POST {}/api/public/wake/{}".format(api_base, subdomain))
    try:
        response = requests.post(
            api_base + "/api/public/wake/" + subdomain,
            json={},
            headers=dict(BROWSER_HEADERS, **{"Content-Type": "application/json"}),
            timeout=20,
        )
        print("Wake initiated: status {}".format(response.status_code))
    except requests.RequestException as err:
        print("Wake API call failed ({}), continuing to poll anyway".format(err.__class__.__name__))

    attempts = 0
    while _remaining_ms(started, total_wait_ms) > 0:
        attempts += 1
        try:
            response = requests.head(
                url, headers=BROWSER_HEADERS, timeout=check_timeout_ms / 1000,
                allow_redirects=True,
            )
            if response.status_code != 503 and response.status_code in AWAKE_STATUSES:
                elapsed_ms = round((time.monotonic() - started) * 1000)
                print("Container is awake after {} check(s), {}ms".format(attempts, elapsed_ms))
                return {"awake": True, "attempts": attempts, "elapsedMs": elapsed_ms, "strategy": "snapdeploy"}
            print("Wake check #{}: status {}, still starting...".format(attempts, response.status_code))
        except requests.RequestException as err:
            print("Wake check #{} failed (still starting): {}".format(attempts, err.__class__.__name__))
        time.sleep(max(0, min(poll_interval_ms, _remaining_ms(started, total_wait_ms))) / 1000)

    return {
        "awake": False,
        "attempts": attempts,
        "elapsedMs": round((time.monotonic() - started) * 1000),
        "strategy": "snapdeploy",
    }


def wake_probe(url, total_wait_ms=185000, probe_pause_ms=60000, check_timeout_ms=10000):
    """Render/poll strategy: GET the url; if it does not answer like an awake server,
    wait silently, repeat — the GET itself carries the wake signal, no ping spam."""
    started = time.monotonic()
    attempts = 0
    print("Wake flow (probe → wait {}ms → probe): {}".format(probe_pause_ms, url))

    while _remaining_ms(started, total_wait_ms) > 0:
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
                print("Server is awake after {} probe(s), {}ms".format(attempts, elapsed_ms))
                return {"awake": True, "attempts": attempts, "elapsedMs": elapsed_ms, "strategy": detect_strategy(url)}
            print("Wake probe {}: status {}, waiting {}ms...".format(attempts, response.status_code, probe_pause_ms))
        except requests.RequestException as err:
            print("Wake probe {}: connection {}, waiting {}ms...".format(attempts, err.__class__.__name__, probe_pause_ms))
        # Sleep the pause, but never past the total budget.
        time.sleep(max(0, min(probe_pause_ms, _remaining_ms(started, total_wait_ms))) / 1000)

    return {
        "awake": False,
        "attempts": attempts,
        "elapsedMs": round((time.monotonic() - started) * 1000),
        "strategy": detect_strategy(url),
    }


# Back-compat alias for the old entry point name.
wake_render = wake_probe


def wake_server(url, total_wait_ms=185000, probe_pause_ms=60000, poll_interval_ms=3000, check_timeout_ms=10000):
    """Detect the platform by hostname and dispatch to the right strategy."""
    strategy = detect_strategy(url)
    if strategy == "snapdeploy":
        return wake_snapdeploy(
            url,
            total_wait_ms=total_wait_ms,
            poll_interval_ms=poll_interval_ms,
            check_timeout_ms=check_timeout_ms,
        )
    return wake_probe(
        url,
        total_wait_ms=total_wait_ms,
        probe_pause_ms=probe_pause_ms,
        check_timeout_ms=check_timeout_ms,
    )
