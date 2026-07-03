'use client';

import { useEffect, useState } from 'react';

export type ProgressType = 'percent' | 'count' | 'milestone' | 'done' | 'weight';

export interface BigGoal {
  id:              string;
  title:           string;
  progress:        number;       // canonical 0–100, always stored
  progress_type:   ProgressType;
  milestone:       string | null; // freetext note
  count_current:   number;
  count_target:    number;
  milestones:      string[];     // stage names for milestone type
  milestone_index: number;       // current stage index
  order:           number;
  created_at:      string;
}

function progressColor(p: number): string {
  if (p >= 100) return 'var(--green)';
  if (p > 0)    return 'var(--orange)';
  return 'var(--gray-5, #e5e5e5)';
}

function compactLabel(g: BigGoal): string {
  if (g.progress >= 100) return 'done';
  switch (g.progress_type) {
    case 'weight':
      return g.count_current > 0 ? `${g.count_current} lbs` : '—';
    case 'count':
      return `${g.count_current}/${g.count_target}`;
    case 'milestone':
      if (g.milestones.length > 0) return g.milestones[g.milestone_index] ?? '—';
      return '—';
    case 'done':
      return g.progress >= 100 ? '✓' : '—';
    default:
      return `${g.progress}%`;
  }
}

export default function BigGoalsCard({ onNavigate }: { onNavigate?: () => void }) {
  const [goals, setGoals] = useState<BigGoal[]>([]);

  useEffect(() => {
    fetch('/api/big-goals').then(r => r.json()).then(setGoals).catch(() => {});
  }, []);

  const doneCount = goals.filter(g => g.progress >= 100).length;

  return (
    <section style={{
      background:    'var(--card)',
      borderRadius:  'var(--r-lg)',
      boxShadow:     'var(--shadow)',
      border:        '1px solid var(--sep)',
      padding:       '14px 16px',
      display:       'flex',
      flexDirection: 'column',
      gap:           '10px',
      minHeight:     0,
      overflow:      'hidden',
      position:      'relative',
    }}>
      {onNavigate && (
        <span onClick={onNavigate} style={{ position: 'absolute', top: 0, right: 0, minWidth: '44px', minHeight: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', opacity: 0.5, cursor: 'pointer', WebkitTapHighlightColor: 'transparent', zIndex: 1 }}>↗</span>
      )}
      <div style={{ flexShrink: 0 }}>
        <div style={{ fontSize: '10px', fontWeight: 850, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--gray-3)' }}>
          2026 Goals
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {goals.length === 0 && (
          <div style={{ fontSize: '12px', color: 'var(--gray-4)', fontWeight: 600 }}>No goals yet — tap ↗ to add</div>
        )}
        {goals.map(g => {
          const color = progressColor(g.progress);
          return (
            <div key={g.id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '4px' }}>
                <div style={{ fontSize: '12px', fontWeight: 750, color: g.progress >= 100 ? 'var(--gray-3)' : 'var(--gray-1)', textDecoration: g.progress >= 100 ? 'line-through' : 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '72%' }}>
                  {g.title}
                </div>
                <div style={{ fontSize: '10px', fontWeight: 800, color, flexShrink: 0 }}>
                  {compactLabel(g)}
                </div>
              </div>
              <div style={{ height: '4px', borderRadius: 'var(--r-pill)', background: 'var(--gray-6)', overflow: 'hidden', marginBottom: g.milestone ? '3px' : '0' }}>
                <div style={{ width: `${g.progress}%`, height: '100%', background: color, borderRadius: 'var(--r-pill)', transition: 'width 0.3s ease-out' }} />
              </div>
              {g.milestone && g.progress_type !== 'weight' && (
                <div style={{ fontSize: '10px', color: 'var(--gray-3)', fontWeight: 500, fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {g.milestone}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
