'use client';

import { useEffect, useState } from 'react';
import type { DayForecast } from '@/app/api/weather/route';

interface WeatherState {
  temp:      number;
  high:      number | null;
  low:       number | null;
  condition: string;
  wind:      string | null;
  windDir:   string | null;
  weekly:    DayForecast[];
}

function iconType(condition: string): string {
  const c = condition.toLowerCase();
  if (c.includes('thunder'))                                               return 'Thunderstorm';
  if (c.includes('snow') || c.includes('flurr'))                          return 'Snow';
  if (c.includes('rain') || c.includes('shower') || c.includes('drizzle')) return 'Rain';
  if (c.includes('fog'))                                                   return 'Foggy';
  if (c.includes('partly') || c.includes('mostly cloudy'))                return 'Partly Cloudy';
  if (c.includes('cloud') || c.includes('overcast'))                      return 'Cloudy';
  return 'Clear';
}

function WeatherIcon({ condition, size = 64 }: { condition: string; size?: number }) {
  const type   = iconType(condition);
  const common = {
    width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
    stroke: 'currentColor', strokeWidth: 1.5,
    strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
  };
  if (type === 'Clear')         return <svg {...common}><circle cx="12" cy="12" r="4" /><path d="M12 2v2" /><path d="M12 20v2" /><path d="M4.93 4.93l1.41 1.41" /><path d="M17.66 17.66l1.41 1.41" /><path d="M2 12h2" /><path d="M20 12h2" /><path d="M4.93 19.07l1.41-1.41" /><path d="M17.66 6.34l1.41-1.41" /></svg>;
  if (type === 'Partly Cloudy') return <svg {...common}><path d="M12 3a6 6 0 0 1 4.33 10.18" /><path d="M20 17.5a3.5 3.5 0 0 0-3.5-3.5H15a5 5 0 1 0-5 5h8.5" /></svg>;
  if (type === 'Cloudy')        return <svg {...common}><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" /></svg>;
  if (type === 'Foggy')         return <svg {...common}><path d="M3 8h18" /><path d="M3 12h18" /><path d="M3 16h18" /></svg>;
  if (type === 'Rain')          return <svg {...common}><path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" /><path d="M8 19v1" /><path d="M8 14v1" /><path d="M16 19v1" /><path d="M16 14v1" /><path d="M12 21v1" /><path d="M12 16v1" /></svg>;
  if (type === 'Snow')          return <svg {...common}><path d="M12 2v20" /><path d="m4.93 4.93 14.14 14.14" /><path d="M2 12h20" /><path d="m19.07 4.93-14.14 14.14" /><circle cx="12" cy="12" r="2" /></svg>;
  if (type === 'Thunderstorm')  return <svg {...common}><path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" /><path d="M16 14 12 20l-1-5H8l4-7 1 5h3Z" /></svg>;
  return <svg {...common}><circle cx="12" cy="12" r="9" /></svg>;
}

/** Mini horizontal bar showing high/low range relative to the week's min/max */
function TempBar({ high, low, weekMin, weekMax }: { high: number | null; low: number | null; weekMin: number; weekMax: number }) {
  if (high == null || low == null) return <div style={{ height: '4px' }} />;
  const range = Math.max(weekMax - weekMin, 1);
  const leftPct  = ((low  - weekMin) / range) * 100;
  const widthPct = ((high - low)     / range) * 100;
  return (
    <div style={{ position: 'relative', height: '4px', borderRadius: '2px', background: 'var(--gray-6)', width: '100%' }}>
      <div style={{
        position: 'absolute', top: 0, height: '4px', borderRadius: '2px',
        left:  `${leftPct}%`,
        width: `${Math.max(widthPct, 8)}%`,
        background: 'linear-gradient(to right, #5AC8FA, var(--orange))',
      }} />
    </div>
  );
}

function tempColor(t: number): string {
  if (t < 70) return '#5AC8FA';
  if (t > 80) return 'var(--orange)';
  return 'var(--black)';
}

