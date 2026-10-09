begin;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null
    check (length(btrim(full_name)) > 0),
  email text,
  role text not null default 'participant'
    check (role in ('admin', 'bod', 'participant')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index profiles_email_lower_unique_idx
  on public.profiles (lower(email))
  where email is not null;

create table public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null
    check (length(btrim(title)) > 0),
  description text not null default '',
  event_date date not null,
  location text not null
    check (length(btrim(location)) > 0),
  status text not null default 'Draft'
    check (status in (
      'Draft',
      'Published',
      'Registration Open',
      'Registration Closed',
      'Completed',
      'Cancelled'
    )),
  created_by uuid default auth.uid()
    references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index events_status_date_idx
  on public.events (status, event_date);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := pg_catalog.now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger events_set_updated_at
before update on public.events
for each row execute function public.set_updated_at();

create or replace function public.handle_auth_user_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  resolved_name text;
begin
  resolved_name := coalesce(
    nullif(pg_catalog.btrim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(pg_catalog.split_part(coalesce(new.email, ''), '@', 1), ''),
    'BIM Club member'
  );

  insert into public.profiles (id, full_name, email, role)
  values (new.id, resolved_name, new.email, 'participant')
  on conflict (id) do update
    set email = excluded.email;

  return new;
end;
$$;

create trigger on_auth_user_profile_created
after insert or update of email on auth.users
for each row execute function public.handle_auth_user_profile();

insert into public.profiles (id, full_name, email, role)
select
  users.id,
  coalesce(
    nullif(pg_catalog.btrim(users.raw_user_meta_data ->> 'full_name'), ''),
    nullif(pg_catalog.split_part(coalesce(users.email, ''), '@', 1), ''),
    'BIM Club member'
  ),
  users.email,
  'participant'
from auth.users as users
on conflict (id) do nothing;

create or replace function public.has_club_role(required_roles text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = any (required_roles)
  );
$$;

revoke all on function public.has_club_role(text[]) from public, anon;
grant execute on function public.has_club_role(text[]) to authenticated;
revoke all on function public.handle_auth_user_profile() from public, anon, authenticated;
revoke all on function public.set_updated_at() from public, anon, authenticated;

alter table public.profiles enable row level security;
alter table public.events enable row level security;

create policy "Users can read their own profile; staff can read all profiles"
  on public.profiles
  for select
  to authenticated
  using (
    id = (select auth.uid())
    or (select public.has_club_role(array['admin', 'bod']))
  );

create policy "Users can update only their own profile name"
  on public.profiles
  for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy "Anyone can read non-draft events"
  on public.events
  for select
  to anon, authenticated
  using (status <> 'Draft');

create policy "Staff can read all events"
  on public.events
  for select
  to authenticated
  using ((select public.has_club_role(array['admin', 'bod'])));

create policy "Staff can create events as themselves"
  on public.events
  for insert
  to authenticated
  with check (
    (select public.has_club_role(array['admin', 'bod']))
    and created_by = (select auth.uid())
  );

create policy "Staff can update events"
  on public.events
  for update
  to authenticated
  using ((select public.has_club_role(array['admin', 'bod'])))
  with check ((select public.has_club_role(array['admin', 'bod'])));

create policy "Admins can delete events"
  on public.events
  for delete
  to authenticated
  using ((select public.has_club_role(array['admin'])));

revoke all on table public.profiles from public, anon, authenticated;
grant select on table public.profiles to authenticated;
grant update (full_name) on table public.profiles to authenticated;

revoke all on table public.events from public, anon, authenticated;
grant select on table public.events to anon, authenticated;
grant insert on table public.events to authenticated;
grant update (title, description, event_date, location, status)
  on table public.events to authenticated;
grant delete on table public.events to authenticated;

commit;
