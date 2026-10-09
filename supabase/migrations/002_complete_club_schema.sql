begin;

alter table public.events
  add column start_time time,
  add column end_time time,
  add column category text,
  add column image_url text,
  add column max_participants integer,
  add column registration_deadline date;

alter table public.events
  add constraint events_valid_time_range
    check (
      (start_time is null) = (end_time is null)
      and (start_time is null or end_time > start_time)
    ),
  add constraint events_valid_capacity
    check (max_participants is null or max_participants > 0),
  add constraint events_valid_registration_deadline
    check (registration_deadline is null or registration_deadline <= event_date),
  add constraint events_valid_category
    check (
      category is null
      or category in ('Workshop', 'Design', 'Competition', 'Seminar', 'Community')
    );

create table public.board_memberships (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid unique references public.profiles (id) on delete set null,
  display_name text not null check (length(btrim(display_name)) > 0),
  position_title text not null check (length(btrim(position_title)) > 0),
  photo_path text,
  display_order integer not null check (display_order > 0),
  starts_on date,
  ends_on date,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint board_memberships_valid_term
    check (starts_on is null or ends_on is null or ends_on >= starts_on),
  constraint board_memberships_unique_order_per_term
    unique (display_order, starts_on)
);

create table public.event_registrations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  member_id uuid not null references public.profiles (id) on delete cascade,
  registered_at timestamptz not null default now(),
  status text not null default 'confirmed'
    check (status in ('confirmed', 'attended', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_registrations_id_event_member_unique
    unique (id, event_id, member_id)
);

create unique index event_registrations_one_active_per_member_event_idx
  on public.event_registrations (event_id, member_id)
  where status <> 'cancelled';

create index event_registrations_member_date_idx
  on public.event_registrations (member_id, registered_at desc);

create index event_registrations_event_status_idx
  on public.event_registrations (event_id, status);

create table public.attendance (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null,
  registration_id uuid not null,
  member_id uuid not null,
  checked_in_at timestamptz not null default now(),
  status text not null default 'verified'
    check (status = 'verified'),
  method text not null default 'qr'
    check (method in ('qr', 'manual')),
  verified_by uuid not null default auth.uid()
    references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint attendance_registration_event_member_fk
    foreign key (registration_id, event_id, member_id)
    references public.event_registrations (id, event_id, member_id)
    on delete cascade,
  constraint attendance_one_checkin_per_registration
    unique (registration_id),
  constraint attendance_one_checkin_per_member_event
    unique (event_id, member_id)
);

create index attendance_member_time_idx
  on public.attendance (member_id, checked_in_at desc);

create index attendance_event_time_idx
  on public.attendance (event_id, checked_in_at desc);

create table public.files (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) > 0),
  storage_path text not null unique,
  mime_type text not null,
  category text not null
    check (category in ('Notices', 'Event Documents', 'Club Guidelines', 'Reports', 'Other')),
  access_level text not null default 'members'
    check (access_level in ('members', 'staff', 'uploader')),
  size_bytes bigint not null check (size_bytes >= 0),
  event_id uuid references public.events (id) on delete set null,
  uploaded_by uuid not null references public.profiles (id) on delete restrict,
  uploaded_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index files_category_uploaded_at_idx
  on public.files (category, uploaded_at desc);

create index files_event_id_idx
  on public.files (event_id)
  where event_id is not null;

create table public.donations (
  id uuid primary key default gen_random_uuid(),
  donor_profile_id uuid references public.profiles (id) on delete set null,
  contributor_name text not null check (length(btrim(contributor_name)) > 0),
  purpose text not null check (length(btrim(purpose)) > 0),
  amount numeric(12, 2) not null check (amount > 0),
  currency text not null default 'NPR' check (currency = 'NPR'),
  status text not null default 'pending'
    check (status in ('pending', 'received', 'cancelled')),
  donated_at timestamptz not null default now(),
  recorded_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index donations_status_date_idx
  on public.donations (status, donated_at desc);

create index donations_donor_date_idx
  on public.donations (donor_profile_id, donated_at desc)
  where donor_profile_id is not null;

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(btrim(title)) > 0),
  body text not null check (length(btrim(body)) > 0),
  recipient_id uuid references public.profiles (id) on delete cascade,
  recipient_role text
    check (recipient_role in ('admin', 'bod', 'participant')),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint notifications_single_audience
    check (recipient_id is null or recipient_role is null)
);