export default function WeatherView() {
  const [weather, setWeather] = useState<WeatherState | null>(null);

  useEffect(() => {
    fetch('/api/weather')
      .then(r => r.json())
      .then(d => { if (!d.error) setWeather(d); })
      .catch(() => {});
  }, []);

  const weekly   = weather?.weekly ?? [];
  const allHighs = weekly.map(d => d.high).filter((x): x is number => x != null);
  const allLows  = weekly.map(d => d.low).filter((x):  x is number => x != null);
  const weekMin  = allLows.length  ? Math.min(...allLows)  : 60;
  const weekMax  = allHighs.length ? Math.max(...allHighs) : 90;

  const curColor = weather ? tempColor(weather.temp) : 'var(--gray-4)';

  return (
    <div style={{
      height: '100%', display: 'flex', flexDirection: 'column',
      background: 'var(--card)', borderRadius: 'var(--r-lg)',
      boxShadow: 'var(--shadow)', border: '1px solid var(--sep)',
      padding: '18px 20px', boxSizing: 'border-box', overflow: 'hidden',
    }}>

      {/* ── Header ─────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexShrink: 0, marginBottom: '16px' }}>
        <div style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--gray-4)' }}>
          Weather
        </div>
        <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--gray-3)' }}>
          Your City
        </div>
      </div>

      {/* ── Current conditions ──────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexShrink: 0, marginBottom: '16px' }}>

        {/* Icon */}
        <div style={{ color: curColor, flexShrink: 0 }}>
          {weather
            ? <WeatherIcon condition={weather.condition} size={52} />
            : <div style={{ width: 52, height: 52 }} />}
        </div>

        {/* Temp + condition */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: 'var(--font-geist-mono), monospace',
            fontSize: '72px', fontWeight: 300, letterSpacing: '-4px', lineHeight: 1,
            color: curColor, fontVariantNumeric: 'tabular-nums',
          }}>
            {weather ? `${weather.temp}°` : '--°'}
          </div>
          <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--gray-2)', marginTop: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {weather?.condition ?? '—'}
          </div>
        </div>

        {/* H / L + wind */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px', flexShrink: 0 }}>
          <div style={{ display: 'flex', gap: '12px', fontFamily: 'var(--font-geist-mono), monospace', fontSize: '14px', fontWeight: 700 }}>
            <span style={{ color: 'var(--orange)' }}>H {weather?.high ?? '--'}°</span>
            <span style={{ color: '#5AC8FA' }}>L {weather?.low ?? '--'}°</span>
          </div>
          {weather?.wind && (
            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--gray-3)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17.7 7.7a2.5 2.5 0 1 1 1.8 4.3H2" />
                <path d="M9.6 4.6A2 2 0 1 1 11 8H2" />
                <path d="M12.6 19.4A2 2 0 1 0 14 16H2" />
              </svg>
              {weather.wind}{weather.windDir ? ` ${weather.windDir}` : ''}
            </div>
          )}
        </div>
      </div>

      {/* ── Divider ─────────────────────────────────────────────────── */}
      <div style={{ height: '1px', background: 'var(--sep)', flexShrink: 0, marginBottom: '14px' }} />

      {/* ── 7-day forecast ──────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--gray-4)', marginBottom: '10px', flexShrink: 0 }}>
          7-Day Forecast
        </div>

        {weekly.length === 0 ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ fontSize: '12px', color: 'var(--gray-4)' }}>Loading…</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${weekly.length}, 1fr)`, gap: '4px', flex: 1, alignItems: 'start' }}>
            {weekly.map((day, i) => {
              const hc = day.high != null ? tempColor(day.high) : 'var(--gray-4)';
              const rainy = (day.precipPct ?? 0) >= 30;
              return (
                <div key={i} style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px',
                  padding: '8px 4px', borderRadius: 'var(--r-md)',
                  background: i === 0 ? 'var(--gray-6)' : 'transparent',
                }}>
                  {/* Day name */}
                  <div style={{ fontSize: '10px', fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase', color: i === 0 ? 'var(--blue)' : 'var(--gray-3)' }}>
                    {i === 0 ? 'Today' : day.dayName}
                  </div>

                  {/* Icon */}
                  <div style={{ color: hc }}>
                    <WeatherIcon condition={day.condition} size={20} />
                  </div>

                  {/* High */}
                  <div style={{ fontFamily: 'var(--font-geist-mono), monospace', fontSize: '13px', fontWeight: 700, color: hc, letterSpacing: '-0.5px' }}>
                    {day.high != null ? `${day.high}°` : '--'}
                  </div>

                  {/* Temp range bar */}
                  <TempBar high={day.high} low={day.low} weekMin={weekMin} weekMax={weekMax} />

                  {/* Low */}
                  <div style={{ fontFamily: 'var(--font-geist-mono), monospace', fontSize: '11px', fontWeight: 600, color: 'var(--gray-4)', letterSpacing: '-0.5px' }}>
                    {day.low != null ? `${day.low}°` : '--'}
                  </div>

                  {/* Precip % */}
                  {day.precipPct != null && day.precipPct > 0 ? (
                    <div style={{ fontSize: '10px', fontWeight: 700, color: rainy ? '#5AC8FA' : 'var(--gray-4)', display: 'flex', alignItems: 'center', gap: '2px' }}>
                      <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M12 2C6 10 4 14 4 17a8 8 0 0 0 16 0c0-3-2-7-8-15Z"/></svg>
                      {day.precipPct}%
                    </div>
                  ) : (
                    <div style={{ height: '14px' }} />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
