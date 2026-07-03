'use client';

import { useEffect, useState, useMemo } from 'react';
import BodyMapSVG from './BodyMapSVG';
import PRPanel from './PRPanel';

// ── Weight chart ──────────────────────────────────────────────────────────────

interface WeightPoint { date: string; weight: number; }

function WeightChart({ data }: { data: WeightPoint[] }) {
  if (data.length < 2) return null;

  const W = 300, H = 56, PAD_X = 4, PAD_Y = 8;
  const weights = data.map(d => d.weight);
  const minW    = Math.min(...weights);
  const maxW    = Math.max(...weights);
  const range   = Math.max(maxW - minW, 1.5); // at least 1.5 lb visual range

  const xOf = (i: number) =>
    PAD_X + (i / (data.length - 1)) * (W - 2 * PAD_X);
  const yOf = (w: number) =>
    H - PAD_Y - ((w - minW) / range) * (H - 2 * PAD_Y);

  const pathD = data
    .map((d, i) => `${i === 0 ? 'M' : 'L'} ${xOf(i).toFixed(1)} ${yOf(d.weight).toFixed(1)}`)
    .join(' ');

  // Area fill path
  const areaD = `${pathD} L ${xOf(data.length - 1).toFixed(1)} ${H} L ${xOf(0).toFixed(1)} ${H} Z`;

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ display: 'block' }}>
      <defs>
        <linearGradient id="wt-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="var(--blue)" stopOpacity="0.18" />
          <stop offset="100%" stopColor="var(--blue)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Area fill */}
      <path d={areaD} fill="url(#wt-grad)" />
      {/* Line */}
      <path d={pathD} fill="none" stroke="var(--blue)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      {/* All data point dots */}
      {data.map((d, i) => {
        const isLast = i === data.length - 1;
        return (
          <circle
            key={i}
            cx={xOf(i)}
            cy={yOf(d.weight)}
            r={isLast ? 3.5 : 2}
            fill={isLast ? 'var(--blue)' : 'var(--card)'}
            stroke="var(--blue)"
            strokeWidth={isLast ? 0 : 1.5}
          />
        );
      })}
    </svg>
  );
}

function weightDeltaLabel(data: WeightPoint[]): string | null {
  if (data.length < 2) return null;
  // Compare latest to closest point ~7 days back
  const latest   = data[data.length - 1];
  const latestMs = new Date(latest.date).getTime();
  const target7  = latestMs - 7 * 86_400_000;
  // Find point closest to 7 days ago (but not in the future relative to 7d)
  const older = [...data]
    .filter(d => new Date(d.date).getTime() <= target7 + 86_400_000 * 3) // within 3d window
    .sort((a, b) => Math.abs(new Date(a.date).getTime() - target7) - Math.abs(new Date(b.date).getTime() - target7));
  const ref = older[0] ?? data[0];
  const delta = latest.weight - ref.weight;
  if (Math.abs(delta) < 0.05) return '±0 lbs this week';
  const sign = delta < 0 ? '−' : '+';
  return `${sign}${Math.abs(delta).toFixed(1)} lbs (7d)`;
}

interface WorkoutDetail {
  date:           string; // YYYY-MM-DD (LA time)
  loggedAt:       string;
  name:           string;
  classification: string;
  muscles:        string[];
  exercises:      string[];
}

interface WeeklyProgress {
  completed:      string[];
  target:         string[];
  nextFocus:      string;
  completedCount: number;
  targetCount:    number;
  weekMuscles:    string[];
}

interface Summary {
  weekStreak:    number;
  totalWorkouts: number;
  totalHours:    number;
  monthlyCount:  number;
  monthByType:   { Push: number; Pull: number; Legs: number };
}

interface BodyMapData {
  latestWorkout:  WorkoutDetail | null;
  weeklyProgress: WeeklyProgress;
  summary:        Summary | null;
  recentWorkouts: WorkoutDetail[];
}

const CLASS_COLOR: Record<string, string> = {
  Push:  'var(--orange)',
  Pull:  '#5AC8FA',
  Legs:  '#34C759',
  Other: 'var(--gray-3)',
};
function classColor(cls: string) { return CLASS_COLOR[cls] ?? 'var(--gray-3)'; }

function formatDateLabel(d: string): string {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
  if (d === today) return 'Today';
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (d === yesterday.toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' })) return 'Yesterday';
  const dt = new Date(d + 'T12:00:00');
  return dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function formatLong(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
    timeZone: 'America/Los_Angeles',
  });
}

