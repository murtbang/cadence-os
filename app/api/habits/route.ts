import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { data, error } = await supabase
    .from('habits')
    .select('*')
    .is('deleted_at', null)
    .order('order', { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: Request) {
  const { name, period, emoji } = await req.json();
  if (!name || !period) return NextResponse.json({ error: 'name and period required' }, { status: 400 });

  const { count } = await supabase
    .from('habits')
    .select('*', { count: 'exact', head: true })
    .eq('period', period)
    .is('deleted_at', null);

  const { data, error } = await supabase
    .from('habits')
    .insert({ name, period, order: count ?? 0, emoji: emoji ?? null })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
