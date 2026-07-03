'use client';

import { useState, useEffect, useCallback } from 'react';
import { Habit, HabitLog, Todo, CalendarEvent, Notification, TodoCategory } from '@/types/database';

const POLL_INTERVAL = 10000;

/**
 * Data + mutations for the Cadence app, lifted out so the Mobile view can use
 * the exact same fetching and save-actions as the tablet view — without
 * touching HomeClient.tsx. This intentionally mirrors the logic in HomeClient.
 */
export function useCadenceData() {
  const [habits, setHabits]               = useState<Habit[]>([]);
  const [habitLogs, setHabitLogs]         = useState<HabitLog[]>([]);
  const [todos, setTodos]                 = useState<Todo[]>([]);
  const [events, setEvents]               = useState<CalendarEvent[]>([]);
  const [upcoming, setUpcoming]           = useState<CalendarEvent[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [categories, setCategories]       = useState<TodoCategory[]>([]);

  const fetchData = useCallback(async () => {
    try {
      const t = Date.now();
      const nc = { cache: 'no-store' as const };
      const todayLA = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
      const [habitsRes, logsRes, todosRes, calRes, upcomingRes, notifsRes, catsRes] = await Promise.all([
        fetch(`/api/habits?_=${t}`, nc),
        fetch(`/api/habits/logs?_=${t}`, nc),
        fetch(`/api/todos?_=${t}`, nc),
        fetch(`/api/calendar?_=${t}`, nc),
        fetch(`/api/calendar?from=${todayLA}&days=365&_=${t}`, nc),
        fetch(`/api/notifications?_=${t}`, nc),
        fetch(`/api/todo-categories?_=${t}`, nc),
      ]);
      if (habitsRes.ok) setHabits(await habitsRes.json());
      if (logsRes.ok)   setHabitLogs(await logsRes.json());
      if (todosRes.ok)  setTodos(await todosRes.json());
      if (calRes.ok)    setEvents(await calRes.json());
      if (upcomingRes.ok) setUpcoming(await upcomingRes.json());
      if (notifsRes.ok) setNotifications(await notifsRes.json());
      if (catsRes.ok)   setCategories(await catsRes.json());
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
  const handleToggleTodo  = useCallback(async (id: string, completed: boolean) => { await fetch(`/api/todos/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ completed }) }); fetchData(); }, [fetchData]);
  const handleReorderTodo = useCallback(async (id: string, order: number) => { await fetch(`/api/todos/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ order }) }); }, []);
  const handleAddTodo     = useCallback(async (text: string, priority: 'high' | 'low', category: string = 'Personal', due_date: string | null = null) => { await fetch('/api/todos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, priority, category, due_date }) }); fetchData(); }, [fetchData]);
  const handleDeleteTodo  = useCallback(async (id: string) => { await fetch(`/api/todos/${id}`, { method: 'DELETE' }); fetchData(); }, [fetchData]);
  const handleEditTodo    = useCallback(async (id: string, text: string, priority: 'high' | 'low', due_date?: string | null) => { await fetch(`/api/todos/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, priority, ...(due_date !== undefined ? { due_date } : {}) }) }); fetchData(); }, [fetchData]);

  // --- Category handlers ---
  const handleAddCategory    = useCallback(async (name: string) => { await fetch('/api/todo-categories', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) }); fetchData(); }, [fetchData]);
  const handleRenameCategory = useCallback(async (id: string, name: string) => { await fetch(`/api/todo-categories/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) }); fetchData(); }, [fetchData]);
  const handleDeleteCategory = useCallback(async (id: string) => { await fetch(`/api/todo-categories/${id}`, { method: 'DELETE' }); fetchData(); }, [fetchData]);

  // --- Notification handlers ---
  const handleMarkRead    = useCallback(async (id: string) => { await fetch(`/api/notifications/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ read: true }) }); fetchData(); }, [fetchData]);
  const handleDeleteNotif = useCallback(async (id: string) => { await fetch(`/api/notifications/${id}`, { method: 'DELETE' }); fetchData(); }, [fetchData]);
  const handleClearAll    = useCallback(async () => {
    await Promise.all(notifications.map(n => fetch(`/api/notifications/${n.id}`, { method: 'DELETE' })));
    fetchData();
  }, [notifications, fetchData]);

  return {
    habits, habitLogs, todos, events, notifications, categories,
    nextEvent, unreadCount, fetchData,
    handleToggleHabit, handleSkipHabit, handleAddHabit, handleDeleteHabit, handleEditHabit, handleRestoreHabit,
    handleToggleTodo, handleReorderTodo, handleAddTodo, handleDeleteTodo, handleEditTodo,
    handleAddCategory, handleRenameCategory, handleDeleteCategory,
    handleMarkRead, handleDeleteNotif, handleClearAll,
  };
}

export type CadenceData = ReturnType<typeof useCadenceData>;
