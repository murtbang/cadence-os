import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// Colors auto-assigned to new categories, cycling through this palette.
const PALETTE = [
  'var(--blue)', 'var(--indigo)', 'var(--green)', 'var(--orange)',
  '#5AC8FA', 'var(--red)', '#AF52DE', '#FF9500',
];

export async function GET() {
  const { data, error } = await supabase
    .from('todo_categories')
    .select('*')
    .order('order', { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
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
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
