# Cadence Voice Scheduler

A standalone Discord bot. Drop a **voice memo** in a watched channel and it gets
transcribed and added to your Google Calendar.

```
voice memo (Discord) → Whisper (transcribe) → Cadence /api/schedule (Claude + Google Calendar) → ✅ reply
```

The bot stays logged in and reacts the moment a voice message appears — no polling.
All Google Calendar logic lives in the Cadence app; this bot only listens,
transcribes, and forwards the transcript.

## Setup

### 1. Discord app
1. [Developer Portal](https://discord.com/developers/applications) → **New Application**.
2. **Bot** tab → **Reset Token** → copy it (`DISCORD_BOT_TOKEN`).
3. **Bot** tab → enable **Message Content Intent**.
4. **OAuth2 → URL Generator** → scopes `bot`, permissions **Read Messages/View Channels** + **Read Message History** → open the URL → add to your server.
5. With Developer Mode on, right-click the target channel → **Copy ID** (`CHANNEL_ID`).

### 2. Cadence side (the other repo)
Set these env vars on the Cadence/Vercel deployment:
- `ANTHROPIC_API_KEY` — for Claude Haiku parsing
- `SCHEDULE_SECRET` — any random string

`/api/schedule` must be live before the bot can create events.

### 3. This bot
Copy `.env.example` → `.env` and fill it in. `SCHEDULE_SECRET` must match Cadence's.

## Run locally

```bash
pip install -r requirements.txt
python bot.py
```

## Deploy on Railway
1. New project from this repo.
2. Add the env vars from `.env.example` (Railway dashboard).
3. Deploy. It runs as a `worker` (see `Procfile`) — no public port.

The bot shows **online** in your server when it's connected.
