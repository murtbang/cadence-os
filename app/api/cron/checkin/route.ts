import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { sendWebhook } from '@/lib/discord';
import { parseIcal } from '@/lib/parseIcal';
import { verifyCron } from '@/lib/cron';
import { formatDueSoon } from '@/lib/todoReminders';

export const dynamic = 'force-dynamic';

const TZ = 'America/Los_Angeles';

function fmt12h(date: Date): string {
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: TZ });
}

export async function GET(req: NextRequest) {
  if (!verifyCron(req)) return new NextResponse('Unauthorized', { status: 401 });

  const now   = new Date();
  const hour  = parseInt(now.toLocaleString('en-US', { hour: 'numeric', hour12: false, timeZone: TZ }), 10);
  const today = now.toLocaleDateString('en-CA', { timeZone: TZ });
  const isMidday = hour < 15; // noon fire vs evening fire

  // Guard: midday checkin valid 11 AM–2 PM, evening checkin valid 5 PM–10 PM
  const inMiddayWindow  = hour >= 11 && hour < 14;
  const inEveningWindow = hour >= 17 && hour < 22;
  if (!inMiddayWindow && !inEveningWindow) {
    return NextResponse.json({ ok: true, skipped: true, reason: 'outside send window', hour });
  }

  // ── Shared data ──────────────────────────────────────────────────────────────
  const [{ data: habits }, { data: logs }, { data: weightRow }, { data: todos }] = await Promise.all([
    supabase.from('habits').select('*').is('deleted_at', null).order('order'),
    supabase.from('habit_logs').select('*').eq('date', today),
    supabase.from('weight_logs').select('weight_lbs, logged_at').order('logged_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('todos').select('*').eq('completed', false).order('order'),
  ]);

  const loggedIds = new Set((logs ?? []).map((l: { habit_id: string }) => l.habit_id));
  const amHabits  = (habits ?? []).filter((h: { period: string }) => h.period === 'AM');
  const pmHabits  = (habits ?? []).filter((h: { period: string }) => h.period === 'PM');
  const amDone    = amHabits.filter((h: { id: string }) => loggedIds.has(h.id)).length;
  const pmDone    = pmHabits.filter((h: { id: string }) => loggedIds.has(h.id)).length;

  const weightLoggedToday = weightRow
    ? new Date(weightRow.logged_at).toLocaleDateString('en-CA', { timeZone: TZ }) === today
    : false;
  const weightLine = weightRow
    ? `⚖️ Weight: ${weightRow.weight_lbs} lbs${weightLoggedToday ? ' ✓' : ' _(not logged today)_'}`
    : '⚖️ Weight: _no data yet_';

  const highTodos = (todos ?? []).filter((t: { priority: string }) => t.priority === 'high');
  const lowTodos  = (todos ?? []).filter((t: { priority: string }) => t.priority === 'low');
  const dueSoon   = formatDueSoon(todos ?? [], today);

  // ── Calendar ─────────────────────────────────────────────────────────────────
  let todayEvents: { time: string; summary: string }[] = [];
  const icalUrl = process.env.GOOGLE_CALENDAR_ICAL_URL;
  if (icalUrl) {
    try {
      const res = await fetch(icalUrl, { cache: 'no-store' });
      if (res.ok) {
        const events = parseIcal(await res.text()).filter(e =>
          e.startDate?.toLocaleDateString('en-CA', { timeZone: TZ }) === today
        );
        todayEvents = events.map(e => ({
          time:    e.startDate ? fmt12h(e.startDate) : '',
          summary: e.summary ?? '',
        }));
      }
    } catch { /* skip */ }
  }

  // ── Midday message ───────────────────────────────────────────────────────────
  if (isMidday) {
    const amStatus = amDone === amHabits.length
      ? `AM: ${amDone}/${amHabits.length} ✓`
      : `AM: ${amDone}/${amHabits.length} — ${amHabits.length - amDone} remaining`;

    const upcomingEvents = todayEvents.filter(e => {
      // rough check — events after noon
      const isAM = e.time.includes('AM') && !e.time.startsWith('12');
      return !isAM;
    });
    const eventsLine = upcomingEvents.length
      ? upcomingEvents.map(e => `• ${e.time} — ${e.summary}`).join('\n')
      : '_No afternoon events_';

    const todoLine = highTodos.length
      ? `🔴 ${highTodos.length} high-priority task${highTodos.length > 1 ? 's' : ''} remaining`
      : lowTodos.length
      ? `✅ All high-priority done — ${lowTodos.length} low remaining`
      : '✅ No pending todos';

    const msg = [
      `🌤️ **Midday check-in — ${today}**`,
      '',
      `🔁 **Habits**`,
      amStatus,
      '',
      weightLine,
      '',
      `📅 **This afternoon**`,
      eventsLine,
      '',
      todoLine,
      ...(dueSoon ? ['', dueSoon] : []),
    ].join('\n');

    try { await sendWebhook(msg); } catch (err) { console.error('checkin midday webhook error:', err); }
    return NextResponse.json({ ok: true, period: 'midday' });
  }

  // ── Evening message ──────────────────────────────────────────────────────────
  const amStatus = `AM: ${amDone}/${amHabits.length}${amDone === amHabits.length ? ' ✓' : ''}`;
  const pmStatus = `PM: ${pmDone}/${pmHabits.length}${pmDone === pmHabits.length ? ' ✓' : ''}`;

  const allEventsLine = todayEvents.length
    ? todayEvents.map(e => `• ${e.time} — ${e.summary}`).join('\n')
    : '_No events today_';

  const pendingCount = (todos ?? []).length;
  const todoLine = pendingCount === 0
    ? '✅ All tasks cleared'
    : `📋 ${highTodos.length} high, ${lowTodos.length} low still pending`;

  const msg = [
    `🌙 **Evening wrap — ${today}**`,
    '',
    `🔁 **Habits**`,
    `${amStatus} | ${pmStatus}`,
    '',
    weightLine,
    '',
    `📅 **Today's events**`,
    allEventsLine,
    '',
    todoLine,
    ...(dueSoon ? ['', dueSoon] : []),
  ].join('\n');

  try { await sendWebhook(msg); } catch (err) { console.error('checkin evening webhook error:', err); }
  return NextResponse.json({ ok: true, period: 'evening' });
}
