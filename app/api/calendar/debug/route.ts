import { NextResponse } from 'next/server';
import { parseIcal } from '@/lib/parseIcal';

export const dynamic = 'force-dynamic';

export async function GET() {
  const icalUrl = process.env.GOOGLE_CALENDAR_ICAL_URL;
  if (!icalUrl) return NextResponse.json({ error: 'GOOGLE_CALENDAR_ICAL_URL not set' });

  try {
    const res = await fetch(icalUrl, { cache: 'no-store' });
    if (!res.ok) return NextResponse.json({ error: `Fetch failed: ${res.status} ${res.statusText}` });

    const text = await res.text();
    const events = parseIcal(text);

    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });

    const mapped = events.map(ev => ({
      uid:       ev.uid,
      summary:   ev.summary,
      dtstart:   ev.dtstart,
      startDate: ev.startDate?.toISOString() ?? null,
      startDateLA: ev.startDate
        ? ev.startDate.toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' })
        : null,
      isToday: ev.startDate
        ? ev.startDate.toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' }) === today
        : false,
      hasRrule: ev.hasRrule,
      tzid: ev.startTzid ?? null,
    }));

    return NextResponse.json({
      today,
      totalEvents: mapped.length,
      todayEvents: mapped.filter(e => e.isToday),
      allEvents:   mapped.slice(0, 20),
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) });
  }
}
