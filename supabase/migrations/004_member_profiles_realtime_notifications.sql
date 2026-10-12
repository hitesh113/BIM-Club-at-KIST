begin;

alter table public.profiles
  add column photo_path text;

grant update (photo_path) on public.profiles to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'member-profile-photos',
  'member-profile-photos',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy "Members can read their own profile photos"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'member-profile-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Members can upload their own profile photos"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'member-profile-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Members can update their own profile photos"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'member-profile-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'member-profile-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

do $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notification_reads'
  ) then
    alter publication supabase_realtime add table public.notification_reads;
  end if;
end;
$$;

commit;
