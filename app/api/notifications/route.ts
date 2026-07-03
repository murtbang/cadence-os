import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .is('dismissed_at', null)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) return NextResponse.json([], { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const { message, type = 'info' } = await req.json();
  const { data, error } = await supabase
    .from('notifications')
    .insert({ message, type })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
