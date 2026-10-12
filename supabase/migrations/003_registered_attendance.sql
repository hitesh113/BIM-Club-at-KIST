begin;

create or replace function public.record_event_attendance(
  target_registration_id uuid,
  checkin_method text default 'qr'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  selected_registration public.event_registrations%rowtype;
  new_attendance_id uuid;
begin
  if current_user_id is null
    or not (select public.has_club_role(array['admin', 'bod']))
  then
    raise exception 'Only authenticated event staff can record attendance';
  end if;

  if checkin_method not in ('qr', 'manual') then
    raise exception 'Invalid attendance check-in method';
  end if;

  select * into selected_registration
  from public.event_registrations
  where id = target_registration_id
  for update;

  if not found or selected_registration.status <> 'confirmed' then
    raise exception 'An active event registration is required to check in';
  end if;

  insert into public.attendance (
    event_id,
    registration_id,
    member_id,
    method,
    verified_by
  )
  values (
    selected_registration.event_id,
    selected_registration.id,
    selected_registration.member_id,
    checkin_method,
    current_user_id
  )
  returning id into new_attendance_id;

  update public.event_registrations
  set status = 'attended'
  where id = selected_registration.id;

  return new_attendance_id;
end;
$$;

revoke all on function public.record_event_attendance(uuid, text)
  from public, anon;
grant execute on function public.record_event_attendance(uuid, text)
  to authenticated;

commit;
