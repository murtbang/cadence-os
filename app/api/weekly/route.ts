import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  const now   = new Date();
  const today = now.toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });

  // Mon–today (same week definition as training)
  const day = now.getDay();
  const daysToMon = (day + 6) % 7;
  const monday = new Date(now);
  monday.setDate(now.getDate() - daysToMon);
  const weekStart = monday.toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });

  // Last 7 calendar days for habit grid
  const days: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    days.push(d.toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' }));
  }

  const [habitsRes, logsRes, todosRes, workoutsRes, weightRes, summaryRes] = await Promise.all([
    supabase.from('habits').select('id, name, period').is('deleted_at', null).order('order'),
    supabase.from('habit_logs').select('habit_id, date, type').gte('date', days[0]),
    supabase.from('todos').select('id, text, priority, completed').eq('completed', true),
    supabase.from('boostcamp_workouts')
      .select('classification, logged_at')
      .gte('logged_at', `${weekStart}T00:00:00+00:00`)
      .order('logged_at', { ascending: true }),
    supabase.from('weight_logs')
      .select('weight_lbs, logged_at')
      .gte('logged_at', `${days[0]}T00:00:00+00:00`)
      .order('logged_at', { ascending: true }),
    supabase.from('boostcamp_summary')
      .select('weekly_target')
      .eq('id', 'singleton')
      .single(),
  ]);

  const DEFAULT_TARGET = ['Push', 'Pull', 'Push', 'Pull', 'Legs'];
  const weeklyTarget: string[] =
    Array.isArray(summaryRes.data?.weekly_target) && summaryRes.data.weekly_target.length > 0
      ? summaryRes.data.weekly_target
      : DEFAULT_TARGET;

  const weightLogs = weightRes.data ?? [];
  const weekStart7 = weightLogs[0]?.weight_lbs ?? null;
  const weekEnd7   = weightLogs[weightLogs.length - 1]?.weight_lbs ?? null;

  return NextResponse.json({
    days,
    today,
    weekStart,
    habits:        habitsRes.data   ?? [],
    logs:          logsRes.data     ?? [],
    todos:         todosRes.data    ?? [],
    workouts:      workoutsRes.data ?? [],
    weeklyTarget,
    weightStart:   weekStart7,
    weightEnd:     weekEnd7,
  });
}
