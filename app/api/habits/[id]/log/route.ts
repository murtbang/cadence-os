import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { logSilent } from '@/lib/silentLog';

export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => ({}));
  const type: 'done' | 'skip' = body.type === 'skip' ? 'skip' : 'done';

  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
  const date: string = body.date ?? today;

  // Block future dates
  if (date > today) {
    return NextResponse.json({ error: 'Cannot log future dates' }, { status: 400 });
  }

  // Check for an existing log on that date
  const { data: existing, error: checkError } = await supabase
    .from('habit_logs')
    .select('id, type')
    .eq('habit_id', params.id)
    .eq('date', date)
    .maybeSingle();

  if (checkError) {
    console.error('habit_log check error:', checkError.message);
    return NextResponse.json({ error: checkError.message }, { status: 500 });
  }

  if (existing) {
    if (existing.type === type) {
      // Same type → toggle off (delete)
      await supabase.from('habit_logs').delete().eq('id', existing.id);
      return NextResponse.json({ logged: false });
    }
    // Different type → switch (done↔skip)
    const { error: updErr } = await supabase
      .from('habit_logs')
      .update({ type })
      .eq('id', existing.id);
    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });
    return NextResponse.json({ logged: true, type });
  }

  // No existing log → insert
  const { data, error } = await supabase
    .from('habit_logs')
    .insert({ habit_id: params.id, date, type })
    .select('id, habit_id, date, type')
    .single();

  if (error) {
    console.error('habit_log insert error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Fire-and-forget silent log only for done entries logged today
  if (type === 'done' && date === today) {
    const { data: habit } = await supabase.from('habits').select('name, period').eq('id', params.id).single();
    logSilent(`✅ ${habit?.name ?? 'Habit'} logged (${habit?.period ?? ''})`).catch(() => {});
  }

  return NextResponse.json({ logged: true, log: data });
}
