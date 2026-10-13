# College Club Management System

A responsive React + TypeScript application for the BIM Club at KIST College of Management. Authentication, club records, and file storage use Supabase; the app does not display seeded demo records.

## Run locally

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. Use `npm run build` to create a production build and `npm run lint` to run Oxlint.

## Supabase configuration

The official `@supabase/supabase-js` client is available from `src/lib/supabase.ts`. `.env.local` is intentionally ignored by Git so project credentials are not copied to every clone. It will therefore not appear in a partner's checkout.

After cloning the repository, each developer should create their own local environment file from the tracked template:

```powershell
Copy-Item .env.example .env.local
```

Then replace the placeholders in `.env.local` with the Supabase project URL and publishable key supplied by the project owner (Supabase Dashboard → **Project Settings → API**):

```env
VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<your-supabase-publishable-key>
```

Restart the Vite dev server after adding or changing environment values. Without both values, authentication and database writes are unavailable and the app displays no sample records. Keep `.env.local` out of version control; commit only `.env.example` with placeholders. Vite exposes `VITE_` variables in the browser bundle, so use only the Supabase publishable key here, never a secret or service-role key. Share project configuration through an approved private channel, not by committing the populated file. Apply the migration files in Supabase before using authenticated profile access or depending on live data.

Run `npm run test:supabase` to check project reachability. The temporary test sends an HTTP request to Supabase Auth's health endpoint and does not read or write database tables. A successful result confirms the endpoint responded; a 401/403 means the project is reachable but rejected the key, a 404 suggests the endpoint or project URL is incorrect, and a network or timeout error means the host could not be reached.

## Authentication

Member registration and sign-in use Supabase email/password authentication. Registration requires a full name, email, and password; the client sends only the full name as user metadata. The existing Auth trigger in `001_initial_schema.sql` creates the associated `public.profiles` row with the `participant` role. No role is accepted from the signup form or user-editable metadata. The client loads the authenticated user's profile under the existing profile RLS policy and uses that database role to select the workspace. Participants see their own registrations, check-in QR codes, attendance, and points; staff can scan a QR only for an active event registration. Profile role updates are not permitted through the client API; assign initial administrators only through a trusted administrative path.

Enable the Email provider in Supabase Auth. The Supabase client persists and restores sessions and handles Auth callback URLs. If email confirmation is enabled in Supabase, a new user must follow the confirmation link before signing in; configure the Supabase Site URL and redirect URL allowlist for the local Vite origin and deployed app origin.

## Workspace access

- **Admin:** members, events, attendance records, donations, files, reports, and activity log.
- **BOD:** event operations, registrations, QR-based attendance verification, attendance records, and files.
- **Participant:** event discovery and registration, QR check-in status, attendance history, contributions, notifications, and leaderboard.

Workspace roles come from `public.profiles.role`; there is no client-side role selector. Signup always creates participant access and the Auth trigger adds the new profile to the members list. Events, registrations, attendance, donations, files, notifications, activity, and member data are loaded from Supabase. The app subscribes to Supabase Realtime changes and refreshes the affected workspace data. Profile photos use the private `member-profile-photos` Storage bucket and each member can access only their own photo.

## Current modules

- **QR-based attendance verification:** Participants receive an individual QR code for each active registration. BOD/Admin users can use the device camera to decode those codes through `html5-qrcode`; the server validates the active registration, blocks duplicate check-ins, records attendance, and updates the registration and points atomically.
- **File management:** Staff uploads binary files to the private `club-private-files` Storage bucket and records metadata in `public.files`. Members can preview PDFs, images, text-based files, DOCX text, and XLSX worksheets in the site and download originals; other formats remain downloadable.
- **Donations:** Participants can record pending NPR contributions. Admin-recorded donations are stored in the live ledger; this does not process payments.
- **Attendance, reports, and leaderboard:** Metrics and charts are derived from current Supabase records.
- **Notifications and activity log:** Notifications are filtered by Supabase RLS, track per-member read state, and refresh with live changes. Publishing an event sends a notification to club members. Activity entries are read from the database.

## Data boundary

Domain types are in `src/types.ts`, the empty no-data snapshot is in `src/mockData.ts`, and the `ClubRepository` implementations are in `src/services/clubRepository.ts`. The database boundary is organized around:

- `profiles/users`
- `events`
- `event_registrations`
- `attendance`
- `files`
- `donations`
- `notifications`
- `activity_logs`

Supabase errors are surfaced instead of being replaced by unrelated mock records. Camera permission and duplicate protection are validated again by the backend.

## Database setup and account administration

The app requires the Supabase schema, access policies, Storage buckets, and Realtime publication to be configured in the same project as the credentials in `.env.local`. Apply the SQL files from the Supabase Dashboard's **SQL Editor**, in this order:

1. `supabase/migrations/001_initial_schema.sql` creates the profiles and events tables. If this migration has already run, do not rerun it.
2. `supabase/migrations/002_complete_club_schema.sql` adds registrations, attendance, files and private file Storage policies, donations, notifications, activity logs, board memberships, and points.
3. `supabase/migrations/003_registered_attendance.sql` adds the atomic, registration-validated attendance check-in operation.
4. `supabase/migrations/004_member_profiles_realtime_notifications.sql` adds private profile-photo Storage and Realtime support for notifications.
5. `supabase/migrations/005_realtime_club_data.sql` enables Realtime for the remaining club data tables.

For an existing installation, first identify which migrations have already been applied and run only the unapplied migrations, preserving this order. Review each SQL file and confirm the Dashboard is connected to the intended project before running it. The migrations do not populate demo records; existing event rows are preserved, and new members are created as `participant` profiles by the Supabase Auth trigger when they sign up. Configure the app's Supabase URL and publishable key as described above.

### Granting Hitesh admin access and removing Maya

Client-side role changes are not allowed. To perform the requested account change, first ensure both accounts have signed up so their profiles exist, then open `supabase/queries/promote_hitesh_remove_maya.sql` in the SQL Editor. **Before executing it, verify that the query's name-prefix matches identify the intended accounts.** It requires exactly one profile whose name begins with `Hitesh` and one beginning with `Maya`; it does not identify users by email. If either match is absent or ambiguous, the transaction fails without applying the changes.

The query promotes Hitesh's profile to `admin`, then deletes Maya's Auth account and profile-linked records. Profile-dependent member data is removed through database cascades; authored attendance, donations, board membership, activity, and notifications are handled explicitly. It refuses to proceed while Maya still owns uploaded club files or a profile photo, since those objects must first be removed or transferred in the relevant private Supabase Storage bucket. Confirm the target project, matched profiles, and any needed Storage cleanup before running the query. Do not put a Supabase service-role key in the frontend or commit secrets.