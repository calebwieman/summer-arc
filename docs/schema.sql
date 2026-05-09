-- Summer Arc — Supabase schema
-- Run this in the Supabase SQL editor (Project -> SQL Editor -> New query)

-- =========================
-- profile
-- =========================
create table if not exists public.profile (
  id text primary key,                          -- 'caleb-001' for v0
  display_name text not null default 'Caleb',
  wake_time time not null default '06:00',
  doomscroll_ceiling_min int not null default 30,
  arc_start date not null default '2026-05-16',
  arc_end date not null default '2026-08-31',
  summit_mrr_target_cents int not null default 1000000,  -- $10,000 MRR
  created_at timestamptz not null default now()
);

insert into public.profile (id) values ('caleb-001')
on conflict (id) do nothing;

-- =========================
-- daily_log — one row per day
-- =========================
create table if not exists public.daily_log (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.profile(id) on delete cascade,
  date date not null,
  woke_by_target boolean not null default false,
  ran boolean not null default false,
  lifted boolean not null default false,
  bible boolean not null default false,
  doomscroll_under boolean not null default false,
  screen_time_min int,
  notes text,
  created_at timestamptz not null default now(),
  unique(user_id, date)
);

create index if not exists daily_log_user_date_idx
  on public.daily_log(user_id, date desc);

-- =========================
-- run_log
-- =========================
create table if not exists public.run_log (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.profile(id) on delete cascade,
  date date not null,
  distance_mi numeric,
  duration_min numeric,
  pace text,
  source text not null default 'manual' check (source in ('manual','garmin')),
  garmin_activity_id text,
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists run_log_user_date_idx
  on public.run_log(user_id, date desc);

-- =========================
-- lift_log
-- =========================
create table if not exists public.lift_log (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.profile(id) on delete cascade,
  date date not null,
  workout_name text,
  duration_min int,
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists lift_log_user_date_idx
  on public.lift_log(user_id, date desc);

-- =========================
-- bible_log
-- =========================
create table if not exists public.bible_log (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.profile(id) on delete cascade,
  date date not null,
  reference text,
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists bible_log_user_date_idx
  on public.bible_log(user_id, date desc);

-- =========================
-- aigentic_client (CRM)
-- =========================
create table if not exists public.aigentic_client (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.profile(id) on delete cascade,
  name text not null,
  stage text not null default 'lead'
    check (stage in ('lead','contacted','discovery','proposal','closed','lost')),
  mrr_potential_cents int,
  mrr_actual_cents int not null default 0,
  notes text,
  next_action text,
  next_action_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists aigentic_client_user_stage_idx
  on public.aigentic_client(user_id, stage);

-- =========================
-- money_log
-- =========================
create table if not exists public.money_log (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.profile(id) on delete cascade,
  date date not null,
  source text not null check (source in ('aigentic','plasma','doordash','other')),
  amount_cents int not null,
  is_recurring boolean not null default false,
  client_id uuid references public.aigentic_client(id) on delete set null,
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists money_log_user_date_idx
  on public.money_log(user_id, date desc);

-- =========================
-- outreach_log — leading indicator
-- =========================
create table if not exists public.outreach_log (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.profile(id) on delete cascade,
  date date not null,
  count int not null,
  channel text check (channel in ('cold_email','dm','in_person','referral')),
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists outreach_log_user_date_idx
  on public.outreach_log(user_id, date desc);

-- =========================
-- v0: disable RLS (single user, no auth yet)
-- We'll re-enable + write policies when magic-link auth lands.
-- =========================
alter table public.profile          disable row level security;
alter table public.daily_log        disable row level security;
alter table public.run_log          disable row level security;
alter table public.lift_log         disable row level security;
alter table public.bible_log        disable row level security;
alter table public.aigentic_client  disable row level security;
alter table public.money_log        disable row level security;
alter table public.outreach_log     disable row level security;
