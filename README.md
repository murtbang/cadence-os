# Cadence

**A self-hosted personal daily operating system.** Cadence puts your habits, to-dos, calendar, training, weather, goals, and smart-light controls into one dense, glanceable dashboard — with a Discord bot so you can log and check things from your phone without opening the app.

It's built to run on a wall-mounted tablet (designed around a Samsung Galaxy Tab A7 Lite in landscape), but it works in any browser and installs as a PWA on phones.

> Single-user by design. You self-host it, it's yours, your data lives in your own Supabase project.

---

## Contents

- [Features](#features)
- [How it works](#how-it-works)
- [Prerequisites](#prerequisites)
- [Setup](#setup)
  - [1. Clone & install](#1-clone--install)
  - [2. Supabase (database)](#2-supabase-database)
  - [3. Environment variables](#3-environment-variables)
  - [4. Run it locally](#4-run-it-locally)
  - [5. Google Calendar](#5-google-calendar-optional-recommended)
  - [6. Discord bot](#6-discord-bot-optional-recommended)
  - [7. Deploy to Vercel](#7-deploy-to-vercel)
  - [8. Scheduled jobs (cron)](#8-scheduled-jobs-cron)
  - [9. Optional extras](#9-optional-extras)
- [Customize it for you](#customize-it-for-you)
- [Discord command reference](#discord-command-reference)
- [Project structure](#project-structure)
- [Troubleshooting](#troubleshooting)
- [License](#license)

---

## Features

**Dashboard** — a fixed 2-column grid of auto-flipping cards, each cycling through related faces:
- **Now / Weather** — big clock + current conditions.
- **Next Event / Next Todo / Tomorrow / This Week** — your next calendar event, next due to-do, and upcoming days.
- **Training** — recent workout + weight trend.
- **Habits** — today's checklist + streaks.
- **Goals / Quote** — big-goal progress.
- **Lights** — one-tap Govee scenes.

**Habits** — AM/PM checklists with streaks and 7-day completion, soft-delete, per-period tracking.

**To-dos** — custom categories you add / rename / delete right in the app (starts with a "Personal" tab), high/low priority, drag-to-reorder, and **due dates** that badge in the list, appear on the calendar, and escalate through your daily check-ins.

**Calendar** — a week strip plus a 30-day scrollable agenda from your Google Calendar, with timed to-dos overlaid on their due day.

**Training** — 30-day weight chart, per-day workout history, PRs, and an editable weekly split target. Optionally auto-synced from Boostcamp.

**Weather** — current conditions + a 7-day forecast (US National Weather Service, no API key needed).

**Weekly snapshot** — habits, training, weight delta, and tasks completed, at a glance.

**Screen guard** — burn-in protection for wall-mounted tablets: night dimming, idle dim, and hold-to-peek.

**Discord bot** — the app is fully drivable from Discord:
- Slash commands: `/habit`, `/todo`, `/weight`, `/note`, `/calendar`, `/help`.
- **Tap-to-log habit reminders** (AM/PM) with buttons — no typing.
- **Daily check-ins** (morning summary, midday, evening wrap) with a "due soon" block.
- **Calendar reminders** (1 h / 30 / 15 / 5 min before) with a one-tap snooze link.
- Optional **voice-to-action**: send a spoken/typed sentence, an LLM turns it into the right event/to-do/habit/weight/note.

---

## How it works

```
                       ┌─────────────────────────────────────────┐
   Browser / PWA  ───► │  Next.js 14 app (Vercel)                │
   (tablet, phone)     │   • React dashboard + views             │
                       │   • /api/* route handlers               │
   Discord  ──────────►│   • /api/discord/interactions (bot)     │
   (commands, buttons) │   • middleware.ts (PIN gate)            │
                       └───────────────┬─────────────────────────┘
   Vercel Cron  ──────────────────────►│  (scheduled /api/cron/* jobs)
                                       ▼
                          ┌────────────────────────┐
                          │  Supabase (Postgres)   │  ◄── your data
                          └────────────────────────┘
              external reads: Google Calendar (iCal + API), weather.gov, Govee
```

- **Framework:** Next.js 14 (App Router), React 18, TypeScript. Some controls use Ionic React; styling is Tailwind + inline styles.
- **Data:** Supabase (Postgres). All DB access is server-side via route handlers using the service-role key, so keys never reach the browser and RLS locks out the public anon role.
- **Auth:** a single PIN (`DASHBOARD_PIN`). `middleware.ts` gates every page/route behind a signed cookie; cron and Discord routes authenticate with secrets/signatures instead.
- **Scheduling:** Vercel Cron hits `/api/cron/*` routes on a schedule (see `vercel.json`).
- **No build step for your data:** everything is read/written live from Supabase; the app polls every ~10 s.

---

## Prerequisites

You'll need free accounts for:

| Service | Required? | For |
|---|---|---|
| [Supabase](https://supabase.com) | **Yes** | Database |
| [Vercel](https://vercel.com) | **Yes** (to host) | Deployment + cron |
| [Discord](https://discord.com/developers) | Recommended | Bot commands, reminders, check-ins |
| [Google Cloud](https://console.cloud.google.com) | Recommended | Calendar read/write |
| [Anthropic](https://console.anthropic.com) | Optional | Voice-to-action |
| [Govee](https://developer.govee.com) | Optional | Smart-light control |

Local tooling: **Node.js 18+** and **git**.

---

## Setup

### 1. Clone & install

```bash
git clone https://github.com/<you>/cadence.git
cd cadence
npm install
```

### 2. Supabase (database)

1. Create a new project at [supabase.com](https://supabase.com).
2. Open **SQL Editor → New query**, paste the entire contents of [`db/schema.sql`](db/schema.sql), and run it. This creates every table and enables Row Level Security.
3. Go to **Project Settings → API** and copy three values for the next step:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` `public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` `secret` key → `SUPABASE_SERVICE_ROLE_KEY` *(server-only — keep it secret)*

### 3. Environment variables

```bash
cp .env.example .env.local
```

Fill in at minimum the Supabase keys, a `DASHBOARD_PIN`, and a `CRON_SECRET`. Generate the secret with:

```bash
node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"
```

Every variable is documented in [`.env.example`](.env.example). You can add the Google/Discord/optional values now or come back to them.

### 4. Run it locally

```bash
npm run dev
```

Open **http://localhost:3000**. (Locally, if `DASHBOARD_PIN` is unset the app stays open; once set you'll see the PIN screen.)

You should be able to add habits, to-dos, log weight, etc. — that confirms Supabase is wired up. The rest (calendar, Discord) is optional and layered on next.

### 5. Google Calendar *(optional, recommended)*

Cadence uses Google Calendar two ways. You can set up either or both.

**Read (show events on the dashboard + reminders):**
1. Google Calendar → **Settings** → click your calendar → **Integrate calendar**.
2. Copy the **Secret address in iCal format** → `GOOGLE_CALENDAR_ICAL_URL`.

**Write (create/edit events from Discord `/calendar` and voice):** this needs OAuth.
1. [Google Cloud Console](https://console.cloud.google.com) → create a project → enable the **Google Calendar API**.
2. **APIs & Services → Credentials → Create OAuth client ID** (type: *Web application*). Copy the client ID/secret → `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`.
3. Use the [OAuth Playground](https://developers.google.com/oauthplayground) (gear → *Use your own OAuth credentials*) to authorize the `https://www.googleapis.com/auth/calendar` scope and exchange for a **refresh token** → `GOOGLE_REFRESH_TOKEN`.
4. Set `GOOGLE_CALENDAR_ID` to the calendar you want to write to (your email, or a specific calendar's ID).

### 6. Discord bot *(optional, recommended)*

1. [Discord Developer Portal](https://discord.com/developers/applications) → **New Application**.
2. **General Information**: copy **Application ID** → `DISCORD_APP_ID`, and **Public Key** → `DISCORD_PUBLIC_KEY`.
3. **Bot** → **Reset Token** → copy → `DISCORD_BOT_TOKEN`.
4. **OAuth2 → URL Generator**: scopes `bot` + `applications.commands`, then open the generated URL to invite the bot to your server.
5. Create a **channel webhook** (Channel → Edit → Integrations → Webhooks → New) → copy URL → `DISCORD_ALERTS_WEBHOOK_URL`. (Optionally a second one → `DISCORD_LOGS_WEBHOOK_URL`.)
6. After you've deployed (step 7), set the **Interactions Endpoint URL** (General Information) to:
   `https://<your-app>/api/discord/interactions` — Discord will verify it live.
7. **Register the slash commands** by visiting once in your browser (logged into Vercel, or after you've turned off Vercel deployment protection):
   `https://<your-app>/api/discord/register?secret=<CRON_SECRET or REGISTER_SECRET>`
   A `{ "ok": true, "scope": "guild (instant)" }` response means it worked. Reload Discord (Ctrl+R) to see the commands.

### 7. Deploy to Vercel

1. Push your repo to GitHub and **Import** it in Vercel.
2. Add **every** variable from your `.env.local` under **Settings → Environment Variables** (Production).
3. Deploy. Your app is live at `https://<project>.vercel.app` — set that as `NEXT_PUBLIC_APP_URL` and redeploy.

> **Deployment protection:** if you enable Vercel Authentication/Deployment Protection, external callers (Discord, cron pings from other services) get blocked. Cadence has its own PIN + secret auth, so you can safely leave Vercel's protection **off**.

### 8. Scheduled jobs (cron)

The schedules live in [`vercel.json`](vercel.json) and register automatically on deploy. Vercel sends `CRON_SECRET` as the auth bearer, so no extra config is needed.

| Route | What it does |
|---|---|
| `/api/cron/summary` | Morning daily summary to Discord |
| `/api/cron/checkin` | Midday + evening check-ins (with "due soon" tasks) |
| `/api/cron/habits-am` / `habits-pm` | Tap-to-log habit reminders |
| `/api/cron/calendar-alert` | Fires event reminders (runs every 5 min) |
| `/api/cron/boostcamp-pull` | Triggers the optional training sync |

> **Note:** sub-hourly crons (the every-5-minute `calendar-alert`) require the **Vercel Pro** plan. On Hobby, change it to an hourly (or coarser) schedule in `vercel.json`. Times are in **UTC** — adjust for your timezone.

### 9. Optional extras

- **Voice-to-action** (`/api/schedule`): set `ANTHROPIC_API_KEY` and `SCHEDULE_SECRET`. POST `{ "text": "dentist tuesday at 2pm" }` with header `x-schedule-secret`; an LLM routes it to the right action. Wire this to any voice/transcription source.
- **Govee lights**: apply for a key at [developer.govee.com](https://developer.govee.com) → `GOVEE_API_KEY`. The dashboard Lights card auto-detects your devices.
- **Boostcamp training sync**: a companion service (separate repo) that logs into Boostcamp, classifies workouts, and writes them to Supabase. Set `BOOSTCAMP_SYNC_URL` + `BOOSTCAMP_SYNC_SECRET`.

---

## Customize it for you

Cadence ships with the original author's defaults. Change these before (or after) going live:

| What | Where | Change to |
|---|---|---|
| **Weather coordinates** | set `WEATHER_LAT` / `WEATHER_LON` env vars (US only — NWS) | your lat/lon |
| **Location label** | `components/HomeClient.tsx`, `components/MobileClient.tsx`, `components/WeatherView.tsx` | your city name |
| **Timezone** | `America/Los_Angeles` appears throughout (`lib/`, `app/api/cron/*`, components) | search-and-replace with your [IANA timezone](https://en.wikipedia.org/wiki/List_of_tz_database_time_zones) |
| **To-do categories** | managed in-app — use the ＋ tab to add, ✎ to rename/delete. Starts seeded with "Personal" (see `db/schema.sql`). | no code changes needed |
| **Weekly training split** | default `Push/Pull/Push/Pull/Legs` | edit inline on the Training page, or the default in `app/api/boostcamp/recent-body-map/route.ts` |
| **Cron times** | `vercel.json` (UTC) | your schedule |

Your habits, to-dos, goals, and weight all live in the database — add/edit them in the app, not the code.

---

## Discord command reference

| Command | Does |
|---|---|
| `/help` | List all commands |
| `/habit [name] [period]` | Mark a habit done; **blank** → list all habits with tap-to-log buttons |
| `/todo [text] [priority] [category] [due]` | Add a task; **blank** → list open tasks in two columns |
| `/weight <lbs>` | Log body weight |
| `/note <text>` | Send a note to the dashboard |
| `/calendar create\|modify\|delete` | Manage Google Calendar events |

Habit reminders and check-ins are pushed automatically by the cron jobs.

---

## Project structure

```
app/                 Next.js routes
  api/               server route handlers (habits, todos, calendar, discord, cron, …)
  page.tsx           app shell
components/          dashboard cards, views, flip faces
lib/                 supabase, discord, google calendar, ical parser, cron/auth helpers
types/               shared TypeScript types
db/schema.sql        full database schema (run once in Supabase)
middleware.ts        PIN auth gate
vercel.json          cron schedules
```

---

## Troubleshooting

- **Dashboard is empty / everything 401s** — check `SUPABASE_SERVICE_ROLE_KEY` is set correctly in Vercel; that's the key the server reads with.
- **PIN screen won't accept my PIN** — env changes need a redeploy on Vercel; make sure `DASHBOARD_PIN` is set for Production.
- **Discord commands don't appear** — re-hit `/api/discord/register?secret=…`, then reload the Discord client (Ctrl+R).
- **Discord buttons/commands 401 or time out** — turn **off** Vercel Deployment Protection; it blocks Discord's requests.
- **Calendar is blank** — confirm `GOOGLE_CALENDAR_ICAL_URL` is the *secret iCal* URL; recurring events only show on matching days.
- **Layout looks cramped** — the dashboard is tuned for a landscape tablet (~893×533). Full-page views adapt better to phones/portrait.

---

## License

[MIT](LICENSE). This is a personal project shared as-is — no warranty, no support guarantees. PRs welcome.
