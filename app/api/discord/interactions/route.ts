import { NextRequest, NextResponse } from 'next/server';
import { verifyDiscordSignature } from '@/lib/discord';
import { supabase } from '@/lib/supabase';
import {
  gcalCreate, gcalSearch, gcalPatch, gcalDelete,
  parseDate, parseTime, fmtEvent,
} from '@/lib/googleCalendar';

export const dynamic = 'force-dynamic';

const HABIT_OVERVIEW_TAG = '🔁 **Habits — today**';

// Full habit status list for today PLUS tap-to-log buttons for pending habits.
// Shared by the /habit (no-arg) command and the habit_done button handler so
// the message updates live as buttons are tapped.
async function buildHabitOverview(): Promise<{ content: string; components: unknown[] }> {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
  const [{ data: habits }, { data: logs }] = await Promise.all([
    supabase.from('habits').select('id, name, period').is('deleted_at', null).order('order'),
    supabase.from('habit_logs').select('habit_id, type').eq('date', today),
  ]);

  type H = { id: string; name: string; period: string };
  type L = { habit_id: string; type: string };
  const doneIds = new Set(((logs ?? []) as L[]).filter(l => l.type !== 'skip').map(l => l.habit_id));
  const allH    = (habits ?? []) as H[];

  const lines = (items: H[]) =>
    items.length ? items.map(h => `${doneIds.has(h.id) ? '✅' : '⬜'} ${h.name}`).join('\n') : '_none_';

  const am = allH.filter(h => h.period === 'AM');
  const pm = allH.filter(h => h.period === 'PM');

  const content = [
    HABIT_OVERVIEW_TAG,
    ``,
    `☀️ **AM** (${am.filter(h => doneIds.has(h.id)).length}/${am.length})`,
    lines(am),
    ``,
    `🌙 **PM** (${pm.filter(h => doneIds.has(h.id)).length}/${pm.length})`,
    lines(pm),
  ].join('\n');

  // One tap-to-log button per pending habit (max 5 per row, 5 rows = 25 cap).
  // AM first so the colours read as blocks: AM = green (3), PM = red (4).
  const pending = allH
    .filter(h => !doneIds.has(h.id))
    .sort((a, b) => (a.period === b.period ? 0 : a.period === 'AM' ? -1 : 1));
  const buttons = pending.map(h => ({
    type: 2,
    style: h.period === 'AM' ? 3 : 4,
    label: `✓ ${h.name}`.slice(0, 80),
    custom_id: `habit_done:${h.id}`,
  }));
  const components: { type: number; components: unknown[] }[] = [];
  for (let i = 0; i < buttons.length && components.length < 5; i += 5) {
    components.push({ type: 1, components: buttons.slice(i, i + 5) });
  }

  return { content, components };
}

