'use client';

import { useEffect, useState, useCallback } from 'react';
import { FocusSession, GoalTarget } from '@/types/database';

type Goal = 'gre' | 'aevro' | 'ecopeptides';

const GOAL_LABELS: Record<Goal, string> = {
  gre:         'GRE',
  aevro:       'Aevro',
  ecopeptides: 'Ecopeptides',
};

const GOAL_COLORS: Record<Goal, string> = {
  gre:         'var(--blue)',
  aevro:       'var(--indigo)',
  ecopeptides: 'var(--green)',
};

const GOAL_CATEGORY: Record<Goal, string> = {
  gre:         'Personal',
  aevro:       'Company Work',
  ecopeptides: 'Company Work',
};

const DEFAULT_TARGETS: Record<Goal, number> = {
  gre:         50,
  aevro:       100,
  ecopeptides: 50,
};

const GOALS: Goal[] = ['gre', 'aevro', 'ecopeptides'];

interface Props {
  onNavigate?: () => void;
}

export default function GoalTrackerCard({ onNavigate }: Props) {
  const [sessions, setSessions]   = useState<FocusSession[]>([]);
  const [targets, setTargets]     = useState<GoalTarget[]>([]);
  const [editing, setEditing]     = useState<Goal | null>(null);
  const [editVal, setEditVal]     = useState('');
  const [loading, setLoading]     = useState(true);

  const fetchData = useCallback(async () => {
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
    const [sRes, tRes] = await Promise.all([
      fetch(`/api/focus-sessions?date=${today}`),
      fetch('/api/goal-targets'),
    ]);
    const [s, t] = await Promise.all([sRes.json(), tRes.json()]);
    setSessions(Array.isArray(s) ? s : []);
    setTargets(Array.isArray(t) ? t : []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Refresh every minute to pick up new sessions
  useEffect(() => {
    const id = setInterval(fetchData, 60_000);
    return () => clearInterval(id);
  }, [fetchData]);

  function getMinutes(goal: Goal): number {
    return sessions.filter(s => s.goal === goal).reduce((acc, s) => acc + s.duration_minutes, 0);
  }

  function getTarget(goal: Goal): number {
    return targets.find(t => t.goal === goal)?.daily_minutes ?? DEFAULT_TARGETS[goal];
  }

  async function saveTarget(goal: Goal, minutes: number) {
    await fetch('/api/goal-targets', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ goal, daily_minutes: minutes }),
    });
    setTargets(prev => {
      const filtered = prev.filter(t => t.goal !== goal);
      return [...filtered, { goal, daily_minutes: minutes }];
    });
  }

  function startEdit(goal: Goal) {
    setEditing(goal);
    setEditVal(String(getTarget(goal)));
  }

  function commitEdit(goal: Goal) {
    const val = parseInt(editVal, 10);
    if (!isNaN(val) && val > 0) saveTarget(goal, val);
    setEditing(null);
  }

  const totalMinutes = GOALS.reduce((acc, g) => acc + getMinutes(g), 0);
  const totalTarget  = GOALS.reduce((acc, g) => acc + getTarget(g), 0);

  return (
    <div style={{ background: 'var(--card)', borderRadius: 'var(--r-lg)', padding: '12px 14px', boxShadow: 'var(--shadow)', display: 'flex', flexDirection: 'column', minHeight: 0, height: '100%' }}>
      {/* Header */}
      <div style={{ fontSize: '9px', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--gray-4)', marginBottom: '10px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        Daily Goals
        {onNavigate && (
          <button
            type="button"
            onClick={onNavigate}
            aria-label="Open goals"
            style={{ fontSize: '10px', fontWeight: 700, color: 'var(--gray-4)', background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px 4px 4px 8px', WebkitTapHighlightColor: 'transparent' }}
          >
            Open
          </button>
        )}
      </div>

      {/* Goal rows */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px', minHeight: 0 }}>
        {loading ? (
          <div style={{ color: 'var(--gray-4)', fontSize: '12px', textAlign: 'center', marginTop: '16px' }}>Loading...</div>
        ) : GOALS.map(goal => {
          const done    = getMinutes(goal);
          const target  = getTarget(goal);
          const pct     = Math.min(100, target > 0 ? Math.round((done / target) * 100) : 0);
          const color   = GOAL_COLORS[goal];
          const isEditing = editing === goal;

          return (
            <div key={goal}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: color, flexShrink: 0 }} />
                  <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--gray-2)' }}>{GOAL_LABELS[goal]}</span>
                  <span style={{ fontSize: '9px', color: 'var(--gray-4)' }}>{GOAL_CATEGORY[goal]}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: done >= target ? color : 'var(--gray-2)', fontFamily: 'var(--font-geist-mono), monospace' }}>
                    {done}
                  </span>
                  <span style={{ fontSize: '10px', color: 'var(--gray-4)' }}>/</span>
                  {isEditing ? (
                    <input
                      autoFocus
                      value={editVal}
                      onChange={e => setEditVal(e.target.value)}
                      onBlur={() => commitEdit(goal)}
                      onKeyDown={e => { if (e.key === 'Enter') commitEdit(goal); if (e.key === 'Escape') setEditing(null); }}
                      style={{ width: '40px', fontSize: '11px', fontFamily: 'var(--font-geist-mono), monospace', border: 'none', borderBottom: `1px solid ${color}`, background: 'transparent', color: 'var(--gray-2)', outline: 'none', textAlign: 'right', padding: '0 2px' }}
                    />
                  ) : (
                    <button
                      onClick={() => startEdit(goal)}
                      style={{ fontSize: '10px', color: 'var(--gray-4)', background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px', fontFamily: 'var(--font-geist-mono), monospace' }}
                      title="Edit target"
                    >
                      {target}m
                    </button>
                  )}
                  {done >= target && <span style={{ fontSize: '10px' }}>✓</span>}
                </div>
              </div>
              {/* Progress bar */}
              <div style={{ height: '4px', borderRadius: '2px', background: 'var(--gray-6)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: '2px', transition: 'width 0.4s ease' }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer total */}
      {!loading && (
        <div style={{ flexShrink: 0, marginTop: '10px', paddingTop: '8px', borderTop: '1px solid var(--gray-6)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '10px', color: 'var(--gray-4)' }}>Today total</span>
          <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--gray-2)', fontFamily: 'var(--font-geist-mono), monospace' }}>
            {totalMinutes} / {totalTarget} min
          </span>
        </div>
      )}
    </div>
  );
}
