import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { data, error } = await supabase
    .from('habit_logs')
    .select('id, habit_id, date, type')
    .order('date', { ascending: false })
    .limit(10000);

  if (error) {
    console.error('habit_logs GET error:', error.message);
    return NextResponse.json([], { status: 200 }); // fail gracefully — never break the UI
  }

  return NextResponse.json(data ?? []);
}
