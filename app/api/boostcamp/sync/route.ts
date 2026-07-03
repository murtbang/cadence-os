import { NextResponse } from 'next/server';
import { triggerBoostcampSync } from '@/lib/boostcampSync';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // allow time for a Railway cold start (scale-to-zero)

// Manual "Pull now" from the dashboard (session-authenticated via middleware).
export async function POST() {
  const r = await triggerBoostcampSync();
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ status: r.status });
}
