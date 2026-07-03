'use client';

import { useEffect, useState } from 'react';
import HabitCard from './HabitCard';
import NextEventCard from './NextEventCard';
import RecentBodyMapCard from './RecentBodyMapCard';
import BigGoalsCard from './BigGoalsCard';
import FlipCard from './FlipCard';
import DeadliftReminderFace from './DeadliftReminderFace';
import { NextEventTomorrowFace, NextEventWeekFace, NextTodoFace, HabitStreaksFace, TrainingStatsFace, GoalsQuoteFace } from './FlipFaces';
import { Habit, HabitLog, Todo, CalendarEvent } from '@/types/database';

const GAP = '6px';

interface Props {
  habits: Habit[];
  habitLogs: HabitLog[];
  todos: Todo[];
  events: CalendarEvent[];
  nextEvent: CalendarEvent | null;
  onToggleHabit: (id: string, date?: string) => Promise<void>;
  onAddHabit: (name: string, period: 'AM' | 'PM', emoji?: string) => Promise<void>;
  onDeleteHabit: (id: string) => Promise<void>;
  onToggleTodo: (id: string, completed: boolean) => Promise<void>;
  onReorderTodo: (id: string, order: number) => Promise<void>;
  onAddTodo: (text: string, priority: 'high' | 'low') => Promise<void>;
  onDeleteTodo: (id: string) => Promise<void>;
  onNavigate: (view: string) => void;
}

interface WeatherState {
  temp: number;
  high: number | null;
  low: number | null;
  condition: string;
}

function iconType(condition: string): string {
  const c = condition.toLowerCase();
  if (c.includes('thunder'))                                              return 'Thunderstorm';
  if (c.includes('snow') || c.includes('flurr'))                         return 'Snow';
  if (c.includes('rain') || c.includes('shower') || c.includes('drizzle')) return 'Rain';
  if (c.includes('fog'))                                                  return 'Foggy';
  if (c.includes('partly') || c.includes('mostly cloudy'))               return 'Partly Cloudy';
  if (c.includes('cloud') || c.includes('overcast'))                     return 'Cloudy';
  return 'Clear';
}

function WeatherIcon({ condition, size = 14 }: { condition: string; size?: number }) {
  const type   = iconType(condition);
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  if (type === 'Clear')         return <svg {...common}><circle cx="12" cy="12" r="4" /><path d="M12 2v2" /><path d="M12 20v2" /><path d="M4.93 4.93l1.41 1.41" /><path d="M17.66 17.66l1.41 1.41" /><path d="M2 12h2" /><path d="M20 12h2" /><path d="M4.93 19.07l1.41-1.41" /><path d="M17.66 6.34l1.41-1.41" /></svg>;
  if (type === 'Partly Cloudy') return <svg {...common}><path d="M12 3a6 6 0 0 1 4.33 10.18" /><path d="M20 17.5a3.5 3.5 0 0 0-3.5-3.5H15a5 5 0 1 0-5 5h8.5" /></svg>;
  if (type === 'Cloudy')        return <svg {...common}><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" /></svg>;
  if (type === 'Foggy')         return <svg {...common}><path d="M3 8h18" /><path d="M3 12h18" /><path d="M3 16h18" /></svg>;
  if (type === 'Rain')          return <svg {...common}><path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" /><path d="M8 19v1" /><path d="M8 14v1" /><path d="M16 19v1" /><path d="M16 14v1" /><path d="M12 21v1" /><path d="M12 16v1" /></svg>;
  if (type === 'Snow')          return <svg {...common}><path d="M12 2v20" /><path d="m4.93 4.93 14.14 14.14" /><path d="M2 12h20" /><path d="m19.07 4.93-14.14 14.14" /><circle cx="12" cy="12" r="2" /></svg>;
  if (type === 'Thunderstorm')  return <svg {...common}><path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" /><path d="M16 14 12 20l-1-5H8l4-7 1 5h3Z" /></svg>;
  return <svg {...common}><circle cx="12" cy="12" r="9" /></svg>;
}

