'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { IonButton } from '@ionic/react';
import { Todo } from '@/types/database';

type Goal = 'gre' | 'aevro' | 'ecopeptides';
type Mode = 'idle' | 'focus' | 'break';

const FOCUS_SECS = 50 * 60;
const BREAK_SECS = 10 * 60;

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

interface TimerState {
  mode: Mode;
  startedAt: number | null; // ms timestamp
  goal: Goal | null;
  todoId: string | null;
  todoText: string | null;
  pausedRemaining: number | null; // secs remaining when paused
}

const DEFAULT_STATE: TimerState = { mode: 'idle', startedAt: null, goal: null, todoId: null, todoText: null, pausedRemaining: null };
const LS_KEY = 'cadence-timer-v1';

function loadState(): TimerState {
  if (typeof window === 'undefined') return DEFAULT_STATE;
  try { const s = localStorage.getItem(LS_KEY); return s ? JSON.parse(s) : DEFAULT_STATE; }
  catch { return DEFAULT_STATE; }
}

function saveState(s: TimerState) {
  localStorage.setItem(LS_KEY, JSON.stringify(s));
}

function calcRemaining(state: TimerState): number {
  if (state.mode === 'idle') return FOCUS_SECS;
  if (state.pausedRemaining !== null) return state.pausedRemaining;
  const total = state.mode === 'focus' ? FOCUS_SECS : BREAK_SECS;
  const elapsed = state.startedAt ? Math.floor((Date.now() - state.startedAt) / 1000) : 0;
  return Math.max(0, total - elapsed);
}

