'use client';

import { useEffect, useState, CSSProperties } from 'react';
import { estimate1RM } from '@/lib/oneRepMax';

const TZ = 'America/Los_Angeles';

const shell: CSSProperties = {
  background: 'var(--card)', borderRadius: 'var(--r-lg)', boxShadow: 'var(--shadow)',
  border: '1px solid var(--sep)', padding: '14px 16px', display: 'flex',
  flexDirection: 'column', minHeight: 0, height: '100%', overflow: 'hidden',
  position: 'relative', boxSizing: 'border-box',
};

const labelStyle: CSSProperties = {
  fontSize: '10px', fontWeight: 850, letterSpacing: '0.1em',
  textTransform: 'uppercase', color: 'var(--gray-3)', flexShrink: 0,
};

const DEADLIFT_RE = /dead\s*lift/i;

interface WorkoutLite { date: string; exercises: string[] }
interface LiftPR { exercise: string; weight_lbs: number; reps: number }

function todayLA(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: TZ });
}

function bestDeadliftPR(prs: LiftPR[]): { pr: LiftPR; e1rm: number } | null {
  let best: LiftPR | null = null;
  let bestE = 0;
  for (const p of prs) {
    if (!DEADLIFT_RE.test(p.exercise)) continue;
    const e = estimate1RM(p.weight_lbs, p.reps);
    if (e > bestE) { best = p; bestE = e; }
  }
  return best ? { pr: best, e1rm: bestE } : null;
}

export default function DeadliftReminderFace({ onNavigate }: { onNavigate?: () => void }) {
  const [workouts, setWorkouts] = useState<WorkoutLite[] | null>(null);
  const [prs, setPrs] = useState<LiftPR[]>([]);

  useEffect(() => {
    fetch('/api/boostcamp/recent-body-map')
      .then(r => r.json())
      .then(d => setWorkouts(Array.isArray(d.recentWorkouts) ? d.recentWorkouts : []))
      .catch(() => setWorkouts([]));

    // Merge manual PRs + Boostcamp-derived PRs for the best deadlift.
    Promise.all([
      fetch('/api/prs').then(r => r.json()).catch(() => []),
      fetch('/api/prs/derived').then(r => r.json()).catch(() => []),
    ]).then(([m, d]) => {
      const list: LiftPR[] = [
        ...(Array.isArray(m) ? m : []),
        ...(Array.isArray(d) ? d : []),
      ].filter(x => x && typeof x.exercise === 'string');
      setPrs(list);
    }).catch(() => {});
  }, []);

  const monthPrefix = todayLA().slice(0, 7); // YYYY-MM
  const monthLabel  = new Date().toLocaleDateString('en-US', { month: 'long', timeZone: TZ });

  const deadliftThisMonth = (workouts ?? []).find(
    w => typeof w.date === 'string' && w.date.startsWith(monthPrefix) && (w.exercises ?? []).some(ex => DEADLIFT_RE.test(ex)),
  );
  const done    = !!deadliftThisMonth;
  const loading = workouts === null;
  const best    = bestDeadliftPR(prs);
  const accent  = loading ? 'var(--gray-4)' : done ? 'var(--green)' : 'var(--orange)';

  function lastDeadliftLabel(): string {
    if (!deadliftThisMonth) return '';
    const d = new Date(deadliftThisMonth.date + 'T12:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  }

  return (
    <section style={shell}>
      {onNavigate && (
        <span onClick={onNavigate} style={{ position: 'absolute', top: 0, right: 0, minWidth: '44px', minHeight: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', opacity: 0.5, cursor: 'pointer', WebkitTapHighlightColor: 'transparent', zIndex: 1 }}>↗</span>
      )}

      <div style={{ ...labelStyle, marginBottom: 12 }}>🏋️ Monthly Deadlift</div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: 0 }}>
        <div>
          <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-1px', lineHeight: 1.05, color: accent }}>
            {loading ? '…' : done ? 'Done this month' : 'Deadlift due'}
          </div>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--gray-3)', marginTop: 7, lineHeight: 1.45 }}>
            {loading
              ? 'Checking your sessions…'
              : done
                ? `Last hit ${lastDeadliftLabel()}. Nice.`
                : `None logged in ${monthLabel}. Make your next pull day a deadlift day.`}
          </div>
        </div>

        <div style={{ flexShrink: 0 }}>
          {best ? (
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, borderTop: '0.5px solid var(--sep)', paddingTop: 10 }}>
              <span style={{ fontSize: 9, fontWeight: 850, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--gray-4)' }}>PR</span>
              <span style={{ fontFamily: 'var(--font-geist-mono), monospace', fontSize: 15, fontWeight: 750, color: 'var(--black)', letterSpacing: '-0.5px' }}>
                {best.pr.weight_lbs}<span style={{ fontSize: 11, color: 'var(--gray-3)', fontWeight: 600 }}> × {best.pr.reps}</span>
              </span>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--orange)' }}>{best.e1rm} est. 1RM</span>
              {!done && <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-3)', marginLeft: 'auto' }}>beat it →</span>}
            </div>
          ) : (
            !loading && (
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--gray-4)', borderTop: '0.5px solid var(--sep)', paddingTop: 10 }}>
                No deadlift PR yet — it’ll fill in from your Boostcamp sets.
              </div>
            )
          )}
        </div>
      </div>
    </section>
  );
}