export default function DashboardGrid(props: Props) {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
  const dueTodos = [...props.todos]
    .filter(t => !t.completed && t.due_date)
    .sort((a, b) => (a.due_date! < b.due_date! ? -1 : a.due_date! > b.due_date! ? 1 : 0));
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1fr 1.25fr',
      gap: GAP,
      padding: '4px',
      height: '100%',
      width: '100%',
      boxSizing: 'border-box',
    }}>
      {/* Left col */}
      <div style={{ display: 'grid', gridTemplateRows: '1fr 1fr', gap: GAP, minHeight: 0 }}>
        {/* Top: Clock+Weather | NextEvent */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: GAP, minHeight: 0 }}>
          <TimeDateWeatherPanel onNavigate={() => props.onNavigate('weather')} />
          <FlipCard faces={[
            <NextEventCard key="today" event={props.nextEvent} onNavigate={() => props.onNavigate('calendar')} />,
            <NextTodoFace key="todo" dueTodos={dueTodos} />,
            <NextEventTomorrowFace key="tomorrow" />,
            <NextEventWeekFace key="week" />,
          ]} />
        </div>
        {/* Bottom: Training spans full width */}
        <FlipCard faces={[
          <RecentBodyMapCard key="workout" onNavigate={() => props.onNavigate('training')} />,
          <DeadliftReminderFace key="deadlift" onNavigate={() => props.onNavigate('training')} />,
          <TrainingStatsFace key="stats" />,
        ]} />
      </div>

      {/* Right col: Habits top, Goals bottom */}
      <div style={{ display: 'grid', gridTemplateRows: '1fr 1fr', gap: GAP, minHeight: 0 }}>
        <FlipCard faces={[
          <HabitCard key="today" habits={props.habits} logs={props.habitLogs} onToggle={props.onToggleHabit} onNavigate={() => props.onNavigate('habits')} />,
          <HabitStreaksFace key="streaks" habits={props.habits} logs={props.habitLogs} />,
        ]} />
        <FlipCard faces={[
          <BigGoalsCard key="goals" onNavigate={() => props.onNavigate('goals')} />,
          <GoalsQuoteFace key="quote" />,
        ]} />
      </div>
    </div>
  );
}

// ── Merged Clock + Weather panel ──────────────────────────────────────────────

function TimeDateWeatherPanel({ onNavigate }: { onNavigate: () => void }) {
  const [now, setNow] = useState(new Date());
  const [weather, setWeather] = useState<WeatherState | null>(null);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    fetch('/api/weather')
      .then(r => r.json())
      .then(d => { if (!d.error) setWeather(d); })
      .catch(() => {});
  }, []);

  const timeRaw = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'America/Los_Angeles' });
  const [timePart, ampm] = timeRaw.split(' ');
  const weekday = now.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'America/Los_Angeles' });
  const date    = now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'America/Los_Angeles' });

  const tempColor = weather
    ? weather.temp < 70 ? '#5AC8FA'
    : weather.temp > 80 ? 'var(--orange)'
    : 'var(--black)'
    : 'var(--gray-4)';

  return (
    <section style={{
      background: 'var(--card)', borderRadius: 'var(--r-lg)',
      boxShadow: 'var(--shadow)', border: '1px solid var(--sep)',
      padding: '14px 16px', display: 'flex', flexDirection: 'column',
      justifyContent: 'space-between', minHeight: 0, position: 'relative',
    }}>
      <span onClick={onNavigate} style={{ position: 'absolute', top: 0, right: 0, minWidth: '44px', minHeight: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', opacity: 0.5, cursor: 'pointer', WebkitTapHighlightColor: 'transparent', zIndex: 1 }}>↗</span>
      {/* Row 1: NOW label */}
      <div style={{ fontSize: '10px', fontWeight: 850, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--gray-3)' }}>
        Now
      </div>

      {/* Row 2: Big time — centered, spread across card */}
      <div style={{ textAlign: 'center', fontFamily: 'var(--font-geist-mono), monospace', fontSize: '46px', fontWeight: 450, letterSpacing: '-2px', lineHeight: 1, color: 'var(--black)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
        {timePart}<span style={{ fontSize: '16px', fontWeight: 600, marginLeft: '5px', letterSpacing: '0', verticalAlign: 'middle', color: 'var(--gray-3)' }}>{ampm}</span>
      </div>

      {/* Row 3: Condition | temp */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
        {weather && <WeatherIcon condition={weather.condition} size={15} />}
        <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--gray-2)' }}>
          {weather?.condition ?? '—'}
        </span>
        <span style={{ fontSize: '13px', fontWeight: 400, color: 'var(--gray-4)' }}>|</span>
        <span style={{ fontFamily: 'var(--font-geist-mono), monospace', fontSize: '15px', fontWeight: 700, color: tempColor, letterSpacing: '-0.5px', fontVariantNumeric: 'tabular-nums' }}>
          {weather ? `${weather.temp}°` : '--°'}
        </span>
      </div>

      {/* Row 4: Weekday + H/L */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: '5%' }}>
        <div>
          <div style={{ color: 'var(--gray-2)', fontSize: '13px', fontWeight: 750 }}>{weekday}</div>
          <div style={{ color: 'var(--gray-3)', fontSize: '11px', fontWeight: 600 }}>{date}</div>
        </div>
        {weather && (
          <div style={{ display: 'flex', gap: '6px', fontFamily: 'var(--font-geist-mono), monospace', fontSize: '12px', fontWeight: 700 }}>
            <span style={{ color: 'var(--gray-2)' }}>H{weather.high ?? '--'}°</span>
            <span style={{ color: 'var(--gray-4)' }}>L{weather.low ?? '--'}°</span>
          </div>
        )}
      </div>
    </section>
  );
}
