begin;

alter table public.events
  add column is_paid boolean not null default false,
  add column price numeric(10, 2);

alter table public.events
  add constraint events_valid_paid_price
    check (
      (is_paid and price is not null and price > 0)
      or (not is_paid and price is null)
    );

grant update (start_time, end_time, category, image_url, max_participants, registration_deadline, is_paid, price)
  on public.events to authenticated;

alter table public.event_registrations
  add column payment_method text,
  add column payment_ref text,
  add column paid_amount numeric(10, 2),
  add column paid_at timestamptz,
  add constraint event_registrations_payment_fields_consistent
    check (
      (payment_method is null and payment_ref is null and paid_amount is null and paid_at is null)
      or (
        payment_method = 'eSewa'
        and payment_ref is not null
        and paid_amount is not null
        and paid_amount > 0
        and paid_at is not null
      )
    );

create unique index event_registrations_payment_ref_unique_idx
  on public.event_registrations (payment_ref)
  where payment_ref is not null;

create table public.event_payment_intents (
  transaction_uuid text primary key,
  event_id uuid not null references public.events (id) on delete cascade,
  member_id uuid not null references public.profiles (id) on delete cascade,
  expected_amount numeric(10, 2) not null check (expected_amount > 0),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create unique index event_payment_intents_one_active_per_member_event_idx
  on public.event_payment_intents (event_id, member_id)
  where completed_at is null;

alter table public.event_payment_intents enable row level security;
revoke all on table public.event_payment_intents from public, anon, authenticated;
grant all on table public.event_payment_intents to service_role;

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
    or selected_event.is_paid
    or selected_event.status <> 'Registration Open'
    or selected_event.event_date < current_date
    or selected_event.registration_deadline is null
    or selected_event.registration_deadline < current_date
    or selected_event.max_participants is null
  then
    raise exception 'Free event registration is unavailable';
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

create or replace function public.create_event_payment_intent(
  target_event_id uuid,
  target_member_id uuid,
  target_transaction_uuid text
)
returns numeric
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_event public.events%rowtype;
  active_registration_count bigint;
  pending_payment_count bigint;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Only the payment service can create payment intents';
  end if;

  update public.event_payment_intents
  set completed_at = now()
  where completed_at is null
    and created_at <= now() - interval '30 minutes';

  select * into selected_event
  from public.events
  where id = target_event_id
  for update;

  if not found
    or not selected_event.is_paid
    or selected_event.price is null
    or selected_event.price <= 0
    or selected_event.status <> 'Registration Open'
    or selected_event.event_date < current_date
    or selected_event.registration_deadline is null
    or selected_event.registration_deadline < current_date
    or selected_event.max_participants is null
  then
    raise exception 'Paid event registration is unavailable';
  end if;

  if exists (
    select 1
    from public.event_registrations
    where event_id = target_event_id
      and member_id = target_member_id
      and status <> 'cancelled'
  ) then
    raise exception 'You are already registered for this event';
  end if;

  if exists (
    select 1
    from public.event_payment_intents
    where event_id = target_event_id
      and member_id = target_member_id
      and completed_at is null
  ) then
    raise exception 'A payment for this event is already in progress';
  end if;

  select count(*) into active_registration_count
  from public.event_registrations
  where event_id = target_event_id
    and status <> 'cancelled';

  select count(*) into pending_payment_count
  from public.event_payment_intents
  where event_id = target_event_id
    and completed_at is null
    and created_at > now() - interval '30 minutes';

  if active_registration_count + pending_payment_count >= selected_event.max_participants then
    raise exception 'Event capacity has been reached';
  end if;

  insert into public.event_payment_intents (transaction_uuid, event_id, member_id, expected_amount)
  values (target_transaction_uuid, target_event_id, target_member_id, selected_event.price);

  return selected_event.price;
end;
$$;

create or replace function public.complete_paid_event_registration(
  target_transaction_uuid text,
  target_member_id uuid,
  target_paid_amount numeric
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_intent public.event_payment_intents%rowtype;
  selected_event public.events%rowtype;
  new_registration_id uuid;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Only the payment service can confirm paid event registrations';
  end if;

  select * into selected_intent
  from public.event_payment_intents
  where transaction_uuid = target_transaction_uuid
    and member_id = target_member_id
    and completed_at is null
    and created_at > now() - interval '30 minutes'
  for update;

  if not found or selected_intent.expected_amount <> target_paid_amount then
    raise exception 'The payment does not match an active event payment intent';
  end if;

  select * into selected_event
  from public.events
  where id = selected_intent.event_id
  for update;

  if not found or not selected_event.is_paid then
    raise exception 'This is not an active paid event';
  end if;

  if exists (
    select 1
    from public.event_registrations
    where event_id = selected_intent.event_id
      and member_id = target_member_id
      and status <> 'cancelled'
  ) then
    raise exception 'You are already registered for this event';
  end if;

  insert into public.event_registrations (
    event_id,
    member_id,
    payment_method,
    payment_ref,
    paid_amount,
    paid_at
  )
  values (
    selected_intent.event_id,
    target_member_id,
    'eSewa',
    target_transaction_uuid,
    target_paid_amount,
    now()
  )
  returning id into new_registration_id;

  update public.event_payment_intents
  set completed_at = now()
  where transaction_uuid = target_transaction_uuid;

  insert into public.notifications (title, body, recipient_id)
  values (
    'Event registration successful',
    'You are registered for ' || selected_event.title || '.',
    target_member_id
  );

  return new_registration_id;
end;
$$;

revoke all on function public.create_event_payment_intent(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.complete_paid_event_registration(text, uuid, numeric) from public, anon, authenticated;
grant execute on function public.create_event_payment_intent(uuid, uuid, text) to service_role;
grant execute on function public.complete_paid_event_registration(text, uuid, numeric) to service_role;
grant execute on function public.register_for_event(uuid) to authenticated;

commit;
