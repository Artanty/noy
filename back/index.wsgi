import logging
import os
import sys

# Apache's wsgi-script handler captures stderr → hosting log. Configure first so the
# import failure below is actually visible (it used to vanish silently).
logging.basicConfig(
    stream=sys.stderr,
    level=logging.INFO,
    format="[noy] %(asctime)s %(levelname)s %(message)s",
)
log = logging.getLogger("noy.wsgi")

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# A slot-side venv (created by the deploy's pip step — the VH host python is 3.6 with
# no pip of its own) is picked up here: Apache still runs the system python, it just
# imports from the venv's site-packages.
_venv_sp = os.path.join(os.path.dirname(os.path.abspath(__file__)), "venv")
if os.path.isdir(_venv_sp):
    import glob
    for _sp in sorted(glob.glob(os.path.join(_venv_sp, "lib", "python*", "site-packages"))):
        sys.path.append(_sp)
    log.info("venv site-packages appended: %s", _venv_sp)

try:
    from app import app as application
except Exception:
    # a broken import must land in the hosting log, not disappear
    log.exception("WSGI import FAILED — app will NOT serve")
    raise

log.info("WSGI app loaded OK — /wake, /healthz")
