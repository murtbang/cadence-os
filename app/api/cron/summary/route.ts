import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { sendWebhook } from '@/lib/discord';
import { parseIcal } from '@/lib/parseIcal';
import { verifyCron } from '@/lib/cron';
import { formatDueSoon } from '@/lib/todoReminders';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  if (!verifyCron(req)) return new NextResponse('Unauthorized', { status: 401 });

  // Guard: only send between 6 AM and 10 AM LA time.
  const hour = parseInt(
    new Date().toLocaleString('en-US', { hour: 'numeric', hour12: false, timeZone: 'America/Los_Angeles' }),
    10,
  );
  if (hour < 6 || hour >= 10) {
    return NextResponse.json({ ok: true, skipped: true, reason: 'outside send window', hour });
  }

  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });

  const [{ data: habits }, { data: logs }, { data: todos }] = await Promise.all([
    supabase.from('habits').select('*').is('deleted_at', null).order('order'),
    supabase.from('habit_logs').select('*').eq('date', today),
    supabase.from('todos').select('text, due_date, completed').eq('completed', false),
  ]);

  const loggedIds = new Set((logs ?? []).map((l: { habit_id: string }) => l.habit_id));
  const amHabits  = (habits ?? []).filter((h: { period: string }) => h.period === 'AM');
  const pmHabits  = (habits ?? []).filter((h: { period: string }) => h.period === 'PM');
  const amDone    = amHabits.filter((h: { id: string }) => loggedIds.has(h.id)).length;
  const pmDone    = pmHabits.filter((h: { id: string }) => loggedIds.has(h.id)).length;

  // Fetch calendar events
  let eventLines = '_No events today_';
  const icalUrl = process.env.GOOGLE_CALENDAR_ICAL_URL;
  if (icalUrl) {
    try {
      const res = await fetch(icalUrl, { cache: 'no-store' });
      if (res.ok) {
        const text   = await res.text();
        const events = parseIcal(text).filter(e =>
          e.startDate?.toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' }) === today
        );
        if (events.length) {
          eventLines = events.map(e => {
            const time = e.startDate
              ? e.startDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'America/Los_Angeles' })
              : '';
            return `• ${time} — ${e.summary}`;
          }).join('\n');
        }
      }
    } catch { /* skip */ }
  }

  const dueSoon = formatDueSoon(todos ?? [], today);

  const msg = [
    `☀️ **Good morning! Daily summary for ${today}**`,
    '',
    `📅 **Today's events**`,
    eventLines,
    '',
    `🔁 **Habits**`,
    `AM: ${amDone}/${amHabits.length} done`,
    `PM: ${pmDone}/${pmHabits.length} done`,
    ...(dueSoon ? ['', dueSoon] : []),
  ].join('\n');

  try {
    await sendWebhook(msg);
  } catch (err) {
    console.error('summary webhook error:', err);
  }
  return NextResponse.json({ ok: true });
}
