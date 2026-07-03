import { NextRequest, NextResponse } from 'next/server';
import { runCalendarAlerts } from '@/lib/calendarAlerts';
import { verifyCron } from '@/lib/cron';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  if (!verifyCron(req)) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    const result = await runCalendarAlerts(true); // send = true
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error('calendar-alert error:', err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
