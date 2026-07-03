import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { data, error } = await supabase.from('goal_targets').select('*');
  if (error) return NextResponse.json([], { status: 500 });
  return NextResponse.json(data);
}

export async function PUT(req: NextRequest) {
  const { goal, daily_minutes } = await req.json();
  const { data, error } = await supabase
    .from('goal_targets')
    .upsert({ goal, daily_minutes })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
