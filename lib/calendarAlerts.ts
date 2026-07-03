/**
 * Shared calendar-alert logic.
 * Exported from a lib file (not a route) so Next.js doesn't treat it as an HTTP handler.
 */

import { sendWebhook } from '@/lib/discord';
import { parseIcal, ICalEvent } from '@/lib/parseIcal';
import { supabase } from '@/lib/supabase';
import { signParams } from '@/lib/cron';

// ── RRULE expansion ──────────────────────────────────────────────────────────

function parseRRule(raw: string) {
  const parts: Record<string, string> = {};
  raw.replace(/^RRULE:/i, '').split(';').forEach(p => {
    const eq = p.indexOf('=');
    if (eq > 0) parts[p.slice(0, eq).toUpperCase()] = p.slice(eq + 1);
  });
  return {
    freq:     (parts['FREQ'] ?? 'WEEKLY').toUpperCase(),
    interval: parseInt(parts['INTERVAL'] ?? '1', 10) || 1,
    byday:    parts['BYDAY'] ? parts['BYDAY'].split(',').map(d => d.trim().toUpperCase().slice(-2)) : [],
    until:    parts['UNTIL'] ? parseUntil(parts['UNTIL']) : null,
  };
}

function parseUntil(raw: string): Date {
  const c = raw.replace(/[^0-9TZ]/g, '');
  if (c.endsWith('Z') && c.length >= 15) {
    return new Date(
      `${c.slice(0,4)}-${c.slice(4,6)}-${c.slice(6,8)}T${c.slice(9,11)}:${c.slice(11,13)}:${c.slice(13,15)}Z`
    );
  }
  return new Date(`${c.slice(0,4)}-${c.slice(4,6)}-${c.slice(6,8)}T23:59:59Z`);
}

/**
 * Given a recurring event and the current time, returns today's occurrence
 * start time (UTC Date), or null if the event doesn't occur today.
 */
export function todayOccurrence(ev: ICalEvent, now: Date): Date | null {
  if (!ev.startDate || !ev.rrule) return null;

  const rule = parseRRule(ev.rrule);

  const todayMidnight = new Date(now);
  todayMidnight.setUTCHours(0, 0, 0, 0);

  const startMidnight = new Date(ev.startDate);
  startMidnight.setUTCHours(0, 0, 0, 0);

  if (todayMidnight < startMidnight) return null;
  if (rule.until && now > rule.until) return null;

  const todayDow  = todayMidnight.getUTCDay();   // 0=Sun
  const startDow  = startMidnight.getUTCDay();
  const daysDiff  = Math.round((todayMidnight.getTime() - startMidnight.getTime()) / 86_400_000);
  const monthsDiff = (todayMidnight.getUTCFullYear() - startMidnight.getUTCFullYear()) * 12
                   + (todayMidnight.getUTCMonth()    - startMidnight.getUTCMonth());

  const DOW_NAMES = ['SU','MO','TU','WE','TH','FR','SA'];
  let matches = false;

  switch (rule.freq) {
    case 'DAILY':
      matches = daysDiff % rule.interval === 0;
      break;

    case 'WEEKLY': {
      const days = rule.byday.length > 0 ? rule.byday : [DOW_NAMES[startDow]];
      if (!days.includes(DOW_NAMES[todayDow])) break;
      // Find how many full-week intervals have passed since the anchor
      const dowOffset = (todayDow - startDow + 7) % 7;
      const weeksElapsed = Math.floor((daysDiff - dowOffset) / 7);
      matches = weeksElapsed >= 0 && weeksElapsed % rule.interval === 0;
      break;
    }

    case 'MONTHLY':
      matches = monthsDiff % rule.interval === 0
             && todayMidnight.getUTCDate() === startMidnight.getUTCDate();
      break;

    case 'YEARLY':
      matches = (todayMidnight.getUTCFullYear() - startMidnight.getUTCFullYear()) % rule.interval === 0
             && todayMidnight.getUTCMonth() === startMidnight.getUTCMonth()
             && todayMidnight.getUTCDate()  === startMidnight.getUTCDate();
      break;
  }

  if (!matches) return null;

  // Clone today's midnight, set the original event's HH:MM:SS (UTC)
  const occ = new Date(todayMidnight);
  occ.setUTCHours(
    ev.startDate.getUTCHours(),
    ev.startDate.getUTCMinutes(),
    ev.startDate.getUTCSeconds(),
    0
  );
  return occ;
}

