import { NextRequest, NextResponse } from 'next/server';
import { verifyCron } from '@/lib/cron';
import { triggerBoostcampSync } from '@/lib/boostcampSync';
import { sendWebhook } from '@/lib/discord';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Railway may be asleep — this request wakes it

// Scheduled Boostcamp pull. Vercel cron hits this 3x/day (see vercel.json); the
// request wakes the (scale-to-zero) Railway service, which runs the pull.
export async function GET(req: NextRequest) {
  if (!verifyCron(req)) return new NextResponse('Unauthorized', { status: 401 });

  const r = await triggerBoostcampSync();
  if (!r.ok) {
    // Make the failure loud instead of silently returning JSON nobody reads —
    // this is the alert that surfaces a down/misconfigured Railway service.
    try { await sendWebhook(`⚠️ **Boostcamp pull failed to trigger** — ${r.error}`); } catch { /* ignore */ }
    return NextResponse.json({ error: r.error }, { status: r.status });
  }
  return NextResponse.json({ ok: true, status: r.status });
}
