import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { logSilent } from '@/lib/silentLog';

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json();
  const allowed: Record<string, unknown> = {};
  if (typeof body.progress        === 'number') allowed.progress        = Math.min(100, Math.max(0, body.progress));
  if (typeof body.milestone       === 'string') allowed.milestone       = body.milestone;
  if (typeof body.title           === 'string') allowed.title           = body.title;
  if (typeof body.order           === 'number') allowed.order           = body.order;
  if (typeof body.progress_type   === 'string') allowed.progress_type   = body.progress_type;
  if (typeof body.count_current   === 'number') allowed.count_current   = body.count_current;
  if (typeof body.count_target    === 'number') allowed.count_target    = body.count_target;
  if (Array.isArray(body.milestones))           allowed.milestones      = body.milestones;
  if (typeof body.milestone_index === 'number') allowed.milestone_index = body.milestone_index;

  const { data, error } = await supabase
    .from('big_goals')
    .update(allowed)
    .eq('id', params.id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const { data: goal } = await supabase
    .from('big_goals')
    .select('title')
    .eq('id', params.id)
    .maybeSingle();

  const { error } = await supabase.from('big_goals').delete().eq('id', params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logSilent(`🗑️ Deleted goal '${goal?.title ?? params.id}'`);
  return NextResponse.json({ ok: true });
}
