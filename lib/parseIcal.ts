export interface ICalEvent {
  uid: string;
  summary: string;
  location?: string;
  description?: string;
  dtstart: string;   // raw value e.g. "20260515T090000Z" or "20260515"
  dtend: string;
  startTzid?: string;
  hasRrule: boolean;
  rrule?: string;    // raw RRULE value e.g. "FREQ=WEEKLY;BYDAY=MO,WE"
  startDate: Date | null;
  endDate: Date | null;
}

function unfold(raw: string): string {
  return raw.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '');
}

function getProp(block: string, key: string): string {
  // Matches KEY:value and KEY;param=x:value
  const m = block.match(new RegExp(`(?:^|\\n)${key}(?:;[^:]*)?:([^\\n]*)`, 'i'));
  return m ? m[1].trim() : '';
}

function getPropWithParam(block: string, key: string, param: string): string {
  const m = block.match(new RegExp(`(?:^|\\n)${key};[^:\\n]*${param}=([^;:\\n]*)`, 'i'));
  return m ? m[1].trim() : '';
}

function parseIcalDate(raw: string, tzid?: string): Date | null {
  if (!raw) return null;
  const clean = raw.replace(/[^0-9TZ]/g, '');

  // Date-only: YYYYMMDD
  if (/^\d{8}$/.test(clean)) {
    return new Date(`${clean.slice(0, 4)}-${clean.slice(4, 6)}-${clean.slice(6, 8)}T00:00:00`);
  }

  // UTC datetime: YYYYMMDDTHHmmssZ
  if (clean.endsWith('Z')) {
    return new Date(
      `${clean.slice(0, 4)}-${clean.slice(4, 6)}-${clean.slice(6, 8)}T` +
      `${clean.slice(9, 11)}:${clean.slice(11, 13)}:${clean.slice(13, 15)}Z`
    );
  }

  // Floating datetime (with or without TZID): treat as-is in local context
  const iso =
    `${clean.slice(0, 4)}-${clean.slice(4, 6)}-${clean.slice(6, 8)}T` +
    `${clean.slice(9, 11)}:${clean.slice(11, 13)}:${clean.slice(13, 15)}`;

  if (tzid) {
    try {
      // Use Intl to get the UTC offset for this tz at this moment, then adjust
      const local = new Date(iso);
      const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: tzid,
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hour12: false,
      }).formatToParts(local);
      const get = (t: string) => parts.find(p => p.type === t)?.value ?? '0';
      const tzDate = new Date(Date.UTC(
        Number(get('year')), Number(get('month')) - 1, Number(get('day')),
        Number(get('hour')), Number(get('minute')), Number(get('second')),
      ));
      const offset = local.getTime() - tzDate.getTime();
      return new Date(local.getTime() + offset);
    } catch {
      return new Date(iso);
    }
  }

  return new Date(iso);
}

export function parseIcal(raw: string): ICalEvent[] {
  const text = unfold(raw);
  const events: ICalEvent[] = [];
  const re = /BEGIN:VEVENT([\s\S]*?)END:VEVENT/g;
  let m: RegExpExecArray | null;

  while ((m = re.exec(text)) !== null) {
    const block = m[1];
    const dtstart = getProp(block, 'DTSTART');
    const dtend   = getProp(block, 'DTEND');
    const tzid    = getPropWithParam(block, 'DTSTART', 'TZID');

    const rawRrule = getProp(block, 'RRULE');
    events.push({
      uid:         getProp(block, 'UID'),
      summary:     getProp(block, 'SUMMARY'),
      location:    getProp(block, 'LOCATION') || undefined,
      description: getProp(block, 'DESCRIPTION') || undefined,
      dtstart,
      dtend,
      startTzid:   tzid || undefined,
      hasRrule:    !!rawRrule,
      rrule:       rawRrule || undefined,
      startDate:   parseIcalDate(dtstart, tzid),
      endDate:     parseIcalDate(dtend, tzid),
    });
  }

  return events;
}
