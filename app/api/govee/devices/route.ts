import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const BASE = 'https://developer-api.govee.com/v1';

function goveeHeaders() {
  return {
    'Govee-API-Key': process.env.GOVEE_API_KEY ?? '',
    'Content-Type':  'application/json',
  };
}

export async function GET() {
  try {
    const res = await fetch(`${BASE}/devices`, {
      headers: goveeHeaders(),
      cache: 'no-store',
    });
    const json = await res.json();
    if (!res.ok) return NextResponse.json({ error: json.message ?? 'Govee error' }, { status: res.status });
    return NextResponse.json(json.data?.devices ?? []);
  } catch (err) {
    console.error('govee devices error:', err);
    return NextResponse.json({ error: 'Failed to fetch devices' }, { status: 500 });
  }
}
