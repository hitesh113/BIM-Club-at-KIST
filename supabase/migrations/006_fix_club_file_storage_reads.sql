begin;

drop policy if exists "Club members can read files shared with members"
  on storage.objects;

create policy "Club members can read files shared with members"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'club-private-files'
    and exists (
      select 1
      from public.files as club_file
      where club_file.storage_path = storage.objects.name
        and (
          club_file.access_level = 'members'
          or club_file.uploaded_by = (select auth.uid())
          or (
            club_file.access_level = 'staff'
            and (select public.has_club_role(array['admin', 'bod']))
          )
          or (
            club_file.access_level = 'uploader'
            and club_file.uploaded_by = (select auth.uid())
          )
        )
    )
  );

drop policy if exists "Uploader staff and admins can delete file metadata"
  on public.files;
drop policy if exists "Admins can delete club file metadata"
  on public.files;

create policy "Admins can delete club file metadata"
  on public.files
  for delete
  to authenticated
  using ((select public.has_club_role(array['admin'])));

drop policy if exists "Uploader staff and admins can delete stored files"
  on storage.objects;
drop policy if exists "Admins can delete stored club files"
  on storage.objects;

create policy "Admins can delete stored club files"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'club-private-files'
    and (select public.has_club_role(array['admin']))
  );

commit;
