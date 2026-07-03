// Shared formatting for "due soon" todo reminders surfaced inside the daily
// summary / check-in Discord messages. Day-level due dates only.

export interface DueTodo {
  text:      string;
  due_date:  string | null;   // 'YYYY-MM-DD'
  completed: boolean;
}

/**
 * Build the "Due soon" block for a check-in message, or null if nothing falls
 * within the window. Covers overdue, due today, tomorrow, and in 2 days.
 * `todayStr` is 'YYYY-MM-DD' in LA time. Using noon avoids DST edge cases.
 */
export function formatDueSoon(todos: DueTodo[], todayStr: string): string | null {
  const today = new Date(todayStr + 'T12:00:00').getTime();

  const items = todos
    .filter(t => !t.completed && t.due_date)
    .map(t => {
      const due  = new Date(t.due_date! + 'T12:00:00').getTime();
      const days = Math.round((due - today) / 86_400_000);
      return { text: t.text, days };
    })
    .filter(t => t.days <= 2)            // overdue, today, tomorrow, +2 days
    .sort((a, b) => a.days - b.days);    // most urgent first

  if (items.length === 0) return null;

  const lines = items.map(t => {
    if (t.days < 0)   return `⚠️ **OVERDUE** — ${t.text}`;
    if (t.days === 0) return `🔴 **DUE TODAY** — ${t.text}`;
    if (t.days === 1) return `🟡 Tomorrow — ${t.text}`;
    return `🟢 In ${t.days} days — ${t.text}`;
  });

  return ['📅 **Due soon**', ...lines].join('\n');
}
