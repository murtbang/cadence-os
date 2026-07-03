# cadence-boostcamp-sync

A small sync service that logs into [Boostcamp](https://www.boostcamp.app/), pulls
your training history, classifies each workout (Push / Pull / Legs and the muscles
worked), and upserts the results to [Supabase](https://supabase.com/). It's the
companion backend for the [Cadence](https://github.com/murtbang/cadence-os)
dashboard's Training view, but it runs standalone and has no dependency on the
dashboard beyond a shared Supabase project.

It is the **only** component that holds Boostcamp credentials. Everything else just
reads the classified rows out of Supabase.

## What it does

- **Logs in fresh each run** and fetches recent training history via
  [`boostcamp-api`](https://github.com/Alex-Keyes/boostcamp-api).
- **Classifies** each workout with a keyword map (`EXERCISE_MAP` in `sync.py`):
  majority-vote across the workout's exercises → `Push` / `Pull` / `Legs` / `Other`,
  plus a deduplicated list of muscles worked.
- **Upserts** one row per workout into `boostcamp_workouts` and a single summary row
  (streak, totals) into `boostcamp_summary`. Re-runs are idempotent — a workout is
  keyed by its Boostcamp date, so a late-logged workout is stored on its real date,
  never "now".
- **Notifies Discord** (optional) when a fresh workout lands, and on crashes.
- **Auto-completes a habit** (optional) if you also run the Cadence dashboard: any
  habit whose name contains `workout` / `run` / `gym` / `train` / `exercise` gets
  logged for that date.

## Architecture

```
Vercel cron (3x/day) ─┐
                      ├─► POST /api/cron/boostcamp-pull ─┐
Dashboard "Pull" tap ─┴─► POST /api/boostcamp/sync ──────┴─► POST /sync  ─► sync.py
   (Cadence on Vercel)                                       (this service on Railway)
                                                                   │
                                                                   ▼
                                                               Supabase  ◄─ dashboard reads
```

The service is a tiny request-driven HTTP server (`server.py`) with **no internal
scheduler** — every sync arrives as an HTTP `POST /sync`. That lets it run on Railway
with App Sleeping (scale-to-zero); the inbound request wakes it. `sync.py` is also
runnable directly for a one-off CLI pull.

| Method | Path      | Auth                   | Purpose                                  |
|--------|-----------|------------------------|------------------------------------------|
| GET    | `/health` | none                   | Liveness check → `{"ok": true}`          |
| POST   | `/sync`   | header `X-Sync-Secret` | Start a pull. `202 {"status":"started"}` or `409 {"status":"already_running"}` |

## Quick start (local)

```bash
python -m venv .venv && . .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env        # then fill in your values
python sync.py              # one-off CLI pull
# or run the HTTP server:
python server.py            # serves /health and /sync on :8080
```

Before the first run, create the tables in your Supabase project by pasting
`migration.sql` into the Supabase SQL editor.

## Configuration

Copy `.env.example` to `.env` and set:

| Var                     | Required | Purpose                                                        |
|-------------------------|----------|----------------------------------------------------------------|
| `BOOSTCAMP_EMAIL`       | ✅       | Boostcamp login email                                          |
| `BOOSTCAMP_PASSWORD`    | ✅       | Boostcamp login password                                       |
| `SUPABASE_URL`          | ✅       | Supabase project URL                                           |
| `SUPABASE_KEY`          | ✅       | Supabase **service_role** key (the sync writes rows)           |
| `BOOSTCAMP_SYNC_SECRET` | ✅ (server) | Shared secret guarding `POST /sync`; match it on the caller |
| `DISCORD_WEBHOOK_URL`   | optional | Webhook for "workout logged" and crash alerts                  |
| `TZ_OFFSET_MINUTES`     | optional | UTC offset in minutes for week math; default `-420` (US Pacific) |
| `PORT`                  | optional | HTTP port for `server.py` (Railway injects this)               |

## Deploy

See [`DEPLOY.md`](DEPLOY.md) for the full Railway + Vercel walkthrough (generate a
public domain, enable App Sleeping, wire the shared secret, register the cron).

## Customizing classification

`EXERCISE_MAP` in `sync.py` is an ordered list of
`(keyword_substring, classification, [muscles])`. Matching is lowercase-substring,
first match wins. Add your own exercises or retarget muscles by editing that list —
no other code changes needed. Anything unmatched classifies as `Other`.

## License

[MIT](LICENSE)
