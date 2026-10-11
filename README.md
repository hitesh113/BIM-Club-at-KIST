# College Club Management System

A responsive React + TypeScript frontend for the BIM Club at KIST College of Management. Authentication uses Supabase Auth when the project environment is configured; club data modules retain their existing Supabase repository and local mock fallback.

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

Restart the Vite dev server after adding or changing environment values. Without both values, authentication is unavailable and the app reports that Supabase is not configured; club data modules can still use the local mock snapshot. Keep `.env.local` out of version control; commit only `.env.example` with placeholders. Vite exposes `VITE_` variables in the browser bundle, so use only the Supabase publishable key here, never a secret or service-role key. Share project configuration through an approved private channel, not by committing the populated file. Apply the migration files in Supabase before using authenticated profile access or depending on live data.

Run `npm run test:supabase` to check project reachability. The temporary test sends an HTTP request to Supabase Auth's health endpoint and does not read or write database tables. A successful result confirms the endpoint responded; a 401/403 means the project is reachable but rejected the key, a 404 suggests the endpoint or project URL is incorrect, and a network or timeout error means the host could not be reached.

## Authentication

Member registration and sign-in use Supabase email/password authentication. Registration requires a full name, email, and password; the client sends only the full name as user metadata. The existing Auth trigger in `001_initial_schema.sql` creates the associated `public.profiles` row with the `participant` role. No role is accepted from the signup form or user-editable metadata. The client loads the authenticated user's profile under the existing profile RLS policy and uses that database role to select the workspace. Profile role updates are not permitted through the client API; assign initial administrators only through a trusted administrative path.

Enable the Email provider in Supabase Auth. The Supabase client persists and restores sessions and handles Auth callback URLs. If email confirmation is enabled in Supabase, a new user must follow the confirmation link before signing in; configure the Supabase Site URL and redirect URL allowlist for the local Vite origin and deployed app origin.

## Workspace access and demo modules

- **Admin:** members, events, attendance records, donations, files, reports, and activity log.
- **BOD:** event operations, registrations, QR-based attendance verification, attendance records, and files.
- **Participant:** event discovery and registration, QR check-in status, attendance history, contributions, notifications, and leaderboard.

Workspace roles come from `public.profiles.role`; there is no client-side role selector. Signup always creates participant access. Several non-authentication modules still use local React state and mock records: event edits, attendance verification, file metadata uploads, notifications, activity, member changes, and donation flows. Donations do not process payments.

## Current modules

- **QR-based attendance verification:** BOD/Admin users can use the device camera to decode participant QR codes through `html5-qrcode`. The scanner accepts payloads such as `BIMCLUB:reg-001` as a camera fallback, validates the registration, shows participant information, prevents duplicate attendance, and records the check-in locally.
- **File management:** Search and filter files by Notices, Event Documents, Club Guidelines, Reports, or Other. Files show type, upload date, uploader, and download feedback; uploads are local metadata-only demo actions.
- **Donations:** Participants can make mock NPR contributions and view their history. Admins can review contributors, totals, pending amounts, and the donation ledger.
- **Attendance, reports, and leaderboard:** Attendance records, participation metrics, simple charts, event breakdowns, and points-based engagement rankings use the local mock collections.
- **Notifications and activity log:** Role-aware mock notifications and an Admin activity log cover registration, attendance, donations, uploads, and club administration events.

## Data boundary

Domain types are in `src/types.ts`, sample records in `src/mockData.ts`, and the current `ClubRepository` contract/mock implementation in `src/services/clubRepository.ts`. The future database boundary is organized around:

- `profiles/users`
- `events`
- `event_registrations`
- `attendance`
- `files`
- `donations`
- `notifications`
- `activity_logs`

The current repository adapter implements that contract against Supabase when the app is configured, while preserving the mock fallback for local development and demos. Camera permission and server-side duplicate protection should be enforced again by the backend when Supabase is connected.

## Initial database migration

The initial `profiles` and `events` schema is in `supabase/migrations/001_initial_schema.sql`. To apply it manually, first confirm that the Supabase Dashboard is open for the intended project and review the migration. In **SQL Editor**, create a new query, paste the full migration file, and run it. Then verify that `profiles` and `events` exist and that RLS is enabled for both in **Table Editor**. This migration does not seed mock club records or connect the frontend to the database.

New Auth users receive a linked profile with the `participant` role. Profile role changes are not permitted through the client API; an initial administrator must be assigned through a trusted administrative path, such as a carefully targeted update in the SQL Editor after that user has signed up. Never expose a service-role key in the browser.

The additive `supabase/migrations/002_complete_club_schema.sql` migration extends the initial schema with registrations, attendance, member files and private Storage policies, donations, notifications and per-user read state, activity logs, board memberships, and point transactions. It does not replace the initial tables or seed the current mock data. Before applying it, verify whether `001_initial_schema.sql` has already been run in the target project: if not, review and apply `001` first, then `002`; if it has, apply only `002`. Existing event rows are preserved, and schedule/capacity/category extension fields remain nullable so no values are fabricated for existing rows.