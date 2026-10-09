begin;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null check (length(btrim(full_name)) > 0),
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
  title text not null check (length(btrim(title)) > 0),
  description text not null default '',
  event_date date not null,
  start_time time not null,
  end_time time not null,
  location text not null check (length(btrim(location)) > 0),
  category text not null check (length(btrim(category)) > 0),
  image_url text,
  max_participants integer not null check (max_participants > 0),
  registration_deadline date not null,
  status text not null default 'Draft'
    check (status in (
      'Draft',
      'Published',
      'Registration Open',
      'Registration Closed',
      'Completed',
      'Cancelled'
    )),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint events_valid_time_range check (end_time > start_time),
  constraint events_registration_deadline_before_event
    check (registration_deadline <= event_date)
);

create index events_status_date_idx
  on public.events (status, event_date);

create index events_created_by_idx
  on public.events (created_by)
  where created_by is not null;

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

create policy "Members can read their own profile and staff can read all profiles"
  on public.profiles
  for select
  to authenticated
  using (
    id = (select auth.uid())
    or (select public.has_club_role(array['admin', 'bod']))
  );

create policy "Members and staff can update profile names"
  on public.profiles
  for update
  to authenticated
  using (
    id = (select auth.uid())
    or (select public.has_club_role(array['admin', 'bod']))
  )
  with check (
    id = (select auth.uid())
    or (select public.has_club_role(array['admin', 'bod']))
  );

create policy "Anyone can read non-draft events"
  on public.events
  for select
  to anon, authenticated
  using (status <> 'Draft');

create policy "Club staff can read all events"
  on public.events
  for select
  to authenticated
  using ((select public.has_club_role(array['admin', 'bod'])));

create policy "Club staff can create events"
  on public.events
  for insert
  to authenticated
  with check ((select public.has_club_role(array['admin', 'bod'])));

create policy "Club staff can update events"
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
grant insert, update, delete on table public.events to authenticated;

commit;
