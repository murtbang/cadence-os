import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const DEFAULT_TARGET = ['Push', 'Pull', 'Push', 'Pull', 'Legs'];

function weekStart(): string {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
  const day = now.getDay();
  const daysToMon = (day + 6) % 7;
  const monday = new Date(now);
  monday.setDate(now.getDate() - daysToMon);
  return monday.toLocaleDateString('en-CA');
}

function monthStart(): string {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
}

function nextFocus(completed: string[], target: string[]): string {
  for (let i = 0; i < target.length; i++) {
    if (i >= completed.length || completed[i] !== target[i]) {
      return target[i] ?? 'Recovery';
    }
  }
  return 'Recovery / Optional';
}

export async function GET() {
  try {
    // ── Latest workout ──────────────────────────────────────────────────────
    const { data: latest, error: e1 } = await supabase
      .from('boostcamp_workouts')
      .select('*')
      .order('logged_at', { ascending: false })
      .limit(1)
      .single();

    if (e1 && e1.code !== 'PGRST116') {
      console.error('boostcamp latest error:', e1.message);
    }

    // ── This week's workouts ────────────────────────────────────────────────
    const monday = weekStart();
    const { data: weekRows, error: e2 } = await supabase
      .from('boostcamp_workouts')
      .select('classification, logged_at, muscles_json')
      .gte('logged_at', `${monday}T00:00:00+00:00`)
      .order('logged_at', { ascending: true });

    if (e2) console.error('boostcamp weekly error:', e2.message);

    // ── Recent workout history (last 90 days for date browser) ──────────────
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    const historyStart = ninetyDaysAgo.toLocaleDateString('en-CA');

    const { data: historyRows } = await supabase
      .from('boostcamp_workouts')
      .select('logged_at, workout_name, classification, muscles_json, exercises_json')
      .gte('logged_at', `${historyStart}T00:00:00+00:00`)
      .order('logged_at', { ascending: false });

    // ── Summary stats + config ──────────────────────────────────────────────
    const { data: summary } = await supabase
      .from('boostcamp_summary')
      .select('*')
      .eq('id', 'singleton')
      .single();

    const WEEKLY_TARGET: string[] =
      Array.isArray(summary?.weekly_target) && summary.weekly_target.length > 0
        ? summary.weekly_target
        : DEFAULT_TARGET;

    // ── Derived values ──────────────────────────────────────────────────────
    const completed = (weekRows ?? []).map(r => r.classification);

    const weekMuscles = Array.from(new Set(
      (weekRows ?? []).flatMap(r => r.muscles_json ?? [])
    ));

    const month = monthStart();
    const monthWorkouts = (historyRows ?? []).filter(r =>
      r.logged_at >= `${month}T00:00:00+00:00`
    );
    const monthlyCount = monthWorkouts.length;
    const monthByType = {
      Push: monthWorkouts.filter(r => r.classification === 'Push').length,
      Pull: monthWorkouts.filter(r => r.classification === 'Pull').length,
      Legs: monthWorkouts.filter(r => r.classification === 'Legs').length,
    };

    const focus = nextFocus(completed, WEEKLY_TARGET);

    // Shape recent workouts for the history browser
    const recentWorkouts = (historyRows ?? []).map(r => ({
      date:           new Date(r.logged_at).toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' }),
      loggedAt:       r.logged_at,
      name:           r.workout_name ?? 'Workout',
      classification: r.classification as string,
      muscles:        r.muscles_json ?? [] as string[],
      exercises:      r.exercises_json ?? [] as string[],
    }));

    return NextResponse.json({
      latestWorkout: latest ? {
        loggedAt:       latest.logged_at,
        name:           latest.workout_name ?? 'Workout',
        classification: latest.classification,
        muscles:        latest.muscles_json ?? [],
        exercises:      latest.exercises_json ?? [],
      } : null,
      weeklyProgress: {
        completed,
        target:         WEEKLY_TARGET,
        nextFocus:      focus,
        completedCount: completed.length,
        targetCount:    WEEKLY_TARGET.length,
        weekMuscles,
      },
      summary: summary ? {
        weekStreak:    summary.week_streak,
        totalWorkouts: summary.total_workouts,
        totalHours:    Math.round(summary.total_hours),
        monthlyCount,
        monthByType,
      } : { weekStreak: 0, totalWorkouts: 0, totalHours: 0, monthlyCount, monthByType },
      recentWorkouts,
    });
  } catch (err) {
    console.error('recent-body-map error:', err);
    return NextResponse.json(
      { latestWorkout: null, weeklyProgress: { completed: [], target: DEFAULT_TARGET, nextFocus: 'Push', completedCount: 0, targetCount: 5 }, recentWorkouts: [] },
      { status: 200 }
    );
  }
}
