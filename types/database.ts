export interface Habit {
  id: string;
  name: string;
  period: 'AM' | 'PM';
  order: number;
  emoji: string | null;
  deleted_at: string | null;
  created_at: string;
}

export interface HabitLog {
  id: string;
  habit_id: string;
  date: string;
  type: 'done' | 'skip';
  created_at?: string;
}

export interface Todo {
  id: string;
  text: string;
  priority: 'high' | 'low';
  category: 'personal' | 'aevro';
  completed: boolean;
  order: number;
  due_date: string | null;   // 'YYYY-MM-DD' due date, null = untimed
  created_at: string;
}

export interface Settings {
  id: string;
  key: string;
  value: string | null;
}

export interface Notification {
  id: string;
  message: string;
  type: 'info' | 'habit' | 'calendar' | 'todo' | 'note' | 'silent';
  read: boolean;
  created_at: string;
}

export interface WeightLog {
  id:         string;
  weight_lbs: number;
  logged_at:  string;
  note:       string | null;
}

export interface PR {
  id:          string;
  exercise:    string;
  weight_lbs:  number;
  reps:        number;
  achieved_at: string;
  note:        string | null;
  created_at:  string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  subtitle?: string;
  date?: string;           // YYYY-MM-DD, present in multi-day API responses
  startTime: string;
  endTime: string;
  category: 'personal' | 'client' | 'work' | 'deep-work' | 'other';
  durationMinutes: number;
  meetLink?: string;
}
