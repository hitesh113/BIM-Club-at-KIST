begin;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'profiles',
    'events',
    'event_registrations',
    'attendance',
    'files',
    'donations',
    'activity_logs',
    'point_transactions',
    'board_memberships'
  ] loop
    if not exists (
      select 1
      from pg_catalog.pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = table_name
    ) then
      execute pg_catalog.format(
        'alter publication supabase_realtime add table public.%I',
        table_name
      );
    end if;
  end loop;
end;
$$;

commit;
