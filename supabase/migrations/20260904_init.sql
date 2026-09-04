-- PM-AJAY Livelihood Helpline
-- Paste into Supabase SQL Editor (or run as a migration).
-- Supabase Auth owns auth.users. The application tables live in public.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- 1. profiles  — optional authenticated user (beneficiary or officer)
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  role text not null default 'beneficiary'
    check (role in ('beneficiary', 'officer')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 2. counselling_sessions  — one phone-call interview
--    beneficiary jsonb matches BeneficiaryProfile in the app
-- ---------------------------------------------------------------------------
create table if not exists public.counselling_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'active'
    check (status in ('active', 'completed')),
  language text,
  beneficiary jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists counselling_sessions_user_id_idx
  on public.counselling_sessions (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 3. session_turns  — live captions / transcript
-- ---------------------------------------------------------------------------
create table if not exists public.session_turns (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null
    references public.counselling_sessions (id) on delete cascade,
  seq integer not null,
  role text not null check (role in ('user', 'agent')),
  content text not null,
  created_at timestamptz not null default now(),
  unique (session_id, seq)
);

create index if not exists session_turns_session_id_idx
  on public.session_turns (session_id, seq);

-- ---------------------------------------------------------------------------
-- 4. session_recommendations  — 2–3 options spoken on the call
-- ---------------------------------------------------------------------------
create table if not exists public.session_recommendations (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null
    references public.counselling_sessions (id) on delete cascade,
  rank integer not null check (rank between 1 and 3),
  kind text not null check (kind in ('course', 'job', 'pathway', 'centre')),
  catalog_id text not null,
  title text not null,
  detail text not null,
  source_url text,
  created_at timestamptz not null default now(),
  unique (session_id, rank)
);

-- ---------------------------------------------------------------------------
-- updated_at helper
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute procedure public.set_updated_at();

drop trigger if exists counselling_sessions_set_updated_at on public.counselling_sessions;
create trigger counselling_sessions_set_updated_at
  before update on public.counselling_sessions
  for each row execute procedure public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Auto-create a profile when a Supabase Auth user is created
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name'
    ),
    coalesce(
      new.raw_user_meta_data->>'avatar_url',
      new.raw_user_meta_data->>'picture'
    )
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = coalesce(excluded.full_name, public.profiles.full_name),
        avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url),
        updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.counselling_sessions enable row level security;
alter table public.session_turns enable row level security;
alter table public.session_recommendations enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "sessions_own" on public.counselling_sessions;
create policy "sessions_own"
  on public.counselling_sessions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "sessions_officer_read" on public.counselling_sessions;
create policy "sessions_officer_read"
  on public.counselling_sessions for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'officer'
    )
  );

drop policy if exists "turns_via_session" on public.session_turns;
create policy "turns_via_session"
  on public.session_turns for all
  using (
    exists (
      select 1 from public.counselling_sessions s
      where s.id = session_id
        and (
          s.user_id = auth.uid()
          or exists (
            select 1 from public.profiles p
            where p.id = auth.uid() and p.role = 'officer'
          )
        )
    )
  )
  with check (
    exists (
      select 1 from public.counselling_sessions s
      where s.id = session_id and s.user_id = auth.uid()
    )
  );

drop policy if exists "recs_via_session" on public.session_recommendations;
create policy "recs_via_session"
  on public.session_recommendations for all
  using (
    exists (
      select 1 from public.counselling_sessions s
      where s.id = session_id
        and (
          s.user_id = auth.uid()
          or exists (
            select 1 from public.profiles p
            where p.id = auth.uid() and p.role = 'officer'
          )
        )
    )
  )
  with check (
    exists (
      select 1 from public.counselling_sessions s
      where s.id = session_id and s.user_id = auth.uid()
    )
  );
