-- Personal records (PRs) for Training. Run once in the Supabase SQL editor.
-- The service-role key (used by server routes) bypasses RLS; enabling RLS with
-- no policies denies the public anon role outright — matching the other tables.

create table if not exists prs (
  id          uuid primary key default gen_random_uuid(),
  exercise    text not null,
  weight_lbs  numeric not null check (weight_lbs > 0),
  reps        int not null default 1 check (reps > 0),
  achieved_at timestamptz not null default now(),
  note        text,
  created_at  timestamptz not null default now()
);

alter table prs enable row level security;
