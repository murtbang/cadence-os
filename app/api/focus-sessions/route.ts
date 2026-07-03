import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { sendWebhook } from '@/lib/discord';

export const dynamic = 'force-dynamic';

const GOAL_LABELS: Record<string, string> = {
  gre:         'GRE',
  aevro:       'Aevro',
  ecopeptides: 'Ecopeptides',
};

export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get('date');
  let query = supabase.from('focus_sessions').select('*').order('completed_at', { ascending: false });
  if (date) {
    query = query.gte('completed_at', `${date}T00:00:00`).lte('completed_at', `${date}T23:59:59`);
  }
  const { data, error } = await query;
  if (error) return NextResponse.json([], { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const { goal, duration_minutes = 50, todo_id = null, todo_text } = await req.json();

  const { data, error } = await supabase
    .from('focus_sessions')
    .insert({ goal, duration_minutes, todo_id })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const label    = GOAL_LABELS[goal] ?? goal;
  const taskPart = todo_text ? ` — ${todo_text}` : '';
  await sendWebhook(`✅ **${duration_minutes} min ${label} session done**${taskPart}`);

  return NextResponse.json(data);
}
