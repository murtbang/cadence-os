'use client';

import { useEffect, useState } from 'react';
import HabitCard from './HabitCard';
import NextEventCard from './NextEventCard';
import { Habit, HabitLog, CalendarEvent } from '@/types/database';
import { MobileTab } from './MobileTabBar';

interface Props {
  nextEvent: CalendarEvent | null;
  habits: Habit[];
  habitLogs: HabitLog[];
  onToggleHabit: (id: string, date?: string) => Promise<void>;
  onOpenTab: (tab: MobileTab) => void;
}

export default function MobileHome({ nextEvent, habits, habitLogs, onToggleHabit, onOpenTab }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '8px 8px 16px' }}>
      <ClockWeather />

      <Widget height={150}>
        <NextEventCard event={nextEvent} onNavigate={() => onOpenTab('calendar')} />
      </Widget>

      <Widget height={360}>
        <HabitCard
          habits={habits}
          logs={habitLogs}
          onToggle={onToggleHabit}
          onNavigate={() => onOpenTab('habits')}
        />
      </Widget>
    </div>
  );
}

/** Fixed-height frame so the reused full-height cards resolve their layout
 *  while the page itself scrolls. */
function Widget({ height, children }: { height: number; children: React.ReactNode }) {
  return <div style={{ height: `${height}px`, minHeight: `${height}px` }}>{children}</div>;
}

// ── Clock + weather header ──────────────────────────────────────────────────────

interface WeatherState {
  temp: number;
  high: number | null;
  low: number | null;
  condition: string;
}

function ClockWeather() {
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
  const date    = now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: 'America/Los_Angeles' });

  const tempColor = weather
    ? weather.temp < 70 ? '#5AC8FA'
    : weather.temp > 80 ? 'var(--orange)'
    : 'var(--black)'
    : 'var(--gray-4)';

  return (
    <section style={{
      background: 'var(--card)', borderRadius: 'var(--r-lg)',
      boxShadow: 'var(--shadow-sm)', border: '1px solid var(--sep)',
      padding: '16px 18px',
    }}>
      <div style={{ fontSize: '10px', fontWeight: 850, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--gray-3)' }}>
        Now
      </div>

      <div style={{ marginTop: '4px', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <div style={{ fontFamily: 'var(--font-geist-mono), monospace', fontSize: '52px', fontWeight: 450, letterSpacing: '-2px', lineHeight: 1, color: 'var(--black)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
          {timePart}
          <span style={{ fontSize: '18px', fontWeight: 600, marginLeft: '6px', letterSpacing: 0, color: 'var(--gray-3)' }}>{ampm}</span>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontFamily: 'var(--font-geist-mono), monospace', fontSize: '22px', fontWeight: 700, color: tempColor, letterSpacing: '-0.5px', fontVariantNumeric: 'tabular-nums' }}>
            {weather ? `${weather.temp}°` : '--°'}
          </div>
          {weather && (
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--gray-3)', marginTop: '2px' }}>
              H{weather.high ?? '--'}° &nbsp;L{weather.low ?? '--'}°
            </div>
          )}
        </div>
      </div>

      <div style={{ marginTop: '10px', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <div>
          <div style={{ color: 'var(--gray-1)', fontSize: '15px', fontWeight: 750 }}>{weekday}</div>
          <div style={{ color: 'var(--gray-3)', fontSize: '12px', fontWeight: 600 }}>{date}</div>
        </div>
        <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--gray-2)' }}>{weather?.condition ?? ''}</span>
      </div>
    </section>
  );
}
