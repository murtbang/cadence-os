'use client';

import { useEffect, useState, CSSProperties } from 'react';
import { Habit, HabitLog, CalendarEvent, Todo } from '@/types/database';

// ── Shared shell matches every existing dashboard card ─────────────────────

const shell: CSSProperties = {
  background:    'var(--card)',
  borderRadius:  'var(--r-lg)',
  boxShadow:     'var(--shadow)',
  border:        '1px solid var(--sep)',
  padding:       '14px 16px',
  display:       'flex',
  flexDirection: 'column',
  minHeight:     0,
  height:        '100%',
  overflow:      'hidden',
  position:      'relative',
  boxSizing:     'border-box',
};

const labelStyle: CSSProperties = {
  fontSize:      '10px',
  fontWeight:    850,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  color:         'var(--gray-3)',
  flexShrink:    0,
};

function to12h(t: string): string {
  const [h, m] = t.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

// ── NextEvent — Tomorrow ───────────────────────────────────────────────────

export function NextEventTomorrowFace() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    const tomorrow = d.toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
    fetch(`/api/calendar?date=${tomorrow}`)
      .then(r => r.json())
      .then(setEvents)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const dayLabel = new Date(new Date().setDate(new Date().getDate() + 1))
    .toLocaleDateString('en-US', { weekday: 'long', timeZone: 'America/Los_Angeles' });

  return (
    <section style={shell}>
      <div style={{ ...labelStyle, marginBottom: 10 }}>Next Event — Tomorrow</div>

      {loading ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', fontSize: 12, color: 'var(--gray-4)', fontWeight: 600 }}>
          Loading…
        </div>
      ) : events.length === 0 ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 4 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--gray-4)' }}>Free day</div>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--gray-4)' }}>{dayLabel}</div>
        </div>
      ) : (
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-3)', marginBottom: 2 }}>{dayLabel}</div>
          {events.map(ev => (
            <div key={ev.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <div style={{ fontFamily: 'var(--font-geist-mono), monospace', fontSize: 12, fontWeight: 500, color: 'var(--gray-3)', flexShrink: 0, paddingTop: 1 }}>
                {to12h(ev.startTime)}
              </div>
              <div style={{ fontSize: 12, fontWeight: 750, color: 'var(--black)', lineHeight: 1.3 }}>
                {ev.title}
                {ev.subtitle && <div style={{ fontSize: 10, fontWeight: 500, color: 'var(--gray-3)', marginTop: 1 }}>{ev.subtitle}</div>}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// ── NextEvent — This Week ──────────────────────────────────────────────────

export function NextEventWeekFace() {
  const [byDay, setByDay] = useState<{ date: string; label: string; events: CalendarEvent[] }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/calendar?days=7')
      .then(r => r.json())
      .then((all: CalendarEvent[]) => {
        const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
        // exclude today (shown on front face), group remaining by date
        const future = all.filter(ev => ev.date && ev.date > today);
        const groups: Record<string, CalendarEvent[]> = {};
        for (const ev of future) {
          const d = ev.date!;
          if (!groups[d]) groups[d] = [];
          groups[d].push(ev);
        }
        const result = Object.entries(groups)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([date, events]) => ({
            date,
            label: new Date(date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
            events,
          }));
        setByDay(result);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <section style={shell}>
      <div style={{ ...labelStyle, marginBottom: 10 }}>Next Event — This Week</div>

      {loading ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', fontSize: 12, color: 'var(--gray-4)', fontWeight: 600 }}>Loading…</div>
      ) : byDay.length === 0 ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', fontSize: 13, fontWeight: 700, color: 'var(--gray-4)' }}>Clear week ahead</div>
      ) : (
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {byDay.map(({ date, label, events }) => (
            <div key={date}>
              <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--gray-3)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 5 }}>
                {label}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {events.map(ev => (
                  <div key={ev.id} style={{ display: 'flex', gap: 7, alignItems: 'baseline' }}>
                    <div style={{ fontFamily: 'var(--font-geist-mono), monospace', fontSize: 11, fontWeight: 500, color: 'var(--gray-3)', flexShrink: 0 }}>
                      {to12h(ev.startTime)}
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 750, color: 'var(--black)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {ev.title}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// ── Next Todo (timed todos by due date) ────────────────────────────────────

function dueMeta(date: string, today: string): { label: string; color: string } {
  const days = Math.round((new Date(date + 'T12:00:00').getTime() - new Date(today + 'T12:00:00').getTime()) / 86_400_000);
  if (days < 0)   return { label: 'Overdue',   color: 'var(--red)'    };
  if (days === 0) return { label: 'Due today', color: 'var(--red)'    };
  if (days === 1) return { label: 'Tomorrow',  color: 'var(--orange)' };
  if (days <= 6)  return { label: new Date(date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' }), color: 'var(--gray-3)' };
  return { label: new Date(date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), color: 'var(--gray-3)' };
}

export function NextTodoFace({ dueTodos }: { dueTodos: Todo[] }) {
  const today       = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
  const urgentCount = dueTodos.filter(t => t.due_date != null && t.due_date <= today).length;

  return (
    <section style={shell}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexShrink: 0 }}>
        <div style={labelStyle}>Next Todo</div>
        {urgentCount > 0 && (
          <div style={{ fontFamily: 'var(--font-geist-mono), monospace', fontSize: 11, fontWeight: 700, color: 'var(--red)' }}>{urgentCount} due</div>
        )}
      </div>

      {dueTodos.length === 0 ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', fontSize: 13, fontWeight: 700, color: 'var(--gray-4)' }}>Nothing due</div>
      ) : (
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, display: 'flex', flexDirection: 'column', gap: 9 }}>
          {dueTodos.slice(0, 5).map(t => {
            const m        = dueMeta(t.due_date!, today);
            const catColor = t.category === 'aevro' ? 'var(--indigo)' : 'var(--blue)';
            return (
              <div key={t.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, minWidth: 0 }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: t.priority === 'high' ? 'var(--red)' : catColor, flexShrink: 0, marginTop: 6 }} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 750, color: 'var(--black)', lineHeight: 1.25, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {t.text}
                  </div>
                  <div style={{ fontSize: 10, fontWeight: 750, color: m.color, marginTop: 1 }}>{m.label}</div>
                </div>
              </div>
            );
          })}
          {dueTodos.length > 5 && (
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--gray-4)', paddingLeft: 13 }}>+{dueTodos.length - 5} more</div>
          )}
        </div>
      )}
    </section>
  );
}

// ── Habit Streaks ──────────────────────────────────────────────────────────

function computeStreak(habitId: string, logs: HabitLog[]): number {
  const done = new Set(logs.filter(l => l.habit_id === habitId && l.type === 'done').map(l => l.date));
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
  const d = new Date(today + 'T12:00:00');
  if (!done.has(today)) d.setDate(d.getDate() - 1);
  let streak = 0;
  while (done.has(d.toLocaleDateString('en-CA'))) {
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

interface HabitStreaksFaceProps {
  habits: Habit[];
  logs: HabitLog[];
}

export function HabitStreaksFace({ habits, logs }: HabitStreaksFaceProps) {
  const active = habits.filter(h => !h.deleted_at);
  const amHabits = active.filter(h => h.period === 'AM').sort((a, b) => a.order - b.order);
  const pmHabits = active.filter(h => h.period === 'PM').sort((a, b) => a.order - b.order);

  // 7-day completion rate
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
  const weekDates: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today + 'T12:00:00');
    d.setDate(d.getDate() - i);
    weekDates.push(d.toLocaleDateString('en-CA'));
  }
  const totalPossible = active.length * 7;
  const totalDone = weekDates.reduce((sum, date) =>
    sum + active.filter(h => logs.some(l => l.habit_id === h.id && l.date === date && l.type === 'done')).length,
    0,
  );
  const weekPct = totalPossible > 0 ? Math.round((totalDone / totalPossible) * 100) : 0;

  function HabitRow({ habit }: { habit: Habit }) {
    const streak = computeStreak(habit.id, logs);
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
        <span style={{ fontSize: 13, flexShrink: 0 }}>{habit.emoji ?? '•'}</span>
        <div style={{ fontSize: 12, fontWeight: 650, color: 'var(--black)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {habit.name}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0 }}>
          {streak > 0 && <span style={{ fontSize: 11 }}>🔥</span>}
          <span style={{ fontFamily: 'var(--font-geist-mono), monospace', fontSize: 12, fontWeight: 700, color: streak > 0 ? 'var(--orange)' : 'var(--gray-4)' }}>
            {streak}d
          </span>
        </div>
      </div>
    );
  }

  function Section({ label, list }: { label: string; list: Habit[] }) {
    if (list.length === 0) return null;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--gray-4)' }}>{label}</div>
        {list.map(h => <HabitRow key={h.id} habit={h} />)}
      </div>
    );
  }

  return (
    <section style={shell}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexShrink: 0 }}>
        <div style={labelStyle}>Habits — Streaks</div>
        <div style={{ fontFamily: 'var(--font-geist-mono), monospace', fontSize: 11, fontWeight: 700, color: 'var(--gray-3)' }}>{weekPct}% this week</div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Section label="AM" list={amHabits} />
        <Section label="PM" list={pmHabits} />
        {active.length === 0 && (
          <div style={{ fontSize: 12, color: 'var(--gray-4)', fontWeight: 600 }}>No habits yet</div>
        )}
      </div>
    </section>
  );
}

// ── Training Stats ─────────────────────────────────────────────────────────

interface BodyMapData {
  latestWorkout: { loggedAt: string; classification: string; muscles: string[]; exercises: string[] } | null;
  weeklyProgress: { completed: string[]; target: string[]; nextFocus: string; completedCount: number; targetCount: number };
}

export function TrainingStatsFace() {
  const [data, setData] = useState<BodyMapData | null>(null);

  useEffect(() => {
    fetch('/api/boostcamp/recent-body-map')
      .then(r => r.json())
      .then(setData)
      .catch(() => {});
  }, []);

  const lw = data?.latestWorkout;
  const wp = data?.weeklyProgress;

  const daysSince = lw
    ? Math.floor((Date.now() - new Date(lw.loggedAt).getTime()) / 86_400_000)
    : null;

  const clsColor: Record<string, string> = {
    Push: 'var(--orange)', Pull: '#5AC8FA', Legs: '#34C759', Other: 'var(--gray-3)',
  };

  return (
    <section style={{ ...shell, gap: 0 }}>
      <div style={{ ...labelStyle, marginBottom: 14 }}>Training — Stats</div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: 0 }}>
        {/* Days since */}
        <div>
          <div style={{ fontFamily: 'var(--font-geist-mono), monospace', fontSize: 42, fontWeight: 450, letterSpacing: '-2px', lineHeight: 1, color: daysSince === 0 ? 'var(--green)' : 'var(--black)' }}>
            {daysSince === null ? '—' : daysSince === 0 ? '0' : daysSince}
          </div>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--gray-3)', marginTop: 3 }}>
            {daysSince === null ? 'no workouts logged' : daysSince === 0 ? 'trained today' : `day${daysSince === 1 ? '' : 's'} since last session`}
          </div>
        </div>

        {/* Weekly progress */}
        {wp && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--gray-3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>This week</div>
              <div style={{ fontFamily: 'var(--font-geist-mono), monospace', fontSize: 12, fontWeight: 700, color: 'var(--gray-2)' }}>
                {wp.completedCount}/{wp.targetCount}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 5 }}>
              {wp.target.map((t, i) => {
                const done  = i < wp.completed.length;
                const color = done ? (clsColor[wp.completed[i]] ?? 'var(--gray-3)') : 'var(--gray-5, #e5e5e5)';
                return <div key={i} title={t} style={{ width: 8, height: 8, borderRadius: '50%', background: color, border: done ? 'none' : '1.5px solid var(--sep)' }} />;
              })}
            </div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--gray-3)' }}>
              Next: <span style={{ color: clsColor[wp.nextFocus] ?? 'var(--gray-2)', fontWeight: 750 }}>{wp.nextFocus}</span>
            </div>
          </div>
        )}

        {/* Last classification */}
        {lw && (
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--gray-4)' }}>
            Last: <span style={{ color: clsColor[lw.classification] ?? 'var(--gray-3)', fontWeight: 750 }}>{lw.classification}</span>
            {' · '}{lw.muscles.slice(0, 3).join(', ')}
          </div>
        )}
      </div>
    </section>
  );
}

// ── Goals — Quote ──────────────────────────────────────────────────────────

const QUOTES = [
  { text: "You don't rise to the level of your goals, you fall to the level of your systems.", author: "James Clear" },
  { text: "The pain of discipline is far less than the pain of regret.", author: "Jim Rohn" },
  { text: "A goal without a plan is just a wish.", author: "Antoine de Saint-Exupéry" },
];

export function GoalsQuoteFace() {
  const [idx] = useState(() => Math.floor(Math.random() * QUOTES.length));
  const q = QUOTES[idx];

  return (
    <section style={{ ...shell, justifyContent: 'space-between' }}>
      <div style={labelStyle}>2026 Goals</div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--black)', lineHeight: 1.5, letterSpacing: '-0.2px', fontStyle: 'italic' }}>
          "{q.text}"
        </div>
        <div style={{ fontSize: 11, fontWeight: 750, color: 'var(--gray-3)', letterSpacing: '0.02em' }}>
          — {q.author}
        </div>
      </div>
    </section>
  );
}
