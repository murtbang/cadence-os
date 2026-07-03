import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { logSilent } from '@/lib/silentLog';

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json();

  // Log completion silently (only on complete, not uncomplete)
  if (body.completed === true) {
    const { data: todo } = await supabase.from('todos').select('text, priority').eq('id', params.id).single();
    if (todo) {
      await logSilent(`Completed "${todo.text}" (${todo.priority} priority)`);
    }
  }

  const { error } = await supabase.from('todos').update(body).eq('id', params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ updated: true });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  // Grab the name before deleting so we can log it
  const { data: todo } = await supabase.from('todos').select('text, priority').eq('id', params.id).single();

  const { error } = await supabase.from('todos').delete().eq('id', params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (todo) {
    await logSilent(`Deleted todo "${todo.text}" (${todo.priority} priority)`);
  }

  return NextResponse.json({ deleted: true });
}
