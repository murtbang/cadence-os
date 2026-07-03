'use client';

import { useEffect, useRef, useState } from 'react';
import BodyMapSVG from './BodyMapSVG';

interface LatestWorkout {
  loggedAt: string;
  classification: 'Push' | 'Pull' | 'Legs' | 'Other';
  muscles: string[];
  exercises: string[];
}

interface WeeklyProgress {
  completed: string[];
  target: string[];
  nextFocus: string;
  completedCount: number;
  targetCount: number;
  weekMuscles?: string[];
}

interface BodyMapData {
  latestWorkout: LatestWorkout | null;
  weeklyProgress: WeeklyProgress;
}

const CLASS_COLOR: Record<string, string> = {
  Push:  'var(--orange)',
  Pull:  '#5AC8FA',
  Legs:  '#34C759',
  Other: 'var(--gray-3)',
};

function classColor(cls: string) { return CLASS_COLOR[cls] ?? 'var(--gray-3)'; }

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
    timeZone: 'America/Los_Angeles',
  });
}

function ProgressDots({ completed, target }: { completed: string[]; target: string[] }) {
  return (
    <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
      {target.map((t, i) => {
        const done  = i < completed.length;
        const color = done ? classColor(completed[i]) : 'var(--gray-5, #e5e5e5)';
        return (
          <div key={i} title={t} style={{
            width: '8px', height: '8px', borderRadius: '50%',
            background: color, border: done ? 'none' : '1.5px solid var(--sep)', flexShrink: 0,
          }} />
        );
      })}
    </div>
  );
}

interface WeightState {
  latestWeight: number | null;
  loggedToday:  boolean;
}

