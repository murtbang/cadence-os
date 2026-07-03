# Deploy & configure

This service logs into Boostcamp, classifies workouts, and upserts them to Supabase.
It is the **only** component with Boostcamp credentials. The `cadence` dashboard
(Next.js on Vercel) just reads the results from Supabase and triggers pulls over HTTP.

## Architecture

```
Vercel cron (3x/day) ─┐
                      ├─► POST /api/cron/boostcamp-pull ─┐
Dashboard "Pull" tap ─┴─► POST /api/boostcamp/sync ──────┴─► POST /sync  ─► sync.py
   (cadence on Vercel)                                       (this service on Railway)
                                                                   │
                                                                   ▼
                                                               Supabase  ◄─ dashboard reads
```

- **Railway web service**, runs `python server.py` (see `railway.toml`).
- **App Sleeping is ON** → it scales to zero when idle. It has *no* internal
  scheduler; every sync arrives as an HTTP `POST /sync`.
- The **3x/day schedule** is driven by a **Vercel cron** in the `cadence` repo
  (`vercel.json` → `/api/cron/boostcamp-pull`, at `0 21,1,6 * * *` UTC = 1/5/10 PM PST).
  That inbound request also wakes the sleeping service.
- A workout is dated by **Boostcamp's own date**, so logging it late (but dated
  yesterday in Boostcamp) still stores it as yesterday — never "now".

## Endpoints

| Method | Path      | Auth                       | Purpose                                  |
|--------|-----------|----------------------------|------------------------------------------|
| GET    | `/health` | none                       | Liveness check → `{"ok": true}`          |
| POST   | `/sync`   | header `X-Sync-Secret`     | Start a pull (background). Returns `202 {"status":"started"}`, or `409 {"status":"already_running"}` |

## Environment variables

**Railway (this service):**

| Var                     | Value                                                        |
|-------------------------|-------------------------------------------------------------|
| `BOOSTCAMP_EMAIL`       | Boostcamp login email                                       |
| `BOOSTCAMP_PASSWORD`    | Boostcamp login password                                    |
| `SUPABASE_URL`          | Supabase project URL                                         |
| `SUPABASE_KEY`          | Supabase service/anon key used for writes                   |
| `DISCORD_WEBHOOK_URL`   | (optional) webhook for "workout logged" / crash alerts      |
| `BOOSTCAMP_SYNC_SECRET` | shared secret guarding `POST /sync` — **must match Vercel**  |
| `TZ_OFFSET_MINUTES`     | (optional) UTC offset in minutes for week math; default `-420` (US Pacific) |
| `PORT`                  | injected by Railway automatically                           |

**Vercel (`cadence` app):**

| Var                     | Value                                                        |
|-------------------------|-------------------------------------------------------------|
| `BOOSTCAMP_SYNC_URL`    | this service's public Railway domain, e.g. `https://…up.railway.app` |
| `BOOSTCAMP_SYNC_SECRET` | **same** value as on Railway                                |
| `CRON_SECRET`           | already set (Vercel auto-sends it to cron routes)           |

## First-time / change setup

**Railway:**
1. Set the env vars above (especially `BOOSTCAMP_SYNC_SECRET`).
2. Settings → Networking → **Generate Domain** (public URL so the dashboard can reach it).
3. Settings → enable **App Sleeping** (scale-to-zero).
4. Deploy (push this repo — `railway.toml` boots `server.py`).

**Vercel (`cadence`):**
1. Set `BOOSTCAMP_SYNC_URL` (the Railway domain) and `BOOSTCAMP_SYNC_SECRET` (same secret).
2. Deploy (push `cadence`) so the 3 `boostcamp-pull` cron entries in `vercel.json` register.
   The scheduled syncs live **only** here now — don't skip this deploy.

## Verify

- `https://<railway-domain>/health` → `{"ok": true}`
- Manual: tap **Pull** on the dashboard Training page → workout appears within ~30s.
  (First tap after idle is slow, ~10–30s, while the service cold-starts from sleep.)
- Scheduled: check Railway logs after 1/5/10 PM PST for `=== Boostcamp sync starting ===`.

## Notes

- `sync.py` is still runnable standalone for a one-off CLI pull: `python sync.py`.
- A pull takes ~1–2 min and runs in a background thread; the single-flight guard in
  `server.py` makes overlapping triggers a no-op (`409 already_running`).
- Rotating `BOOSTCAMP_SYNC_SECRET` requires updating it on **both** Railway and Vercel.
