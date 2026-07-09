import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// Colors auto-assigned to new categories, cycling through this palette.
const PALETTE = [
  'var(--blue)', 'var(--indigo)', 'var(--green)', 'var(--orange)',
  '#5AC8FA', 'var(--red)', '#AF52DE', '#FF9500',
];

// True when the DB error means the todo_categories table has not been created
// yet (migration not run). PostgREST reports PGRST205; Postgres reports 42P01.
// Lets these routes degrade gracefully instead of throwing a 500.
function isMissingTable(err: { code?: string; message?: string } | null | undefined): boolean {
  if (!err) return false;
  return err.code === 'PGRST205'
      || err.code === '42P01'
      || /could not find the table|relation.*does not exist/i.test(err.message ?? '');
}

const SETUP_MSG =
  'Categories are not set up yet — run db/schema.sql in Supabase to create the todo_categories table.';

export async function GET() {
  const { data, error } = await supabase
    .from('todo_categories')
    .select('*')
    .order('order', { ascending: true });
  if (error) {
    // Table not created yet → behave as "no categories". The TodoCard is
    // resilient to an empty list (it seeds a Personal tab and surfaces any
    // category still on a todo), so the UI keeps working instead of 500-ing.
    if (isMissingTable(error)) return NextResponse.json([]);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}

export async function POST(req: Request) {
  const { name, color } = await req.json();
  const trimmed = (name ?? '').trim();
  if (!trimmed) return NextResponse.json({ error: 'name required' }, { status: 400 });

  const { count } = await supabase
    .from('todo_categories')
    .select('*', { count: 'exact', head: true });
  const order  = count ?? 0;
  const chosen = color || PALETTE[order % PALETTE.length];

  const { data, error } = await supabase
    .from('todo_categories')
    .insert({ name: trimmed, color: chosen, order })
    .select()
    .single();
  if (error) {
    if (isMissingTable(error)) return NextResponse.json({ error: SETUP_MSG }, { status: 503 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data, { status: 201 });
}
