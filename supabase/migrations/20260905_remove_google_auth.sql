-- Store unauthenticated beneficiary sessions without a Google/Supabase Auth user.
-- Existing authenticated sessions remain valid and visible to administrators.

alter table public.counselling_sessions
  alter column user_id drop not null;

alter table public.counselling_sessions
  add column if not exists visitor_id uuid;

create index if not exists counselling_sessions_visitor_id_idx
  on public.counselling_sessions (visitor_id, created_at desc);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'counselling_sessions_owner_check'
      and conrelid = 'public.counselling_sessions'::regclass
  ) then
    alter table public.counselling_sessions
      add constraint counselling_sessions_owner_check
      check (num_nonnulls(user_id, visitor_id) = 1);
  end if;
end
$$;

comment on column public.counselling_sessions.visitor_id is
  'Opaque browser identifier used by the passwordless public counselling flow.';
