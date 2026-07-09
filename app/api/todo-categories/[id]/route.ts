import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// True when the DB error means the todo_categories table has not been created
// yet (migration not run). PostgREST reports PGRST205; Postgres reports 42P01.
function isMissingTable(err: { code?: string; message?: string } | null | undefined): boolean {
  if (!err) return false;
  return err.code === 'PGRST205'
      || err.code === '42P01'
      || /could not find the table|relation.*does not exist/i.test(err.message ?? '');
}

const SETUP_MSG =
  'Categories are not set up yet — run db/schema.sql in Supabase to create the todo_categories table.';

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
  if (error) {
    if (isMissingTable(error)) return NextResponse.json({ error: SETUP_MSG }, { status: 503 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // A category is referenced by todos.category = its name, so cascade renames.
  if (rename) {
    await supabase.from('todos').update({ category: rename.to }).eq('category', rename.from);
  }
  return NextResponse.json({ updated: true });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const { data: cat, error: catErr } = await supabase
    .from('todo_categories').select('name').eq('id', params.id).single();
  // Missing table → clear setup message rather than a misleading "not found".
  if (isMissingTable(catErr)) return NextResponse.json({ error: SETUP_MSG }, { status: 503 });
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
