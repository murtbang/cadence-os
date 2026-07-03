'use client';

import { useState, useEffect, useCallback } from 'react';
import Sidebar from '@/components/Sidebar';
import DashboardGrid from '@/components/DashboardGrid';
import HabitCard from '@/components/HabitCard';
import TodoCard from '@/components/TodoCard';
import CalendarCard from '@/components/CalendarCard';
import CalendarView from '@/components/CalendarView';
import GoalTrackerCard from '@/components/GoalTrackerCard';
import NotificationsView from '@/components/NotificationsView';
import WeeklyReviewView from '@/components/WeeklyReviewView';
import WeatherView from '@/components/WeatherView';
import TrainingView from '@/components/TrainingView';
import GoalsView from '@/components/GoalsView';
import ScreenGuard from '@/components/ScreenGuard';
import GoveeCard from '@/components/GoveeCard';
import { Habit, HabitLog, Todo, CalendarEvent, Notification } from '@/types/database';

type View = 'dashboard' | 'habits' | 'todos' | 'calendar' | 'settings' | 'notifications' | 'weekly' | 'goals' | 'weather' | 'training' | 'lights';

const POLL_INTERVAL = 10000;

export default function HomeClient() {
  const [view, setView]               = useState<View>('dashboard');
  const [habits, setHabits]           = useState<Habit[]>([]);
  const [habitLogs, setHabitLogs]     = useState<HabitLog[]>([]);
  const [todos, setTodos]             = useState<Todo[]>([]);
  const [events, setEvents]           = useState<CalendarEvent[]>([]);
  const [upcoming, setUpcoming]       = useState<CalendarEvent[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const fetchData = useCallback(async () => {
    try {
      const t = Date.now();
      const nc = { cache: 'no-store' as const };
      const todayLA = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
      const [habitsRes, logsRes, todosRes, calRes, upcomingRes, notifsRes] = await Promise.all([
        fetch(`/api/habits?_=${t}`, nc),
        fetch(`/api/habits/logs?_=${t}`, nc),
        fetch(`/api/todos?_=${t}`, nc),
        fetch(`/api/calendar?_=${t}`, nc),
        fetch(`/api/calendar?from=${todayLA}&days=365&_=${t}`, nc),
        fetch(`/api/notifications?_=${t}`, nc),
      ]);
      if (habitsRes.ok) setHabits(await habitsRes.json());
      if (logsRes.ok)   setHabitLogs(await logsRes.json());
      if (todosRes.ok)  setTodos(await todosRes.json());
      if (calRes.ok)    setEvents(await calRes.json());
      if (upcomingRes.ok) setUpcoming(await upcomingRes.json());
      if (notifsRes.ok) setNotifications(await notifsRes.json());
    } catch (e) {
      console.error('Fetch error:', e);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, POLL_INTERVAL);
    return () => clearInterval(id);
  }, [fetchData]);

  // Next upcoming event regardless of date (date + time, not just time-of-day).
  const startMs   = (e: CalendarEvent) => new Date(`${e.date}T${e.startTime}:00`).getTime();
  const nextEvent = [...upcoming]
    .filter(e => e.date && startMs(e) > Date.now())
    .sort((a, b) => startMs(a) - startMs(b))[0] ?? null;

  const unreadCount = notifications.filter(n => !n.read).length;

  // --- Habit handlers ---
  const handleToggleHabit = useCallback(async (id: string, date?: string) => {
    await fetch(`/api/habits/${id}/log`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'done', ...(date ? { date } : {}) }),
    });
    await fetchData();
  }, [fetchData]);

  const handleSkipHabit = useCallback(async (id: string, date?: string) => {
    await fetch(`/api/habits/${id}/log`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'skip', ...(date ? { date } : {}) }),
    });
    await fetchData();
  }, [fetchData]);

  const handleAddHabit = useCallback(async (name: string, period: 'AM' | 'PM', emoji?: string) => {
    await fetch('/api/habits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, period, emoji }),
    });
    fetchData();
  }, [fetchData]);

  const handleDeleteHabit = useCallback(async (id: string) => {
    await fetch(`/api/habits/${id}`, { method: 'DELETE' });
    fetchData();
  }, [fetchData]);

  const handleEditHabit = useCallback(async (id: string, name: string, emoji: string | null) => {
    await fetch(`/api/habits/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, emoji }),
    });
    await fetchData();
  }, [fetchData]);

  const handleRestoreHabit = useCallback(async (id: string) => {
    await fetch(`/api/habits/${id}/restore`, { method: 'POST' });
    fetchData();
  }, [fetchData]);

  // --- Todo handlers ---
  const handleToggleTodo   = useCallback(async (id: string, completed: boolean) => { await fetch(`/api/todos/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ completed }) }); fetchData(); }, [fetchData]);
  const handleReorderTodo  = useCallback(async (id: string, order: number) => { await fetch(`/api/todos/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ order }) }); }, []);
  const handleAddTodo      = useCallback(async (text: string, priority: 'high' | 'low', category = 'personal', due_date: string | null = null) => { await fetch('/api/todos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, priority, category, due_date }) }); fetchData(); }, [fetchData]);
  const handleDeleteTodo   = useCallback(async (id: string) => { await fetch(`/api/todos/${id}`, { method: 'DELETE' }); fetchData(); }, [fetchData]);
  const handleEditTodo     = useCallback(async (id: string, text: string, priority: 'high' | 'low', due_date?: string | null) => { await fetch(`/api/todos/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, priority, ...(due_date !== undefined ? { due_date } : {}) }) }); fetchData(); }, [fetchData]);

  // --- Notification handlers ---
  const handleMarkRead = useCallback(async (id: string) => { await fetch(`/api/notifications/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ read: true }) }); fetchData(); }, [fetchData]);
  const handleDeleteNotif = useCallback(async (id: string) => { await fetch(`/api/notifications/${id}`, { method: 'DELETE' }); fetchData(); }, [fetchData]);
  const handleClearAll = useCallback(async () => {
    await Promise.all(notifications.map(n => fetch(`/api/notifications/${n.id}`, { method: 'DELETE' })));
    fetchData();
  }, [notifications, fetchData]);

  const todoProps = { todos, onToggle: handleToggleTodo, onReorder: handleReorderTodo, onAdd: handleAddTodo, onDelete: handleDeleteTodo, onEdit: handleEditTodo };

  return (
    <>
    <ScreenGuard />
    <div style={{ display: 'grid', gridTemplateColumns: '56px 1fr', height: '100dvh', overflow: 'hidden', background: 'var(--bg)', paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <Sidebar activeView={(view as any)} onViewChange={v => setView(v as View)} unreadCount={unreadCount} />
      <main style={{ height: '100dvh', overflowY: 'auto', padding: '2px' }}>

        {view === 'dashboard' && (
          <DashboardGrid
            habits={habits} habitLogs={habitLogs} todos={todos}
            events={events} nextEvent={nextEvent}
            onToggleHabit={handleToggleHabit} onAddHabit={handleAddHabit} onDeleteHabit={handleDeleteHabit}
            onToggleTodo={handleToggleTodo} onReorderTodo={handleReorderTodo} onAddTodo={handleAddTodo} onDeleteTodo={handleDeleteTodo}
            onNavigate={v => setView(v as View)}
          />
        )}

        {view === 'habits' && (
          <FullView>
            <HabitCard
              habits={habits}
              logs={habitLogs}
              onToggle={handleToggleHabit}
              onSkip={handleSkipHabit}
              onAddHabit={handleAddHabit}
              onDeleteHabit={handleDeleteHabit}
              onEditHabit={handleEditHabit}
              onRestoreHabit={handleRestoreHabit}
              showFull
            />
          </FullView>
        )}

        {view === 'todos' && (
          <FullView><TodoCard {...todoProps} /></FullView>
        )}
        {view === 'calendar' && (
          <FullView><CalendarView events={events} todos={todos} onToggle={handleToggleTodo} /></FullView>
        )}
        {view === 'notifications' && (
          <NotificationsView
            notifications={notifications}
            onMarkRead={handleMarkRead}
            onDelete={handleDeleteNotif}
            onClearAll={handleClearAll}
          />
        )}
        {view === 'weekly' && (
          <FullView><WeeklyReviewView /></FullView>
        )}
        {view === 'goals' && (
          <FullView><GoalsView /></FullView>
        )}
        {view === 'weather' && (
          <FullView><WeatherView /></FullView>
        )}
        {view === 'training' && (
          <FullView><TrainingView /></FullView>
        )}
        {view === 'settings' && (
          <FullView>
            <div style={{ background: 'var(--card)', borderRadius: 'var(--r-lg)', padding: '20px', boxShadow: 'var(--shadow)', fontSize: '12px', color: 'var(--gray-3)', lineHeight: 1.7 }}>
              Cadence - personal daily OS<br />
              Polls every 10s - Your City<br />
              AM to PM flip at 5:00 PM
            </div>
          </FullView>
        )}
      </main>
    </div>
    </>
  );
}

function FullView({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ height: '100%', overflow: 'hidden' }}>
      {children}
    </div>
  );
}
