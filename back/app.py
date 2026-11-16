"""noy backend — python port of back-nodejs-backup (Flask), simplified to ONE function:
wake a render.com backend. The website calls GET /wake on startup and waits for the
response; CORS is open so a browser can call it cross-origin.

Run: `python app.py` (listens on HOST:PORT from .env, default 0.0.0.0:3211).
"""
from dotenv import load_dotenv
from flask import Flask, jsonify, request

load_dotenv()

from config import (  # noqa: E402  (after load_dotenv)
    HOST,
    PORT,
    WAKE_CHECK_TIMEOUT_MS,
    WAKE_PROBE_PAUSE_MS,
    WAKE_TARGET,
    WAKE_TOTAL_WAIT_MS,
)
from wake import wake_server  # noqa: E402

app = Flask(__name__)


@app.after_request
def add_cors(response):
    # browser consumers call /wake cross-origin — without this header the response is
    # blocked and the wake dies as "noy unreachable" (the exact bug fixed 2026-11-15)
    response.headers["Access-Control-Allow-Origin"] = "*"
    return response


@app.get("/healthz")
def healthz():
    return jsonify({"ok": True, "wake_target": WAKE_TARGET})


@app.get("/wake")
def wake():
    """Wake the render.com backend (env WAKE_TARGET, or a ?target= override) and wait
    until it is up. 200 {awake: true, attempts, elapsedMs, target} once awake;
    504 {awake: false, ...} if the budget (?maxWaitMs= override) runs out."""
    target = request.args.get("target") or WAKE_TARGET
    if not target:
        return jsonify({"error": 'Missing "target" query param and WAKE_TARGET is not set'}), 400
    max_wait_ms = request.args.get("maxWaitMs", type=int) or WAKE_TOTAL_WAIT_MS

    report = wake_server(
        target,
        total_wait_ms=max_wait_ms,
        probe_pause_ms=WAKE_PROBE_PAUSE_MS,
        check_timeout_ms=WAKE_CHECK_TIMEOUT_MS,
    )
    report["target"] = target
    if not report["awake"]:
        print(f"❌ FAILURE: did not wake up within {max_wait_ms}ms: {target}")
        return jsonify({"error": f"Server did not wake up within {max_wait_ms}ms", **report}), 504
    print(f"✅ SUCCESS: {target} awake in {round(report['elapsedMs'] / 1000)}s, {report['attempts']} check(s)")
    return jsonify(report)


@app.get("/make-wake-request")
def make_wake_request():
    """feat wake-up v3 `noy` mode contract — the browser calls
    GET /make-wake-request?target=<url>&app=<project>[&maxWaitMs=<ms>] and reads
    {request: "completed", wake: {awake, attempts, elapsedMs, strategy}}.
    200 + request=completed when awake; 504 + request=failed when the budget runs out.
    `app` is only a label for the log (the python back has no stat events)."""
    target = request.args.get("target")
    if not target:
        return jsonify({"request": "failed", "error": 'Missing "target" query param'}), 400
    app_label = request.args.get("app") or "-"
    max_wait_ms = request.args.get("maxWaitMs", type=int) or WAKE_TOTAL_WAIT_MS

    print(f"make-wake-request app={app_label} target={target} budget={max_wait_ms}ms")
    report = wake_server(
        target,
        total_wait_ms=max_wait_ms,
        probe_pause_ms=WAKE_PROBE_PAUSE_MS,
        check_timeout_ms=WAKE_CHECK_TIMEOUT_MS,
    )
    report["target"] = target
    if not report["awake"]:
        print(f"❌ FAILURE: app={app_label} did not wake up within {max_wait_ms}ms: {target}")
        return jsonify({"request": "failed", "error": f"Server did not wake up within {max_wait_ms}ms", "wake": report}), 504
    print(f"✅ SUCCESS: app={app_label} {target} awake in {round(report['elapsedMs'] / 1000)}s, {report['attempts']} check(s)")
    return jsonify({"request": "completed", "wake": report})


if __name__ == "__main__":
    import sys

    # wake-flow prints must land in the hosting log immediately, not in stdout's block buffer
    # (reconfigure is py3.7+ — the VH host python is 3.6, local runs are newer)
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(line_buffering=True)
    app.run(host=HOST, port=PORT, debug=False)
