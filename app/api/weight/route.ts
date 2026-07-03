import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { logSilent } from '@/lib/silentLog';

export const dynamic = 'force-dynamic';

const TZ = 'America/Los_Angeles';

function todayLA(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: TZ });
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const historyDays = parseInt(searchParams.get('history') ?? '0', 10);

  const { data: latest } = await supabase
    .from('weight_logs')
    .select('weight_lbs, logged_at')
    .order('logged_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const loggedToday = latest
    ? new Date(latest.logged_at).toLocaleDateString('en-CA', { timeZone: TZ }) === todayLA()
    : false;

  let history: { date: string; weight: number }[] = [];
  if (historyDays > 0) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - historyDays);
    const { data: logs } = await supabase
      .from('weight_logs')
      .select('weight_lbs, logged_at')
      .gte('logged_at', cutoff.toISOString())
      .order('logged_at', { ascending: true });

    // One entry per day — last log of the day wins
    const byDate = new Map<string, number>();
    for (const log of (logs ?? [])) {
      const date = new Date(log.logged_at).toLocaleDateString('en-CA', { timeZone: TZ });
      byDate.set(date, log.weight_lbs);
    }
    history = Array.from(byDate.entries())
      .map(([date, weight]) => ({ date, weight }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  return NextResponse.json({
    latestWeight: latest?.weight_lbs ?? null,
    loggedToday,
    history,
  });
}

export async function POST(req: NextRequest) {
  const { weight_lbs } = await req.json();
  if (typeof weight_lbs !== 'number' || weight_lbs <= 0) {
    return NextResponse.json({ error: 'Invalid weight' }, { status: 400 });
  }

  const { error: insertError } = await supabase
    .from('weight_logs')
    .insert({ weight_lbs });
  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

  // Find weight-type big goal and update it
  const { data: goal } = await supabase
    .from('big_goals')
    .select('id, milestone, count_target')
    .eq('progress_type', 'weight')
    .maybeSingle();

  if (goal) {
    const start    = parseFloat(goal.milestone ?? '0');
    const target   = goal.count_target ?? 0;
    const progress = start > target && start > 0
      ? Math.min(100, Math.max(0, Math.round(((start - weight_lbs) / (start - target)) * 100)))
      : 0;

    await supabase
      .from('big_goals')
      .update({ count_current: weight_lbs, progress })
      .eq('id', goal.id);
  }

  await logSilent(`⚖️ Weight logged: ${weight_lbs} lbs`);

  return NextResponse.json({ ok: true });
}
