import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { estimate1RM } from '@/lib/oneRepMax';

export const dynamic = 'force-dynamic';

// Best logged set per exercise, derived from the full Boostcamp payload that the
// sync already stores in boostcamp_workouts.raw_json. Each record looks like:
//   { name, sets: [{ value: "<weight>", amount: "<reps>", weight_unit, skipped, valueEmpty, amountEmpty }] }
interface DerivedPR {
  exercise:    string;
  weight_lbs:  number;
  reps:        number;
  achieved_at: string;
  source:      'boostcamp';
}

function toLbs(weight: number, unit: unknown): number {
  return typeof unit === 'string' && unit.toLowerCase() === 'kg' ? weight * 2.20462 : weight;
}

export async function GET() {
  const { data, error } = await supabase
    .from('boostcamp_workouts')
    .select('logged_at, raw_json')
    .order('logged_at', { ascending: true });

  // Table missing or RLS-blocked (e.g. no service-role key locally) — fail soft.
  if (error) {
    console.error('prs/derived error:', error.message);
    return NextResponse.json([]);
  }

  const best = new Map<string, DerivedPR & { e1rm: number }>();

  for (const row of data ?? []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw = row.raw_json as any;
    const records: any[] = Array.isArray(raw?.records) ? raw.records : []; // eslint-disable-line @typescript-eslint/no-explicit-any

    for (const rec of records) {
      const name = typeof rec?.name === 'string' ? rec.name.trim() : '';
      if (!name) continue;

      const sets: any[] = Array.isArray(rec?.sets) ? rec.sets : []; // eslint-disable-line @typescript-eslint/no-explicit-any
      for (const s of sets) {
        if (s?.skipped || s?.valueEmpty || s?.amountEmpty) continue; // planned/empty/skipped
        const w    = toLbs(parseFloat(s?.value), s?.weight_unit);
        const reps = parseInt(s?.amount, 10);
        if (!Number.isFinite(w) || w <= 0) continue;       // bodyweight / time sets → skip
        if (!Number.isInteger(reps) || reps <= 0) continue;

        const e1rm = estimate1RM(w, reps);
        const key  = name.toLowerCase();
        const cur  = best.get(key);
        if (!cur || e1rm > cur.e1rm) {
          best.set(key, {
            exercise:    name,
            weight_lbs:  Math.round(w),
            reps,
            achieved_at: row.logged_at as string,
            source:      'boostcamp',
            e1rm,
          });
        }
      }
    }
  }

  const out: DerivedPR[] = Array.from(best.values()).map(b => ({
    exercise:    b.exercise,
    weight_lbs:  b.weight_lbs,
    reps:        b.reps,
    achieved_at: b.achieved_at,
    source:      b.source,
  }));

  return NextResponse.json(out);
}