function WeekBar({ completed, target }: { completed: string[]; target: string[] }) {
  return (
    <div style={{ display: 'flex', gap: '6px' }}>
      {target.map((t, i) => {
        const done  = i < completed.length;
        const color = done ? classColor(completed[i]) : 'var(--gray-5)';
        return (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px' }}>
            <div style={{ width: '100%', height: '5px', borderRadius: 'var(--r-pill)', background: color, border: done ? 'none' : '1.5px solid var(--sep)' }} />
            <div style={{ fontSize: '8px', fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase', color: done ? color : 'var(--gray-4)' }}>{t}</div>
          </div>
        );
      })}
    </div>
  );
}

function StatChip({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', minWidth: '48px' }}>
      <div style={{ fontSize: '18px', fontWeight: 750, color: color ?? 'var(--black)', fontFamily: 'var(--font-geist-mono), monospace', letterSpacing: '-0.5px', lineHeight: 1 }}>
        {value}
      </div>
      <div style={{ fontSize: '8px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--gray-3)', whiteSpace: 'nowrap' }}>
        {label}
      </div>
    </div>
  );
}

const NAV_BTN: React.CSSProperties = {
  width: '36px', height: '36px', border: '1px solid var(--sep)',
  borderRadius: 'var(--r-md)', background: 'transparent', color: 'var(--gray-2)',
  fontSize: '16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
  flexShrink: 0,
};

const WORKOUT_TYPES = ['Push', 'Pull', 'Legs', 'Other'] as const;
type WorkoutType = typeof WORKOUT_TYPES[number];

export default function TrainingView() {
  const [data, setData]             = useState<BodyMapData | null>(null);
  const [weightHistory, setWeightHistory] = useState<WeightPoint[]>([]);
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
  const [selectedDate, setSelectedDate] = useState<string>(today);

  // Target editor state
  const [editing,    setEditing]    = useState(false);
  const [editTarget, setEditTarget] = useState<string[]>([]);
  const [saving,     setSaving]     = useState(false);

  // Manual pull state
  const [pulling, setPulling] = useState(false);
  const [pullMsg, setPullMsg] = useState<string | null>(null);

  // Workouts vs PRs sub-tab
  const [trainingTab, setTrainingTab] = useState<'workouts' | 'prs'>('workouts');

  async function loadBodyMap(): Promise<BodyMapData | null> {
    try {
      const r = await fetch(`/api/boostcamp/recent-body-map?_=${Date.now()}`, { cache: 'no-store' });
      return await r.json();
    } catch {
      return null;
    }
  }

  function applyData(d: BodyMapData) {
    setData(d);
    if (d.recentWorkouts?.[0]?.date && d.recentWorkouts[0].date !== today) {
      setSelectedDate(d.recentWorkouts[0].date);
    }
  }

  function fetchData() {
    loadBodyMap().then(d => { if (d) applyData(d); });
  }

  async function pullNow() {
    if (pulling) return;
    setPulling(true);
    setPullMsg(null);

    // Snapshot so we can detect when the new workout lands in Supabase.
    const beforeKey   = data?.recentWorkouts?.[0]?.loggedAt ?? '';
    const beforeCount = data?.recentWorkouts?.length ?? 0;

    try {
      const res = await fetch('/api/boostcamp/sync', { method: 'POST' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPullMsg(body.error ?? 'Pull failed');
        return;
      }

      // The service pulls in the background — poll for the result (~30s max).
      for (let i = 0; i < 12; i++) {
        await new Promise(r => setTimeout(r, 2500));
        const d = await loadBodyMap();
        if (!d) continue;
        const newKey   = d.recentWorkouts?.[0]?.loggedAt ?? '';
        const newCount = d.recentWorkouts?.length ?? 0;
        if (newKey !== beforeKey || newCount > beforeCount) {
          applyData(d);
          const label = d.recentWorkouts?.[0]?.date ? formatDateLabel(d.recentWorkouts[0].date) : 'latest';
          setPullMsg(`Pulled ${label}’s workout`);
          return;
        }
      }

      // Nothing new after polling — refresh anyway so any other changes show.
      const d = await loadBodyMap();
      if (d) applyData(d);
      setPullMsg('No new workouts found');
    } catch {
      setPullMsg('Pull failed');
    } finally {
      setPulling(false);
    }
  }

  useEffect(() => {
    fetchData();
    fetch('/api/weight?history=30', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => { if (Array.isArray(d.history)) setWeightHistory(d.history); })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-clear the pull status message a few seconds after it settles.
  useEffect(() => {
    if (!pullMsg || pulling) return;
    const t = setTimeout(() => setPullMsg(null), 5000);
    return () => clearTimeout(t);
  }, [pullMsg, pulling]);

  function startEditing() {
    setEditTarget(data?.weeklyProgress.target ?? ['Push', 'Pull', 'Push', 'Pull', 'Legs']);
    setEditing(true);
  }

  function cancelEditing() {
    setEditing(false);
    setEditTarget([]);
  }

  async function saveTarget() {
    if (editTarget.length === 0) return;
    setSaving(true);
    try {
      await fetch('/api/boostcamp/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weekly_target: editTarget }),
      });
      setEditing(false);
      fetchData();
    } catch {
      // silent fail — user can retry
    } finally {
      setSaving(false);
    }
  }

  // Build a fast lookup: date → workout
  const workoutByDate = useMemo(() => {
    const map = new Map<string, WorkoutDetail>();
    for (const w of data?.recentWorkouts ?? []) {
      if (!map.has(w.date)) map.set(w.date, w); // most recent per day wins
    }
    return map;
  }, [data]);

  const earliestDate = data?.recentWorkouts?.at(-1)?.date ?? today;

  function goBack() {
    const d = new Date(selectedDate + 'T12:00:00');
    d.setDate(d.getDate() - 1);
    setSelectedDate(d.toLocaleDateString('en-CA'));
  }
  function goForward() {
    if (selectedDate >= today) return;
    const d = new Date(selectedDate + 'T12:00:00');
    d.setDate(d.getDate() + 1);
    setSelectedDate(d.toLocaleDateString('en-CA'));
  }

  const wp       = data?.weeklyProgress;
  const summary  = data?.summary;
  const selected = workoutByDate.get(selectedDate) ?? null;
  const accentColor = selected ? classColor(selected.classification) : 'var(--gray-4)';
  const isToday  = selectedDate === today;
  const canGoBack = selectedDate > earliestDate;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: '14px 16px', gap: '10px', overflow: 'hidden', boxSizing: 'border-box' }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, gap: '10px' }}>
        <div style={{ fontSize: '10px', fontWeight: 850, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--gray-3)' }}>
          Training
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {pullMsg && (
            <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--gray-3)', whiteSpace: 'nowrap' }}>
              {pullMsg}
            </span>
          )}
          {wp && (
            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--gray-3)', whiteSpace: 'nowrap' }}>
              {wp.completedCount}/{wp.targetCount} this week
            </span>
          )}
          <button
            type="button"
            onClick={pullNow}
            disabled={pulling}
            title="Pull latest workout from Boostcamp"
            style={{
              display: 'flex', alignItems: 'center', gap: '5px',
              border: '1px solid var(--sep)', borderRadius: 'var(--r-md)',
              background: 'transparent', color: 'var(--gray-2)',
              fontSize: '11px', fontWeight: 750, padding: '5px 10px',
              cursor: pulling ? 'default' : 'pointer', opacity: pulling ? 0.6 : 1,
              WebkitTapHighlightColor: 'transparent', flexShrink: 0,
            }}
          >
            <span aria-hidden>↻</span>
            {pulling ? 'Pulling…' : 'Pull'}
          </button>
        </div>
      </div>

      {/* ── Workouts / PRs toggle ──────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
        {(['workouts', 'prs'] as const).map(t => (
          <button
            key={t}
            type="button"
            onClick={() => setTrainingTab(t)}
            style={{
              flex: 1, minHeight: '32px', borderRadius: 'var(--r-md)', cursor: 'pointer',
              border: '1px solid var(--sep)',
              background: trainingTab === t ? 'var(--blue)' : 'transparent',
              color: trainingTab === t ? '#fff' : 'var(--gray-3)',
              fontSize: '11px', fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            {t === 'workouts' ? 'Workouts' : 'PRs'}
          </button>
        ))}
      </div>

      {trainingTab === 'workouts' && (<>
      {/* ── Stats row ──────────────────────────────────────────────────────── */}
      {summary && (
        <div style={{ display: 'flex', gap: '16px', flexShrink: 0, overflowX: 'auto', paddingBottom: '2px' }}>
          <StatChip label="Week Streak" value={`${summary.weekStreak}w`} />
          <div style={{ width: '1px', background: 'var(--sep)', alignSelf: 'stretch' }} />
          <StatChip label="Total"       value={`${summary.totalWorkouts}`} />
          <StatChip label="Hours"       value={`${summary.totalHours}h`} />
          <div style={{ width: '1px', background: 'var(--sep)', alignSelf: 'stretch' }} />
          <StatChip label="This Month"  value={`${summary.monthlyCount}`} color="var(--blue)" />
          <div style={{ display: 'flex', gap: '10px' }}>
            <StatChip label="Push" value={`${summary.monthByType.Push}`} color={classColor('Push')} />
            <StatChip label="Pull" value={`${summary.monthByType.Pull}`} color={classColor('Pull')} />
            <StatChip label="Legs" value={`${summary.monthByType.Legs}`} color={classColor('Legs')} />
          </div>
        </div>
      )}

      {/* ── Weight chart ───────────────────────────────────────────────────── */}
      {weightHistory.length >= 2 && (
        <div style={{ flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '4px' }}>
            <div style={{ fontSize: '8px', fontWeight: 850, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--gray-4)' }}>
              Weight (30d)
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
              <span style={{ fontSize: '20px', fontWeight: 750, color: 'var(--black)', fontFamily: 'var(--font-geist-mono), monospace', letterSpacing: '-0.5px' }}>
                {weightHistory[weightHistory.length - 1].weight} lbs
              </span>
              {(() => {
                const delta = weightDeltaLabel(weightHistory);
                if (!delta) return null;
                const isLoss = delta.startsWith('−');
                const isGain = delta.startsWith('+');
                return (
                  <span style={{ fontSize: '13px', fontWeight: 700, color: isLoss ? 'var(--green)' : isGain ? 'var(--orange)' : 'var(--gray-3)' }}>
                    {delta}
                  </span>
                );
              })()}
            </div>
          </div>
          <WeightChart data={weightHistory} />
        </div>
      )}

      {/* ── Date navigator ─────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
        <button type="button" onClick={goBack} disabled={!canGoBack}
          style={{ ...NAV_BTN, opacity: canGoBack ? 1 : 0.2 }}>←</button>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <span style={{ fontSize: '13px', fontWeight: 700, color: selected ? accentColor : 'var(--gray-4)' }}>
            {formatDateLabel(selectedDate)}
          </span>
          {selected && (
            <span style={{ fontSize: '11px', color: 'var(--gray-3)', fontWeight: 600, marginLeft: '6px' }}>
              {selected.classification}
            </span>
          )}
          {!selected && (
            <span style={{ fontSize: '11px', color: 'var(--gray-4)', fontWeight: 500, marginLeft: '6px' }}>
              Rest day
            </span>
          )}
        </div>
        <button type="button" onClick={goForward} disabled={isToday}
          style={{ ...NAV_BTN, opacity: isToday ? 0.2 : 1 }}>→</button>
      </div>

      {/* ── Main: workout detail + body map ────────────────────────────────── */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr auto', gap: '16px', minHeight: 0 }}>

        {/* Left — workout info or rest day */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', minHeight: 0, overflowY: 'auto' }}>
          {selected ? (
            <>
              {/* Classification + date */}
              <div>
                <div style={{ fontSize: '40px', fontWeight: 800, letterSpacing: '-2px', lineHeight: 1, color: accentColor }}>
                  {selected.classification}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--gray-3)', fontWeight: 600, marginTop: '3px' }}>
                  {formatLong(selected.loggedAt)}
                </div>
              </div>

              {/* Muscle chips */}
              {selected.muscles.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                  {selected.muscles.map(m => (
                    <span key={m} style={{
                      fontSize: '10px', fontWeight: 700, padding: '2px 9px',
                      borderRadius: '99px', background: `${accentColor}22`, color: accentColor,
                      textTransform: 'capitalize',
                    }}>{m}</span>
                  ))}
                </div>
              )}

              {/* Exercise chips — horizontal wrap, nothing ever cut off */}
              {selected.exercises.length > 0 && (
                <div style={{ minHeight: 0 }}>
                  <div style={{ fontSize: '8px', fontWeight: 850, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--gray-4)', marginBottom: '6px' }}>
                    Exercises
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                    {selected.exercises.map((ex, i) => (
                      <span key={i} style={{
                        fontSize: '10px', fontWeight: 700,
                        padding: '3px 10px', borderRadius: '99px',
                        background: `${accentColor}1a`,
                        border: `1px solid ${accentColor}44`,
                        color: 'var(--gray-1)',
                        whiteSpace: 'nowrap',
                      }}>
                        {ex}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', paddingTop: '8px' }}>
              <div style={{ fontSize: '32px', fontWeight: 800, letterSpacing: '-1px', color: 'var(--gray-5)' }}>Rest</div>
              <div style={{ fontSize: '12px', color: 'var(--gray-4)', fontWeight: 600 }}>
                {isToday ? 'No workout logged today.' : 'No workout on this day.'}
              </div>
            </div>
          )}

          {/* Week bar / target editor — pinned to bottom */}
          {wp && (
            <div style={{ marginTop: 'auto', flexShrink: 0 }}>

              {!editing ? (
                /* ── Normal view ── */
                <>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '7px' }}>
                    <div style={{ fontSize: '8px', fontWeight: 850, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--gray-4)' }}>
                      This week
                    </div>
                    <button
                      type="button"
                      onClick={startEditing}
                      style={{ background: 'none', border: 'none', padding: '2px 4px', cursor: 'pointer', color: 'var(--gray-4)', fontSize: '12px', lineHeight: 1, WebkitTapHighlightColor: 'transparent' }}
                      title="Edit weekly target"
                    >
                      ✏️
                    </button>
                  </div>
                  <WeekBar completed={wp.completed} target={wp.target} />
                  <div style={{ marginTop: '8px', fontSize: '11px', fontWeight: 750, color: 'var(--gray-2)' }}>
                    Next: <span style={{ color: classColor(wp.nextFocus) }}>{wp.nextFocus}</span>
                  </div>
                </>
              ) : (
                /* ── Inline editor ── */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ fontSize: '8px', fontWeight: 850, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--blue)' }}>
                    Edit target
                  </div>

                  {/* Current target chips — tap × to remove */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', minHeight: '24px' }}>
                    {editTarget.map((t, i) => (
                      <span key={i} style={{
                        display: 'inline-flex', alignItems: 'center', gap: '4px',
                        fontSize: '10px', fontWeight: 700,
                        padding: '3px 8px 3px 10px', borderRadius: '99px',
                        background: `${classColor(t)}22`,
                        border: `1px solid ${classColor(t)}55`,
                        color: classColor(t),
                      }}>
                        {t}
                        <span
                          onClick={() => setEditTarget(prev => prev.filter((_, j) => j !== i))}
                          style={{ cursor: 'pointer', opacity: 0.7, fontSize: '11px', lineHeight: 1 }}
                        >×</span>
                      </span>
                    ))}
                    {editTarget.length === 0 && (
                      <span style={{ fontSize: '10px', color: 'var(--gray-4)', fontStyle: 'italic' }}>No days set</span>
                    )}
                  </div>

                  {/* Add buttons */}
                  <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                    {WORKOUT_TYPES.map(type => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setEditTarget(prev => [...prev, type])}
                        style={{
                          fontSize: '10px', fontWeight: 700,
                          padding: '3px 10px', borderRadius: '99px',
                          background: 'transparent',
                          border: `1px solid ${classColor(type)}55`,
                          color: classColor(type),
                          cursor: 'pointer',
                          WebkitTapHighlightColor: 'transparent',
                        }}
                      >
                        + {type}
                      </button>
                    ))}
                  </div>

                  {/* Save / Cancel */}
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      type="button"
                      onClick={saveTarget}
                      disabled={saving || editTarget.length === 0}
                      style={{
                        flex: 1, fontSize: '10px', fontWeight: 800,
                        padding: '5px', borderRadius: 'var(--r-sm)',
                        background: editTarget.length === 0 ? 'var(--gray-6)' : 'var(--blue)',
                        border: 'none', color: '#fff', cursor: editTarget.length === 0 ? 'not-allowed' : 'pointer',
                        opacity: saving ? 0.6 : 1,
                        WebkitTapHighlightColor: 'transparent',
                      }}
                    >
                      {saving ? 'Saving…' : 'Save'}
                    </button>
                    <button
                      type="button"
                      onClick={cancelEditing}
                      style={{
                        flex: 1, fontSize: '10px', fontWeight: 700,
                        padding: '5px', borderRadius: 'var(--r-sm)',
                        background: 'var(--gray-6)', border: '1px solid var(--sep)',
                        color: 'var(--gray-2)', cursor: 'pointer',
                        WebkitTapHighlightColor: 'transparent',
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right — body map */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <BodyMapSVG
            muscles={selected?.muscles ?? []}
            accentColor={accentColor}
            size={110}
          />
        </div>
      </div>
      </>)}

      {trainingTab === 'prs' && <PRPanel />}
    </div>
  );
}
