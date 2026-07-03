import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// weather.gov asks for an identifying User-Agent. Personalize if you like.
const HEADERS = { 'User-Agent': '(Cadence, self-hosted dashboard)' };

// Your location. Find yours at https://www.latlong.net (defaults: Rancho Cucamonga, CA).
const LAT = Number(process.env.WEATHER_LAT ?? 34.10056);
const LON = Number(process.env.WEATHER_LON ?? -117.49222);

export interface DayForecast {
  dayName:   string;        // "Mon", "Tue", …
  date:      string;        // YYYY-MM-DD (LA)
  high:      number | null;
  low:       number | null;
  condition: string;        // daytime short forecast
  precipPct: number | null; // 0-100
  wind:      string | null; // "10 mph"
}

export async function GET() {
  try {
    const pointsRes = await fetch(`https://api.weather.gov/points/${LAT},${LON}`, { headers: HEADERS });
    if (!pointsRes.ok) throw new Error(`Points lookup failed: ${pointsRes.status}`);
    const points = await pointsRes.json();

    const [hourlyRes, dailyRes] = await Promise.all([
      fetch(points.properties.forecastHourly, { headers: HEADERS }),
      fetch(points.properties.forecast,       { headers: HEADERS }),
    ]);
    if (!hourlyRes.ok || !dailyRes.ok) throw new Error('Forecast fetch failed');

    const [hourly, daily] = await Promise.all([hourlyRes.json(), dailyRes.json()]);

    const current     = hourly.properties.periods[0];
    const allPeriods  = daily.properties.periods as {
      temperature: number;
      isDaytime: boolean;
      startTime: string;
      shortForecast: string;
      windSpeed: string;
      windDirection: string;
      probabilityOfPrecipitation?: { value: number | null };
    }[];

    // Today's H/L from daily periods
    const highPeriod = allPeriods.find(p => p.isDaytime);
    const lowPeriod  = allPeriods.find(p => !p.isDaytime);

    // Build 7-day forecast by pairing consecutive day/night periods
    const weekly: DayForecast[] = [];
    let i = 0;
    // If the first period is nighttime (after ~6 PM), skip it
    if (!allPeriods[0]?.isDaytime) i = 1;

    while (i < allPeriods.length && weekly.length < 7) {
      const day   = allPeriods[i];
      const night = allPeriods[i + 1];
      if (!day?.isDaytime) { i++; continue; }

      const d = new Date(day.startTime);
      weekly.push({
        dayName:   d.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'America/Los_Angeles' }),
        date:      d.toLocaleDateString('en-CA',  { timeZone: 'America/Los_Angeles' }),
        high:      day.temperature,
        low:       night?.temperature ?? null,
        condition: day.shortForecast,
        precipPct: day.probabilityOfPrecipitation?.value ?? null,
        wind:      day.windSpeed ?? null,
      });
      i += 2;
    }

    return NextResponse.json({
      // Current conditions (used by dashboard card)
      temp:      current.temperature,
      condition: current.shortForecast,
      high:      highPeriod?.temperature ?? null,
      low:       lowPeriod?.temperature  ?? null,
      wind:      current.windSpeed ?? null,
      windDir:   current.windDirection ?? null,
      // 7-day forecast (used by WeatherView)
      weekly,
    });
  } catch (err) {
    console.error('Weather error:', err);
    return NextResponse.json({ error: 'Weather unavailable' }, { status: 500 });
  }
}
