'use client';

import { useEffect, useRef, useState } from 'react';
import { BigGoal, ProgressType } from './BigGoalsCard';

function progressColor(p: number): string {
  if (p >= 100) return 'var(--green)';
  if (p > 0)    return 'var(--orange)';
  return 'var(--gray-4)';
}

function computeProgress(g: Partial<BigGoal> & { progress_type: ProgressType }): number {
  switch (g.progress_type) {
    case 'weight': {
      const start = parseFloat(g.milestone ?? '0');
      const cur   = (g.count_current && g.count_current > 0) ? g.count_current : start; // 0 = not yet logged
      const tgt   = g.count_target  ?? 0;
      if (start <= tgt || start <= 0) return 0;
      return Math.min(100, Math.max(0, Math.round(((start - cur) / (start - tgt)) * 100)));
    }
    case 'count': {
      const cur = g.count_current ?? 0;
      const tgt = g.count_target  ?? 1;
      return tgt > 0 ? Math.min(100, Math.round((cur / tgt) * 100)) : 0;
    }
    case 'milestone': {
      const stages = g.milestones ?? [];
      if (stages.length === 0) return 0;
      const idx = g.milestone_index ?? 0;
      return Math.round(((idx + 1) / stages.length) * 100);
    }
    case 'done':
      return (g.progress ?? 0) >= 100 ? 100 : 0;
    default:
      return g.progress ?? 0;
  }
}

const TYPE_LABELS: { id: ProgressType; label: string }[] = [
  { id: 'percent',   label: '%'     },
  { id: 'count',     label: '1/n'   },
  { id: 'milestone', label: 'Steps' },
  { id: 'done',      label: '✓'     },
  { id: 'weight',    label: '⚖'     },
];

