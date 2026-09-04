-- Run this in the SQL Editor if tables already exist.
-- Replaces the old policies so a signed-in user can insert/update/delete
-- only their own rows.

grant usage on schema public to authenticated;

grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.counselling_sessions to authenticated;
grant select, insert, update, delete on public.session_turns to authenticated;
grant select, insert, update, delete on public.session_recommendations to authenticated;

-- Existing Google users who signed in before the profile trigger
insert into public.profiles (id, email, full_name, avatar_url)
select
  u.id,
  u.email,
  coalesce(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name'),
  coalesce(u.raw_user_meta_data->>'avatar_url', u.raw_user_meta_data->>'picture')
from auth.users u
on conflict (id) do nothing;

create or replace function public.is_officer()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'officer'
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
    select 1
    from public.counselling_sessions s
    where s.id = sid
      and s.user_id = auth.uid()
  );
$$;

grant execute on function public.is_officer() to authenticated;
grant execute on function public.owns_session(uuid) to authenticated;

-- Do not let a user promote themselves to officer
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

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
drop policy if exists "profiles_delete_own" on public.profiles;

create policy "profiles_select_own"
  on public.profiles for select
  to authenticated
  using (auth.uid() = id);

create policy "profiles_insert_own"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);

create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "profiles_delete_own"
  on public.profiles for delete
  to authenticated
  using (auth.uid() = id);

-- ---------------------------------------------------------------------------
-- counselling_sessions
-- ---------------------------------------------------------------------------
drop policy if exists "sessions_own" on public.counselling_sessions;
drop policy if exists "sessions_officer_read" on public.counselling_sessions;
drop policy if exists "sessions_select_own" on public.counselling_sessions;
drop policy if exists "sessions_insert_own" on public.counselling_sessions;
drop policy if exists "sessions_update_own" on public.counselling_sessions;
drop policy if exists "sessions_delete_own" on public.counselling_sessions;
drop policy if exists "sessions_select_officer" on public.counselling_sessions;

create policy "sessions_select_own"
  on public.counselling_sessions for select
  to authenticated
  using (auth.uid() = user_id);

create policy "sessions_select_officer"
  on public.counselling_sessions for select
  to authenticated
  using (public.is_officer());

create policy "sessions_insert_own"
  on public.counselling_sessions for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "sessions_update_own"
  on public.counselling_sessions for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "sessions_delete_own"
  on public.counselling_sessions for delete
  to authenticated
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- session_turns
-- ---------------------------------------------------------------------------
drop policy if exists "turns_via_session" on public.session_turns;
drop policy if exists "turns_select" on public.session_turns;
drop policy if exists "turns_insert_own" on public.session_turns;
drop policy if exists "turns_update_own" on public.session_turns;
drop policy if exists "turns_delete_own" on public.session_turns;

create policy "turns_select"
  on public.session_turns for select
  to authenticated
  using (public.owns_session(session_id) or public.is_officer());

create policy "turns_insert_own"
  on public.session_turns for insert
  to authenticated
  with check (public.owns_session(session_id));

create policy "turns_update_own"
  on public.session_turns for update
  to authenticated
  using (public.owns_session(session_id))
  with check (public.owns_session(session_id));

create policy "turns_delete_own"
  on public.session_turns for delete
  to authenticated
  using (public.owns_session(session_id));

-- ---------------------------------------------------------------------------
-- session_recommendations
-- ---------------------------------------------------------------------------
drop policy if exists "recs_via_session" on public.session_recommendations;
drop policy if exists "recs_select" on public.session_recommendations;
drop policy if exists "recs_insert_own" on public.session_recommendations;
drop policy if exists "recs_update_own" on public.session_recommendations;
drop policy if exists "recs_delete_own" on public.session_recommendations;

create policy "recs_select"
  on public.session_recommendations for select
  to authenticated
  using (public.owns_session(session_id) or public.is_officer());

create policy "recs_insert_own"
  on public.session_recommendations for insert
  to authenticated
  with check (public.owns_session(session_id));

create policy "recs_update_own"
  on public.session_recommendations for update
  to authenticated
  using (public.owns_session(session_id))
  with check (public.owns_session(session_id));

create policy "recs_delete_own"
  on public.session_recommendations for delete
  to authenticated
  using (public.owns_session(session_id));
