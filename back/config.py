"""Settings — loaded from .env (dotenv), same pattern as ../plst/back/config.py.

Keys are documented in .env.example. The node build's HOST/PORT keep their meaning;
WAKE_TARGET and the WAKE_* timings are new.
"""
import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent / ".env")


def _int(name, default):
    try:
        return int(os.environ[name])
    except (KeyError, ValueError):
        return default


HOST = os.environ.get("HOST") or "0.0.0.0"
PORT = _int("PORT", 3211)  # same default the node build used

# The render.com backend this service exists to wake (full URL, incl. path).
WAKE_TARGET = os.environ.get("WAKE_TARGET") or None

# Timings in ms, ported from back-nodejs-backup/utils/wakeServer.js defaults:
WAKE_TOTAL_WAIT_MS = _int("WAKE_TOTAL_WAIT_MS", 185000)  # total budget (~3 min)
WAKE_PROBE_PAUSE_MS = _int("WAKE_PROBE_PAUSE_MS", 60000)  # silent pause between probes
WAKE_CHECK_TIMEOUT_MS = _int("WAKE_CHECK_TIMEOUT_MS", 10000)  # per-probe timeout

# feat thru feature (backend-thru slot): true = register the /thru pass-through
# blueprint (vendored thru.py). Off/unset = the endpoint does not exist.
FEAT_THRU = os.environ.get("FEAT_THRU", "").strip().lower() == "true"

# feat host serving the web-component bundles for the '/' page (version-display badge).
FEAT_URL = (os.environ.get("FEAT_URL") or "https://feat.twc1.net").rstrip("/")
