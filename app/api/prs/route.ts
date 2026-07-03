import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { logSilent } from '@/lib/silentLog';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { data, error } = await supabase
    .from('prs')
    .select('*')
    .order('achieved_at', { ascending: false });

  // The `prs` table may not exist yet (before db/prs.sql is run) — fail soft so
  // the Training view just shows an empty PR list instead of erroring.
  if (error) {
    console.error('prs GET error:', error.message);
    return NextResponse.json([]);
  }
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));

  const exercise   = typeof body.exercise === 'string' ? body.exercise.trim() : '';
  const weight_lbs = Number(body.weight_lbs);
  const reps       = body.reps == null ? 1 : Number(body.reps);

  if (!exercise) return NextResponse.json({ error: 'Exercise is required' }, { status: 400 });
  if (!Number.isFinite(weight_lbs) || weight_lbs <= 0) return NextResponse.json({ error: 'Invalid weight' }, { status: 400 });
  if (!Number.isInteger(reps) || reps <= 0) return NextResponse.json({ error: 'Invalid reps' }, { status: 400 });

  const row: Record<string, unknown> = { exercise, weight_lbs, reps };
  if (typeof body.note === 'string' && body.note.trim()) row.note = body.note.trim();
  if (typeof body.achieved_at === 'string' && body.achieved_at) row.achieved_at = body.achieved_at;

  const { data, error } = await supabase.from('prs').insert(row).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logSilent(`🏋️ PR logged: ${exercise} ${weight_lbs}×${reps}`);
  return NextResponse.json(data);
}
