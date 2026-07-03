import { Suspense } from 'react';

const WMO_ICONS: Record<number, string> = {
  0: '☀️', 1: '🌤️', 2: '⛅', 3: '☁️',
  45: '🌫️', 48: '🌫️',
  51: '🌦️', 53: '🌦️', 55: '🌦️',
  61: '🌧️', 63: '🌧️', 65: '🌧️',
  71: '🌨️', 73: '🌨️', 75: '🌨️',
  80: '🌦️', 81: '🌧️', 82: '🌧️',
  95: '⛈️', 96: '⛈️', 99: '⛈️',
};

interface WeatherData {
  current: { temperature_2m: number; weather_code: number };
  daily: { time: string[]; temperature_2m_max: number[]; weather_code: number[] };
}

async function fetchWeather(): Promise<WeatherData> {
  const res = await fetch(
    'https://api.open-meteo.com/v1/forecast?latitude=34.1064&longitude=-117.5931&current=temperature_2m,weather_code&daily=temperature_2m_max,weather_code&temperature_unit=fahrenheit&forecast_days=4&timezone=America%2FLos_Angeles',
    { next: { revalidate: 1800 } }
  );
  if (!res.ok) throw new Error('Weather fetch failed');
  return res.json();
}

function toF(c: number) { return Math.round(c); }
const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

async function WeatherContent() {
  let data: WeatherData;
  try { data = await fetchWeather(); }
  catch { return <span style={{ fontSize: '12px', color: 'var(--gray-3)' }}>Weather unavailable</span>; }

  const icon = WMO_ICONS[data.current.weather_code] ?? '🌡️';
  const temp = toF(data.current.temperature_2m);
  const forecast = data.daily.time.slice(1, 4).map((dateStr, i) => {
    const d = new Date(dateStr + 'T00:00:00');
    return { day: DAYS[d.getDay()], temp: toF(data.daily.temperature_2m_max[i + 1]) };
  });

  return (
    <div style={{
      background: 'var(--card)',
      borderRadius: 'var(--r-pill)',
      padding: '4px 12px',
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      boxShadow: 'var(--shadow-sm)',
      height: '28px',
    }}>
      <span style={{ fontSize: '14px', lineHeight: 1 }}>{icon}</span>
      <span style={{ fontSize: '14px', fontWeight: 500, letterSpacing: '-0.3px', lineHeight: 1 }}>{temp}°</span>
      <div style={{ width: '0.5px', height: '16px', background: 'var(--gray-5)' }} />
      <div style={{ display: 'flex', gap: '10px' }}>
        {forecast.map(f => (
          <div key={f.day} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '8px', fontWeight: 600, color: 'var(--gray-4)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{f.day}</div>
            <div style={{ fontSize: '11px', fontWeight: 500, color: 'var(--gray-1)' }}>{f.temp}°</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function WeatherPill() {
  return (
    <Suspense fallback={
      <div style={{ background: 'var(--card)', borderRadius: 'var(--r-pill)', padding: '4px 12px', height: '28px', display: 'flex', alignItems: 'center', boxShadow: 'var(--shadow-sm)', color: 'var(--gray-4)', fontSize: '12px' }}>
        Loading…
      </div>
    }>
      <WeatherContent />
    </Suspense>
  );
}
