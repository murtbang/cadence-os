import { NextResponse } from 'next/server';
import { parseIcal } from '@/lib/parseIcal';
import { CalendarEvent } from '@/types/database';

export const dynamic = 'force-dynamic';

const CATEGORY_KEYWORDS: Record<string, CalendarEvent['category']> = {
  'deep work': 'deep-work',
  'client':    'client',
  'work':      'work',
  'personal':  'personal',
};

function extractMeetLink(description?: string): string | undefined {
  if (!description) return undefined;
  const m = description.match(/https:\/\/meet\.google\.com\/[a-z0-9-]+/);
  return m?.[0];
}

function inferCategory(title: string, description?: string): CalendarEvent['category'] {
  const text = `${title} ${description ?? ''}`.toLowerCase();
  for (const [kw, cat] of Object.entries(CATEGORY_KEYWORDS)) {
    if (text.includes(kw)) return cat;
  }
  return 'other';
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: false,
    timeZone: 'America/Los_Angeles',
  });
}

function toLA(date: Date): string {
  return date.toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
}

export async function GET(request: Request) {
  const icalUrl = process.env.GOOGLE_CALENDAR_ICAL_URL;
  if (!icalUrl) return NextResponse.json([]);

  const { searchParams } = new URL(request.url);
  const dateParam = searchParams.get('date');   // specific YYYY-MM-DD
  const daysParam = searchParams.get('days');   // next N days (includes today)
  const fromParam = searchParams.get('from');   // optional start date YYYY-MM-DD

  try {
    const res = await fetch(icalUrl, { cache: 'no-store' });
    if (!res.ok) throw new Error(`iCal fetch failed: ${res.status}`);
    const text = await res.text();

    const today = toLA(new Date());
    const raw = parseIcal(text);

    // Build the set of dates to include
    let targetDates: Set<string>;
    if (dateParam) {
      targetDates = new Set([dateParam]);
    } else if (daysParam) {
      const n = Math.min(Math.max(parseInt(daysParam, 10), 1), 365);
      targetDates = new Set();
      const base = fromParam ? new Date(fromParam + 'T12:00:00') : new Date();
      for (let i = 0; i < n; i++) {
        const d = new Date(base);
        d.setDate(d.getDate() + i);
        targetDates.add(toLA(d));
      }
    } else {
      targetDates = new Set([today]);
    }

    const events: CalendarEvent[] = [];

    for (const ev of raw) {
      if (!ev.startDate || !ev.endDate) continue;
      const evDate = toLA(ev.startDate);
      if (!targetDates.has(evDate)) continue;

      events.push({
        id:              ev.uid || `${ev.dtstart}-${ev.summary}`,
        title:           ev.summary || '(no title)',
        subtitle:        ev.location,
        date:            evDate,
        startTime:       formatTime(ev.startDate),
        endTime:         formatTime(ev.endDate),
        category:        inferCategory(ev.summary, ev.description),
        durationMinutes: Math.round((ev.endDate.getTime() - ev.startDate.getTime()) / 60000),
        meetLink:        extractMeetLink(ev.description),
      });
    }

    events.sort((a, b) => {
      if (a.date !== b.date) return (a.date ?? '').localeCompare(b.date ?? '');
      const toMins = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
      return toMins(a.startTime) - toMins(b.startTime);
    });

    return NextResponse.json(events);
  } catch (err) {
    console.error('Calendar route error:', err);
    return NextResponse.json([]);
  }
}
