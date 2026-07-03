import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const COMMANDS = [
  {
    name:        'calendar',
    description: 'Create, modify, or delete a Google Calendar event',
    options: [
      {
        name: 'create', description: 'Create a new calendar event', type: 1,
        options: [
          { name: 'name',        description: 'Event name',                      type: 3, required: true  },
          { name: 'date',        description: 'Date — YYYY-MM-DD, today, tomorrow', type: 3, required: true  },
          { name: 'start_time',  description: 'Start time — HH:MM or 2:30pm',    type: 3, required: true  },
          { name: 'end_time',    description: 'End time — HH:MM or 3pm',          type: 3, required: true  },
          { name: 'description', description: 'Event description',                type: 3, required: false },
          { name: 'location',    description: 'Location',                         type: 3, required: false },
        ],
      },
      {
        name: 'modify', description: 'Modify an existing calendar event', type: 1,
        options: [
          { name: 'search',      description: 'Search for event by name',         type: 3, required: true  },
          { name: 'name',        description: 'New event name',                   type: 3, required: false },
          { name: 'date',        description: 'New date — YYYY-MM-DD, today, tomorrow', type: 3, required: false },
          { name: 'start_time',  description: 'New start time',                   type: 3, required: false },
          { name: 'end_time',    description: 'New end time',                     type: 3, required: false },
          { name: 'description', description: 'New description',                  type: 3, required: false },
          { name: 'location',    description: 'New location',                     type: 3, required: false },
        ],
      },
      {
        name: 'delete', description: 'Delete a calendar event (with confirmation)', type: 1,
        options: [
          { name: 'search', description: 'Search for event by name', type: 3, required: true },
        ],
      },
    ],
  },
  {
    name: 'todo',
    description: 'Add a task — or leave blank to list all open todos',
    options: [
      { name: 'text', description: 'Task text (leave blank to list all open todos)', type: 3, required: false },
      {
        name: 'priority',
        description: 'Priority level (default: low)',
        type: 3,
        required: false,
        choices: [
          { name: 'High', value: 'high' },
          { name: 'Low',  value: 'low'  },
        ],
      },
      { name: 'category', description: 'Category name (default: Personal)', type: 3, required: false },
      { name: 'due', description: 'Due date — YYYY-MM-DD, today, or tomorrow', type: 3, required: false },
    ],
  },
  {
    name: 'habit',
    description: 'Mark a habit done — or leave blank to see all habits',
    options: [
      { name: 'name', description: 'Habit name (leave blank to list all)', type: 3, required: false },
      {
        name: 'period',
        description: 'AM or PM (optional — helps if you have habits with the same name)',
        type: 3,
        required: false,
        choices: [
          { name: 'AM', value: 'AM' },
          { name: 'PM', value: 'PM' },
        ],
      },
    ],
  },
  {
    name: 'note',
    description: 'Send a note to the Cadence notifications view',
    options: [
      { name: 'text', description: 'Note content', type: 3, required: true },
    ],
  },
  {
    name: 'weight',
    description: 'Log your weight and update your goal',
    options: [
      { name: 'lbs', description: 'Weight in pounds (e.g. 172.5)', type: 10, required: true },
    ],
  },
  {
    name: 'help',
    description: 'Show all Cadence bot commands',
  },
];

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret');
  // Dedicated lock for this endpoint. Falls back to CRON_SECRET so older
  // setups keep working. Fail-closed: rejects when neither is configured.
  const expected = process.env.REGISTER_SECRET || process.env.CRON_SECRET;
  if (!expected || secret !== expected) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const appId = process.env.DISCORD_APP_ID;
  const token = process.env.DISCORD_BOT_TOKEN;

  // Derive the guild (server) from the alerts webhook so we can register
  // GUILD commands — these propagate INSTANTLY. Global commands can take up
  // to an hour to update, which is why a re-register can look like it did
  // nothing. No extra env var needed.
  let guildId: string | null = null;
  const webhookUrl = process.env.DISCORD_ALERTS_WEBHOOK_URL;
  if (webhookUrl) {
    try {
      const m = webhookUrl.match(/webhooks\/(\d+)\/([\w-]+)/);
      if (m) {
        const whRes = await fetch(`https://discord.com/api/v10/webhooks/${m[1]}/${m[2]}`);
        if (whRes.ok) {
          const wh = await whRes.json();
          guildId = wh.guild_id ?? null;
        }
      }
    } catch { /* fall back to global */ }
  }

  const endpoint = guildId
    ? `https://discord.com/api/v10/applications/${appId}/guilds/${guildId}/commands`
    : `https://discord.com/api/v10/applications/${appId}/commands`;

  const res = await fetch(endpoint, {
    method:  'PUT',
    headers: { Authorization: `Bot ${token}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify(COMMANDS),
  });

  const data = await res.json();

  // When registering to a guild, also wipe any leftover GLOBAL commands so
  // they don't show up as duplicates next to the guild ones (older sessions
  // registered globally).
  let clearedGlobal = false;
  if (guildId) {
    try {
      const clr = await fetch(`https://discord.com/api/v10/applications/${appId}/commands`, {
        method:  'PUT',
        headers: { Authorization: `Bot ${token}`, 'Content-Type': 'application/json' },
        body:    JSON.stringify([]),
      });
      clearedGlobal = clr.ok;
    } catch { /* ignore */ }
  }

  return NextResponse.json({
    ok:     res.ok,
    status: res.status,
    scope:  guildId ? 'guild (instant)' : 'global (up to 1h to propagate)',
    guildId,
    clearedGlobal,
    data,
  });
}
