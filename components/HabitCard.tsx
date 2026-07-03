'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Habit, HabitLog } from '@/types/database';

interface HabitCardProps {
  habits: Habit[];
  logs: HabitLog[];
  onToggle: (habitId: string, date?: string) => Promise<void>;
  onSkip?: (habitId: string, date?: string) => Promise<void>;
  onAddHabit?: (name: string, period: 'AM' | 'PM', emoji?: string) => Promise<void>;
  onDeleteHabit?: (id: string) => Promise<void>;
  onEditHabit?: (id: string, name: string, emoji: string | null) => Promise<void>;
  onRestoreHabit?: (id: string) => Promise<void>;
  onNavigate?: () => void;
  showFull?: boolean;
}

export default function HabitCard({
  habits, logs, onToggle, onSkip, onAddHabit, onDeleteHabit, onEditHabit, onRestoreHabit, onNavigate, showFull = false,
}: HabitCardProps) {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });

  // ── Date navigation ────────────────────────────────────────────────────────
  const [selectedDate, setSelectedDate] = useState(today);
  const isToday = selectedDate === today;

  function goBack() {
    const d = new Date(selectedDate + 'T12:00:00');
    d.setDate(d.getDate() - 1);
    setSelectedDate(d.toLocaleDateString('en-CA'));
  }
  function goForward() {
    if (isToday) return;
    const d = new Date(selectedDate + 'T12:00:00');
    d.setDate(d.getDate() + 1);
    setSelectedDate(d.toLocaleDateString('en-CA'));
  }

  // ── Log state for selected date ────────────────────────────────────────────
  const completedIds = new Set(
    logs.filter(l => l.date === selectedDate && l.type !== 'skip').map(l => l.habit_id),
  );
  const skippedIds = new Set(
    logs.filter(l => l.date === selectedDate && l.type === 'skip').map(l => l.habit_id),
  );

  // ── Drag order ─────────────────────────────────────────────────────────────
  const draggingRef = useRef(false);
  const [amOrder, setAmOrder] = useState<string[]>([]);
  const [pmOrder, setPmOrder] = useState<string[]>([]);

  useEffect(() => {
    if (draggingRef.current) return;
    setAmOrder(
      habits.filter(h => h.period === 'AM' && !h.deleted_at)
        .sort((a, b) => a.order - b.order).map(h => h.id),
    );
    setPmOrder(
      habits.filter(h => h.period === 'PM' && !h.deleted_at)
        .sort((a, b) => a.order - b.order).map(h => h.id),
    );
  }, [habits]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 10 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
  );

  function handleDragEnd(event: DragEndEvent, period: 'AM' | 'PM') {
    draggingRef.current = false;
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const setter = period === 'AM' ? setAmOrder : setPmOrder;
    setter(prev => {
      const oldIdx = prev.indexOf(active.id as string);
      const newIdx = prev.indexOf(over.id as string);
      const next = arrayMove(prev, oldIdx, newIdx);
      next.forEach((id, idx) => {
        fetch(`/api/habits/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ order: idx }),
        }).catch(() => {});
      });
      return next;
    });
  }

  // ── Add form ───────────────────────────────────────────────────────────────
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPeriod, setNewPeriod] = useState<'AM' | 'PM'>('AM');
  const [newEmoji, setNewEmoji] = useState('');

  const handleAdd = useCallback(async () => {
    if (!newName.trim() || !onAddHabit) return;
    await onAddHabit(newName.trim(), newPeriod, newEmoji.trim() || undefined);
    setNewName('');
    setNewEmoji('');
    setAdding(false);
  }, [newName, newPeriod, newEmoji, onAddHabit]);

  // ── Inline edit ────────────────────────────────────────────────────────────
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmoji, setEditEmoji] = useState('');

  function startEdit(habit: Habit) {
    setEditingId(habit.id);
    setEditName(habit.name);
    setEditEmoji(habit.emoji ?? '');
  }
  async function saveEdit() {
    if (!editingId || !onEditHabit) return;
    await onEditHabit(editingId, editName.trim() || 'Habit', editEmoji.trim() || null);
    setEditingId(null);
  }

  // ── Archived section ───────────────────────────────────────────────────────
  const [showArchived, setShowArchived] = useState(false);
  const [archivedHabits, setArchivedHabits] = useState<Habit[]>([]);
  const [loadingArchived, setLoadingArchived] = useState(false);

  async function loadArchived() {
    setLoadingArchived(true);
    try {
      const res = await fetch(`/api/habits/archived?_=${Date.now()}`, { cache: 'no-store' });
      if (res.ok) setArchivedHabits(await res.json());
    } finally {
      setLoadingArchived(false);
    }
  }
  function toggleArchived() {
    const next = !showArchived;
    setShowArchived(next);
    if (next) loadArchived();
  }

  // ── Stats ──────────────────────────────────────────────────────────────────
  const activeHabits = habits.filter(h => !h.deleted_at);
  const doneCount = activeHabits.filter(h => completedIds.has(h.id)).length;
  const totalCount = activeHabits.length;
  const completionPct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  // ── Streak (skip = continue, neither = break) ──────────────────────────────
  function calcStreak(habitId: string): number {
    const logsByDate = new Map<string, string>();
    for (const l of logs) {
      if (l.habit_id === habitId) logsByDate.set(l.date, l.type ?? 'done');
    }
    if (logsByDate.size === 0) return 0;
    let streak = 0;
    const cursor = new Date();
    const todayStr = cursor.toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
    if (logsByDate.get(todayStr) !== 'done') cursor.setDate(cursor.getDate() - 1);
    for (let i = 0; i < 365; i++) {
      const d = cursor.toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
      const t = logsByDate.get(d);
      if (t === 'done') { streak++; cursor.setDate(cursor.getDate() - 1); }
      else if (t === 'skip') { cursor.setDate(cursor.getDate() - 1); }
      else break;
    }
    return streak;
  }

  // ── Build ordered habit lists from local drag state ────────────────────────
  const habitMap = new Map(habits.map(h => [h.id, h]));
  const amHabits = amOrder.map(id => habitMap.get(id)).filter(Boolean) as Habit[];
  const pmHabits = pmOrder.map(id => habitMap.get(id)).filter(Boolean) as Habit[];

  // ── Date label ─────────────────────────────────────────────────────────────
  function formatDateLabel(d: string) {
    if (d === today) return 'Today';
    const dt = new Date(d + 'T12:00:00');
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    if (d === yesterday.toLocaleDateString('en-CA')) return 'Yesterday';
    return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  return (
    <section style={{
      background: 'var(--card)', borderRadius: 'var(--r-lg)', boxShadow: 'var(--shadow)',
      border: '1px solid var(--sep)', display: 'flex', flexDirection: 'column',
      height: '100%', minHeight: 0, overflow: 'hidden', position: 'relative',
    }}>
      {/* Expand arrow (dashboard only) */}
      {onNavigate && (
        <span onClick={onNavigate} style={{
          position: 'absolute', top: 0, right: 0, minWidth: '44px', minHeight: '44px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '20px', opacity: 0.5, cursor: 'pointer',
          WebkitTapHighlightColor: 'transparent', zIndex: 1,
        }}>↗</span>
      )}

      {/* Header */}
      <div style={{ padding: '14px 12px 8px', flexShrink: 0 }}>
        <div style={{ fontSize: '10px', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--gray-3)' }}>Habits</div>
        <div style={{ marginTop: '3px', fontSize: '20px', fontWeight: 750, letterSpacing: '-0.6px', color: 'var(--black)', fontFamily: 'var(--font-geist-mono), monospace' }}>
          {doneCount}/{totalCount}
        </div>
        <div style={{ marginTop: '9px', height: '5px', borderRadius: 'var(--r-pill)', background: 'var(--gray-6)', overflow: 'hidden' }}>
          <div style={{ width: `${completionPct}%`, height: '100%', background: completionPct === 100 ? 'var(--green)' : 'var(--orange)', borderRadius: 'var(--r-pill)', transition: 'width 0.25s ease-out' }} />
        </div>
      </div>

      {/* Date navigator (full mode only) */}
      {showFull && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '0 12px 8px', flexShrink: 0 }}>
          <button type="button" onClick={goBack} style={NAV_BTN}>←</button>
          <span style={{ flex: 1, textAlign: 'center', fontSize: '12px', fontWeight: 700, color: isToday ? 'var(--black)' : 'var(--blue)' }}>
            {formatDateLabel(selectedDate)}
          </span>
          <button type="button" onClick={goForward} disabled={isToday} style={{ ...NAV_BTN, opacity: isToday ? 0.25 : 1 }}>→</button>
        </div>
      )}

      {/* Scrollable body */}
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, padding: '0 8px 8px' }}>

        {/* AM group */}
        <HabitGroup label="AM" color="var(--orange)">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={() => { draggingRef.current = true; }}
            onDragEnd={e => handleDragEnd(e, 'AM')}
          >
            <SortableContext items={amOrder} strategy={verticalListSortingStrategy}>
              {amHabits.map(habit => (
                <SortableHabitRow
                  key={habit.id}
                  habit={habit}
                  done={completedIds.has(habit.id)}
                  skipped={skippedIds.has(habit.id)}
                  streak={calcStreak(habit.id)}
                  accentColor="var(--orange)"
                  onToggle={onToggle}
                  onSkip={onSkip}
                  onDelete={showFull ? onDeleteHabit : undefined}
                  showFull={showFull}
                  editing={editingId === habit.id}
                  editName={editName}
                  editEmoji={editEmoji}
                  onStartEdit={() => startEdit(habit)}
                  onEditName={setEditName}
                  onEditEmoji={setEditEmoji}
                  onSaveEdit={saveEdit}
                  onCancelEdit={() => setEditingId(null)}
                  selectedDate={selectedDate}
                />
              ))}
            </SortableContext>
          </DndContext>
        </HabitGroup>

        {/* PM group */}
        <HabitGroup label="PM" color="var(--indigo)" top>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={() => { draggingRef.current = true; }}
            onDragEnd={e => handleDragEnd(e, 'PM')}
          >
            <SortableContext items={pmOrder} strategy={verticalListSortingStrategy}>
              {pmHabits.map(habit => (
                <SortableHabitRow
                  key={habit.id}
                  habit={habit}
                  done={completedIds.has(habit.id)}
                  skipped={skippedIds.has(habit.id)}
                  streak={calcStreak(habit.id)}
                  accentColor="var(--indigo)"
                  onToggle={onToggle}
                  onSkip={onSkip}
                  onDelete={showFull ? onDeleteHabit : undefined}
                  showFull={showFull}
                  editing={editingId === habit.id}
                  editName={editName}
                  editEmoji={editEmoji}
                  onStartEdit={() => startEdit(habit)}
                  onEditName={setEditName}
                  onEditEmoji={setEditEmoji}
                  onSaveEdit={saveEdit}
                  onCancelEdit={() => setEditingId(null)}
                  selectedDate={selectedDate}
                />
              ))}
            </SortableContext>
          </DndContext>
        </HabitGroup>

        {/* Add habit */}
        {showFull && onAddHabit && (
          adding ? (
            <div style={{ padding: '8px 4px 4px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', gap: '6px' }}>
                <input
                  autoFocus
                  value={newEmoji}
                  onChange={e => setNewEmoji(e.target.value)}
                  placeholder="😀"
                  maxLength={2}
                  style={{ ...INPUT_STYLE, width: '52px', textAlign: 'center', fontSize: '18px' }}
                />
                <input
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') setAdding(false); }}
                  placeholder="Habit name"
                  style={{ ...INPUT_STYLE, flex: 1 }}
                />
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                {(['AM', 'PM'] as const).map(p => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setNewPeriod(p)}
                    style={{
                      flex: 1, minHeight: '44px', borderRadius: 'var(--r-md)',
                      border: `1px solid ${p === 'AM' ? 'var(--orange)' : 'var(--indigo)'}`,
                      background: newPeriod === p ? (p === 'AM' ? 'var(--orange)' : 'var(--indigo)') : 'transparent',
                      color: newPeriod === p ? 'var(--bg)' : (p === 'AM' ? 'var(--orange)' : 'var(--indigo)'),
                      fontWeight: 800, fontSize: '11px', cursor: 'pointer',
                    }}
                  >{p}</button>
                ))}
                <button
                  type="button"
                  onClick={handleAdd}
                  style={{ flex: 1.5, minHeight: '44px', borderRadius: 'var(--r-md)', border: 'none', background: 'var(--blue)', color: 'var(--bg)', fontWeight: 800, fontSize: '12px', cursor: 'pointer' }}
                >Add</button>
                <button
                  type="button"
                  onClick={() => setAdding(false)}
                  style={{ width: '44px', minHeight: '44px', borderRadius: 'var(--r-md)', border: '1px solid var(--sep)', background: 'transparent', color: 'var(--gray-3)', fontWeight: 800, fontSize: '14px', cursor: 'pointer' }}
                >✕</button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setAdding(true)}
              style={{ width: '100%', minHeight: '44px', marginTop: '8px', border: '1px dashed var(--gray-5)', borderRadius: 'var(--r-md)', background: 'transparent', color: 'var(--gray-3)', fontSize: '12px', fontWeight: 750, cursor: 'pointer' }}
            >+ Add habit</button>
          )
        )}

        {/* Archived section (full mode only) */}
        {showFull && (
          <div style={{ marginTop: '12px' }}>
            <button
              type="button"
              onClick={toggleArchived}
              style={{ width: '100%', minHeight: '36px', border: 'none', background: 'transparent', color: 'var(--gray-3)', fontSize: '11px', fontWeight: 750, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', padding: '0 4px' }}
            >
              <span style={{ transform: showArchived ? 'rotate(90deg)' : 'rotate(0)', display: 'inline-block', transition: 'transform 0.15s' }}>▶</span>
              Archived habits {archivedHabits.length > 0 && !loadingArchived ? `(${archivedHabits.length})` : ''}
            </button>
            {showArchived && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', padding: '4px 0' }}>
                {loadingArchived && <div style={{ fontSize: '11px', color: 'var(--gray-3)', padding: '8px 4px' }}>Loading…</div>}
                {!loadingArchived && archivedHabits.length === 0 && (
                  <div style={{ fontSize: '11px', color: 'var(--gray-4)', padding: '8px 4px' }}>No archived habits.</div>
                )}
                {archivedHabits.map(habit => (
                  <div key={habit.id} style={{ display: 'flex', alignItems: 'center', minHeight: '44px', borderRadius: 'var(--r-md)', background: 'var(--gray-6)', border: '1px solid var(--sep)', padding: '0 8px', gap: '8px', opacity: 0.7 }}>
                    {habit.emoji && <span style={{ fontSize: '16px' }}>{habit.emoji}</span>}
                    <span style={{ flex: 1, fontSize: '12px', color: 'var(--gray-3)', textDecoration: 'line-through' }}>{habit.name}</span>
                    <span style={{ fontSize: '9px', color: 'var(--gray-4)', textTransform: 'uppercase', fontWeight: 700 }}>{habit.period}</span>
                    {onRestoreHabit && (
                      <button
                        type="button"
                        onClick={() => {
                          onRestoreHabit(habit.id);
                          setArchivedHabits(prev => prev.filter(h => h.id !== habit.id));
                        }}
                        style={{ height: '32px', padding: '0 10px', borderRadius: 'var(--r-md)', border: '1px solid var(--sep)', background: 'transparent', color: 'var(--blue)', fontSize: '11px', fontWeight: 750, cursor: 'pointer' }}
                      >Restore</button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const NAV_BTN: React.CSSProperties = {
  width: '32px', height: '32px', border: '1px solid var(--sep)',
  borderRadius: 'var(--r-md)', background: 'transparent', color: 'var(--gray-2)',
  fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
};

const INPUT_STYLE: React.CSSProperties = {
  fontSize: '13px', color: 'var(--black)', background: 'var(--gray-6)',
  border: '1px solid var(--sep)', borderRadius: 'var(--r-md)',
  padding: '10px 11px', outline: 'none',
};

// ── Sub-components ─────────────────────────────────────────────────────────────

function HabitGroup({ label, color, top, children }: { label: string; color: string; top?: boolean; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: top ? '10px' : '0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 4px 5px' }}>
        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: color }} />
        <span style={{ fontSize: '9px', fontWeight: 850, letterSpacing: '0.1em', textTransform: 'uppercase', color }}>{label}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>{children}</div>
    </div>
  );
}

interface RowProps {
  habit: Habit;
  done: boolean;
  skipped: boolean;
  streak: number;
  accentColor: string;
  onToggle: (id: string, date?: string) => Promise<void>;
  onSkip?: (id: string, date?: string) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  showFull: boolean;
  editing: boolean;
  editName: string;
  editEmoji: string;
  onStartEdit: () => void;
  onEditName: (v: string) => void;
  onEditEmoji: (v: string) => void;
  onSaveEdit: () => Promise<void>;
  onCancelEdit: () => void;
  selectedDate: string;
  dragHandleProps?: React.HTMLAttributes<HTMLElement>;
}

function HabitRow({ habit, done, skipped, streak, accentColor, onToggle, onSkip, onDelete, showFull, editing, editName, editEmoji, onStartEdit, onEditName, onEditEmoji, onSaveEdit, onCancelEdit, selectedDate, dragHandleProps }: RowProps) {
  const [busy, setBusy] = useState(false);

  const handleToggle = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try { await onToggle(habit.id, selectedDate); } finally { setBusy(false); }
  }, [busy, onToggle, habit.id, selectedDate]);

  const handleSkip = useCallback(async () => {
    if (busy || !onSkip) return;
    setBusy(true);
    try { await onSkip(habit.id, selectedDate); } finally { setBusy(false); }
  }, [busy, onSkip, habit.id, selectedDate]);

  // Colors
  const borderColor = done ? 'transparent' : skipped ? 'var(--gray-5)' : 'var(--sep)';
  const bg = done ? 'transparent' : skipped ? 'var(--gray-6)' : 'var(--gray-6)';

  // Grid: drag | checkbox | name | streak | [skip] | [delete]
  const cols = showFull
    ? `20px 44px 1fr auto 44px 44px`
    : `20px 44px 1fr auto`;

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: cols, alignItems: 'center',
      minHeight: '44px', borderRadius: 'var(--r-md)', background: bg,
      border: `1px solid ${borderColor}`, opacity: done ? 0.62 : 1,
    }}>

      {/* Drag handle */}
      <div
        {...dragHandleProps}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '44px', cursor: 'grab', color: 'var(--gray-5)', fontSize: '11px', userSelect: 'none', touchAction: 'none' }}
      >⠿</div>

      {/* Checkbox */}
      <button
        type="button"
        onClick={handleToggle}
        disabled={busy}
        aria-label={`Toggle ${habit.name}`}
        style={{ width: '44px', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', cursor: busy ? 'wait' : 'pointer', WebkitTapHighlightColor: 'transparent', flexShrink: 0 }}
      >
        <span style={{
          width: '20px', height: '20px', borderRadius: '50%', flexShrink: 0,
          border: `2px solid ${done ? 'var(--green)' : skipped ? 'var(--gray-4)' : accentColor}`,
          background: done ? 'var(--green)' : 'transparent',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'background 0.15s, border-color 0.15s',
        }}>
          {done && <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><polyline points="1.5,5 4,7.5 8.5,2.5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>}
          {skipped && <span style={{ fontSize: '10px', color: 'var(--gray-4)', lineHeight: 1 }}>–</span>}
        </span>
      </button>

      {/* Name + emoji (or edit form) */}
      {editing && showFull ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', paddingRight: '6px' }}>
          <input
            value={editEmoji}
            onChange={e => onEditEmoji(e.target.value)}
            placeholder="😀"
            maxLength={2}
            style={{ ...INPUT_STYLE, width: '36px', textAlign: 'center', fontSize: '16px', padding: '4px', flexShrink: 0 }}
          />
          <input
            autoFocus
            value={editName}
            onChange={e => onEditName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') onSaveEdit(); if (e.key === 'Escape') onCancelEdit(); }}
            style={{ ...INPUT_STYLE, flex: 1, fontSize: '12px', padding: '6px 8px' }}
          />
          <button type="button" onClick={onSaveEdit} style={{ height: '32px', padding: '0 8px', border: 'none', borderRadius: 'var(--r-md)', background: 'var(--blue)', color: 'var(--bg)', fontSize: '11px', fontWeight: 800, cursor: 'pointer' }}>✓</button>
          <button type="button" onClick={onCancelEdit} style={{ height: '32px', padding: '0 8px', border: '1px solid var(--sep)', borderRadius: 'var(--r-md)', background: 'transparent', color: 'var(--gray-3)', fontSize: '11px', cursor: 'pointer' }}>✕</button>
        </div>
      ) : (
        <div
          onClick={showFull ? onStartEdit : undefined}
          style={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: '5px', paddingRight: '6px', cursor: showFull ? 'text' : 'default' }}
        >
          {habit.emoji && <span style={{ fontSize: '15px', flexShrink: 0 }}>{habit.emoji}</span>}
          <span style={{ fontSize: '12.5px', fontWeight: done ? 500 : 700, color: done ? 'var(--gray-4)' : 'var(--gray-1)', textDecoration: done ? 'line-through' : skipped ? 'line-through' : 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {habit.name}
          </span>
        </div>
      )}

      {/* Streak */}
      <div style={{ fontSize: '10px', fontWeight: 800, color: streak >= 3 ? 'var(--orange)' : 'var(--gray-4)', fontFamily: 'var(--font-geist-mono), monospace', paddingRight: showFull ? '0' : '8px' }}>
        {streak > 0 ? `${streak}d` : ''}
      </div>

      {/* Skip button (full only) */}
      {showFull && onSkip && (
        <button
          type="button"
          onClick={handleSkip}
          disabled={busy}
          aria-label={`Skip ${habit.name}`}
          title="Mark as rest/skip day"
          style={{ width: '44px', height: '44px', border: 'none', background: 'transparent', color: skipped ? accentColor : 'var(--gray-4)', fontSize: '16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', WebkitTapHighlightColor: 'transparent' }}
        >↺</button>
      )}

      {/* Delete button (full only) */}
      {showFull && onDelete && (
        <button
          type="button"
          onClick={() => onDelete(habit.id)}
          aria-label={`Archive ${habit.name}`}
          style={{ width: '44px', height: '44px', border: 'none', background: 'transparent', color: 'var(--gray-4)', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', WebkitTapHighlightColor: 'transparent' }}
        >×</button>
      )}
    </div>
  );
}

// ── Sortable wrapper ────────────────────────────────────────────────────────────

function SortableHabitRow(props: Omit<RowProps, 'dragHandleProps'>) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: props.habit.id });
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 100 : 'auto' as any,
      }}
    >
      <HabitRow {...props} dragHandleProps={{ ...attributes, ...listeners }} />
    </div>
  );
}
