-- PM-AJAY Livelihood Helpline
-- Paste into Supabase SQL Editor (or run as a migration).
-- The public counselling flow does not require Supabase Auth or Google OAuth.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- 1. profiles  — optional legacy Supabase Auth account metadata
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
  user_id uuid references public.profiles (id) on delete cascade,
  visitor_id uuid,
  status text not null default 'active'
    check (status in ('active', 'completed')),
  language text,
  beneficiary jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint counselling_sessions_owner_check
    check (num_nonnulls(user_id, visitor_id) = 1)
);

create index if not exists counselling_sessions_user_id_idx
  on public.counselling_sessions (user_id, created_at desc);

create index if not exists counselling_sessions_visitor_id_idx
  on public.counselling_sessions (visitor_id, created_at desc);

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
-- Preserve profile creation for any legacy Supabase Auth users.
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

-- Grants + RLS: also in fix_policies.sql (re-run that file if tables already exist).
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.counselling_sessions to authenticated;
grant select, insert, update, delete on public.session_turns to authenticated;
grant select, insert, update, delete on public.session_recommendations to authenticated;

create or replace function public.is_officer()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'officer'
  );
$$;

create or replace function public.owns_session(sid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.counselling_sessions s
    where s.id = sid and s.user_id = auth.uid()
  );
$$;

grant execute on function public.is_officer() to authenticated;
grant execute on function public.owns_session(uuid) to authenticated;

create or replace function public.profiles_lock_role()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    new.role := 'beneficiary';
    new.id := coalesce(new.id, auth.uid());
  elsif tg_op = 'UPDATE' then
    new.id := old.id;
    new.role := old.role;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_lock_role on public.profiles;
create trigger profiles_lock_role
  before insert or update on public.profiles
  for each row execute procedure public.profiles_lock_role();

alter table public.profiles enable row level security;
alter table public.counselling_sessions enable row level security;
alter table public.session_turns enable row level security;
alter table public.session_recommendations enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
drop policy if exists "profiles_delete_own" on public.profiles;
create policy "profiles_select_own" on public.profiles for select to authenticated using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles for insert to authenticated with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);
create policy "profiles_delete_own" on public.profiles for delete to authenticated using (auth.uid() = id);

drop policy if exists "sessions_own" on public.counselling_sessions;
drop policy if exists "sessions_officer_read" on public.counselling_sessions;
drop policy if exists "sessions_select_own" on public.counselling_sessions;
drop policy if exists "sessions_select_officer" on public.counselling_sessions;
drop policy if exists "sessions_insert_own" on public.counselling_sessions;
drop policy if exists "sessions_update_own" on public.counselling_sessions;
drop policy if exists "sessions_delete_own" on public.counselling_sessions;
create policy "sessions_select_own" on public.counselling_sessions for select to authenticated using (auth.uid() = user_id);
create policy "sessions_select_officer" on public.counselling_sessions for select to authenticated using (public.is_officer());
create policy "sessions_insert_own" on public.counselling_sessions for insert to authenticated with check (auth.uid() = user_id);
create policy "sessions_update_own" on public.counselling_sessions for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "sessions_delete_own" on public.counselling_sessions for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "turns_via_session" on public.session_turns;
drop policy if exists "turns_select" on public.session_turns;
drop policy if exists "turns_insert_own" on public.session_turns;
drop policy if exists "turns_update_own" on public.session_turns;
drop policy if exists "turns_delete_own" on public.session_turns;
create policy "turns_select" on public.session_turns for select to authenticated using (public.owns_session(session_id) or public.is_officer());
create policy "turns_insert_own" on public.session_turns for insert to authenticated with check (public.owns_session(session_id));
create policy "turns_update_own" on public.session_turns for update to authenticated using (public.owns_session(session_id)) with check (public.owns_session(session_id));
create policy "turns_delete_own" on public.session_turns for delete to authenticated using (public.owns_session(session_id));

drop policy if exists "recs_via_session" on public.session_recommendations;
drop policy if exists "recs_select" on public.session_recommendations;
drop policy if exists "recs_insert_own" on public.session_recommendations;
drop policy if exists "recs_update_own" on public.session_recommendations;
drop policy if exists "recs_delete_own" on public.session_recommendations;
create policy "recs_select" on public.session_recommendations for select to authenticated using (public.owns_session(session_id) or public.is_officer());
create policy "recs_insert_own" on public.session_recommendations for insert to authenticated with check (public.owns_session(session_id));
create policy "recs_update_own" on public.session_recommendations for update to authenticated using (public.owns_session(session_id)) with check (public.owns_session(session_id));
create policy "recs_delete_own" on public.session_recommendations for delete to authenticated using (public.owns_session(session_id));
