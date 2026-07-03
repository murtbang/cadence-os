import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { logSilent } from '@/lib/silentLog';

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const { data: habit } = await supabase.from('habits').select('name, period').eq('id', params.id).single();

  // Soft delete — preserve logs and allow restore
  const { error } = await supabase
    .from('habits')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (habit) {
    logSilent(`Archived habit "${habit.name}" (${habit.period})`).catch(() => {});
  }

  return NextResponse.json({ deleted: true });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json();
  const { error } = await supabase.from('habits').update(body).eq('id', params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ updated: true });
}
