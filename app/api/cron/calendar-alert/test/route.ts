/**
 * Dry-run test — shows what the calendar-alert cron would send right now
 * WITHOUT actually posting to Discord.
 *
 * Open in browser: GET /api/cron/calendar-alert/test
 *
 * Returns:
 *   todayEvents   — all events found for today (confirms iCal + RRULE parsing works)
 *   alertsNow     — reminders that would fire at this exact moment
 *   upcomingAlerts — next reminder for each upcoming event (next 90 min)
 */

import { NextResponse } from 'next/server';
import { parseIcal } from '@/lib/parseIcal';
import { runCalendarAlerts, todayOccurrence, REMINDER_WINDOWS } from '@/lib/calendarAlerts';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Dry-run: what would fire right now
    const { alerts, checkedAt, todayEvents } = await runCalendarAlerts(false);

    // Preview: upcoming reminders in the next 90 minutes
    const icalUrl = process.env.GOOGLE_CALENDAR_ICAL_URL ?? '';
    const upcomingAlerts: { summary: string; inMins: number; time: string; reminder: string }[] = [];

    if (icalUrl) {
      const res   = await fetch(icalUrl, { cache: 'no-store' });
      const text  = await res.text();
      const evs   = parseIcal(text);
      const now   = new Date();
      const today = now.toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });

      for (const ev of evs) {
        if (/^\d{8}$/.test(ev.dtstart)) continue;

        let start: Date | null = null;
        if (ev.hasRrule) {
          start = todayOccurrence(ev, now);
        } else {
          if (!ev.startDate) continue;
          const d = ev.startDate.toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
          if (d === today) start = ev.startDate;
        }
        if (!start) continue;

        const diffMins = (start.getTime() - now.getTime()) / 60_000;

        // Find which reminder window this falls closest to in the next 90 min
        for (const w of REMINDER_WINDOWS) {
          const windowCenter = (w.minLow + w.minHigh) / 2;
          const minsUntilWindow = diffMins - windowCenter;
          if (minsUntilWindow >= -2 && minsUntilWindow <= 90) {
            upcomingAlerts.push({
              summary: ev.summary,
              inMins: Math.round(diffMins),
              time: start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'America/Los_Angeles' }),
              reminder: `${w.emoji} ${w.label} alert fires in ~${Math.round(minsUntilWindow)} min`,
            });
            break;
          }
        }
      }
      upcomingAlerts.sort((a, b) => a.inMins - b.inMins);
    }

    return NextResponse.json({
      checkedAt,
      todayEventCount: todayEvents.length,
      todayEvents,
      alertsNow: alerts,
      upcomingAlerts,
      note: '⚠️ Dry run — no Discord messages sent.',
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
