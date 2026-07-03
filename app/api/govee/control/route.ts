import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const BASE = 'https://developer-api.govee.com/v1';

function goveeHeaders() {
  return {
    'Govee-API-Key': process.env.GOVEE_API_KEY ?? '',
    'Content-Type':  'application/json',
  };
}

export interface ControlCmd {
  device: string;
  model:  string;
  cmd: {
    name:  'turn' | 'brightness' | 'color' | 'colorTem';
    value: string | number | { r: number; g: number; b: number };
  };
}

export async function POST(req: NextRequest) {
  try {
    const body: ControlCmd = await req.json();
    const { device, model, cmd } = body;

    if (!device || !model || !cmd?.name) {
      return NextResponse.json({ error: 'device, model and cmd required' }, { status: 400 });
    }

    const res = await fetch(`${BASE}/devices/control`, {
      method:  'PUT',
      headers: goveeHeaders(),
      body:    JSON.stringify({ device, model, cmd }),
    });
    const json = await res.json();

    if (!res.ok) return NextResponse.json({ error: json.message ?? 'Govee error' }, { status: res.status });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('govee control error:', err);
    return NextResponse.json({ error: 'Failed to send command' }, { status: 500 });
  }
}