function TypePicker({ value, onChange }: { value: ProgressType; onChange: (t: ProgressType) => void }) {
  return (
    <div style={{ display: 'flex', gap: '5px' }}>
      {TYPE_LABELS.map(t => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          style={{
            minHeight: '44px', padding: '0 12px', fontSize: '11px', fontWeight: 800,
            borderRadius: 'var(--r-md)', cursor: 'pointer',
            border:      `1px solid ${value === t.id ? 'var(--blue)' : 'var(--sep)'}`,
            background:  value === t.id ? 'var(--blue)' : 'transparent',
            color:       value === t.id ? '#fff' : 'var(--gray-3)',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

function GoalCard({ goal, onUpdate, onDelete }: {
  goal:     BigGoal;
  onUpdate: (id: string, patch: Partial<BigGoal>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [title,          setTitle]         = useState(goal.title);
  const [note,           setNote]          = useState(goal.milestone ?? '');
  const [pType,          setPType]         = useState<ProgressType>(goal.progress_type ?? 'percent');
  const [progress,       setProgress]      = useState(goal.progress);
  const [countCurrent,   setCountCurrent]  = useState(goal.count_current ?? 0);
  const [countTarget,    setCountTarget]   = useState(goal.count_target  ?? 100);
  const [stages,         setStages]        = useState<string[]>(goal.milestones ?? []);
  const [stageIdx,       setStageIdx]      = useState(goal.milestone_index ?? 0);
  const [newStage,       setNewStage]      = useState('');
  const [editingTitle,   setEditingTitle]  = useState(false);
  const [editingTarget,  setEditingTarget] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSaving  = useRef(false);

  // Sync from confirmed DB value after save completes — but only when not mid-edit
  useEffect(() => {
    if (isSaving.current) return;
    setTitle(goal.title);
    setNote(goal.milestone ?? '');
    setPType(goal.progress_type ?? 'percent');
    setProgress(goal.progress);
    setCountCurrent(goal.count_current ?? 0);
    setCountTarget(goal.count_target  ?? 100);
    setStages(goal.milestones ?? []);
    setStageIdx(goal.milestone_index ?? 0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goal.progress, goal.count_current, goal.count_target, goal.milestone_index, goal.progress_type]);

  function save(patch: Partial<BigGoal>) {
    isSaving.current = true;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      await onUpdate(goal.id, patch);
      isSaving.current = false;
    }, 500);
  }

  function changeType(t: ProgressType) {
    setPType(t);
    const newProgress = computeProgress({ ...goal, progress_type: t, progress, count_current: countCurrent, count_target: countTarget, milestones: stages, milestone_index: stageIdx });
    setProgress(newProgress);
    save({ progress_type: t, progress: newProgress });
  }

  function setPercent(p: number) {
    setProgress(p);
    save({ progress: p });
  }

  function changeCount(cur: number, tgt?: number) {
    const newCur = Math.max(0, cur);
    const newTgt = tgt !== undefined ? Math.max(1, tgt) : countTarget;
    setCountCurrent(newCur);
    if (tgt !== undefined) setCountTarget(newTgt);
    const p = Math.min(100, Math.round((newCur / newTgt) * 100));
    setProgress(p);
    save({ count_current: newCur, count_target: newTgt, progress: p });
  }

  function selectStage(idx: number) {
    setStageIdx(idx);
    const p = stages.length > 0 ? Math.round(((idx + 1) / stages.length) * 100) : 0;
    setProgress(p);
    save({ milestone_index: idx, progress: p });
  }

  function addStage() {
    if (!newStage.trim()) return;
    const updated = [...stages, newStage.trim()];
    setStages(updated);
    setNewStage('');
    const p = updated.length > 0 ? Math.round(((stageIdx + 1) / updated.length) * 100) : 0;
    setProgress(p);
    save({ milestones: updated, progress: p });
  }

  function removeStage(i: number) {
    const updated = stages.filter((_, idx) => idx !== i);
    const newIdx  = Math.min(stageIdx, Math.max(0, updated.length - 1));
    setStages(updated);
    setStageIdx(newIdx);
    const p = updated.length > 0 ? Math.round(((newIdx + 1) / updated.length) * 100) : 0;
    setProgress(p);
    save({ milestones: updated, milestone_index: newIdx, progress: p });
  }

  function toggleDone() {
    const p = progress >= 100 ? 0 : 100;
    setProgress(p);
    save({ progress: p });
  }

  const color = progressColor(progress);
  const isDone = progress >= 100;

  return (
    <div style={{ background: 'var(--card)', borderRadius: 'var(--r-lg)', border: '1px solid var(--sep)', boxShadow: 'var(--shadow)', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: '10px' }}>

      {/* Title row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        {editingTitle ? (
          <input autoFocus value={title}
            onChange={e => { setTitle(e.target.value); save({ title: e.target.value }); }}
            onBlur={() => setEditingTitle(false)}
            onKeyDown={e => { if (e.key === 'Enter') setEditingTitle(false); }}
            style={{ flex: 1, fontSize: '15px', fontWeight: 750, color: 'var(--black)', background: 'var(--gray-6)', border: '1px solid var(--sep)', borderRadius: 'var(--r-md)', padding: '6px 10px', outline: 'none' }}
          />
        ) : (
          <div onClick={() => setEditingTitle(true)} style={{ flex: 1, fontSize: '15px', fontWeight: 750, color: isDone ? 'var(--gray-3)' : 'var(--black)', textDecoration: isDone ? 'line-through' : 'none', cursor: 'text' }}>
            {title}
          </div>
        )}
        <div style={{ fontSize: '13px', fontWeight: 800, color, minWidth: '42px', textAlign: 'right', flexShrink: 0 }}>
          {pType === 'weight' ? (countCurrent > 0 ? `${countCurrent} lbs` : '—') : pType === 'count' ? `${countCurrent}/${countTarget}` : pType === 'milestone' && stages.length > 0 ? stages[stageIdx] ?? '—' : isDone ? 'done' : pType === 'done' ? '—' : `${progress}%`}
        </div>
        <button onClick={() => onDelete(goal.id)} style={{ minWidth: '44px', minHeight: '44px', border: 'none', background: 'transparent', color: 'var(--gray-4)', fontSize: '16px', cursor: 'pointer', borderRadius: 'var(--r-sm)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', WebkitTapHighlightColor: 'transparent' }}>✕</button>
      </div>

      {/* Progress bar */}
      <div style={{ height: '6px', borderRadius: 'var(--r-pill)', background: 'var(--gray-6)', overflow: 'hidden' }}>
        <div style={{ width: `${progress}%`, height: '100%', background: color, borderRadius: 'var(--r-pill)', transition: 'width 0.25s ease-out' }} />
      </div>

      {/* Type picker */}
      <TypePicker value={pType} onChange={changeType} />

      {/* Type-specific editor */}
      {pType === 'percent' && (
        <div style={{ display: 'flex', gap: '5px' }}>
          {[0, 25, 50, 75, 100].map(p => (
            <button key={p} onClick={() => setPercent(p)} style={{ flex: 1, minHeight: '44px', fontSize: '11px', fontWeight: 800, border: `1px solid ${progress === p ? color : 'var(--sep)'}`, borderRadius: 'var(--r-md)', background: progress === p ? `${color}22` : 'transparent', color: progress === p ? color : 'var(--gray-3)', cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}>
              {p === 100 ? '✓' : `${p}%`}
            </button>
          ))}
        </div>
      )}

      {pType === 'count' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button onClick={() => changeCount(countCurrent - 1)} style={{ minWidth: '44px', minHeight: '44px', border: '1px solid var(--sep)', borderRadius: 'var(--r-md)', background: 'transparent', fontSize: '20px', color: 'var(--gray-2)', cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}>−</button>
          <div style={{ flex: 1, textAlign: 'center', fontSize: '20px', fontWeight: 800, fontFamily: 'var(--font-geist-mono), monospace', color: color, letterSpacing: '-0.5px' }}>
            {countCurrent}
          </div>
          <button onClick={() => changeCount(countCurrent + 1)} style={{ minWidth: '44px', minHeight: '44px', border: '1px solid var(--sep)', borderRadius: 'var(--r-md)', background: 'transparent', fontSize: '20px', color: 'var(--gray-2)', cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}>+</button>
          <div style={{ fontSize: '11px', color: 'var(--gray-3)', fontWeight: 600 }}>of</div>
          {editingTarget ? (
            <input autoFocus type="number" value={countTarget}
              onChange={e => changeCount(countCurrent, parseInt(e.target.value) || 1)}
              onBlur={() => setEditingTarget(false)}
              style={{ width: '52px', fontSize: '14px', fontWeight: 700, textAlign: 'center', background: 'var(--gray-6)', border: '1px solid var(--sep)', borderRadius: 'var(--r-md)', padding: '4px', outline: 'none', color: 'var(--gray-2)' }}
            />
          ) : (
            <div onClick={() => setEditingTarget(true)} style={{ fontSize: '14px', fontWeight: 700, color: 'var(--gray-3)', cursor: 'text', minWidth: '28px', textAlign: 'center' }}>{countTarget}</div>
          )}
        </div>
      )}

      {pType === 'milestone' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
            {stages.map((s, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                <button onClick={() => selectStage(i)} style={{ minHeight: '44px', padding: '0 12px', fontSize: '12px', fontWeight: 700, borderRadius: 'var(--r-pill)', border: `1px solid ${i === stageIdx ? color : 'var(--sep)'}`, background: i === stageIdx ? `${color}22` : 'transparent', color: i === stageIdx ? color : 'var(--gray-3)', cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}>
                  {s}
                </button>
                <button onClick={() => removeStage(i)} style={{ minWidth: '44px', minHeight: '44px', border: 'none', background: 'transparent', color: 'var(--gray-4)', fontSize: '16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', WebkitTapHighlightColor: 'transparent' }}>✕</button>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            <input value={newStage} onChange={e => setNewStage(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addStage(); }} placeholder="Add stage…" style={{ flex: 1, fontSize: '11px', color: 'var(--black)', background: 'var(--gray-6)', border: '1px solid var(--sep)', borderRadius: 'var(--r-md)', padding: '6px 10px', outline: 'none' }} />
            <button onClick={addStage} style={{ minWidth: '44px', minHeight: '44px', background: 'var(--blue)', color: '#fff', border: 'none', borderRadius: 'var(--r-md)', fontSize: '18px', fontWeight: 800, cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}>+</button>
          </div>
        </div>
      )}

      {pType === 'done' && (
        <button onClick={toggleDone} style={{ width: '100%', minHeight: '44px', border: `2px solid ${isDone ? 'var(--green)' : 'var(--sep)'}`, borderRadius: 'var(--r-md)', background: isDone ? 'rgba(52,199,89,0.1)' : 'transparent', color: isDone ? 'var(--green)' : 'var(--gray-3)', fontSize: '16px', fontWeight: 800, cursor: 'pointer', transition: 'all 0.15s' }}>
          {isDone ? '✓ Complete' : 'Mark complete'}
        </button>
      )}

      {pType === 'weight' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '10px', color: 'var(--gray-3)', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '5px' }}>Start</div>
              <input
                type="number"
                value={note}
                onChange={e => {
                  setNote(e.target.value);
                  const start = parseFloat(e.target.value || '0');
                  const cur   = (countCurrent > 0) ? countCurrent : start;
                  const p = start > countTarget && start > 0
                    ? Math.min(100, Math.max(0, Math.round(((start - cur) / (start - countTarget)) * 100)))
                    : 0;
                  setProgress(p);
                  save({ milestone: e.target.value, progress: p });
                }}
                placeholder="175"
                style={{ width: '100%', minHeight: '44px', fontSize: '16px', fontWeight: 700, textAlign: 'center', background: 'var(--gray-6)', border: '1px solid var(--sep)', borderRadius: 'var(--r-md)', padding: '8px', outline: 'none', color: 'var(--gray-2)' }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '10px', color: 'var(--gray-3)', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '5px' }}>Goal</div>
              <input
                type="number"
                value={countTarget}
                onChange={e => {
                  const tgt   = parseFloat(e.target.value || '0');
                  setCountTarget(tgt);
                  const start = parseFloat(note || '0');
                  const cur   = (countCurrent > 0) ? countCurrent : start;
                  const p = start > tgt && start > 0
                    ? Math.min(100, Math.max(0, Math.round(((start - cur) / (start - tgt)) * 100)))
                    : 0;
                  setProgress(p);
                  save({ count_target: tgt, progress: p });
                }}
                placeholder="155"
                style={{ width: '100%', minHeight: '44px', fontSize: '16px', fontWeight: 700, textAlign: 'center', background: 'var(--gray-6)', border: '1px solid var(--sep)', borderRadius: 'var(--r-md)', padding: '8px', outline: 'none', color: 'var(--gray-2)' }}
              />
            </div>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--gray-4)', fontWeight: 600, fontStyle: 'italic' }}>
            Current: {countCurrent > 0 ? `${countCurrent} lbs` : 'not yet logged'} — updates via Training card or Discord
          </div>
        </div>
      )}

      {/* Freetext note — hidden for weight type (milestone field used for start weight) */}
      {pType !== 'weight' && (
        <input value={note} onChange={e => { setNote(e.target.value); save({ milestone: e.target.value }); }} placeholder="Note or current milestone…" style={{ fontSize: '12px', color: 'var(--gray-2)', background: 'var(--gray-6)', border: '1px solid var(--sep)', borderRadius: 'var(--r-md)', padding: '8px 12px', outline: 'none', fontStyle: note ? 'italic' : 'normal' }} />
      )}
    </div>
  );
}

export default function GoalsView() {
  const [goals,    setGoals]    = useState<BigGoal[]>([]);
  const [adding,   setAdding]   = useState(false);
  const [newTitle, setNewTitle] = useState('');

  async function load() {
    const r = await fetch('/api/big-goals');
    if (r.ok) setGoals(await r.json());
  }

  useEffect(() => { load(); }, []);

  async function handleUpdate(id: string, patch: Partial<BigGoal>) {
    const res = await fetch(`/api/big-goals/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) });
    if (res.ok) {
      // Update only this goal in state with confirmed DB values — avoids full reload race
      const updated: BigGoal = await res.json();
      setGoals(prev => prev.map(g => g.id === id ? updated : g));
    }
  }

  async function handleDelete(id: string) {
    await fetch(`/api/big-goals/${id}`, { method: 'DELETE' });
    load();
  }

  async function handleAdd() {
    if (!newTitle.trim()) return;
    await fetch('/api/big-goals', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: newTitle.trim() }) });
    setNewTitle(''); setAdding(false); load();
  }

  const doneCount = goals.filter(g => g.progress >= 100).length;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: '16px', gap: '12px', overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexShrink: 0 }}>
        <div style={{ fontSize: '10px', fontWeight: 850, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--gray-3)' }}>2026 Goals</div>
        <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--gray-3)' }}>{doneCount} / {goals.length} complete</div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {goals.map(g => <GoalCard key={g.id} goal={g} onUpdate={handleUpdate} onDelete={handleDelete} />)}

        {adding ? (
          <div style={{ display: 'flex', gap: '8px' }}>
            <input autoFocus value={newTitle} onChange={e => setNewTitle(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') setAdding(false); }} placeholder="Goal title…" style={{ flex: 1, fontSize: '13px', color: 'var(--black)', background: 'var(--gray-6)', border: '1px solid var(--sep)', borderRadius: 'var(--r-md)', padding: '10px 12px', outline: 'none' }} />
            <button onClick={handleAdd} style={{ padding: '10px 16px', background: 'var(--blue)', color: '#fff', border: 'none', borderRadius: 'var(--r-md)', fontSize: '12px', fontWeight: 800, cursor: 'pointer' }}>Add</button>
            <button onClick={() => setAdding(false)} style={{ padding: '10px 12px', background: 'transparent', color: 'var(--gray-3)', border: '1px solid var(--sep)', borderRadius: 'var(--r-md)', fontSize: '12px', cursor: 'pointer' }}>✕</button>
          </div>
        ) : (
          <button onClick={() => setAdding(true)} style={{ width: '100%', minHeight: '44px', border: '1px dashed var(--gray-5)', borderRadius: 'var(--r-lg)', background: 'transparent', color: 'var(--gray-3)', fontSize: '13px', fontWeight: 750, cursor: 'pointer' }}>
            + Add goal
          </button>
        )}
      </div>
    </div>
  );
}
