import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  const { data, error } = await supabase
    .from('todos')
    .select('*')
    .order('order', { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: Request) {
  const { text, priority, category = 'personal', due_date = null } = await req.json();
  if (!text || !priority) return NextResponse.json({ error: 'text and priority required' }, { status: 400 });

  // Scope order counter to category + priority so each tab sorts independently
  const { count } = await supabase
    .from('todos')
    .select('*', { count: 'exact', head: true })
    .eq('priority', priority)
    .eq('category', category);

  const { data, error } = await supabase
    .from('todos')
    .insert({ text, priority, category, order: count ?? 0, due_date })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
