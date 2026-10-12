-- Run in the Supabase SQL Editor after the user has signed up and all three migrations are applied.
-- Replace the email below with the exact email address of the intended administrator.
update public.profiles as profile
set role = 'admin'
from auth.users as auth_user
where profile.id = auth_user.id
  and lower(auth_user.email) = lower('replace-this-with-your-account-email@example.com')
returning profile.id, auth_user.email, profile.role;
