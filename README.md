# College Club Management System

A responsive React + TypeScript frontend for the BIM Club at KIST College of Management. The application currently uses realistic local mock data. A reusable Supabase client is configured for future data integration; existing UI and application flows continue to use mock data.

## Run locally

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. Use `npm run build` to create a production build and `npm run lint` to run Oxlint.

## Supabase configuration

The official `@supabase/supabase-js` client is available from `src/lib/supabase.ts`. Configure the Vite environment before using it by creating a `.env.local` file in the project root:

```env
VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<your-supabase-publishable-key>
```

For this project, the project reference is `okphwkwdxfvttprjylux`. Keep `.env.local` out of version control; it is ignored by Git. Vite exposes `VITE_` variables in the browser bundle, so use only a Supabase publishable key here, never a service-role key. The current app still uses mock data and has no Supabase queries or authentication wiring. An initial schema migration is prepared but has not been applied.

Run `npm run test:supabase` to check project reachability. The temporary test sends an HTTP request to Supabase Auth's health endpoint and does not read or write database tables. A successful result confirms the endpoint responded; a 401/403 means the project is reachable but rejected the key, a 404 suggests the endpoint or project URL is incorrect, and a network or timeout error means the host could not be reached.

## Demo roles

Choose **Member sign in** and select a demo role:

- **Admin:** members, events, attendance records, donations, files, reports, and activity log.
- **BOD:** event operations, registrations, QR-based attendance verification, attendance records, and files.
- **Participant:** event discovery and registration, QR check-in status, attendance history, contributions, notifications, and leaderboard.

The demo sign-in does not validate credentials. Event registration, event edits, member changes, attendance verification, file uploads, notifications, and donations update local React state only. Donations use a mock contribution flow with NPR amounts; no real payment processing is connected.

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

A future Supabase adapter can implement that contract and replace the mock repository without changing the role-based UI. Camera permission and server-side duplicate protection should be enforced again by the backend when Supabase is connected.

## Initial database migration

The initial `profiles` and `events` schema is in `supabase/migrations/001_initial_schema.sql`. To apply it manually, first confirm that the Supabase Dashboard is open for the intended project and review the migration. In **SQL Editor**, create a new query, paste the full migration file, and run it. Then verify that `profiles` and `events` exist and that RLS is enabled for both in **Table Editor**. This migration does not seed mock club records or connect the frontend to the database.

New Auth users receive a linked profile with the `participant` role. Profile role changes are not permitted through the client API; an initial administrator must be assigned through a trusted administrative path, such as a carefully targeted update in the SQL Editor after that user has signed up. Never expose a service-role key in the browser.

The additive `supabase/migrations/002_complete_club_schema.sql` migration extends the initial schema with registrations, attendance, member files and private Storage policies, donations, notifications and per-user read state, activity logs, board memberships, and point transactions. It does not replace the initial tables or seed the current mock data. Before applying it, verify whether `001_initial_schema.sql` has already been run in the target project: if not, review and apply `001` first, then `002`; if it has, apply only `002`. Existing event rows are preserved, and schedule/capacity/category extension fields remain nullable so no values are fabricated for existing rows.