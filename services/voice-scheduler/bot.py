"""
Cadence voice scheduler bot.

Logs into Discord, watches one channel. When a voice memo lands there it:
  1. downloads the .ogg attachment
  2. transcribes it with OpenAI Whisper
  3. POSTs the transcript to Cadence's /api/schedule (which runs Claude + Google Calendar)
  4. replies in the channel with the result
"""

import asyncio
import io
import os

import aiohttp
import discord
from openai import OpenAI

DISCORD_BOT_TOKEN = os.environ["DISCORD_BOT_TOKEN"]
OPENAI_API_KEY    = os.environ["OPENAI_API_KEY"]
CHANNEL_ID        = int(os.environ["CHANNEL_ID"])
SCHEDULE_URL      = os.environ["SCHEDULE_URL"]        # e.g. https://cadence.vercel.app/api/schedule
SCHEDULE_SECRET   = os.environ["SCHEDULE_SECRET"]     # must match Cadence's SCHEDULE_SECRET

VOICE_MESSAGE_FLAG = 1 << 13  # 8192 — Discord's IS_VOICE_MESSAGE message flag

openai_client = OpenAI(api_key=OPENAI_API_KEY)

intents = discord.Intents.default()
intents.message_content = True  # privileged — enable "Message Content Intent" in the dev portal
client = discord.Client(intents=intents)


def is_voice_memo(message: discord.Message) -> bool:
    """True if this message is a Discord voice message."""
    if message.flags.value & VOICE_MESSAGE_FLAG:
        return True
    # Fallback: any audio attachment.
    return any(
        (a.content_type or "").startswith("audio/") or a.filename.lower().endswith(".ogg")
        for a in message.attachments
    )


async def transcribe(audio: bytes) -> str:
    """Whisper transcription. Runs in a thread so it doesn't block the event loop."""
    buf = io.BytesIO(audio)
    buf.name = "voice.ogg"  # Whisper infers format from the filename

    def _run() -> str:
        result = openai_client.audio.transcriptions.create(model="whisper-1", file=buf)
        return result.text

    return await asyncio.to_thread(_run)


async def schedule(text: str) -> dict:
    """Hand the transcript to Cadence, which parses it and writes to Google Calendar."""
    async with aiohttp.ClientSession() as session:
        async with session.post(
            SCHEDULE_URL,
            json={"text": text},
            headers={"x-schedule-secret": SCHEDULE_SECRET},
            timeout=aiohttp.ClientTimeout(total=30),
        ) as resp:
            return await resp.json()


@client.event
async def on_ready():
    print(f"Logged in as {client.user} — watching channel {CHANNEL_ID}")


@client.event
async def on_message(message: discord.Message):
    if message.author.bot:
        return
    if message.channel.id != CHANNEL_ID:
        return
    if not is_voice_memo(message):
        return

    await message.add_reaction("⏳")
    try:
        audio = await message.attachments[0].read()
        transcript = await transcribe(audio)
        if not transcript.strip():
            await message.reply("❌ Couldn't make out any speech.")
            return

        result = await schedule(transcript)
        if result.get("ok"):
            await message.reply(f"✅ Created: {result['display']}\n_heard: “{transcript.strip()}”_")
        else:
            await message.reply(f"❌ {result.get('error', 'Scheduling failed')}\n_heard: “{transcript.strip()}”_")
    except Exception as e:  # noqa: BLE001 — surface any failure back to the channel
        await message.reply(f"❌ Error: {e}")
    finally:
        try:
            await message.remove_reaction("⏳", client.user)
        except discord.HTTPException:
            pass


if __name__ == "__main__":
    client.run(DISCORD_BOT_TOKEN)
