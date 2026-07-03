-- Run this in the Supabase SQL editor before deploying the sync service.
-- It creates the two tables this service owns. The dashboard reads from both.

-- ── Per-workout rows (one per Boostcamp workout) ──
create table if not exists boostcamp_workouts (
  boostcamp_id   text        primary key,
  logged_at      timestamptz not null,
  workout_name   text,
  classification text        not null,
  muscles_json   jsonb       not null default '[]',
  exercises_json jsonb       not null default '[]',
  raw_json       jsonb,
  created_at     timestamptz not null default now()
);

-- Index for fast weekly queries
create index if not exists idx_boostcamp_workouts_logged_at
  on boostcamp_workouts (logged_at desc);

-- ── Single-row summary stats (streak / totals) for the Training view ──
-- sync.py upserts one row with id = 'singleton'.
create table if not exists boostcamp_summary (
  id              text        primary key,
  week_streak     int         not null default 0,
  total_workouts  int         not null default 0,
  total_hours     numeric     not null default 0,
  total_weight_lb numeric     not null default 0,
  synced_at       timestamptz not null default now()
);

-- ── Optional: habit auto-completion ──
-- If you also run the cadence dashboard, this service will auto-log a habit whose
-- name contains a workout keyword (workout/run/gym/train/exercise) when a workout
-- syncs. That requires the cadence app's `habits` and `habit_logs` tables. The
-- statements below are safe no-ops if those tables already exist; skip this block
-- entirely if you're running the sync service standalone.
alter table if exists habit_logs
  add column if not exists created_at timestamptz default now();

do $$
begin
  if exists (select 1 from information_schema.tables where table_name = 'habit_logs') then
    alter table habit_logs drop constraint if exists habit_logs_habit_id_date_unique;
    alter table habit_logs add constraint habit_logs_habit_id_date_unique unique (habit_id, date);
  end if;
end $$;