create index notifications_created_at_idx
  on public.notifications (created_at desc);

create index notifications_recipient_role_created_idx
  on public.notifications (recipient_role, created_at desc);

create index notifications_recipient_id_created_idx
  on public.notifications (recipient_id, created_at desc)
  where recipient_id is not null;

create table public.notification_reads (
  notification_id uuid not null references public.notifications (id) on delete cascade,
  member_id uuid not null references public.profiles (id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (notification_id, member_id)
);

create index notification_reads_member_time_idx
  on public.notification_reads (member_id, read_at desc);

create table public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  created_at timestamptz not null default now()
);

create index activity_logs_created_at_idx
  on public.activity_logs (created_at desc);

create index activity_logs_entity_idx
  on public.activity_logs (entity_type, entity_id, created_at desc);

create table public.point_transactions (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.profiles (id) on delete cascade,
  attendance_id uuid unique references public.attendance (id) on delete set null,
  points_delta integer not null check (points_delta <> 0),
  reason text not null,
  created_at timestamptz not null default now()
);

create index point_transactions_member_time_idx
  on public.point_transactions (member_id, created_at desc);

create or replace function public.log_club_row_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected_row jsonb;
begin
  affected_row := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;

  insert into public.activity_logs (actor_id, action, entity_type, entity_id)
  values (
    (select auth.uid()),
    pg_catalog.lower(tg_op),
    tg_table_name,
    (affected_row ->> 'id')::uuid
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger events_activity_log
after insert or update or delete on public.events
for each row execute function public.log_club_row_change();

create trigger registrations_activity_log
after insert or update or delete on public.event_registrations
for each row execute function public.log_club_row_change();

create trigger attendance_activity_log
after insert or update or delete on public.attendance
for each row execute function public.log_club_row_change();

create trigger files_activity_log
after insert or update or delete on public.files
for each row execute function public.log_club_row_change();

create trigger donations_activity_log
after insert or update or delete on public.donations
for each row execute function public.log_club_row_change();

create trigger board_memberships_activity_log
after insert or update or delete on public.board_memberships
for each row execute function public.log_club_row_change();

create trigger notifications_activity_log
after insert or update or delete on public.notifications
for each row execute function public.log_club_row_change();

create or replace function public.award_attendance_points()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.point_transactions (member_id, attendance_id, points_delta, reason)
  values (new.member_id, new.id, 100, 'Verified event attendance');

  insert into public.notifications (title, body, recipient_id)
  select
    'Attendance recorded',
    'Your attendance for ' || event.title || ' has been verified.',
    new.member_id
  from public.events as event
  where event.id = new.event_id;

  return new;
end;
$$;

create trigger attendance_awards_points
after insert on public.attendance
for each row execute function public.award_attendance_points();

create or replace function public.revoke_attendance_points()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.point_transactions (member_id, attendance_id, points_delta, reason)
  values (old.member_id, null, -100, 'Attendance record removed');
  return old;
end;
$$;

create trigger attendance_reverses_points
after delete on public.attendance
for each row execute function public.revoke_attendance_points();

create or replace function public.register_for_event(target_event_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  selected_event public.events%rowtype;
  active_registration_count bigint;
  new_registration_id uuid;
begin
  if current_user_id is null then
    raise exception 'Authentication is required to register for an event';
  end if;

  select * into selected_event
  from public.events
  where id = target_event_id
  for update;

  if not found
    or selected_event.status <> 'Registration Open'
    or selected_event.event_date < current_date
    or selected_event.registration_deadline is null
    or selected_event.registration_deadline < current_date
    or selected_event.max_participants is null
  then
    raise exception 'Event registration is unavailable';
  end if;

  if exists (
    select 1
    from public.event_registrations
    where event_id = target_event_id
      and member_id = current_user_id
      and status <> 'cancelled'
  ) then
    raise exception 'You are already registered for this event';
  end if;

  select count(*) into active_registration_count
  from public.event_registrations
  where event_id = target_event_id
    and status <> 'cancelled';

  if active_registration_count >= selected_event.max_participants then
    raise exception 'Event capacity has been reached';
  end if;

  insert into public.event_registrations (event_id, member_id)
  values (target_event_id, current_user_id)
  returning id into new_registration_id;

  insert into public.notifications (title, body, recipient_id)
  values (
    'Event registration successful',
    'You are registered for ' || selected_event.title || '.',
    current_user_id
  );

  return new_registration_id;
end;
$$;

create or replace function public.cancel_event_registration(target_registration_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
begin
  if current_user_id is null then
    raise exception 'Authentication is required to cancel a registration';
  end if;

  update public.event_registrations
  set status = 'cancelled'
  where id = target_registration_id
    and member_id = current_user_id
    and status = 'confirmed';

  if not found then
    raise exception 'No cancellable registration was found';
  end if;
end;
$$;

create or replace function public.set_profile_role(target_profile_id uuid, new_role text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select public.has_club_role(array['admin'])) then
    raise exception 'Only an administrator can assign profile roles';
  end if;

  if new_role not in ('admin', 'bod', 'participant') then
    raise exception 'Invalid profile role';
  end if;

  if new_role <> 'admin' then
    perform profile.id
    from public.profiles as profile
    where profile.role = 'admin'
    order by profile.id
    for update;

    if (
      select count(*)
      from public.profiles as profile
      where profile.role = 'admin'
    ) <= 1 and exists (
      select 1
      from public.profiles as profile
      where profile.id = target_profile_id
        and profile.role = 'admin'
    ) then
      raise exception 'Cannot remove the last administrator';
    end if;
  end if;

  update public.profiles
  set role = new_role
  where id = target_profile_id;

  if not found then
    raise exception 'Profile not found';
  end if;

  insert into public.activity_logs (actor_id, action, entity_type, entity_id)
  values ((select auth.uid()), 'role_changed', 'profiles', target_profile_id);
end;
$$;

create or replace function public.get_member_leaderboard()
returns table (member_id uuid, full_name text, points bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication is required to view the member leaderboard';
  end if;

  return query
  select p.id, p.full_name, coalesce(sum(pt.points_delta), 0)::bigint
  from public.profiles as p
  left join public.point_transactions as pt on pt.member_id = p.id
  group by p.id, p.full_name
  order by coalesce(sum(pt.points_delta), 0) desc, p.full_name
  limit 100;
end;
$$;

revoke all on function public.log_club_row_change() from public, anon, authenticated;
revoke all on function public.award_attendance_points() from public, anon, authenticated;
revoke all on function public.revoke_attendance_points() from public, anon, authenticated;
revoke all on function public.register_for_event(uuid) from public, anon;
revoke all on function public.cancel_event_registration(uuid) from public, anon;
revoke all on function public.set_profile_role(uuid, text) from public, anon;
revoke all on function public.get_member_leaderboard() from public, anon;
grant execute on function public.register_for_event(uuid) to authenticated;
grant execute on function public.cancel_event_registration(uuid) to authenticated;
grant execute on function public.set_profile_role(uuid, text) to authenticated;
grant execute on function public.get_member_leaderboard() to authenticated;

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

create trigger board_memberships_set_updated_at
before update on public.board_memberships
for each row execute function public.set_updated_at();

create trigger event_registrations_set_updated_at
before update on public.event_registrations
for each row execute function public.set_updated_at();

create trigger files_set_updated_at
before update on public.files
for each row execute function public.set_updated_at();

create trigger donations_set_updated_at
before update on public.donations
for each row execute function public.set_updated_at();

alter table public.board_memberships enable row level security;
alter table public.event_registrations enable row level security;
alter table public.attendance enable row level security;
alter table public.files enable row level security;
alter table public.donations enable row level security;
alter table public.notifications enable row level security;
alter table public.notification_reads enable row level security;
alter table public.activity_logs enable row level security;
alter table public.point_transactions enable row level security;

drop policy "Users can read their own profile; staff can read all profiles"
  on public.profiles;

create policy "Users read their own profile; admins and event staff read needed profiles"
  on public.profiles
  for select
  to authenticated
  using (
    id = (select auth.uid())
    or (select public.has_club_role(array['admin']))
    or (
      (select public.has_club_role(array['bod']))
      and exists (
        select 1
        from public.event_registrations as registration
        where registration.member_id = profiles.id
      )
    )
  );

create policy "Anyone can read active board memberships"
  on public.board_memberships
  for select
  to anon, authenticated
  using (is_active);

create policy "Admins can manage board memberships"
  on public.board_memberships
  for all
  to authenticated
  using ((select public.has_club_role(array['admin'])))
  with check ((select public.has_club_role(array['admin'])));

create policy "Members can read their registrations and staff can read all"
  on public.event_registrations
  for select
  to authenticated
  using (
    member_id = (select auth.uid())
    or (select public.has_club_role(array['admin', 'bod']))
  );

create policy "Staff can create event registrations"
  on public.event_registrations
  for insert
  to authenticated
  with check ((select public.has_club_role(array['admin', 'bod'])));

create policy "Staff can update event registrations"
  on public.event_registrations
  for update
  to authenticated
  using ((select public.has_club_role(array['admin', 'bod'])))
  with check ((select public.has_club_role(array['admin', 'bod'])));

create policy "Admins can delete event registrations"
  on public.event_registrations
  for delete
  to authenticated
  using ((select public.has_club_role(array['admin'])));

create policy "Members can read their attendance and staff can read all"
  on public.attendance
  for select
  to authenticated
  using (
    member_id = (select auth.uid())
    or (select public.has_club_role(array['admin', 'bod']))
  );

create policy "Staff can record attendance"
  on public.attendance
  for insert
  to authenticated
  with check (
    (select public.has_club_role(array['admin', 'bod']))
    and verified_by = (select auth.uid())
  );

create policy "Staff can update attendance"
  on public.attendance
  for update
  to authenticated
  using ((select public.has_club_role(array['admin', 'bod'])))
  with check (
    (select public.has_club_role(array['admin', 'bod']))
    and verified_by = (select auth.uid())
  );

create policy "Admins can delete attendance"
  on public.attendance
  for delete
  to authenticated
  using ((select public.has_club_role(array['admin'])));

create policy "Members can read accessible file metadata"
  on public.files
  for select
  to authenticated
  using (
    access_level = 'members'
    or uploaded_by = (select auth.uid())
    or (
      access_level = 'staff'
      and (select public.has_club_role(array['admin', 'bod']))
    )
    or (
      access_level = 'uploader'
      and uploaded_by = (select auth.uid())
    )
  );

create policy "Staff can upload file metadata as themselves"
  on public.files
  for insert
  to authenticated
  with check (
    uploaded_by = (select auth.uid())
    and storage_path like (select auth.uid())::text || '/%'
    and (select public.has_club_role(array['admin', 'bod']))
  );

create policy "Uploader staff and admins can update file metadata"
  on public.files
  for update
  to authenticated
  using (
    (select public.has_club_role(array['admin']))
    or (
      uploaded_by = (select auth.uid())
      and storage_path like (select auth.uid())::text || '/%'
      and (select public.has_club_role(array['bod']))
    )
  )
  with check (
    (select public.has_club_role(array['admin']))
    or (
      uploaded_by = (select auth.uid())
      and storage_path like (select auth.uid())::text || '/%'
      and (select public.has_club_role(array['bod']))
    )
  );

create policy "Uploader staff and admins can delete file metadata"
  on public.files
  for delete
  to authenticated
  using (
    (select public.has_club_role(array['admin']))
    or (
      uploaded_by = (select auth.uid())
      and (select public.has_club_role(array['bod']))
    )
  );

create policy "Users can read their own donations and admins can read all"
  on public.donations
  for select
  to authenticated
  using (
    donor_profile_id = (select auth.uid())
    or (select public.has_club_role(array['admin']))
  );

create policy "Participants can create pending donations for themselves"
  on public.donations
  for insert
  to authenticated
  with check (
    donor_profile_id = (select auth.uid())
    and recorded_by is null
    and status = 'pending'
  );

create policy "Admins can manage donations"
  on public.donations
  for all
  to authenticated
  using ((select public.has_club_role(array['admin'])))
  with check ((select public.has_club_role(array['admin'])));

create policy "Users can read notifications addressed to them"
  on public.notifications
  for select
  to authenticated
  using (
    recipient_id = (select auth.uid())
    or (
      recipient_id is null
      and (recipient_role is null or recipient_role = (
        select role from public.profiles where id = (select auth.uid())
      ))
    )
    or (select public.has_club_role(array['admin']))
  );

create policy "Staff can create notifications"
  on public.notifications
  for insert
  to authenticated
  with check (
    created_by = (select auth.uid())
    and (select public.has_club_role(array['admin', 'bod']))
  );

create policy "Admins can manage notifications"
  on public.notifications
  for update
  to authenticated
  using ((select public.has_club_role(array['admin'])))
  with check ((select public.has_club_role(array['admin'])));

create policy "Admins can delete notifications"
  on public.notifications
  for delete
  to authenticated
  using ((select public.has_club_role(array['admin'])));

create policy "Users can read their notification read state"
  on public.notification_reads
  for select
  to authenticated
  using (member_id = (select auth.uid()));

create policy "Users can mark accessible notifications as read"
  on public.notification_reads
  for insert
  to authenticated
  with check (
    member_id = (select auth.uid())
    and exists (
      select 1
      from public.notifications as notification
      where notification.id = notification_id
    )
  );

create policy "Users can update their own notification read state"
  on public.notification_reads
  for update
  to authenticated
  using (member_id = (select auth.uid()))
  with check (
    member_id = (select auth.uid())
    and exists (
      select 1
      from public.notifications as notification
      where notification.id = notification_id
    )
  );

create policy "Staff can read activity logs"
  on public.activity_logs
  for select
  to authenticated
  using ((select public.has_club_role(array['admin', 'bod'])));

create policy "Members can read their own point history and staff can read all"
  on public.point_transactions
  for select
  to authenticated
  using (
    member_id = (select auth.uid())
    or (select public.has_club_role(array['admin', 'bod']))
  );

revoke all on table public.board_memberships from public, anon, authenticated;
grant select on table public.board_memberships to anon, authenticated;
grant insert, update, delete on table public.board_memberships to authenticated;

revoke all on table public.event_registrations from public, anon, authenticated;
grant select on table public.event_registrations to authenticated;
grant insert (event_id, member_id) on public.event_registrations to authenticated;
grant update (status) on public.event_registrations to authenticated;
grant delete on public.event_registrations to authenticated;

revoke all on table public.attendance from public, anon, authenticated;
grant select on table public.attendance to authenticated;
grant insert (event_id, registration_id, member_id, method, verified_by)
  on public.attendance to authenticated;
grant update (status, method, verified_by) on public.attendance to authenticated;
grant delete on table public.attendance to authenticated;

revoke all on table public.files from public, anon, authenticated;
grant select, insert on table public.files to authenticated;
grant update (name, mime_type, category, access_level, event_id)
  on public.files to authenticated;
grant delete on table public.files to authenticated;

revoke all on table public.donations from public, anon, authenticated;
grant select, insert, update, delete on table public.donations to authenticated;

revoke all on table public.notifications from public, anon, authenticated;
grant select, insert, update, delete on table public.notifications to authenticated;

revoke all on table public.notification_reads from public, anon, authenticated;
grant select, insert, update on table public.notification_reads to authenticated;

revoke all on table public.activity_logs from public, anon, authenticated;
grant select on table public.activity_logs to authenticated;

revoke all on table public.point_transactions from public, anon, authenticated;
grant select on table public.point_transactions to authenticated;

grant update (start_time, end_time, category, image_url, max_participants, registration_deadline)
  on public.events to authenticated;
grant insert (title, description, event_date, location, status, created_by,
  start_time, end_time, category, image_url, max_participants, registration_deadline)
  on public.events to authenticated;

insert into storage.buckets (id, name, public)
values ('club-private-files', 'club-private-files', false)
on conflict (id) do update set public = false;

create policy "Club members can read files shared with members"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'club-private-files'
    and exists (
      select 1
      from public.files as club_file
      where club_file.storage_path = name
        and (
          club_file.access_level = 'members'
          or club_file.uploaded_by = (select auth.uid())
          or (
            club_file.access_level = 'staff'
            and (select public.has_club_role(array['admin', 'bod']))
          )
        )
    )
  );

create policy "Staff can upload files under their own folder"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'club-private-files'
    and (select public.has_club_role(array['admin', 'bod']))
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Uploader staff and admins can update stored files"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'club-private-files'
    and (
      (select public.has_club_role(array['admin']))
      or (
        (storage.foldername(name))[1] = (select auth.uid())::text
        and (select public.has_club_role(array['bod']))
      )
    )
  )
  with check (
    bucket_id = 'club-private-files'
    and (
      (select public.has_club_role(array['admin']))
      or (
        (storage.foldername(name))[1] = (select auth.uid())::text
        and (select public.has_club_role(array['bod']))
      )
    )
  );

create policy "Uploader staff and admins can delete stored files"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'club-private-files'
    and (
      (select public.has_club_role(array['admin']))
      or (
        (storage.foldername(name))[1] = (select auth.uid())::text
        and (select public.has_club_role(array['bod']))
      )
    )
  );

commit;
