'use client';

import { useEffect, useRef, useState } from 'react';
import { CalendarEvent, Todo } from '@/types/database';

const PIP_COLORS: Record<CalendarEvent['category'], string> = {
  personal:    'var(--green)',
  client:      'var(--orange)',
  work:        'var(--blue)',
  'deep-work': 'var(--indigo)',
  other:       'var(--gray-4)',
};

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function toLA(d: Date): string {
  return d.toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
}

/** Monday of the week containing `d` (Sunday-anchored weeks use Sun; we use Mon here) */
function mondayOf(d: Date): Date {
  const copy = new Date(d);
  const day  = copy.getDay(); // 0=Sun
  copy.setDate(copy.getDate() - (day === 0 ? 6 : day - 1));
  copy.setHours(12, 0, 0, 0);
  return copy;
}

/** Build an array of YYYY-MM-DD strings starting at `from` for `count` days */
function dateRange(from: Date, count: number): string[] {
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(from);
    d.setDate(d.getDate() + i);
    return toLA(d);
  });
}

interface Props {
  /** Today's events (pre-fetched by HomeClient); the view will re-fetch for the full range */
  events?: CalendarEvent[];
  /** All todos from HomeClient — timed ones (due_date set) show on their due day */
  todos?: Todo[];
  onToggle?: (id: string, completed: boolean) => Promise<void>;
}

const TODO_CAT_COLOR: Record<string, string> = {
  personal: 'var(--blue)',
  aevro:    'var(--indigo)',
};

