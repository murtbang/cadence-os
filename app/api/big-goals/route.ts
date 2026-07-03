import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  const { data, error } = await supabase
    .from('big_goals')
    .select('*')
    .order('order', { ascending: true });
  if (error) return NextResponse.json([], { status: 200 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: Request) {
  const { title, milestone } = await req.json();
  if (!title) return NextResponse.json({ error: 'title required' }, { status: 400 });

  // Put new goal at end
  const { data: existing } = await supabase.from('big_goals').select('order').order('order', { ascending: false }).limit(1);
  const nextOrder = existing && existing.length > 0 ? existing[0].order + 1 : 0;

  const { data, error } = await supabase
    .from('big_goals')
    .insert({ title, progress: 0, milestone: milestone ?? '', order: nextOrder })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
