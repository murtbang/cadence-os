import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json();
  const patch: Record<string, unknown> = {};
  let rename: { from: string; to: string } | null = null;

  if (typeof body.name === 'string' && body.name.trim()) {
    const to = body.name.trim();
    const { data: cur } = await supabase
      .from('todo_categories').select('name').eq('id', params.id).single();
    if (cur && cur.name !== to) rename = { from: cur.name, to };
    patch.name = to;
  }
  if (typeof body.color === 'string') patch.color = body.color;
  if (typeof body.order === 'number') patch.order = body.order;

  const { error } = await supabase.from('todo_categories').update(patch).eq('id', params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // A category is referenced by todos.category = its name, so cascade renames.
  if (rename) {
    await supabase.from('todos').update({ category: rename.to }).eq('category', rename.from);
  }
  return NextResponse.json({ updated: true });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const { data: cat } = await supabase
    .from('todo_categories').select('name').eq('id', params.id).single();
  if (!cat) return NextResponse.json({ error: 'not found' }, { status: 404 });

  // Fallback = lowest-order remaining category. Refuse to delete the last one.
  const { data: rest } = await supabase
    .from('todo_categories').select('name')
    .neq('id', params.id).order('order', { ascending: true }).limit(1);
  const fallback = rest?.[0]?.name;
  if (!fallback) {
    return NextResponse.json({ error: 'Cannot delete your only category' }, { status: 400 });
  }

  // Move this category's todos to the fallback, then delete the category.
  await supabase.from('todos').update({ category: fallback }).eq('category', cat.name);
  const { error } = await supabase.from('todo_categories').delete().eq('id', params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ deleted: true, reassignedTo: fallback });
}