function fmtShort(date: string) {
  return new Date(date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function CalendarTodoRow({ todo, overdue, onToggle }: { todo: Todo; overdue?: boolean; onToggle?: (id: string, completed: boolean) => Promise<void> }) {
  const color = TODO_CAT_COLOR[todo.category] ?? 'var(--blue)';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 10px', borderRadius: 'var(--r-md)', background: 'var(--bg)', border: overdue ? '1px solid var(--red)' : '1px solid transparent' }}>
      <button type="button" onClick={() => onToggle?.(todo.id, true)} aria-label={`Complete ${todo.text}`}
        style={{ width: '18px', height: '18px', flexShrink: 0, borderRadius: '5px', border: `2px solid ${todo.priority === 'high' ? 'var(--red)' : color}`, background: 'transparent', cursor: onToggle ? 'pointer' : 'default', padding: 0 }} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--black)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {todo.text}
        </div>
        <div style={{ fontSize: '10px', color: overdue ? 'var(--red)' : 'var(--gray-4)', fontWeight: overdue ? 700 : 500 }}>
          {overdue ? `⚠ Overdue — was ${fmtShort(todo.due_date!)}` : (todo.priority === 'high' ? 'High priority' : 'Task')}
        </div>
      </div>
      <span style={{ fontSize: '9px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color, flexShrink: 0 }}>
        {todo.category === 'aevro' ? 'Aevro' : 'Personal'}
      </span>
    </div>
  );
}

export default function CalendarView({ events: seedEvents = [], todos = [], onToggle }: Props) {
  const today   = toLA(new Date());
  const monday  = mondayOf(new Date());

  // Total range: Mon this week → today + 30 more days
  // We go from Monday of this week so the week strip is always complete.
  const rangeStart  = monday;
  const daysFromMon = Math.round((new Date().getTime() - monday.getTime()) / 86_400_000);
  const totalDays   = daysFromMon + 31; // Mon..today+30

  const [events, setEvents]   = useState<CalendarEvent[]>(seedEvents);
  const [loading, setLoading] = useState(true);
  const scrollRef             = useRef<HTMLDivElement>(null); // the scroll container
  const todayRef              = useRef<HTMLDivElement>(null); // today's row

  useEffect(() => {
    setLoading(true);
    fetch(
      `/api/calendar?from=${toLA(rangeStart)}&days=${totalDays}`,
      { cache: 'no-store' }
    )
      .then(r => r.json())
      .then((data: CalendarEvent[]) => { setEvents(data); setLoading(false); })
      .catch(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Scroll the inner container to today — never touches page-level scroll
  useEffect(() => {
    if (loading) return;
    const container = scrollRef.current;
    const target    = todayRef.current;
    if (!container || !target) return;
    // offsetTop is relative to the scroll container
    container.scrollTop = target.offsetTop - 8;
  }, [loading]);

  // Build fast lookup: date → sorted events
  const byDate = new Map<string, CalendarEvent[]>();
  for (const ev of events) {
    const evDate = ev.date ?? '';
    if (!evDate) continue;
    if (!byDate.has(evDate)) byDate.set(evDate, []);
    byDate.get(evDate)!.push(ev);
  }

  // Timed todos grouped by due date (incomplete only). Overdue ones are pulled
  // out so they surface on Today instead of vanishing on a skipped past day.
  const todosByDate = new Map<string, Todo[]>();
  const overdueTodos: Todo[] = [];
  for (const t of todos) {
    if (t.completed || !t.due_date) continue;
    if (t.due_date < today) { overdueTodos.push(t); continue; }
    if (!todosByDate.has(t.due_date)) todosByDate.set(t.due_date, []);
    todosByDate.get(t.due_date)!.push(t);
  }
  overdueTodos.sort((a, b) => (a.due_date! < b.due_date! ? -1 : 1));

  // Week strip: Mon–Sun of current week
  const weekDays = dateRange(monday, 7);

  // Scrollable list: full range (Mon this week → today+30)
  const allDays = dateRange(rangeStart, totalDays);

  return (
    <div style={{
      height:        '100%',
      display:       'flex',
      flexDirection: 'column',
      background:    'var(--card)',
      borderRadius:  'var(--r-lg)',
      padding:       '14px',
      boxShadow:     'var(--shadow)',
      overflow:      'hidden',
      boxSizing:     'border-box',
    }}>

      {/* ── Header ─────────────────────────────────────────────────── */}
      <div style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--gray-4)', marginBottom: '14px', flexShrink: 0 }}>
        Google Calendar
        {loading && <span style={{ marginLeft: '8px', opacity: 0.5 }}>…</span>}
      </div>

      {/* ── Week strip (this week Mon–Sun) ──────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px', marginBottom: '16px', flexShrink: 0 }}>
        {weekDays.map(dateStr => {
          const d         = new Date(dateStr + 'T12:00:00');
          const dayLabel  = DOW[d.getDay()];
          const dayNum    = d.getDate();
          const isToday   = dateStr === today;
          const isPast    = dateStr < today;
          const hasEvents = (byDate.get(dateStr)?.length ?? 0) > 0;
          const hasTodos  = (todosByDate.get(dateStr)?.length ?? 0) > 0 || (isToday && overdueTodos.length > 0);

          return (
            <div key={dateStr} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
              <div style={{ fontSize: '8px', fontWeight: 700, color: 'var(--gray-4)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {dayLabel}
              </div>
              <div style={{
                width: '26px', height: '26px', borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: isToday ? 'var(--blue)' : 'transparent',
                fontSize: '12px', fontWeight: isToday ? 700 : 500,
                color: isToday ? '#fff' : isPast ? 'var(--gray-4)' : 'var(--black)',
              }}>
                {dayNum}
              </div>
              <div style={{
                width: '4px', height: '4px', borderRadius: '50%',
                background: (hasEvents || hasTodos) ? (isToday ? '#fff' : 'var(--blue)') : 'transparent',
                opacity: isToday ? 0.8 : 1,
              }} />
            </div>
          );
        })}
      </div>

      {/* ── Scrollable event list ────────────────────────────────────── */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', paddingRight: '2px' }}>
        {allDays.map(dateStr => {
          const dayEvents = (byDate.get(dateStr) ?? []).sort((a, b) => {
            const toMins = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
            return toMins(a.startTime) - toMins(b.startTime);
          });
          const isToday      = dateStr === today;
          const isPast       = dateStr < today;
          const d            = new Date(dateStr + 'T12:00:00');
          const dayTodos     = todosByDate.get(dateStr) ?? [];
          const todayOverdue = isToday ? overdueTodos : [];
          const todoCount    = dayTodos.length + todayOverdue.length;

          // Skip past empty days — only show past days that have events
          if (isPast && dayEvents.length === 0 && dayTodos.length === 0) return null;

          return (
            <div
              key={dateStr}
              ref={isToday ? todayRef : undefined}
              style={{ marginBottom: '16px' }}
            >
              {/* Day header */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                marginBottom: '6px',
                position: 'sticky', top: 0,
                background: 'var(--card)', padding: '3px 0', zIndex: 2,
              }}>
                <div style={{
                  width: '30px', height: '30px', borderRadius: '50%', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: isToday ? 'var(--blue)' : 'transparent',
                  border: isToday ? 'none' : `1px solid ${isPast ? 'transparent' : 'var(--sep)'}`,
                  fontSize: '13px', fontWeight: 700,
                  color: isToday ? '#fff' : isPast ? 'var(--gray-4)' : 'var(--black)',
                }}>
                  {d.getDate()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: '13px', fontWeight: 700,
                    color: isToday ? 'var(--blue)' : isPast ? 'var(--gray-4)' : 'var(--black)',
                  }}>
                    {isToday
                      ? 'Today'
                      : d.toLocaleDateString('en-US', { weekday: 'long' })}
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--gray-4)' }}>
                    {d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
                  </div>
                </div>
                {(dayEvents.length > 0 || todoCount > 0) && (
                  <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--gray-4)', flexShrink: 0, textAlign: 'right', lineHeight: 1.35 }}>
                    {dayEvents.length > 0 && <div>{dayEvents.length} event{dayEvents.length !== 1 ? 's' : ''}</div>}
                    {todoCount > 0 && <div style={{ color: 'var(--blue)' }}>{todoCount} task{todoCount !== 1 ? 's' : ''}</div>}
                  </div>
                )}
              </div>

              {/* Events + tasks */}
              {dayEvents.length === 0 && todoCount === 0 ? (
                <div style={{ fontSize: '11px', color: 'var(--gray-5)', paddingLeft: '40px' }}>
                  Nothing scheduled
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', paddingLeft: '40px' }}>
                  {todayOverdue.map(t => (
                    <CalendarTodoRow key={t.id} todo={t} overdue onToggle={onToggle} />
                  ))}
                  {dayEvents.map(ev => (
                    <div key={ev.id} style={{
                      display: 'flex', alignItems: 'center', gap: '10px',
                      padding: '7px 10px', borderRadius: 'var(--r-md)',
                      background: 'var(--bg)',
                    }}>
                      <div style={{
                        width: '3px', height: '30px', borderRadius: '2px',
                        background: PIP_COLORS[ev.category], flexShrink: 0,
                      }} />
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{
                          fontSize: '12px', fontWeight: 600, color: 'var(--black)',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {ev.title}
                        </div>
                        <div style={{
                          fontSize: '10px', color: 'var(--gray-3)',
                          fontFamily: 'var(--font-geist-mono), monospace',
                        }}>
                          {ev.startTime} – {ev.endTime}
                          {ev.durationMinutes != null && (
                            <span style={{ marginLeft: '6px', color: 'var(--gray-4)' }}>
                              {ev.durationMinutes < 60
                                ? `${ev.durationMinutes}m`
                                : `${(ev.durationMinutes / 60).toFixed(1).replace('.0', '')}h`}
                            </span>
                          )}
                        </div>
                        {ev.subtitle && (
                          <div style={{ fontSize: '10px', color: 'var(--gray-4)', marginTop: '1px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {ev.subtitle}
                          </div>
                        )}
                      </div>
                      {ev.meetLink && (
                        <a href={ev.meetLink} target="_blank" rel="noopener noreferrer"
                          style={{ fontSize: '10px', fontWeight: 700, color: 'var(--blue)', flexShrink: 0, textDecoration: 'none' }}>
                          Join
                        </a>
                      )}
                    </div>
                  ))}
                  {dayTodos.map(t => (
                    <CalendarTodoRow key={t.id} todo={t} onToggle={onToggle} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
