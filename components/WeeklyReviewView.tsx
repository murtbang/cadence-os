'use client';

import { useEffect, useState } from 'react';

interface Habit   { id: string; name: string; period: 'AM' | 'PM'; }
interface Log     { habit_id: string; date: string; type: string; }
interface Todo    { id: string; text: string; priority: string; completed: boolean; }
interface Workout { classification: string; logged_at: string; }

interface WeeklyData {
  days:          string[];
  today:         string;
  weekStart:     string;
  habits:        Habit[];
  logs:          Log[];
  todos:         Todo[];
  workouts:      Workout[];
  weeklyTarget:  string[];
  weightStart:   number | null;
  weightEnd:     number | null;
}

const CLASS_COLOR: Record<string, string> = {
  Push:  'var(--orange)',
  Pull:  '#5AC8FA',
  Legs:  '#34C759',
  Other: 'var(--gray-3)',
};

function Bar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
      <div style={{ flex: 1, height: '6px', borderRadius: '3px', background: 'var(--gray-6)', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, borderRadius: '3px', background: color, transition: 'width 0.4s ease' }} />
      </div>
      <div style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '11px', fontWeight: 700, color, minWidth: '32px', textAlign: 'right' }}>
        {pct}%
      </div>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--card)', borderRadius: 'var(--r-lg)', padding: '14px 16px', boxShadow: 'var(--shadow)', border: '1px solid var(--sep)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {children}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--gray-4)' }}>
      {children}
    </div>
  );
}

