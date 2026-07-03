"""
Tiny HTTP wrapper around sync.py for on-demand "Pull now" from the dashboard.

Exposes:
  GET  /health  → {"ok": true}                      (no auth)
  POST /sync    → {"status": "started"}              (requires secret header)

The actual pull reuses sync.sync() unchanged — so a manual pull classifies and
dates workouts exactly like the scheduled cron does (a workout Boostcamp dates to
yesterday is stored as yesterday, never "now").

Auth: send header  X-Sync-Secret: <BOOSTCAMP_SYNC_SECRET>.

Runs as a Railway *web* service with App Sleeping enabled (startCommand =
"python server.py", see railway.toml). The service is purely request-driven so it
can scale to zero: both the scheduled 3x/day syncs and manual "Pull now" taps
arrive as HTTP POSTs to /sync — the scheduled ones from a Vercel cron in the
cadence app (/api/cron/boostcamp-pull), which wakes this service on the way in.
sync.py is still runnable standalone (python sync.py) for one-off CLI runs.
"""

import os
import json
import asyncio
import threading
import traceback as tb
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from sync import sync, discord_notify

PORT          = int(os.environ.get("PORT", "8080"))
SYNC_SECRET   = os.environ.get("BOOSTCAMP_SYNC_SECRET", "")

# Single-flight guard so two rapid taps don't run overlapping syncs.
_lock    = threading.Lock()
_running = False


def _run_sync() -> None:
    """Run one sync() to completion in this thread, then clear the flag."""
    global _running
    try:
        new_count = asyncio.run(asyncio.wait_for(sync(), timeout=150))
        print(f"=== Manual pull complete. {new_count} new workout(s) ===")
    except Exception as exc:
        full = tb.format_exc()
        chain = []
        e = exc
        while e:
            chain.append(f"{type(e).__name__}: {e!r}")
            e = e.__cause__ or (e.__context__ if not getattr(e, "__suppress_context__", False) else None)
        discord_notify(f"❌ Manual pull crashed: {' → '.join(chain[:4])}\n```{full[-1000:]}```")
        print(f"Manual pull error: {full}")
    finally:
        with _lock:
            _running = False


class Handler(BaseHTTPRequestHandler):
    def _json(self, code: int, body: dict) -> None:
        payload = json.dumps(body).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def do_GET(self):
        if self.path.rstrip("/") in ("/health", ""):
            self._json(200, {"ok": True})
        else:
            self._json(404, {"error": "not found"})

    def do_POST(self):
        if self.path.rstrip("/") != "/sync":
            self._json(404, {"error": "not found"})
            return

        if not SYNC_SECRET or self.headers.get("X-Sync-Secret") != SYNC_SECRET:
            self._json(401, {"error": "unauthorized"})
            return

        if _trigger_sync():
            self._json(202, {"status": "started"})
        else:
            self._json(409, {"status": "already_running"})

    # Quieter logs — Railway captures stdout, default logging is noisy.
    def log_message(self, *args):
        return


def _trigger_sync() -> bool:
    """Start a sync if one isn't already running. Returns True if it started."""
    global _running
    with _lock:
        if _running:
            return False
        _running = True
    threading.Thread(target=_run_sync, daemon=True).start()
    return True


def main():
    if not SYNC_SECRET:
        print("⚠️  BOOSTCAMP_SYNC_SECRET is unset — /sync will reject every request.")
    server = ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    print(f"Boostcamp sync server listening on :{PORT}")
    server.serve_forever()


if __name__ == "__main__":
    main()