export async function POST(req: NextRequest) {
  const signature = req.headers.get('x-signature-ed25519') ?? '';
  const timestamp  = req.headers.get('x-signature-timestamp') ?? '';
  const body       = await req.text();

  const valid = verifyDiscordSignature(
    process.env.DISCORD_PUBLIC_KEY!,
    signature,
    timestamp,
    body,
  );
  if (!valid) return new NextResponse('Invalid signature', { status: 401 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const interaction: any = JSON.parse(body);

  // Discord PING
  if (interaction.type === 1) return NextResponse.json({ type: 1 });

  // ── Button / component interaction ────────────────────────────────────────
  if (interaction.type === 3) {
    const customId: string = interaction.data.custom_id ?? '';

    // ── Habit done button ───────────────────────────────────────────────────
    if (customId.startsWith('habit_done:')) {
      const habitId = customId.slice('habit_done:'.length);
      const today   = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });

      const [{ data: habit }, { data: existing }] = await Promise.all([
        supabase.from('habits').select('name').eq('id', habitId).single(),
        supabase.from('habit_logs').select('id').eq('habit_id', habitId).eq('date', today).maybeSingle(),
      ]);

      const habitName = habit?.name ?? 'Habit';

      if (existing) {
        // Already logged — ephemeral reply, don't touch the message
        return NextResponse.json({ type: 4, data: { content: `ℹ️ **${habitName}** already logged today`, flags: 64 } });
      }

      await supabase.from('habit_logs').insert({ habit_id: habitId, date: today, type: 'done' });

      // If this came from the /habit overview, rebuild it fresh so the status
      // list, counts AND buttons all update live.
      const msgContent: string = interaction.message?.content ?? '';
      if (msgContent.startsWith(HABIT_OVERVIEW_TAG)) {
        const overview = await buildHabitOverview();
        return NextResponse.json({ type: 7, data: overview });
      }

      // Otherwise it's a reminder: remove the tapped button, keep the rest
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const oldRows: any[] = interaction.message?.components ?? [];
      const newRows = oldRows
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((row: any) => ({ ...row, components: row.components.filter((b: any) => b.custom_id !== customId) }))
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .filter((row: any) => row.components.length > 0);

      const pendingLeft = newRows.reduce((acc: number, r: any) => acc + r.components.length, 0);
      const oldContent: string = interaction.message?.content ?? '';
      const newContent = pendingLeft === 0
        ? oldContent.replace(/\d+ still pending/, '✅ All done!').replace(/\d+ still pending:/, '✅ All done!')
        : oldContent.replace(/\d+ still pending/, `${pendingLeft} still pending`);

      return NextResponse.json({ type: 7, data: { content: newContent, components: newRows } });
    }

    if (customId.startsWith('cal_delete_confirm:')) {
      const eventId = customId.slice('cal_delete_confirm:'.length);
      const result  = await gcalDelete(eventId);
      if (!result.ok) {
        return NextResponse.json({ type: 7, data: { content: `❌ Delete failed: ${result.error}`, components: [] } });
      }
      return NextResponse.json({ type: 7, data: { content: '🗑️ Event deleted.', components: [] } });
    }

    if (customId === 'cal_delete_cancel') {
      return NextResponse.json({ type: 7, data: { content: '↩️ Cancelled — event not deleted.', components: [] } });
    }

    return NextResponse.json({ type: 1 });
  }

  // ── Slash command ──────────────────────────────────────────────────────────
  if (interaction.type === 2) {
    const { name, options = [] } = interaction.data;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const opt = (key: string) => options.find((o: any) => o.name === key)?.value;

    if (name === 'help') {
      return NextResponse.json({
        type: 4,
        data: {
          embeds: [{
            title: '🤖 Cadence Bot — Commands',
            color: 0x5b8def,
            fields: [
              { name: '🔁  /habit  [name] [period]',                value: 'Mark a habit done for today. Leave **name** blank to see every habit and its status.' },
              { name: '📋  /todo  [text] [priority] [category]',     value: 'Add a task. Leave **text** blank to list all open todos in two columns.' },
              { name: '⚖️  /weight  <lbs>',                          value: 'Log your weight and update your weight goal.' },
              { name: '📌  /note  <text>',                           value: 'Send a note to the dashboard notifications view.' },
              { name: '📅  /calendar  create · modify · delete',     value: 'Create, modify, or delete a Google Calendar event.' },
              { name: '❓  /help',                                   value: 'Show this list.' },
            ],
            footer: { text: '[ ] = optional   ·   < > = required' },
          }],
        },
      });
    }

    if (name === 'calendar') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sub    = options[0] as any;                            // subcommand object
      const subOpt = (key: string) => sub?.options?.find((o: any) => o.name === key)?.value as string | undefined;

      // ── CREATE ─────────────────────────────────────────────────────────────
      if (sub?.name === 'create') {
        try {
          const date      = parseDate(subOpt('date')       ?? '');
          const startTime = parseTime(subOpt('start_time') ?? '');
          const endTime   = parseTime(subOpt('end_time')   ?? '');
          const result    = await gcalCreate({
            name:        subOpt('name') ?? 'New Event',
            date, startTime, endTime,
            description: subOpt('description'),
            location:    subOpt('location'),
          });
          if (!result.ok) return NextResponse.json({ type: 4, data: { content: `❌ ${result.error}` } });
          return NextResponse.json({ type: 4, data: { content: `✅ Created: ${result.display}` } });
        } catch (e: any) {
          return NextResponse.json({ type: 4, data: { content: `❌ ${e.message}` } });
        }
      }

      // ── MODIFY ─────────────────────────────────────────────────────────────
      if (sub?.name === 'modify') {
        const query = subOpt('search') ?? '';
        let events;
        try { events = await gcalSearch(query); } catch (e: any) {
          return NextResponse.json({ type: 4, data: { content: `❌ Search failed: ${e.message}` } });
        }
        if (!events.length) {
          return NextResponse.json({ type: 4, data: { content: `❌ No upcoming event found matching "${query}"` } });
        }
        const ev = events[0];
        try {
          const rawDate  = subOpt('date');
          const rawStart = subOpt('start_time');
          const rawEnd   = subOpt('end_time');
          const result   = await gcalPatch(ev.id, {
            name:          subOpt('name'),
            date:          rawDate  ? parseDate(rawDate)   : undefined,
            startTime:     rawStart ? parseTime(rawStart)  : undefined,
            endTime:       rawEnd   ? parseTime(rawEnd)    : undefined,
            description:   subOpt('description'),
            location:      subOpt('location'),
            existingEvent: ev,
          });
          if (!result.ok) return NextResponse.json({ type: 4, data: { content: `❌ ${result.error}` } });
          return NextResponse.json({ type: 4, data: { content: `✏️ Updated: ${result.display}` } });
        } catch (e: any) {
          return NextResponse.json({ type: 4, data: { content: `❌ ${e.message}` } });
        }
      }

      // ── DELETE ─────────────────────────────────────────────────────────────
      if (sub?.name === 'delete') {
        const query = subOpt('search') ?? '';
        let events;
        try { events = await gcalSearch(query); } catch (e: any) {
          return NextResponse.json({ type: 4, data: { content: `❌ Search failed: ${e.message}` } });
        }
        if (!events.length) {
          return NextResponse.json({ type: 4, data: { content: `❌ No upcoming event found matching "${query}"` } });
        }
        const ev = events[0];
        return NextResponse.json({
          type: 4,
          data: {
            content: `⚠️ Delete ${fmtEvent(ev)}?`,
            components: [{
              type: 1,
              components: [
                { type: 2, style: 4, label: 'Delete', custom_id: `cal_delete_confirm:${ev.id}` },
                { type: 2, style: 2, label: 'Cancel', custom_id: 'cal_delete_cancel' },
              ],
            }],
          },
        });
      }

      return NextResponse.json({ type: 4, data: { content: '❓ Unknown calendar subcommand.' } });
    }

    if (name === 'todo') {
      const text = opt('text') as string | undefined;

      // ── No text → list all open todos in two columns ───────────────────────
      if (!text) {
        const { data: todos } = await supabase
          .from('todos')
          .select('text, priority, category, due_date')
          .eq('completed', false)
          .order('order', { ascending: true });

        type Row = { text: string; priority: string; category: string; due_date: string | null };
        const all = (todos ?? []) as Row[];

        const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
        const todayMs  = new Date(todayStr + 'T12:00:00').getTime();
        const dueBadge = (d: string | null): string => {
          if (!d) return '';
          const days = Math.round((new Date(d + 'T12:00:00').getTime() - todayMs) / 86_400_000);
          if (days < 0)   return ' ⚠️ overdue';
          if (days === 0) return ' 🔴 today';
          if (days === 1) return ' 🟡 tomorrow';
          if (days <= 6)  return ` 📅 ${days}d`;
          return ` 📅 ${d.slice(5)}`;   // MM-DD
        };

        const fieldFor = (cat: string) => {
          const items = all.filter(t => t.category === cat);
          const high  = items.filter(t => t.priority === 'high');
          const low   = items.filter(t => t.priority === 'low');
          const block = (arr: Row[]) => arr.map(t => `• ${t.text}${dueBadge(t.due_date)}`).join('\n');
          let v = '';
          if (high.length) v += `🔴 **High**\n${block(high)}\n`;
          if (low.length)  v += `${high.length ? '\n' : ''}⚪ **Low**\n${block(low)}`;
          if (!v) v = '_nothing open_';
          if (v.length > 1024) v = v.slice(0, 1008) + '\n…more';
          return v;
        };

        return NextResponse.json({
          type: 4,
          data: {
            embeds: [{
              title: `📋 Open todos — ${all.length}`,
              color: 0x5b8def,
              fields: [
                { name: 'Personal', value: fieldFor('personal'), inline: true },
                { name: 'Aevro',    value: fieldFor('aevro'),    inline: true },
              ],
            }],
          },
        });
      }

      const priority = (opt('priority') as string) ?? 'low';
      const category = (opt('category') as string) ?? 'personal';
      const dueRaw   = opt('due') as string | undefined;

      let due_date: string | null = null;
      if (dueRaw) {
        try {
          due_date = parseDate(dueRaw);
        } catch (e: any) {
          return NextResponse.json({ type: 4, data: { content: `❌ ${e.message}` } });
        }
      }

      const { data: top } = await supabase
        .from('todos')
        .select('order')
        .eq('priority', priority)
        .eq('category', category)
        .order('order', { ascending: false })
        .limit(1);
      const order = (top?.[0]?.order ?? -1) + 1;

      await supabase.from('todos').insert({ text, priority, category, completed: false, order, due_date });

      const categoryLabel = category.charAt(0).toUpperCase() + category.slice(1);
      const dueLabel = due_date ? ` · 📅 due ${due_date}` : '';
      return NextResponse.json({
        type: 4,
        data: { content: `✅ Added to **${categoryLabel}** → ${priority} priority: "${text}"${dueLabel}` },
      });
    }

    if (name === 'habit') {
      const habitName = opt('name') as string | undefined;
      const period    = opt('period') as string | undefined;  // 'AM' | 'PM' | undefined
      const today     = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });

      // ── No name → show all habits with tap-to-log buttons ──────────────────
      if (!habitName) {
        const overview = await buildHabitOverview();
        return NextResponse.json({ type: 4, data: overview });
      }

      let query = supabase
        .from('habits')
        .select('id, name, period')
        .ilike('name', `%${habitName}%`)
        .is('deleted_at', null);

      if (period) query = query.eq('period', period);

      const { data: habits } = await query;

      if (!habits?.length) {
        const periodHint = period ? ` (${period})` : '';
        return NextResponse.json({ type: 4, data: { content: `❌ No habit found matching "${habitName}"${periodHint}` } });
      }

      // If multiple matches and no period specified, ask them to clarify
      if (habits.length > 1 && !period) {
        const list = habits.map(h => `• **${h.name}** (${h.period})`).join('\n');
        return NextResponse.json({
          type: 4,
          data: { content: `⚠️ Multiple habits match "${habitName}":\n${list}\n\nRe-run with \`period:AM\` or \`period:PM\` to pick one.` },
        });
      }

      const habit = habits[0];
      const { data: existing } = await supabase
        .from('habit_logs')
        .select('id, type')
        .eq('habit_id', habit.id)
        .eq('date', today)
        .maybeSingle();

      if (existing) {
        const alreadyType = existing.type === 'skip' ? 'marked as skip' : 'already logged';
        return NextResponse.json({ type: 4, data: { content: `ℹ️ **${habit.name}** (${habit.period}) ${alreadyType} today` } });
      }

      await supabase.from('habit_logs').insert({ habit_id: habit.id, date: today, type: 'done' });

      return NextResponse.json({
        type: 4,
        data: { content: `✅ Logged **${habit.name}** (${habit.period}) for today` },
      });
    }

    if (name === 'note') {
      const text = opt('text') as string;
      await supabase.from('notifications').insert({ message: text, type: 'note' });

      return NextResponse.json({
        type: 4,
        data: { content: `📌 Note sent to dashboard: "${text}"` },
      });
    }

    if (name === 'weight') {
      const lbs = opt('lbs') as number;
      if (!lbs || lbs <= 0) {
        return NextResponse.json({ type: 4, data: { content: '❌ Invalid weight value.' } });
      }

      const { error: insertError } = await supabase
        .from('weight_logs')
        .insert({ weight_lbs: lbs });
      if (insertError) {
        return NextResponse.json({ type: 4, data: { content: `❌ Failed to log weight: ${insertError.message}` } });
      }

      // Update weight-type big goal if one exists
      const { data: goal } = await supabase
        .from('big_goals')
        .select('id, milestone, count_target')
        .eq('progress_type', 'weight')
        .maybeSingle();

      if (goal) {
        const start    = parseFloat(goal.milestone ?? '0');
        const target   = goal.count_target ?? 0;
        const progress = start > target && start > 0
          ? Math.min(100, Math.max(0, Math.round(((start - lbs) / (start - target)) * 100)))
          : 0;
        await supabase
          .from('big_goals')
          .update({ count_current: lbs, progress })
          .eq('id', goal.id);
      }

      const { logSilent } = await import('@/lib/silentLog');
      await logSilent(`⚖️ Weight logged: ${lbs} lbs`);

      const goalLine = goal
        ? (() => {
            const start  = parseFloat(goal.milestone ?? '0');
            const target = goal.count_target ?? 0;
            const remaining = lbs - target;
            return start > target ? `\n📉 ${remaining > 0 ? `${remaining.toFixed(1)} lbs to go` : '🎉 Goal reached!'}` : '';
          })()
        : '';

      return NextResponse.json({
        type: 4,
        data: { content: `⚖️ Logged **${lbs} lbs**${goalLine}` },
      });
    }
  }

  return NextResponse.json({ type: 1 });
}