export default function WeeklyReviewView() {
  const [data, setData]       = useState<WeeklyData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/weekly', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading || !data) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--gray-4)', fontSize: '13px' }}>
        Loading…
      </div>
    );
  }

  const { days, habits, logs, todos, workouts, weeklyTarget, weightStart, weightEnd } = data;

  // ── Habits ──────────────────────────────────────────────────────────────────
  const amHabits  = habits.filter(h => h.period === 'AM');
  const pmHabits  = habits.filter(h => h.period === 'PM');
  const doneIds   = new Set(logs.filter(l => l.type !== 'skip').map(l => `${l.habit_id}|${l.date}`));

  function habitDone(id: string, date: string) { return doneIds.has(`${id}|${date}`); }

  function periodDone(hs: Habit[]) {
    return days.reduce((acc, d) => acc + hs.filter(h => habitDone(h.id, d)).length, 0);
  }
  function periodPossible(hs: Habit[]) { return hs.length * days.length; }

  const amDone  = periodDone(amHabits);
  const amTotal = periodPossible(amHabits);
  const pmDone  = periodDone(pmHabits);
  const pmTotal = periodPossible(pmHabits);

  // ── Training ────────────────────────────────────────────────────────────────
  const workoutTypes = workouts.map(w => w.classification);
  const trainedCount = workouts.length;
  const targetCount  = weeklyTarget.length;

  // ── Weight ──────────────────────────────────────────────────────────────────
  const weightDelta = (weightStart != null && weightEnd != null)
    ? +(weightEnd - weightStart).toFixed(1)
    : null;

  // ── Todos ───────────────────────────────────────────────────────────────────
  const highDone = todos.filter(t => t.priority === 'high').length;
  const lowDone  = todos.filter(t => t.priority === 'low').length;

  // ── Date range label ────────────────────────────────────────────────────────
  const fmt = (d: string) => {
    const dt = new Date(d + 'T12:00:00');
    return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };
  const rangeLabel = `${fmt(days[0])} – ${fmt(days[days.length - 1])}`;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: '14px 16px', gap: '10px', overflow: 'hidden', boxSizing: 'border-box' }}>

      {/* Header */}
      <div style={{ flexShrink: 0 }}>
        <div style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--gray-4)' }}>
          Weekly Snapshot
        </div>
        <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--gray-2)', marginTop: '2px' }}>
          {rangeLabel}
        </div>
      </div>

      {/* Scrollable cards */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '2px' }}>

        {/* ── Habits ── */}
        <Card>
          <Label>Habits</Label>

          {amHabits.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--gray-3)' }}>AM</div>
                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--gray-2)', fontFamily: 'var(--font-geist-mono)' }}>
                  {amDone}/{amTotal}
                </div>
              </div>
              <Bar value={amDone} max={amTotal} color="var(--blue)" />
            </div>
          )}

          {pmHabits.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--gray-3)' }}>PM</div>
                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--gray-2)', fontFamily: 'var(--font-geist-mono)' }}>
                  {pmDone}/{pmTotal}
                </div>
              </div>
              <Bar value={pmDone} max={pmTotal} color="var(--indigo)" />
            </div>
          )}

          {/* Day dots per period */}
          <div style={{ display: 'flex', gap: '4px', marginTop: '2px' }}>
            {days.map(d => {
              const amOk = amHabits.length > 0 && amHabits.every(h => habitDone(h.id, d));
              const pmOk = pmHabits.length > 0 && pmHabits.every(h => habitDone(h.id, d));
              const any  = amHabits.some(h => habitDone(h.id, d)) || pmHabits.some(h => habitDone(h.id, d));
              const bg   = (amOk && pmOk) ? 'var(--green)' : any ? 'var(--orange)' : 'var(--gray-6)';
              const isToday = d === data.today;
              return (
                <div key={d} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
                  <div style={{ width: '100%', height: '6px', borderRadius: '3px', background: bg }} />
                  <div style={{ fontSize: '8px', color: isToday ? 'var(--blue)' : 'var(--gray-5)', fontWeight: isToday ? 700 : 400 }}>
                    {new Date(d + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'narrow' })}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* ── Training ── */}
        <Card>
          <Label>Training</Label>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <div style={{ fontSize: '28px', fontWeight: 800, letterSpacing: '-1px', color: trainedCount >= targetCount ? 'var(--green)' : 'var(--black)', lineHeight: 1 }}>
              {trainedCount}<span style={{ fontSize: '16px', color: 'var(--gray-4)', fontWeight: 600 }}>/{targetCount}</span>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--gray-3)', fontWeight: 600 }}>
              {trainedCount >= targetCount ? 'Week complete 🎉' : `${targetCount - trainedCount} to go`}
            </div>
          </div>
          <Bar value={trainedCount} max={targetCount} color="var(--green)" />
          {/* Workout type chips */}
          {workoutTypes.length > 0 && (
            <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
              {workoutTypes.map((type, i) => (
                <span key={i} style={{
                  fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '99px',
                  background: `${CLASS_COLOR[type] ?? 'var(--gray-4)'}22`,
                  color: CLASS_COLOR[type] ?? 'var(--gray-4)',
                  border: `1px solid ${CLASS_COLOR[type] ?? 'var(--gray-4)'}44`,
                }}>
                  {type}
                </span>
              ))}
            </div>
          )}
          {workoutTypes.length === 0 && (
            <div style={{ fontSize: '11px', color: 'var(--gray-4)' }}>No workouts logged this week yet.</div>
          )}
        </Card>

        {/* ── Weight ── */}
        {(weightStart != null || weightEnd != null) && (
          <Card>
            <Label>Weight</Label>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px' }}>
              <div style={{ fontSize: '28px', fontWeight: 800, letterSpacing: '-1px', color: 'var(--black)', lineHeight: 1 }}>
                {weightEnd ?? weightStart} <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--gray-4)' }}>lbs</span>
              </div>
              {weightDelta !== null && Math.abs(weightDelta) >= 0.1 && (
                <div style={{
                  fontSize: '14px', fontWeight: 700,
                  color: weightDelta < 0 ? 'var(--green)' : 'var(--orange)',
                }}>
                  {weightDelta > 0 ? '+' : '−'}{Math.abs(weightDelta)} lbs this week
                </div>
              )}
              {weightDelta !== null && Math.abs(weightDelta) < 0.1 && (
                <div style={{ fontSize: '13px', color: 'var(--gray-4)', fontWeight: 600 }}>No change this week</div>
              )}
            </div>
            {weightStart != null && weightEnd != null && weightStart !== weightEnd && (
              <div style={{ fontSize: '10px', color: 'var(--gray-4)' }}>
                Started at {weightStart} lbs
              </div>
            )}
          </Card>
        )}

        {/* ── Tasks ── */}
        <Card>
          <Label>Tasks Completed</Label>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '16px' }}>
            <div style={{ fontSize: '28px', fontWeight: 800, letterSpacing: '-1px', color: todos.length > 0 ? 'var(--blue)' : 'var(--gray-4)', lineHeight: 1 }}>
              {todos.length}
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              {highDone > 0 && (
                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--red)' }}>
                  {highDone} high
                </div>
              )}
              {lowDone > 0 && (
                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--gray-3)' }}>
                  {lowDone} low
                </div>
              )}
              {todos.length === 0 && (
                <div style={{ fontSize: '11px', color: 'var(--gray-4)' }}>None completed yet</div>
              )}
            </div>
          </div>
        </Card>

      </div>
    </div>
  );
}
