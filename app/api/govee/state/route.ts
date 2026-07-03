import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const BASE = 'https://developer-api.govee.com/v1';

function goveeHeaders() {
  return {
    'Govee-API-Key': process.env.GOVEE_API_KEY ?? '',
    'Content-Type':  'application/json',
  };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const device = searchParams.get('device');
  const model  = searchParams.get('model');

  if (!device || !model) {
    return NextResponse.json({ error: 'device and model required' }, { status: 400 });
  }

  try {
    const res = await fetch(
      `${BASE}/devices/state?device=${encodeURIComponent(device)}&model=${encodeURIComponent(model)}`,
      { headers: goveeHeaders(), cache: 'no-store' },
    );
    const json = await res.json();
    if (!res.ok) return NextResponse.json({ error: json.message ?? 'Govee error' }, { status: res.status });

    // Flatten the properties array into a single object
    const props: Record<string, unknown> = {};
    for (const p of json.data?.properties ?? []) {
      Object.assign(props, p);
    }

    return NextResponse.json({
      device,
      model,
      online:     props.online     ?? false,
      powerState: props.powerState ?? 'off',
      brightness: props.brightness ?? 100,
      color:      props.color      ?? { r: 255, g: 255, b: 255 },
      colorTem:   props.colorTem   ?? 0,
    });
  } catch (err) {
    console.error('govee state error:', err);
    return NextResponse.json({ error: 'Failed to fetch state' }, { status: 500 });
  }
}
