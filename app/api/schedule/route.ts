import { NextResponse } from 'next/server';
import { gcalCreate, parseDate } from '@/lib/googleCalendar';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const TZ = 'America/Los_Angeles';
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';

// One tool per voice action. Claude is forced to call exactly one (tool_choice
// "any"); the chosen tool name is the intent, and its input is the fields.
const TOOLS = [
  {
    name: 'create_event',
    description: 'Add an event to the calendar.',
    strict: true,
    input_schema: {
      type: 'object',
      properties: {
        title:     { type: 'string' },
        date:      { type: 'string', description: 'YYYY-MM-DD' },
        startTime: { type: 'string', description: 'HH:MM (24-hour)' },
        endTime:   { type: 'string', description: 'HH:MM (24-hour). If unstated, 1 hour after start.' },
        location:  { type: ['string', 'null'], description: 'A venue/place ONLY if the user explicitly names one; otherwise null. Never invent a placeholder like "unknown" or "TBD".' },
      },
      required: ['title', 'date', 'startTime', 'endTime', 'location'],
      additionalProperties: false,
    },
  },
  {
    name: 'add_todo',
    description: 'Add a to-do / task.',
    strict: true,
    input_schema: {
      type: 'object',
      properties: {
        text:     { type: 'string' },
        priority: { type: 'string', enum: ['high', 'low'], description: 'Default low unless urgency is stated.' },
        category: { type: ['string', 'null'], description: 'Category name if the user names one (e.g. "work"), else null → Personal.' },
        due:      { type: ['string', 'null'], description: 'Due date YYYY-MM-DD, or null.' },
      },
      required: ['text', 'priority', 'category', 'due'],
      additionalProperties: false,
    },
  },
  {
    name: 'log_weight',
    description: 'Log a body-weight measurement in pounds.',
    strict: true,
    input_schema: {
      type: 'object',
      properties: { lbs: { type: 'number' } },
      required: ['lbs'],
      additionalProperties: false,
    },
  },
  {
    name: 'log_habit',
    description: "Mark a habit done for today (e.g. 'meditation', 'workout').",
    strict: true,
    input_schema: {
      type: 'object',
      properties: {
        name:   { type: 'string', description: 'Habit name (fuzzy-matched).' },
        period: { type: ['string', 'null'], description: 'Exactly "AM" if morning, "PM" if evening, otherwise null.' },
      },
      required: ['name', 'period'],
      additionalProperties: false,
    },
  },
  {
    name: 'add_note',
    description: 'Send a note to the dashboard.',
    strict: true,
    input_schema: {
      type: 'object',
      properties: { text: { type: 'string' } },
      required: ['text'],
      additionalProperties: false,
    },
  },
] as const;

function today(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: TZ }); // YYYY-MM-DD
}

// The model is forced to fill required fields, so an unspoken location can come
// back as a placeholder string ("<UNKNOWN>", "TBD", …). Never write those to the
// calendar — treat them as "no location".
const LOCATION_JUNK = new Set(['<unknown>', 'unknown', 'n/a', 'na', 'none', 'tbd', 'null', 'unspecified', '-', '—']);
function cleanLocation(loc: unknown): string | undefined {
  if (typeof loc !== 'string') return undefined;
  const t = loc.trim();
  if (!t || LOCATION_JUNK.has(t.toLowerCase())) return undefined;
  return t;
}

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

