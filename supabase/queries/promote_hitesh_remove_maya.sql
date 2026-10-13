-- Run in the Supabase SQL Editor after migrations 001-006 and after both accounts have profiles.
-- This aborts if either first-name match is missing or ambiguous, or if Maya still owns Storage files.
begin;

do $$
declare
  hitesh_profile_id uuid;
  maya_profile_id uuid;
  maya_photo_path text;
  maya_file_count bigint;
begin
  select profile.id
  into strict hitesh_profile_id
  from public.profiles as profile
  where lower(profile.full_name) like 'hitesh%';

  select profile.id, profile.photo_path
  into strict maya_profile_id, maya_photo_path
  from public.profiles as profile
  where lower(profile.full_name) like 'maya%';

  if hitesh_profile_id = maya_profile_id then
    raise exception 'The Hitesh and Maya profile matches must be different accounts';
  end if;

  select count(*)
  into maya_file_count
  from public.files as file
  where file.uploaded_by = maya_profile_id;

  if maya_file_count > 0 or maya_photo_path is not null then
    raise exception 'Maya still owns stored files or a profile photo; remove or transfer these through Supabase Storage before rerunning';
  end if;

  update public.profiles
  set role = 'admin'
  where id = hitesh_profile_id;

  delete from public.donations
  where donor_profile_id = maya_profile_id;

  delete from public.attendance
  where verified_by = maya_profile_id;

  delete from public.board_memberships
  where profile_id = maya_profile_id;

  delete from public.activity_logs
  where actor_id = maya_profile_id;

  delete from public.notifications
  where created_by = maya_profile_id;

  delete from auth.users
  where id = maya_profile_id;

  if not found then
    raise exception 'Maya Auth account was not found';
  end if;
end;
$$;

commit;