export default function RecentBodyMapCard({ onNavigate }: { onNavigate?: () => void }) {
  const [data,          setData]          = useState<BodyMapData | null>(null);
  const [weight,        setWeight]        = useState<WeightState | null>(null);
  const [editingWeight, setEditingWeight] = useState(false);
  const [weightInput,   setWeightInput]   = useState('');
  const submittingRef = useRef(false);
  const cancelRef     = useRef(false);

  useEffect(() => {
    fetch('/api/boostcamp/recent-body-map')
      .then(r => r.json())
      .then(setData)
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch('/api/weight')
      .then(r => r.json())
      .then(setWeight)
      .catch(() => {});
  }, []);

  async function submitWeight() {
    // Guard against double-submit (e.g. blur + tap of the ✓ button firing both).
    if (submittingRef.current) return;
    const lbs = parseFloat(weightInput);
    if (!lbs || lbs <= 0) { setEditingWeight(false); setWeightInput(''); return; }
    submittingRef.current = true;
    try {
      await fetch('/api/weight', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ weight_lbs: lbs }),
      });
      setWeight({ latestWeight: lbs, loggedToday: true });
    } finally {
      submittingRef.current = false;
      setEditingWeight(false);
      setWeightInput('');
    }
  }

  function cancelWeight() {
    cancelRef.current = true;
    setEditingWeight(false);
    setWeightInput('');
  }

  const lw          = data?.latestWorkout;
  const wp          = data?.weeklyProgress;
  const accentColor = lw ? classColor(lw.classification) : 'var(--gray-4)';

  return (
    <section style={{
      background:   'var(--card)',
      borderRadius: 'var(--r-lg)',
      boxShadow:    'var(--shadow)',
      border:       '1px solid var(--sep)',
      padding:      '14px 16px',
      display:      'grid',
      gridTemplateColumns: '1fr 1fr',
      gap:          '12px',
      minHeight:    0,
      overflow:     'hidden',
      position:     'relative',
    }}>
      {onNavigate && (
        <span onClick={onNavigate} style={{ position: 'absolute', top: '0', right: '0', minWidth: '44px', minHeight: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', opacity: 0.5, cursor: 'pointer', WebkitTapHighlightColor: 'transparent', zIndex: 1 }}>↗</span>
      )}

      {/* ── Left half: info ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minHeight: 0, overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <div style={{ fontSize: '10px', fontWeight: 850, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--gray-3)' }}>
            Training
          </div>
          {wp && (
            <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--gray-3)' }}>
              {wp.completedCount}/{wp.targetCount}
            </span>
          )}
        </div>

        {/* Workout info */}
        {lw ? (
          <>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '7px', flexShrink: 0 }}>
              <div style={{ fontSize: '26px', fontWeight: 750, color: accentColor, lineHeight: 1, letterSpacing: '-0.5px' }}>
                {lw.classification}
              </div>
              <div style={{ fontSize: '10px', color: 'var(--gray-3)', fontWeight: 600 }}>
                {formatDate(lw.loggedAt)}
              </div>
            </div>

            {lw.muscles.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px', flexShrink: 0 }}>
                {lw.muscles.map(m => (
                  <span key={m} style={{
                    fontSize: '9px', fontWeight: 700,
                    padding: '2px 6px', borderRadius: '99px',
                    background: `${accentColor}22`, color: accentColor,
                    textTransform: 'capitalize',
                  }}>
                    {m}
                  </span>
                ))}
              </div>
            )}

            {lw.exercises.length > 0 && (
              <div style={{ fontSize: '10px', color: 'var(--gray-3)', lineHeight: 1.5, fontWeight: 500, overflow: 'hidden' }}>
                {lw.exercises.slice(0, 4).join(' · ')}
                {lw.exercises.length > 4 && <span style={{ color: 'var(--gray-4)' }}> +{lw.exercises.length - 4}</span>}
              </div>
            )}

            {/* Weight row */}
            {weight !== null && (
              editingWeight ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                  <span style={{ fontSize: '12px', color: 'var(--gray-3)' }}>⚖</span>
                  <input
                    autoFocus
                    type="number"
                    value={weightInput}
                    onChange={e => setWeightInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') submitWeight(); if (e.key === 'Escape') cancelWeight(); }}
                    onBlur={() => { if (cancelRef.current) { cancelRef.current = false; return; } submitWeight(); }}
                    placeholder={String(weight.latestWeight ?? '')}
                    style={{ width: '72px', fontSize: '13px', fontWeight: 700, background: 'var(--gray-6)', border: '1px solid var(--sep)', borderRadius: 'var(--r-md)', padding: '5px 8px', outline: 'none', color: 'var(--gray-2)' }}
                  />
                  <button onClick={submitWeight} style={{ minWidth: '44px', minHeight: '44px', border: 'none', background: 'var(--green)', color: '#fff', borderRadius: 'var(--r-sm)', fontSize: '16px', cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}>✓</button>
                  <button onPointerDown={() => { cancelRef.current = true; }} onClick={cancelWeight} style={{ minWidth: '44px', minHeight: '44px', border: 'none', background: 'transparent', color: 'var(--gray-4)', fontSize: '16px', cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}>✕</button>
                </div>
              ) : (
                <div
                  onClick={() => { setWeightInput(String(weight.latestWeight ?? '')); setEditingWeight(true); }}
                  style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', minHeight: '44px', marginTop: '-6px' }}
                >
                  <span style={{ fontSize: '12px', color: weight.loggedToday ? 'var(--gray-3)' : 'var(--red)' }}>⚖</span>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: weight.loggedToday ? 'var(--gray-2)' : 'var(--red)', fontFamily: 'var(--font-geist-mono), monospace' }}>
                    {weight.latestWeight !== null ? `${weight.latestWeight} lbs` : 'Log weight'}
                  </span>
                </div>
              )
            )}
          </>
        ) : (
          <div style={{ fontSize: '12px', color: 'var(--gray-4)', fontWeight: 600 }}>No workouts yet</div>
        )}

        {/* Weekly progress */}
        {wp && (
          <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '5px', flexShrink: 0 }}>
            <ProgressDots completed={wp.completed} target={wp.target} />
            <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--gray-2)' }}>
              Next: <span style={{ color: classColor(wp.nextFocus) }}>{wp.nextFocus}</span>
            </div>
          </div>
        )}
      </div>

      {/* ── Right half: body map ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center', minHeight: 0, overflow: 'visible', marginTop: '-40px' }}>
        <div style={{ transform: 'scale(2.25)', transformOrigin: 'top center', width: '100%', display: 'flex', justifyContent: 'center' }}>
          <BodyMapSVG
            muscles={wp?.weekMuscles ?? lw?.muscles ?? []}
            accentColor={accentColor}
            size={90}
          />
        </div>
      </div>


    </section>
  );
}
