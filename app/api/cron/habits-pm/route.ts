import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { sendWithButtons } from '@/lib/discord';
import { verifyCron } from '@/lib/cron';

export const dynamic = 'force-dynamic';

const TZ = 'America/Los_Angeles';

export async function GET(req: NextRequest) {
  if (!verifyCron(req)) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    const today = new Date().toLocaleDateString('en-CA', { timeZone: TZ });

    const [{ data: habits }, { data: logs }] = await Promise.all([
      supabase.from('habits').select('id, name').eq('period', 'PM').is('deleted_at', null),
      supabase.from('habit_logs').select('habit_id').eq('date', today),
    ]);

    const loggedIds = new Set((logs ?? []).map((l: { habit_id: string }) => l.habit_id));
    const pending   = (habits ?? []).filter((h: { id: string; name: string }) => !loggedIds.has(h.id));

    if (pending.length === 0) return NextResponse.json({ ok: true, message: 'All PM habits done' });

    // One tap-to-log button per pending habit (max 5 per action row).
    // PM = red (style 4) to match the /habit overview colour scheme.
    const buttons = pending.map((h: { id: string; name: string }) => ({
      type: 2, style: 4,
      label: `✓ ${h.name}`.slice(0, 80),
      custom_id: `habit_done:${h.id}`,
    }));
    const rows = [];
    for (let i = 0; i < buttons.length; i += 5) {
      rows.push({ type: 1, components: buttons.slice(i, i + 5) });
    }

    await sendWithButtons(`🌙 **PM habits** — ${pending.length} still pending:`, rows);
    return NextResponse.json({ ok: true });
  } catch (err) {
    // Return 200 so Vercel does NOT retry — error is logged for debugging
    console.error('habits-pm cron error:', err);
    return NextResponse.json({ ok: false, error: String(err) });
  }
}
