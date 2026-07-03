import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { verifyParams } from '@/lib/cron';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const uid  = searchParams.get('uid');
  const date = searchParams.get('date');
  const sig  = searchParams.get('sig') ?? '';

  if (!uid || !date) {
    return new NextResponse(html('Missing parameters', false), {
      status: 400, headers: { 'Content-Type': 'text/html' },
    });
  }

  // This endpoint is public (clicked from Discord on any device), so validate
  // the date shape and the HMAC signature — otherwise anyone could forge a
  // dismissal for an arbitrary event UID.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return new NextResponse(html('Invalid request.', false), {
      status: 400, headers: { 'Content-Type': 'text/html' },
    });
  }
  if (!verifyParams(`${uid}|${date}`, sig)) {
    return new NextResponse(html('This link is invalid or has expired.', false), {
      status: 403, headers: { 'Content-Type': 'text/html' },
    });
  }

  try {
    await supabase
      .from('dismissed_reminders')
      .upsert({ event_uid: uid, event_date: date }, { onConflict: 'event_uid,event_date' });

    return new NextResponse(html('Reminder dismissed — no more alerts for this event today.', true), {
      status: 200, headers: { 'Content-Type': 'text/html' },
    });
  } catch (err) {
    console.error('dismiss-reminder error:', err);
    return new NextResponse(html('Something went wrong. Try again.', false), {
      status: 500, headers: { 'Content-Type': 'text/html' },
    });
  }
}

function html(message: string, ok: boolean) {
  const icon  = ok ? '✓' : '✗';
  const color = ok ? '#34C759' : '#FF3B30';
  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Cadence</title>
<style>
  body { margin:0; min-height:100dvh; display:flex; align-items:center; justify-content:center;
         font-family:-apple-system,sans-serif; background:#12151c; color:#e8eaf0; }
  .card { text-align:center; padding:40px 32px; }
  .icon { font-size:48px; margin-bottom:16px; color:${color}; }
  .msg  { font-size:15px; font-weight:600; color:#8a8f9a; max-width:260px; line-height:1.5; }
</style></head><body>
<div class="card">
  <div class="icon">${icon}</div>
  <div class="msg">${message}</div>
</div></body></html>`;
}
