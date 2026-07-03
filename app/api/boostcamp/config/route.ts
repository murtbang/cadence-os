import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const VALID_TYPES = ['Push', 'Pull', 'Legs', 'Other'];

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { weekly_target } = body;

    if (!Array.isArray(weekly_target) || weekly_target.length === 0) {
      return NextResponse.json({ error: 'weekly_target must be a non-empty array' }, { status: 400 });
    }

    if (!weekly_target.every((t: unknown) => typeof t === 'string' && VALID_TYPES.includes(t))) {
      return NextResponse.json({ error: `Each item must be one of: ${VALID_TYPES.join(', ')}` }, { status: 400 });
    }

    const { error } = await supabase
      .from('boostcamp_summary')
      .update({ weekly_target })
      .eq('id', 'singleton');

    if (error) throw error;

    return NextResponse.json({ ok: true, weekly_target });
  } catch (err) {
    console.error('boostcamp config PATCH error:', err);
    return NextResponse.json({ error: 'Failed to update config' }, { status: 500 });
  }
}