function fmt(secs: number): string {
  const m = Math.floor(secs / 60).toString().padStart(2, '0');
  const s = (secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

interface Props {
  todos: Todo[];
  onSessionComplete?: () => void;
  onNavigate?: () => void;
}

export default function FocusTimerCard({ todos, onSessionComplete, onNavigate }: Props) {
  const [ts, setTs]           = useState<TimerState>(DEFAULT_STATE);
  const [remaining, setRemaining] = useState(FOCUS_SECS);
  const [selectedGoal, setSelectedGoal] = useState<Goal>('gre');
  const [selectedTodoId, setSelectedTodoId] = useState<string | null>(null);
  const [showGoalPicker, setShowGoalPicker] = useState(false);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load from localStorage on mount
  useEffect(() => {
    const s = loadState();
    setTs(s);
    setRemaining(calcRemaining(s));
    if (s.goal) setSelectedGoal(s.goal);
    if (s.todoId) setSelectedTodoId(s.todoId);
  }, []);

  const handleComplete = useCallback(async (state: TimerState) => {
    if (state.mode !== 'focus' || !state.goal) return;
    const todo = todos.find(t => t.id === state.todoId);
    await fetch('/api/focus-sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ goal: state.goal, duration_minutes: 50, todo_id: state.todoId, todo_text: todo?.text }),
    });
    onSessionComplete?.();
    // Start break
    const next: TimerState = { ...state, mode: 'break', startedAt: Date.now(), pausedRemaining: null };
    setTs(next);
    saveState(next);
    setRemaining(BREAK_SECS);
  }, [todos, onSessionComplete]);

  // Tick
  useEffect(() => {
    if (tickRef.current) clearInterval(tickRef.current);
    if (ts.mode === 'idle' || ts.pausedRemaining !== null) return;

    tickRef.current = setInterval(() => {
      setTs(prev => {
        const rem = calcRemaining(prev);
        setRemaining(rem);
        if (rem <= 0) {
          clearInterval(tickRef.current!);
          if (prev.mode === 'focus') {
            handleComplete(prev);
          } else {
            // Break done → idle
            const next = { ...DEFAULT_STATE };
            saveState(next);
            setRemaining(FOCUS_SECS);
            return next;
          }
        }
        return prev;
      });
    }, 1000);

    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, [ts.mode, ts.pausedRemaining, handleComplete]);

  const isPaused = ts.mode !== 'idle' && ts.pausedRemaining !== null;

  function start() {
    const next: TimerState = { mode: 'focus', startedAt: Date.now(), goal: selectedGoal, todoId: selectedTodoId, todoText: todos.find(t => t.id === selectedTodoId)?.text ?? null, pausedRemaining: null };
    setTs(next);
    saveState(next);
    setRemaining(FOCUS_SECS);
    setShowGoalPicker(false);
  }

  function pause() {
    const rem = calcRemaining(ts);
    const next = { ...ts, pausedRemaining: rem };
    setTs(next);
    saveState(next);
    setRemaining(rem);
  }

  function resume() {
    const next = { ...ts, startedAt: Date.now() - ((ts.mode === 'focus' ? FOCUS_SECS : BREAK_SECS) - (ts.pausedRemaining ?? 0)) * 1000, pausedRemaining: null };
    setTs(next);
    saveState(next);
  }

  function stop() {
    setTs(DEFAULT_STATE);
    saveState(DEFAULT_STATE);
    setRemaining(FOCUS_SECS);
  }

  const accentColor = ts.goal ? GOAL_COLORS[ts.goal] : ts.mode === 'break' ? 'var(--green)' : GOAL_COLORS[selectedGoal];
  const incompleteTodos = todos.filter(t => !t.completed);

  return (
    <div style={{ background: 'var(--card)', borderRadius: 'var(--r-lg)', padding: '12px 14px', boxShadow: 'var(--shadow)', display: 'flex', flexDirection: 'column', minHeight: 0, height: '100%' }}>
      {/* Header */}
      <div style={{ fontSize: '9px', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--gray-4)', marginBottom: '8px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        Focus Timer
        {onNavigate && <span onClick={onNavigate} style={{ fontSize: '10px', opacity: 0.5, cursor: 'pointer', padding: '4px 4px 4px 8px', WebkitTapHighlightColor: 'transparent' }}>↗</span>}
      </div>

      {/* Mode badge */}
      {ts.mode !== 'idle' && (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '2px 8px', borderRadius: 'var(--r-pill)', background: ts.mode === 'focus' ? 'rgba(0,113,227,0.1)' : 'rgba(40,205,65,0.1)', color: ts.mode === 'focus' ? 'var(--blue)' : 'var(--green)', fontSize: '10px', fontWeight: 600, width: 'fit-content', marginBottom: '6px', flexShrink: 0 }}>
          {isPaused ? '⏸ Paused' : ts.mode === 'focus' ? '🎯 Focusing' : '☕ Break'}
          {ts.goal && ts.mode === 'focus' && <span style={{ opacity: 0.7 }}>· {GOAL_LABELS[ts.goal]}</span>}
        </div>
      )}

      {/* Big timer */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '8px' }}>
        <div style={{ fontSize: '64px', fontWeight: 200, letterSpacing: '-4px', lineHeight: 1, color: ts.mode === 'idle' ? 'var(--gray-4)' : accentColor, fontFamily: 'var(--font-geist-mono), monospace', transition: 'color 0.3s' }}>
          {fmt(remaining)}
        </div>
        {ts.mode === 'idle' && (
          <div style={{ fontSize: '11px', color: 'var(--gray-4)' }}>50 min focus · 10 min break</div>
        )}
        {ts.mode === 'focus' && ts.todoText && (
          <div style={{ fontSize: '11px', color: 'var(--gray-3)', textAlign: 'center', maxWidth: '160px' }}>{ts.todoText}</div>
        )}
      </div>

      {/* Goal + Todo picker (idle only) */}
      {ts.mode === 'idle' && (
        <div style={{ flexShrink: 0, marginBottom: '8px' }}>
          <div style={{ display: 'flex', gap: '4px', marginBottom: '6px', flexWrap: 'wrap' }}>
            {(Object.keys(GOAL_LABELS) as Goal[]).map(g => (
              <IonButton
                key={g}
                fill={selectedGoal === g ? 'solid' : 'clear'}
                size="small"
                onClick={() => setSelectedGoal(g)}
                style={{ '--background': selectedGoal === g ? GOAL_COLORS[g] : 'transparent', '--color': selectedGoal === g ? 'var(--bg)' : 'var(--gray-3)', '--border-radius': 'var(--r-pill)', fontSize: '11px', fontWeight: 600 }}
              >
                {GOAL_LABELS[g]}
              </IonButton>
            ))}
          </div>
          {incompleteTodos.length > 0 && (
            <select
              value={selectedTodoId ?? ''}
              onChange={e => setSelectedTodoId(e.target.value || null)}
              style={{ width: '100%', fontSize: '12px', border: '1px solid var(--gray-5)', borderRadius: 'var(--r-sm)', padding: '8px 10px', color: 'var(--gray-2)', background: 'var(--card)', outline: 'none', minHeight: '40px' }}
            >
              <option value=''>No specific task</option>
              {incompleteTodos.map(t => (
                <option key={t.id} value={t.id}>{t.text}</option>
              ))}
            </select>
          )}
        </div>
      )}

      {/* Controls */}
      <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
        {ts.mode === 'idle' && (
          <IonButton expand="block" onClick={start} style={{ flex: 1, '--background': accentColor, '--border-radius': 'var(--r-md)', '--min-height': '48px', fontWeight: 600, fontSize: '14px' }}>
            Start
          </IonButton>
        )}
        {ts.mode !== 'idle' && !isPaused && (
          <IonButton expand="block" fill="solid" onClick={pause} style={{ flex: 1, '--background': 'var(--gray-6)', '--color': 'var(--gray-2)', '--border-radius': 'var(--r-md)', '--min-height': '48px', fontWeight: 600, fontSize: '13px' }}>
            Pause
          </IonButton>
        )}
        {isPaused && (
          <IonButton expand="block" fill="solid" onClick={resume} style={{ flex: 1, '--background': accentColor, '--border-radius': 'var(--r-md)', '--min-height': '48px', fontWeight: 600, fontSize: '13px' }}>
            Resume
          </IonButton>
        )}
        {ts.mode !== 'idle' && (
          <IonButton fill="solid" onClick={stop} style={{ '--background': 'var(--gray-6)', '--color': 'var(--gray-3)', '--border-radius': 'var(--r-md)', '--min-height': '48px', '--padding-start': '16px', '--padding-end': '16px', fontWeight: 600, fontSize: '13px' }}>
            Stop
          </IonButton>
        )}
      </div>
    </div>
  );
}
