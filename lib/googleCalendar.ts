const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const CAL_BASE  = 'https://www.googleapis.com/calendar/v3/calendars';

const TZ = 'America/Los_Angeles';

// ── Auth ────────────────────────────────────────────────────────────────────

async function getAccessToken(): Promise<string> {
  const res = await fetch(TOKEN_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN!,
      grant_type:    'refresh_token',
    }),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error(`Token error: ${JSON.stringify(data)}`);
  return data.access_token;
}

function calId() {
  return encodeURIComponent(process.env.GOOGLE_CALENDAR_ID ?? 'primary');
}

// ── Date / time helpers ──────────────────────────────────────────────────────

/** Parse "today", "tomorrow", or "YYYY-MM-DD" → "YYYY-MM-DD" in LA time */
export function parseDate(raw: string): string {
  const s = raw.trim().toLowerCase();
  const la = new Date().toLocaleDateString('en-CA', { timeZone: TZ }); // YYYY-MM-DD
  if (s === 'today')    return la;
  if (s === 'tomorrow') {
    const d = new Date(la + 'T12:00:00');
    d.setDate(d.getDate() + 1);
    return d.toLocaleDateString('en-CA');
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  throw new Error(`Unrecognised date: "${raw}". Use YYYY-MM-DD, today, or tomorrow.`);
}

/** Parse "14:00", "2pm", "2:30pm", "14:30" → "HH:MM" 24h */
export function parseTime(raw: string): string {
  const s = raw.trim().toLowerCase().replace(/\s/g, '');
  // already 24h HH:MM
  if (/^\d{1,2}:\d{2}$/.test(s)) {
    const [h, m] = s.split(':').map(Number);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
  // 12h with am/pm
  const m12 = s.match(/^(\d{1,2})(?::(\d{2}))?(am|pm)$/);
  if (m12) {
    let h = parseInt(m12[1]);
    const min = m12[2] ? parseInt(m12[2]) : 0;
    if (m12[3] === 'pm' && h !== 12) h += 12;
    if (m12[3] === 'am' && h === 12) h = 0;
    return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
  }
  throw new Error(`Unrecognised time: "${raw}". Use HH:MM (24h) or 2:30pm.`);
}

function dateTime(date: string, time: string) {
  return { dateTime: `${date}T${time}:00`, timeZone: TZ };
}

function fmtEvent(ev: GCalEvent): string {
  const start = ev.start?.dateTime ?? ev.start?.date ?? '';
  const d = start ? new Date(start).toLocaleString('en-US', {
    timeZone: TZ, weekday: 'short', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit',
  }) : '';
  return `**${ev.summary ?? '(untitled)'}** — ${d}`;
}

// ── Types ───────────────────────────────────────────────────────────────────

export interface GCalEvent {
  id:       string;
  summary?: string;
  description?: string;
  location?: string;
  start?:   { dateTime?: string; date?: string; timeZone?: string };
  end?:     { dateTime?: string; date?: string; timeZone?: string };
  htmlLink?: string;
}

// ── API calls ────────────────────────────────────────────────────────────────

export async function gcalCreate(params: {
  name:        string;
  date:        string; // YYYY-MM-DD
  startTime:   string; // HH:MM
  endTime:     string; // HH:MM
  description?: string;
  location?:   string;
}): Promise<{ ok: true; event: GCalEvent; display: string } | { ok: false; error: string }> {
  try {
    const token = await getAccessToken();
    const body = {
      summary:     params.name,
      description: params.description,
      location:    params.location,
      start:       dateTime(params.date, params.startTime),
      end:         dateTime(params.date, params.endTime),
    };
    const res  = await fetch(`${CAL_BASE}/${calId()}/events`, {
      method:  'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
    });
    const event: GCalEvent = await res.json();
    if (!res.ok) return { ok: false, error: (event as any).error?.message ?? 'Create failed' };
    return { ok: true, event, display: fmtEvent(event) };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

export async function gcalSearch(query: string): Promise<GCalEvent[]> {
  const token = await getAccessToken();
  const now    = new Date().toISOString();
  const future = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(); // 60 days
  const params = new URLSearchParams({
    q: query, timeMin: now, timeMax: future,
    singleEvents: 'true', orderBy: 'startTime', maxResults: '5',
  });
  const res  = await fetch(`${CAL_BASE}/${calId()}/events?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  return data.items ?? [];
}

export async function gcalPatch(eventId: string, params: {
  name?:        string;
  date?:        string;
  startTime?:   string;
  endTime?:     string;
  description?: string;
  location?:    string;
  existingEvent: GCalEvent;
}): Promise<{ ok: true; event: GCalEvent; display: string } | { ok: false; error: string }> {
  try {
    const token = await getAccessToken();
    const patch: Record<string, unknown> = {};

    if (params.name)        patch.summary     = params.name;
    if (params.description !== undefined) patch.description = params.description;
    if (params.location    !== undefined) patch.location    = params.location;

    // Date/time: merge with existing if only one side changes
    const existStart = params.existingEvent.start?.dateTime;
    const existEnd   = params.existingEvent.end?.dateTime;
    const existDate  = existStart ? existStart.slice(0, 10) : '';
    const existSTime = existStart ? existStart.slice(11, 16) : '00:00';
    const existETime = existEnd   ? existEnd.slice(11, 16)   : '01:00';

    const newDate  = params.date      ?? existDate;
    const newSTime = params.startTime ?? existSTime;
    const newETime = params.endTime   ?? existETime;

    if (params.date || params.startTime) patch.start = dateTime(newDate, newSTime);
    if (params.date || params.endTime)   patch.end   = dateTime(newDate, newETime);

    const res = await fetch(`${CAL_BASE}/${calId()}/events/${eventId}`, {
      method:  'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body:    JSON.stringify(patch),
    });
    const event: GCalEvent = await res.json();
    if (!res.ok) return { ok: false, error: (event as any).error?.message ?? 'Patch failed' };
    return { ok: true, event, display: fmtEvent(event) };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

export async function gcalDelete(eventId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const token = await getAccessToken();
    const res = await fetch(`${CAL_BASE}/${calId()}/events/${eventId}`, {
      method:  'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 204 || res.ok) return { ok: true };
    const data = await res.json().catch(() => ({}));
    return { ok: false, error: (data as any).error?.message ?? 'Delete failed' };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

export { fmtEvent };