/** Add N days to a YYYY-MM-DD string (UTC-anchored to avoid tz/DST drift). */
function ymdPlus(ymd: string, days: number): string {
  const d = new Date(`${ymd}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Resolve a spoken date phrase to YYYY-MM-DD deterministically — the model is
 * unreliable at weekday→date math. Returns null if the text has no weekday /
 * today / tomorrow cue (e.g. an explicit "June 30"), leaving the model's date.
 */
function resolveDate(text: string, todayLA: string): string | null {
  const t = text.toLowerCase();
  const todayDow = new Date(`${todayLA}T12:00:00Z`).getUTCDay();
  for (let i = 0; i < 7; i++) {
    if (t.includes(WEEKDAYS[i])) {
      let offset = (i - todayDow + 7) % 7;                 // soonest matching weekday (today if same)
      if (new RegExp(`next\\s+${WEEKDAYS[i]}`).test(t)) offset = offset === 0 ? 7 : offset + 7;
      return ymdPlus(todayLA, offset);
    }
  }
  if (/\btoday\b|\btonight\b/.test(t)) return todayLA;
  if (/\btomorrow\b/.test(t))          return ymdPlus(todayLA, 1);
  return null;
}

/** Ask Claude which action the transcript maps to and extract its fields. */
async function classify(text: string): Promise<{ name: string; input: any }> {
  const todayLA = today();
  const weekday = new Date(`${todayLA}T12:00:00`).toLocaleDateString('en-US', { weekday: 'long' });

  // Explicit weekday→date table for the next 14 days so Claude never has to do
  // calendar arithmetic (which mis-resolved "Tuesday" to the wrong week).
  const base = new Date(`${todayLA}T12:00:00`);
  const dateRef = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(base);
    d.setDate(d.getDate() + i);
    return `${d.toLocaleDateString('en-US', { weekday: 'long' })} ${d.toLocaleDateString('en-CA')}`;
  }).join(', ');

  const res = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'x-api-key':         process.env.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
      'content-type':      'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5',
      max_tokens: 400,
      system:
        `Turn a short spoken request into exactly one action by calling the matching tool. ` +
        `Today is ${weekday}, ${todayLA} in ${TZ}. ` +
        `Date reference for the next 14 days: ${dateRef}. ` +
        `Resolve "today"/"tonight" to ${todayLA}, "tomorrow" to the next day, and any weekday name ` +
        `to the SOONEST matching date in that reference (this week if it hasn't passed — never skip a week). ` +
        `If the request says both "today" and a weekday, trust the weekday. ` +
        `Use 24-hour HH:MM and YYYY-MM-DD. Pick create_event for anything with a time/appointment, ` +
        `add_todo for tasks to do, log_weight for a weight number, log_habit for "mark X done", ` +
        `add_note otherwise.`,
      tools: TOOLS,
      tool_choice: { type: 'any' },
      messages: [{ role: 'user', content: text }],
    }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(`Claude error: ${data?.error?.message ?? res.status}`);
  const block = (data.content ?? []).find((b: { type: string }) => b.type === 'tool_use');
  if (!block) throw new Error('Could not understand the request');
  return { name: block.name, input: block.input };
}

// ── Per-action handlers (mirror the Discord slash commands) ───────────────────

async function doEvent(i: any) {
  const r = await gcalCreate({
    name: i.title, date: i.date, startTime: i.startTime, endTime: i.endTime,
    location: cleanLocation(i.location),
  });
  if (!r.ok) throw new Error(r.error);
  return r.display;
}

async function doTodo(i: any) {
  const priority = i.priority ?? 'low';
  // Match the spoken category to an existing one (case-insensitive); else Personal.
  let category = 'Personal';
  if (typeof i.category === 'string' && i.category.trim()) {
    const { data: cats } = await supabase.from('todo_categories').select('name');
    const match = (cats ?? []).find((c: { name: string }) => c.name.toLowerCase() === i.category.trim().toLowerCase());
    category = match?.name ?? 'Personal';
  }
  // `due` is a required field, so an unspoken date can arrive as junk — parse
  // defensively so a placeholder becomes "no due date" instead of a 500.
  let due_date: string | null = null;
  if (typeof i.due === 'string' && i.due.trim()) {
    try { due_date = parseDate(i.due); } catch { due_date = null; }
  }

  const { data: top } = await supabase
    .from('todos').select('order')
    .eq('priority', priority).eq('category', category)
    .order('order', { ascending: false }).limit(1);
  const order = (top?.[0]?.order ?? -1) + 1;

  await supabase.from('todos').insert({ text: i.text, priority, category, completed: false, order, due_date });

  const cat = category.charAt(0).toUpperCase() + category.slice(1);
  const dueLabel = due_date ? ` · 📅 due ${due_date}` : '';
  return `📋 Added to **${cat}** → ${priority}: "${i.text}"${dueLabel}`;
}

async function doWeight(i: any) {
  const lbs = i.lbs;
  if (!lbs || lbs <= 0) throw new Error('Invalid weight');
  await supabase.from('weight_logs').insert({ weight_lbs: lbs });

  const { data: goal } = await supabase
    .from('big_goals').select('id, milestone, count_target')
    .eq('progress_type', 'weight').maybeSingle();

  let goalLine = '';
  if (goal) {
    const start  = parseFloat(goal.milestone ?? '0');
    const target = goal.count_target ?? 0;
    const progress = start > target && start > 0
      ? Math.min(100, Math.max(0, Math.round(((start - lbs) / (start - target)) * 100)))
      : 0;
    await supabase.from('big_goals').update({ count_current: lbs, progress }).eq('id', goal.id);
    if (start > target) {
      const remaining = lbs - target;
      goalLine = remaining > 0 ? `\n📉 ${remaining.toFixed(1)} lbs to go` : '\n🎉 Goal reached!';
    }
  }
  return `⚖️ Logged **${lbs} lbs**${goalLine}`;
}

async function doHabit(i: any) {
  let q = supabase.from('habits').select('id, name, period').ilike('name', `%${i.name}%`).is('deleted_at', null);
  if (i.period) q = q.eq('period', i.period);
  const { data: habits } = await q;

  if (!habits?.length) throw new Error(`No habit matching "${i.name}"`);
  if (habits.length > 1 && !i.period) {
    throw new Error(`Multiple habits match "${i.name}": ${habits.map((h: any) => `${h.name} (${h.period})`).join(', ')}`);
  }
  const habit = habits[0];

  const { data: existing } = await supabase
    .from('habit_logs').select('id').eq('habit_id', habit.id).eq('date', today()).maybeSingle();
  if (existing) return `ℹ️ **${habit.name}** (${habit.period}) already logged today`;

  await supabase.from('habit_logs').insert({ habit_id: habit.id, date: today(), type: 'done' });
  return `✅ Logged **${habit.name}** (${habit.period}) for today`;
}

async function doNote(i: any) {
  await supabase.from('notifications').insert({ message: i.text, type: 'note' });
  return `📌 Note sent to dashboard: "${i.text}"`;
}

const HANDLERS: Record<string, (i: any) => Promise<string>> = {
  create_event: doEvent,
  add_todo:     doTodo,
  log_weight:   doWeight,
  log_habit:    doHabit,
  add_note:     doNote,
};

export async function POST(request: Request) {
  if (request.headers.get('x-schedule-secret') !== process.env.SCHEDULE_SECRET) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  let text: string | undefined;
  try {
    ({ text } = await request.json());
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 });
  }
  if (!text || !text.trim()) {
    return NextResponse.json({ ok: false, error: 'Missing "text"' }, { status: 400 });
  }

  try {
    const { name, input } = await classify(text);

    // Override the model's date with a deterministic resolution when the
    // transcript names a weekday / today / tomorrow (model mis-resolves these).
    if (name === 'create_event') {
      const resolved = resolveDate(text, today());
      if (resolved) input.date = resolved;
    }

    const handler = HANDLERS[name];
    if (!handler) throw new Error(`Unknown action: ${name}`);
    const display = await handler(input);
    return NextResponse.json({ ok: true, action: name, display });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