// ── Reminder windows ──────────────────────────────────────────────────────────

export const REMINDER_WINDOWS = [
  { label: '1 hour',  emoji: '🔔', minLow: 58, minHigh: 62 },
  { label: '30 min',  emoji: '⏰', minLow: 28, minHigh: 32 },
  { label: '15 min',  emoji: '🚨', minLow: 13, minHigh: 17 },
  { label: '5 min',   emoji: '🔴', minLow:  3, minHigh:  7 },
];

export interface AlertResult {
  summary:  string;
  reminder: string;
  time:     string;
  diffMins: number;
}

// ── Main logic ────────────────────────────────────────────────────────────────

export async function runCalendarAlerts(send: boolean): Promise<{
  alerts:      AlertResult[];
  checkedAt:   string;
  todayEvents: string[];
}> {
  const icalUrl = process.env.GOOGLE_CALENDAR_ICAL_URL ?? '';
  if (!icalUrl) return { alerts: [], checkedAt: new Date().toISOString(), todayEvents: [] };

  const res  = await fetch(icalUrl, { cache: 'no-store' });
  const text = await res.text();
  const evs  = parseIcal(text);

  const now   = new Date();
  const today = now.toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });

  // Load dismissed event UIDs for today
  const { data: dismissed } = await supabase
    .from('dismissed_reminders')
    .select('event_uid')
    .eq('event_date', today);
  const dismissedUids = new Set((dismissed ?? []).map((r: { event_uid: string }) => r.event_uid));

  // Set NEXT_PUBLIC_APP_URL to your deployment URL so dismiss links resolve.
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';

  const alerts: AlertResult[] = [];
  const todayTitles: string[] = [];

  for (const ev of evs) {
    // Skip all-day events
    if (/^\d{8}$/.test(ev.dtstart)) continue;

    // Resolve today's effective start time
    let effectiveStart: Date | null = null;

    if (ev.hasRrule) {
      effectiveStart = todayOccurrence(ev, now);
    } else {
      if (!ev.startDate) continue;
      const evDate = ev.startDate.toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
      if (evDate === today) effectiveStart = ev.startDate;
    }

    if (!effectiveStart) continue;
    todayTitles.push(ev.summary);

    // Skip all reminders for this event if user dismissed it
    if (dismissedUids.has(ev.uid)) continue;

    const diffMins = (effectiveStart.getTime() - now.getTime()) / 60_000;

    for (const w of REMINDER_WINDOWS) {
      if (diffMins >= w.minLow && diffMins <= w.minHigh) {
        const time = effectiveStart.toLocaleTimeString('en-US', {
          hour: 'numeric', minute: '2-digit', hour12: true,
          timeZone: 'America/Los_Angeles',
        });
        const meetMatch = ev.description?.match(/https:\/\/meet\.google\.com\/[a-z0-9-]+/);
        const meet = meetMatch ? `\n🔗 ${meetMatch[0]}` : '';
        const loc  = ev.location ? `\n📍 ${ev.location}` : '';

        const sig = signParams(`${ev.uid}|${today}`);
        const dismissUrl = `${appUrl}/api/dismiss-reminder?uid=${encodeURIComponent(ev.uid)}&date=${today}&sig=${sig}`;
        const dismiss = `\n[Snooze remaining reminders](${dismissUrl})`;
        const msg = `${w.emoji} **${ev.summary}** starts in **${w.label}** — ${time}${loc}${meet}${dismiss}`;
        if (send) await sendWebhook(msg);

        alerts.push({ summary: ev.summary, reminder: w.label, time, diffMins: Math.round(diffMins) });
        break;
      }
    }
  }

  return { alerts, checkedAt: now.toISOString(), todayEvents: todayTitles };
}
