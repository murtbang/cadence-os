-- ============================================================================
-- Cadence — complete database schema
-- ============================================================================
-- Run this once in the Supabase SQL editor (Dashboard → SQL Editor → New query).
-- It creates every table the app uses and enables Row Level Security on each.
--
-- Security model: the server uses SUPABASE_SERVICE_ROLE_KEY, which BYPASSES RLS.
-- Enabling RLS with no policies therefore denies the public anon/browser role
-- outright while the server keeps full access. Never expose the service-role key
-- to the browser (it is server-only; do not prefix it with NEXT_PUBLIC_).
-- ============================================================================

-- ── Habits ──────────────────────────────────────────────────────────────────
create table if not exists habits (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  period     text not null check (period in ('AM','PM')),
  emoji      text,
  "order"    int  not null default 0,
  deleted_at timestamptz,                       -- soft delete
  created_at timestamptz not null default now()
);

create table if not exists habit_logs (
  id         uuid primary key default gen_random_uuid(),
  habit_id   uuid not null references habits(id) on delete cascade,
  date       date not null,                     -- the day this log is for (LA)
  type       text not null default 'done' check (type in ('done','skip')),
  created_at timestamptz not null default now(),
  unique (habit_id, date)
);

-- ── To-dos ──────────────────────────────────────────────────────────────────
create table if not exists todos (
  id         uuid primary key default gen_random_uuid(),
  text       text not null,
  priority   text not null default 'low'      check (priority in ('high','low')),
  category   text not null default 'personal' check (category in ('personal','aevro')),
  completed  boolean not null default false,
  "order"    int  not null default 0,          -- sort order within (priority, category)
  due_date   date,                             -- optional due date; null = untimed
  created_at timestamptz not null default now()
);

-- ── Notifications (dashboard bell) ──────────────────────────────────────────
create table if not exists notifications (
  id           uuid primary key default gen_random_uuid(),
  message      text not null,
  type         text not null default 'info'
               check (type in ('info','habit','calendar','todo','note','silent')),
  read         boolean not null default false,
  created_at   timestamptz not null default now(),
  dismissed_at timestamptz
);

-- ── Weight log (Training) ───────────────────────────────────────────────────
create table if not exists weight_logs (
  id         uuid primary key default gen_random_uuid(),
  weight_lbs numeric not null check (weight_lbs > 0),
  logged_at  timestamptz not null default now(),
  note       text
);

-- ── Big goals (Goals view) ──────────────────────────────────────────────────
create table if not exists big_goals (
  id              uuid primary key default gen_random_uuid(),
  title           text not null,
  milestone       text,
  progress        int  not null default 0 check (progress between 0 and 100),
  progress_type   text,                         -- e.g. 'weight' for auto progress
  count_current   numeric,
  count_target    numeric,
  "order"         int  not null default 0,
  milestones      jsonb,                        -- optional array of milestone objects
  milestone_index int,
  created_at      timestamptz not null default now()
);

-- ── Calendar reminder snooze state ──────────────────────────────────────────
-- One row per (event, day) the user snoozed from a Discord reminder link.
create table if not exists dismissed_reminders (
  event_uid  text not null,
  event_date text not null,                     -- 'YYYY-MM-DD'
  created_at timestamptz not null default now(),
  primary key (event_uid, event_date)
);

-- ── Training PRs (optional) ─────────────────────────────────────────────────
create table if not exists prs (
  id          uuid primary key default gen_random_uuid(),
  exercise    text not null,
  weight_lbs  numeric not null check (weight_lbs > 0),
  reps        int not null default 1 check (reps > 0),
  achieved_at timestamptz not null default now(),
  note        text,
  created_at  timestamptz not null default now()
);

-- ── Boostcamp sync (optional — only if you run the Boostcamp sync service) ───
create table if not exists boostcamp_workouts (
  id             uuid primary key default gen_random_uuid(),
  boostcamp_id   text unique not null,          -- dedup key: "YYYY-MM-DD-<index>"
  logged_at      timestamptz not null,          -- Boostcamp's own workout date
  workout_name   text,
  classification text,                          -- Push | Pull | Legs | Other
  muscles_json   jsonb not null default '[]',
  exercises_json jsonb not null default '[]',
  raw_json       jsonb,
  created_at     timestamptz not null default now()
);

create table if not exists boostcamp_summary (
  id             text primary key,              -- always the literal 'singleton'
  week_streak    int     not null default 0,
  total_workouts int     not null default 0,
  total_hours    numeric not null default 0,
  total_weight_lb numeric not null default 0,
  weekly_target  jsonb,                         -- e.g. ["Push","Pull","Push","Pull","Legs"]
  synced_at      timestamptz,
  created_at     timestamptz not null default now()
);

-- ── Enable Row Level Security on every table ────────────────────────────────
-- (No policies = anon/browser denied; the server's service-role key bypasses RLS.)
alter table habits              enable row level security;
alter table habit_logs          enable row level security;
alter table todos               enable row level security;
alter table notifications       enable row level security;
alter table weight_logs         enable row level security;
alter table big_goals           enable row level security;
alter table dismissed_reminders enable row level security;
alter table prs                 enable row level security;
alter table boostcamp_workouts  enable row level security;
alter table boostcamp_summary   enable row level security;
